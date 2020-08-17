global.fetch = require("node-fetch");
const AWS = require("aws-sdk");
const stepfunctions = new AWS.StepFunctions({
  region: "ap-southeast-2",
});
const secretsmanager = new AWS.SecretsManager({
  region: "ap-southeast-2",
});

const queries = require("../graphql/queries");
const AWSAppSyncClient = require("aws-appsync").default;
const gql = require("graphql-tag");
const { AUTH_TYPE } = require("aws-appsync");
const awsconfig = require("../aws-exports");

/**
 * When the finsh token is available - retrieve the result
 * @function main
 * @param  {object} event
 */
exports.handler = async (event, callback) => {
  // TODO implement
  console.log(JSON.stringify(event));
  let S3ObjectName = false;
  let type = false;

  try {
    S3ObjectName = event.Records[0].s3.object.key; //101-tr.json

    // type = S3ObjectName.split("-")[1].split(".")[0];
    let array = S3ObjectName.split("-"); // a3ds-dxw3-tr.json
    let lastIndex = array.length - 1; // to get tr.json

    type = array[lastIndex].split(".")[0]; //tr.json => tr
    console.log(type);
  } catch (err) {
    console.log(err);
    return;
  }

  if (type == "tr") {
    console.log("Tr job detected");
    let id = S3ObjectName.split(".")[0].split("-")[0]; // 101-tr

    var SMParams = {
      SecretId: awsconfig.aws_appsync_secretId,
    };
    let secret = await secretsmanager.getSecretValue(SMParams).promise();

    const client = new AWSAppSyncClient({
      url: awsconfig.aws_appsync_graphqlEndpoint,
      region: awsconfig.aws_appsync_region,
      auth: {
        type: AUTH_TYPE.API_KEY, // or type: awsconfig.aws_appsync_authenticationType,
        apiKey: secret.SecretString,
      },
      disableOffline: true,
    });

    let getJobGQLParam = {
      trJobId: id, // Global index
    };

    console.log(getJobGQLParam);
    let getJobGQL = await client.query({
      query: gql(queries.getMyJobByTR),
      variables: getJobGQLParam,
      fetchPolicy: "network-only",
    });
    console.log(getJobGQL);

    var taskParams = {
      output: `{ "id": "${getJobGQL.data.getMyJobByTR.id}",
      "trJobId": "${getJobGQL.data.getMyJobByTR.trJobId}",
      "videoName": "${getJobGQL.data.getMyJobByTR.videoName}",
      "email": "${getJobGQL.data.getMyJobByTR.email}",
      "launchJobId": "${getJobGQL.data.getMyJobByTR.launchJobId}",
      "fileToPut": "${id}-tr.json"}` /* required */,
      taskToken: getJobGQL.data.getMyJobByTR.waitToken /* required */,
    };
    console.log(taskParams);

    const result = await stepfunctions.sendTaskSuccess(taskParams).promise();

    return JSON.stringify(result);
  } else {
    console.log("Its not a tr job, mate");
    return;
  }
};
