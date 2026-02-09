import { getGroqClient } from "../providers/groq";

export interface StreamSummarizeOptions {
  noteTitle: string;
  noteContent: string;
  signal?: AbortSignal;
}

const SYSTEM_PROMPT = `You are an expert meeting notes summarizer. Given raw meeting notes or transcript text, produce a clear, well-structured markdown summary.

Your output MUST follow this exact structure:

# [Meeting Title]

> [One-sentence overview of what the meeting was about]

## Key Topics

### [Topic Name]
- [Key point as a concise bullet]
- [Key point as a concise bullet]

(Repeat for each major topic discussed)

## Next Steps
- [ ] [Action item description] — *[Owner if mentioned]*
- [ ] [Action item description] — *[Owner if mentioned]*

Rules:
- Be concise: each bullet should be 1-2 sentences max
- Use markdown task list syntax (- [ ]) for next steps
- Include owner names in italics if mentioned in the notes
- Group related points under topic headings
- If no clear action items exist, omit the Next Steps section
- Do NOT fabricate information not present in the notes
- Write in professional, clear language`;

export async function* streamSummarize(
  options: StreamSummarizeOptions,
): AsyncGenerator<string, void, undefined> {
  const { noteTitle, noteContent, signal } = options;

  const client = getGroqClient();

  const stream = await client.chat.completions.create(
    {
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Meeting title: "${noteTitle}"\n\nMeeting notes:\n${noteContent}`,
        },
      ],
      temperature: 0.3,
      max_completion_tokens: 4096,
      stream: true,
    },
    signal ? { signal } : undefined,
  );

  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content;
    if (token) {
      yield token;
    }
  }
}
