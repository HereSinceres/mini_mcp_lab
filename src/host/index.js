import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { McpClient } from "./mcp-client.js";
import { plan } from "./planner.js";

function pretty(value) {
  return JSON.stringify(value, null, 2);
}

async function askApproval(question, rl) {
  const answer = await rl.question(`${question} (y/n): `);
  return /^y(es)?$/i.test(answer.trim());
}

async function main() {
  const rl = readline.createInterface({ input, output });
  const client = new McpClient();

  console.log("Connecting MCP server...");
  const init = await client.connect();
  console.log("Connected:", pretty(init));

  const tools = await client.listTools();
  console.log("Available tools:", pretty(tools));

  console.log("\nMini Codex MCP Lab");
  console.log("Commands:");
  console.log("  add 标题 | 内容");
  console.log("  list");
  console.log("  search 关键词");
  console.log("  exit\n");

  while (true) {
    const userInput = await rl.question("> ");
    if (userInput.trim() === "exit") break;

    const step = plan(userInput);

    if (step.type === "answer") {
      console.log(step.text);
      continue;
    }

    const approved = await askApproval(
      `允许调用工具 ${step.toolName}，参数 ${pretty(step.args)} ?`,
      rl,
    );

    if (!approved) {
      console.log("已拒绝工具调用。");
      continue;
    }

    try {
      const result = await client.callTool(step.toolName, step.args);
      console.log("\n[tool result]");
      console.log(pretty(result));

      console.log("\n[agent answer]");
      if (step.toolName === "list_notes") {
        const notes = result.content || [];
        console.log(`共有 ${notes.length} 条笔记`);
      } else if (step.toolName === "search_notes") {
        const notes = result.content || [];
        console.log(`搜索到 ${notes.length} 条结果`);
      } else if (step.toolName === "add_note") {
        console.log(`已新增笔记：${result.content?.title}`);
      }
      console.log("");
    } catch (err) {
      console.error("[host error]", err.message);
    }
  }

  await client.close();
  rl.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
