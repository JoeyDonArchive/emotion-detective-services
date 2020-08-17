global.fetch = require("node-fetch");
const mutations = require("../graphql/mutations");
const gql = require("graphql-tag");
const Instance = require("../graphql/instance");

/**
 * Start the stepfunction map
 * @function main
 * @param  {object} event
 */
exports.handler = async (event, context, callback) => {
  // TODO implement
  console.log(JSON.stringify(event));

  const client = await Instance.instanciateAppSync();

  let putParam = {
    createJobsRecord: {
      created_at: Date.now().toString(),
      isFinished: false,
    },
  };

  console.log(putParam);

  let putJobGQL = await client.mutate({
    mutation: gql(mutations.createJobsRecord),
    variables: putParam,
    fetchPolicy: "no-cache",
  });
  console.log(putJobGQL);

  let launchJobId = putJobGQL.data.createJobsRecord.id;

  callback(null, putJobGQL.data.createJobsRecord.id);
};
