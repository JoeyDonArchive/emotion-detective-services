global.fetch = require("node-fetch");
const Instance = require("../graphql/instance");
const mutations = require("../graphql/mutations");
const gql = require("graphql-tag");

/**
 * Delete Job Id for this job as it's finished
 * @function main
 * @param  {object} event
 */
exports.handler = async (event) => {
  console.log(JSON.stringify(event));
  console.log(mutations);
  let id = event.Input.id;

  const client = await Instance.instanciateAppSync();

  let delParam = {
    deleteJob: {
      id: id,
    },
  };

  console.log(delParam);

  let delJobGQL = await client.mutate({
    mutation: gql(mutations.deleteJob),
    variables: delParam,
    fetchPolicy: "no-cache",
  });
  console.log(delJobGQL);

  return delJobGQL;
};
