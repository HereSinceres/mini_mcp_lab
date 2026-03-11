import { safeJsonParse, stripMarkdownFence } from "../shared/utils.js";

export class ResponsesClient {
  constructor({ apiKey, baseUrl, model, useRealModel = false }) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.model = model;
    this.useRealModel = useRealModel;
  }

  async createPlannerResponse({ systemPrompt, userInput, tools }) {
    if (!this.useRealModel) {
      return this.#mockPlanner(userInput);
    }

    if (!this.apiKey) {
      throw new Error("OPENAI_API_KEY is missing");
    }

    const response = await fetch(`${this.baseUrl}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        instructions: systemPrompt,
        input: userInput,
        tools,
        tool_choice: "auto",
      }),
    });
    console.log("Responses API request payload:", {
      model: this.model,
      instructions: systemPrompt,
      input: userInput,
      tools,
      tool_choice: "auto",
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Responses request failed: ${response.status} ${text}`);
    }

    return response.json();
  }

  extractToolCalls(responseJson) {
    const output = Array.isArray(responseJson?.output)
      ? responseJson.output
      : [];

    return output
      .filter((item) => item?.type === "function_call")
      .map((item) => ({
        id:
          item.call_id ||
          item.id ||
          `call_${Math.random().toString(36).slice(2, 8)}`,
        name: item.name,
        arguments: safeJsonParse(item.arguments, {}) || {},
      }));
  }

  extractOutputText(responseJson) {
    if (
      typeof responseJson?.output_text === "string" &&
      responseJson.output_text.trim()
    ) {
      return responseJson.output_text.trim();
    }

    const output = Array.isArray(responseJson?.output)
      ? responseJson.output
      : [];
    const message = output.find((item) => item?.type === "message");
    const textPart = message?.content?.find((c) => c?.type === "output_text");
    return textPart?.text?.trim() || "";
  }

  async continueAfterToolCalls({ previousResponseId, toolOutputs }) {
    if (!this.useRealModel) {
      return this.#mockAfterTools(toolOutputs);
    }

    const response = await fetch(`${this.baseUrl}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        previous_response_id: previousResponseId,
        input: toolOutputs.map((item) => ({
          type: "function_call_output",
          call_id: item.call_id,
          output: JSON.stringify(item.output),
        })),
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Responses continuation failed: ${response.status} ${text}`,
      );
    }

    return response.json();
  }

  #mockPlanner(userInput) {
    const text = String(userInput || "").trim();

    if (/^(tools)$/i.test(text)) {
      return {
        id: "mock_resp_1",
        output: [
          {
            type: "function_call",
            id: "fc_1",
            call_id: "fc_1",
            name: "list_tools_builtin",
            arguments: "{}",
          },
        ],
      };
    }

    if (/^(skills)$/i.test(text)) {
      return {
        id: "mock_resp_2",
        output: [
          {
            type: "function_call",
            id: "fc_2",
            call_id: "fc_2",
            name: "list_skills_builtin",
            arguments: "{}",
          },
        ],
      };
    }

    if (/^(threads|history)$/i.test(text)) {
      return {
        id: "mock_resp_3",
        output: [
          {
            type: "function_call",
            id: "fc_3",
            call_id: "fc_3",
            name: "list_threads_builtin",
            arguments: "{}",
          },
        ],
      };
    }

    if (/^summarize_file\b/i.test(text)) {
      return {
        id: "mock_resp_4",
        output: [
          {
            type: "function_call",
            id: "fc_4",
            call_id: "fc_4",
            name: "run_skill",
            arguments: JSON.stringify({
              skillName: "summarize_file",
              input: text.replace(/^summarize_file\b/i, "").trim(),
            }),
          },
        ],
      };
    }

    if (/^append_note\b/i.test(text)) {
      return {
        id: "mock_resp_5",
        output: [
          {
            type: "function_call",
            id: "fc_5",
            call_id: "fc_5",
            name: "run_skill",
            arguments: JSON.stringify({
              skillName: "append_note",
              input: text.replace(/^append_note\b/i, "").trim(),
            }),
          },
        ],
      };
    }

    if (/^calculate\b/i.test(text)) {
      return {
        id: "mock_resp_6",
        output: [
          {
            type: "function_call",
            id: "fc_6",
            call_id: "fc_6",
            name: "run_skill",
            arguments: JSON.stringify({
              skillName: "calculate",
              input: text.replace(/^calculate\b/i, "").trim(),
            }),
          },
        ],
      };
    }

    if (/^ls$|^list$/i.test(text)) {
      return {
        id: "mock_resp_7",
        output: [
          {
            type: "function_call",
            id: "fc_7",
            call_id: "fc_7",
            name: "list_dir",
            arguments: JSON.stringify({ dir: "." }),
          },
        ],
      };
    }

    if (/^read\b/i.test(text)) {
      return {
        id: "mock_resp_8",
        output: [
          {
            type: "function_call",
            id: "fc_8",
            call_id: "fc_8",
            name: "read_file",
            arguments: JSON.stringify({
              path: text.replace(/^read\b/i, "").trim(),
            }),
          },
        ],
      };
    }

    if (/^write\b/i.test(text)) {
      const body = text.replace(/^write\b/i, "").trim();
      const [file, ...rest] = body.split("|");
      return {
        id: "mock_resp_9",
        output: [
          {
            type: "function_call",
            id: "fc_9",
            call_id: "fc_9",
            name: "write_file",
            arguments: JSON.stringify({
              path: (file || "").trim(),
              content: rest.join("|").trim(),
            }),
          },
        ],
      };
    }

    if (/^append\b/i.test(text)) {
      const body = text.replace(/^append\b/i, "").trim();
      const [file, ...rest] = body.split("|");
      return {
        id: "mock_resp_10",
        output: [
          {
            type: "function_call",
            id: "fc_10",
            call_id: "fc_10",
            name: "append_file",
            arguments: JSON.stringify({
              path: (file || "").trim(),
              content: rest.join("|").trim(),
            }),
          },
        ],
      };
    }

    if (/^calc\b/i.test(text)) {
      return {
        id: "mock_resp_11",
        output: [
          {
            type: "function_call",
            id: "fc_11",
            call_id: "fc_11",
            name: "calc",
            arguments: JSON.stringify({
              expression: text.replace(/^calc\b/i, "").trim(),
            }),
          },
        ],
      };
    }

    return {
      id: "mock_resp_12",
      output_text: [
        "支持命令：",
        "  tools",
        "  skills",
        "  threads",
        "  ls",
        "  read <path>",
        "  write <path> | <content>",
        "  append <path> | <content>",
        "  calc <expression>",
        "  summarize_file <path>",
        "  append_note <path> | <content>",
        "  calculate <expression>",
      ].join("\n"),
    };
  }

  #mockAfterTools(toolOutputs) {
    const first = toolOutputs[0];
    const output = first?.output;

    return {
      id: "mock_followup",
      output_text:
        typeof output === "string"
          ? output
          : stripMarkdownFence(JSON.stringify(output, null, 2)),
    };
  }
}
