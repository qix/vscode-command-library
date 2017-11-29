import * as vscode from "vscode";
import { Position } from "./position";
import { TextEditor } from "./textEditor";

export class Range extends vscode.Range {
  start: Position;
  end: Position;

  constructor(editor: TextEditor, start: Position, end: Position) {
    super(start, end);
  }
}
