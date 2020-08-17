// ./lib/rds-stack.ts
import {
  Role,
  ServicePrincipal,
  PolicyStatement,
  PolicyDocument,
} from "@aws-cdk/aws-iam";
import { App, Stack, StackProps, Duration, Arn } from "@aws-cdk/core";
import { Function, Code, Runtime, LayerVersion } from "@aws-cdk/aws-lambda";
import {
  Pass,
  StateMachine,
  Map,
  Choice,
  Condition,
  Task,
  ServiceIntegrationPattern,
  Context,
  DISCARD,
} from "@aws-cdk/aws-stepfunctions";
import { Bucket } from "@aws-cdk/aws-s3";
import { Topic } from "@aws-cdk/aws-sns";

import tasks = require("@aws-cdk/aws-stepfunctions-tasks");

export interface StepfunctionStackProps extends StackProps {
  rawS3Bucket: Bucket;
  formattedS3Bucket: Bucket;
  jsonResultS3Bucket: Bucket;
  jobsResultS3Bucket: Bucket;
  prefix: String;
  layer: LayerVersion;
}

export default class extends Stack {
  readonly stateMachineArn: Arn;

  constructor(scope: App, id: string, props: StepfunctionStackProps) {
    super(scope, id, props);

    const formattedS3Bucket = props.formattedS3Bucket;
    const jsonResultS3Bucket = props.jsonResultS3Bucket;
    const jobsResultS3Bucket = props.jobsResultS3Bucket;
    const lambdaDuration = 10;
    /**
     * Create SNS(Simple Notification Service) topic for rekognition
     */
    const rekTopic = new Topic(this, "rek-topic", {
      displayName: "Notifications of Rekognition Job Completion",
      topicName: `${props.prefix}-rek-topic`,
    });

    const RecordJobRole = new Role(this, `${props.prefix}-RecordJobRole`, {
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
                "lambda:InvokeFunction",
                "lambda:InvokeAsync",
                "secretsmanager:GetSecretValue",
              ],
            }),
          ],
        }),
      },
    });

    const RecordJobHandler = new Function(
      this,
      `${props.prefix}-RecordJobHandler`,
      {
        functionName: `${props.prefix}-record-job`,
        runtime: Runtime.NODEJS_12_X,
        code: Code.asset(`src`),
        handler: "step-start/start.handler",
        environment: {
          formattedBucketName: formattedS3Bucket.bucketName,
        },
        role: RecordJobRole,
        timeout: Duration.seconds(lambdaDuration),
        layers: [props.layer],
      }
    );

    const FormatDataRole = new Role(this, `${props.prefix}-FormatDataRole`, {
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
                "lambda:InvokeFunction",
                "lambda:InvokeAsync",
              ],
            }),
          ],
        }),
      },
    });

    const FormatDataHandler = new Function(
      this,
      `${props.prefix}-FormatDataHandler`,
      {
        functionName: `${props.prefix}-format-data`,
        runtime: Runtime.NODEJS_12_X,
        code: Code.asset(`src`),
        handler: "step-start/format.handler",
        role: FormatDataRole,
        timeout: Duration.seconds(lambdaDuration),
        layers: [props.layer],
      }
    );

    const RekPushSnsRole = new Role(this, `${props.prefix}-RekPushSnsRole`, {
      assumedBy: new ServicePrincipal("rekognition.amazonaws.com"),
      inlinePolicies: {
        inline: new PolicyDocument({
          statements: [
            new PolicyStatement({
              resources: ["*"],
              actions: ["sns:Publish"],
            }),
          ],
        }),
      },
    });

    const RekHandlerRole = new Role(this, `${props.prefix}-RekHandlerRole`, {
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
                "iam:PassRole",
                "sns:*",
                "rekognition:StartFaceDetection",
                "lambda:InvokeFunction",
                "lambda:InvokeAsync",
                "secretsmanager:GetSecretValue",
              ],
            }),
          ],
        }),
      },
    });

    const StepRekStartHandler = new Function(
      this,
      `${props.prefix}-StepRekStartHandler`,
      {
        functionName: `${props.prefix}-step-rek-start`,
        runtime: Runtime.NODEJS_12_X,
        code: Code.asset(`src`),
        handler: "step-rekognition/startRek.handler",
        environment: {
          formattedBucketName: formattedS3Bucket.bucketName,
          topicArn: rekTopic.topicArn.toString(),
          pushToSNSRoleArn: RekPushSnsRole.roleArn.toString(),
        },
        role: RekHandlerRole,
        timeout: Duration.seconds(lambdaDuration),
        layers: [props.layer],
      }
    );

    const tokenReadySNSRole = new Role(
      this,
      `${props.prefix}-tokenReadySNSRole`,
      {
        assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
        inlinePolicies: {
          inline: new PolicyDocument({
            statements: [
              new PolicyStatement({
                resources: [
                  jsonResultS3Bucket.bucketArn,
                  `${jsonResultS3Bucket.bucketArn}/*`,
                ],
                actions: ["s3:PutObject"],
              }),
              new PolicyStatement({
                resources: ["*"],
                actions: [
                  "logs:CreateLogStream",
                  "logs:DescribeLogStreams",
                  "logs:CreateLogGroup",
                  "logs:PutLogEvents",
                  "rekognition:GetFaceDetection",
                  "sns:*",
                  "states:SendTaskSuccess",
                  "secretsmanager:GetSecretValue",
                ],
              }),
            ],
          }),
        },
      }
    );

    const tokenReadySNSHandler = new Function(
      this,
      `${props.prefix}-tokenReadySNSHandler`,
      {
        functionName: `${props.prefix}-token-ready-sns`,
        runtime: Runtime.NODEJS_12_X,
        code: Code.asset(`src`),
        handler: "step-rekognition/tokenReadySNS.handler",
        environment: {
          jsonResultS3Bucket: jsonResultS3Bucket.bucketName,
        },
        role: tokenReadySNSRole,
        timeout: Duration.seconds(lambdaDuration),
        layers: [props.layer],
      }
    );

    const StepRekCompileHandlerRole = new Role(
      this,
      `${props.prefix}-StepRekCompileHandlerRole`,
      {
        assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
        inlinePolicies: {
          inline: new PolicyDocument({
            statements: [
              new PolicyStatement({
                resources: [
                  jsonResultS3Bucket.bucketArn,
                  `${jsonResultS3Bucket.bucketArn}/*`,
                ],
                actions: ["s3:PutObject"],
              }),
              new PolicyStatement({
                resources: ["*"],
                actions: [
                  "logs:CreateLogStream",
                  "logs:DescribeLogStreams",
                  "logs:CreateLogGroup",
                  "logs:PutLogEvents",
                  "rekognition:GetFaceDetection",
                  "sns:*",
                ],
              }),
            ],
          }),
        },
      }
    );

    const StepRekCompileHandler = new Function(
      this,
      `${props.prefix}-StepRekCompileHandler`,
      {
        functionName: `${props.prefix}-step-rek-compile`,
        runtime: Runtime.NODEJS_12_X,
        code: Code.asset(`src`),
        handler: "step-rekognition/compileRek.handler",
        environment: {
          jsonResultS3Bucket: jsonResultS3Bucket.bucketName,
        },
        role: StepRekCompileHandlerRole,
        timeout: Duration.seconds(lambdaDuration),
        memorySize: 1000,
        layers: [props.layer],
      }
    );

    const StepRekCleanerHandlerRole = new Role(
      this,
      `${props.prefix}-StepRekCleanerHandlerRole`,
      {
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
                  "secretsmanager:GetSecretValue",
                ],
              }),
            ],
          }),
        },
      }
    );

    const StepRekCleanerHandler = new Function(
      this,
      `${props.prefix}-StepRekCleanerHandler`,
      {
        functionName: `${props.prefix}-step-rek-cleaner`,
        runtime: Runtime.NODEJS_12_X,
        code: Code.asset(`src`),
        handler: "step-rekognition/cleanRek.handler",
        environment: {
          jsonResultS3Bucket: jsonResultS3Bucket.bucketName,
        },
        role: StepRekCleanerHandlerRole,
        timeout: Duration.seconds(lambdaDuration),
        layers: [props.layer],
      }
    );

    const StepTrStartHandlerRole = new Role(
      this,
      `${props.prefix}-StepTrStartHandlerRole`,
      {
        assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
        inlinePolicies: {
          inline: new PolicyDocument({
            statements: [
              new PolicyStatement({
                resources: [
                  jsonResultS3Bucket.bucketArn,
                  `${jsonResultS3Bucket.bucketArn}/*`,
                ],
                actions: ["s3:PutObject"],
              }),
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
                  "transcribe:StartTranscriptionJob",
                  "transcribe:ListTranscriptionJobs",
                  "transcribe:DeleteTranscriptionJob",
                  "lambda:InvokeFunction",
                  "lambda:InvokeAsync",
                  "secretsmanager:GetSecretValue",
                ],
              }),
            ],
          }),
        },
      }
    );

    const StepTrStartHandler = new Function(
      this,
      `${props.prefix}-StepTrStartHandler`,
      {
        functionName: `${props.prefix}-step-tr-start`,
        runtime: Runtime.NODEJS_12_X,
        code: Code.asset(`src`),
        handler: "step-transcribe/startTr.handler",
        environment: {
          jsonResultS3Bucket: jsonResultS3Bucket.bucketName,
          formattedBucketName: formattedS3Bucket.bucketName,
        },
        role: StepTrStartHandlerRole,
        timeout: Duration.seconds(lambdaDuration),
        layers: [props.layer],
      }
    );

    const StepTrCleanerHandlerRole = new Role(
      this,
      `${props.prefix}-StepTrCleanerHandlerRole`,
      {
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
                  "secretsmanager:GetSecretValue",
                ],
              }),
            ],
          }),
        },
      }
    );

    const StepTrCleanerHandler = new Function(
      this,
      `${props.prefix}-StepTrCleanerHandler`,
      {
        functionName: `${props.prefix}-step-tr-cleaner`,
        runtime: Runtime.NODEJS_12_X,
        code: Code.asset(`src`),
        handler: "step-transcribe/cleanTr.handler",
        environment: {
          jsonResultS3Bucket: jsonResultS3Bucket.bucketName,
        },
        role: StepTrCleanerHandlerRole,
        timeout: Duration.seconds(lambdaDuration),
        layers: [props.layer],
      }
    );

    const ExportHandlerRole = new Role(
      this,
      `${props.prefix}-ExportHandlerRole`,
      {
        assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
        inlinePolicies: {
          inline: new PolicyDocument({
            statements: [
              new PolicyStatement({
                resources: [
                  jsonResultS3Bucket.bucketArn,
                  `${jsonResultS3Bucket.bucketArn}/*`,
                ],
                actions: ["s3:GetObject"],
              }),
              new PolicyStatement({
                resources: [
                  jobsResultS3Bucket.bucketArn,
                  `${jobsResultS3Bucket.bucketArn}/*`,
                ],
                actions: ["s3:PutObject"],
              }),
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
      }
    );

    const ExportHandler = new Function(this, `${props.prefix}-ExportHandler`, {
      functionName: `${props.prefix}-export`,
      runtime: Runtime.NODEJS_12_X,
      code: Code.asset(`src`),
      handler: "step-output/exportCSV.handler",
      environment: {
        jsonResultS3Bucket: jsonResultS3Bucket.bucketName,
        jobsResultS3Bucket: jobsResultS3Bucket.bucketName,
      },
      role: ExportHandlerRole,
      timeout: Duration.seconds(lambdaDuration),
      memorySize: 1000,
      layers: [props.layer],
    });

    const EmailHandlerRole = new Role(
      this,
      `${props.prefix}-EmailHandlerRole`,
      {
        assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
        inlinePolicies: {
          inline: new PolicyDocument({
            statements: [
              new PolicyStatement({
                resources: [
                  jobsResultS3Bucket.bucketArn,
                  `${jobsResultS3Bucket.bucketArn}/*`,
                ],
                actions: ["s3:PutObject"],
              }),
              new PolicyStatement({
                resources: ["*"],
                actions: [
                  "logs:CreateLogStream",
                  "logs:DescribeLogStreams",
                  "logs:CreateLogGroup",
                  "logs:PutLogEvents",
                  "ses:SendEmail",
                  "ses:SendRawEmail",
                  "secretsmanager:GetSecretValue",
                ],
              }),
            ],
          }),
        },
      }
    );

    const EmailHandler = new Function(this, `${props.prefix}-EmailHandler`, {
      functionName: `${props.prefix}-email`,
      runtime: Runtime.NODEJS_12_X,
      code: Code.asset(`src`),
      handler: "step-output/sendEmail.handler",
      role: EmailHandlerRole,
      timeout: Duration.seconds(lambdaDuration),
      memorySize: 200,
      environment: {
        jobsResultS3Bucket: jobsResultS3Bucket.bucketName,
      },
      layers: [props.layer],
    });

    const StartJob = new Pass(this, "Start Job", {
      resultPath: "$",
    });

    const RecordJob = new Task(this, "Generate and Record Launch Job ID", {
      resultPath: "$.jobId",
      outputPath: "$",
      task: new tasks.RunLambdaTask(RecordJobHandler, {}),
    });

    const FormatData = new Task(this, "Format Tasks Array", {
      resultPath: "$",
      task: new tasks.RunLambdaTask(FormatDataHandler, {
        payload: {
          "Input.$": "$",
        },
      }),
    });

    const PassArray = new Pass(this, "Pass the array", {
      outputPath: "$.Payload",
    });

    // Rekognition Path
    const FacialAnalysStart = new Task(this, "Start Facial Analysis", {
      resultPath: "$",
      task: new tasks.RunLambdaTask(StepRekStartHandler, {
        integrationPattern: ServiceIntegrationPattern.WAIT_FOR_TASK_TOKEN,
        payload: {
          token: Context.taskToken,
          "Input.$": "$",
        },
      }),
    });

    const ReceivedRekToken = new Pass(this, "Received Rek complete token", {});

    const FacialAnalysCompile = new Task(this, "Compile Facial Analysis JSON", {
      resultPath: DISCARD,
      task: new tasks.RunLambdaTask(StepRekCompileHandler, {
        payload: {
          "Input.$": "$",
        },
      }),
    });

    const FacialAnalysRecycle = new Task(
      this,
      "Recycle Rek Cache in DynamoDB",
      {
        resultPath: DISCARD,
        task: new tasks.RunLambdaTask(StepRekCleanerHandler, {
          payload: {
            "Input.$": "$",
          },
        }),
      }
    );

    const TranscriptAnalysStart = new Task(this, "Start Transcript Analysis", {
      resultPath: "$",
      task: new tasks.RunLambdaTask(StepTrStartHandler, {
        integrationPattern: ServiceIntegrationPattern.WAIT_FOR_TASK_TOKEN,
        payload: { token: Context.taskToken, "Input.$": "$" },
      }),
    });

    const ReceivedTrToken = new Pass(this, "Received Tr complete token", {});
    const TranscriptRecycle = new Task(this, "Recycle Tr Cache in DynamoDB", {
      resultPath: DISCARD,
      task: new tasks.RunLambdaTask(StepTrCleanerHandler, {
        payload: {
          "Input.$": "$",
        },
      }),
    });

    const WhichJob = new Choice(this, "Which Job?")
      .when(
        Condition.stringEquals("$.type", "rekognition"),
        FacialAnalysStart.next(ReceivedRekToken)
          .next(FacialAnalysCompile)
          .next(FacialAnalysRecycle)
      )
      .when(
        Condition.stringEquals("$.type", "transcribe"),
        TranscriptAnalysStart.next(ReceivedTrToken).next(TranscriptRecycle)
      );

    const ExportCSV = new Task(this, "Export CSVs", {
      resultPath: DISCARD,
      task: new tasks.RunLambdaTask(ExportHandler, {
        payload: {
          "Input.$": "$",
        },
      }),
    });

    const SendEmail = new Task(this, "Send Notification Email", {
      task: new tasks.RunLambdaTask(EmailHandler, {
        payload: {
          "Input.$": "$",
        },
      }),
    });

    const MainParallelMap = new Map(this, "Main Parallel Map", {
      itemsPath: "$",
      maxConcurrency: 0,
    });

    const definition = RecordJob.next(FormatData)
      .next(PassArray)
      .next(MainParallelMap.iterator(WhichJob).next(ExportCSV).next(SendEmail));

    const stateMachine = new StateMachine(
      this,
      `${props.prefix}-state-machine`,
      {
        definition,
        stateMachineName: `${props.prefix}-state-machine`,
      }
    );

    this.stateMachineArn = stateMachine.stateMachineArn;
  }
}
