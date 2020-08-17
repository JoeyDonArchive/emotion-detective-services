import * as cdk from "@aws-cdk/core";
import s3 = require("@aws-cdk/aws-s3");
import cloudfront = require("@aws-cdk/aws-cloudfront");
import cognito = require("@aws-cdk/aws-cognito");
import iam = require("@aws-cdk/aws-iam");

interface ResourcesProps extends cdk.StackProps {
  prefix: string;
}

export default class extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: ResourcesProps) {
    super(scope, id, props);

    // S3 for static web build
    const s3Bucket = new s3.CfnBucket(this, "S3Bucket", {
      bucketName: `${props.prefix}-web-host`,
      websiteConfiguration: {
        indexDocument: "index.html",
        errorDocument: "index.html",
      },
    });

    // OAI allow Cloudfront to access S3
    const cloudFrontOriginAccessIdentity = new cloudfront.CfnCloudFrontOriginAccessIdentity(
      this,
      "CloudFrontOriginAccessIdentity",
      {
        cloudFrontOriginAccessIdentityConfig: {
          comment: `${props.prefix}-origin-access-identity`,
        },
      }
    );

    // S3 policy explicitly allow OAI
    const s3BucketPolicy = new s3.CfnBucketPolicy(this, "S3BucketPolicy", {
      bucket: `${props.prefix}-web-host`,
      policyDocument: {
        Statement: [
          {
            Effect: "Allow",
            Principal: {
              AWS: `arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity ${cloudFrontOriginAccessIdentity.ref}`,
            },
            Action: ["s3:GetObject", "s3:ListBucket"],
            Resource: [`${s3Bucket.attrArn}/*`, s3Bucket.attrArn],
          },
        ],
      },
    });
    s3BucketPolicy.addDependsOn(s3Bucket);
    s3BucketPolicy.addDependsOn(cloudFrontOriginAccessIdentity);

    // Cloudfront distribution
    const distributionProps = {
      distributionConfig: {
        enabled: true,
        origins: [
          {
            domainName: s3Bucket.attrDomainName,
            id: `${props.prefix}`,
            s3OriginConfig: {
              originAccessIdentity: `origin-access-identity/cloudfront/${cloudFrontOriginAccessIdentity.ref}`,
            },
          },
        ],
        customErrorResponses: [
          {
            errorCode: 404,
            responseCode: 200,
            responsePagePath: "/index.html",
          },
        ],
        defaultRootObject: "index.html",
        defaultCacheBehavior: {
          forwardedValues: {
            queryString: true,
          },
          targetOriginId: `${props.prefix}`,
          viewerProtocolPolicy: "redirect-to-https",
        },
      },
    };

    const cloudfrontDistribution = new cloudfront.CfnDistribution(
      this,
      "CloudfrontDistribution",
      distributionProps
    );
    cloudfrontDistribution.addDependsOn(s3Bucket);
    cloudfrontDistribution.addDependsOn(cloudFrontOriginAccessIdentity);
  }
}
