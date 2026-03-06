import { pretty } from "../shared/utils.js";
import { planWithRules } from "./planner-rule.js";

export class AgentRuntime {
  constructor({ clients, threadStore, askApproval }) {
    this.clients = clients;
    this.threadStore = threadStore;
    this.askApproval = askApproval;
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
        });
      }
    }
    return rows;
  }

  findClientForTool(toolName) {
    return this.clients.find((c) => c.hasTool(toolName)) || null;
  }

  async runTurn({ threadId, userInput }) {
    const catalog = this.getToolCatalog();
    const plan = planWithRules(userInput, catalog);

    if (plan.type === "answer") {
      const assistant = plan.text;
      await this.threadStore.appendTurn(threadId, {
        user: userInput,
        plan,
        assistant,
      });
      return { plan, assistant };
    }

    if (plan.type === "builtin") {
      if (plan.action === "list_tools") {
        const assistant = pretty(catalog);
        await this.threadStore.appendTurn(threadId, {
          user: userInput,
          plan,
          assistant,
        });
        return { plan, assistant };
      }

      if (plan.action === "list_threads") {
        const threads = await this.threadStore.listThreads();
        const assistant = pretty(
          threads.map((t) => ({
            id: t.id,
            title: t.title,
            turns: t.turns.length,
            updatedAt: t.updatedAt,
          })),
        );
        await this.threadStore.appendTurn(threadId, {
          user: userInput,
          plan,
          assistant,
        });
        return { plan, assistant };
      }
    }

    if (plan.type === "tool") {
      const client = this.findClientForTool(plan.toolName);
      if (!client) {
        const assistant = `No server provides tool: ${plan.toolName}`;
        await this.threadStore.appendTurn(threadId, {
          user: userInput,
          plan,
          assistant,
        });
        return { plan, assistant };
      }

      const isWriteTool = ["write_file", "append_file"].includes(plan.toolName);
      if (isWriteTool) {
        const ok = await this.askApproval(
          `允许写操作？ tool=${plan.toolName} args=${pretty(plan.args)}`,
        );
        if (!ok) {
          const assistant = "已拒绝写操作。";
          await this.threadStore.appendTurn(threadId, {
            user: userInput,
            plan,
            assistant,
            toolCall: {
              server: client.label,
              name: plan.toolName,
              args: plan.args,
              approved: false,
            },
          });
          return { plan, assistant };
        }
      }

      const result = await client.callTool(plan.toolName, plan.args);

      let assistant = "";
      if (plan.toolName === "list_dir") {
        assistant = `目录内容：\n${pretty(result.content)}`;
      } else if (plan.toolName === "read_file") {
        assistant = String(result.content);
      } else if (plan.toolName === "write_file") {
        assistant = `写入成功：${pretty(result.content)}`;
      } else if (plan.toolName === "append_file") {
        assistant = `追加成功：${pretty(result.content)}`;
      } else if (plan.toolName === "calc") {
        assistant = `计算结果：${result.content.expression} = ${result.content.value}`;
      } else {
        assistant = pretty(result);
      }

      await this.threadStore.appendTurn(threadId, {
        user: userInput,
        plan,
        toolCall: {
          server: client.label,
          name: plan.toolName,
          args: plan.args,
          approved: true,
        },
        toolResult: result,
        assistant,
      });

      return { plan, result, assistant };
    }

    throw new Error(`Unsupported plan type: ${plan.type}`);
  }
}
