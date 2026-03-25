import fs from "fs";
import path from "path";
import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { McpClient } from "./mcp-client";
import { ThreadStore } from "./thread-store";
import { loadSkills } from "./skill-loader";
import { buildPlannerTools } from "./planner-tools";
import { ResponsesClient } from "./responses-client";
import { AgentRuntime } from "./agent";

loadEnvFile();

async function main() {
  const useTsRuntime = import.meta.url.endsWith(".ts");
  const rl = readline.createInterface({ input, output });
  const threadStore = new ThreadStore();
  const skills = loadSkills();
  console.log("Loaded skills:", skills.map((s) => s.name).join(", "));

  const clients = [
    new McpClient({
      id: "fs",
      label: "filesystem",
      command: process.execPath,
      args: resolveServerArgs("fs-server", useTsRuntime),
    }),
    new McpClient({
      id: "math",
      label: "math",
      command: process.execPath,
      args: resolveServerArgs("math-server", useTsRuntime),
    }),
  ];

  console.log("Connecting MCP servers...\n");

  for (const client of clients) {
    const tools = await client.connect();
    console.log(`[connected] ${client.label}`);
    console.log(`tools: ${tools.map((t) => t.name).join(", ")}`);
    console.log("");
  }

  const thread = await threadStore.createThread("Demo Thread v5");
  const responsesClient = new ResponsesClient({
    apiKey: process.env.OPENAI_API_KEY || "",
    baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
    useRealModel: /^true$/i.test(process.env.USE_REAL_MODEL || "false"),
  });

  const plannerTools = buildPlannerTools(skills);

  const agent = new AgentRuntime({
    clients,
    threadStore,
    skills,
    responsesClient,
    plannerTools,
    askApproval: async (question) => {
      const ans = await rl.question(`${question} (y/n): `);
      return /^y(es)?$/i.test(ans.trim());
    },
  });

  console.log("Mini Codex MCP Lab v5");
  console.log(`threadId = ${thread.id}`);
  console.log(`USE_REAL_MODEL = ${process.env.USE_REAL_MODEL || "false"}`);
  console.log("");
  console.log("Try:");
  console.log("  tools");
  console.log("  skills");
  console.log("  threads");
  console.log("  ls");
  console.log("  write notes/today.txt | React Fiber uses lanes");
  console.log(
    "  append notes/today.txt | \\nchildLanes bubble in completeWork",
  );
  console.log("  read notes/today.txt");
  console.log("  summarize_file notes/today.txt");
  console.log("  append_note notes/today.txt | \\nthird line");
  console.log("  calculate (3 + 5) * 9");
  console.log("  calc (9 + 1) * 3");
  console.log("  exit");
  console.log("");

  while (true) {
    const userInput = await rl.question("> ");
    if (userInput.trim() === "exit") break;

    try {
      const result = await agent.runTurn({
        threadId: thread.id,
        userInput,
      });

      console.log("\n[steps]");
      for (const step of result.steps) {
        console.log(JSON.stringify(step, null, 2));
      }

      console.log("\n[assistant]");
      console.log(result.assistant);
      console.log("");
    } catch (err: any) {
      console.error("[error]", err.message);
      console.log("");
    }
  }

  for (const client of clients) {
    await client.close();
  }
  rl.close();
}

function resolveServerArgs(serverName: string, useTsRuntime: boolean): string[] {
  if (useTsRuntime) {
    return [
      "--loader",
      "ts-node/esm",
      "--experimental-specifier-resolution=node",
      path.resolve(`src/servers/${serverName}.ts`),
    ];
  }

  return [path.resolve(`dist/servers/${serverName}.js`)];
}

function loadEnvFile(): void {
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

function stripQuotes(s: string): string {
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
