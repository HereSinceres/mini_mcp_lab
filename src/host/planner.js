export function plan(userInput) {
  const text = userInput.trim();

  if (/^list\b|^show\b|查看|列出/.test(text)) {
    return {
      type: "tool",
      toolName: "list_notes",
      args: {},
    };
  }

  if (/^search\b|搜索|查找/.test(text)) {
    const keyword = text
      .replace(/^search\b/i, "")
      .replace(/搜索|查找/g, "")
      .trim();

    return {
      type: "tool",
      toolName: "search_notes",
      args: { keyword },
    };
  }

  if (/^add\b|新增|添加/.test(text)) {
    const body = text
      .replace(/^add\b/i, "")
      .replace(/新增|添加/g, "")
      .trim();

    const [title, ...rest] = body.split("|");
    return {
      type: "tool",
      toolName: "add_note",
      args: {
        title: (title || "").trim() || "Untitled",
        content: rest.join("|").trim() || "",
      },
    };
  }

  return {
    type: "answer",
    text: [
      "我现在支持这些命令：",
      "1. add 标题 | 内容",
      "2. list",
      "3. search 关键词",
    ].join("\n"),
  };
}
