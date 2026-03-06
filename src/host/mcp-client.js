import { spawn } from "node:child_process";
import { JsonRpcPeer } from "../shared/jsonrpc.js";
import { METHODS } from "../shared/protocol.js";

export class McpClient {
  constructor() {
    this.child = null;
    this.peer = null;
  }

  async connect() {
    this.child = spawn(process.execPath, ["src/server/notes-mcp-server.js"], {
      stdio: ["pipe", "pipe", "inherit"],
    });

    this.peer = new JsonRpcPeer({
      input: this.child.stdout,
      output: this.child.stdin,
      onNotification(method, params) {
        console.log(`[server-notify] ${method}`, params);
      },
    });

    const initResult = await this.peer.request(METHODS.INITIALIZE, {
      clientInfo: {
        name: "mini-codex-host",
        version: "1.0.0",
      },
    });

    return initResult;
  }

  async listTools() {
    return this.peer.request(METHODS.TOOLS_LIST, {});
  }

  async callTool(name, args = {}) {
    return this.peer.request(METHODS.TOOLS_CALL, {
      name,
      arguments: args,
    });
  }

  async close() {
    if (this.child) {
      this.child.kill();
    }
  }
}
