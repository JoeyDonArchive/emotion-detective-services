global.fetch = require("node-fetch");
const AWS = require("aws-sdk");

const AWSAppSyncClient = require("aws-appsync").default;
const { AUTH_TYPE } = require("aws-appsync");
const awsconfig = require("../aws-exports");

const secretsmanager = new AWS.SecretsManager({
  region: "ap-southeast-2",
});

module.exports.instanciateAppSync = async () => {
  return new Promise(async (resolve, reject) => {
    try {
      let SMParams = {
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

      resolve(client);
    } catch (e) {
      reject(e);
    }
  });
};
