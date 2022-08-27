import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as osearch from "aws-cdk-lib/aws-opensearchservice";
import { Construct } from "constructs";

export interface OpenSearchProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  accessPolicies: iam.PolicyStatement[];
}

export class OpenSearch extends osearch.Domain {
  constructor(scope: Construct, id: string, props: OpenSearchProps) {
    super(scope, id, {
      // TODO: Check newer OpenSearch Version
      version: osearch.EngineVersion.ELASTICSEARCH_6_8,
      zoneAwareness: { availabilityZoneCount: 2, enabled: true },
      enableVersionUpgrade: true,
      vpc: props.vpc,
      vpcSubnets: [{ subnetType: ec2.SubnetType.PRIVATE_WITH_NAT }],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      accessPolicies: props.accessPolicies,
      capacity: {
        dataNodes: 2,
      },
    });
  }
}
