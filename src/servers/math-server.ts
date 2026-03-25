import { JsonRpcPeer } from "../shared/jsonrpc";
import { METHODS, NOTIFICATIONS } from "../shared/protocol";

function safeEval(expr: string): number {
  if (!/^[\d\s+\-*/().]+$/.test(expr)) {
    throw new Error("Only numbers and + - * / ( ) are allowed");
  }
  return Function(`"use strict"; return (${expr})`)();
}

const peer = new JsonRpcPeer({
  input: process.stdin,
  output: process.stdout,
  onError: (...args) => console.error(...args),
});

peer.register(METHODS.INITIALIZE, async (params) => {
  peer.notify(NOTIFICATIONS.LOG, {
    level: "info",
    message: `math-server initialized by ${params?.clientInfo?.name || "unknown"}`,
  });

  return {
    serverInfo: { name: "math-server", version: "5.0.0" },
    capabilities: { tools: true },
  };
});

peer.register(METHODS.TOOLS_LIST, async () => ({
  tools: [
    {
      name: "calc",
      description: "Evaluate a simple math expression",
      inputSchema: {
        type: "object",
        properties: { expression: { type: "string" } },
        required: ["expression"],
      },
    },
  ],
}));

peer.register(METHODS.TOOLS_CALL, async (params) => {
  const { name, arguments: args = {} } = params || {};
  peer.notify(NOTIFICATIONS.TOOL_STARTED, { name, args });

  if (name !== "calc") {
    throw new Error(`Unknown tool: ${name}`);
  }

  const value = safeEval(args.expression);
  peer.notify(NOTIFICATIONS.TOOL_FINISHED, { name });

  return {
    content: {
      expression: args.expression,
      value,
    },
  };
});
