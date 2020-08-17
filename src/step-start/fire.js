const AWS = require("aws-sdk");

const stateMachineArn = process.env.stateMachineArn;
const stepfunctions = new AWS.StepFunctions();

/**
 * Fire the stepfunction process from Post request through APIGateway
 * @function main
 * @param  {object} event
 */
exports.handler = async (event, context, callback) => {
  // TODO implement
  console.log(JSON.stringify(event));
  let input = event.body;
  console.log(input);
  console.log(stateMachineArn);
  console.log(event.httpMethod);

  if (event.httpMethod == "POST") {
    let params = {
      stateMachineArn: stateMachineArn,
      input: input,
    };

    stepfunctions.startExecution(params, function (err, data) {
      if (err) {
        console.log(err);
      }
      // an error occurred
      else {
        console.log("Stepfunction is launched");
      } // successful response
    });
    const response = {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*", // Required for CORS support to work
        "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
      },
      body: JSON.stringify({
        responseMessage: "Stepfunction is launched",
      }),
    };
    callback(null, response);
  } else {
    const response = {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Origin": "*", // Required for CORS support to work
        "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
      },
      body: JSON.stringify({
        message: "Please use post",
      }),
    };
    callback(null, response);
  }
};
