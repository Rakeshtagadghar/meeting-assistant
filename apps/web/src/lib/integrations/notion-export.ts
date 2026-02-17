import type { AISummary, Note } from "@ainotes/core";
import type { NotionPageBlock } from "./notion";

const MAX_TEXT = 1800;

interface NotionExportSections {
  title: string;
  oneLiner: string | null;
  summaryBullets: string[];
  keyPoints: string[];
  actionItems: string[];
  decisions: string[];
}

function truncateText(value: string, max = MAX_TEXT): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

function richText(
  content: string,
): Array<{ type: "text"; text: { content: string } }> {
  const text = truncateText(content);
  return text.length > 0 ? [{ type: "text", text: { content: text } }] : [];
}

function heading(text: string): NotionPageBlock {
  return {
    object: "block",
    type: "heading_2",
    heading_2: { rich_text: richText(text) },
  };
}

function paragraph(text: string): NotionPageBlock {
  return {
    object: "block",
    type: "paragraph",
    paragraph: { rich_text: richText(text) },
  };
}

function bullet(text: string): NotionPageBlock {
  return {
    object: "block",
    type: "bulleted_list_item",
    bulleted_list_item: { rich_text: richText(text) },
  };
}

function todo(text: string): NotionPageBlock {
  return {
    object: "block",
    type: "to_do",
    to_do: { rich_text: richText(text), checked: false },
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => readString(item))
    .filter((item): item is string => item !== null)
    .slice(0, 25);
}

function extractSections(
  note: Note,
  summaries: AISummary[],
): NotionExportSections {
  const latestByKind = new Map<string, AISummary>();
  for (const summary of summaries) {
    if (!latestByKind.has(summary.kind)) {
      latestByKind.set(summary.kind, summary);
    }
  }

  const summaryPayload = asRecord(latestByKind.get("SUMMARY")?.payload);
  const keyPointsPayload = asRecord(latestByKind.get("KEY_POINTS")?.payload);
  const actionItemsPayload = asRecord(
    latestByKind.get("ACTION_ITEMS")?.payload,
  );
  const decisionsPayload = asRecord(latestByKind.get("DECISIONS")?.payload);

  const summaryTitle = readString(summaryPayload?.["title"]);
  const oneLiner =
    readString(summaryPayload?.["oneLiner"]) ??
    readString(summaryPayload?.["one_liner"]);

  const summaryBullets = readStringArray(summaryPayload?.["bullets"]);

  const keyPoints = [
    ...readStringArray(keyPointsPayload?.["keyPoints"]),
    ...readStringArray(keyPointsPayload?.["key_points"]),
  ].slice(0, 25);

  const rawItems = Array.isArray(actionItemsPayload?.["items"])
    ? actionItemsPayload?.["items"]
    : [];

  const actionItems = rawItems
    .map((item) => {
      if (typeof item === "string") return readString(item);
      const obj = asRecord(item);
      const text = readString(obj?.["text"]);
      const owner = readString(obj?.["owner"]);
      const due = readString(obj?.["due"]);

      const suffixParts = [
        owner ? `owner: ${owner}` : null,
        due ? `due: ${due}` : null,
      ].filter((part): part is string => part !== null);

      if (!text) return null;
      return suffixParts.length > 0
        ? `${text} (${suffixParts.join(", ")})`
        : text;
    })
    .filter((item): item is string => item !== null)
    .slice(0, 25);

  const decisions = readStringArray(decisionsPayload?.["decisions"]);

  return {
    title: summaryTitle ?? note.title ?? "AINotes Export",
    oneLiner,
    summaryBullets,
    keyPoints,
    actionItems,
    decisions,
  };
}

export function buildNotionExportPage(
  note: Note,
  summaries: AISummary[],
): {
  title: string;
  children: NotionPageBlock[];
} {
  const sections = extractSections(note, summaries);
  const children: NotionPageBlock[] = [];

  children.push(
    paragraph(
      `Exported from Golden Minutes on ${new Date().toISOString().slice(0, 10)} for note "${note.title}".`,
    ),
  );

  if (sections.oneLiner) {
    children.push(paragraph(sections.oneLiner));
  }

  if (sections.summaryBullets.length > 0) {
    children.push(heading("Summary"));
    for (const item of sections.summaryBullets) {
      children.push(bullet(item));
    }
  }

  if (sections.keyPoints.length > 0) {
    children.push(heading("Key Points"));
    for (const item of sections.keyPoints) {
      children.push(bullet(item));
    }
  }

  if (sections.actionItems.length > 0) {
    children.push(heading("Action Items"));
    for (const item of sections.actionItems) {
      children.push(todo(item));
    }
  }

  if (sections.decisions.length > 0) {
    children.push(heading("Decisions"));
    for (const item of sections.decisions) {
      children.push(bullet(item));
    }
  }

  if (children.length <= 2) {
    children.push(
      paragraph(
        "No structured AI summary was available. Open this note in AINotes and generate a summary first.",
      ),
    );
  }

  return {
    title: truncateText(sections.title, 180),
    children,
  };
}
