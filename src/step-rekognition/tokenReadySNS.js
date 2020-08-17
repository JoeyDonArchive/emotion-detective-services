global.fetch = require("node-fetch");
const AWS = require("aws-sdk");
const Instance = require("../graphql/instance");
const queries = require("../graphql/queries");
const gql = require("graphql-tag");

const stepfunctions = new AWS.StepFunctions({
  region: "ap-southeast-2",
});

/**
 * When the finsh token is available - retrieve the result
 * @function main
 * @param  {object} event
 */
exports.handler = async (event, callback) => {
  // TODO implement
  console.log(JSON.stringify(event));

  let snsMessage = event.Records[0].Sns.Message.replace("\\", "");
  let snsMessageJson = JSON.parse(snsMessage);
  let id = snsMessageJson.JobId;
  let rawFileName = snsMessageJson.Video.S3ObjectName;
  let formattedFileName = rawFileName.split(".")[0] + "-rek.json"; //bird-rek.json

  const client = await Instance.instanciateAppSync();

  let getJobGQLParam = {
    rekJobId: id,
  };

  console.log(getJobGQLParam);

  let getJobGQL = await client.query({
    query: gql(queries.getMyJobByREK),
    variables: getJobGQLParam,
    fetchPolicy: "network-only",
  });

  console.log(getJobGQL);
  console.log("Wait token is : " + getJobGQL.data.getMyJobByREK.waitToken);

  var taskParams = {
    output: `{ "id": "${getJobGQL.data.getMyJobByREK.id}",
    "rekJobId": "${getJobGQL.data.getMyJobByREK.rekJobId}", 
    "videoName": "${getJobGQL.data.getMyJobByREK.videoName}",
    "email": "${getJobGQL.data.getMyJobByREK.email}",
    "launchJobId": "${getJobGQL.data.getMyJobByREK.launchJobId}",
    "fileToPut": "${formattedFileName}" }`,
    taskToken: getJobGQL.data.getMyJobByREK.waitToken,
  };

  const result = await stepfunctions.sendTaskSuccess(taskParams).promise();

  return JSON.stringify(result);
};
