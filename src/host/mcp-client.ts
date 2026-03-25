import { spawn, ChildProcess } from "node:child_process";
import { JsonRpcPeer } from "../shared/jsonrpc";
import { METHODS } from "../shared/protocol";

interface McpClientOptions {
  id: string;
  label: string;
  command: string;
  args?: string[];
}

export class McpClient {
  id: string;
  label: string;
  command: string;
  args: string[];
  child: ChildProcess | null;
  peer: JsonRpcPeer | null;
  tools: any[];

  constructor({ id, label, command, args = [] }: McpClientOptions) {
    this.id = id;
    this.label = label;
    this.command = command;
    this.args = args;
    this.child = null;
    this.peer = null;
    this.tools = [];
  }

  async connect(): Promise<any[]> {
    this.child = spawn(this.command, this.args, {
      stdio: ["pipe", "pipe", "inherit"],
    });

    this.peer = new JsonRpcPeer({
      input: this.child!.stdout!,
      output: this.child!.stdin!,
      onNotification: (method: string, params: any) => {
        console.log(
          `[notify:${this.label}] ${method} ${JSON.stringify(params)}`,
        );
      },
      onError: (...args: any[]) => console.error(...args),
    });

    await this.peer.request(METHODS.INITIALIZE, {
      clientInfo: { name: "mini-codex-host-v5", version: "5.0.0" },
    });

    const list = await this.peer.request(METHODS.TOOLS_LIST, {});
    this.tools = list.tools || [];
    return this.tools;
  }

  hasTool(toolName: string): boolean {
    return this.tools.some((t) => t.name === toolName);
  }

  async callTool(name: string, args: any = {}): Promise<any> {
    return this.peer!.request(METHODS.TOOLS_CALL, {
      name,
      arguments: args,
    });
  }

  async close(): Promise<void> {
    if (this.child) this.child.kill();
  }
}
