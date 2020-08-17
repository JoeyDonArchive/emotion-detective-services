#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "@aws-cdk/core";
import siteResourcesStack from "../lib/site-resources";
import videoStorageStack from "../lib/video-storage";
import stepfunctionsStack from "../lib/stepfunction";
import eventbridgeStack from "../lib/eventbridge";
import apiStack from "../lib/api";
import lambdaLayer from "../lib/layer";

const app = new cdk.App();
const appName = "emotion-detective";
const prefix = `${app.node.tryGetContext("stage")}-${appName}`;

const lambdaLayerEntity = new lambdaLayer(app, `${prefix}-layer`, {});

const videoStorageStackEntity = new videoStorageStack(
  app,
  `${prefix}-video-storage`,
  {
    prefix: prefix,
    layer: lambdaLayerEntity.layer,
  }
);

const siteResourcesStackEntity = new siteResourcesStack(
  app,
  `${prefix}-site-resources`,
  {
    prefix: prefix,
  }
);

const stepfunctionStackEntity = new stepfunctionsStack(
  app,
  `${prefix}-stepfunction`,
  {
    prefix: prefix,
    rawS3Bucket: videoStorageStackEntity.rawS3Bucket,
    formattedS3Bucket: videoStorageStackEntity.formattedS3Bucket,
    jsonResultS3Bucket: videoStorageStackEntity.jsonResultS3Bucket,
    jobsResultS3Bucket: videoStorageStackEntity.jobsResultS3Bucket,
    layer: lambdaLayerEntity.layer,
  }
);

const apiStackEntity = new apiStack(app, `${prefix}-api`, {
  prefix: prefix,
  stateMachineArn: stepfunctionStackEntity.stateMachineArn,
});

const eventbridgeStackEntity = new eventbridgeStack(
  app,
  `${prefix}-eventbridge`,
  {
    prefix: prefix,
    rawS3Bucket: videoStorageStackEntity.rawS3Bucket,
    formattedS3Bucket: videoStorageStackEntity.formattedS3Bucket,
    jsonResultS3Bucket: videoStorageStackEntity.jsonResultS3Bucket,
  }
);
