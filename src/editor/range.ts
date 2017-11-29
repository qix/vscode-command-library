import * as invariant from "invariant";
import * as vscode from "vscode";
import { Position } from "./position";
import { TextEditor } from "./textEditor";

export class Range extends vscode.Range {
  start: Position;
  end: Position;

  constructor(start: Position, end: Position) {
    invariant(start.editor === end.editor, "Editors did not match");
    super(start, end);
  }
}
