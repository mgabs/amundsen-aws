import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as cdk from "aws-cdk-lib";
import * as neptune_alpha from "@aws-cdk/aws-neptune-alpha";
import { Construct } from "constructs";
import * as iam from "aws-cdk-lib/aws-iam";

export interface neptuneProps {
  name: string;
  vpc: ec2.Vpc;
  subnets: ec2.SubnetSelection;
  clusterParamGroup: neptune_alpha.IClusterParameterGroup;
  paramGroup: neptune_alpha.IParameterGroup;
  associatedRoles: iam.IRole[];
}
export class NeptuneCluster extends neptune_alpha.DatabaseCluster {
  constructor(scope: Construct, id: string, props: neptuneProps) {
    super(scope, id, {
      dbClusterName: props.name,
      vpc: props.vpc,
      vpcSubnets: props.subnets,
      instanceType: neptune_alpha.InstanceType.R5_LARGE,
      clusterParameterGroup: props.clusterParamGroup,
      parameterGroup: props.paramGroup,
      associatedRoles: props.associatedRoles,
      iamAuthentication: true,
      deletionProtection: false, // Not recommended for production clusters. This is enabled to easily delete the example stack.
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Not recommended for production clusters. This is enabled to easily delete the example stack.
    });

    this.connections.allowDefaultPortFrom(
      ec2.Peer.ipv4(props.vpc.vpcCidrBlock)
    );
  }
}
