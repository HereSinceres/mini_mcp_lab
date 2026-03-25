export async function planWithLLM({
  userInput,
  state,
  toolCatalog,
  callModel,
}: {
  userInput: string;
  state: any;
  toolCatalog: any[];
  callModel: (prompt: string) => Promise<string>;
}): Promise<any> {
  const systemPrompt = [
    "You are the planner for a local coding agent.",
    "You may decide one of three outputs:",
    '1) {"type":"tool","toolName":"...","args":{},"reason":"..."}',
    '2) {"type":"answer","text":"..."}',
    '3) {"type":"done"}',
    "",
    "Rules:",
    "- Return strict JSON only.",
    "- At most one tool per step.",
    "- If the user asks summarize_file <path>, first call read_file.",
    "- After read_file for summarize_file, return an answer summarizing the content.",
    "- Prefer available tools only.",
  ].join("\n");

  const userPrompt = JSON.stringify(
    {
      userInput,
      state,
      toolCatalog,
    },
    null,
    2,
  );

  const raw = await callModel(`${systemPrompt}\n\n${userPrompt}`);
  const parsed = JSON.parse(raw);

  if (!parsed || !parsed.type) {
    throw new Error("Invalid planner response");
  }

  return parsed;
}
