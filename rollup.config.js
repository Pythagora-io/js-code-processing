const { nodeResolve } = require("@rollup/plugin-node-resolve");
const commonJs = require("@rollup/plugin-commonjs");
const json = require("@rollup/plugin-json");
const babel = require("@rollup/plugin-babel");

module.exports = {
  input: "src/index.js",
  output: {
    file: "build/index.js",
    format: "cjs"
  },
  external: [/node_modules/],
  sourceMap: true,
  plugins: [
    babel({ babelHelpers: "inline" }),
    commonJs(),
    json(),
    nodeResolve()
  ]
};
