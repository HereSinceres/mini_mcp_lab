import { clipText, pretty, safeJsonParse } from "../shared/utils.js";

export class AgentRuntime {
  constructor({
    clients,
    threadStore,
    skills,
    responsesClient,
    plannerTools,
    askApproval,
  }) {
    this.clients = clients;
    this.threadStore = threadStore;
    this.skills = skills;
    this.responsesClient = responsesClient;
    this.plannerTools = plannerTools;
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

  buildSystemPrompt() {
    return [
      "You are the planner for a local coding agent.",
      "Prefer using tools or skills when they clearly help.",
      "Use run_skill for higher-level workflows.",
      "Use builtins when the user asks about tools, skills, or threads.",
      "Do not invent files or tool results.",
      `Available skills: ${this.skills.map((s) => s.name).join(", ")}`,
      `Available low-level tools: ${this.getToolCatalog()
        .map((t) => t.name)
        .join(", ")}`,
    ].join("\n");
  }

  async runTurn({ threadId, userInput }) {
    const steps = [];

    const initial = await this.responsesClient.createPlannerResponse({
      systemPrompt: this.buildSystemPrompt(),
      userInput,
      tools: this.plannerTools,
    });

    steps.push({
      kind: "modelResponse",
      value: summarizeModelResponse(initial),
    });

    const toolCalls = this.responsesClient.extractToolCalls(initial);

    if (toolCalls.length === 0) {
      const assistant =
        this.responsesClient.extractOutputText(initial) || "没有可执行动作。";
      await this.threadStore.appendTurn(threadId, {
        user: userInput,
        steps,
        assistant,
      });
      return { steps, assistant };
    }

    const toolOutputs = [];

    for (const call of toolCalls) {
      steps.push({ kind: "functionCall", value: call });
      const output = await this.executeFunctionCall(call, steps);
      toolOutputs.push({ call_id: call.id, output });
    }

    const followup = await this.responsesClient.continueAfterToolCalls({
      previousResponseId: initial.id,
      toolOutputs,
    });

    steps.push({
      kind: "followupResponse",
      value: summarizeModelResponse(followup),
    });

    const assistant =
      this.responsesClient.extractOutputText(followup) ||
      "已执行，但未得到最终文本。";
    await this.threadStore.appendTurn(threadId, {
      user: userInput,
      steps,
      assistant,
    });

    return { steps, assistant };
  }

  async executeFunctionCall(call, steps) {
    const name = call.name;
    const args = call.arguments || {};

    if (name === "list_tools_builtin") {
      return this.getToolCatalog();
    }

    if (name === "list_skills_builtin") {
      return this.skills.map((s) => ({
        name: s.name,
        trigger: s.trigger,
        description: s.description,
        tools: s.tools,
      }));
    }

    if (name === "list_threads_builtin") {
      const threads = await this.threadStore.listThreads();
      return threads.map((t) => ({
        id: t.id,
        title: t.title,
        turns: t.turns.length,
        updatedAt: t.updatedAt,
      }));
    }

    if (name === "run_skill") {
      return this.runSkill(args.skillName, args.input, steps);
    }

    return this.runLowLevelTool(name, args, steps);
  }

  async runSkill(skillName, rawInput, steps) {
    const skill = this.skills.find((s) => s.name === skillName);
    if (!skill) {
      throw new Error(`Skill not found: ${skillName}`);
    }

    steps.push({
      kind: "skillStart",
      value: { name: skill.name, input: rawInput },
    });

    if (skill.name === "summarize_file") {
      const path = String(rawInput || "").trim();
      const read = await this.runLowLevelTool("read_file", { path }, steps);
      const summary = summarizeText(String(read.content || ""));
      steps.push({
        kind: "skillEnd",
        value: { name: skill.name, output: summary },
      });
      return summary;
    }

    if (skill.name === "append_note") {
      const [path, ...rest] = String(rawInput || "").split("|");
      const filePath = (path || "").trim();
      const content = rest.join("|").trim();
      await this.runLowLevelTool(
        "append_file",
        { path: filePath, content },
        steps,
      );
      const read = await this.runLowLevelTool(
        "read_file",
        { path: filePath },
        steps,
      );
      const output = `追加完成，当前文件内容：\n${clipText(read.content, 3000)}`;
      steps.push({ kind: "skillEnd", value: { name: skill.name, output } });
      return output;
    }

    if (skill.name === "calculate") {
      const expression = String(rawInput || "").trim();
      const result = await this.runLowLevelTool("calc", { expression }, steps);
      const output = `计算结果：${result.content.expression} = ${result.content.value}`;
      steps.push({ kind: "skillEnd", value: { name: skill.name, output } });
      return output;
    }

    throw new Error(`Skill logic not implemented: ${skill.name}`);
  }

  async runLowLevelTool(toolName, args, steps) {
    const client = this.findClientForTool(toolName);
    if (!client) {
      throw new Error(`No MCP server provides tool: ${toolName}`);
    }

    const isWriteTool = ["write_file", "append_file"].includes(toolName);
    if (isWriteTool) {
      const approved = await this.askApproval(
        `允许写操作？ tool=${toolName} args=${pretty(args)}`,
      );
      steps.push({ kind: "approval", value: { approved, toolName, args } });
      if (!approved) {
        throw new Error("Write operation rejected by user");
      }
    }

    steps.push({
      kind: "toolCall",
      value: { server: client.label, toolName, args },
    });

    const result = await client.callTool(toolName, args);
    const normalized = normalizeToolResult(result);

    steps.push({
      kind: "toolResult",
      value: { server: client.label, toolName, result: normalized },
    });

    return normalized;
  }
}

function summarizeModelResponse(resp) {
  return {
    id: resp?.id || null,
    output_text: resp?.output_text || "",
    output_types: Array.isArray(resp?.output)
      ? resp.output.map((x) => x.type)
      : [],
  };
}

function normalizeToolResult(result) {
  if (!result) return result;
  if (typeof result.content === "string") {
    return { ...result, content: clipText(result.content, 8000) };
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
