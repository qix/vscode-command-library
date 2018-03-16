import { Position } from "./position";
import { Range } from "./range";
import { Selection } from "./selection";
import { ITextDocument } from "./textEditor";

function illegalArgument(message = "") {
  throw new Error(`Illegal argument: ${message}`);
}

export enum EndOfLine {
  LF = 1,
  CRLF = 2
}

export interface ITextEditOperation {
  range: Range;
  text: string;
  forceMoveMarkers: boolean;
}

export interface IEditData {
  documentVersionId: number;
  edits: ITextEditOperation[];
  setEndOfLine: EndOfLine;
  undoStopBefore: boolean;
  undoStopAfter: boolean;
}
export class TextEditorEdit {
  private readonly _document: ITextDocument;
  private readonly _documentVersionId: number;
  private _collectedEdits: ITextEditOperation[];
  private _setEndOfLine: EndOfLine;
  private readonly _undoStopBefore: boolean;
  private readonly _undoStopAfter: boolean;

  constructor(
    document: ITextDocument,
    options: { undoStopBefore: boolean; undoStopAfter: boolean }
  ) {
    this._document = document;
    this._documentVersionId = document.version;
    this._collectedEdits = [];
    this._setEndOfLine = 0;
    this._undoStopBefore = options.undoStopBefore;
    this._undoStopAfter = options.undoStopAfter;
  }

  finalize(): IEditData {
    return {
      documentVersionId: this._documentVersionId,
      edits: this._collectedEdits,
      setEndOfLine: this._setEndOfLine,
      undoStopBefore: this._undoStopBefore,
      undoStopAfter: this._undoStopAfter
    };
  }

  replace(location: Position | Range | Selection, value: string): void {
    let range: Range = null;

    if (location instanceof Position) {
      range = new Range(location, location);
    } else if (location instanceof Range) {
      range = location;
    } else {
      throw new Error("Unrecognized location");
    }

    this._pushEdit(range, value, false);
  }

  insert(location: Position, value: string): void {
    this._pushEdit(new Range(location, location), value, true);
  }

  delete(location: Range | Selection): void {
    let range: Range = null;

    if (location instanceof Range) {
      range = location;
    } else {
      throw new Error("Unrecognized location");
    }

    this._pushEdit(range, null, true);
  }

  private _pushEdit(
    range: Range,
    text: string,
    forceMoveMarkers: boolean
  ): void {
    let validRange = this._document.validateRange(range);
    this._collectedEdits.push({
      range: validRange,
      text: text,
      forceMoveMarkers: forceMoveMarkers
    });
  }

  setEndOfLine(endOfLine: EndOfLine): void {
    if (endOfLine !== EndOfLine.LF && endOfLine !== EndOfLine.CRLF) {
      throw illegalArgument("endOfLine");
    }

    this._setEndOfLine = endOfLine;
  }
}
