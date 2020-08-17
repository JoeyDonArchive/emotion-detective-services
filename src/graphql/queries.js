/* eslint-disable */
// this is an auto generated file. This will be overwritten
module.exports = {
  getOneVideo: `query getOneVideo($videoName: String!) {
    getOneVideo(videoName: $videoName) {
      id
      name
    }
  }`,
  getMyJob: `query getMyJob($id: String!) {
    getMyJob(id: $id) {
      id
      waitToken
    }
  }`,
  getMyJobByTR: `query getMyJobByTR($trJobId: String!) {
    getMyJobByTR(trJobId: $trJobId) {
      id
      videoName
      email
      launchJobId
    	trJobId
      rekJobId
      waitToken
    }
  }`,
  getMyJobByREK: `query getMyJobByREK($rekJobId: String!) {
    getMyJobByREK(rekJobId: $rekJobId) {
      id
      videoName
      email
      launchJobId
    	trJobId
      rekJobId
      waitToken
    }
  }`,
};
