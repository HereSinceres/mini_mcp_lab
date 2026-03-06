import readline from "node:readline";

export class JsonRpcPeer {
  constructor({
    input,
    output,
    onNotification = () => {},
    onError = console.error,
  }) {
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

  register(method, handler) {
    this.handlers.set(method, handler);
  }

  request(method, params = {}) {
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

  notify(method, params = {}) {
    this.output.write(
      JSON.stringify({
        jsonrpc: "2.0",
        method,
        params,
      }) + "\n",
    );
  }

  async #handle(msg) {
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
      } catch (err) {
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

  #sendResult(id, result) {
    this.output.write(
      JSON.stringify({
        jsonrpc: "2.0",
        id,
        result,
      }) + "\n",
    );
  }

  #sendError(id, code, message) {
    this.output.write(
      JSON.stringify({
        jsonrpc: "2.0",
        id,
        error: { code, message },
      }) + "\n",
    );
  }
}
