# Emotion-detective-Services

This is a prototype.

## AWS Console Credentials

Provided via emails/calls.

## High Level Architecture

![Design](https://raw.github.com/JoeyDonArchive/emotion-detective-services/master/designs/architect.jpg)

## Project setup

#### 1. Install all dependecies

```
npm install
```

#### 2. Configure the profile for AWS CDK CLI

Create an programatic access role in the AWS account that I provided.
Place the profile with template below in `.aws/config`

```
[profile emotiondetective]
aws_default_region=ap-southeast-2
region=ap-southeast-2
aws_access_key_id=REPLACE_WITH_YOURS
aws_secret_access_key=REPLACE_WITH_YOURS
```

#### 3. Deploy stacks

See `package.json` of the pre-defined scripts. e.g.

```
npm run deploy:staging:site-resources
```

## ⚠ There are 3 manual actions involved to deploy.

95% the deployments are done by AWS CDK, which means a little manual configuration is needed if you want to deploy the whole stack in **a new or your own AWS account**.

- Cloud Trail: Add a trail for both raw/formatted S3 bucket. So Eventbridge will pick up the events.
- Transcode Pipeline: You will need to create a default one.
- Pay attention to AppSync API Key expiration. By default it's 7 days.

## The Brief

I spent roughly 14 hours in the Back-end to extract and rebuild the system.

- UI Layout: Following the best User Experiences practice.
- Tech Stack: Node.js / Typescript
- Extra Libraries: Aws-amplify / Aws-appsync / GraphQL
- Framework: AWS CDK
