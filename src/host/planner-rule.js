export function planWithRules({ userInput, state }) {
  const text = String(userInput || "").trim();

  if (!state || state.step === 0) {
    if (/^(tools)$/i.test(text)) {
      return { type: "builtin", action: "list_tools" };
    }

    if (/^(threads|history)$/i.test(text)) {
      return { type: "builtin", action: "list_threads" };
    }

    if (/^(ls|list)$/i.test(text)) {
      return {
        type: "tool",
        toolName: "list_dir",
        args: { dir: "." },
        reason: "User wants to inspect workspace files",
      };
    }

    if (/^read\b/i.test(text)) {
      const file = text.replace(/^read\b/i, "").trim();
      return {
        type: "tool",
        toolName: "read_file",
        args: { path: file },
        reason: "User wants to read a file",
      };
    }

    if (/^write\b/i.test(text)) {
      const body = text.replace(/^write\b/i, "").trim();
      const [file, ...rest] = body.split("|");
      return {
        type: "tool",
        toolName: "write_file",
        args: {
          path: (file || "").trim(),
          content: rest.join("|").trim(),
        },
        reason: "User wants to write a file",
      };
    }

    if (/^append\b/i.test(text)) {
      const body = text.replace(/^append\b/i, "").trim();
      const [file, ...rest] = body.split("|");
      return {
        type: "tool",
        toolName: "append_file",
        args: {
          path: (file || "").trim(),
          content: rest.join("|").trim(),
        },
        reason: "User wants to append a file",
      };
    }

    if (/^calc\b/i.test(text)) {
      const expression = text.replace(/^calc\b/i, "").trim();
      return {
        type: "tool",
        toolName: "calc",
        args: { expression },
        reason: "User wants a calculation",
      };
    }

    if (/^summarize_file\b/i.test(text)) {
      const file = text.replace(/^summarize_file\b/i, "").trim();
      return {
        type: "tool",
        toolName: "read_file",
        args: { path: file },
        reason: "Need file content before summarizing",
      };
    }

    return {
      type: "answer",
      text: [
        "支持命令：",
        "  tools",
        "  threads",
        "  ls",
        "  read <path>",
        "  write <path> | <content>",
        "  append <path> | <content>",
        "  calc <expression>",
        "  summarize_file <path>",
      ].join("\n"),
    };
  }

  if (
    state.originalUserInput &&
    /^summarize_file\b/i.test(state.originalUserInput) &&
    state.lastToolName === "read_file"
  ) {
    const content = String(state.lastToolResult?.content || "");
    const summary = summarizeText(content);
    return {
      type: "answer",
      text: summary,
    };
  }

  if (state.lastToolName === "list_dir") {
    return {
      type: "answer",
      text: `目录内容如下：\n${JSON.stringify(state.lastToolResult?.content ?? [], null, 2)}`,
    };
  }

  if (state.lastToolName === "read_file") {
    return {
      type: "answer",
      text: String(state.lastToolResult?.content ?? ""),
    };
  }

  if (state.lastToolName === "write_file") {
    return {
      type: "answer",
      text: `写入成功：${JSON.stringify(state.lastToolResult?.content ?? {}, null, 2)}`,
    };
  }

  if (state.lastToolName === "append_file") {
    return {
      type: "answer",
      text: `追加成功：${JSON.stringify(state.lastToolResult?.content ?? {}, null, 2)}`,
    };
  }

  if (state.lastToolName === "calc") {
    const c = state.lastToolResult?.content ?? {};
    return {
      type: "answer",
      text: `计算结果：${c.expression} = ${c.value}`,
    };
  }

  return {
    type: "done",
  };
}

function summarizeText(text) {
  const lines = String(text)
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return "文件为空。";
  }

  const first = lines.slice(0, 3);
  const keywords = extractKeywords(lines.join(" "));
  const bullets = [
    `1. 文件共有 ${lines.length} 行，开头内容主要是：${first.join(" / ")}`,
    `2. 高频关键词可能包括：${keywords.join("、") || "无明显关键词"}`,
    `3. 总结：这份文件主要围绕上述内容展开，可继续做结构化提炼或改写。`,
  ];

  return bullets.join("\n");
}

function extractKeywords(text) {
  const stop = new Set([
    "the",
    "and",
    "for",
    "that",
    "with",
    "this",
    "from",
    "are",
    "was",
    "you",
    "我",
    "你",
    "他",
    "她",
    "它",
    "的",
    "了",
    "是",
    "在",
    "和",
    "与",
    "就",
    "都",
    "to",
    "of",
    "a",
    "an",
    "is",
    "in",
    "on",
    "as",
    "by",
    "or",
  ]);

  const words =
    text.toLowerCase().match(/[\u4e00-\u9fa5]{2,}|[a-z]{3,}/g) || [];

  const freq = new Map();
  for (const w of words) {
    if (stop.has(w)) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k]) => k);
}
