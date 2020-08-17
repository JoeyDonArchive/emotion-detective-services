/* eslint-disable */
// this is an auto generated file. This will be overwritten
module.exports = {
  createVideo: `mutation createVideo($createVideo: CreateVideo!) {
    createVideo(input: $createVideo) {
      id
      name
      isVideoReady
      created_at
    }
  }
`,
  createJob: `mutation createJob($createJob: CreateJob!) {
      createJob(input: $createJob) {
        id
        videoName
        rekJobId
        trJobId
        email
        launchJobId
        waitToken
      }
    }
  `,
  updateVideo: `mutation updateVideo($updateVideo: UpdateVideo!) {
    updateVideo(input: $updateVideo) {
      id
      name
      isVideoReady
      updated_at
      created_at
    }
  }
`,
  deleteJob: `mutation deleteJob($deleteJob: DeleteJob!) {
    deleteJob(input: $deleteJob) {
      id
    }
  }`,
  createJobsRecord: `mutation createJobsRecord($createJobsRecord: CreateJobsRecord!) {
    createJobsRecord(input: $createJobsRecord) {
      id
      isFinished
       created_at
    }
  }
`,
  updateJobsRecord: `mutation updateJobsRecord($updateJobsRecord: UpdateJobsRecord!) {
    updateJobsRecord(input: $updateJobsRecord) {
      id
    }
  }`
};
