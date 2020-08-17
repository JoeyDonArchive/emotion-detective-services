const AWS = require("aws-sdk");
const s3 = new AWS.S3();

const jsonResultS3BuckekName = process.env.jsonResultS3Bucket;
const jobsResultS3BucketName = process.env.jobsResultS3Bucket;

/**
 * Wrangle data format into .csv from json
 * @function main
 * @param  {Object} event The payload from stepfunction
 */
exports.handler = async (event) => {
  // TODO implement
  console.log(event);
  let tasksArray = event.Input;
  let tasksCounts = event.Input.length;

  // Loop through every file in payload
  for (let x = 0; x < tasksCounts; x++) {
    let fileName = tasksArray[x].fileToPut; // 'b070498d-2cd9-461c-9b96-88d9130dafbc-rek.json'

    let indexJobType = fileName
      .split(".")[0] // b070498d-2cd9-461c-9b96-88d9130dafbc-rek
      .lastIndexOf("-");

    let videoID = fileName.split(".")[0].slice(0, indexJobType); // b070498d-2cd9-461c-9b96-88d9130dafbc
    let Job = fileName.slice(
      fileName.lastIndexOf("-") + 1,
      fileName.indexOf(".")
    );

    // Convert to Rekognition format if it's a Rekognition job
    if (Job == "rek") {
      let getParams = {
        Bucket: jsonResultS3BuckekName,
        Key: fileName,
      };
      console.log("params:" + JSON.stringify(getParams));
      const getResult = await s3.getObject(getParams).promise();

      console.log(JSON.stringify(getResult));
      const getResultJSON = JSON.parse(getResult.Body);
      const CSVString = RekConvertJsonToCSV(getResultJSON);

      let putParams = {
        Bucket: jobsResultS3BucketName,
        Key: `${videoID}-FacialAnalysis.csv`,
        Body: CSVString,
        ContentType: "application/octet-stream",
      };

      const putResult = await s3.putObject(putParams).promise();

      console.log(putResult);
    }

    // Convert to Transcription format if it's a Transcription job
    if (Job == "tr") {
      console.log("Tr file :" + fileName);
      let getParams = {
        Bucket: jsonResultS3BuckekName,
        Key: fileName,
      };

      const getResult = await s3.getObject(getParams).promise();

      const getResultJSON = JSON.parse(getResult.Body);
      const CSVString = TrConvertJsonToCSV(getResultJSON);

      let putParams = {
        Bucket: jobsResultS3BucketName,
        Key: `${videoID}-Transcript.csv`,
        Body: CSVString,
        ContentType: "application/octet-stream",
      };

      const putResult = await s3.putObject(putParams).promise();

      console.log(putResult);
    }
  }
};

// Customised converter to get the format we want.
const RekConvertJsonToCSV = (jsonInput) => {
  let array = typeof jsonInput != "object" ? JSON.parse(jsonInput) : jsonInput;

  let str = "";
  let emotionLength = 8;

  // Title (First row in CSV)
  str +=
    "Timestamp, Confused, Sad, Angry, Disgusted, Happy, Surprised, Fear, Calm, EyesOpen, MouthOpen \r\n";
  // Iterate whole array
  for (var i = 0; i < array.length; i++) {
    // Reset each new line (Row in csv)
    var line = "";

    // Flatten Object into each line
    for (var index in array[i]) {
      // Add Delimiter
      if (line != "") line += ",";

      // Iterate 8 emotions
      if (typeof array[i][index] == "object") {
        for (let j = 0; j < emotionLength; j++) {
          line += array[i][index].Emotions[j].Confidence;
          line += ",";
        }

        // Extra bit in same row - EyesOpen
        let EyesOpenConfidence =
          array[i][index].EyesOpen.Value == true
            ? array[i][index].EyesOpen.Confidence
            : 100 - array[i][index].EyesOpen.Confidence;
        line += EyesOpenConfidence;
        line += ",";

        // Extra bit in same row - MouthOpen
        let MouthOpenConfidence =
          array[i][index].MouthOpen.Value == true
            ? array[i][index].MouthOpen.Confidence
            : 100 - array[i][index].MouthOpen.Confidence;
        line += MouthOpenConfidence;
        line += ",";
      } else {
        line += array[i][index] / 1000;
      }
    }

    str += line + "\r\n";
  }

  return str;
};

// Customised converter to get the format we want.
const TrConvertJsonToCSV = (jsonInput) => {
  var array = jsonInput.results.items;

  let str = "";
  // Title (First row in CSV)
  str += "StartTime, FinishTime, Word, Confidence \r\n";

  // Iterate whole array
  for (var i = 0; i < array.length; i++) {
    if (array[i].hasOwnProperty("start_time")) {
      // Reset each new line (Row in csv)
      var line = "";
      // Flatten Object into each line
      for (var index in array[i]) {
        if (line != "") line += ",";

        if (Array.isArray(array[i][index])) {
          line += array[i][index][0].content;
          line += ",";
          line += array[i][index][0].confidence;
          line += ",";
        } else {
          if (array[i][index] != "pronunciation") line += array[i][index];
        }
      }

      str += line + "\r\n";
    }
  }

  let entireScript = jsonInput.results.transcripts[0].transcript;
  str += entireScript.replace(/,/g, "");

  return str;
};
