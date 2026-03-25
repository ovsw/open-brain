import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export type ThoughtMetadata = Record<string, unknown>;

export async function getEmbedding(text: string): Promise<number[]> {
  const response = await fetch(`${OPENROUTER_BASE}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/text-embedding-3-small",
      input: text,
    }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`OpenRouter embeddings failed: ${response.status} ${message}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

export async function extractMetadata(text: string): Promise<ThoughtMetadata> {
  const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Extract metadata from the user's captured thought. Return JSON with:
- "people": array of people mentioned (empty if none)
- "action_items": array of implied to-dos (empty if none)
- "dates_mentioned": array of dates YYYY-MM-DD (empty if none)
- "topics": array of 1-3 short topic tags (always at least one)
- "type": one of "observation", "task", "idea", "reference", "person_note"
Only extract what's explicitly there.`,
        },
        { role: "user", content: text },
      ],
    }),
  });

  const data = await response.json();
  try {
    return JSON.parse(data.choices[0].message.content);
  } catch {
    return { topics: ["uncategorized"], type: "observation" };
  }
}

type CaptureThoughtArgs = {
  content: string;
  source: string;
  metadata?: ThoughtMetadata;
};

export async function captureThought({
  content,
  source,
  metadata = {},
}: CaptureThoughtArgs): Promise<ThoughtMetadata> {
  const [embedding, extractedMetadata] = await Promise.all([
    getEmbedding(content),
    extractMetadata(content),
  ]);

  const finalMetadata = {
    ...extractedMetadata,
    ...metadata,
    source,
  };

  const { error } = await supabase.from("thoughts").insert({
    content,
    embedding,
    metadata: finalMetadata,
  });

  if (error) {
    throw new Error(`Failed to capture: ${error.message}`);
  }

  return finalMetadata;
}

export function buildCaptureConfirmation(metadata: ThoughtMetadata): string {
  let confirmation = `Captured as ${metadata.type || "thought"}.`;

  if (Array.isArray(metadata.topics) && metadata.topics.length) {
    confirmation += ` Topics: ${(metadata.topics as string[]).join(", ")}.`;
  }

  return confirmation;
}

export { supabase };
