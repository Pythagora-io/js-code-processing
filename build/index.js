"use strict";

const UnitTestsCommon = require("./helpers/unitTestsCommon");
const UnitTests = require("./helpers/unitTests");
const UnitTestsExpand = require("./helpers/unitTestsExpand");
const API = require("./helpers/apiClass");
const codeUtils = require("./utils/code");
const filesUtils = require("./utils/files");
const commonUtils = require("./utils/common");
const colors = require("./const/colors");
const common = require("./const/common");
module.exports = {
  codeUtils,
  filesUtils,
  commonUtils,
  colors,
  common,
  UnitTestsCommon,
  UnitTests,
  UnitTestsExpand,
  API
};

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