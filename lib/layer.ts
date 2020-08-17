// ./lib/rds-stack.ts
import { App, Stack, StackProps } from "@aws-cdk/core";
import { Code, Runtime, LayerVersion } from "@aws-cdk/aws-lambda";

export interface CustomStackProps extends StackProps {}

export default class extends Stack {
  readonly layer: LayerVersion;

  constructor(scope: App, id: string, props: CustomStackProps) {
    super(scope, id, props);

    this.layer = new LayerVersion(this, "MyLayer", {
      code: Code.fromAsset("layers/nodejs.zip"),
      compatibleRuntimes: [Runtime.NODEJS_12_X],
      description: "A layer for Lambda Nodejs libraries",
    });
  }
}
