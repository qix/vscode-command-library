Object.keys(require.cache).forEach(name => {
  if (name.startsWith("/home/josh/code/command-library/out")) {
    delete require.cache[name];
  }
});

import * as vscode from "vscode";
import * as invariant from "invariant";
import { textEditorFromVSCode } from "./vscode/textEditor";
import { IncrementNumberAction } from "./actions";
import { Position, Selection, Range, TextEditor } from "./editor";
import { setActiveTextEditor } from "./activeTextEditor";
import { commands as editorCommands } from "./commands/editor";

const commandHandlers: {
  [key: string]: (Object) => Promise<any>;
} = {
  async commands({ commands }) {
    for (let command of commands) {
      vscode.commands.executeCommand(command.command, command.args || {});
    }
  }
};

Object.entries(editorCommands).forEach(([name, cb]) => {
  commandHandlers[name] = async args => {
    if (vscode.window.activeTextEditor) {
      let editor: TextEditor = textEditorFromVSCode(
        vscode.window.activeTextEditor
      );
      setActiveTextEditor(editor);
      await cb(editor, args);
    }
  };
});

export async function execute(args: any): Promise<boolean> {
  if (!commandHandlers.hasOwnProperty(args.command)) {
    vscode.window.showErrorMessage(`Unknown command: ${args.command}`);
    return false;
  }
  try {
    await commandHandlers[args.command](args);
    return true;
  } catch (err) {
    vscode.window.showErrorMessage(err.toString());
    console.error(err.stack);
    return false;
  }
}
