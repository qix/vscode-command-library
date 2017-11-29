import * as vscode from "vscode";
import * as invariant from "invariant";

Object.keys(require.cache).forEach(name => {
  if (name.startsWith("/home/josh/code/command-library/out")) {
    delete require.cache[name];
  }
});

import { execute } from "./command";

exports.execute = async function(commandArgs) {
  const args = commandArgs.arguments[0];
  return execute(args);
};
