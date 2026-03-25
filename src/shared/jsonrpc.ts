import { Readable, Writable } from "node:stream";
import readline from "node:readline";

interface JsonRpcPeerOptions {
  input: Readable;
  output: Writable;
  onNotification?: (method: string, params: any) => void;
  onError?: (...args: any[]) => void;
}

export class JsonRpcPeer {
  input: Readable;
  output: Writable;
  onNotification: (method: string, params: any) => void;
  onError: (...args: any[]) => void;
  pending: Map<
    number,
    { resolve: (value: any) => void; reject: (reason: any) => void }
  >;
  handlers: Map<string, (params: any) => any>;
  nextId: number;

  constructor({
    input,
    output,
    onNotification = () => {},
    onError = console.error,
  }: JsonRpcPeerOptions) {
    this.input = input;
    this.output = output;
    this.onNotification = onNotification;
    this.onError = onError;
    this.pending = new Map();
    this.handlers = new Map();
    this.nextId = 1;

    const rl = readline.createInterface({ input });
    rl.on("line", (line) => {
      if (!line.trim()) return;

      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        this.onError("[jsonrpc] invalid json:", line);
        return;
      }

      this.#handle(msg);
    });
  }

  register(method: string, handler: (params: any) => any): void {
    this.handlers.set(method, handler);
  }

  request(method: string, params: any = {}): Promise<any> {
    const id = this.nextId++;
    this.output.write(
      JSON.stringify({
        jsonrpc: "2.0",
        id,
        method,
        params,
      }) + "\n",
    );

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  notify(method: string, params: any = {}): void {
    this.output.write(
      JSON.stringify({
        jsonrpc: "2.0",
        method,
        params,
      }) + "\n",
    );
  }

  async #handle(msg: any): Promise<void> {
    if (msg.method && Object.prototype.hasOwnProperty.call(msg, "id")) {
      const handler = this.handlers.get(msg.method);
      if (!handler) {
        return this.#sendError(
          msg.id,
          -32601,
          `Method not found: ${msg.method}`,
        );
      }

      try {
        const result = await handler(msg.params ?? {});
        this.#sendResult(msg.id, result);
      } catch (err: any) {
        this.#sendError(msg.id, -32000, err?.message || "Internal error");
      }
      return;
    }

    if (msg.method && !Object.prototype.hasOwnProperty.call(msg, "id")) {
      this.onNotification(msg.method, msg.params ?? {});
      return;
    }

    if (Object.prototype.hasOwnProperty.call(msg, "id")) {
      const pending = this.pending.get(msg.id);
      if (!pending) return;
      this.pending.delete(msg.id);

      if (msg.error) {
        pending.reject(new Error(msg.error.message || "RPC Error"));
      } else {
        pending.resolve(msg.result);
      }
    }
  }

  #sendResult(id: number, result: any): void {
    this.output.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
  }

  #sendError(id: number, code: number, message: string): void {
    this.output.write(
      JSON.stringify({
        jsonrpc: "2.0",
        id,
        error: { code, message },
      }) + "\n",
    );
  }
}
