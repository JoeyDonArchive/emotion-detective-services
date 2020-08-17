// ./lib/rds-stack.ts
import { App, Stack, StackProps, Arn, Duration } from "@aws-cdk/core";
import { Rule } from "@aws-cdk/aws-events";
import { Function, Code, Runtime, LayerVersion } from "@aws-cdk/aws-lambda";

import { LambdaFunction } from "@aws-cdk/aws-events-targets";
import { Bucket } from "@aws-cdk/aws-s3";
import {
  Role,
  ServicePrincipal,
  PolicyStatement,
  PolicyDocument,
} from "@aws-cdk/aws-iam";

export interface EventbridgeStackProps extends StackProps {
  rawS3Bucket: Bucket;
  formattedS3Bucket: Bucket;
  jsonResultS3Bucket: Bucket;
  prefix: String;
}

export default class extends Stack {
  constructor(scope: App, id: string, props: EventbridgeStackProps) {
    super(scope, id, props);

    const rawS3Bucket = props.rawS3Bucket;
    const formattedS3Bucket = props.formattedS3Bucket;

    const layer = new LayerVersion(this, "MyLayer", {
      code: Code.fromAsset("layers/nodejs.zip"),
      compatibleRuntimes: [Runtime.NODEJS_12_X],
      description: "A layer for Lambda Nodejs libraries",
    });

    /* #region GraphQL handler and it's role */
    const gqlHandlerRole = new Role(this, "gqlHandlerRole", {
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
              ],
            }),
          ],
        }),
      },
    });

    // Lambda method
    const gqlHandler = new Function(this, "gqlHandler", {
      functionName: `${props.prefix}-gql`,
      runtime: Runtime.NODEJS_12_X,
      code: Code.asset(`src`),
      handler: "graphql/handler.main",
      role: gqlHandlerRole,
      timeout: Duration.seconds(5),
      layers: [layer],
    });

    /* #endregion */

    /* #region transcodeHandler and it's role */
    const lambdaTranscoderRole = new Role(this, "lambdaTranscoderRole", {
      assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
      inlinePolicies: {
        inline: new PolicyDocument({
          statements: [
            new PolicyStatement({
              resources: [rawS3Bucket.bucketArn, `${rawS3Bucket.bucketArn}/*`],
              actions: ["s3:GetObject"],
            }),
            new PolicyStatement({
              resources: [
                formattedS3Bucket.bucketArn,
                `${formattedS3Bucket.bucketArn}/*`,
              ],
              actions: ["s3:PutObject"],
            }),
            new PolicyStatement({
              resources: ["*"],
              actions: [
                "elastictranscoder:ListPipelines",
                "elastictranscoder:CreatePipeline",
                "elastictranscoder:CreateJob",
                "elastictranscoder:ReadJob",
                "elastictranscoder:ReadPipeline",
                "lambda:InvokeFunction",
                "lambda:InvokeAsync",
                "logs:CreateLogStream",
                "logs:DescribeLogStreams",
                "logs:CreateLogGroup",
                "logs:PutLogEvents",
                "secretsmanager:GetSecretValue",
              ],
            }),
          ],
        }),
      },
    });

    // Lambda method
    const transcodeHandler = new Function(this, "transcodeHandler", {
      functionName: `${props.prefix}-transcode`,
      runtime: Runtime.NODEJS_12_X,
      code: Code.asset(`src`),
      handler: "transcode/transcode.main",
      environment: {
        formattedBucketName: formattedS3Bucket.bucketName,
        gqlHandlerName: gqlHandler.functionName,
      },
      role: lambdaTranscoderRole,
      timeout: Duration.seconds(5),
      layers: [layer],
    });

    /* #endregion */

    /* #region Add transcodeHandler to Eventbridge */
    const transcoderRulePattern = {
      source: ["aws.s3"],
      "detail-type": ["AWS API Call via CloudTrail"],
      detail: {
        eventSource: ["s3.amazonaws.com"],
        eventName: ["PutObject", "CompleteMultipartUpload"],
        requestParameters: {
          bucketName: [rawS3Bucket.bucketName],
        },
      },
    };

    const transcoderRule = new Rule(this, "transcoderRule", {
      description: "S3 raw buckets => lambda transcoder",
      ruleName: "s3LambdaTranscoder",
      eventPattern: transcoderRulePattern,
      targets: [new LambdaFunction(transcodeHandler)],
    });
    /* #endregion */

    /* #region transcodeCompleteHandler and it's role */

    const transcodeCompleteHandlerRole = new Role(
      this,
      "transcodeCompleteHandlerRole",
      {
        assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
        inlinePolicies: {
          inline: new PolicyDocument({
            statements: [
              new PolicyStatement({
                resources: [
                  formattedS3Bucket.bucketArn,
                  `${formattedS3Bucket.bucketArn}/*`,
                ],
                actions: ["s3:GetObject"],
              }),
              new PolicyStatement({
                resources: ["*"],
                actions: [
                  "logs:CreateLogStream",
                  "logs:DescribeLogStreams",
                  "logs:CreateLogGroup",
                  "logs:PutLogEvents",
                  "secretsmanager:GetSecretValue",
                ],
              }),
            ],
          }),
        },
      }
    );

    // Lambda method
    const transcodeCompleteHandler = new Function(
      this,
      "transcodeCompleteHandler",
      {
        functionName: `${props.prefix}-transcode-complete`,
        runtime: Runtime.NODEJS_12_X,
        code: Code.asset(`src`),
        handler: "transcode/transcodeComplete.main",
        role: transcodeCompleteHandlerRole,
        timeout: Duration.seconds(5),
        layers: [layer],
      }
    );

    /* #endregion */

    /* #region Add transcodeCompleteHandler to Eventbridge */

    const transcodeCompleteHandlerPattern = {
      source: ["aws.s3"],
      "detail-type": ["AWS API Call via CloudTrail"],
      detail: {
        eventSource: ["s3.amazonaws.com"],
        eventName: ["PutObject", "CompleteMultipartUpload"],
        requestParameters: {
          bucketName: [formattedS3Bucket.bucketName],
        },
      },
    };

    const transcodeCompleteRule = new Rule(this, "transcodeCompleteRule", {
      description: "S3 formatted buckets => Update Transcode Completed",
      ruleName: "s3LambdaRek",
      eventPattern: transcodeCompleteHandlerPattern,
      targets: [new LambdaFunction(transcodeCompleteHandler)],
    });
    /* #endregion */
  }
}
