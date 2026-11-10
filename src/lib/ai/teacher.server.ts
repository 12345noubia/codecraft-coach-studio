import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { createRunIdFetch } from "./run-id.server";

const MODEL = "openai/gpt-6-astra";

export class TeacherError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function askModel(instructions: string, prompt: string): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new TeacherError("The AI teacher is not configured yet.", 401);
  const runId = createRunIdFetch();
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runId.fetch,
  });
  let streamError: unknown;
  const result = streamText({
    model: provider.responses(MODEL),
    instructions,
    messages: [{ role: "user", content: prompt }],
    maxRetries: 0,
    onError: ({ error }) => {
      streamError = error;
    },
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  let text = "";
  try {
    text = await result.text;
  } catch (e) {
    streamError = e;
  }
  if (streamError || !text) {
    const err = streamError as { statusCode?: number; message?: string } | undefined;
    const status = err?.statusCode ?? 500;
    if (status === 429) throw new TeacherError("The teacher is getting a lot of questions right now. Please try again in a moment.", 429);
    if (status === 402) throw new TeacherError("AI credits for this workspace are used up. Add credits to keep learning with the AI teacher.", 402);
    if (status === 403) throw new TeacherError("The AI teacher is not available for this workspace right now.", 403);
    throw new TeacherError(err?.message ? `Teacher error: ${err.message}` : "The teacher could not answer. Please try again.", status);
  }
  return text;
}

export function extractJson<T>(text: string): T {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new TeacherError("The teacher replied in an unexpected format. Please try again.", 500);
  return JSON.parse(text.slice(start, end + 1)) as T;
}
