import { spawn } from "node:child_process";
import { JsonRpcPeer } from "../shared/jsonrpc.js";
import { METHODS } from "../shared/protocol.js";

export class McpClient {
  constructor({ id, label, command, args = [] }) {
    this.id = id;
    this.label = label;
    this.command = command;
    this.args = args;
    this.child = null;
    this.peer = null;
    this.tools = [];
  }

  async connect() {
    this.child = spawn(this.command, this.args, {
      stdio: ["pipe", "pipe", "inherit"]
    });

    this.peer = new JsonRpcPeer({
      input: this.child.stdout,
      output: this.child.stdin,
      onNotification: (method, params) => {
        console.log(`[notify:${this.label}] ${method} ${JSON.stringify(params)}`);
      },
      onError: (...args) => console.error(...args)
    });

    await this.peer.request(METHODS.INITIALIZE, {
      clientInfo: { name: "mini-codex-host-v5", version: "5.0.0" }
    });

    const list = await this.peer.request(METHODS.TOOLS_LIST, {});
    this.tools = list.tools || [];
    return this.tools;
  }

  hasTool(toolName) {
    return this.tools.some((t) => t.name === toolName);
  }

  async callTool(name, args = {}) {
    return this.peer.request(METHODS.TOOLS_CALL, {
      name,
      arguments: args
    });
  }

  async close() {
    if (this.child) this.child.kill();
  }
}