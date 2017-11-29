const { MockTextEditor } = require("../lib/MockTextEditor");

test("adds 1 + 2 to equal 3", () => {
  const editor = new MockTextEditor();
  expect(editor.renderAsString()).toBe("sample\nfile");
});
