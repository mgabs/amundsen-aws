import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecsp from "aws-cdk-lib/aws-ecs-patterns";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as neptune_alpha from "@aws-cdk/aws-neptune-alpha";
import * as neptune from "aws-cdk-lib/aws-neptune";
import * as s3 from "aws-cdk-lib/aws-s3";

import { AmundsenVpc } from "./constructs/amundsen-vpc";
import { Construct } from "constructs";
import { ServiceLinkedRole } from "./constructs/service-linked-role";
import { IamPolicyStatement } from "./constructs/iam-policy";
import { OpenSearch } from "./constructs/open-search";
import { NeptuneCluster } from "./constructs/neptune-construct";

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

    const bucket = new s3.Bucket(this, "amundsen-bucket", {
      bucketName: `amundsenexample-${this.region}-${this.account}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });
    bucket.grantReadWrite(neptuneRole);

    // Create Neptune Cluster
    const clusterParams = new neptune_alpha.ClusterParameterGroup(
      this,
      "ClusterParams",
      {
        description: "Cluster parameter group",
        parameters: {
          neptune_enable_audit_log: "1",
        },
      }
    );

    const dbParams = new neptune_alpha.ParameterGroup(this, "DbParams", {
      description: "Db parameter group",
      parameters: {
        neptune_query_timeout: "120000",
      },
    });

    const neptuneCluster = new NeptuneCluster(this, "NeptuneCluster", {
      name: "MyGraphDB",
      vpc: amundsenVpc,
      subnets: neptuneSubnets,
      clusterParamGroup: clusterParams,
      paramGroup: dbParams,
      associatedRoles: [neptuneRole],
    });

    const taskDefinition = new ecs.FargateTaskDefinition(
      this,
      "amundsen-task-def",
      {
        cpu: 1024,
        memoryLimitMiB: 4096,
      }
    );

    const logGroup = new logs.LogGroup(this, this.stackName);
    taskDefinition.addContainer("amundsenfrontend", {
      image: ecs.ContainerImage.fromRegistry(
        "amundsendev/amundsen-frontend:3.7.0"
      ),
      containerName: "frontend",
      memoryLimitMiB: 1024,
      portMappings: [
        {
          containerPort: amundsenBasePort,
        },
      ],
      environment: {
        LOG_LEVEL: "DEBUG",
        SEARCHSERVICE_BASE: `http://localhost:${amundsenSearchPort}`,
        METADATASERVICE_BASE: `http://localhost:${amundsenMetadataPort}`,
        FRONTEND_SVC_CONFIG_MODULE_CLASS:
          "amundsen_application.config.TestConfig",
      },
      logging: new ecs.AwsLogDriver({
        logGroup,
        streamPrefix: "amundsenfrontend",
      }),
    });

    taskDefinition.addContainer("amundsen-search", {
      image: ecs.ContainerImage.fromRegistry(
        "amundsendev/amundsen-search:2.5.1"
      ),
      containerName: "search",
      memoryLimitMiB: 1024,
      portMappings: [
        {
          containerPort: amundsenSearchPort,
        },
      ],
      environment: {
        LOG_LEVEL: "DEBUG",
        PROXY_ENDPOINT: `https://${openSearch.domainEndpoint}`,
        PROXY_CLIENT: "ELASTICSEARCH",
        PORT: `${amundsenSearchPort}`,
        PROXY_PORT: "443",
        // these are required, else you'll have a bad day
        CREDENTIALS_PROXY_USER: "",
        CREDENTIALS_PROXY_PASSWORD: "",
      },
      logging: new ecs.AwsLogDriver({
        logGroup,
        streamPrefix: "amundsensearch",
      }),
    });

    const cfnNeptune = neptuneCluster.node.defaultChild as neptune.CfnDBCluster;

    taskDefinition.addContainer("amundsen-metadata", {
      image: ecs.ContainerImage.fromRegistry(
        "amundsendev/amundsen-metadata:3.5.0"
      ),
      containerName: "metadata",
      memoryLimitMiB: 1024,
      portMappings: [
        {
          containerPort: amundsenMetadataPort,
        },
      ],
      environment: {
        LOG_LEVEL: "DEBUG",
        METADATA_SVC_CONFIG_MODULE_CLASS:
          "metadata_service.config.NeptuneConfig",
        AWS_REGION: this.region,
        S3_BUCKET_NAME: bucket.bucketName,
        IGNORE_NEPTUNE_SHARD: "True",
        PROXY_CLIENT: "NEPTUNE",
        PROXY_HOST: `wss://${neptuneCluster.clusterEndpoint.socketAddress}/gremlin`,
        PROXY_PORT: cfnNeptune.attrPort,
        PROXY_ENCRYPTED: "True",
        PROXY_VALIDATE_SSL: "False",
      },
      logging: new ecs.AwsLogDriver({
        logGroup,
        streamPrefix: "amundsenmetadata",
      }),
    });

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
