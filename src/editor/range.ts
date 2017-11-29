import * as invariant from "invariant";
import { Range as CoreRange } from "../core/range";
import { Position } from "./position";
import { TextEditor } from "./textEditor";

export class Range extends CoreRange {
  start: Position;
  end: Position;

  constructor(start: Position, end: Position) {
    invariant(start.editor === end.editor, "Editors did not match");
    super(start.line, start.character, end.line, end.character);
  }
}
