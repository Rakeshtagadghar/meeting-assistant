import { getGroqClient } from "../providers/groq";

export interface GenerateTitleOptions {
  noteContent: string;
  summaryContent?: string;
}

const TITLE_SYSTEM_PROMPT = `You are a helpful assistant that generates concise, descriptive titles for meeting notes.

Given the content of a note (and optionally a summary), generate a short, descriptive title that captures the main topic.

Rules:
- Keep the title under 60 characters
- Be specific and descriptive
- Do not use generic titles like "Meeting Notes" or "Untitled"
- Use title case
- Return ONLY the title, nothing else - no quotes, no explanation`;

export async function generateTitle(
  options: GenerateTitleOptions,
): Promise<string> {
  const { noteContent, summaryContent } = options;

  const client = getGroqClient();

  const userContent = summaryContent
    ? `Summary:\n${summaryContent}\n\nOriginal notes:\n${noteContent}`
    : `Notes:\n${noteContent}`;

  const response = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: TITLE_SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    temperature: 0.3,
    max_completion_tokens: 100,
  });

  const title = response.choices[0]?.message?.content?.trim() ?? "";

  // Clean up any quotes the model might have added
  return title.replace(/^["']|["']$/g, "").trim();
}
