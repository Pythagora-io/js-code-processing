"use strict";

function _classPrivateMethodInitSpec(obj, privateSet) { _checkPrivateRedeclaration(obj, privateSet); privateSet.add(obj); }
function _classPrivateFieldInitSpec(obj, privateMap, value) { _checkPrivateRedeclaration(obj, privateMap); privateMap.set(obj, value); }
function _checkPrivateRedeclaration(obj, privateCollection) { if (privateCollection.has(obj)) { throw new TypeError("Cannot initialize the same private elements twice on an object"); } }
function _classStaticPrivateFieldSpecGet(receiver, classConstructor, descriptor) { _classCheckPrivateStaticAccess(receiver, classConstructor); _classCheckPrivateStaticFieldDescriptor(descriptor, "get"); return _classApplyDescriptorGet(receiver, descriptor); }
function _classCheckPrivateStaticFieldDescriptor(descriptor, action) { if (descriptor === undefined) { throw new TypeError("attempted to " + action + " private static field before its declaration"); } }
function _classStaticPrivateMethodGet(receiver, classConstructor, method) { _classCheckPrivateStaticAccess(receiver, classConstructor); return method; }
function _classCheckPrivateStaticAccess(receiver, classConstructor) { if (receiver !== classConstructor) { throw new TypeError("Private static access of wrong provenance"); } }
function _classPrivateFieldGet(receiver, privateMap) { var descriptor = _classExtractFieldDescriptor(receiver, privateMap, "get"); return _classApplyDescriptorGet(receiver, descriptor); }
function _classApplyDescriptorGet(receiver, descriptor) { if (descriptor.get) { return descriptor.get.call(receiver); } return descriptor.value; }
function _classPrivateMethodGet(receiver, privateSet, fn) { if (!privateSet.has(receiver)) { throw new TypeError("attempted to get private field on non-instance"); } return fn; }
function _classPrivateFieldSet(receiver, privateMap, value) { var descriptor = _classExtractFieldDescriptor(receiver, privateMap, "set"); _classApplyDescriptorSet(receiver, descriptor, value); return value; }
function _classExtractFieldDescriptor(receiver, privateMap, action) { if (!privateMap.has(receiver)) { throw new TypeError("attempted to " + action + " private field on non-instance"); } return privateMap.get(receiver); }
function _classApplyDescriptorSet(receiver, descriptor, value) { if (descriptor.set) { descriptor.set.call(receiver, value); } else { if (!descriptor.writable) { throw new TypeError("attempted to set read only private field"); } descriptor.value = value; } }
const fs = require("fs");
const path = require("path");
const _ = require("lodash");
const {
  PYTHAGORA_UNIT_DIR
} = require("../const/common");
const {
  checkDirectoryExists
} = require("../utils/common");
const {
  replaceRequirePaths,
  getAstFromFilePath,
  getRelatedTestImports,
  getSourceCodeFromAst,
  getModuleTypeFromFilePath
} = require("../utils/code");
const {
  getRelativePath,
  getTestFolderPath,
  checkPathType
} = require("../utils/files");
const {
  green,
  red,
  reset
} = require("../const/colors");
const UnitTestsCommon = require("./unitTestsCommon");
var _API = /*#__PURE__*/new WeakMap();
var _opts = /*#__PURE__*/new WeakMap();
var _saveTests = /*#__PURE__*/new WeakSet();
var _reformatDataForPythagoraAPI = /*#__PURE__*/new WeakSet();
var _createAdditionalTests = /*#__PURE__*/new WeakSet();
var _traverseDirectoryUnitExpanded = /*#__PURE__*/new WeakSet();
class UnitTestsExpand extends UnitTestsCommon {
  constructor(mainArgs, API, opts = {}) {
    super(mainArgs);
    _classPrivateMethodInitSpec(this, _traverseDirectoryUnitExpanded);
    _classPrivateMethodInitSpec(this, _createAdditionalTests);
    _classPrivateMethodInitSpec(this, _reformatDataForPythagoraAPI);
    _classPrivateMethodInitSpec(this, _saveTests);
    _classPrivateFieldInitSpec(this, _API, {
      writable: true,
      value: void 0
    });
    _classPrivateFieldInitSpec(this, _opts, {
      writable: true,
      value: void 0
    });
    _classPrivateFieldSet(this, _API, API);
    _classPrivateFieldSet(this, _opts, {
      ...opts
    });
  }
  async runProcessing() {
    await this.traverseAllDirectories(fileName => !_classStaticPrivateFieldSpecGet(UnitTestsExpand, UnitTestsExpand, _filesEndingWith).some(ending => fileName.endsWith(ending)));
    await _classPrivateMethodGet(this, _traverseDirectoryUnitExpanded, _traverseDirectoryUnitExpanded2).call(this, this.queriedPath, this.funcName);
    return {
      errors: this.errors,
      skippedFiles: this.skippedFiles,
      testsGenerated: this.testsGenerated
    };
  }
}
function _checkForTestFilePath(filePath) {
  const pattern = /test\.(js|ts|tsx)$/;
  return pattern.test(filePath);
}
async function _saveTests2(filePath, fileName, testData) {
  const dir = filePath.substring(0, filePath.lastIndexOf("/"));
  if (!(await checkDirectoryExists(dir))) {
    fs.mkdirSync(dir, {
      recursive: true
    });
  }
  const testPath = path.join(dir, `/${fileName}`);
  fs.writeFileSync(testPath, testData);
  return testPath;
}
function _reformatDataForPythagoraAPI2(filePath, testCode, relatedCode, syntaxType) {
  const importedFiles = [];
  _.forEach(relatedCode, f => {
    const testPath = path.join(path.resolve(PYTHAGORA_UNIT_DIR), filePath.replace(this.rootPath, ""));
    const pathRelativeToTest = getRelativePath(f.filePath, testPath.substring(0, testPath.lastIndexOf("/")));
    f.pathRelativeToTest = pathRelativeToTest;
    if (!importedFiles.find(i => i.filePath === f.filePath)) {
      importedFiles.push({
        fileName: f.fileName.substring(f.fileName.lastIndexOf("/") + 1),
        filePath: f.filePath,
        pathRelativeToTest: f.pathRelativeToTest,
        syntaxType: f.syntaxType
      });
    }
    if (f.relatedFunctions.length) {
      f.relatedFunctions = _.map(f.relatedFunctions, f => ({
        ...f,
        fileName: f.fileName.substring(f.fileName.lastIndexOf("/") + 1)
      }));
      f.relatedFunctions.forEach(f => importedFiles.push({
        ...f,
        pathRelativeToTest: getRelativePath(f.filePath, testPath.substring(0, testPath.lastIndexOf("/")))
      }));
    }
  });
  const testFilePath = getTestFolderPath(filePath, this.rootPath);
  const pathRelativeToTest = getRelativePath(filePath, testFilePath);
  return {
    testFileName: filePath.substring(filePath.lastIndexOf("/") + 1),
    testCode,
    relatedCode,
    importedFiles,
    isES6Syntax: syntaxType === "ES6",
    pathRelativeToTest,
    filePath
  };
}
async function _createAdditionalTests2(filePath) {
  try {
    const ast = await getAstFromFilePath(filePath);
    const syntaxType = await getModuleTypeFromFilePath(ast);
    const testPath = path.join(this.rootPath + PYTHAGORA_UNIT_DIR, filePath.replace(this.rootPath, ""));
    let testCode = getSourceCodeFromAst(ast);
    testCode = replaceRequirePaths(testCode, path.dirname(filePath), testPath.substring(0, testPath.lastIndexOf("/")));
    const relatedTestCode = getRelatedTestImports(ast, filePath, this.functionList);
    const formattedData = _classPrivateMethodGet(this, _reformatDataForPythagoraAPI, _reformatDataForPythagoraAPI2).call(this, filePath, testCode, relatedTestCode, syntaxType);
    const fileIndex = this.folderStructureTree.findIndex(item => item.absolutePath === filePath);
    if (_classPrivateFieldGet(this, _opts).spinner) {
      _classPrivateFieldGet(this, _opts).spinner.start(this.folderStructureTree, fileIndex);
    }
    if (fs.existsSync(testPath) && !this.force) {
      this.skippedFiles.push(testPath);
      if (_classPrivateFieldGet(this, _opts).spinner) {
        await _classPrivateFieldGet(this, _opts).spinner.stop();
      }
      this.folderStructureTree[fileIndex].line = `${green}${this.folderStructureTree[fileIndex].line}${reset}`;
      return;
    }
    const {
      tests,
      error
    } = await _classPrivateFieldGet(this, _API).expandUnitTests(formattedData, content => {
      if (_classPrivateFieldGet(this, _opts).scrollableContent) {
        _classPrivateFieldGet(this, _opts).scrollableContent.setContent(content);
        _classPrivateFieldGet(this, _opts).scrollableContent.setScrollPerc(100);
      }
      if (_classPrivateFieldGet(this, _opts).screen) {
        _classPrivateFieldGet(this, _opts).screen.render();
      }
    });
    if (tests) {
      const testGenerated = {
        testName: formattedData.testFileName,
        testCode: tests,
        testPath
      };
      if (_classPrivateFieldGet(this, _opts).isSaveTests) {
        await _classPrivateMethodGet(this, _saveTests, _saveTests2).call(this, testPath, formattedData.testFileName, tests);
      }
      this.testsGenerated.push(testGenerated);
      if (_classPrivateFieldGet(this, _opts).spinner) {
        await _classPrivateFieldGet(this, _opts).spinner.stop();
      }
      this.folderStructureTree[fileIndex].line = `${green}${this.folderStructureTree[fileIndex].line}${reset}`;
    } else if (error) {
      this.errors.push({
        file: filePath,
        error: {
          stack: error.stack,
          message: error.message
        }
      });
      if (_classPrivateFieldGet(this, _opts).spinner) {
        await _classPrivateFieldGet(this, _opts).spinner.stop();
      }
      this.folderStructureTree[fileIndex].line = `${red}${this.folderStructureTree[fileIndex].line}${reset}`;
    }
  } catch (e) {
    if (!UnitTestsCommon.ignoreErrors.includes(e.code)) this.errors.push(e);
  }
}
async function _traverseDirectoryUnitExpanded2(directory, prefix = "") {
  if ((await checkPathType(directory)) === "file" && _classStaticPrivateMethodGet(UnitTestsExpand, UnitTestsExpand, _checkForTestFilePath).call(UnitTestsExpand, directory)) {
    const newPrefix = `|   ${prefix}|   `;
    await _classPrivateMethodGet(this, _createAdditionalTests, _createAdditionalTests2).call(this, directory, newPrefix);
    return;
  } else if ((await checkPathType(directory)) === "file" && !_classStaticPrivateMethodGet(UnitTestsExpand, UnitTestsExpand, _checkForTestFilePath).call(UnitTestsExpand, directory)) {
    throw new Error("Invalid test file path");
  }
  const files = fs.readdirSync(directory);
  for (const file of files) {
    const absolutePath = path.join(directory, file);
    const stat = fs.statSync(absolutePath);
    if (stat.isDirectory()) {
      if (UnitTestsCommon.ignoreFolders.includes(path.basename(absolutePath)) || path.basename(absolutePath).charAt(0) === ".") continue;
      await _classPrivateMethodGet(this, _traverseDirectoryUnitExpanded, _traverseDirectoryUnitExpanded2).call(this, absolutePath, prefix);
    } else {
      if (!UnitTestsCommon.processExtensions.includes(path.extname(absolutePath)) || !_classStaticPrivateMethodGet(UnitTestsExpand, UnitTestsExpand, _checkForTestFilePath).call(UnitTestsExpand, file)) continue;
      await _classPrivateMethodGet(this, _createAdditionalTests, _createAdditionalTests2).call(this, absolutePath, prefix);
    }
  }
}
var _filesEndingWith = {
  writable: true,
  value: [".js", ".ts", ".tsx"]
};
module.exports = UnitTestsExpand;