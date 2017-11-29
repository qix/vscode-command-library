import { TextEditor } from "../editor";
import * as fs from "fs";
import * as os from "os";
import * as assert from "assert";
import * as vscode from "vscode";
import { join } from "path";

function rndName() {
  return Math.random()
    .toString(36)
    .replace(/[^a-z]+/g, "")
    .substr(0, 10);
}

async function createRandomFile(
  contents: string,
  fileExtension: string
): Promise<vscode.Uri> {
  const tmpFile = join(os.tmpdir(), rndName() + fileExtension);

  try {
    fs.writeFileSync(tmpFile, contents);
    return vscode.Uri.file(tmpFile);
  } catch (error) {
    throw error;
  }
}

export async function setupWorkspace(fileExtension: string = ""): Promise<any> {
  const file = await createRandomFile("", fileExtension);
  const doc = await vscode.workspace.openTextDocument(file);

  await vscode.window.showTextDocument(doc);
  setTextEditorOptions(2, true);

  assert.ok(vscode.window.activeTextEditor);
}

export function setTextEditorOptions(
  tabSize: number,
  insertSpaces: boolean
): void {
  let options = vscode.window.activeTextEditor!.options;
  options.tabSize = tabSize;
  options.insertSpaces = insertSpaces;
  vscode.window.activeTextEditor!.options = options;
}
