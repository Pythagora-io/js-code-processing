const _ = require('lodash');
const axios = require('axios');

const instantiationToken = Symbol();

/**
 * @class Api
 * @description A class to interact with the remote API.
 * @throws Will throw an error if the class is instantiated directly.
 */
class Api {
  static #client;
  #apiUrl;
  #apiKey;
  #apiKeyType;

  /**
   * @constructor
   * @description The constructor is private to implement the singleton design pattern.
   * @param {string} apiUrl - The API base url.
   * @param {string} apiKey - The API key.
   * @param {string} apiKeyType - The type of the API key. It should be 'openai' or 'pythagora'.
   * @param {symbol} token - A special symbol used to prevent direct class instantiation.
   * @throws Will throw an error if called directly.
   */
  constructor(apiUrl, apiKey, apiKeyType, token) {
    if (token !== instantiationToken) {
      throw new Error('PrivateConstructor is not constructable. Use Api.make().');
    }

    if (!apiUrl || !apiKey) {
      throw new Error('Pass API url and API key');
    }

    if (apiKeyType !== 'openai' && apiKeyType !== 'pythagora') {
      throw new Error('API key type value must be openai or pythagora');
    }

    this.#apiUrl = apiUrl;
    this.#apiKey = apiKey;
    this.#apiKeyType = apiKeyType;
  }
  
  /**
   * @method make
   * @description Static method used to create an instance of the Api class.
   * @param {string} apiUrl - The API base url.
   * @param {string} apiKey - The API key.
   * @param {string} apiKeyType - The type of the API key. It should be 'openai' or 'pythagora'.
   * @returns {Api} An instance of the Api class.
   */
  static make(apiUrl, apiKey, apiKeyType) {
    if (!Api.#client) {
      Api.#client = new Api(apiUrl, apiKey, apiKeyType, instantiationToken)
    }

    return Api.#client;
  }

  /**
   * Prepare and set the options for the API request
   */
  setOptions({path, method, headers}) {
    const parsedUrl = new URL(this.#apiUrl);
    let options = {
      protocol: parsedUrl.protocol.replace(':', ''),
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: path || '/',
      method: method || 'POST',
      headers: headers || {
        'Content-Type': 'application/json',
        'apikey': this.#apiKey,
        'apikeytype': this.#apiKeyType
      },
    };

    if (!options.port) delete options.port;
    return options
  }

  /**
   * Make API request
   */
  async makeRequest(data, options, customLogFunction) {
    let gptResponse = '';
    let httpModule = options.protocol === 'http' ? require('http') : require('https');

    return new Promise((resolve, reject) => {
      const req = httpModule.request(_.omit(options, ['protocol']), function (res) {
        res.on('data', (chunk) => {
          try {
            let stringified = chunk.toString();
            try {
              let json = JSON.parse(stringified);
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
        res.on('end', async function () {
          process.stdout.write('\n');
          if (res.statusCode >= 400) return reject(new Error(`Response status code: ${res.statusCode}. Error message: ${gptResponse}`));
          if (gptResponse.error) return reject(new Error(`Error: ${gptResponse.error.message}. Code: ${gptResponse.error.code}`));
          if (gptResponse.message) return reject(new Error(`Error: ${gptResponse.message}. Code: ${gptResponse.code}`));
          gptResponse = gptResponse.split('pythagora_end:').pop();
          return resolve(gptResponse);
        });
      });

      req.on('error', (e) => {
        console.error("problem with request:" + e.message);
        reject(e);
      });

      req.write(data);

      req.end();
    });
  }

  async getUnitTests(data, customLogFunction) {
    const options = setOptions({path: '/api/generate-unit-tests'});
    let tests, error;
    try {
      tests = await makeRequest(JSON.stringify(data), options, customLogFunction);
    } catch (e) {
      error = e;
    } finally {
      return {tests, error};
    }
  }

  async expandUnitTests(data, customLogFunction) {
    const options = setOptions({path: '/api/expand-unit-tests'});
    let tests, error;
    try {
      tests = await makeRequest(JSON.stringify(data), options, customLogFunction);
    } catch (e) {
      error = e;
    } finally {
      return {tests, error};
    }
  }

  async getJestAuthFunction(loginMongoQueriesArray, loginRequestBody, loginEndpointPath) {
    const options = setOptions({path: '/api/generate-jest-auth'});
    return makeRequest(JSON.stringify({loginMongoQueriesArray, loginRequestBody, loginEndpointPath}), options);
  }

  /**
   * Generate jest test
   */
  async getJestTest(test) {
    const options = setOptions({path: '/api/generate-jest-test'});
    return makeRequest(JSON.stringify(test), options);
  }

  /**
   * Generate jest test name
   */
  async getJestTestName(test, usedNames) {
    const options = setOptions({path: '/api/generate-jest-test-name'});
    return makeRequest(JSON.stringify({test}), options);
  }

  /**
   * Check if the test is eligible for export
   */
  async isEligibleForExport(test) {
    try {
      const options = setOptions({path: '/api/check-if-eligible'});

      const response = await axios.post(
        `${options.protocol}://${options.hostname}${options.port ? ':' + options.port : ''}${options.path}`,
        JSON.stringify({test}),
        {headers: options.headers}
      );

      return response.data;
    } catch (error) {
      console.log(error);
      return false;
    }
  }
}

module.exports = Api;