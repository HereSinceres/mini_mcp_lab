export function planInput({ userInput, skills }) {
  const text = String(userInput || "").trim();

  if (/^(tools)$/i.test(text)) {
    return { type: "builtin", action: "list_tools" };
  }

  if (/^(skills)$/i.test(text)) {
    return { type: "builtin", action: "list_skills" };
  }

  if (/^(threads|history)$/i.test(text)) {
    return { type: "builtin", action: "list_threads" };
  }

  if (/^ls$|^list$/i.test(text)) {
    return {
      type: "tool",
      toolName: "list_dir",
      args: { dir: "." },
    };
  }

  if (/^read\b/i.test(text)) {
    return {
      type: "tool",
      toolName: "read_file",
      args: {
        path: text.replace(/^read\b/i, "").trim(),
      },
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
    };
  }

  if (/^calc\b/i.test(text)) {
    return {
      type: "tool",
      toolName: "calc",
      args: {
        expression: text.replace(/^calc\b/i, "").trim(),
      },
    };
  }

  const matchedSkill = matchSkill(text, skills);
  if (matchedSkill) {
    return {
      type: "skill",
      skillName: matchedSkill.name,
      args: extractSkillArgs(text, matchedSkill),
    };
  }

  return {
    type: "answer",
    text: [
      "支持命令：",
      "  tools",
      "  skills",
      "  threads",
      "  ls",
      "  read <path>",
      "  write <path> | <content>",
      "  append <path> | <content>",
      "  calc <expression>",
      "  summarize_file <path>",
      "  append_note <path> | <content>",
      "  calculate <expression>",
    ].join("\n"),
  };
}

function matchSkill(text, skills) {
  return (
    skills.find((skill) => {
      return text.startsWith(skill.trigger);
    }) || null
  );
}

function extractSkillArgs(text, skill) {
  const raw = text.slice(skill.trigger.length).trim();

  if (skill.name === "summarize_file") {
    return { path: raw };
  }

  if (skill.name === "append_note") {
    const [path, ...rest] = raw.split("|");
    return {
      path: (path || "").trim(),
      content: rest.join("|").trim(),
    };
  }

  if (skill.name === "calculate") {
    return { expression: raw };
  }

  return { raw };
}
