#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { AmundsenStack } from "../lib/amundsen-stack";
import process = require("process");

const app = new cdk.App();
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};
new AmundsenStack(app, "AmundsenStack", {
  env,
});
