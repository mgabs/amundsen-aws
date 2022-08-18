import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export class EsRoleConstruct extends Construct {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id);

    new iam.CfnServiceLinkedRole(this, "ESSLR", {
      awsServiceName: "es.amazonaws.com",
      description: "es service linked role",
    });
  }
}
