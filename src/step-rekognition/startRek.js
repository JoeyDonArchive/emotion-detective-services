global.fetch = require("node-fetch");
const AWS = require("aws-sdk");
const Instance = require("../graphql/instance");
const mutations = require("../graphql/mutations");
const gql = require("graphql-tag");
const rekognition = new AWS.Rekognition({
  region: "ap-southeast-2",
});

const topicArn = process.env.topicArn;
const pushToSNSRoleArn = process.env.pushToSNSRoleArn;
const formattedBucketName = process.env.formattedBucketName;

/**
 * Launch Facial Recognition Job
 * @function main
 * @param  {Object} event The payload from stepfunction
 */
exports.handler = async (event) => {
  console.log(JSON.stringify(event));
  let videoId = event.Input.videoId;
  let videoName = event.Input.videoName;
  let email = event.Input.email;
  let launchJobId = event.Input.launchJobId;
  let formattedVideoName = videoId + ".mp4";

  let rekParams = {
    FaceAttributes: "ALL",
    JobTag: "DetectingEmotions",
    NotificationChannel: {
      RoleArn: pushToSNSRoleArn,
      SNSTopicArn: topicArn,
    },
    Video: {
      S3Object: {
        Bucket: formattedBucketName,
        Name: formattedVideoName,
      },
    },
  };

  let rekResult = false;

  rekResult = await rekognition.startFaceDetection(rekParams).promise();

  console.log(rekResult);

  const client = await Instance.instanciateAppSync();

  let putParam = {
    createJob: {
      waitToken: event.token,
      rekJobId: rekResult.JobId,
      videoName: videoName,
      email: email,
      launchJobId: launchJobId,
    },
  };
  console.log(putParam);

  let putJobGQL = await client.mutate({
    mutation: gql(mutations.createJob),
    variables: putParam,
    fetchPolicy: "no-cache",
  });
  console.log(putJobGQL);

  return rekResult;
};
