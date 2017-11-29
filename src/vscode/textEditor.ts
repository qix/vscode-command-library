import { TextEdit, TextDocument, EndOfLine, TextLine } from "vscode";
import * as vscode from "vscode";
import {
  ITextDocument,
  ITextEditor,
  ITextLine,
  TextEditor,
  ITextEditorEdit,
  ITextOptions
} from "../editor/textEditor";
import { Selection, Position, Range } from "../editor";

class VscodeDocument implements ITextDocument {
  _document: vscode.TextDocument;
  _converter: convertPosition;

  constructor(document: vscode.TextDocument, converter: convertPosition) {
    this._document = document;
    this._converter = converter;
  }

  get eol(): EndOfLine {
    return this._document.eol;
  }
  get fileName(): string {
    return this._document.fileName;
  }
  get isClosed(): boolean {
    return this._document.isClosed;
  }
  get isDirty(): boolean {
    return this._document.isDirty;
  }
  get isUntitled(): boolean {
    return this._document.isUntitled;
  }
  get languageId(): string {
    return this._document.languageId;
  }
  get lineCount(): number {
    return this._document.lineCount;
  }
  get version(): number {
    return this._document.version;
  }
  getText(range?: Range): string {
    return this._document.getText(range);
  }
  getWordRangeAtPosition(
    position: Position,
    regex?: RegExp
  ): Range | undefined {
    const rv = this._document.getWordRangeAtPosition(position, regex);
    if (rv) {
      return new Range(this._converter(rv.start), this._converter(rv.end));
    }
  }

  lineAt(line: number): ITextLine;
  lineAt(pos: Position): ITextLine;
  lineAt(line: number | Position) {
    if (typeof line === "number") {
      return this._document.lineAt(line);
    } else {
      return this._document.lineAt(line);
    }
  }
  offsetAt(position: Position): number {
    return this._document.offsetAt(position);
  }
  positionAt(offset: number): Position {
    return this._converter(this._document.positionAt(offset));
  }
  save(): Thenable<boolean> {
    return this._document.save();
  }
  validatePosition(position: Position): Position {
    return this._converter(this._document.validatePosition(position));
  }
  validateRange(range: Range): Range {
    const rv = this._document.validateRange(range);
    return new Range(this._converter(rv.start), this._converter(rv.end));
  }
}

type convertPosition = ((position: vscode.Position) => Position);
class VscodeTextEditor implements ITextEditor {
  private _vsEditor: vscode.TextEditor;
  private _converter: convertPosition;

  constructor(vsEditor: vscode.TextEditor, converter: convertPosition) {
    this._vsEditor = vsEditor;
    this._converter = converter;
  }

  get document(): ITextDocument {
    return new VscodeDocument(this._vsEditor.document, this._converter);
  }
  get options(): ITextOptions {
    return this._vsEditor.options;
  }

  getSelections(editor: TextEditor): Array<Selection> {
    return this._vsEditor.selections.map(sel => {
      return new Selection(
        this._converter(sel.anchor),
        this._converter(sel.active)
      );
    });
  }
  withSelections(value: Array<Selection>): ITextEditor {
    this._vsEditor.selections = value;
    return this;
  }
  async edit(cb: (edits: ITextEditorEdit) => void) {
    return this._vsEditor.edit(cb).then(() => {
      return this;
    });
  }

  async command(name: string): Promise<ITextEditor> {
    return vscode.commands.executeCommand(name).then(() => {
      return this;
    });
  }
}

export function textEditorFromVSCode(editor: vscode.TextEditor): TextEditor {
  const textEditor = new TextEditor(
    new VscodeTextEditor(editor, (p: vscode.Position) => {
      return textEditor.position(p.line, p.character);
    })
  );
  return textEditor;
}
