/* eslint-disable no-unsafe-finally */
const _ = require("lodash");
const axios = require("axios");
const { blue, red, reset, bold } = require("../const/colors");

/**
 * @class Api
 * @description A class to interact with the remote API.
 * @throws Will throw an error if the class is instantiated directly.
 */
class Api {
  apiUrl;
  apiKey;
  apiKeyType;

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
      console.log(
        `${
          bold + blue
        }npx pythagora --config --pythagora-api-key <YOUR_PYTHAGORA_API_KEY>${reset}`
      );
      console.log("or");
      console.log(
        `${
          bold + blue
        }npx pythagora --config --openai-api-key <YOUR_OPENAI_API_KEY>${reset}`
      );
      console.log(
        `You can get Pythagora API key here: https://mailchi.mp/f4f4d7270a7a/api-waitlist`
      );
      process.exit(0);
    }
    
    if (!apiUrl || !apiKey) {
      throw new Error("Please, pass API url!");
    }

    if (apiKeyType !== "openai" && apiKeyType !== "pythagora") {
      throw new Error("API key type value must be openai or pythagora!");
    }

    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
    this.apiKeyType = apiKeyType;
  }

  /**
   * Prepare and set the options for the API request
   */
  setOptions({ path, method, headers }) {
    const parsedUrl = new URL(this.apiUrl);
    const options = {
      protocol: parsedUrl.protocol.replace(":", ""),
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: path || "/",
      method: method || "POST",
      headers: headers || {
        "Content-Type": "application/json",
        apikey: this.apiKey,
        apikeytype: this.apiKeyType
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
    const httpModule = options.protocol === "http" ? require("http") : require("https");

    return new Promise((resolve, reject) => {
      const req = httpModule.request(_.omit(options, ["protocol"]), function (res) {
        res.on("data", (chunk) => {
          try {
            const stringified = chunk.toString();
            try {
              const json = JSON.parse(stringified);
              if (json.error || json.message) {
                gptResponse = json;
                return;
              }
            } catch (e) { }

            gptResponse += stringified;
            if (customLogFunction) customLogFunction(gptResponse);
            else process.stdout.write(stringified);
          } catch (e) { }
        });
        res.on("end", async function () {
          process.stdout.write("\n");
          if (res.statusCode >= 400) return reject(new Error(`Response status code: ${res.statusCode}. Error message: ${gptResponse}`));
          if (gptResponse.error) return reject(new Error(`Error: ${gptResponse.error.message}. Code: ${gptResponse.error.code}`));
          if (gptResponse.message) return reject(new Error(`Error: ${gptResponse.message}. Code: ${gptResponse.code}`));
          gptResponse = gptResponse.split("pythagora_end:").pop();
          return resolve(gptResponse);
        });
      });

      req.on("error", (e) => {
        console.error("problem with request:" + e.message);
        reject(e);
      });

      req.write(data);

      req.end();
    });
  }

  async getUnitTests(data, customLogFunction) {
    const options = this.setOptions({ path: "/api/generate-unit-tests" });
    let tests, error;
    try {
      tests = await this.makeRequest(JSON.stringify(data), options, customLogFunction);
    } catch (e) {
      error = e;
    } finally {
      return { tests, error };
    }
  }

  async expandUnitTests(data, customLogFunction) {
    const options = this.setOptions({ path: "/api/expand-unit-tests" });
    let tests, error;
    try {
      tests = await this.makeRequest(JSON.stringify(data), options, customLogFunction);
    } catch (e) {
      error = e;
    } finally {
      return { tests, error };
    }
  }

  async getJestAuthFunction(loginMongoQueriesArray, loginRequestBody, loginEndpointPath) {
    const options = this.setOptions({ path: "/api/generate-jest-auth" });
    return this.makeRequest(JSON.stringify({ loginMongoQueriesArray, loginRequestBody, loginEndpointPath }), options);
  }

  /**
   * Generate jest test
   */
  async getJestTest(test) {
    const options = this.setOptions({ path: "/api/generate-jest-test" });
    return this.makeRequest(JSON.stringify(test), options);
  }

  /**
   * Generate jest test name
   */
  async getJestTestName(test, usedNames) {
    const options = this.setOptions({ path: "/api/generate-jest-test-name" });
    return this.makeRequest(JSON.stringify({ test }), options);
  }

  /**
   * Check if the test is eligible for export
   */
  async isEligibleForExport(test) {
    try {
      const options = this.setOptions({ path: "/api/check-if-eligible" });

      const response = await axios.post(
        `${options.protocol}://${options.hostname}${options.port ? ":" + options.port : ""}${options.path}`,
        JSON.stringify({ test }),
        { headers: options.headers }
      );

      return response.data;
    } catch (error) {
      console.log(error);
      return false;
    }
  }
}

module.exports = Api;
