import * as invariant from "invariant";
import { Selection as CoreSelection } from "../core/selection";
import { Position } from "./position";
import { TextEditor } from "./textEditor";

export class Selection extends CoreSelection {
  active: Position;
  anchor: Position;
  editor: TextEditor;

  get active(): Position {
    return Position.FromCore(this.editor, super().active);
  }

  constructor(editor: TextEditor, anchor: Position, active: Position) {
    super(anchor, active);
    this.editor = editor;
  }

  FromCore(editor: TextEditor, selection: CoreSelection): Selection {
    return new Selection(
      editor,
      Position.FromCore(editor, selection.anchor),
      Position.FromCore(editor, selection.active)
    );
  }

  get start(): Position {
    return Position.EarlierOf(this.active, this.anchor);
  }
  get end(): Position {
    return Position.LaterOf(this.active, this.anchor);
  }
}
