const DEFAULT_MODEL = "models/gemini-embedding-001";
const DEFAULT_DIMENSIONS = 768;

export type EmbeddingTaskType = "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT";

export function getGoogleEmbeddingsApiKey(): string | null {
  const key =
    process.env["GOOGLE_AI_API_KEY"] ??
    process.env["GEMINI_API_KEY"] ??
    process.env["GOOGLE_API_KEY"] ??
    null;
  return key && key.trim().length > 0 ? key.trim() : null;
}

function getEmbeddingModel(): string {
  return process.env["GOOGLE_EMBEDDING_MODEL"]?.trim() || DEFAULT_MODEL;
}

function getOutputDimensions(): number {
  const raw = process.env["GOOGLE_EMBEDDING_DIMENSIONS"];
  const parsed = raw ? Number(raw) : DEFAULT_DIMENSIONS;
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_DIMENSIONS;
  return Math.floor(parsed);
}

async function embedSingle(
  apiKey: string,
  text: string,
  taskType: EmbeddingTaskType,
): Promise<number[]> {
  const model = getEmbeddingModel();
  const outputDimensionality = getOutputDimensions();

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${model}:embedContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        content: {
          parts: [{ text }],
        },
        taskType,
        outputDimensionality,
      }),
    },
  );

  if (!response.ok) {
    const textBody = await response.text();
    throw new Error(
      `Google embeddings request failed (${response.status}): ${textBody.slice(0, 160)}`,
    );
  }

  const payload = (await response.json()) as {
    embedding?: { values?: number[] };
  };

  const values = payload.embedding?.values;
  if (!values || values.length === 0) {
    throw new Error(
      "Google embeddings response did not contain embedding values",
    );
  }
  return values;
}

export async function embedTextsWithGoogle(
  texts: string[],
  taskType: EmbeddingTaskType,
): Promise<number[][]> {
  const apiKey = getGoogleEmbeddingsApiKey();
  if (!apiKey) {
    throw new Error("Google embeddings API key not configured");
  }

  const trimmed = texts.map((text) => text.trim());
  const outputs: number[][] = [];

  // Keep concurrency low to stay within free-tier limits.
  const concurrency = 3;
  for (let i = 0; i < trimmed.length; i += concurrency) {
    const batch = trimmed.slice(i, i + concurrency);
    const batchVectors = await Promise.all(
      batch.map((text) => embedSingle(apiKey, text, taskType)),
    );
    outputs.push(...batchVectors);
  }

  return outputs;
}
