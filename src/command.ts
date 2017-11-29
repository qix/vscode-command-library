import * as vscode from "vscode";
import * as invariant from "invariant";

import { textEditorFromVSCode } from "./vscode/textEditor";

Object.keys(require.cache).forEach(name => {
  if (name.startsWith("/home/josh/code/command-library/out")) {
    delete require.cache[name];
  }
});

import { IncrementNumberAction } from "./actions";
import { Position, Selection, Range, TextEditor } from "./editor";

function nextLetterPosition(editor, pos, letter) {
  const line = editor.document.lineAt(pos);
  const remaining = line.text.substring(pos.character + 1);
  const index = remaining.indexOf(letter);
  if (index < 0) {
    return null;
  }
  return editor.position(pos.line, pos.character + index + 1);
}

function forwardPosition(editor: TextEditor, pos: Position, movement) {
  if (movement.count && movement.count > 1) {
    const next = forwardPosition(
      editor,
      pos,
      Object.assign({}, movement, {
        willRepeat: true,
        count: 1
      })
    );
    if (next.isEqual(pos)) {
      return pos;
    } else {
      const final = forwardPosition(
        editor,
        next,
        Object.assign({}, movement, { count: movement.count - 1 })
      );

      if (final.isEqual(next)) {
        return forwardPosition(
          editor,
          pos,
          Object.assign({}, movement, { count: 1 })
        );
      } else {
        return final;
      }
    }
  }
  if (movement.type === "letter") {
    return nextLetterPosition(editor, pos, movement.letter) || pos;
  } else if (movement.type === "line" && movement.modifier === "end") {
    const line = editor.document.lineAt(pos);
    return pos.with(undefined, line.text.length);
  } else if (movement.type === "line" && movement.modifier === "start") {
    return pos.with(undefined, 0);
  } else if (movement.type === "direction") {
    if (movement.direction === "up") {
      return pos.getUpByCount(1);
    } else if (movement.direction === "down") {
      return pos.getDownByCount(1);
    } else if (movement.direction === "left") {
      return pos.getLeftThroughLineBreaks();
    } else if (movement.direction === "right") {
      return pos.getRightThroughLineBreaks();
    } else {
      throw new Error("Unknown direction");
    }
  } else if (movement.type === "afterLetter") {
    const next = nextLetterPosition(editor, pos, movement.letter);
    if (next) {
      return next.translate(0, movement.willRepeat ? 0 : 1);
    } else {
      return pos;
    }
  } else if (movement.type === "word") {
    if (movement.modifier === "left") {
      return pos.getWordLeft();
    }
    return pos.getWordRight();
    /*
    const range = editor.document.getWordRangeAtPosition(pos);
    const line = editor.document.lineAt(pos).text;

    let wordEnd = range ? range.end : pos;

    // If we are repeating or not only selecting inside
    if (movement.willRepeat || !movement.inside) {
      while (wordEnd.character < line.length) {
        wordEnd = wordEnd.translate(0, 1);
        if (editor.document.getWordRangeAtPosition(wordEnd)) {
          break;
        }
      }
    }

    return wordEnd;*/
  } else {
    throw new Error(`Unknown movement: ${movement.type}`);
  }
}

function movementRange(editor: TextEditor, pos: Position, movement): Range {
  if (movement.type === "line" && movement.modifier === "down") {
    const start = pos.getLineBegin();
    if (movement.count && movement.count > 1) {
      pos = pos.getDownByCount(movement.count - 1);
    }
    return new Range(start, pos.getNextLineBegin());
  } else if (movement.type === "line" && movement.modifier === "up") {
    const end = pos.getNextLineBegin();
    if (movement.count && movement.count > 1) {
      pos = pos.getUpByCount(movement.count - 1);
    }
    return new Range(pos.getLineBegin(), end);
  }
  return new Range(pos, forwardPosition(editor, pos, movement));
}

function movementPositions(editor: TextEditor, movement): Array<Position> {
  const positions = editor.selections.map(s => s.active);
  return positions.map(pos => {
    return forwardPosition(editor, pos, movement);
  });
}

function movementRanges(editor: TextEditor, movement) {
  const positions = editor.selections.map(s => s.active);
  return positions.map(pos => movementRange(editor, pos, movement));
}

function movementSelections(editor: TextEditor, movement): Array<Selection> {
  return editor.selections.map(sel => {
    const range: Range = movementRange(editor, sel.active, movement);
    let [start, end] = [sel.active, sel.anchor];
    if (sel.isReversed) {
      [start, end] = [end, start];
    }

    if (start.isAfter(range.start)) {
      start = range.start;
    }
    if (range.end.isAfter(end)) {
      end = range.end;
    }
    return new Selection(start, end);
  });
}

const editorCommandHandlers: {
  [key: string]: (TextEditor, Object) => Promise<TextEditor>;
} = {
  async move(editor, { movement }) {
    return editor.withSelections(
      movementPositions(editor, movement).map(pos => {
        return new Selection(pos, pos);
      })
    );
  },
  async select(editor, { movement }) {
    return editor.withSelections(movementSelections(editor, movement));
  },

  async cursor(editor, { cursors, action }) {
    const selections = editor.selections;

    const chosen = selections.map(v => false);
    cursors.map(cursorRequest => {
      const cursor =
        cursorRequest + (cursorRequest < 0 ? selections.length : 0);
      if (cursor < 0 || cursor >= selections.length) {
        console.error("Invalid cursor: %j", cursorRequest);
      } else {
        chosen[cursor] = true;
      }
    });

    const editSelections = selections.filter((sel, idx) => chosen[idx]);
    if (!editSelections.length) {
      return editor;
    }

    editor = editor.withSelections(editSelections);
    return editorCommandHandlers[action.command](editor, action).then(
      result => {
        const resultSelections = [...result.selections];
        const finalSelections = selections.map((sel, idx) => {
          return chosen[idx] ? resultSelections.pop() : sel;
        });
        return editor.withSelections(finalSelections);
      }
    );
  },

  async copy(editor: TextEditor, { movement }) {
    const originalSelections = editor.selections;
    return editorCommandHandlers
      .select(editor, { movement })
      .then(async (editor: TextEditor) => {
        await editor.command("editor.action.clipboardCopyAction");
        return editor.withSelections(originalSelections);
      });
  },

  async delete(editor: TextEditor, { movement }) {
    let selections: Array<Selection>;
    return editor
      .edit(edits => {
        selections = editor.selections.map(selection => {
          const range = movementRange(editor, selection.active, movement);
          edits.delete(range);
          if (range.contains(selection.active)) {
            const pos = range.start;
            return new Selection(pos, pos);
          } else {
            return selection;
          }
        });
      })
      .then(() => {
        return editor.withSelections(selections);
      });
  }
  /*  
  async increment(editor) {
    const action: IncrementNumberAction = new IncrementNumberAction();

    const position = Position.FromVSCode(
      vscode.window.activeTextEditor.selection.start
    );
    await action.exec(position, editor);
  }*/
};

const commandHandlers: {
  [key: string]: (Object) => Promise<any>;
} = {
  async commands({ commands }) {
    for (let command of commands) {
      vscode.commands.executeCommand(command.command, command.args || {});
    }
  }
};

Object.entries(editorCommandHandlers).forEach(([name, cb]) => {
  commandHandlers[name] = async args => {
    if (vscode.window.activeTextEditor) {
      let editor: TextEditor = textEditorFromVSCode(
        vscode.window.activeTextEditor
      );
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
