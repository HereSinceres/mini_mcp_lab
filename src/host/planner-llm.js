export async function planWithLLM({ userInput, tools, callModel }) {
  const systemPrompt = [
    "You are a planner for a local coding agent.",
    "Given the user input and available tools, decide either:",
    "1) answer directly",
    "2) call exactly one tool",
    "Return strict JSON only.",
    "",
    "JSON schema:",
    "{",
    '  "type": "answer" | "tool",',
    '  "text"?: string,',
    '  "toolName"?: string,',
    '  "args"?: object',
    "}",
  ].join("\n");

  const userPrompt = JSON.stringify(
    {
      userInput,
      tools,
    },
    null,
    2,
  );

  const raw = await callModel({ systemPrompt, userPrompt });
  const parsed = JSON.parse(raw);

  if (!parsed || !parsed.type) {
    throw new Error("Invalid planner response");
  }
  return parsed;
}
