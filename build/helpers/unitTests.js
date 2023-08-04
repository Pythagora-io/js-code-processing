"use strict";

function _classPrivateMethodInitSpec(obj, privateSet) { _checkPrivateRedeclaration(obj, privateSet); privateSet.add(obj); }
function _classPrivateFieldInitSpec(obj, privateMap, value) { _checkPrivateRedeclaration(obj, privateMap); privateMap.set(obj, value); }
function _checkPrivateRedeclaration(obj, privateCollection) { if (privateCollection.has(obj)) { throw new TypeError("Cannot initialize the same private elements twice on an object"); } }
function _classPrivateMethodGet(receiver, privateSet, fn) { if (!privateSet.has(receiver)) { throw new TypeError("attempted to get private field on non-instance"); } return fn; }
function _classPrivateFieldGet(receiver, privateMap) { var descriptor = _classExtractFieldDescriptor(receiver, privateMap, "get"); return _classApplyDescriptorGet(receiver, descriptor); }
function _classApplyDescriptorGet(receiver, descriptor) { if (descriptor.get) { return descriptor.get.call(receiver); } return descriptor.value; }
function _classPrivateFieldSet(receiver, privateMap, value) { var descriptor = _classExtractFieldDescriptor(receiver, privateMap, "set"); _classApplyDescriptorSet(receiver, descriptor, value); return value; }
function _classExtractFieldDescriptor(receiver, privateMap, action) { if (!privateMap.has(receiver)) { throw new TypeError("attempted to " + action + " private field on non-instance"); } return privateMap.get(receiver); }
function _classApplyDescriptorSet(receiver, descriptor, value) { if (descriptor.set) { descriptor.set.call(receiver, value); } else { if (!descriptor.writable) { throw new TypeError("attempted to set read only private field"); } descriptor.value = value; } }
const fs = require("fs");
const path = require("path");
const _ = require("lodash");
const {
  checkDirectoryExists
} = require("../utils/common");
const {
  stripUnrelatedFunctions,
  replaceRequirePaths,
  getAstFromFilePath,
  processAst
} = require("../utils/code");
const {
  getRelativePath,
  getTestFolderPath,
  checkPathType
} = require("../utils/files");
const {
  green,
  red,
  bold,
  reset
} = require("../const/colors");
const UnitTestsCommon = require("./unitTestsCommon");
var _API = /*#__PURE__*/new WeakMap();
var _opts = /*#__PURE__*/new WeakMap();
var _createTests = /*#__PURE__*/new WeakSet();
var _reformatDataForPythagoraAPI = /*#__PURE__*/new WeakSet();
var _saveTests = /*#__PURE__*/new WeakSet();
var _traverseDirectoryUnit = /*#__PURE__*/new WeakSet();
class UnitTests extends UnitTestsCommon {
  constructor(mainArgs, API, opts = {}) {
    super(mainArgs);
    _classPrivateMethodInitSpec(this, _traverseDirectoryUnit);
    _classPrivateMethodInitSpec(this, _saveTests);
    _classPrivateMethodInitSpec(this, _reformatDataForPythagoraAPI);
    _classPrivateMethodInitSpec(this, _createTests);
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
    await this.traverseAllDirectories();
    await _classPrivateMethodGet(this, _traverseDirectoryUnit, _traverseDirectoryUnit2).call(this, this.queriedPath, this.funcName);
    return {
      errors: this.errors,
      skippedFiles: this.skippedFiles,
      testsGenerated: this.testsGenerated
    };
  }
}
async function _createTests2(filePath, funcToTest) {
  try {
    const extension = path.extname(filePath);
    const ast = await getAstFromFilePath(filePath);
    const foundFunctions = [];
    processAst(ast, (funcName, path, type) => {
      if (type === "exportFn" || type === "exportObj") return;
      if (funcToTest && funcName !== funcToTest) return;
      const functionFromTheList = this.functionList[filePath + ":" + funcName];
      if (functionFromTheList && functionFromTheList.exported) {
        // TODO refactor since this is being set in code.js and here it's reverted
        if (functionFromTheList.classParent) {
          funcName = funcName.replace(functionFromTheList.classParent + ".", "");
        }
        foundFunctions.push({
          functionName: funcName,
          functionCode: functionFromTheList.code,
          relatedCode: functionFromTheList.relatedFunctions,
          classParent: functionFromTheList.classParent,
          isES6Syntax: functionFromTheList.syntaxType === "ES6",
          exportedAsObject: functionFromTheList.exportedAsObject
        });
      }
    });
    const uniqueFoundFunctions = foundFunctions.filter((item, index, self) => index === self.findIndex(t => t.functionName === item.functionName && t.functionCode === item.functionCode));
    this.sortFolderTree(this.folderStructureTree);
    const fileIndex = this.folderStructureTree.findIndex(item => item.absolutePath === filePath);
    for (const [i, funcData] of uniqueFoundFunctions.entries()) {
      const indexToPush = fileIndex + 1 + i;
      const prefix = this.folderStructureTree[fileIndex].line.split(path.basename(this.folderStructureTree[fileIndex].absolutePath))[0];
      this.folderStructureTree.splice(indexToPush, 0, {
        line: " ".repeat(prefix.length) + "└───" + funcData.functionName,
        absolutePath: filePath + ":" + funcData.functionName
      });
      if (_classPrivateFieldGet(this, _opts).spinner) {
        _classPrivateFieldGet(this, _opts).spinner.start(this.folderStructureTree, indexToPush);
      }
      const testFilePath = path.join(getTestFolderPath(filePath, this.rootPath), `/${funcData.functionName}.test${extension}`);
      if (fs.existsSync(testFilePath) && !this.force) {
        this.skippedFiles.push(testFilePath);
        if (_classPrivateFieldGet(this, _opts).spinner) {
          await _classPrivateFieldGet(this, _opts).spinner.stop();
        }
        this.folderStructureTree[indexToPush].line = `${green}${this.folderStructureTree[indexToPush].line}${reset}`;
        continue;
      }
      const formattedData = await _classPrivateMethodGet(this, _reformatDataForPythagoraAPI, _reformatDataForPythagoraAPI2).call(this, funcData, filePath, getTestFolderPath(filePath, this.rootPath));
      const {
        tests,
        error
      } = await _classPrivateFieldGet(this, _API).getUnitTests(formattedData, content => {
        if (_classPrivateFieldGet(this, _opts).scrollableContent) {
          _classPrivateFieldGet(this, _opts).scrollableContent.setContent(content);
          _classPrivateFieldGet(this, _opts).scrollableContent.setScrollPerc(100);
        }
        if (_classPrivateFieldGet(this, _opts).screen) _classPrivateFieldGet(this, _opts).screen.render();
      });
      if (tests) {
        const testGenerated = {
          functionName: formattedData.functionName,
          testCode: tests
        };
        if (_classPrivateFieldGet(this, _opts).isSaveTests) {
          const testPath = await _classPrivateMethodGet(this, _saveTests, _saveTests2).call(this, filePath, funcData.functionName, tests);
          testGenerated.testPath = testPath;
        }
        this.testsGenerated.push(testGenerated);
        if (_classPrivateFieldGet(this, _opts).spinner) {
          await _classPrivateFieldGet(this, _opts).spinner.stop();
        }
        this.folderStructureTree[indexToPush].line = `${green}${this.folderStructureTree[indexToPush].line}${reset}`;
      } else if (error) {
        this.errors.push({
          file: filePath,
          function: funcData.functionName,
          error: {
            stack: error.stack,
            message: error.message
          }
        });
        if (_classPrivateFieldGet(this, _opts).spinner) {
          await this.spinner.stop();
        }
        this.folderStructureTree[indexToPush].line = `${red}${this.folderStructureTree[indexToPush].line}${reset}`;
      }
    }
    if (uniqueFoundFunctions.length > 0) {
      this.folderStructureTree[fileIndex].line = `${green + bold}${this.folderStructureTree[fileIndex].line}${reset}`;
    }
  } catch (e) {
    if (!UnitTestsCommon.ignoreErrors.includes(e.code)) this.errors.push(e.stack);
  }
}
async function _reformatDataForPythagoraAPI2(funcData, filePath, testFilePath) {
  let relatedCode = _.groupBy(funcData.relatedCode, "fileName");
  // TODO add check if there are more functionNames than 1 while exportedAsObject is true - this shouldn't happen ever
  relatedCode = _.map(relatedCode, (value, key) => {
    return {
      fileName: key,
      functionNames: value.map(item => item.funcName),
      exportedAsObject: value[0].exportedAsObject,
      syntaxType: value[0].syntaxType
    };
  });
  let relatedCodeInSameFile = [funcData.functionName];
  funcData.relatedCode = [];
  for (const file of relatedCode) {
    if (file.fileName === filePath) {
      relatedCodeInSameFile = relatedCodeInSameFile.concat(file.functionNames);
    } else {
      const fileName = getRelativePath(file.fileName, path.dirname(filePath));
      let code = await stripUnrelatedFunctions(file.fileName, file.functionNames);
      const fullPath = filePath.substring(0, filePath.lastIndexOf("/")) + "/" + fileName;
      code = replaceRequirePaths(code, filePath, getTestFolderPath(filePath, this.rootPath));
      funcData.relatedCode.push({
        fileName,
        code,
        functionNames: file.functionNames,
        exportedAsObject: file.exportedAsObject,
        syntaxType: file.syntaxType,
        pathRelativeToTest: getRelativePath(fullPath, testFilePath)
      });
    }
  }
  funcData.functionCode = await stripUnrelatedFunctions(filePath, relatedCodeInSameFile);
  funcData.functionCode = replaceRequirePaths(funcData.functionCode, path.dirname(filePath), getTestFolderPath(filePath, this.rootPath));
  funcData.pathRelativeToTest = getRelativePath(filePath, testFilePath);
  return funcData;
}
async function _saveTests2(filePath, name, testData) {
  const dir = getTestFolderPath(filePath, this.rootPath);
  const extension = path.extname(filePath);
  if (!(await checkDirectoryExists(dir))) {
    fs.mkdirSync(dir, {
      recursive: true
    });
  }
  const testPath = path.join(dir, `/${name}.test${extension}`);
  fs.writeFileSync(testPath, testData);
  return testPath;
}
async function _traverseDirectoryUnit2(file, funcName) {
  if (this.processedFiles.includes(file)) {
    return;
  }
  this.processedFiles.push(file);
  if ((await checkPathType(file)) === "file") {
    if (!UnitTestsCommon.processExtensions.includes(path.extname(file))) {
      throw new Error("File extension is not supported");
    }
    return await _classPrivateMethodGet(this, _createTests, _createTests2).call(this, file, funcName);
  }
  const absolutePath = path.resolve(file);
  const stat = fs.statSync(absolutePath);
  if (!stat.isDirectory() && this.isFileToIgnore(file)) return;
  if (stat.isDirectory()) {
    if (UnitTestsCommon.ignoreFolders.includes(path.basename(absolutePath)) || path.basename(absolutePath).charAt(0) === ".") {
      return;
    }
    const directoryFiles = fs.readdirSync(absolutePath).filter(f => {
      const absoluteFilePath = path.join(absolutePath, f);
      const fileStat = fs.statSync(absoluteFilePath);
      if (fileStat.isDirectory()) {
        const baseName = path.basename(absoluteFilePath);
        return !UnitTestsCommon.ignoreFolders.includes(baseName) && !baseName.startsWith(".");
      } else {
        const ext = path.extname(f);
        return UnitTestsCommon.processExtensions.includes(ext) && !this.isFileToIgnore(f);
      }
    }).map(f => path.join(absolutePath, f));
    this.filesToProcess.push(...directoryFiles);
  } else {
    if (!UnitTestsCommon.processExtensions.includes(path.extname(absolutePath))) return;
    await _classPrivateMethodGet(this, _createTests, _createTests2).call(this, absolutePath, funcName);
  }
  while (this.filesToProcess.length > 0) {
    const nextFile = this.filesToProcess.shift();
    if (this.processedFiles.includes(nextFile)) {
      continue; // Skip processing if it has already been processed
    }

    await _classPrivateMethodGet(this, _traverseDirectoryUnit, _traverseDirectoryUnit2).call(this, nextFile, funcName);
  }
}
module.exports = UnitTests;