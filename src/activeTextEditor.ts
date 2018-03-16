import { TextEditor } from "./editor";

let activeTextEditor: TextEditor = null;

export function setActiveTextEditor(ed: TextEditor) {
  activeTextEditor = ed;
}

export function getActiveTextEditor(): TextEditor {
  return activeTextEditor;
}
