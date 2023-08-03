const fs = require("fs");
const path = require("path");
const _ = require("lodash");

const { checkDirectoryExists } = require("../utils/common");
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
const { green, red, bold, reset } = require("../const/colors");

const UnitTestsCommon = require("./unitTestsCommon");

class UnitTests extends UnitTestsCommon {
  #API;
  #opts;

  constructor(mainArgs, API, opts = {}) {
    super(mainArgs);

    this.#API = API;
    this.#opts = { ...opts };
  }

  async #createTests(filePath, funcToTest) {
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
            funcName = funcName.replace(
              functionFromTheList.classParent + ".",
              ""
            );
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

      const uniqueFoundFunctions = foundFunctions.filter(
        (item, index, self) =>
          index ===
          self.findIndex(
            (t) =>
              t.functionName === item.functionName &&
              t.functionCode === item.functionCode
          )
      );

      this.sortFolderTree(this.folderStructureTree);

      const fileIndex = this.folderStructureTree.findIndex(
        (item) => item.absolutePath === filePath
      );
      for (const [i, funcData] of uniqueFoundFunctions.entries()) {
        const indexToPush = fileIndex + 1 + i;
        const prefix = this.folderStructureTree[fileIndex].line.split(
          path.basename(this.folderStructureTree[fileIndex].absolutePath)
        )[0];

        this.folderStructureTree.splice(indexToPush, 0, {
          line: " ".repeat(prefix.length) + "└───" + funcData.functionName,
          absolutePath: filePath + ":" + funcData.functionName
        });

        if (this.#opts.spinner) { this.#opts.spinner.start(this.folderStructureTree, indexToPush); }

        const testFilePath = path.join(
          getTestFolderPath(filePath, this.rootPath),
          `/${funcData.functionName}.test${extension}`
        );

        if (fs.existsSync(testFilePath) && !this.force) {
          this.skippedFiles.push(testFilePath);

          if (this.#opts.spinner) {
            await this.#opts.spinner.stop();
          }

          this.folderStructureTree[
            indexToPush
          ].line = `${green}${this.folderStructureTree[indexToPush].line}${reset}`;
          continue;
        }

        const formattedData = await this.#reformatDataForPythagoraAPI(
          funcData,
          filePath,
          getTestFolderPath(filePath, this.rootPath)
        );

        const { tests, error } = await this.#API.getUnitTests(
          formattedData,
          (content) => {
            if (this.#opts.scrollableContent) {
              this.#opts.scrollableContent.setContent(content);
              this.#opts.scrollableContent.setScrollPerc(100);
            }

            if (this.#opts.screen) this.#opts.screen.render();
          }
        );

        if (tests) {
          const testGenerated = {
            functionName: formattedData.functionName,
            testCode: tests
          };

          if (this.#opts.isSaveTests) {
            const testPath = await this.#saveTests(
              filePath,
              funcData.functionName,
              tests
            );
            testGenerated.testPath = testPath;
          }

          this.testsGenerated.push(testGenerated);

          if (this.#opts.spinner) {
            await this.#opts.spinner.stop();
          }

          this.folderStructureTree[
            indexToPush
          ].line = `${green}${this.folderStructureTree[indexToPush].line}${reset}`;
        } else if (error) {
          this.errors.push({
            file: filePath,
            function: funcData.functionName,
            error: { stack: error.stack, message: error.message }
          });

          if (this.#opts.spinner) {
            await this.spinner.stop();
          }
          this.folderStructureTree[
            indexToPush
          ].line = `${red}${this.folderStructureTree[indexToPush].line}${reset}`;
        }
      }

      if (uniqueFoundFunctions.length > 0) {
        this.folderStructureTree[fileIndex].line = `${green + bold}${this.folderStructureTree[fileIndex].line
          }${reset}`;
      }
    } catch (e) {
      if (!UnitTestsCommon.ignoreErrors.includes(e.code)) this.errors.push(e.stack);
    }
  }

  async #reformatDataForPythagoraAPI(funcData, filePath, testFilePath) {
    let relatedCode = _.groupBy(funcData.relatedCode, "fileName");
    // TODO add check if there are more functionNames than 1 while exportedAsObject is true - this shouldn't happen ever
    relatedCode = _.map(relatedCode, (value, key) => {
      return {
        fileName: key,
        functionNames: value.map((item) => item.funcName),
        exportedAsObject: value[0].exportedAsObject,
        syntaxType: value[0].syntaxType
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
        const fileName = getRelativePath(file.fileName, path.dirname(filePath));
        let code = await stripUnrelatedFunctions(
          file.fileName,
          file.functionNames
        );
        const fullPath =
          filePath.substring(0, filePath.lastIndexOf("/")) + "/" + fileName;
        code = replaceRequirePaths(
          code,
          filePath,
          getTestFolderPath(filePath, this.rootPath)
        );
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

    funcData.functionCode = await stripUnrelatedFunctions(
      filePath,
      relatedCodeInSameFile
    );

    funcData.functionCode = replaceRequirePaths(
      funcData.functionCode,
      path.dirname(filePath),
      getTestFolderPath(filePath, this.rootPath)
    );
    funcData.pathRelativeToTest = getRelativePath(filePath, testFilePath);
    return funcData;
  }

  async #saveTests(filePath, name, testData) {
    const dir = getTestFolderPath(filePath, this.rootPath);
    const extension = path.extname(filePath);

    if (!(await checkDirectoryExists(dir))) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const testPath = path.join(dir, `/${name}.test${extension}`);
    fs.writeFileSync(testPath, testData);
    return testPath;
  }

  async #traverseDirectoryUnit(file, funcName) {
    if (this.processedFiles.includes(file)) {
      return;
    }
    this.processedFiles.push(file);

    if ((await checkPathType(file)) === "file") {
      if (!UnitTestsCommon.processExtensions.includes(path.extname(file))) {
        throw new Error("File extension is not supported");
      }
      return await this.#createTests(file, funcName);
    }

    const absolutePath = path.resolve(file);
    const stat = fs.statSync(absolutePath);

    if (!stat.isDirectory() && this.isFileToIgnore(file)) return;

    if (stat.isDirectory()) {
      if (
        UnitTestsCommon.ignoreFolders.includes(path.basename(absolutePath)) ||
        path.basename(absolutePath).charAt(0) === "."
      ) { return; }

      const directoryFiles = fs
        .readdirSync(absolutePath)
        .filter((f) => {
          const absoluteFilePath = path.join(absolutePath, f);
          const fileStat = fs.statSync(absoluteFilePath);
          if (fileStat.isDirectory()) {
            const baseName = path.basename(absoluteFilePath);
            return (
              !UnitTestsCommon.ignoreFolders.includes(baseName) &&
              !baseName.startsWith(".")
            );
          } else {
            const ext = path.extname(f);
            return (
              UnitTestsCommon.processExtensions.includes(ext) && !this.isFileToIgnore(f)
            );
          }
        })
        .map((f) => path.join(absolutePath, f));
      this.filesToProcess.push(...directoryFiles);
    } else {
      if (!UnitTestsCommon.processExtensions.includes(path.extname(absolutePath))) return;

      await this.#createTests(absolutePath, funcName);
    }

    while (this.filesToProcess.length > 0) {
      const nextFile = this.filesToProcess.shift();
      if (this.processedFiles.includes(nextFile)) {
        continue; // Skip processing if it has already been processed
      }
      await this.#traverseDirectoryUnit(nextFile, funcName);
    }
  }

  async runProcessing() {
    await this.traverseAllDirectories();
    await this.#traverseDirectoryUnit(this.queriedPath, this.funcName);

    return {
      errors: this.errors,
      skippedFiles: this.skippedFiles,
      testsGenerated: this.testsGenerated
    };
  }
}

module.exports = UnitTests;
