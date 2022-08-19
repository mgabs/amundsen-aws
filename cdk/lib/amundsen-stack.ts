import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecsp from "aws-cdk-lib/aws-ecs-patterns";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

import { AmundsenVpc } from "./constructs/amundsen-vpc";
import { Bucket } from "./constructs/bucket-construct";
import { AmundsenFargate } from "./constructs/fargate-construct";
import { IamPolicyStatement } from "./constructs/iam-policy";
import { NeptuneCluster } from "./constructs/neptune-construct";
import { OpenSearch } from "./constructs/open-search";
import { ServiceLinkedRole } from "./constructs/service-linked-role";

export class AmundsenStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    const amundsenBasePort = 5000;
    const amundsenSearchPort = 5001;
    const amundsenMetadataPort = 5002;

    // OpenSearch Service Role
    // will succeseed first time only
    const osServiceLinkedRole = new ServiceLinkedRole(
      this,
      "ElasticServiceRole",
      {
        awsServiceName: "es.amazonaws.com",
        description: "es service linked role",
      }
    );

    // Vpc setup
    const amundsenVpc = new AmundsenVpc(this, "AmundsenVpc");

    // Get lists of Subnets by type
    var neptunePublicSubnets = amundsenVpc.publicSubnets;
    var neptunePrivateSubnets = amundsenVpc.privateSubnets;
    var neptuneIsolatedSubnets = amundsenVpc.isolatedSubnets;

    // Create Subnet group list to be used with Neptune.
    const neptuneSubnets: ec2.SubnetSelection = {
      subnets: neptuneIsolatedSubnets,
    };

    const accessPolicies: iam.PolicyStatement[] = [
      new IamPolicyStatement(this, "AmundsenPolicy", {
        region: this.region,
        account: this.account,
      }),
    ];

    // Elastic Search
    const openSearch = new OpenSearch(this, "elasticSearch", {
      vpc: amundsenVpc,
      accessPolicies: accessPolicies,
    });

    const neptuneRole = new iam.Role(this, "NeptuneRole", {
      assumedBy: new iam.ServicePrincipal("rds.amazonaws.com"),
    });

    const bucket = new Bucket(this, "amundsen-bucket", {
      region: this.region,
      account: this.account,
    });
    bucket.grantReadWrite(neptuneRole);

    const neptuneCluster = new NeptuneCluster(this, "NeptuneCluster", {
      name: "AmundsenGraphDb",
      vpc: amundsenVpc,
      query_timeout: "120000",
      enable_audit_log: "1",
      subnets: neptuneSubnets,
      associatedRoles: [neptuneRole],
    });

    const logGroup = new logs.LogGroup(this, this.stackName);

    const amundsenFargate = new AmundsenFargate(this, "AmundsenFargate", {
      amundsenBasePort,
      amundsenSearchPort,
      amundsenMetadataPort,
      logGroup,
      region: this.region,
      bucket,
      neptuneCluster,
      openSearchDomainEndpoint: openSearch.domainEndpoint,
    });

    const taskDefinition = amundsenFargate.taskDefinition;

    const sg = new ec2.SecurityGroup(this, "clusterSG", { vpc: amundsenVpc });
    sg.addIngressRule(
      ec2.Peer.ipv4(amundsenVpc.vpcCidrBlock),
      ec2.Port.allTcp()
    );

    const service = new ecsp.ApplicationLoadBalancedFargateService(
      this,
      "service",
      {
        taskDefinition,
        cpu: 512,
        memoryLimitMiB: 2048,
        publicLoadBalancer: true,
        protocol: elbv2.ApplicationProtocol.HTTP,
      }
    );

    neptuneCluster.connections.allowFrom(service.cluster, ec2.Port.allTcp());
    openSearch.connections.allowFrom(service.cluster, ec2.Port.allTcp());

    openSearch.connections.allowFrom(
      ec2.Peer.ipv4(amundsenVpc.vpcCidrBlock),
      ec2.Port.allTcp()
    );

    neptuneCluster.grantConnect(taskDefinition.taskRole);
    openSearch.grantReadWrite(taskDefinition.taskRole);

    // Some information about the stack
    new cdk.CfnOutput(this, "es-endpoint", {
      value: openSearch.domainEndpoint,
    });
    new cdk.CfnOutput(this, "NeptuneRoleOutput", {
      value: neptuneRole.roleName,
    });
    new cdk.CfnOutput(this, "bucket-name", { value: bucket.bucketName });
    new cdk.CfnOutput(this, "neptune-endpoint", {
      value: `${neptuneCluster.clusterEndpoint.socketAddress}`,
    });
  }
}
