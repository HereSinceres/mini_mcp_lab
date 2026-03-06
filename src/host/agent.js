import { pretty, clipText } from "../shared/utils.js";
import { planWithRules } from "./planner-rule.js";
import { planWithLLM } from "./planner-llm.js";
import { callModel } from "./model.js";

export class AgentRuntime {
  constructor({
    clients,
    threadStore,
    askApproval,
    plannerMode = "llm",
    maxSteps = 6,
  }) {
    this.clients = clients;
    this.threadStore = threadStore;
    this.askApproval = askApproval;
    this.plannerMode = plannerMode;
    this.maxSteps = maxSteps;
  }

  getToolCatalog() {
    const rows = [];
    for (const client of this.clients) {
      for (const tool of client.tools) {
        rows.push({
          serverId: client.id,
          serverLabel: client.label,
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema ?? null,
        });
      }
    }
    return rows;
  }

  findClientForTool(toolName) {
    return this.clients.find((c) => c.hasTool(toolName)) || null;
  }

  async planStep({ userInput, state }) {
    if (this.plannerMode === "llm") {
      return planWithLLM({
        userInput,
        state,
        toolCatalog: this.getToolCatalog(),
        callModel,
      });
    }

    return planWithRules({ userInput, state });
  }

  async runTurn({ threadId, userInput }) {
    const steps = [];
    let finalAnswer = "";
    let state = {
      step: 0,
      originalUserInput: userInput,
      lastToolName: null,
      lastToolResult: null,
    };

    for (let i = 0; i < this.maxSteps; i += 1) {
      const plan = await this.planStep({ userInput, state });
      steps.push({ kind: "plan", value: plan });

      if (plan.type === "answer") {
        finalAnswer = plan.text;
        break;
      }

      if (plan.type === "done") {
        if (!finalAnswer) finalAnswer = "已完成。";
        break;
      }

      if (plan.type === "builtin") {
        if (plan.action === "list_tools") {
          finalAnswer = pretty(this.getToolCatalog());
          break;
        }

        if (plan.action === "list_threads") {
          const threads = await this.threadStore.listThreads();
          finalAnswer = pretty(
            threads.map((t) => ({
              id: t.id,
              title: t.title,
              turns: t.turns.length,
              updatedAt: t.updatedAt,
            })),
          );
          break;
        }

        throw new Error(`Unsupported builtin action: ${plan.action}`);
      }

      if (plan.type !== "tool") {
        throw new Error(`Unsupported plan type: ${plan.type}`);
      }

      const client = this.findClientForTool(plan.toolName);
      if (!client) {
        finalAnswer = `No server provides tool: ${plan.toolName}`;
        break;
      }

      const isWriteTool = ["write_file", "append_file"].includes(plan.toolName);
      if (isWriteTool) {
        const ok = await this.askApproval(
          `允许写操作？ tool=${plan.toolName} args=${pretty(plan.args)}`,
        );

        steps.push({
          kind: "approval",
          value: {
            approved: ok,
            toolName: plan.toolName,
            args: plan.args,
          },
        });

        if (!ok) {
          finalAnswer = "已拒绝写操作。";
          break;
        }
      }

      const result = await client.callTool(plan.toolName, plan.args);
      steps.push({
        kind: "toolResult",
        value: {
          server: client.label,
          toolName: plan.toolName,
          args: plan.args,
          result: normalizeToolResult(result),
        },
      });

      state = {
        step: state.step + 1,
        originalUserInput: state.originalUserInput,
        lastToolName: plan.toolName,
        lastToolResult: normalizeToolResult(result),
      };
    }

    if (!finalAnswer) {
      finalAnswer = "未在限定步骤内得到最终回答。";
    }

    await this.threadStore.appendTurn(threadId, {
      user: userInput,
      steps,
      assistant: finalAnswer,
    });

    return {
      steps,
      assistant: finalAnswer,
    };
  }
}

function normalizeToolResult(result) {
  if (!result) return result;
  if (typeof result.content === "string") {
    return {
      ...result,
      content: clipText(result.content, 6000),
    };
  }
  return result;
}
