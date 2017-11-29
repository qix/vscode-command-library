import * as vscode from "vscode";
import { Position } from "./position";
import { TextEditor } from "./textEditor";

export class Selection extends vscode.Selection {
  active: Position;
  anchor: Position;

  constructor(editor: TextEditor, anchor: Position, active: Position) {
    super(anchor, active);
  }
}
