global.fetch = require("node-fetch");
const AWS = require("aws-sdk");

const transcoder = new AWS.ElasticTranscoder({
  apiVersion: "2012-09-25",
  region: "ap-southeast-2",
});
const Instance = require("../graphql/instance");
const mutations = require("../graphql/mutations");
const gql = require("graphql-tag");

/**
 * Convert the video to '.mp4' from raw-video bucket to formatted-video bucket
 * @function main
 * @param  {Object} event The payload from eventbridge with transcoderRule
 */

exports.main = async (event, context) => {
  let rawFilename = event.detail.resources[0].ARN.split("/")[1]; // bird.avi
  let formattedFileName = rawFilename.split(".")[0]; //bird

  const client = await Instance.instanciateAppSync();

  let putParam = {
    createVideo: {
      name: formattedFileName,
      isVideoReady: false,
      created_at: Date.now().toString(),
    },
  };

  let putJobGQL = await client.mutate({
    mutation: gql(mutations.createVideo),
    variables: putParam,
    fetchPolicy: "no-cache",
  });
  console.log(putJobGQL);

  let params = {
    Ascending: "true",
  };

  // Get Transcode Pipeline
  const transcoderPinelines = await transcoder.listPipelines(params).promise();

  let jobParams = {
    PipelineId: transcoderPinelines.Pipelines[0].Id,
    Input: {
      Key: rawFilename.replace(/\+/g, " "),
    },
    Outputs: [
      {
        Key: putJobGQL.data.createVideo.id + ".mp4",
        PresetId: "1351620000001-000030", // Audio MP4 - 128K
      },
    ],
  };

  // Launch the transcoding job
  let result = await transcoder.createJob(jobParams).promise();

  console.log(result);
};
