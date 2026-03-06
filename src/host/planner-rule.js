export function planWithRules(userInput, toolCatalog) {
  const text = userInput.trim();

  if (/^(threads|history)$/i.test(text)) {
    return { type: "builtin", action: "list_threads" };
  }

  if (/^(tools)$/i.test(text)) {
    return { type: "builtin", action: "list_tools" };
  }

  if (/^(list|ls)\b/i.test(text)) {
    return {
      type: "tool",
      toolName: "list_dir",
      args: { dir: "." }
    };
  }

  if (/^(read)\b/i.test(text)) {
    const path = text.replace(/^read\b/i, "").trim();
    return {
      type: "tool",
      toolName: "read_file",
      args: { path }
    };
  }

  if (/^(write)\b/i.test(text)) {
    const body = text.replace(/^write\b/i, "").trim();
    const [file, ...rest] = body.split("|");
    return {
      type: "tool",
      toolName: "write_file",
      args: {
        path: (file || "").trim(),
        content: rest.join("|").trim()
      }
    };
  }

  if (/^(append)\b/i.test(text)) {
    const body = text.replace(/^append\b/i, "").trim();
    const [file, ...rest] = body.split("|");
    return {
      type: "tool",
      toolName: "append_file",
      args: {
        path: (file || "").trim(),
        content: rest.join("|").trim()
      }
    };
  }

  if (/^(calc)\b/i.test(text)) {
    const expression = text.replace(/^calc\b/i, "").trim();
    return {
      type: "tool",
      toolName: "calc",
      args: { expression }
    };
  }

  return {
    type: "answer",
    text: [
      "支持命令：",
      "  tools",
      "  threads",
      "  ls / list",
      "  read <path>",
      "  write <path> | <content>",
      "  append <path> | <content>",
      "  calc <expression>"
    ].join("\n")
  };
}