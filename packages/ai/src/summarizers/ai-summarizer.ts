import { getGroqClient } from "../providers/groq";

export interface TemplateSectionInput {
  title: string;
  hint?: string | null;
}

export interface StreamSummarizeOptions {
  noteTitle: string;
  noteContent: string;
  needsTitle?: boolean; // Set to true if the note is untitled
  templateContext?: string | null;
  templateSections?: TemplateSectionInput[];
  signal?: AbortSignal;
}

const BASE_SYSTEM_PROMPT = `You are an expert meeting notes summarizer. Given raw meeting notes or transcript text, produce a clear, well-structured markdown summary.`;

const DEFAULT_STRUCTURE_INSTRUCTION = `
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
- [ ] [Action item description] — *[Owner if mentioned]*`;

const DEFAULT_RULES = `
Rules:
- Be concise: each bullet should be 1-2 sentences max
- Use markdown task list syntax (- [ ]) for next steps
- Include owner names in italics if mentioned in the notes
- Group related points under topic headings
- If no clear action items exist, omit the Next Steps section
- Do NOT fabricate information not present in the notes
- Write in professional, clear language`;

const TITLE_GENERATION_ADDENDUM = `

IMPORTANT: The note currently has no title. You MUST start your response with a special title line in this exact format:
GENERATED_TITLE: [Your suggested title here]

This title should be:
- Concise (under 60 characters)
- Descriptive and specific to the content
- NOT generic like "Meeting Notes" or "Discussion"

After the GENERATED_TITLE line, continue with the normal summary format starting with # [Meeting Title]`;

function buildSystemPrompt(options: StreamSummarizeOptions): string {
  let prompt = BASE_SYSTEM_PROMPT;

  // 1. Template Context
  if (options.templateContext) {
    prompt += `\n\nContext provided for this meeting:\n"${options.templateContext}"\nUse this context to better understand the significance of the discussion.`;
  }

  // 2. Structure Instruction
  if (options.templateSections && options.templateSections.length > 0) {
    prompt += `\n\nYour output MUST follow this specific structure based on the user's template:\n\n# [Meeting Title]\n`;

    options.templateSections.forEach((section) => {
      prompt += `\n## ${section.title}\n`;
      if (section.hint) {
        prompt += `(Instruction: ${section.hint})\n`;
      }
      prompt += `- [Content for this section]\n`;
    });

    prompt += `\n\nIMPORTANT: You must strictly adhere to these section headers. Do not add other top-level sections unless absolutely necessary.`;
  } else {
    prompt += DEFAULT_STRUCTURE_INSTRUCTION;
  }

  // 3. Rules
  prompt += DEFAULT_RULES;

  // 4. Title Generation
  if (options.needsTitle) {
    prompt += TITLE_GENERATION_ADDENDUM;
  }

  return prompt;
}

export async function* streamSummarize(
  options: StreamSummarizeOptions,
): AsyncGenerator<string, void, undefined> {
  const { noteTitle, noteContent, needsTitle = false, signal } = options;

  const client = getGroqClient();

  const stream = await client.chat.completions.create(
    {
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: buildSystemPrompt(options) },
        {
          role: "user",
          content: needsTitle
            ? `Meeting notes:\n${noteContent}`
            : `Meeting title: "${noteTitle}"\n\nMeeting notes:\n${noteContent}`,
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

/**
 * Extract the generated title from the accumulated response
 * Returns null if no title was found
 */
export function extractGeneratedTitle(response: string): string | null {
  const match = response.match(/^GENERATED_TITLE:\s*(.+?)(?:\n|$)/m);
  if (match?.[1]) {
    return match[1].trim();
  }
  return null;
}

/**
 * Remove the GENERATED_TITLE line from the response for display
 */
export function stripTitleLine(response: string): string {
  return response.replace(/^GENERATED_TITLE:\s*.+?\n/m, "").trim();
}
