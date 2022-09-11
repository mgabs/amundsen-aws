import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

export class AmundsenVpc extends ec2.Vpc {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, {
      cidr: "10.192.0.0/16",
      maxAzs: 2,
      // natGateways: 0,
      enableDnsHostnames: true,
      enableDnsSupport: true,
      vpcName: "AmundsenVPC",
      /**
       * Each entry in this list configures a Subnet Group
       *
       * ISOLATED: Isolated Subnets do not route traffic to the Internet (in this VPC).
       * PRIVATE.: Subnet that routes to the internet, but not vice versa.
       * PUBLIC..: Subnet connected to the Internet.
       */
      subnetConfiguration: [
        {
          subnetType: ec2.SubnetType.PRIVATE_WITH_NAT,
          name: "Private",
          cidrMask: 24,
        },
        {
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          name: "Isolated",
          cidrMask: 24,
        },
        {
          subnetType: ec2.SubnetType.PUBLIC,
          name: "Public",
          cidrMask: 24,
        },
      ],
    });
  }
}
