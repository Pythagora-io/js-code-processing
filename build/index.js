'use strict';

var require$$0 = require('fs');
var require$$1 = require('path');
var require$$2$1 = require('lodash');
var require$$3 = require('@babel/generator');
var require$$1$1 = require('@babel/parser');
var require$$2 = require('@babel/traverse');
var require$$1$2 = require('axios');
var require$$3$1 = require('http');
var require$$4 = require('https');

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var common$2 = {
  PYTHAGORA_TESTS_DIR: "pythagora_tests",
  PYTHAGORA_METADATA_DIR: ".pythagora",
  METADATA_FILENAME: "metadata.json",
  REVIEW_DATA_FILENAME: "review.json",
  EXPORT_METADATA_FILENAME: "export.json",
  CONFIG_FILENAME: "config.json",
  PYTHAGORA_ASYNC_STORE: 42069420,
  PYTHAGORA_DELIMITER: "-_-",
  EXPORTED_TESTS_DIR: "pythagora_tests/exported_tests",
  EXPORTED_TESTS_DATA_DIR: "pythagora_tests/exported_tests/data",
  SRC_TO_ROOT: "../../../",
  MIN_TOKENS_FOR_GPT_RESPONSE: 1640,
  MAX_GPT_MODEL_TOKENS: 8192,
  PYTHAGORA_UNIT_TESTS_VERSION: 1,
  PYTHAGORA_UNIT_DIR: "pythagora_tests/unit",
  PYTHAGORA_API_SERVER: "https://api.pythagora.io"
};

const path$4 = require$$1;
const {
  PYTHAGORA_UNIT_DIR: PYTHAGORA_UNIT_DIR$1
} = common$2;
const fs$5 = require$$0.promises;
const fsSync = require$$0;
async function checkPathType$2(path) {
  const stats = await fs$5.stat(path);
  return stats.isFile() ? "file" : "directory";
}
function getRelativePath$3(filePath, referenceFolderPath) {
  let relativePath = path$4.relative(path$4.resolve(referenceFolderPath), filePath);
  if (!relativePath.startsWith("../") && !relativePath.startsWith("./")) {
    relativePath = "./" + relativePath;
  }
  return relativePath;
}
function getFolderTreeItem$1(prefix, absolutePath) {
  const isDirectory = absolutePath.includes(":") ? false : fsSync.statSync(absolutePath).isDirectory();
  return {
    line: `${prefix}${path$4.basename(absolutePath)}`,
    absolutePath,
    isDirectory
  };
}
function isPathInside$1(basePath, targetPath) {
  const relativePath = path$4.relative(basePath, targetPath);
  return !relativePath || !relativePath.startsWith("..") && !path$4.isAbsolute(relativePath);
}
function getTestFolderPath$2(filePath, rootPath) {
  return path$4.join(path$4.join(rootPath, PYTHAGORA_UNIT_DIR$1), path$4.dirname(filePath).replace(path$4.resolve(rootPath), ""), path$4.basename(filePath, path$4.extname(filePath)));
}
function calculateDepth$1(basePath, targetPath) {
  const baseComponents = basePath.split(path$4.sep);
  const targetComponents = targetPath.split(path$4.sep);

  // The depth is the difference in the number of components
  return targetComponents.length - baseComponents.length + 1;
}
var files = {
  checkPathType: checkPathType$2,
  getRelativePath: getRelativePath$3,
  getFolderTreeItem: getFolderTreeItem$1,
  isPathInside: isPathInside$1,
  getTestFolderPath: getTestFolderPath$2,
  calculateDepth: calculateDepth$1
};

const path$3 = require$$1;
const babelParser = require$$1$1;
const {
  default: babelTraverse
} = require$$2;
const {
  default: generator$1
} = require$$3;
const {
  getRelativePath: getRelativePath$2
} = files;
const fs$4 = require$$0.promises;
const _$4 = require$$2$1;
function replaceRequirePaths$2(code, currentPath, testFilePath) {
  const importRequirePathRegex = /(require\((['"`])(.+?)\2\))|(import\s+.*?\s+from\s+(['"`])(.+?)\5)/g;
  return code.replace(importRequirePathRegex, (match, requireExp, requireQuote, requirePath, importExp, importQuote, importPath) => {
    let quote, modulePath;
    if (requireExp) {
      quote = requireQuote;
      modulePath = requirePath;
    } else if (importExp) {
      quote = importQuote;
      modulePath = importPath;
    }
    if (!modulePath.startsWith("./") && !modulePath.startsWith("../")) {
      return match;
    }
    const absoluteRequirePath = path$3.resolve(currentPath, modulePath);
    const newRequirePath = getRelativePath$2(absoluteRequirePath, testFilePath);
    if (requireExp) {
      return `require(${quote}${newRequirePath}${quote})`;
    } else if (importExp) {
      return `${importExp.split("from")[0].trim()} from ${quote}${newRequirePath}${quote}`;
    }
  });
}
async function getAstFromFilePath$3(filePath) {
  let data = await fs$4.readFile(filePath, "utf8");
  // Remove shebang if it exists
  if (data.indexOf("#!") === 0) {
    data = "//" + data;
  }
  const ast = babelParser.parse(data, {
    sourceType: "module",
    // Consider input as ECMAScript module
    locations: true,
    plugins: ["jsx", "objectRestSpread", "typescript"] // Enable JSX, typescript and object rest/spread syntax
  });

  return ast;
}
async function getModuleTypeFromFilePath$2(ast) {
  let moduleType = "CommonJS";
  babelTraverse(ast, {
    ImportDeclaration(path) {
      moduleType = "ES6";
      path.stop(); // Stop traversal when an ESM statement is found
    },

    ExportNamedDeclaration(path) {
      moduleType = "ES6";
      path.stop(); // Stop traversal when an ESM statement is found
    },

    ExportDefaultDeclaration(path) {
      moduleType = "ES6";
      path.stop(); // Stop traversal when an ESM statement is found
    },

    CallExpression(path) {
      if (path.node.callee.name === "require") {
        moduleType = "CommonJS";
        path.stop(); // Stop traversal when a CommonJS statement is found
      }
    },

    AssignmentExpression(path) {
      if (path.node.left.type === "MemberExpression" && path.node.left.object.name === "module" && path.node.left.property.name === "exports") {
        moduleType = "CommonJS";
        path.stop(); // Stop traversal when a CommonJS statement is found
      }
    }
  });

  return moduleType;
}
function collectTopRequires(node) {
  const requires = [];
  babelTraverse(node, {
    VariableDeclaration(path) {
      if (path.node.declarations[0].init && path.node.declarations[0].init.callee && path.node.declarations[0].init.callee.name === "require") {
        requires.push(generator$1(path.node).code);
      }
    },
    ImportDeclaration(path) {
      requires.push(generator$1(path.node).code);
    }
  });
  return requires;
}
function insideFunctionOrMethod(nodeTypesStack) {
  return nodeTypesStack.slice(0, -1).some(type => /^(FunctionDeclaration|FunctionExpression|ArrowFunctionExpression|ClassMethod)$/.test(type));
}
function getPathFromRequireOrImport(path) {
  return (path.match(/require\((['"`])(.*?)\1\)|import\s+.*?\s+from\s+(['"`])(.*?)\3/) || [])[2] || (path.match(/require\((['"`])(.*?)\1\)|import\s+.*?\s+from\s+(['"`])(.*?)\3/) || [])[4];
}
function getFullPathFromRequireOrImport(importPath, filePath) {
  if (importPath && (importPath.startsWith("./") || importPath.startsWith("../"))) {
    importPath = path$3.resolve(filePath.substring(0, filePath.lastIndexOf("/")), importPath);
  }
  if (importPath.lastIndexOf(".js") + ".js".length !== importPath.length) {
    importPath += ".js";
  }
  return importPath;
}
function getRelatedFunctions$1(node, ast, filePath, functionList) {
  const relatedFunctions = [];
  const requiresFromFile = collectTopRequires(ast);
  function processNodeRecursively(node) {
    if (node.type === "CallExpression") {
      let funcName;
      let callee = node.callee;
      while (callee.type === "MemberExpression") {
        callee = callee.object;
      }
      if (callee.type === "Identifier") {
        funcName = callee.name;
      } else if (callee.type === "MemberExpression") {
        funcName = callee.property.name;
        if (callee.object.type === "Identifier") {
          funcName = callee.object.name + "." + funcName;
        }
      }
      let requiredPath = requiresFromFile.find(require => require.includes(funcName));
      const importPath = requiredPath;
      if (!requiredPath) {
        requiredPath = filePath;
      } else {
        requiredPath = getPathFromRequireOrImport(requiredPath);
        requiredPath = getFullPathFromRequireOrImport(requiredPath, filePath);
      }
      const functionFromList = functionList[requiredPath + ":" + funcName];
      if (functionFromList) {
        relatedFunctions.push(_$4.extend(functionFromList, {
          fileName: requiredPath,
          importPath
        }));
      }
    }

    // Traverse child nodes
    for (const key in node) {
      const prop = node[key];
      if (Array.isArray(prop)) {
        for (const child of prop) {
          if (typeof child === "object" && child !== null) {
            processNodeRecursively(child);
          }
        }
      } else if (typeof prop === "object" && prop !== null) {
        processNodeRecursively(prop);
      }
    }
  }
  processNodeRecursively(node);
  return relatedFunctions;
}
async function stripUnrelatedFunctions$1(filePath, targetFuncNames) {
  const ast = await getAstFromFilePath$3(filePath);

  // Store the node paths of unrelated functions and class methods
  const unrelatedNodes = [];
  processAst$2(ast, (funcName, path, type) => {
    if (!targetFuncNames.includes(funcName) && type !== "exportFn" && type !== "exportObj") {
      // If the function is being used as a property value, remove the property instead of the function
      if (path.parentPath.isObjectProperty()) {
        unrelatedNodes.push(path.parentPath);
      } else {
        unrelatedNodes.push(path);
      }
    }
  });

  // Remove unrelated nodes from the AST
  for (const path of unrelatedNodes) {
    path.remove();
  }

  // Generate the stripped code from the modified AST
  const strippedCode = generator$1(ast).code;
  return strippedCode;
}
function processAst$2(ast, cb) {
  const nodeTypesStack = [];
  babelTraverse(ast, {
    enter(path) {
      nodeTypesStack.push(path.node.type);
      if (insideFunctionOrMethod(nodeTypesStack)) return;

      // Handle module.exports
      if (path.isExpressionStatement()) {
        const expression = path.node.expression;
        if (expression && expression.type === "AssignmentExpression") {
          const left = expression.left;
          if (left.object && left.object.type === "MemberExpression" && left.object.object.name === "module" && left.object.property.name === "exports") {
            if (expression.right.type === "Identifier") {
              // module.exports.func1 = func1
              return cb(left.property.name, path, "exportObj");
            } else if (expression.right.type === "FunctionExpression") {
              // module.exports.funcName = function() { ... }
              // module.exports = function() { ... }
              const loc = path.node.loc.start;
              const funcName = left.property.name || `anon_func_${loc.line}_${loc.column}`;
              return cb(funcName, path, "exportObj");
            }
          } else if (left.type === "MemberExpression" && left.object.name === "module" && left.property.name === "exports") {
            if (expression.right.type === "Identifier") {
              // module.exports = func1
              return cb(expression.right.name, path, "exportFn");
            } else if (expression.right.type === "FunctionExpression") {
              let funcName;
              if (expression.right.id) {
                // module.exports = function func1() { ... }
                funcName = expression.right.id.name;
              } else {
                // module.exports = function() { ... }
                const loc = path.node.loc.start;
                funcName = `anon_func_${loc.line}_${loc.column}`;
              }
              return cb(funcName, path, "exportFnDef");
            } else if (expression.right.type === "ObjectExpression") {
              expression.right.properties.forEach(prop => {
                if (prop.type === "ObjectProperty") {
                  // module.exports = { func1 };
                  return cb(prop.key.name, path, "exportObj");
                }
              });
            }
          } /* Handle TypeScript transpiled exports */else if (left.type === "MemberExpression" && left.object.name === "exports") {
            // exports.func1 = function() { ... }
            // exports.func1 = func1
            return cb(left.property.name, path, "exportObj");
          }
        }
      }

      // Handle ES6 export statements
      if (path.isExportDefaultDeclaration()) {
        const declaration = path.node.declaration;
        if (declaration.type === "FunctionDeclaration" || declaration.type === "Identifier") {
          // export default func1;
          // TODO export default function() { ... }
          // TODO cover anonimous functions - add "anon_" name
          return cb(declaration.id ? declaration.id.name : declaration.name, path, "exportFn");
        } else if (declaration.type === "ObjectExpression") {
          declaration.properties.forEach(prop => {
            if (prop.type === "ObjectProperty") {
              // export default { func1: func }
              // export default { func1 }
              return cb(prop.key.name, path, "exportObj");
            }
          });
        } else if (declaration.type === "ClassDeclaration") {
          // export default class Class1 { ... }
          return cb(declaration.id ? declaration.id.name : declaration.name, path, "exportFnDef");
        }
      } else if (path.isExportNamedDeclaration()) {
        if (path.node.declaration) {
          if (path.node.declaration.type === "FunctionDeclaration") {
            // export function func1 () { ... }
            // export class Class1 () { ... }
            return cb(path.node.declaration.id.name, path, "exportObj");
          } else if (path.node.declaration.type === "VariableDeclaration") {
            // export const const1 = 'constant';
            // export const func1 = () => { ... }
            path.node.declaration.declarations.forEach(declaration => {
              return cb(declaration.id.name, path, "exportObj");
            });
          } else if (path.node.declaration.type === "ClassDeclaration") {
            // export class Class1 { ... }
            return cb(path.node.declaration.id.name, path, "exportFnDef");
          }
        } else if (path.node.specifiers.length > 0) {
          path.node.specifiers.forEach(spec => {
            // export { func as func1 }
            return cb(spec.exported.name, path, "exportObj");
          });
        }
      }
      let funcName;
      if (path.isFunctionDeclaration()) {
        funcName = path.node.id.name;
      } else if (path.isFunctionExpression() || path.isArrowFunctionExpression()) {
        if (path.parentPath.isVariableDeclarator()) {
          funcName = path.parentPath.node.id.name;
        } else if (path.parentPath.isAssignmentExpression() || path.parentPath.isObjectProperty()) {
          funcName = path.parentPath.node.left ? path.parentPath.node.left.name : path.parentPath.node.key.name;
        }
      } else if (path.node.type === "ClassMethod" && path.node.key.name !== "constructor") {
        funcName = path.node.key.name;
        if (path.parentPath.node.type === "ClassDeclaration") {
          const className = path.parentPath.node.id.name;
          funcName = `${className}.${funcName}`;
        } else if (path.parentPath.node.type === "ClassExpression") {
          const className = path.parentPath.node.id.name || "";
          funcName = `${className}.${funcName}`;
        } else if (path.parentPath.node.type === "ClassBody") {
          // TODO: Handle classes that are not declared as a variable
          const className = path.parentPath.parentPath.node.id ? path.parentPath.parentPath.node.id.name : "";
          funcName = `${className}.${funcName}`;
        }
      }
      if (funcName) cb(funcName, path);
    },
    exit(path) {
      nodeTypesStack.pop();
    }
  });
}
function getSourceCodeFromAst$1(ast) {
  return generator$1(ast).code;
}
function collectTestRequires(node) {
  const requires = [];
  babelTraverse(node, {
    ImportDeclaration(path) {
      if (path.node && path.node.specifiers && path.node.specifiers.length > 0) {
        const requireData = {
          code: generator$1(path.node).code,
          functionNames: []
        };
        _$4.forEach(path.node.specifiers, s => {
          if (s.local && s.local.name) {
            requireData.functionNames.push(s.local.name);
          }
        });
        requires.push(requireData);
      }
    },
    CallExpression(path) {
      if (path.node.callee.name === "require" && path.node.arguments && path.node.arguments.length > 0) {
        const requireData = {
          code: generator$1(path.node).code,
          functionNames: []
        };

        // In case of a CommonJS require, the function name is usually the variable identifier of the parent node
        if (path.parentPath && path.parentPath.node.type === "VariableDeclarator" && path.parentPath.node.id) {
          requireData.functionNames.push(path.parentPath.node.id.name);
        }
        requires.push(requireData);
      }
    }
  });
  return requires;
}
function getRelatedTestImports$1(ast, filePath, functionList) {
  const relatedCode = [];
  const requiresFromFile = collectTestRequires(ast);
  for (const fileImport in requiresFromFile) {
    let requiredPath = getPathFromRequireOrImport(requiresFromFile[fileImport].code);
    requiredPath = getFullPathFromRequireOrImport(requiredPath, filePath);
    _$4.forEach(requiresFromFile[fileImport].functionNames, funcName => {
      const functionFromList = functionList[requiredPath + ":" + funcName];
      if (functionFromList) {
        relatedCode.push(_$4.extend(functionFromList, {
          fileName: requiredPath
        }));
      }
    });
  }
  for (const relCode of relatedCode) {
    let relatedCodeImports = "";
    for (const func of relCode.relatedFunctions) {
      if (func.importPath) {
        relatedCodeImports += `${func.importPath}\n`;
      }
    }
    if (relatedCodeImports) {
      relCode.code = `${relatedCodeImports}\n${relCode.code}`;
    }
  }
  return relatedCode;
}
var code = {
  replaceRequirePaths: replaceRequirePaths$2,
  getAstFromFilePath: getAstFromFilePath$3,
  collectTopRequires,
  insideFunctionOrMethod,
  getRelatedFunctions: getRelatedFunctions$1,
  stripUnrelatedFunctions: stripUnrelatedFunctions$1,
  processAst: processAst$2,
  getModuleTypeFromFilePath: getModuleTypeFromFilePath$2,
  getSourceCodeFromAst: getSourceCodeFromAst$1,
  getRelatedTestImports: getRelatedTestImports$1
};

/* eslint-disable space-before-function-paren */

/* eslint-disable no-useless-catch */
const fs$3 = require$$0;
const path$2 = require$$1;
const _$3 = require$$2$1;
const generator = require$$3.default;
const {
  getFolderTreeItem,
  isPathInside,
  calculateDepth
} = files;
const {
  getAstFromFilePath: getAstFromFilePath$2,
  processAst: processAst$1,
  getRelatedFunctions,
  getModuleTypeFromFilePath: getModuleTypeFromFilePath$1
} = code;
let UnitTestsCommon$3 = class UnitTestsCommon {
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
    this.queriedPath = path$2.resolve(pathToProcess);
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
    const absolutePath = path$2.resolve(file);
    const stat = fs$3.statSync(absolutePath);
    if (!stat.isDirectory() && this.isFileToIgnore(file)) return;
    if (stat.isDirectory()) {
      if (UnitTestsCommon.ignoreFolders.includes(path$2.basename(absolutePath)) || path$2.basename(absolutePath).charAt(0) === ".") {
        return;
      }
      if (isPathInside(path$2.dirname(this.queriedPath), absolutePath)) {
        this.updateFolderTree(absolutePath);
      }
      const directoryFiles = fs$3.readdirSync(absolutePath).filter(f => {
        const absoluteFilePath = path$2.join(absolutePath, f);
        const fileStat = fs$3.statSync(absoluteFilePath);
        if (fileStat.isDirectory()) {
          const baseName = path$2.basename(absoluteFilePath);
          return !UnitTestsCommon.ignoreFolders.includes(baseName) && !baseName.startsWith(".");
        } else {
          const ext = path$2.extname(f);
          return UnitTestsCommon.processExtensions.includes(ext) && !this.isFileToIgnore(f);
        }
      }).map(f => path$2.join(absolutePath, f));
      this.filesToProcess.push(...directoryFiles);
    } else {
      if (!UnitTestsCommon.processExtensions.includes(path$2.extname(absolutePath))) return;
      if (isPathInside(path$2.dirname(this.queriedPath), absolutePath)) {
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
    if (fs$3.existsSync(filePath)) {
      return filePath;
    }
    const filePathWithExtension = `${filePath}${extension}`;
    if (fs$3.existsSync(filePathWithExtension)) {
      return filePathWithExtension;
    }
    return undefined;
  }
  async processFile(filePath) {
    try {
      const exportsFn = [];
      const exportsObj = [];
      const functions = [];
      const ast = await getAstFromFilePath$2(filePath);
      const syntaxType = await getModuleTypeFromFilePath$1(ast);
      const extension = path$2.extname(filePath);

      // Analyze dependencies
      ast.program.body.forEach(node => {
        if (node.type === "ImportDeclaration") {
          let importedFile = path$2.resolve(path$2.dirname(filePath), node.source.value);
          importedFile = this.resolveFilePath(importedFile, extension);
          if (importedFile && !this.filesToProcess.includes(importedFile)) {
            this.filesToProcess.push(importedFile);
          }
        } else if (node.type === "VariableDeclaration" && node.declarations.length > 0 && node.declarations[0].init && node.declarations[0].init.type === "CallExpression" && node.declarations[0].init.callee.name === "require") {
          let importedFile = path$2.resolve(path$2.dirname(filePath), node.declarations[0].init.arguments[0].value);
          importedFile = this.resolveFilePath(importedFile, extension);
          if (importedFile && !this.filesToProcess.includes(importedFile)) {
            this.filesToProcess.push(importedFile);
          }
        }
      });
      processAst$1(ast, (funcName, path, type) => {
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

        this.functionList[filePath + ":" + f.funcName] = _$3.extend(f, {
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
      const currentDirPath = path$2.dirname(tree[i].absolutePath);
      // Check if it's the last file in the directory
      if (i === tree.length - 1 || path$2.dirname(tree[i + 1].absolutePath) !== currentDirPath) {
        // Update the prefix for the last file in the directory
        tree[i].line = tree[i].line.replace("├───", "└───");
      }
    }
  }
};
var unitTestsCommon = UnitTestsCommon$3;

const fs$2 = require$$0;
async function checkDirectoryExists$2(directoryPath) {
  try {
    const stats = await fs$2.promises.stat(directoryPath);
    return stats.isDirectory();
  } catch (error) {
    if (error.code === "ENOENT") {
      // Directory does not exist
      return false;
    }
    // Other error occurred
    throw error;
  }
}
var common$1 = {
  checkDirectoryExists: checkDirectoryExists$2
};

var colors$1 = {
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  reset: "\x1b[0m",
  bold: "\x1b[1m"
};

function _classPrivateMethodInitSpec$1(obj, privateSet) { _checkPrivateRedeclaration$1(obj, privateSet); privateSet.add(obj); }
function _classPrivateFieldInitSpec$1(obj, privateMap, value) { _checkPrivateRedeclaration$1(obj, privateMap); privateMap.set(obj, value); }
function _checkPrivateRedeclaration$1(obj, privateCollection) { if (privateCollection.has(obj)) { throw new TypeError("Cannot initialize the same private elements twice on an object"); } }
function _classPrivateMethodGet$1(receiver, privateSet, fn) { if (!privateSet.has(receiver)) { throw new TypeError("attempted to get private field on non-instance"); } return fn; }
function _classPrivateFieldGet$1(receiver, privateMap) { var descriptor = _classExtractFieldDescriptor$1(receiver, privateMap, "get"); return _classApplyDescriptorGet$1(receiver, descriptor); }
function _classApplyDescriptorGet$1(receiver, descriptor) { if (descriptor.get) { return descriptor.get.call(receiver); } return descriptor.value; }
function _classPrivateFieldSet$1(receiver, privateMap, value) { var descriptor = _classExtractFieldDescriptor$1(receiver, privateMap, "set"); _classApplyDescriptorSet$1(receiver, descriptor, value); return value; }
function _classExtractFieldDescriptor$1(receiver, privateMap, action) { if (!privateMap.has(receiver)) { throw new TypeError("attempted to " + action + " private field on non-instance"); } return privateMap.get(receiver); }
function _classApplyDescriptorSet$1(receiver, descriptor, value) { if (descriptor.set) { descriptor.set.call(receiver, value); } else { if (!descriptor.writable) { throw new TypeError("attempted to set read only private field"); } descriptor.value = value; } }
const fs$1 = require$$0;
const path$1 = require$$1;
const _$2 = require$$2$1;
const {
  checkDirectoryExists: checkDirectoryExists$1
} = common$1;
const {
  stripUnrelatedFunctions,
  replaceRequirePaths: replaceRequirePaths$1,
  getAstFromFilePath: getAstFromFilePath$1,
  processAst
} = code;
const {
  getRelativePath: getRelativePath$1,
  getTestFolderPath: getTestFolderPath$1,
  checkPathType: checkPathType$1
} = files;
const {
  green: green$1,
  red: red$2,
  bold: bold$1,
  reset: reset$2
} = colors$1;
const UnitTestsCommon$2 = unitTestsCommon;
var _API$1 = /*#__PURE__*/new WeakMap();
var _opts$1 = /*#__PURE__*/new WeakMap();
var _createTests = /*#__PURE__*/new WeakSet();
var _reformatDataForPythagoraAPI$1 = /*#__PURE__*/new WeakSet();
var _saveTests$1 = /*#__PURE__*/new WeakSet();
var _traverseDirectoryUnit = /*#__PURE__*/new WeakSet();
let UnitTests$1 = class UnitTests extends UnitTestsCommon$2 {
  constructor(mainArgs, API, opts = {}) {
    super(mainArgs);
    _classPrivateMethodInitSpec$1(this, _traverseDirectoryUnit);
    _classPrivateMethodInitSpec$1(this, _saveTests$1);
    _classPrivateMethodInitSpec$1(this, _reformatDataForPythagoraAPI$1);
    _classPrivateMethodInitSpec$1(this, _createTests);
    _classPrivateFieldInitSpec$1(this, _API$1, {
      writable: true,
      value: void 0
    });
    _classPrivateFieldInitSpec$1(this, _opts$1, {
      writable: true,
      value: void 0
    });
    _classPrivateFieldSet$1(this, _API$1, API);
    _classPrivateFieldSet$1(this, _opts$1, {
      ...opts
    });
  }
  async runProcessing() {
    await this.traverseAllDirectories();
    await _classPrivateMethodGet$1(this, _traverseDirectoryUnit, _traverseDirectoryUnit2).call(this, this.queriedPath, this.funcName);
    return {
      errors: this.errors,
      skippedFiles: this.skippedFiles,
      testsGenerated: this.testsGenerated
    };
  }
};
async function _createTests2(filePath, funcToTest) {
  try {
    const extension = path$1.extname(filePath);
    const ast = await getAstFromFilePath$1(filePath);
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
      const prefix = this.folderStructureTree[fileIndex].line.split(path$1.basename(this.folderStructureTree[fileIndex].absolutePath))[0];
      this.folderStructureTree.splice(indexToPush, 0, {
        line: " ".repeat(prefix.length) + "└───" + funcData.functionName,
        absolutePath: filePath + ":" + funcData.functionName
      });
      if (_classPrivateFieldGet$1(this, _opts$1).spinner) {
        _classPrivateFieldGet$1(this, _opts$1).spinner.start(this.folderStructureTree, indexToPush);
      }
      const testFilePath = path$1.join(getTestFolderPath$1(filePath, this.rootPath), `/${funcData.functionName}.test${extension}`);
      if (fs$1.existsSync(testFilePath) && !this.force) {
        this.skippedFiles.push(testFilePath);
        if (_classPrivateFieldGet$1(this, _opts$1).spinner) {
          await _classPrivateFieldGet$1(this, _opts$1).spinner.stop();
        }
        this.folderStructureTree[indexToPush].line = `${green$1}${this.folderStructureTree[indexToPush].line}${reset$2}`;
        continue;
      }
      const formattedData = await _classPrivateMethodGet$1(this, _reformatDataForPythagoraAPI$1, _reformatDataForPythagoraAPI2$1).call(this, funcData, filePath, _classPrivateFieldGet$1(this, _opts$1).isSaveTests ? getTestFolderPath$1(filePath, this.rootPath) : path$1.dirname(filePath));
      const {
        tests,
        error
      } = await _classPrivateFieldGet$1(this, _API$1).getUnitTests(formattedData, content => {
        if (_classPrivateFieldGet$1(this, _opts$1).scrollableContent) {
          _classPrivateFieldGet$1(this, _opts$1).scrollableContent.setContent(content);
          _classPrivateFieldGet$1(this, _opts$1).scrollableContent.setScrollPerc(100);
        }
        if (_classPrivateFieldGet$1(this, _opts$1).screen) _classPrivateFieldGet$1(this, _opts$1).screen.render();
      });
      if (tests) {
        const testGenerated = {
          functionName: formattedData.functionName,
          filePath,
          testCode: tests
        };
        if (_classPrivateFieldGet$1(this, _opts$1).isSaveTests) {
          const testPath = await _classPrivateMethodGet$1(this, _saveTests$1, _saveTests2$1).call(this, filePath, funcData.functionName, tests);
          testGenerated.testPath = testPath;
        }
        this.testsGenerated.push(testGenerated);
        if (_classPrivateFieldGet$1(this, _opts$1).spinner) {
          await _classPrivateFieldGet$1(this, _opts$1).spinner.stop();
        }
        this.folderStructureTree[indexToPush].line = `${green$1}${this.folderStructureTree[indexToPush].line}${reset$2}`;
      } else if (error) {
        this.errors.push({
          file: filePath,
          function: funcData.functionName,
          error: {
            stack: error.stack,
            message: error.message
          }
        });
        if (_classPrivateFieldGet$1(this, _opts$1).spinner) {
          await this.spinner.stop();
        }
        this.folderStructureTree[indexToPush].line = `${red$2}${this.folderStructureTree[indexToPush].line}${reset$2}`;
      }
    }
    if (uniqueFoundFunctions.length > 0) {
      this.folderStructureTree[fileIndex].line = `${green$1 + bold$1}${this.folderStructureTree[fileIndex].line}${reset$2}`;
    }
  } catch (e) {
    if (!UnitTestsCommon$2.ignoreErrors.includes(e.code)) this.errors.push(e.stack);
  }
}
async function _reformatDataForPythagoraAPI2$1(funcData, filePath, testFilePath) {
  let relatedCode = _$2.groupBy(funcData.relatedCode, "fileName");
  // TODO add check if there are more functionNames than 1 while exportedAsObject is true - this shouldn't happen ever
  relatedCode = _$2.map(relatedCode, (value, key) => {
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
      const fileName = getRelativePath$1(file.fileName, path$1.dirname(filePath));
      let code = await stripUnrelatedFunctions(file.fileName, file.functionNames);
      const fullPath = filePath.substring(0, filePath.lastIndexOf("/")) + "/" + fileName;
      code = replaceRequirePaths$1(code, filePath, getTestFolderPath$1(filePath, this.rootPath));
      funcData.relatedCode.push({
        fileName,
        code,
        functionNames: file.functionNames,
        exportedAsObject: file.exportedAsObject,
        syntaxType: file.syntaxType,
        pathRelativeToTest: getRelativePath$1(fullPath, testFilePath)
      });
    }
  }
  funcData.functionCode = await stripUnrelatedFunctions(filePath, relatedCodeInSameFile);
  funcData.functionCode = replaceRequirePaths$1(funcData.functionCode, path$1.dirname(filePath), getTestFolderPath$1(filePath, this.rootPath));
  funcData.pathRelativeToTest = getRelativePath$1(filePath, testFilePath);
  return funcData;
}
async function _saveTests2$1(filePath, name, testData) {
  const dir = getTestFolderPath$1(filePath, this.rootPath);
  const extension = path$1.extname(filePath);
  if (!(await checkDirectoryExists$1(dir))) {
    fs$1.mkdirSync(dir, {
      recursive: true
    });
  }
  const testPath = path$1.join(dir, `/${name}.test${extension}`);
  fs$1.writeFileSync(testPath, testData);
  return testPath;
}
async function _traverseDirectoryUnit2(file, funcName) {
  if (this.processedFiles.includes(file)) {
    return;
  }
  this.processedFiles.push(file);
  if ((await checkPathType$1(file)) === "file") {
    if (!UnitTestsCommon$2.processExtensions.includes(path$1.extname(file))) {
      throw new Error("File extension is not supported");
    }
    return await _classPrivateMethodGet$1(this, _createTests, _createTests2).call(this, file, funcName);
  }
  const absolutePath = path$1.resolve(file);
  const stat = fs$1.statSync(absolutePath);
  if (!stat.isDirectory() && this.isFileToIgnore(file)) return;
  if (stat.isDirectory()) {
    if (UnitTestsCommon$2.ignoreFolders.includes(path$1.basename(absolutePath)) || path$1.basename(absolutePath).charAt(0) === ".") {
      return;
    }
    const directoryFiles = fs$1.readdirSync(absolutePath).filter(f => {
      const absoluteFilePath = path$1.join(absolutePath, f);
      const fileStat = fs$1.statSync(absoluteFilePath);
      if (fileStat.isDirectory()) {
        const baseName = path$1.basename(absoluteFilePath);
        return !UnitTestsCommon$2.ignoreFolders.includes(baseName) && !baseName.startsWith(".");
      } else {
        const ext = path$1.extname(f);
        return UnitTestsCommon$2.processExtensions.includes(ext) && !this.isFileToIgnore(f);
      }
    }).map(f => path$1.join(absolutePath, f));
    this.filesToProcess.push(...directoryFiles);
  } else {
    if (!UnitTestsCommon$2.processExtensions.includes(path$1.extname(absolutePath))) return;
    await _classPrivateMethodGet$1(this, _createTests, _createTests2).call(this, absolutePath, funcName);
  }
  while (this.filesToProcess.length > 0) {
    const nextFile = this.filesToProcess.shift();
    if (this.processedFiles.includes(nextFile)) {
      continue; // Skip processing if it has already been processed
    }

    await _classPrivateMethodGet$1(this, _traverseDirectoryUnit, _traverseDirectoryUnit2).call(this, nextFile, funcName);
  }
}
var unitTests = UnitTests$1;

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
const fs = require$$0;
const path = require$$1;
const _$1 = require$$2$1;
const {
  PYTHAGORA_UNIT_DIR
} = common$2;
const {
  checkDirectoryExists
} = common$1;
const {
  replaceRequirePaths,
  getAstFromFilePath,
  getRelatedTestImports,
  getSourceCodeFromAst,
  getModuleTypeFromFilePath
} = code;
const {
  getRelativePath,
  getTestFolderPath,
  checkPathType
} = files;
const {
  green,
  red: red$1,
  reset: reset$1
} = colors$1;
const UnitTestsCommon$1 = unitTestsCommon;
var _API = /*#__PURE__*/new WeakMap();
var _opts = /*#__PURE__*/new WeakMap();
var _saveTests = /*#__PURE__*/new WeakSet();
var _reformatDataForPythagoraAPI = /*#__PURE__*/new WeakSet();
var _createAdditionalTests = /*#__PURE__*/new WeakSet();
var _traverseDirectoryUnitExpanded = /*#__PURE__*/new WeakSet();
let UnitTestsExpand$1 = class UnitTestsExpand extends UnitTestsCommon$1 {
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
};
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
  _$1.forEach(relatedCode, f => {
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
      f.relatedFunctions = _$1.map(f.relatedFunctions, f => ({
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
      this.folderStructureTree[fileIndex].line = `${green}${this.folderStructureTree[fileIndex].line}${reset$1}`;
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
      this.folderStructureTree[fileIndex].line = `${green}${this.folderStructureTree[fileIndex].line}${reset$1}`;
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
      this.folderStructureTree[fileIndex].line = `${red$1}${this.folderStructureTree[fileIndex].line}${reset$1}`;
    }
  } catch (e) {
    if (!UnitTestsCommon$1.ignoreErrors.includes(e.code)) this.errors.push(e);
  }
}
async function _traverseDirectoryUnitExpanded2(directory, prefix = "") {
  if ((await checkPathType(directory)) === "file" && _classStaticPrivateMethodGet(UnitTestsExpand$1, UnitTestsExpand$1, _checkForTestFilePath).call(UnitTestsExpand$1, directory)) {
    const newPrefix = `|   ${prefix}|   `;
    await _classPrivateMethodGet(this, _createAdditionalTests, _createAdditionalTests2).call(this, directory, newPrefix);
    return;
  } else if ((await checkPathType(directory)) === "file" && !_classStaticPrivateMethodGet(UnitTestsExpand$1, UnitTestsExpand$1, _checkForTestFilePath).call(UnitTestsExpand$1, directory)) {
    throw new Error("Invalid test file path");
  }
  const files = fs.readdirSync(directory);
  for (const file of files) {
    const absolutePath = path.join(directory, file);
    const stat = fs.statSync(absolutePath);
    if (stat.isDirectory()) {
      if (UnitTestsCommon$1.ignoreFolders.includes(path.basename(absolutePath)) || path.basename(absolutePath).charAt(0) === ".") continue;
      await _classPrivateMethodGet(this, _traverseDirectoryUnitExpanded, _traverseDirectoryUnitExpanded2).call(this, absolutePath, prefix);
    } else {
      if (!UnitTestsCommon$1.processExtensions.includes(path.extname(absolutePath)) || !_classStaticPrivateMethodGet(UnitTestsExpand$1, UnitTestsExpand$1, _checkForTestFilePath).call(UnitTestsExpand$1, file)) continue;
      await _classPrivateMethodGet(this, _createAdditionalTests, _createAdditionalTests2).call(this, absolutePath, prefix);
    }
  }
}
var _filesEndingWith = {
  writable: true,
  value: [".js", ".ts", ".tsx"]
};
var unitTestsExpand = UnitTestsExpand$1;

/* eslint-disable no-unsafe-finally */

const _ = require$$2$1;
const axios = require$$1$2;
const {
  blue,
  red,
  reset,
  bold
} = colors$1;

/**
 * @class Api
 * @description A class to interact with the remote API.
 * @throws Will throw an error if the class is instantiated directly.
 */
class Api {
  #apiUrl;
  #apiKey;
  #apiKeyType;

  /**
   * @param {string} apiUrl - The API base url.
   * @param {string} apiKey - The API key.
   * @param {string} apiKeyType - The type of the API key. It should be 'openai' or 'pythagora'.
   * @throws Will throw an error if called directly.
   */
  constructor(apiUrl, apiKey, apiKeyType) {
    if (!apiKey) {
      console.log(`${bold + red}No API key found!${reset}`);
      console.log("Please run:");
      console.log(`${bold + blue}npx pythagora --config --pythagora-api-key <YOUR_PYTHAGORA_API_KEY>${reset}`);
      console.log("or");
      console.log(`${bold + blue}npx pythagora --config --openai-api-key <YOUR_OPENAI_API_KEY>${reset}`);
      console.log("You can get Pythagora API key here: https://mailchi.mp/f4f4d7270a7a/api-waitlist");
      process.exit(0);
    }
    if (!apiUrl || !apiKey) {
      throw new Error("Please, pass API url!");
    }
    if (apiKeyType !== "openai" && apiKeyType !== "pythagora") {
      throw new Error("API key type value must be openai or pythagora!");
    }
    this.#apiUrl = apiUrl;
    this.#apiKey = apiKey;
    this.#apiKeyType = apiKeyType;
  }

  /**
   * Prepare and set the options for the API request
   */
  setOptions({
    path,
    method,
    headers
  }) {
    const parsedUrl = new URL(this.#apiUrl);
    const options = {
      protocol: parsedUrl.protocol.replace(":", ""),
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: path || "/",
      method: method || "POST",
      headers: headers || {
        "Content-Type": "application/json",
        apikey: this.#apiKey,
        apikeytype: this.#apiKeyType
      }
    };
    if (!options.port) delete options.port;
    return options;
  }

  /**
   * Make API request
   */
  async makeRequest(data, options, customLogFunction) {
    let gptResponse = "";
    let timeout;
    const httpModule = options.protocol === "http" ? require$$3$1 : require$$4;
    return new Promise((resolve, reject) => {
      const req = httpModule.request(_.omit(options, ["protocol"]), function (res) {
        res.on("data", chunk => {
          try {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
              reject(new Error("Request timeout"));
            }, 30000);
            const stringified = chunk.toString();
            try {
              const json = JSON.parse(stringified);
              if (json.error || json.message) {
                gptResponse = json;
                return;
              }
            } catch (e) {}
            gptResponse += stringified;
            if (customLogFunction) customLogFunction(gptResponse);else process.stdout.write(stringified);
          } catch (e) {}
        });
        res.on("end", async function () {
          clearTimeout(timeout);
          process.stdout.write("\n");
          if (res.statusCode >= 400) return reject(new Error(`Response status code: ${res.statusCode}. Error message: ${gptResponse}`));
          if (gptResponse.error) return reject(new Error(`Error: ${gptResponse.error.message}. Code: ${gptResponse.error.code}`));
          if (gptResponse.message) return reject(new Error(`Error: ${gptResponse.message}. Code: ${gptResponse.code}`));
          gptResponse = gptResponse.split("pythagora_end:").pop();
          return resolve(gptResponse);
        });
      });
      req.on("error", e => {
        clearTimeout(timeout);
        console.error("problem with request:" + e.message);
        reject(e);
      });
      req.write(data);
      req.end();
    });
  }
  async getUnitTests(data, customLogFunction) {
    const options = this.setOptions({
      path: "/api/generate-unit-tests"
    });
    let tests, error;
    try {
      tests = await this.makeRequest(JSON.stringify(data), options, customLogFunction);
    } catch (e) {
      error = e;
    } finally {
      return {
        tests,
        error
      };
    }
  }
  async expandUnitTests(data, customLogFunction) {
    const options = this.setOptions({
      path: "/api/expand-unit-tests"
    });
    let tests, error;
    try {
      tests = await this.makeRequest(JSON.stringify(data), options, customLogFunction);
    } catch (e) {
      error = e;
    } finally {
      return {
        tests,
        error
      };
    }
  }
  async getJestAuthFunction(loginMongoQueriesArray, loginRequestBody, loginEndpointPath) {
    const options = this.setOptions({
      path: "/api/generate-jest-auth"
    });
    return this.makeRequest(JSON.stringify({
      loginMongoQueriesArray,
      loginRequestBody,
      loginEndpointPath
    }), options);
  }

  /**
   * Generate jest test
   */
  async getJestTest(test) {
    const options = this.setOptions({
      path: "/api/generate-jest-test"
    });
    return this.makeRequest(JSON.stringify(test), options);
  }

  /**
   * Generate jest test name
   */
  async getJestTestName(test, usedNames) {
    const options = this.setOptions({
      path: "/api/generate-jest-test-name"
    });
    return this.makeRequest(JSON.stringify({
      test
    }), options);
  }

  /**
   * Check if the test is eligible for export
   */
  async isEligibleForExport(test) {
    try {
      const options = this.setOptions({
        path: "/api/check-if-eligible"
      });
      const response = await axios.post(`${options.protocol}://${options.hostname}${options.port ? ":" + options.port : ""}${options.path}`, JSON.stringify({
        test
      }), {
        headers: options.headers
      });
      return response.data;
    } catch (error) {
      console.log(error);
      return false;
    }
  }
}
var apiClass = Api;

const UnitTestsCommon = unitTestsCommon;
const UnitTests = unitTests;
const UnitTestsExpand = unitTestsExpand;
const API = apiClass;
const codeUtils = code;
const filesUtils = files;
const commonUtils = common$1;
const colors = colors$1;
const common = common$2;
var src = {
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

var index = /*@__PURE__*/getDefaultExportFromCjs(src);

module.exports = index;
