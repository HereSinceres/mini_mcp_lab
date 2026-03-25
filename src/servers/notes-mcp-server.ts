import fs from "node:fs/promises";
import path from "node:path";
import { JsonRpcPeer } from "../shared/jsonrpc";
import { METHODS, NOTIFICATIONS } from "../shared/protocol";

const DB_FILE = path.resolve(process.cwd(), ".notes-dbon");

async function readDb() {
  try {
    const text = await fs.readFile(DB_FILE, "utf8");
    return JSON.parse(text);
  } catch {
    return { notes: [] };
  }
}

async function writeDb(db: any): Promise<void> {
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), "utf8");
}

const peer = new JsonRpcPeer({
  input: process.stdin,
  output: process.stdout,
  onNotification(method, params) {
    if (method === "approval/response") {
      // 这个 demo 里不在 server 侧处理审批，只是占位
      console.error("[server] approval response:", params);
    }
  },
});

peer.register(METHODS.INITIALIZE, async (params) => {
  peer.notify(NOTIFICATIONS.LOG, {
    level: "info",
    message: `server initialized by ${params?.clientInfo?.name || "unknown-client"}`,
  });

  return {
    serverInfo: {
      name: "notes-mcp-server",
      version: "1.0.0",
    },
    capabilities: {
      tools: true,
    },
  };
});

peer.register(METHODS.TOOLS_LIST, async () => {
  return {
    tools: [
      {
        name: "list_notes",
        description: "List all notes",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "add_note",
        description: "Add a note",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string" },
            content: { type: "string" },
          },
          required: ["title", "content"],
        },
      },
      {
        name: "search_notes",
        description: "Search notes by keyword",
        inputSchema: {
          type: "object",
          properties: {
            keyword: { type: "string" },
          },
          required: ["keyword"],
        },
      },
    ],
  };
});

peer.register(METHODS.TOOLS_CALL, async (params) => {
  const { name, arguments: args = {} } = params || {};

  peer.notify(NOTIFICATIONS.TOOL_STARTED, { name, args });

  const db = await readDb();
  let result;

  if (name === "list_notes") {
    result = {
      content: db.notes,
    };
  } else if (name === "add_note") {
    const note = {
      id: Date.now().toString(),
      title: args.title,
      content: args.content,
      createdAt: new Date().toISOString(),
    };
    db.notes.push(note);
    await writeDb(db);
    result = {
      content: note,
    };
  } else if (name === "search_notes") {
    const keyword = String(args.keyword || "").toLowerCase();
    result = {
      content: db.notes.filter(
        (n: any) =>
          n.title.toLowerCase().includes(keyword) ||
          n.content.toLowerCase().includes(keyword),
      ),
    };
  } else {
    throw new Error(`Unknown tool: ${name}`);
  }

  peer.notify(NOTIFICATIONS.TOOL_FINISHED, { name });
  return result;
});
