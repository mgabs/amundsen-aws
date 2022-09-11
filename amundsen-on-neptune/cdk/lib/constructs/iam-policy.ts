import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export interface IamPolicyProps {
  region: string;
  account: string;
}

export class IamPolicyStatement extends iam.PolicyStatement {
  constructor(scope: Construct, id: string, props: IamPolicyProps) {
    super({
      resources: [`arn:aws:es:${props.region}:${props.account}:domain/*`],
      actions: ["es:*"],
      effect: iam.Effect.ALLOW,
      principals: [new iam.AnyPrincipal()],
    });
  }
}
