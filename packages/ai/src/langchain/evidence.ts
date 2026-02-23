/**
 * Builds a semantic search query string for a specific summary section.
 * Used to retrieve the most relevant evidence chunks from the vector store.
 */
export function buildSectionQuery(
  sectionKey: string,
  sectionTitle: string,
  meetingTitle: string,
): string {
  const queryMap: Record<string, string> = {
    overview: `overview summary of ${meetingTitle}`,
    decisions: `decisions made in ${meetingTitle}`,
    action_items: `action items tasks assigned in ${meetingTitle}`,
    next_steps: `next steps follow-ups from ${meetingTitle}`,
    risks_open_questions: `risks concerns open questions from ${meetingTitle}`,
    customer_context: `customer background context from ${meetingTitle}`,
    pain_points: `customer pain points problems from ${meetingTitle}`,
    objections: `objections concerns raised in ${meetingTitle}`,
  };

  return queryMap[sectionKey] ?? `${sectionTitle} from ${meetingTitle}`;
}
