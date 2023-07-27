const fs = require("fs");

async function checkDirectoryExists(directoryPath) {
    try {
        const stats = await fs.promises.stat(directoryPath);
        return stats.isDirectory();
    } catch (error) {
        if (error.code === 'ENOENT') {
            // Directory does not exist
            return false;
        }
        // Other error occurred
        throw error;
    }
}

module.exports = {
    checkDirectoryExists
}
