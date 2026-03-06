import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { McpClient } from "./mcp-client.js";
import { ThreadStore } from "./thread-store.js";
import { AgentRuntime } from "./agent.js";

loadEnvFile();

async function main() {
  const rl = readline.createInterface({ input, output });
  const threadStore = new ThreadStore();
  const plannerMode = process.env.PLANNER_MODE || "rule";

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

  console.log(`Connecting MCP servers... plannerMode=${plannerMode}\n`);

  for (const client of clients) {
    const res = await client.connect();
    console.log(`[connected] ${client.label}`);
    console.log(`tools: ${res.tools.map((t) => t.name).join(", ")}`);
    console.log("");
  }

  const thread = await threadStore.createThread("Demo Thread v3");

  const agent = new AgentRuntime({
    clients,
    threadStore,
    plannerMode,
    maxSteps: 6,
    askApproval: async (question) => {
      const ans = await rl.question(`${question} (y/n): `);
      return /^y(es)?$/i.test(ans.trim());
    },
  });

  console.log("Mini Codex MCP Lab v3");
  console.log(`threadId = ${thread.id}`);
  console.log("");
  console.log("Try:");
  console.log("  tools");
  console.log("  threads");
  console.log("  ls");
  console.log("  write notes/today.txt | React Fiber uses lanes");
  console.log(
    "  append notes/today.txt | \\nchildLanes bubble in completeWork",
  );
  console.log("  read notes/today.txt");
  console.log("  summarize_file notes/today.txt");
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

      console.log("\n[steps]");
      for (const s of out.steps) {
        console.log(JSON.stringify(s, null, 2));
      }

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

function loadEnvFile() {
  const envPath = path.resolve(".env");
  if (!fs.existsSync(envPath)) return;

  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;

    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();

    if (!(key in process.env)) {
      process.env[key] = stripQuotes(value);
    }
  }
}

function stripQuotes(s) {
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  return s;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
