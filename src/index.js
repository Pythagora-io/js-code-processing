const UnitTests = require("./helpers/unitTests");
const API = require("./helpers/apiClass");
const codeHelper = require("./utils/code");
const filesHelper = require("./utils/files");
const commonHelper = require("./utils/common");
const colors = require("./const/colors");
const common = require("./const/common");

module.exports = {
  codeHelper,
  filesHelper,
  commonHelper,
  colors,
  common,
  UnitTests,
  API
}

// Usage example:
// const Api = new API(<API ENDPOINT URL>, <PYTHAGORA API KEY>, <API KEY TYPE>);
// const unitTests = new UnitTests(
//     {
//         pathToProcess: <FILE OR FOLDER PATH TO PROCESS>
//         pythagoraRoot: <PYTHAGORA ROOT PATH>,
//     },
//     Api,
//     {}
// );
// unitTests.runProcessing();
