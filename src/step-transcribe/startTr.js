global.fetch = require("node-fetch");
const AWS = require("aws-sdk");
const mutations = require("../graphql/mutations");
const gql = require("graphql-tag");
const Instance = require("../graphql/instance");

const transcribe = new AWS.TranscribeService({
  region: "ap-southeast-2",
});
const formattedBucketName = process.env.formattedBucketName;
const jsonResultS3Bucket = process.env.jsonResultS3Bucket;

/**
 * Start the transcribe job to get the transcription of video
 * @function handler
 * @param  {object} event Triggered by Formatted Video s3:PutObject event
 */
exports.handler = async (event) => {
  console.log("[INFO] Started Transcribe jobs");
  console.log(JSON.stringify(event));
  console.log(formattedBucketName);
  let videoId = event.Input.videoId;
  let videoName = event.Input.videoName;
  let email = event.Input.email;
  let launchJobId = event.Input.launchJobId;

  let formattedVideoName = videoId + ".mp4"; // bird.mp4

  let rawFileUri = `https://${formattedBucketName}.s3-ap-southeast-2.amazonaws.com/${formattedVideoName}`;

  let jobId = generateRandomString();
  console.log("JobID is random: " + jobId);
  let resultJsonName = jobId + "-tr";

  // 2. Start Trascribe job
  // Params for startTranscriptionJob
  let trResult = false;
  var startParams = {
    LanguageCode: "en-AU" /* required */,
    Media: {
      /* required */
      MediaFileUri: rawFileUri,
    },
    TranscriptionJobName: resultJsonName /* bird-tr.json to new bucket */,
    MediaFormat: "mp4",
    OutputBucketName: jsonResultS3Bucket,
  };

  trResult = await transcribe.startTranscriptionJob(startParams).promise();
  console.log(trResult);

  const client = await Instance.instanciateAppSync();

  let putParam = {
    createJob: {
      waitToken: event.token,
      trJobId: jobId,
      videoName: videoName,
      email: email,
      launchJobId: launchJobId,
    },
  };
  console.log(putParam);

  let putJobGQL = await client.mutate({
    mutation: gql(mutations.createJob),
    variables: putParam,
    fetchPolicy: "no-cache",
  });
  console.log(putJobGQL);
};

const generateRandomString = () => {
  return Math.random().toString(36).substr(2, 8);
};
