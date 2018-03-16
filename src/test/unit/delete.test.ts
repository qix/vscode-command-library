import * as invariant from "invariant";
import { MockTextEditor } from "../lib/MockTextEditor";
import {
  setActiveTextEditor,
  getActiveTextEditor
} from "../../activeTextEditor";
import editorCommands from "../../commands/editor";
import { TextEditor, Selection, Position } from "../../editor";

let editor: MockTextEditor;

function movement(str) {
  if (str === "w") {
    return { type: "word" };
  } else {
    return "unknown movement";
  }
}

const selections = (sel: Array<Selection>): void => {
  editor.withSelections(sel);
};
const position = (pos: Position) => selections([new Selection(pos, pos)]);
const top = () => position(new Position(0, 0));

function setupTest(text: string) {
  const selections: Array<Selection> = [];

  const lines = text.split("\n");
  for (let idx = lines.length - 1; idx >= 0; idx--) {
    let char = lines[idx].lastIndexOf("|");
    while (char >= 0) {
      selections.unshift(new Selection(new Position(idx, char)));
      lines[idx] =
        lines[idx].substring(0, char) + lines[idx].substring(char + 1);
      char = lines[idx].lastIndexOf("|");
    }
  }
  if (!selections.length) {
    selections.push(new Selection(new Position(0, 0)));
  }
  editor = new MockTextEditor(lines.join("\n"), selections);
  setActiveTextEditor(editor);
}

function word(count = 1) {
  let modifier = null;
  if (count < 0) {
    count = Math.abs(count);
    modifier = "left";
  }
  return {
    type: "word",
    count,
    modifier
  };
}

function until(letter, count = 1) {
  return {
    type: "letter",
    letter,
    count
  };
}

function cursorCmd(cursors: Array<number>, action: any) {
  return {
    command: "cursor",
    cursors,
    action
  };
}

function cmd(command: string, args?: any) {
  return { command, ...(args || {}) };
}
function movementCmd(command: string, movement: any) {
  return { command, movement };
}
const moveCmd = movementCmd.bind(null, "move");
const selectCmd = movementCmd.bind(null, "select");
const deleteCmd = movementCmd.bind(null, "delete");
const copyCmd = movementCmd.bind(null, "copy");

async function expectAfter(command: any) {
  invariant(
    editorCommands.hasOwnProperty(command.command),
    "Unknown command: %s",
    command.command
  );
  await editorCommands[command.command](editor, command);
  return expect(editor.renderAsString());
}

test("word movement", async () => {
  setupTest("hello world how are you");
  (await expectAfter(moveCmd(word(+0)))).toEqual("|hello world how are you");
  (await expectAfter(moveCmd(word(+1)))).toEqual("hello |world how are you");
  (await expectAfter(moveCmd(word(+2)))).toEqual("hello world how |are you");
  (await expectAfter(moveCmd(word(+1)))).toEqual("hello world how are |you");
  (await expectAfter(moveCmd(word(+1)))).toEqual("hello world how are you|");
  (await expectAfter(moveCmd(word(-3)))).toEqual("hello world |how are you");
});

test("letter movement", async () => {
  setupTest("hello world how are you\nsecond li");

  (await expectAfter(moveCmd(until("o", +1)))).toEqual(
    "hell|o world how are you\nsecond li"
  );
  (await expectAfter(moveCmd(until("o", +1)))).toEqual(
    "hello w|orld how are you\nsecond li"
  );
  (await expectAfter(moveCmd(until("o", +1)))).toEqual(
    "hello world h|ow are you\nsecond li"
  );
  (await expectAfter(moveCmd(until("o", +1)))).toEqual(
    "hello world how are y|ou\nsecond li"
  );
  (await expectAfter(moveCmd(until("o", +2)))).toEqual(
    "hello world how are y|ou\nsecond li"
  );
  (await expectAfter(moveCmd(until("o", -2)))).toEqual(
    "hello w|orld how are you\nsecond li"
  );
  (await expectAfter(moveCmd(until("o", -3)))).toEqual(
    "hell|o world how are you\nsecond li"
  );
  (await expectAfter(moveCmd(until("o", +9)))).toEqual(
    "hello world how are y|ou\nsecond li"
  );
  (await expectAfter(moveCmd(until("o", -1)))).toEqual(
    "hello world h|ow are you\nsecond li"
  );
});

test("word select", async () => {
  setupTest("hello world how are you");

  (await expectAfter(selectCmd(word(0)))).toEqual("|hello world how are you");
  (await expectAfter(selectCmd(word(1)))).toEqual("<hello |>world how are you");
  //(await expectAfter(selectCmd(word(1)))).toEqual("<hello world|> how are you");
});

test("word delete", async () => {
  setupTest("hello world how are you");

  (await expectAfter(deleteCmd(word(0)))).toEqual("|hello world how are you");
  (await expectAfter(deleteCmd(word(1)))).toEqual("|world how are you");
  (await expectAfter(deleteCmd(word(2)))).toEqual("|are you");
});

test("increment", async () => {
  setupTest("hey 54\ni am 23.5");
  (await expectAfter(cmd("increment"))).toEqual("hey |55\ni am 23.5");
  (await expectAfter(cmd("increment"))).toEqual("hey |56\ni am 23.5");
});

test("multi-cursor", async () => {
  setupTest("\n|line one\n|another longer line\nthird| line\nlast line|");
  (await expectAfter(moveCmd(word(+0)))).toEqual(`
|line one
|another longer line
third| line
last line|`);

  (await expectAfter(moveCmd(word(+1)))).toEqual(`
line |one
another |longer line
third |line
last line|`);

  (await expectAfter(moveCmd(word(+1)))).toEqual(`
line one
|another longer |line
third line
|last line|`);

  (await expectAfter(moveCmd(word(+2)))).toEqual(`
line one
another longer |line
third |line
last line|`);

  (await expectAfter(moveCmd(word(+10)))).toEqual(`
line one
another longer line
third line
last line|`);
});

test("selected cursor move", async () => {
  setupTest("\n|line one\n|another longer line\nthird| line\nlast line|");
  (await expectAfter(moveCmd(word(+0)))).toEqual(`
|line one
|another longer line
third| line
last line|`);

  (await expectAfter(cursorCmd([1, 2], moveCmd(word(+1))))).toEqual(`
|line one
another |longer line
third |line
last line|`);
});

test("selected cursor select", async () => {
  setupTest("\n|line one\n|another longer line\nthird| line\nlast line|");
  (await expectAfter(moveCmd(word(+0)))).toEqual(`
|line one
|another longer line
third| line
last line|`);

  (await expectAfter(cursorCmd([1], selectCmd(word(+1))))).toEqual(`
|line one
<another |>longer line
third| line
last line|`);
});
