import * as neptune_alpha from "@aws-cdk/aws-neptune-alpha";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as neptune from "aws-cdk-lib/aws-neptune";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export interface AmundsenFargateProps {
  amundsenBasePort: number;
  amundsenMetadataPort: number;
  amundsenSearchPort: number;
  region: string;
  bucket: s3.Bucket;
  neptuneCluster: neptune_alpha.DatabaseCluster;
  logGroup: logs.LogGroup;
  openSearchDomainEndpoint: string;
}

export class AmundsenFargate extends Construct {
  public taskDefinition: ecs.FargateTaskDefinition;
  constructor(scope: Construct, id: string, props: AmundsenFargateProps) {
    super(scope, id);

    const taskDefinition = new ecs.FargateTaskDefinition(
      scope,
      "amundsen-task-def",
      {
        cpu: 1024,
        memoryLimitMiB: 4096,
      }
    );

    this.taskDefinition = taskDefinition;

    const cfnNeptune = props.neptuneCluster.node
      .defaultChild as neptune.CfnDBCluster;

    taskDefinition.addContainer("amundsenfrontend", {
      image: ecs.ContainerImage.fromRegistry(
        "amundsendev/amundsen-frontend:3.7.0"
      ),
      containerName: "frontend",
      memoryLimitMiB: 1024,
      portMappings: [
        {
          containerPort: props.amundsenBasePort,
        },
      ],
      environment: {
        LOG_LEVEL: "DEBUG",
        SEARCHSERVICE_BASE: `http://localhost:${props.amundsenSearchPort}`,
        METADATASERVICE_BASE: `http://localhost:${props.amundsenMetadataPort}`,
        FRONTEND_SVC_CONFIG_MODULE_CLASS:
          "amundsen_application.config.TestConfig",
      },
      logging: new ecs.AwsLogDriver({
        logGroup: props.logGroup,
        streamPrefix: "amundsenfrontend",
      }),
    });

    taskDefinition.addContainer("amundsen-search", {
      image: ecs.ContainerImage.fromRegistry(
        "amundsendev/amundsen-search:2.5.1"
      ),
      containerName: "search",
      memoryLimitMiB: 1024,
      portMappings: [
        {
          containerPort: props.amundsenSearchPort,
        },
      ],
      environment: {
        LOG_LEVEL: "DEBUG",
        PROXY_ENDPOINT: `https://${props.openSearchDomainEndpoint}`,
        PROXY_CLIENT: "ELASTICSEARCH",
        PORT: `${props.amundsenSearchPort}`,
        PROXY_PORT: "443",
        // these are required, else you'll have a bad day
        CREDENTIALS_PROXY_USER: "",
        CREDENTIALS_PROXY_PASSWORD: "",
      },
      logging: new ecs.AwsLogDriver({
        logGroup: props.logGroup,
        streamPrefix: "amundsensearch",
      }),
    });

    taskDefinition.addContainer("amundsen-metadata", {
      image: ecs.ContainerImage.fromRegistry(
        "amundsendev/amundsen-metadata:3.5.0"
      ),
      containerName: "metadata",
      memoryLimitMiB: 1024,
      portMappings: [
        {
          containerPort: props.amundsenMetadataPort,
        },
      ],
      environment: {
        LOG_LEVEL: "DEBUG",
        METADATA_SVC_CONFIG_MODULE_CLASS:
          "metadata_service.config.NeptuneConfig",
        AWS_REGION: props.region,
        S3_BUCKET_NAME: props.bucket.bucketName,
        IGNORE_NEPTUNE_SHARD: "True",
        PROXY_CLIENT: "NEPTUNE",
        PROXY_HOST: `wss://${props.neptuneCluster.clusterEndpoint.socketAddress}/gremlin`,
        PROXY_PORT: cfnNeptune.attrPort,
        PROXY_ENCRYPTED: "True",
        PROXY_VALIDATE_SSL: "False",
      },
      logging: new ecs.AwsLogDriver({
        logGroup: props.logGroup,
        streamPrefix: "amundsenmetadata",
      }),
    });
  }
}
