import {
  ITextEditor,
  ITextEditorEdit,
  ITextLine,
  ITextDocument,
  ITextOptions,
  TextEditor
} from "../../editor/textEditor";
import { Position, Range, Selection } from "../../editor";

class MockTextLine implements ITextLine {
  firstNonWhitespaceCharacterIndex: number;
  isEmptyOrWhitespace: boolean;
  lineNumber: number;
  range: Range;
  rangeIncludingLineBreak: Range;
  text: string;

  constructor() {
    this.text = "hello";
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

  constructor() {
    this.fileName = "sample.txt";
    this.isClosed = false;
    this.isDirty = false;
    this.isUntitled = false;
    this.languageId = "text";

    this._text = "sample\nfile";
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
    return new MockTextLine();
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
    return;
  }
  validateRange(range: Range): Range {
    return;
  }
}
class MockTextOptions implements ITextOptions {
  insertSpaces?: boolean | string;
  tabSize?: number | string;
}

export class MockTextEditor implements ITextEditor {
  document: MockTextDocument;
  options: MockTextOptions;
  selections: Array<Selection>;
  constructor(selections: Array<Selection>) {
    this.document = new MockTextDocument();
    this.selections = selections;
  }
  getSelections(editor: TextEditor): Array<Selection> {
    return [];
  }
  withSelections(value: Array<Selection>): ITextEditor {
    return new MockTextEditor(value);
  }
  async edit(cb: (edits: ITextEditorEdit) => void): Promise<ITextEditor> {
    return new MockTextEditor(this.selections);
  }
  async command(name: string): Promise<ITextEditor> {
    return this;
  }

  renderAsString() {
    return this.document.getText();
  }
}
