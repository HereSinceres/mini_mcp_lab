export async function callModel({ systemPrompt, userPrompt }) {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. 当前先用 rule planner；若要接真实模型，请在 .env 或环境变量里配置。",
    );
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      // response_format: { type: "json_schema" },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Model request failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Empty model response");
  }

  return content;
}
