import * as vscode from "vscode";
import * as invariant from "invariant";
import { Position } from "./position";
import { TextEditor } from "./textEditor";

export class Selection extends vscode.Selection {
  active: Position;
  anchor: Position;

  constructor(anchor: Position, active: Position) {
    invariant(anchor.editor === active.editor, "Editors did not match");
    super(anchor, active);
  }

  get start(): Position {
    return Position.EarlierOf(this.active, this.anchor);
  }
  get end(): Position {
    return Position.LaterOf(this.active, this.anchor);
  }
}
