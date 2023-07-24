const path = require("path");

function getRelativePath(filePath, referenceFolderPath) {
    let relativePath = path.relative(path.resolve(referenceFolderPath), filePath);
    if (!relativePath.startsWith('../') && !relativePath.startsWith('./')) {
        relativePath = './' + relativePath;
    }
    return relativePath;
}

module.exports = { getRelativePath };