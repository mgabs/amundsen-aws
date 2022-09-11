import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export interface SLRProps extends cdk.StackProps {
  awsServiceName: string;
  description: string;
}

export class ServiceLinkedRole extends Construct {
  constructor(scope: Construct, id: string, props: SLRProps) {
    super(scope, id);

    new iam.CfnServiceLinkedRole(this, "ESSLR", {
      awsServiceName: props.awsServiceName,
      description: props.description,
    });
  }
}
