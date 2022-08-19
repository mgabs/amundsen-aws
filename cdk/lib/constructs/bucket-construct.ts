import * as s3 from "aws-cdk-lib/aws-s3";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

export interface BucketProps {
  region: string;
  account: string;
}

export class Bucket extends s3.Bucket {
  constructor(scope: Construct, id: string, props: BucketProps) {
    super(scope, id, {
      bucketName: `amundsenexample-${props.region}-${props.account}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });
  }
}
