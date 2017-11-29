"use strict";

import * as _ from "lodash";
import * as vscode from "vscode";
import { TextEditor } from "./textEditor";
import { TextEdit } from "vscode";

export class Position extends vscode.Position {
  private static NonWordCharacters = "/\\()\"':,.;<>~!@#$%^&*|+=[]{}`?-";
  private static NonBigWordCharacters = "";

  private _nonWordCharRegex: RegExp;
  private _nonBigWordCharRegex: RegExp;
  private _sentenceEndRegex: RegExp;
  private _editor: TextEditor;

  constructor(editor: TextEditor, line: number, character: number) {
    super(line, character);

    this._editor = editor;

    this._nonWordCharRegex = this.makeWordRegex(Position.NonWordCharacters);
    this._nonBigWordCharRegex = this.makeWordRegex(
      Position.NonBigWordCharacters
    );
    this._sentenceEndRegex = /[\.!\?]{1}([ \n\t]+|$)/g;
  }

  get editor(): TextEditor {
    return this._editor;
  }

  public static FromVSCode(editor: TextEditor, pos: vscode.Position): Position {
    return editor.position(pos.line, pos.character);
  }

  /**
   * Returns which of the 2 provided Positions comes earlier in the document.
   */
  public static EarlierOf(p1: Position, p2: Position): Position {
    if (p1.line < p2.line) {
      return p1;
    }
    if (p1.line === p2.line && p1.character < p2.character) {
      return p1;
    }

    return p2;
  }

  /**
   * Iterates over every position in the document starting at start, returning
   * at every position the current line text, character text, and a position object.
   */
  public *IterateDocument(
    forward = true
  ): Iterable<{ line: string; char: string; pos: Position }> {
    const start = this;
    const editor = this._editor;

    let lineIndex: number, charIndex: number;

    if (forward) {
      for (
        lineIndex = start.line;
        lineIndex < editor.getLineCount();
        lineIndex++
      ) {
        charIndex = lineIndex === start.line ? start.character : 0;
        const line = editor.getLineAt(editor.position(lineIndex, 0)).text;

        for (; charIndex < line.length; charIndex++) {
          yield {
            line: line,
            char: line[charIndex],
            pos: editor.position(lineIndex, charIndex)
          };
        }
      }
    } else {
      for (lineIndex = start.line; lineIndex >= 0; lineIndex--) {
        const line = editor.getLineAt(editor.position(lineIndex, 0)).text;
        charIndex =
          lineIndex === start.line ? start.character : line.length - 1;

        for (; charIndex >= 0; charIndex--) {
          yield {
            line: line,
            char: line[charIndex],
            pos: editor.position(lineIndex, charIndex)
          };
        }
      }
    }
  }

  /**
   * Iterate over every position in the block defined by the two positions passed in.
   */
  public static *IterateBlock(
    topLeft: Position,
    bottomRight: Position
  ): Iterable<{ line: string; char: string; pos: Position }> {
    const editor = topLeft.editor;
    for (
      let lineIndex = topLeft.line;
      lineIndex <= bottomRight.line;
      lineIndex++
    ) {
      const line = editor.getLineAt(editor.position(lineIndex, 0)).text;

      for (
        let charIndex = topLeft.character;
        charIndex < bottomRight.character + 1;
        charIndex++
      ) {
        yield {
          line: line,
          char: line[charIndex],
          pos: editor.position(lineIndex, charIndex)
        };
      }
    }
  }

  public *IterateWords(): Iterable<{
    start: Position;
    end: Position;
    word: string;
  }> {
    let start: Position = this;

    const text = this.editor.getLineAt(start).text;
    let wordEnd = start.getCurrentWordEnd(true);
    do {
      const word = text.substring(start.character, wordEnd.character + 1);
      yield { start: start, end: wordEnd, word: word };

      if (wordEnd.isLineEnd()) {
        return;
      }
      start = start.getWordRight();
      wordEnd = start.getCurrentWordEnd();
    } while (true);
  }

  /**
   * Returns which of the 2 provided Positions comes later in the document.
   */
  public static LaterOf(p1: Position, p2: Position): Position {
    if (Position.EarlierOf(p1, p2) === p1) {
      return p2;
    }

    return p1;
  }

  public setLocation(line: number, character: number): Position {
    let position = this.editor.position(line, character);
    return position;
  }

  public getLeftTabStop(): Position {
    const editor = this.editor;
    if (!this.isLineBeginning()) {
      let indentationWidth = this.editor.getIndentationLevel(
        this.editor.getLineAt(this).text
      );
      let tabSize = this.editor.options.tabSize as number;

      if (indentationWidth % tabSize > 0) {
        return editor.position(
          this.line,
          Math.max(0, this.character - indentationWidth % tabSize)
        );
      } else {
        return editor.position(
          this.line,
          Math.max(0, this.character - tabSize)
        );
      }
    }

    return this;
  }

  public getLeft(): Position {
    if (!this.isLineBeginning()) {
      return this.editor.position(this.line, this.character - 1);
    }

    return this;
  }

  /**
   * Same as getLeft, but goes up to the previous line on line
   * breaks.
   *
   * Equivalent to left arrow (in a non-vim editor!)
   */
  public getLeftThroughLineBreaks(): Position {
    if (!this.isLineBeginning()) {
      return this.getLeft();
    }

    return this.editor.position(this.line - 1, 0).getLineEnd();
  }

  public getRightThroughLineBreaks(): Position {
    if (this.isAtDocumentEnd()) {
      // TODO(bell)
      return this;
    }

    if (this.getRight().isLineEnd()) {
      return this.getDown(0);
    }

    return this.getRight();
  }

  public getRight(count: number = 1): Position {
    if (!this.isLineEnd()) {
      return this.editor.position(this.line, this.character + count);
    }

    return this;
  }

  /**
   * Get the position of the line directly below the current line.
   */
  public getDown(desiredColumn: number): Position {
    if (this.getDocumentEnd().line !== this.line) {
      let nextLine = this.line + 1;
      let nextLineLength = this.getLineLength(nextLine);

      return this.editor.position(
        nextLine,
        Math.min(nextLineLength, desiredColumn)
      );
    }

    return this;
  }

  /**
   * Get the position of the line directly above the current line.
   */
  public getUp(desiredColumn: number): Position {
    if (this.getDocumentBegin().line !== this.line) {
      let prevLine = this.line - 1;
      let prevLineLength = this.getLineLength(prevLine);

      return this.editor.position(
        prevLine,
        Math.min(prevLineLength, desiredColumn)
      );
    }

    return this;
  }

  /**
   * Get the position *count* lines down from this position, but not lower
   * than the end of the document.
   */
  public getDownByCount(count = 0): Position {
    return this.editor.position(
      Math.min(this.editor.getLineCount() - 1, this.line + count),
      this.character
    );
  }

  /**
   * Get the position *count* lines up from this position, but not higher
   * than the end of the document.
   */
  public getUpByCount(count = 0): Position {
    return this.editor.position(Math.max(0, this.line - count), this.character);
  }

  /**
   * Get the position *count* lines left from this position, but not farther
   * than the beginning of the line
   */
  public getLeftByCount(count = 0): Position {
    return this.editor.position(this.line, Math.max(0, this.character - count));
  }

  /**
   * Get the position *count* lines right from this position, but not farther
   * than the end of the line
   */
  public getRightByCount(count = 0): Position {
    return this.editor.position(
      this.line,
      Math.min(
        this.editor.getLineAt(this).text.length - 1,
        this.character + count
      )
    );
  }

  /**
   * Inclusive is true if we consider the current position a valid result, false otherwise.
   */
  public getWordLeft(inclusive: boolean = false): Position {
    return this.getWordLeftWithRegex(this._nonWordCharRegex, inclusive);
  }

  public getBigWordLeft(): Position {
    return this.getWordLeftWithRegex(this._nonBigWordCharRegex);
  }

  /**
   * Inclusive is true if we consider the current position a valid result, false otherwise.
   */
  public getWordRight(inclusive: boolean = false): Position {
    return this.getWordRightWithRegex(this._nonWordCharRegex, inclusive);
  }

  public getBigWordRight(): Position {
    return this.getWordRightWithRegex(this._nonBigWordCharRegex);
  }

  public getLastWordEnd(): Position {
    return this.getLastWordEndWithRegex(this._nonWordCharRegex);
  }

  public getLastBigWordEnd(): Position {
    return this.getLastWordEndWithRegex(this._nonBigWordCharRegex);
  }

  /**
   * Inclusive is true if we consider the current position a valid result, false otherwise.
   */
  public getCurrentWordEnd(inclusive: boolean = false): Position {
    return this.getCurrentWordEndWithRegex(this._nonWordCharRegex, inclusive);
  }

  /**
   * Inclusive is true if we consider the current position a valid result, false otherwise.
   */
  public getCurrentBigWordEnd(inclusive: boolean = false): Position {
    return this.getCurrentWordEndWithRegex(
      this._nonBigWordCharRegex,
      inclusive
    );
  }

  /**
   * Get the boundary position of the section.
   */
  public getSectionBoundary(args: {
    forward: boolean;
    boundary: string;
  }): Position {
    let pos: Position = this;

    if (
      (args.forward && pos.line === this.editor.getLineCount() - 1) ||
      (!args.forward && pos.line === 0)
    ) {
      return pos.getFirstLineNonBlankChar();
    }

    pos = args.forward ? pos.getDown(0) : pos.getUp(0);

    while (!this.editor.getLineAt(pos).text.startsWith(args.boundary)) {
      if (args.forward) {
        if (pos.line === this.editor.getLineCount() - 1) {
          break;
        }

        pos = pos.getDown(0);
      } else {
        if (pos.line === 0) {
          break;
        }

        pos = pos.getUp(0);
      }
    }

    return pos.getFirstLineNonBlankChar();
  }

  /**
   * Get the end of the current paragraph.
   */
  public getCurrentParagraphEnd(): Position {
    let pos: Position = this;

    // If we're not in a paragraph yet, go down until we are.
    while (
      this.editor.getLineAt(pos).text === "" &&
      !this.editor.isLastLine(pos)
    ) {
      pos = pos.getDown(0);
    }

    // Go until we're outside of the paragraph, or at the end of the document.
    while (
      this.editor.getLineAt(pos).text !== "" &&
      pos.line < this.editor.getLineCount() - 1
    ) {
      pos = pos.getDown(0);
    }

    return pos.getLineEnd();
  }

  /**
   * Get the beginning of the current paragraph.
   */
  public getCurrentParagraphBeginning(): Position {
    let pos: Position = this;

    // If we're not in a paragraph yet, go up until we are.
    while (
      this.editor.getLineAt(pos).text === "" &&
      !this.editor.isFirstLine(pos)
    ) {
      pos = pos.getUp(0);
    }

    // Go until we're outside of the paragraph, or at the beginning of the document.
    while (pos.line > 0 && this.editor.getLineAt(pos).text !== "") {
      pos = pos.getUp(0);
    }

    return pos.getLineBegin();
  }

  public getSentenceBegin(args: { forward: boolean }): Position {
    if (args.forward) {
      return this.getNextSentenceBeginWithRegex(this._sentenceEndRegex, false);
    } else {
      return this.getPreviousSentenceBeginWithRegex(
        this._sentenceEndRegex,
        false
      );
    }
  }

  public getCurrentSentenceEnd(): Position {
    return this.getCurrentSentenceEndWithRegex(this._sentenceEndRegex, false);
  }

  /**
   * Get the beginning of the current line.
   */
  public getLineBegin(): Position {
    return this.editor.position(this.line, 0);
  }

  /**
   * Get the beginning of the line, excluding preceeding whitespace.
   * This respects the `noautoindent` setting, and returns `getLineBegin()` if auto-indent
   * is disabled.
   */
  public getLineBeginRespectingIndent(): Position {
    const autoIndent = true;
    if (!autoIndent) {
      return this.getLineBegin();
    }
    return this.getFirstLineNonBlankChar();
  }

  /**
   * Get the beginning of the next line.
   */
  public getPreviousLineBegin(): Position {
    if (this.line === 0) {
      return this.getLineBegin();
    }

    return this.editor.position(this.line - 1, 0);
  }

  /**
   * Get the beginning of the next line.
   */
  public getNextLineBegin(): Position {
    if (this.line >= this.editor.getLineCount() - 1) {
      return this.getLineEnd();
    }

    return this.editor.position(this.line + 1, 0);
  }

  /**
   * Returns a new position at the end of this position's line.
   */
  public getLineEnd(): Position {
    return this.editor.position(this.line, this.getLineLength(this.line));
  }

  /**
   * Returns a new position at the end of this position's line, including the
   * invisible newline character.
   */
  public getLineEndIncludingEOL(): Position {
    return this.editor.position(this.line, this.getLineLength(this.line) + 1);
  }

  public getDocumentBegin(): Position {
    return this.editor.position(0, 0);
  }

  /**
   * Get the position that the cursor would be at if you
   * pasted *text* at the current position.
   */
  public advancePositionByText(text: string): Position {
    const numberOfLinesSpanned = (text.match(/\n/g) || []).length;

    return this.editor.position(
      this.line + numberOfLinesSpanned,
      numberOfLinesSpanned === 0
        ? this.character + text.length
        : text.length - (text.lastIndexOf("\n") + 1)
    );
  }

  public getDocumentEnd(): Position {
    let lineCount = this.editor.getLineCount();
    let line = lineCount > 0 ? lineCount - 1 : 0;
    let char = this.getLineLength(line);

    return this.editor.position(line, char);
  }

  public isValid(): boolean {
    // line
    let lineCount = this.editor.getLineCount();
    if (this.line > lineCount) {
      return false;
    }

    // char
    let charCount = this.getLineLength(this.line);
    if (this.character > charCount + 1) {
      return false;
    }

    return true;
  }

  /**
   * Is this position at the beginning of the line?
   */
  public isLineBeginning(): boolean {
    return this.character === 0;
  }

  /**
   * Is this position at the end of the line?
   */
  public isLineEnd(): boolean {
    return this.character >= this.getLineLength(this.line);
  }

  public isFirstWordOfLine(): boolean {
    return this.getFirstNonBlankCharAtLine(this.line) === this.character;
  }

  public isAtDocumentEnd(): boolean {
    return this.line === this.editor.getLineCount() - 1 && this.isLineEnd();
  }

  public getFirstNonBlankCharAtLine(line: number): number {
    return this.editor.readLineAt(line).match(/^\s*/)[0].length;
  }

  /**
   * The position of the first character on this line which is not whitespace.
   */
  public getFirstLineNonBlankChar(): Position {
    return this.editor.position(
      this.line,
      this.getFirstNonBlankCharAtLine(this.line)
    );
  }

  public getDocumentStart(): Position {
    return this.editor.position(0, 0);
  }

  public getLineLength(line: number): number {
    return this.editor.readLineAt(line).length;
  }

  private makeWordRegex(characterSet: string): RegExp {
    let escaped = characterSet && _.escapeRegExp(characterSet);
    let segments: string[] = [];
    segments.push(`([^\\s${escaped}]+)`);
    segments.push(`[${escaped}]+`);
    segments.push(`$^`);
    let result = new RegExp(segments.join("|"), "g");

    return result;
  }

  private getAllPositions(line: string, regex: RegExp): number[] {
    let positions: number[] = [];
    let result = regex.exec(line);

    while (result) {
      positions.push(result.index);

      // Handles the case where an empty string match causes lastIndex not to advance,
      // which gets us in an infinite loop.
      if (result.index === regex.lastIndex) {
        regex.lastIndex++;
      }
      result = regex.exec(line);
    }

    return positions;
  }

  private getAllEndPositions(line: string, regex: RegExp): number[] {
    let positions: number[] = [];
    let result = regex.exec(line);

    while (result) {
      if (result[0].length) {
        positions.push(result.index + result[0].length - 1);
      }

      // Handles the case where an empty string match causes lastIndex not to advance,
      // which gets us in an infinite loop.
      if (result.index === regex.lastIndex) {
        regex.lastIndex++;
      }
      result = regex.exec(line);
    }

    return positions;
  }

  /**
   * Inclusive is true if we consider the current position a valid result, false otherwise.
   */
  private getWordLeftWithRegex(
    regex: RegExp,
    inclusive: boolean = false
  ): Position {
    for (let currentLine = this.line; currentLine >= 0; currentLine--) {
      let positions = this.getAllPositions(
        this.editor.getLineAt(this.editor.position(currentLine, 0)).text,
        regex
      );
      let newCharacter = _.find(
        positions.reverse(),
        index =>
          (index < this.character && !inclusive) ||
          (index <= this.character && inclusive) ||
          currentLine !== this.line
      );

      if (newCharacter !== undefined) {
        return this.editor.position(currentLine, newCharacter);
      }
    }

    return this.editor.position(0, 0).getLineBegin();
  }

  /**
   * Inclusive is true if we consider the current position a valid result, false otherwise.
   */
  private getWordRightWithRegex(
    regex: RegExp,
    inclusive: boolean = false
  ): Position {
    for (
      let currentLine = this.line;
      currentLine < this.editor.getLineCount();
      currentLine++
    ) {
      let positions = this.getAllPositions(
        this.editor.getLineAt(this.editor.position(currentLine, 0)).text,
        regex
      );
      let newCharacter = _.find(
        positions,
        index =>
          (index > this.character && !inclusive) ||
          (index >= this.character && inclusive) ||
          currentLine !== this.line
      );

      if (newCharacter !== undefined) {
        return this.editor.position(currentLine, newCharacter);
      }
    }

    return this.editor.position(this.editor.getLineCount() - 1, 0).getLineEnd();
  }

  private getLastWordEndWithRegex(regex: RegExp): Position {
    for (
      let currentLine = this.line;
      currentLine < this.editor.getLineCount();
      currentLine++
    ) {
      let positions = this.getAllEndPositions(
        this.editor.getLineAt(this.editor.position(currentLine, 0)).text,
        regex
      );
      let index = _.findIndex(
        positions,
        index => index >= this.character || currentLine !== this.line
      );
      let newCharacter = 0;
      if (index === -1) {
        newCharacter = positions[positions.length - 1];
      } else if (index > 0) {
        newCharacter = positions[index - 1];
      }

      if (newCharacter !== undefined) {
        return this.editor.position(currentLine, newCharacter);
      }
    }

    return this.editor.position(this.editor.getLineCount() - 1, 0).getLineEnd();
  }

  /**
   * Inclusive is true if we consider the current position a valid result, false otherwise.
   */
  private getCurrentWordEndWithRegex(
    regex: RegExp,
    inclusive: boolean
  ): Position {
    for (
      let currentLine = this.line;
      currentLine < this.editor.getLineCount();
      currentLine++
    ) {
      let positions = this.getAllEndPositions(
        this.editor.getLineAt(this.editor.position(currentLine, 0)).text,
        regex
      );
      let newCharacter = _.find(
        positions,
        index =>
          (index > this.character && !inclusive) ||
          (index >= this.character && inclusive) ||
          currentLine !== this.line
      );

      if (newCharacter !== undefined) {
        return this.editor.position(currentLine, newCharacter);
      }
    }

    return this.editor.position(this.editor.getLineCount() - 1, 0).getLineEnd();
  }

  private getPreviousSentenceBeginWithRegex(
    regex: RegExp,
    inclusive: boolean
  ): Position {
    let paragraphBegin = this.getCurrentParagraphBeginning();
    for (
      let currentLine = this.line;
      currentLine >= paragraphBegin.line;
      currentLine--
    ) {
      let endPositions = this.getAllEndPositions(
        this.editor.getLineAt(this.editor.position(currentLine, 0)).text,
        regex
      );
      let newCharacter = _.find(
        endPositions.reverse(),
        index =>
          (index < this.character &&
            !inclusive &&
            this.editor
              .position(currentLine, index)
              .getRightThroughLineBreaks()
              .compareTo(this)) ||
          (index <= this.character && inclusive) ||
          currentLine !== this.line
      );

      if (newCharacter !== undefined) {
        return this.editor
          .position(currentLine, newCharacter)
          .getRightThroughLineBreaks();
      }
    }

    if (
      paragraphBegin.line + 1 === this.line ||
      paragraphBegin.line === this.line
    ) {
      return paragraphBegin;
    } else {
      return this.editor.position(paragraphBegin.line + 1, 0);
    }
  }

  private getNextSentenceBeginWithRegex(
    regex: RegExp,
    inclusive: boolean
  ): Position {
    // A paragraph and section boundary is also a sentence boundary.
    let paragraphEnd = this.getCurrentParagraphEnd();
    for (
      let currentLine = this.line;
      currentLine <= paragraphEnd.line;
      currentLine++
    ) {
      let endPositions = this.getAllEndPositions(
        this.editor.getLineAt(this.editor.position(currentLine, 0)).text,
        regex
      );
      let newCharacter = _.find(
        endPositions,
        index =>
          (index > this.character && !inclusive) ||
          (index >= this.character && inclusive) ||
          currentLine !== this.line
      );

      if (newCharacter !== undefined) {
        return this.editor
          .position(currentLine, newCharacter)
          .getRightThroughLineBreaks();
      }
    }

    return this.getFirstNonWhitespaceInParagraph(paragraphEnd, inclusive);
  }

  private getCurrentSentenceEndWithRegex(
    regex: RegExp,
    inclusive: boolean
  ): Position {
    let paragraphEnd = this.getCurrentParagraphEnd();
    for (
      let currentLine = this.line;
      currentLine <= paragraphEnd.line;
      currentLine++
    ) {
      let allPositions = this.getAllPositions(
        this.editor.getLineAt(this.editor.position(currentLine, 0)).text,
        regex
      );
      let newCharacter = _.find(
        allPositions,
        index =>
          (index > this.character && !inclusive) ||
          (index >= this.character && inclusive) ||
          currentLine !== this.line
      );

      if (newCharacter !== undefined) {
        return this.editor.position(currentLine, newCharacter);
      }
    }

    return this.getFirstNonWhitespaceInParagraph(paragraphEnd, inclusive);
  }

  private getFirstNonWhitespaceInParagraph(
    paragraphEnd: Position,
    inclusive: boolean
  ): Position {
    // If the cursor is at an empty line, it's the end of a paragraph and the begin of another paragraph
    // Find the first non-whitepsace character.
    if (this.editor.getLineAt(this.editor.position(this.line, 0)).text) {
      return paragraphEnd;
    } else {
      for (
        let currentLine = this.line;
        currentLine <= paragraphEnd.line;
        currentLine++
      ) {
        let nonWhitePositions = this.getAllPositions(
          this.editor.getLineAt(this.editor.position(currentLine, 0)).text,
          /\S/g
        );
        let newCharacter = _.find(
          nonWhitePositions,
          index =>
            (index > this.character && !inclusive) ||
            (index >= this.character && inclusive) ||
            currentLine !== this.line
        );

        if (newCharacter !== undefined) {
          return this.editor.position(currentLine, newCharacter);
        }
      }
    }

    throw new Error("This should never happen...");
  }

  private findHelper(
    char: string,
    count: number,
    direction: number
  ): Position | undefined {
    // -1 = backwards, +1 = forwards
    const line = this.editor.getLineAt(this);
    let index = this.character;

    while (count && index !== -1) {
      if (direction > 0) {
        index = line.text.indexOf(char, index + direction);
      } else {
        index = line.text.lastIndexOf(char, index + direction);
      }
      count--;
    }

    if (index > -1) {
      return this.editor.position(this.line, index);
    }

    return undefined;
  }

  public tilForwards(char: string, count: number = 1): Position | null {
    const position = this.findHelper(char, count, +1);
    if (!position) {
      return null;
    }

    return this.editor.position(this.line, position.character - 1);
  }

  public tilBackwards(char: string, count: number = 1): Position | null {
    const position = this.findHelper(char, count, -1);
    if (!position) {
      return null;
    }

    return this.editor.position(this.line, position.character + 1);
  }

  public findForwards(char: string, count: number = 1): Position | null {
    const position = this.findHelper(char, count, +1);
    if (!position) {
      return null;
    }

    return this.editor.position(this.line, position.character);
  }

  public findBackwards(char: string, count: number = 1): Position | null {
    const position = this.findHelper(char, count, -1);
    if (!position) {
      return null;
    }

    return position;
  }
}
