import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import path from "node:path";
import { McpClient } from "./mcp-client.js";
import { ThreadStore } from "./thread-store.js";
import { AgentRuntime } from "./agent.js";

async function main() {
  const rl = readline.createInterface({ input, output });
  const threadStore = new ThreadStore();

  const clients = [
    new McpClient({
      id: "fs",
      label: "filesystem",
      command: process.execPath,
      args: [path.resolve("src/servers/fs-server.js")],
    }),
    new McpClient({
      id: "math",
      label: "math",
      command: process.execPath,
      args: [path.resolve("src/servers/math-server.js")],
    }),
  ];

  console.log("Connecting MCP servers...\n");

  for (const client of clients) {
    const res = await client.connect();
    console.log(`[connected] ${client.label}`);
    console.log(`tools: ${res.tools.map((t) => t.name).join(", ")}`);
    console.log("");
  }

  const thread = await threadStore.createThread("Demo Thread");

  const agent = new AgentRuntime({
    clients,
    threadStore,
    askApproval: async (question) => {
      const ans = await rl.question(`${question} (y/n): `);
      return /^y(es)?$/i.test(ans.trim());
    },
  });

  console.log("Mini Codex MCP Lab v2");
  console.log(`threadId = ${thread.id}`);
  console.log("");
  console.log("Try:");
  console.log("  tools");
  console.log("  threads");
  console.log("  ls");
  console.log("  write notes/today.txt | hello mcp");
  console.log("  append notes/today.txt | \\nsecond line");
  console.log("  read notes/today.txt");
  console.log("  calc (3 + 5) * 9");
  console.log("  exit");
  console.log("");

  while (true) {
    const userInput = await rl.question("> ");
    if (userInput.trim() === "exit") break;

    try {
      const out = await agent.runTurn({
        threadId: thread.id,
        userInput,
      });

      console.log("\n[assistant]");
      console.log(out.assistant);
      console.log("");
    } catch (err) {
      console.error("[error]", err.message);
      console.log("");
    }
  }

  for (const client of clients) {
    await client.close();
  }
  rl.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
