import * as vscode from "vscode";
import * as invariant from "invariant";
import { Position } from "./position";
import { Range } from "./range";
import { TextEditor } from "./textEditor";

export class Selection extends Range {
  static isSelection(thing: any): thing is Selection {
    if (thing instanceof Selection) {
      return true;
    }
    if (!thing) {
      return false;
    }
    return (
      Range.isRange(thing) &&
      Position.isPosition((<Selection>thing).anchor) &&
      Position.isPosition((<Selection>thing).active) &&
      typeof (<Selection>thing).isReversed === "boolean"
    );
  }

  private _anchor: Position;

  public get anchor(): Position {
    return this._anchor;
  }

  private _active: Position;

  public get active(): Position {
    return this._active;
  }

  constructor(anchor: Position, active?: Position);
  constructor(
    anchorLine: number,
    anchorColumn: number,
    activeLine: number,
    activeColumn: number
  );
  constructor(
    anchorLineOrAnchor: number | Position,
    anchorColumnOrActive?: number | Position,
    activeLine?: number,
    activeColumn?: number
  ) {
    let anchor: Position;
    let active: Position;

    if (
      typeof anchorLineOrAnchor === "number" &&
      typeof anchorColumnOrActive === "number" &&
      typeof activeLine === "number" &&
      typeof activeColumn === "number"
    ) {
      anchor = new Position(anchorLineOrAnchor, anchorColumnOrActive);
      active = new Position(activeLine, activeColumn);
    } else if (anchorLineOrAnchor instanceof Position) {
      anchor = anchorLineOrAnchor;
      if (anchorColumnOrActive instanceof Position) {
        active = anchorColumnOrActive;
      } else {
        active = anchor;
      }
    }

    if (!anchor || !active) {
      throw new Error("Invalid arguments");
    }

    super(anchor, active);

    this._anchor = anchor;
    this._active = active;
  }

  get isReversed(): boolean {
    return this._anchor === this._end;
  }

  toJSON() {
    return {
      start: this.start,
      end: this.end,
      active: this.active,
      anchor: this.anchor
    };
  }
}
