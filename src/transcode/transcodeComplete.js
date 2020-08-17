global.fetch = require("node-fetch");

const AWS = require("aws-sdk");
const secretsmanager = new AWS.SecretsManager({
  region: "ap-southeast-2",
});

const mutations = require("../graphql/mutations");
const AWSAppSyncClient = require("aws-appsync").default;
const gql = require("graphql-tag");
const { AUTH_TYPE } = require("aws-appsync");
const awsconfig = require("../aws-exports");

/**
 * Convert the video to '.mp4' from raw-video bucket to formatted-video bucket
 * @function main
 * @param  {Object} event The payload from eventbridge with transcoderRule
 */
exports.main = async (event, context) => {
  let rawFilename = event.detail.resources[0].ARN.split("/")[1]; // bird.avi
  let videoId = rawFilename.split(".")[0]; //43sdsd2-dadmvn3-dsafas2   video id

  let SMParams = {
    SecretId: awsconfig.aws_appsync_secretId,
  };
  let secret = await secretsmanager.getSecretValue(SMParams).promise();

  const client = new AWSAppSyncClient({
    url: awsconfig.aws_appsync_graphqlEndpoint,
    region: awsconfig.aws_appsync_region,
    auth: {
      type: AUTH_TYPE.API_KEY,
      apiKey: secret.SecretString,
    },
    disableOffline: true,
  });

  let updateParam = {
    updateVideo: {
      id: videoId,
      isVideoReady: true,
    },
  };

  let updateJobGQL = await client.mutate({
    mutation: gql(mutations.updateVideo),
    variables: updateParam,
    fetchPolicy: "no-cache",
  });
  console.log(updateJobGQL);
};
