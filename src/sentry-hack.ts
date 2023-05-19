/* eslint-disable */
// noinspection JSUnusedGlobalSymbols,ES6ConvertVarToLetConst

// This allows TypeScript to detect our global value
global.__rootdir__ = __dirname || process.cwd()

declare global {
  var __rootdir__: string
}

export {}
