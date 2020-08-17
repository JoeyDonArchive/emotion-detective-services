import { App, Stack, StackProps } from "@aws-cdk/core";
import {
  Role,
  ServicePrincipal,
  PolicyStatement,
  PolicyDocument,
} from "@aws-cdk/aws-iam";
import { Duration } from "@aws-cdk/core";
import { Function, Code, Runtime, LayerVersion } from "@aws-cdk/aws-lambda";
import { Bucket } from "@aws-cdk/aws-s3";
import { S3EventSource } from "@aws-cdk/aws-lambda-event-sources";
import s3 = require("@aws-cdk/aws-s3");

export interface CustomStackProps extends StackProps {
  prefix: String;
  layer: LayerVersion;
}

export default class extends Stack {
  readonly rawS3Bucket: Bucket;
  readonly formattedS3Bucket: Bucket;
  readonly jsonResultS3Bucket: Bucket;
  readonly jobsResultS3Bucket: Bucket;

  constructor(scope: App, id: string, props: CustomStackProps) {
    super(scope, id, props);

    /**
     * Raw video bucket
     */
    this.rawS3Bucket = new Bucket(this, `raw-video`, {
      bucketName: `${props.prefix}-raw-video`,
      versioned: true,
      publicReadAccess: true,
    });

    // /**
    //  * Formatted video bucket
    //  */
    this.formattedS3Bucket = new Bucket(this, "formatted-video", {
      bucketName: `${props.prefix}-formatted-video`,
      versioned: true,
      publicReadAccess: true,
    });

    // /**
    //  * Json results bucket (for both Transcribe and Rekognition)
    //  */
    this.jsonResultS3Bucket = new Bucket(this, "json-result", {
      bucketName: `${props.prefix}-json-result`,
      versioned: true,
      publicReadAccess: true,
    });

    // /**
    //  * Output CSV bucket (for both Transcribe and Rekognition)
    //  */
    this.jobsResultS3Bucket = new Bucket(this, "jobs-result", {
      bucketName: `${props.prefix}-jobs-result`,
      versioned: true,
      publicReadAccess: true,
    });

    const tokenReadyS3Role = new Role(this, "token-ready-s3", {
      roleName: `${props.prefix}-token-ready`,
      assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
      inlinePolicies: {
        inline: new PolicyDocument({
          statements: [
            new PolicyStatement({
              resources: ["*"],
              actions: [
                "logs:CreateLogStream",
                "logs:DescribeLogStreams",
                "logs:CreateLogGroup",
                "logs:PutLogEvents",
                "states:SendTaskSuccess",
                "secretsmanager:GetSecretValue",
              ],
            }),
          ],
        }),
      },
    });

    // Lambda method
    const tokenReadyS3Handler = new Function(this, "token-ready-s3-handler", {
      functionName: `${props.prefix}-token-ready-s3`,
      runtime: Runtime.NODEJS_12_X,
      code: Code.asset(`src`),
      handler: "step-transcribe/tokenReadyS3.handler",
      environment: {
        jsonResultS3Bucket: this.jsonResultS3Bucket.bucketName,
      },
      role: tokenReadyS3Role,
      timeout: Duration.seconds(15),
      layers: [props.layer],
    });

    tokenReadyS3Handler.addEventSource(
      new S3EventSource(this.jsonResultS3Bucket, {
        events: [s3.EventType.OBJECT_CREATED_PUT],
      })
    );
  }
}
