export function buildPlannerTools(skills) {
  return [
    {
      type: "function",
      name: "list_tools_builtin",
      description: "List all available low-level tools",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "list_skills_builtin",
      description: "List all available skills",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "list_threads_builtin",
      description: "List saved threads",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "run_skill",
      description: `Run one skill by name. Available skills: ${skills.map((s) => s.name).join(", ")}`,
      parameters: {
        type: "object",
        properties: {
          skillName: { type: "string" },
          input: { type: "string" },
        },
        required: ["skillName", "input"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "read_file",
      description: "Read a workspace-relative UTF-8 file",
      parameters: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "write_file",
      description: "Overwrite a workspace-relative UTF-8 file",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" },
        },
        required: ["path", "content"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "append_file",
      description: "Append text to a workspace-relative UTF-8 file",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" },
        },
        required: ["path", "content"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "list_dir",
      description: "List files under a workspace-relative directory",
      parameters: {
        type: "object",
        properties: { dir: { type: "string" } },
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "calc",
      description: "Evaluate a simple math expression",
      parameters: {
        type: "object",
        properties: { expression: { type: "string" } },
        required: ["expression"],
        additionalProperties: false,
      },
    },
  ];
}
