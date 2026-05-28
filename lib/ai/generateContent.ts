import { buildMathTeacherPrompt } from "@/lib/ai/prompt";
import type { GeneratedContent } from "@/types/content";

export async function generateMathContent(input: {
  subunitTitle: string;
  extractedText: string;
  achievementStandard?: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing.");
  }

  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: buildMathTeacherPrompt(input),
      text: { format: { type: "json_object" } }
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`AI API error: ${response.status} ${detail}`);
  }

  const data = await response.json();
  const text = data.output_text || data.output?.flatMap((item: { content?: Array<{ type: string; text?: string }> }) => item.content || [])
    .find((item: { type: string }) => item.type === "output_text")?.text;

  if (!text) throw new Error("AI response text was empty.");

  return {
    source: "ai",
    model,
    content: JSON.parse(text) as GeneratedContent
  };
}
