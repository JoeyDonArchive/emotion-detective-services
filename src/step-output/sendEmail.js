global.fetch = require("node-fetch");
const AWS = require("aws-sdk");
const mutations = require("../graphql/mutations");
const gql = require("graphql-tag");
const Instance = require("../graphql/instance");

const ses = new AWS.SES({ region: "ap-southeast-2" });

const jobsResultS3BucketName = process.env.jobsResultS3Bucket;

/**
 * Send the result email
 * @function main
 * @param  {Object} event The payload from stepfunction
 */
exports.handler = async (event, context, callback) => {
  console.log(JSON.stringify(event));
  let resultsFromCsv = event.Input;
  let launchJobId = event.Input[0].launchJobId;
  let sendTo = event.Input[0].email;

  // Update job status to finished
  await updateJobStatus(launchJobId);

  // Generate email body
  let emailHTML = generateHTMLBody(resultsFromCsv);

  // SES SDK params
  var params = {
    Destination: {
      ToAddresses: [sendTo],
    },
    Message: {
      Body: {
        Html: { Data: emailHTML },
      },

      Subject: { Data: "Emotion Detective - Job finished" },
    },
    Source: "kpmg.tech.test@gmail.com",
  };

  // Send email
  await ses.sendEmail(params).promise();
};

const generateHTMLBody = (resultsFromCsv) => {
  let HTMLBody = "";

  resultsFromCsv.forEach((element) => {
    let fileName = element.fileToPut; // 'b070498d-2cd9-461c-9b96-88d9130dafbc-rek.json'
    let videoName = element.videoName; // Fina-5mins
    let indexJobType = fileName
      .split(".")[0] // b070498d-2cd9-461c-9b96-88d9130dafbc-rek
      .lastIndexOf("-");

    let videoId = fileName.split(".")[0].slice(0, indexJobType); // b070498d-2cd9-461c-9b96-88d9130dafbc
    console.log("Vid: " + videoId);
    let Job = fileName.slice(
      fileName.lastIndexOf("-") + 1,
      fileName.indexOf(".")
    ); // 'Tr or Rek'
    console.log("Job: " + Job);

    HTMLBody += `
    <tr>
      <td>${videoName}</td>
      <td>${
        Job == "rek"
          ? "Facial Analysis"
          : Job == "tr"
          ? "Transcript"
          : "You just find a bug, please inform Joey."
      }</td>
      <td>https://${jobsResultS3BucketName}.s3-ap-southeast-2.amazonaws.com/${videoId}-${
      Job == "rek"
        ? "FacialAnalysis.csv"
        : Job == "tr"
        ? "Transcript.csv"
        : "Unknown"
    }</td>
    </tr>`;
  });

  let HTML = `
    <html>
      <style>
        ${styles()}
      </style>

      <body>
        <table>
        <tr>
          <th>Video Name</th>
          <th>Type</th>
          <th>Link</th>
        </tr>
          ${HTMLBody}
        </table>
      </body>
      
    </html>
  `;

  return HTML;
};

const styles = () => {
  return `
    table {
      border-collapse: collapse;
    }
    th {
      background: #ccc;
    }
    
    th, td {
      border: 1px solid #ccc;
      padding: 8px;
    }
    
    tr:nth-child(even) {
      background: #efefef;
    }
  
  `;
};

const updateJobStatus = (launchJobId) => {
  return new Promise(async (resolve, reject) => {
    try {
      const client = await Instance.instanciateAppSync();

      let uptParam = {
        updateJobsRecord: {
          id: launchJobId,
          isFinished: true,
        },
      };

      let putJobGQL = await client.mutate({
        mutation: gql(mutations.updateJobsRecord),
        variables: uptParam,
        fetchPolicy: "no-cache",
      });
      console.log(putJobGQL);

      resolve();
    } catch (err) {
      reject(err);
    }
  });
};
