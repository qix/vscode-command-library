"use strict";

import { Position } from "./position";
import { Selection } from "./selection";
import { Range } from "./range";
import { isContext } from "vm";

export interface ITextEditorEdit {
  delete(location: Range | Selection): void;
  insert(location: Position, value: string): void;
  replace(location: Position | Range | Selection, value: string): void;
}
export interface ITextLine {
  firstNonWhitespaceCharacterIndex: number;
  isEmptyOrWhitespace: boolean;
  lineNumber: number;
  range: Range;
  rangeIncludingLineBreak: Range;
  text: string;
}
export interface ITextDocument {
  fileName: string;
  isClosed: boolean;
  isDirty: boolean;
  isUntitled: boolean;
  languageId: string;
  lineCount: number;
  version: number;
  getText(range?: Range): string;
  getWordRangeAtPosition(position: Position, regex?: RegExp): Range | undefined;
  lineAt(line: number): ITextLine;
  lineAt(pos: Position): ITextLine;
  offsetAt(position: Position): number;
  positionAt(offset: number): Position;
  save(): Thenable<boolean>;
  validatePosition(position: Position): Position;
  validateRange(range: Range): Range;
}
export interface ITextOptions {
  insertSpaces?: boolean | string;
  tabSize?: number | string;
}
export interface ITextEditor {
  document: ITextDocument;
  options: ITextOptions;
  getSelections(editor: TextEditor): Array<Selection>;
  withSelections(value: Array<Selection>): ITextEditor;
  edit(cb: (edits: ITextEditorEdit) => void): Promise<ITextEditor>;
  command(name: string): Promise<ITextEditor>;
}

export class TextEditor {
  private _editor: ITextEditor;

  constructor(editor: ITextEditor) {
    this._editor = editor;
  }

  public position(line: number, character: number) {
    return new Position(line, character);
  }

  get selection(): Selection {
    return this._editor.getSelections(this)[0];
  }
  get document(): ITextDocument {
    return this._editor.document;
  }
  get options(): ITextOptions {
    return this._editor.options;
  }
  get selections(): Array<Selection> {
    return this._editor.getSelections(this);
  }

  withSelections(value: Array<Selection>): TextEditor {
    // @TODO: This does basic deduplication and sorting, but need a better
    // solution to that.
    const seen = new Set();
    const selections = [...value]
      .sort((a, b) => a.compareTo(b))
      .filter(selection => {
        const key = JSON.stringify([
          selection.anchor.line,
          selection.anchor.character,
          selection.active.line,
          selection.active.character
        ]);
        if (!seen.has(key)) {
          seen.add(key);
          return true;
        }
        return false;
      });
    this._editor = this._editor.withSelections(selections);
    return this;
  }

  async command(name: string): Promise<TextEditor> {
    this._editor = await this._editor.command(name);
    return this;
  }

  async edit(cb: (edits: ITextEditorEdit) => void): Promise<TextEditor> {
    this._editor = await this._editor.edit(cb);
    return this;
  }

  async insertAt(text: string, position: Position): Promise<TextEditor> {
    return this.edit(editBuilder => {
      editBuilder.insert(position, text);
    });
  }

  async delete(range: Range): Promise<TextEditor> {
    return this.edit(editBuilder => {
      editBuilder.delete(range);
    });
  }

  /*
  static async insert(
    text: string,
    at: Position | undefined = undefined,
    letVSCodeHandleKeystrokes: boolean | undefined = undefined
  ): Promise<boolean> {
    // If we insert "blah(" with default:type, VSCode will insert the closing ).
    // We *probably* don't want that to happen if we're inserting a lot of text.
    if (letVSCodeHandleKeystrokes === undefined) {
      letVSCodeHandleKeystrokes = text.length === 1;
    }

    if (at) {
      this._editor.selection = new vscode.Selection(at, at);
    }

    if (!letVSCodeHandleKeystrokes) {
      return this._editor.edit(editBuilder => {
        editBuilder.insert(
          this._editor.selection.active,
          text
        );
      });
    } else {
      await vscode.commands.executeCommand("default:type", { text });
    }

    return true;
  }
  static async backspace(position: Position): Promise<Position> {
    if (position.character === 0) {
      if (position.line > 0) {
        const prevEndOfLine = position.getPreviousLineBegin().getLineEnd();

        await TextEditor.delete(
          new Range(
            position.getPreviousLineBegin().getLineEnd(),
            position.getLineBegin()
          )
        );

        return prevEndOfLine;
      } else {
        return position;
      }
    } else {
      let leftPosition = position.getLeft();

      if (position.getFirstLineNonBlankChar().character >= position.character) {
        let tabStop = vscode.workspace
          .getConfiguration("editor")
          .get("useTabStops", true);

        if (tabStop) {
          leftPosition = position.getLeftTabStop();
        }
      }

      await TextEditor.delete(new Range(position, leftPosition));

      return leftPosition;
    }
  }*/

  getDocumentVersion(): number {
    return this.document.version;
  }

  async deleteDocument(): Promise<TextEditor> {
    const start = this.position(0, 0);
    const lastLine = this._editor.document.lineCount - 1;
    const end = this._editor.document.lineAt(lastLine).range.end;
    const range = new Range(start, end);

    return this.edit(editBuilder => {
      editBuilder.delete(range);
    });
  }

  async replace(range: Range, text: string): Promise<TextEditor> {
    return this.edit(editBuilder => {
      editBuilder.replace(range, text);
    });
  }

  getAllText(): string {
    if (this._editor) {
      return this._editor.document.getText();
    }

    return "";
  }

  readLine(): string {
    const lineNo = this.selection.active.line;

    return this._editor.document.lineAt(lineNo).text;
  }

  readLineAt(lineNo: number): string {
    if (lineNo === null) {
      lineNo = this.selection.active.line;
    }

    if (lineNo >= this._editor.document.lineCount) {
      throw new RangeError();
    }

    return this._editor.document.lineAt(lineNo).text;
  }

  getLineCount(): number {
    return this._editor.document.lineCount;
  }

  getLineAt(position: Position): ITextLine {
    return this._editor.document.lineAt(position.line);
  }

  getSelection(): Range {
    return new Range(this.selection.start, this.selection.end);
  }

  getText(selection: Range): string {
    return this._editor.document.getText(selection);
  }

  isFirstLine(position: Position): boolean {
    return position.line === 0;
  }

  isLastLine(position: Position): boolean {
    return position.line === this._editor.document.lineCount - 1;
  }

  getIndentationLevel(line: string): number {
    let tabSize = 2;
    let firstNonWhiteSpace = line.match(/^\s*/)[0].length;
    let visibleColumn: number = 0;

    if (firstNonWhiteSpace >= 0) {
      for (const char of line.substring(0, firstNonWhiteSpace)) {
        switch (char) {
          case "\t":
            visibleColumn += tabSize;
            break;
          case " ":
            visibleColumn += 1;
            break;
          default:
            break;
        }
      }
    } else {
      return -1;
    }

    return visibleColumn;
  }

  setIndentationLevel(line: string, screenCharacters: number): string {
    let tabSize = 2;
    let insertTabAsSpaces = true;

    if (screenCharacters < 0) {
      screenCharacters = 0;
    }

    let indentString = "";

    if (insertTabAsSpaces) {
      indentString += new Array(screenCharacters + 1).join(" ");
    } else {
      if (screenCharacters / tabSize > 0) {
        indentString += new Array(
          Math.floor(screenCharacters / tabSize) + 1
        ).join("\t");
      }

      indentString += new Array(screenCharacters % tabSize + 1).join(" ");
    }

    let firstNonWhiteSpace = line.match(/^\s*/)[0].length;
    return indentString + line.substring(firstNonWhiteSpace, line.length);
  }
}
