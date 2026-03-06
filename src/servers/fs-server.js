import fs from "node:fs/promises";
import path from "node:path";
import { JsonRpcPeer } from "../shared/jsonrpc.js";
import { METHODS, NOTIFICATIONS } from "../shared/protocol.js";

const ROOT = path.resolve(process.cwd(), "workspace");

function assertSafePath(inputPath) {
  const full = path.resolve(ROOT, inputPath || ".");
  if (!full.startsWith(ROOT)) {
    throw new Error("Path escapes workspace");
  }
  return full;
}

const peer = new JsonRpcPeer({
  input: process.stdin,
  output: process.stdout,
  onError: (...args) => console.error(...args),
});

peer.register(METHODS.INITIALIZE, async (params) => {
  await fs.mkdir(ROOT, { recursive: true });

  peer.notify(NOTIFICATIONS.LOG, {
    level: "info",
    message: `fs-server initialized by ${params?.clientInfo?.name || "unknown"}`,
  });

  return {
    serverInfo: {
      name: "fs-server",
      version: "4.0.0",
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
        name: "list_dir",
        description: "List files under a workspace-relative directory",
        inputSchema: {
          type: "object",
          properties: {
            dir: { type: "string" },
          },
        },
      },
      {
        name: "read_file",
        description: "Read a workspace-relative UTF-8 file",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string" },
          },
          required: ["path"],
        },
      },
      {
        name: "write_file",
        description: "Overwrite a workspace-relative UTF-8 file",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string" },
            content: { type: "string" },
          },
          required: ["path", "content"],
        },
      },
      {
        name: "append_file",
        description: "Append text to a workspace-relative UTF-8 file",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string" },
            content: { type: "string" },
          },
          required: ["path", "content"],
        },
      },
    ],
  };
});

peer.register(METHODS.TOOLS_CALL, async (params) => {
  const { name, arguments: args = {} } = params || {};
  peer.notify(NOTIFICATIONS.TOOL_STARTED, { name, args });

  let result;

  if (name === "list_dir") {
    const dir = assertSafePath(args.dir || ".");
    await fs.mkdir(dir, { recursive: true });
    const items = await fs.readdir(dir, { withFileTypes: true });
    result = {
      content: items.map((item) => ({
        name: item.name,
        type: item.isDirectory() ? "dir" : "file",
      })),
    };
  } else if (name === "read_file") {
    const file = assertSafePath(args.path);
    const text = await fs.readFile(file, "utf8");
    result = { content: text };
  } else if (name === "write_file") {
    const file = assertSafePath(args.path);
    await fs.mkdir(path.dirname(file), { recursive: true });
    peer.notify(NOTIFICATIONS.TOOL_PROGRESS, { name, percent: 50 });
    await fs.writeFile(file, args.content, "utf8");
    result = {
      content: {
        ok: true,
        path: args.path,
        bytes: Buffer.byteLength(args.content),
      },
    };
  } else if (name === "append_file") {
    const file = assertSafePath(args.path);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.appendFile(file, args.content, "utf8");
    result = {
      content: {
        ok: true,
        path: args.path,
        appendedBytes: Buffer.byteLength(args.content),
      },
    };
  } else {
    throw new Error(`Unknown tool: ${name}`);
  }

  peer.notify(NOTIFICATIONS.TOOL_FINISHED, { name });
  return result;
});
