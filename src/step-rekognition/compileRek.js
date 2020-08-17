const AWS = require("aws-sdk");
const s3 = new AWS.S3();
const rekognition = new AWS.Rekognition({
  region: "ap-southeast-2",
});

const jsonResultS3Bucket = process.env.jsonResultS3Bucket;

/**
 * Get the rekognition job result by unique jobid
 * @function main
 * @param  {object} event
 */
exports.handler = async (event, callback) => {
  console.log("[INFO] Started getRek");
  console.log(event);
  let id = event.Input.id;
  let rekJobId = event.Input.rekJobId;
  let fileName = event.Input.fileToPut;

  // Rekognition Data
  let rekResult = false;
  let rekData = [];
  let loopIndex = 0;

  let rekParams = {
    JobId: rekJobId,
    // JobId: id,
    MaxResults: 1000,
  };

  // Fetch all data with paginations
  do {
    loopIndex++;
    console.log("loop index : " + loopIndex);

    if (rekResult.NextToken) {
      rekParams = {
        JobId: rekJobId,
        // JobId: id,
        MaxResults: 1000,
        NextToken: rekResult.NextToken,
      };
    }
    try {
      rekResult = await getRekResults(rekParams);
      console.log(rekResult);
    } catch (err) {
      return err;
    }
    rekData = rekData.concat(rekResult.Faces);
  } while (rekResult.NextToken);

  let s3Result = false;
  let s3Params = {
    Bucket: jsonResultS3Bucket,
    Key: fileName,
    Body: JSON.stringify(rekData),
  };

  try {
    s3Result = await putS3File(s3Params);
  } catch (err) {
    return err;
  }
  console.log("s3 Result");
  console.log(s3Result);
  console.log(`Completed in ${loopIndex} rounds`);
  console.log(`Find ${rekData.length} item in total`);
  return s3Result;
};

function getRekResults(rekParams) {
  return rekognition.getFaceDetection(rekParams).promise();
}

function putS3File(s3Params) {
  return s3.putObject(s3Params).promise();
}
