const fs = require("fs");
const path = require("path");
const _ = require("lodash");

const { PYTHAGORA_UNIT_DIR } = require("../const/common");
const { checkDirectoryExists } = require("../utils/common");
const {
  replaceRequirePaths,
  getAstFromFilePath,
  getRelatedTestImports,
  getSourceCodeFromAst,
  getModuleTypeFromFilePath
} = require("../utils/code");
const { getRelativePath, getTestFolderPath, checkPathType } = require("../utils/files");
const { green, red, reset } = require("../const/colors");

const UnitTestsCommon = require("./unitTestsCommon");

class UnitTestsExpand extends UnitTestsCommon {
  static #filesEndingWith = [".js", ".ts", ".tsx"];

  static #checkForTestFilePath(filePath) {
    const pattern = /test\.(js|ts|tsx)$/;
    return pattern.test(filePath);
  }

  #API;
  #opts;

  constructor(mainArgs, API, opts = {}) {
    super(mainArgs);

    this.#API = API;
    this.#opts = { ...opts };
  }

  async #saveTests(filePath, fileName, testData) {
    const dir = filePath.substring(0, filePath.lastIndexOf("/"));

    if (!await checkDirectoryExists(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const testPath = path.join(dir, `/${fileName}`);
    fs.writeFileSync(testPath, testData);
    return testPath;
  }

  #reformatDataForPythagoraAPI(filePath, testCode, relatedCode, syntaxType) {
    const importedFiles = [];
    _.forEach(relatedCode, (f) => {
      const testPath = path.join(
        path.resolve(PYTHAGORA_UNIT_DIR),
        filePath.replace(this.rootPath, "")
      );
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
        f.relatedFunctions = _.map(f.relatedFunctions, (f) => ({ ...f, fileName: f.fileName.substring(f.fileName.lastIndexOf("/") + 1) }));
        f.relatedFunctions.forEach((f) => importedFiles.push({
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

  async #createAdditionalTests(filePath) {
    try {
      const ast = await getAstFromFilePath(filePath);
      const syntaxType = await getModuleTypeFromFilePath(ast);

      const testPath = path.join(
        this.rootPath + PYTHAGORA_UNIT_DIR,
        filePath.replace(this.rootPath, "")
      );

      let testCode = getSourceCodeFromAst(ast);
      testCode = replaceRequirePaths(
        testCode,
        path.dirname(filePath),
        testPath.substring(0, testPath.lastIndexOf("/"))
      );

      const relatedTestCode = getRelatedTestImports(ast, filePath, this.functionList);
      const formattedData = this.#reformatDataForPythagoraAPI(filePath, testCode, relatedTestCode, syntaxType);
      const fileIndex = this.folderStructureTree.findIndex(item => item.absolutePath === filePath);
      if (this.#opts.spinner) {
        this.#opts.spinner.start(this.folderStructureTree, fileIndex);
      }

      if (fs.existsSync(testPath) && !this.force) {
        this.skippedFiles.push(testPath);
        if (this.#opts.spinner) {
          await this.#opts.spinner.stop();
        }
        this.folderStructureTree[fileIndex].line = `${green}${this.folderStructureTree[fileIndex].line}${reset}`;
        return;
      }

      const { tests, error } = await this.#API.expandUnitTests(formattedData, (content) => {
        if (this.#opts.scrollableContent) {
          this.#opts.scrollableContent.setContent(content);
          this.#opts.scrollableContent.setScrollPerc(100);
        }

        if (this.#opts.screen) {
          this.#opts.screen.render();
        }
      });

      if (tests) {
        const testGenerated = {
          testName: formattedData.testFileName,
          testCode: tests,
          testPath
        };

        if (this.#opts.isSaveTests) {
          await this.#saveTests(testPath, formattedData.testFileName, tests);
        }

        this.testsGenerated.push(testGenerated);

        if (this.#opts.spinner) {
          await this.#opts.spinner.stop();
        }
        this.folderStructureTree[fileIndex].line = `${green}${this.folderStructureTree[fileIndex].line}${reset}`;
      } else if (error) {
        this.errors.push({
          file: filePath,
          error: { stack: error.stack, message: error.message }
        });
        if (this.#opts.spinner) {
          await this.#opts.spinner.stop();
        }
        this.folderStructureTree[fileIndex].line = `${red}${this.folderStructureTree[fileIndex].line}${reset}`;
      }
    } catch (e) {
      if (!UnitTestsCommon.ignoreErrors.includes(e.code)) this.errors.push(e);
    }
  }

  async #traverseDirectoryUnitExpanded(directory, prefix = "") {
    if (await checkPathType(directory) === "file" && UnitTestsExpand.#checkForTestFilePath(directory)) {
      const newPrefix = `|   ${prefix}|   `;
      await this.#createAdditionalTests(directory, newPrefix);
      return;
    } else if (await checkPathType(directory) === "file" && !UnitTestsExpand.#checkForTestFilePath(directory)) {
      throw new Error("Invalid test file path");
    }

    const files = fs.readdirSync(directory);
    for (const file of files) {
      const absolutePath = path.join(directory, file);
      const stat = fs.statSync(absolutePath);
      if (stat.isDirectory()) {
        if (UnitTestsCommon.ignoreFolders.includes(path.basename(absolutePath)) || path.basename(absolutePath).charAt(0) === ".") continue;
        await this.#traverseDirectoryUnitExpanded(absolutePath, prefix);
      } else {
        if (!UnitTestsCommon.processExtensions.includes(path.extname(absolutePath)) || !UnitTestsExpand.#checkForTestFilePath(file)) continue;
        await this.#createAdditionalTests(absolutePath, prefix);
      }
    }
  }

  async runProcessing() {
    await this.traverseAllDirectories((fileName) =>
      !UnitTestsExpand.#filesEndingWith.some(ending => fileName.endsWith(ending))
    );
    await this.#traverseDirectoryUnitExpanded(this.queriedPath, this.funcName);

    return {
      errors: this.errors,
      skippedFiles: this.skippedFiles,
      testsGenerated: this.testsGenerated
    };
  }
}

module.exports = UnitTestsExpand;
