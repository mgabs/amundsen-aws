import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as neptune_alpha from "@aws-cdk/aws-neptune-alpha";
import { Construct } from "constructs";

export interface neptuneParamProps {
  description: string;
  neptune_query_timeout: string;
}

export class NeptuneParamGroup extends neptune_alpha.ParameterGroup {
  constructor(scope: Construct, id: string, props: neptuneParamProps) {
    super(scope, id, {
      description: props.description,
      parameters: {
        neptune_query_timeout: props.neptune_query_timeout,
      },
    });
  }
}
export interface neptuneClusterParamProps {
  description: string;
  enable_audit_log: string;
}

export class NeptuneClusterParams extends neptune_alpha.ClusterParameterGroup {
  constructor(scope: Construct, id: string, props: neptuneClusterParamProps) {
    super(scope, id, {
      description: props.description,
      parameters: {
        neptune_enable_audit_log: props.enable_audit_log,
      },
    });
  }
}
export interface neptuneClusterProps {
  name: string;
  vpc: ec2.Vpc;
  query_timeout: string;
  enable_audit_log: string;
  subnets: ec2.SubnetSelection;
  associatedRoles: iam.IRole[];
}
export class NeptuneCluster extends neptune_alpha.DatabaseCluster {
  constructor(scope: Construct, id: string, props: neptuneClusterProps) {
    super(scope, id, {
      dbClusterName: props.name,
      vpc: props.vpc,
      vpcSubnets: props.subnets,
      instanceType: neptune_alpha.InstanceType.R5_LARGE,
      clusterParameterGroup: new NeptuneClusterParams(scope, "ClusterParams", {
        description: `${props.name}Cluster ParamsGroup`,
        enable_audit_log: props.enable_audit_log,
      }),
      parameterGroup: new NeptuneParamGroup(scope, "DbParamGroup", {
        description: `${props.name} Graph Database ParamsGroup`,
        neptune_query_timeout: props.query_timeout,
      }),
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
