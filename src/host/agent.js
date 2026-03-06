import { clipText, pretty } from "../shared/utils.js";

export class AgentRuntime {
  constructor({ clients, threadStore, skills, askApproval }) {
    this.clients = clients;
    this.threadStore = threadStore;
    this.skills = skills;
    this.askApproval = askApproval;
  }

  getToolCatalog() {
    const rows = [];
    for (const client of this.clients) {
      for (const tool of client.tools) {
        rows.push({
          server: client.label,
          name: tool.name,
          description: tool.description,
        });
      }
    }
    return rows;
  }

  findClientForTool(toolName) {
    return this.clients.find((c) => c.hasTool(toolName)) || null;
  }

  async run({ threadId, plan, userInput }) {
    let assistant = "";
    const steps = [];

    if (plan.type === "builtin") {
      if (plan.action === "list_tools") {
        assistant = pretty(this.getToolCatalog());
      } else if (plan.action === "list_skills") {
        assistant = pretty(
          this.skills.map((s) => ({
            name: s.name,
            trigger: s.trigger,
            description: s.description,
            tools: s.tools,
          })),
        );
      } else if (plan.action === "list_threads") {
        const threads = await this.threadStore.listThreads();
        assistant = pretty(
          threads.map((t) => ({
            id: t.id,
            title: t.title,
            turns: t.turns.length,
            updatedAt: t.updatedAt,
          })),
        );
      } else {
        throw new Error(`Unsupported builtin action: ${plan.action}`);
      }

      await this.threadStore.appendTurn(threadId, {
        user: userInput,
        plan,
        steps,
        assistant,
      });

      return { steps, assistant };
    }

    if (plan.type === "tool") {
      const result = await this.#runTool(plan.toolName, plan.args, steps);
      assistant = this.#formatToolAnswer(plan.toolName, result);

      await this.threadStore.appendTurn(threadId, {
        user: userInput,
        plan,
        steps,
        assistant,
      });

      return { steps, assistant };
    }

    if (plan.type === "skill") {
      const skill = this.skills.find((s) => s.name === plan.skillName);
      if (!skill) {
        assistant = `Skill not found: ${plan.skillName}`;
      } else {
        assistant = await this.#runSkill(skill, plan.args, steps);
      }

      await this.threadStore.appendTurn(threadId, {
        user: userInput,
        plan,
        steps,
        assistant,
      });

      return { steps, assistant };
    }

    if (plan.type === "answer") {
      assistant = plan.text;

      await this.threadStore.appendTurn(threadId, {
        user: userInput,
        plan,
        steps,
        assistant,
      });

      return { steps, assistant };
    }

    throw new Error(`Unsupported plan type: ${plan.type}`);
  }

  async #runSkill(skill, args, steps) {
    steps.push({
      kind: "skill",
      value: {
        name: skill.name,
        trigger: skill.trigger,
        args,
      },
    });

    if (skill.name === "summarize_file") {
      const readResult = await this.#runTool(
        "read_file",
        { path: args.path },
        steps,
      );
      return summarizeText(String(readResult.content || ""));
    }

    if (skill.name === "append_note") {
      await this.#runTool(
        "append_file",
        { path: args.path, content: args.content },
        steps,
      );
      const readResult = await this.#runTool(
        "read_file",
        { path: args.path },
        steps,
      );
      return `追加完成，当前文件内容：\n${clipText(readResult.content, 3000)}`;
    }

    if (skill.name === "calculate") {
      const result = await this.#runTool(
        "calc",
        { expression: args.expression },
        steps,
      );
      return `计算结果：${result.content.expression} = ${result.content.value}`;
    }

    return `Skill ${skill.name} 暂未实现执行逻辑。`;
  }

  async #runTool(toolName, args, steps) {
    const client = this.findClientForTool(toolName);
    if (!client) {
      throw new Error(`No MCP server provides tool: ${toolName}`);
    }

    const isWriteTool = ["write_file", "append_file"].includes(toolName);
    if (isWriteTool) {
      const approved = await this.askApproval(
        `允许写操作？ tool=${toolName} args=${pretty(args)}`,
      );

      steps.push({
        kind: "approval",
        value: { approved, toolName, args },
      });

      if (!approved) {
        throw new Error("Write operation rejected by user");
      }
    }

    steps.push({
      kind: "toolCall",
      value: {
        server: client.label,
        toolName,
        args,
      },
    });

    const result = await client.callTool(toolName, args);

    const normalized = normalizeToolResult(result);

    steps.push({
      kind: "toolResult",
      value: {
        server: client.label,
        toolName,
        result: normalized,
      },
    });

    return normalized;
  }

  #formatToolAnswer(toolName, result) {
    if (toolName === "list_dir") {
      return `目录内容：\n${pretty(result.content)}`;
    }

    if (toolName === "read_file") {
      return clipText(result.content, 4000);
    }

    if (toolName === "write_file") {
      return `写入成功：\n${pretty(result.content)}`;
    }

    if (toolName === "append_file") {
      return `追加成功：\n${pretty(result.content)}`;
    }

    if (toolName === "calc") {
      return `计算结果：${result.content.expression} = ${result.content.value}`;
    }

    return pretty(result);
  }
}

function normalizeToolResult(result) {
  if (!result) return result;
  if (typeof result.content === "string") {
    return {
      ...result,
      content: clipText(result.content, 8000),
    };
  }
  return result;
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

  return [
    `1. 文件共有 ${lines.length} 行，开头内容：${first.join(" / ")}`,
    `2. 关键词：${keywords.join("、") || "无明显关键词"}`,
    "3. 总结：这份文件适合继续做提纲、改写或结构化抽取。",
  ].join("\n");
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
    "的",
    "了",
    "是",
    "在",
    "和",
    "与",
    "就",
    "都",
    "我",
    "你",
  ]);

  const words =
    text.toLowerCase().match(/[\u4e00-\u9fa5]{2,}|[a-z]{3,}/g) || [];
  const freq = new Map();

  for (const word of words) {
    if (stop.has(word)) continue;
    freq.set(word, (freq.get(word) || 0) + 1);
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k]) => k);
}
