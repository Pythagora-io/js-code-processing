"use strict";

/* eslint-disable space-before-function-paren */
/* eslint-disable no-useless-catch */
const fs = require("fs");
const path = require("path");
const _ = require("lodash");
const generator = require("@babel/generator").default;
const {
  getFolderTreeItem,
  isPathInside,
  calculateDepth
} = require("../utils/files");
const {
  getAstFromFilePath,
  processAst,
  getRelatedFunctions,
  getModuleTypeFromFilePath
} = require("../utils/code");
class UnitTestsCommon {
  static ignoreFolders = ["node_modules", "pythagora_tests"];
  static ignoreFilesEndingWith = [".test.js", ".test.ts", ".test.tsx"];
  static processExtensions = [".js", ".ts", ".tsx"];
  static ignoreErrors = ["BABEL_PARSER_SYNTAX_ERROR"];
  constructor({
    pathToProcess,
    pythagoraRoot,
    funcName,
    force
  }) {
    this.rootPath = pythagoraRoot;
    this.queriedPath = path.resolve(pathToProcess);
    this.funcName = funcName;
    this.force = force;
    this.filesToProcess = [];
    this.processedFiles = [];
    this.testsGenerated = [];
    this.skippedFiles = [];
    this.functionList = {};
    this.folderStructureTree = [];
    this.errors = [];
    this.isFileToIgnore = fileName => {
      return UnitTestsCommon.ignoreFilesEndingWith.some(ending => fileName.endsWith(ending));
    };
  }
  async traverseAllDirectories(ignoreFilesRewrite) {
    if (ignoreFilesRewrite) {
      this.isFileToIgnore = ignoreFilesRewrite;
    }
    await this.traverseDirectory(this.queriedPath);
    this.processedFiles = [];
    await this.traverseDirectory(this.queriedPath);
    this.processedFiles = [];
  }
  async traverseDirectory(file) {
    if (this.processedFiles.includes(file)) {
      return;
    }
    this.processedFiles.push(file);
    const absolutePath = path.resolve(file);
    const stat = fs.statSync(absolutePath);
    if (!stat.isDirectory() && this.isFileToIgnore(file)) return;
    if (stat.isDirectory()) {
      if (UnitTestsCommon.ignoreFolders.includes(path.basename(absolutePath)) || path.basename(absolutePath).charAt(0) === ".") {
        return;
      }
      if (isPathInside(path.dirname(this.queriedPath), absolutePath)) {
        this.updateFolderTree(absolutePath);
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
      if (isPathInside(path.dirname(this.queriedPath), absolutePath)) {
        this.updateFolderTree(absolutePath);
      }
      await this.processFile(absolutePath, this.filesToProcess);
    }
    while (this.filesToProcess.length > 0) {
      const nextFile = this.filesToProcess.shift();
      if (this.processedFiles.includes(nextFile)) {
        continue; // Skip processing if it has already been processed
      }

      await this.traverseDirectory(nextFile);
    }
  }
  updateFolderTree(absolutePath) {
    if (isPathInside(this.queriedPath, absolutePath) && !this.folderStructureTree.find(fst => fst.absolutePath === absolutePath)) {
      const depth = calculateDepth(this.queriedPath, absolutePath);
      let prefix = "";
      for (let i = 1; i < depth; i++) {
        prefix += "|    ";
      }
      this.folderStructureTree.push(getFolderTreeItem(prefix + "├───", absolutePath));
    }
  }
  resolveFilePath(filePath, extension) {
    if (fs.existsSync(filePath)) {
      return filePath;
    }
    const filePathWithExtension = `${filePath}${extension}`;
    if (fs.existsSync(filePathWithExtension)) {
      return filePathWithExtension;
    }
    return undefined;
  }
  async processFile(filePath) {
    try {
      const exportsFn = [];
      const exportsObj = [];
      const functions = [];
      const ast = await getAstFromFilePath(filePath);
      const syntaxType = await getModuleTypeFromFilePath(ast);
      const extension = path.extname(filePath);

      // Analyze dependencies
      ast.program.body.forEach(node => {
        if (node.type === "ImportDeclaration") {
          let importedFile = path.resolve(path.dirname(filePath), node.source.value);
          importedFile = this.resolveFilePath(importedFile, extension);
          if (importedFile && !this.filesToProcess.includes(importedFile)) {
            this.filesToProcess.push(importedFile);
          }
        } else if (node.type === "VariableDeclaration" && node.declarations.length > 0 && node.declarations[0].init && node.declarations[0].init.type === "CallExpression" && node.declarations[0].init.callee.name === "require") {
          let importedFile = path.resolve(path.dirname(filePath), node.declarations[0].init.arguments[0].value);
          importedFile = this.resolveFilePath(importedFile, extension);
          if (importedFile && !this.filesToProcess.includes(importedFile)) {
            this.filesToProcess.push(importedFile);
          }
        }
      });
      processAst(ast, (funcName, path, type) => {
        if (type === "exportFn" || type === "exportFnDef") {
          exportsFn.push(funcName);
        } else if (type === "exportObj") {
          exportsObj.push(funcName);
        }
        if (!["exportFn", "exportObj"].includes(type)) {
          functions.push({
            funcName,
            code: generator(path.node).code,
            filePath,
            relatedFunctions: getRelatedFunctions(path.node, ast, filePath, this.functionList)
          });
        }
      });
      for (const f of functions) {
        // TODO refactor since this is being set in code.js and here it's reverted
        const classParent = exportsFn.find(e => new RegExp(`${e}\..*`).test(f.funcName)) || exportsObj.find(e => new RegExp(`${e}\..*`).test(f.funcName));
        const isExportedAsObject = exportsObj.includes(f.funcName) || exportsObj.includes(classParent);

        // if (classParent) f.funcName = f.funcName.replace(classParent + '.', '');

        this.functionList[filePath + ":" + f.funcName] = _.extend(f, {
          classParent,
          syntaxType,
          exported: exportsFn.includes(f.funcName) || isExportedAsObject || !!classParent,
          exportedAsObject: isExportedAsObject,
          funcName: f.funcName
        });
      }
    } catch (err) {
      throw err;
      // writeLine(`Error parsing file ${filePath}: ${e}`);
    }
  }

  sortFolderTree(tree) {
    // 1. Sort the folderStructureTree
    tree.sort((a, b) => {
      if (a.absolutePath < b.absolutePath) {
        return -1;
      }
      if (a.absolutePath > b.absolutePath) {
        return 1;
      }
      return 0;
    });

    // 2. Set prefix according to the position in the directory
    for (let i = 0; i < tree.length; i++) {
      // Get the current directory path
      const currentDirPath = path.dirname(tree[i].absolutePath);
      // Check if it's the last file in the directory
      if (i === tree.length - 1 || path.dirname(tree[i + 1].absolutePath) !== currentDirPath) {
        // Update the prefix for the last file in the directory
        tree[i].line = tree[i].line.replace("├───", "└───");
      }
    }
  }
}
module.exports = UnitTestsCommon;