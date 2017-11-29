"use strict";
import * as vscode from "vscode";
import { execute } from "./command";

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand(
    "pegvoice.commander",
    args => {
      return execute(args);
    }
  );

  context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
