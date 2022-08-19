import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecsp from "aws-cdk-lib/aws-ecs-patterns";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Construct } from "constructs";

export interface FargateTaskDefinitionProps {
  cpu: number;
  memoryLimitMib: number;
}
export class FargateTaskDefinition extends ecs.FargateTaskDefinition {
  constructor(scope: Construct, id: string, props: FargateTaskDefinitionProps) {
    super(scope, id, {
      cpu: props.cpu,
      memoryLimitMiB: props.memoryLimitMib,
    });
  }
}

export class FargateContainer extends Construct {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id);
  }
}
