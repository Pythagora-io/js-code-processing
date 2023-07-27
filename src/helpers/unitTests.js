const fs = require("fs");
const path = require("path");
const _ = require("lodash");

const { checkDirectoryExists } = require("../utils/common");
const {
  stripUnrelatedFunctions,
  replaceRequirePaths,
  getAstFromFilePath,
  processAst,
} = require("../utils/code");
const {
  getRelativePath,
  getTestFolderPath,
  checkPathType,
} = require("../utils/files");
const { green, red, bold, reset } = require("../const/colors");

const UnitTestsCommon = require("./unitTestsCommon");

class UnitTests extends UnitTestsCommon {
  constructor({isSaveTests, screen, spinner, scrollableContent, API, ...mainData}) {
    super(mainData);

    this.isSaveTests = isSaveTests;
    this.screen = screen;
    this.spinner = spinner;
    this.scrollableContent = scrollableContent;

    // this.rootPath = pythagoraRoot;
    // this.queriedPath = path.resolve(pathToProcess);
    // this.funcName = funcName;
    // this.force = force;

    // this.filesToProcess = [];
    // this.processedFiles = [];

    // this.functionList = {};
    // this.this.folderStructureTree = [];

    // this.ignoreFolders = ["node_modules", "pythagora_tests", "__tests__"];
    // this.ignoreFilesEndingWith = [".test.js", ".test.ts", ".test.tsx"];
    // this.processExtensions = [".js", ".ts", ".tsx"];
    // this.ignoreErrors = ["BABEL_PARSER_SYNTAX_ERROR"];

    // this.isFileToIgnore = (fileName) => {
    //   return this.ignoreFilesEndingWith.some(ending => fileName.endsWith(ending))
    // }
  }

  async createTests(filePath, funcToTest) {
    try {
      let extension = path.extname(filePath);
      let ast = await getAstFromFilePath(filePath);

      const foundFunctions = [];

      processAst(ast, (funcName, path, type) => {
        if (type === "exportFn" || type === "exportObj") return;
        if (funcToTest && funcName !== funcToTest) return;

        let functionFromTheList = functionList[filePath + ":" + funcName];
        if (functionFromTheList && functionFromTheList.exported) {
          // TODO refactor since this is being set in code.js and here it's reverted
          if (functionFromTheList.classParent)
            funcName = funcName.replace(
              functionFromTheList.classParent + ".",
              ""
            );
          foundFunctions.push({
            functionName: funcName,
            functionCode: functionFromTheList.code,
            relatedCode: functionFromTheList.relatedFunctions,
            classParent: functionFromTheList.classParent,
            isES6Syntax: functionFromTheList.syntaxType === "ES6",
            exportedAsObject: functionFromTheList.exportedAsObject,
          });
        }
      });

      const uniqueFoundFunctions = foundFunctions.filter(
        (item, index, self) =>
          index ===
          self.findIndex(
            (t) =>
              t.functionName === item.functionName &&
              t.functionCode === item.functionCode
          )
      );

      sortFolderTree(this.folderStructureTree);

      const fileIndex = this.folderStructureTree.findIndex(
        (item) => item.absolutePath === filePath
      );
      for (const [i, funcData] of uniqueFoundFunctions.entries()) {
        let indexToPush = fileIndex + 1 + i;
        let prefix = this.folderStructureTree[fileIndex].line.split(
          path.basename(this.folderStructureTree[fileIndex].absolutePath)
        )[0];

        this.folderStructureTree.splice(indexToPush, 0, {
          line: " ".repeat(prefix.length) + "└───" + funcData.functionName,
          absolutePath: filePath + ":" + funcData.functionName,
        });

        if (this.spinner) this.spinner.start(this.folderStructureTree, indexToPush);

        let testFilePath = path.join(
          getTestFolderPath(filePath, rootPath),
          `/${funcData.functionName}.test${extension}`
        );

        if (fs.existsSync(testFilePath) && !force) {
          skippedFiles.push(testFilePath);

          if (this.spinner) {
            await this.spinner.stop();
          }

          this.folderStructureTree[
            indexToPush
          ].line = `${green}${this.folderStructureTree[indexToPush].line}${reset}`;
          continue;
        }

        let formattedData = await this.reformatDataForPythagoraAPI(
          funcData,
          filePath,
          getTestFolderPath(filePath, rootPath)
        );

        let { tests, error } = await API.getUnitTests(
          formattedData,
          (content) => {
            if (this.scrollableContent) {
              this.scrollableContent.setContent(content);
              this.scrollableContent.setScrollPerc(100);
            }
            
            if (this.screen) this.screen.render();
          }
        );

        if (tests) {
          if (this.isSaveTests) {
            let testPath = await this.saveTests(
              filePath,
              funcData.functionName,
              tests
            );
            this.testsGenerated.push(testPath);
          }

          if (this.spinner) {
            await this.spinner.stop();
          }

          this.folderStructureTree[
            indexToPush
          ].line = `${green}${this.folderStructureTree[indexToPush].line}${reset}`;
        } else if (error) {
          errors.push({
            file: filePath,
            function: funcData.functionName,
            error: { stack: error.stack, message: error.message },
          });

          if (this.spinner) {
            await spinner.stop();
          }
          this.folderStructureTree[
            indexToPush
          ].line = `${red}${this.folderStructureTree[indexToPush].line}${reset}`;
        }
      }

      if (uniqueFoundFunctions.length > 0) {
        this.folderStructureTree[fileIndex].line = `${green + bold}${
          this.folderStructureTree[fileIndex].line
        }${reset}`;
      }
    } catch (e) {
      if (!ignoreErrors.includes(e.code)) errors.push(e.stack);
    }
  }

  async reformatDataForPythagoraAPI(funcData, filePath, testFilePath) {
    let relatedCode = _.groupBy(funcData.relatedCode, "fileName");
    // TODO add check if there are more functionNames than 1 while exportedAsObject is true - this shouldn't happen ever
    relatedCode = _.map(relatedCode, (value, key) => {
      return {
        fileName: key,
        functionNames: value.map((item) => item.funcName),
        exportedAsObject: value[0].exportedAsObject,
        syntaxType: value[0].syntaxType,
      };
    });
    let relatedCodeInSameFile = [funcData.functionName];
    funcData.relatedCode = [];
    for (const file of relatedCode) {
      if (file.fileName === filePath) {
        relatedCodeInSameFile = relatedCodeInSameFile.concat(
          file.functionNames
        );
      } else {
        let fileName = getRelativePath(file.fileName, path.dirname(filePath));
        let code = await stripUnrelatedFunctions(
          file.fileName,
          file.functionNames
        );
        let fullPath =
          filePath.substring(0, filePath.lastIndexOf("/")) + "/" + fileName;
        code = replaceRequirePaths(
          code,
          filePath,
          getTestFolderPath(filePath, rootPath)
        );
        funcData.relatedCode.push({
          fileName,
          code,
          functionNames: file.functionNames,
          exportedAsObject: file.exportedAsObject,
          syntaxType: file.syntaxType,
          pathRelativeToTest: getRelativePath(fullPath, testFilePath),
        });
      }
    }
    funcData.functionCode = await stripUnrelatedFunctions(
      filePath,
      relatedCodeInSameFile
    );
    funcData.functionCode = replaceRequirePaths(
      funcData.functionCode,
      path.dirname(filePath),
      getTestFolderPath(filePath, rootPath)
    );
    funcData.pathRelativeToTest = getRelativePath(filePath, testFilePath);
    return funcData;
  }

  async saveTests(filePath, name, testData) {
    let dir = getTestFolderPath(filePath, rootPath);
    let extension = path.extname(filePath);

    if (!(await checkDirectoryExists(dir))) {
      fs.mkdirSync(dir, { recursive: true });
    }

    let testPath = path.join(dir, `/${name}.test${extension}`);
    fs.writeFileSync(testPath, testData);
    return testPath;
  }

  async traverseDirectoryUnit(file, funcName) {
    if (this.processedFiles.includes(file)) {
      return;
    }
    this.processedFiles.push(file);

    if ((await checkPathType(file)) === "file") {
      if (!this.processExtensions.includes(path.extname(file))) {
        throw new Error("File extension is not supported");
      }
      return await this.createTests(file, funcName);
    }

    const absolutePath = path.resolve(file);
    const stat = fs.statSync(absolutePath);

    if (!stat.isDirectory() && this.isFileToIgnore(file)) return;

    if (stat.isDirectory()) {
      if (
        this.ignoreFolders.includes(path.basename(absolutePath)) ||
        path.basename(absolutePath).charAt(0) === "."
      )
        return;

      const directoryFiles = fs
        .readdirSync(absolutePath)
        .filter((f) => {
          const absoluteFilePath = path.join(absolutePath, f);
          const fileStat = fs.statSync(absoluteFilePath);
          if (fileStat.isDirectory()) {
            const baseName = path.basename(absoluteFilePath);
            return (
              !this.ignoreFolders.includes(baseName) &&
              !baseName.startsWith(".")
            );
          } else {
            const ext = path.extname(f);
            return (
              this.processExtensions.includes(ext) && !this.isFileToIgnore(f)
            );
          }
        })
        .map((f) => path.join(absolutePath, f));
      this.filesToProcess.push(...directoryFiles);
    } else {
      if (!this.processExtensions.includes(path.extname(absolutePath))) return;

      await this.createTests(absolutePath, funcName);
    }

    while (this.filesToProcess.length > 0) {
      const nextFile = this.filesToProcess.shift();
      if (this.processedFiles.includes(nextFile)) {
        continue; // Skip processing if it has already been processed
      }
      await this.traverseDirectoryUnit(nextFile, funcName);
    }
  }

  async runProcessing() {
    await this.traverseAllDirectories();
    await this.traverseDirectoryUnit(this.queriedPath, this.funcName);
  }
}

module.exports = UnitTests;