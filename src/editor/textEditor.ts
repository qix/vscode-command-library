"use strict";

import * as vscode from "vscode";
import { Position } from "./position";
import { Selection } from "./selection";
import { Range } from "./range";
import { TextEdit } from "vscode";

export class TextEditor {
  private _editor: vscode.TextEditor;

  constructor(editor: vscode.TextEditor) {
    this._editor = editor;
  }

  public position(line: number, character: number) {
    return new Position(this, line, character);
  }
  public selection(anchor: Position, active: Position) {
    return new Selection(this, anchor, active);
  }
  public range(start: Position, end: Position) {
    return new Range(this, start, end);
  }

  static fromVSCode(editor: vscode.TextEditor) {
    return new TextEditor(editor);
  }

  get document(): vscode.TextDocument {
    return this._editor.document;
  }
  get options(): vscode.TextEditorOptions {
    return this._editor.options;
  }
  get selections(): Array<Selection> {
    return this._editor.selections.map(sel => {
      return this.selection(
        this.position(sel.anchor.line, sel.anchor.character),
        this.position(sel.active.line, sel.active.character)
      );
    });
  }

  withSelections(value: Array<Selection>): TextEditor {
    this._editor.selections = value;
    return this;
  }

  async command(name: string): Promise<TextEditor> {
    return vscode.commands.executeCommand(name).then(() => {
      return this;
    });
  }

  async edit(cb: (edits: vscode.TextEditorEdit) => void): Promise<TextEditor> {
    await this._editor.edit(cb);
    return this;
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

  static async insertAt(
    text: string,
    position: vscode.Position
  ): Promise<boolean> {
    return this._editor.edit(editBuilder => {
      editBuilder.insert(position, text);
    });
  }

  static async delete(range: vscode.Range): Promise<boolean> {
    return this._editor.edit(editBuilder => {
      editBuilder.delete(range);
    });
  }

  static async backspace(position: Position): Promise<Position> {
    if (position.character === 0) {
      if (position.line > 0) {
        const prevEndOfLine = position.getPreviousLineBegin().getLineEnd();

        await TextEditor.delete(
          new vscode.Range(
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

      await TextEditor.delete(new vscode.Range(position, leftPosition));

      return leftPosition;
    }
  }*/

  getDocumentVersion(): number {
    return this.document.version;
  }

  async deleteDocument(): Promise<TextEditor> {
    const start = new vscode.Position(0, 0);
    const lastLine = this._editor.document.lineCount - 1;
    const end = this._editor.document.lineAt(lastLine).range.end;
    const range = new vscode.Range(start, end);

    return this.edit(editBuilder => {
      editBuilder.delete(range);
    });
  }

  async replace(range: vscode.Range, text: string): Promise<TextEditor> {
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
    const lineNo = this._editor.selection.active.line;

    return this._editor.document.lineAt(lineNo).text;
  }

  readLineAt(lineNo: number): string {
    if (lineNo === null) {
      lineNo = this._editor.selection.active.line;
    }

    if (lineNo >= this._editor.document.lineCount) {
      throw new RangeError();
    }

    return this._editor.document.lineAt(lineNo).text;
  }

  getLineCount(): number {
    return this._editor.document.lineCount;
  }

  getLineAt(position: vscode.Position): vscode.TextLine {
    return this._editor.document.lineAt(position);
  }

  getSelection(): vscode.Range {
    return this._editor.selection;
  }

  getText(selection: vscode.Range): string {
    return this._editor.document.getText(selection);
  }

  isFirstLine(position: vscode.Position): boolean {
    return position.line === 0;
  }

  isLastLine(position: vscode.Position): boolean {
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
