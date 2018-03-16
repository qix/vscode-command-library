import {
  ITextEditor,
  ITextEditorEdit,
  ITextLine,
  ITextDocument,
  ITextOptions,
  TextEditor
} from "../../editor/textEditor";
import { Position, Range, Selection } from "../../editor";
import { TextEditorEdit } from "../../editor/textEditorEdit";

class MockTextLine implements ITextLine {
  firstNonWhitespaceCharacterIndex: number;
  isEmptyOrWhitespace: boolean;
  lineNumber: number;
  range: Range;
  rangeIncludingLineBreak: Range;
  text: string;

  constructor(text: string) {
    this.text = text;
  }
}

class MockTextDocument implements ITextDocument {
  fileName: string;
  isClosed: boolean;
  isDirty: boolean;
  isUntitled: boolean;
  languageId: string;
  version: number;

  _text: string;

  constructor(text: string) {
    this.fileName = "sample.txt";
    this.isClosed = false;
    this.isDirty = false;
    this.isUntitled = false;
    this.languageId = "text";

    this._text = text;
  }

  get lineCount(): number {
    return this._text.split("\n").length;
  }
  getText(range?: Range): string {
    return this._text;
  }
  getWordRangeAtPosition(
    position: Position,
    regex?: RegExp
  ): Range | undefined {
    return;
  }
  lineAt(pos: number | Position): MockTextLine {
    if (pos instanceof Position) {
      pos = pos.line;
    }
    const lines = this._text.split("\n");
    return new MockTextLine(lines[pos]);
  }
  offsetAt(position: Position): number {
    return 0;
  }
  positionAt(offset: number): Position {
    return;
  }
  async save(): Promise<boolean> {
    return true;
  }
  validatePosition(position: Position): Position {
    return position;
  }
  validateRange(range: Range): Range {
    return range;
  }

  // Additional api
  get lines(): Array<string> {
    return this._text.split("\n");
  }
  replace(range: Range, text: string) {
    this._text = this.lines
      .map((line, idx) => {
        const eol = idx === this.lines.length - 1 ? "" : "\n";
        let prefix = "";
        if (idx === range.start.line) {
          let rv = line.substring(0, range.start.character) + text;
          if (idx === range.end.line) {
            rv += line.substring(range.end.character) + eol;
          }
          return rv;
        } else if (idx > range.start.line && idx < range.end.line) {
          return "";
        } else if (idx === range.end.line) {
          return line.substring(range.end.character) + eol;
        } else {
          return line + eol;
        }
      })
      .join("");
  }
}
class MockTextOptions implements ITextOptions {
  insertSpaces?: boolean | string;
  tabSize?: number | string;
}

class MockTextEditorSystem implements ITextEditor {
  readonly document: MockTextDocument;
  readonly options: MockTextOptions;
  _selections: Array<Selection>;

  constructor(text: string, selections?: Array<Selection>) {
    this.document = new MockTextDocument(text);
    this._selections = selections || [new Selection(0, 0, 0, 0)];
  }
  getSelections(editor: TextEditor): Array<Selection> {
    return this._selections;
  }
  withSelections(value: Array<Selection>): ITextEditor {
    this._selections = value;
    return this;
  }
  async edit(cb: (edits: ITextEditorEdit) => void): Promise<ITextEditor> {
    const edits = new TextEditorEdit(this.document, {
      undoStopAfter: false,
      undoStopBefore: false
    });
    cb(edits);
    edits.finalize().edits.forEach(edit => {
      this.document.replace(edit.range, edit.text || "");
    });

    return this;
  }
  async command(name: string): Promise<ITextEditor> {
    return this;
  }
}

export class MockTextEditor extends TextEditor {
  constructor(text: string, selections?: Array<Selection>) {
    super(new MockTextEditorSystem(text, selections));
  }

  renderAsString() {
    const markers: Array<{
      idx: number;
      pos: Position;
      sel: Selection;
      end: number;
    }> = [];

    this.selections.forEach((sel, idx) => {
      markers.push(
        {
          idx,
          pos: sel.start,
          sel,
          end: 0
        },
        {
          idx,
          pos: sel.end,
          sel,
          end: 1
        }
      );
    });
    markers.sort((a, b) => {
      return a.pos.compareTo(b.pos) || a.end - b.end;
    });

    const lines = this.document.getText().split("\n");
    markers.reverse().forEach(({ idx, pos, sel, end }) => {
      let symbol;
      if (sel.isEmpty) {
        symbol = end ? "|" : "";
      } else {
        const active = pos === sel.active ? "|" : "";
        symbol = end ? `${active}>` : `<${active}`;
      }
      lines[pos.line] =
        lines[pos.line].substring(0, pos.character) +
        symbol +
        lines[pos.line].substring(pos.character);
    });
    return lines.join("\n");
  }
}
