const {
    replaceRequirePaths,
    getAstFromFilePath,
    collectTopRequires,
    insideFunctionOrMethod,
    getRelatedFunctions,
    stripUnrelatedFunctions,
    processAst,
    getModuleTypeFromFilePath
} = require("./code");
const { getRelativePath } = require("./files");

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