const UnitTests = require("./helpers/unitTests");
const API = require("./helpers/apiClass");

module.exports = {
  UnitTests,
  API,
};

// USAGE EXAMPLE:
// const Api = new API(<API ENDPOINT URL>, <PYTHAGORA API KEY>, "pythagora");
// const unitTests = new UnitTests(
//     {
//         pathToProcess: <FILE OR FOLDER PATH TO PROCESS>
//         pythagoraRoot: <PYTHAGORA ROOT PATH>,
//     },
//     Api,
//     {}
// );
// unitTests.runProcessing();
