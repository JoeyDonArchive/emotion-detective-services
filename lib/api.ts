// ./lib/rds-stack.ts
import { App, Stack, StackProps, Arn } from "@aws-cdk/core";
import { RestApi, LambdaIntegration } from "@aws-cdk/aws-apigateway";
import { Function, Code, Runtime } from "@aws-cdk/aws-lambda";
import {
  Role,
  ServicePrincipal,
  PolicyStatement,
  PolicyDocument,
} from "@aws-cdk/aws-iam";

export interface CustomStackProps extends StackProps {
  stateMachineArn: Arn;
  prefix: String;
}

export default class extends Stack {
  constructor(scope: App, id: string, props: CustomStackProps) {
    super(scope, id, props);

    const stateMachineArn = props.stateMachineArn;

    const launchStepfunctionHandlerRole = new Role(
      this,
      "launchStepfunctionHandlerRole",
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
                  "states:StartExecution",
                ],
              }),
            ],
          }),
        },
      }
    );

    let launchStepfunctionHandler = new Function(
      this,
      "launch-stepfunction-handler",
      {
        functionName: `${props.prefix}-launch-stepfunction`,
        runtime: Runtime.NODEJS_12_X,
        code: Code.asset(`src`),
        handler: "step-start/fire.handler",
        role: launchStepfunctionHandlerRole,
        environment: {
          stateMachineArn: stateMachineArn.toString(),
        },
      }
    );

    const restApi = new RestApi(this, "RestApi", {
      restApiName: `stepfunction-api`,
      defaultCorsPreflightOptions: {
        allowOrigins: ["*"],
        allowHeaders: [
          "Content-Type",
          "X-Amz-Date",
          "Authorization",
          "X-Api-Key",
          "X-Amz-Security-Token",
          "X-Amz-User-Agent",
        ],
        allowMethods: ["OPTIONS", "POST"],
      },
      deployOptions: {
        stageName: "staging",
      },
    });

    restApi.root.addMethod(
      "POST",
      new LambdaIntegration(launchStepfunctionHandler)
    );
  }
}
