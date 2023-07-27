const {
    replaceRequirePaths,
    getAstFromFilePath,
    collectTopRequires,
    insideFunctionOrMethod,
    getRelatedFunctions,
    stripUnrelatedFunctions,
    processAst,
    getModuleTypeFromFilePath
} = require("./utils/code");
const { getRelativePath } = require("./utils/files");

module.exports = {
    getRelativePath,
    replaceRequirePaths,
    getAstFromFilePath,
    collectTopRequires,
    insideFunctionOrMethod,
    getRelatedFunctions,
    stripUnrelatedFunctions,
    processAst,
    getModuleTypeFromFilePath
}