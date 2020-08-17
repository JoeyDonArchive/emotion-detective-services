/**
 * Remap data structure passing into stepfunction
 * @function main
 * @param  {object} event
 */
exports.handler = async (event, context, callback) => {
  // TODO implement
  console.log(JSON.stringify(event));
  let launchJobId = event.Input.jobId.Payload;
  let email = event.Input.email;
  let tasks = event.Input.tasks;

  tasks.forEach((task) => {
    task.email = email;
    task.launchJobId = launchJobId;
  });

  console.log(tasks);
  callback(null, tasks);
};
