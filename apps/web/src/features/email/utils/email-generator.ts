export interface EmailContentOptions {
  includeActionItems?: boolean;
  includeLinks?: boolean;
  shareLink?: string;
  transcriptLink?: string;
}

export interface EmailContent {
  subject: string;
  body: string;
  htmlBody: string;
}

/**
 * Clean markdown symbols for plain text email usage
 */
function cleanMarkdown(text: string): string {
  if (!text) return "";

  return (
    text
      // Header cleanup
      .replace(/^#+\s+/gm, "")
      // Bold/Italic cleanup
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/__(.*?)__/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/_(.*?)_/g, "$1")
      // Link cleanup [text](url) -> text (url)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
      // Code block cleanup
      .replace(/```[\s\S]*?```/g, (match) => match.replace(/```/g, ""))
      .replace(/`([^`]+)`/g, "$1")
      // List cleanup (ensure consistency)
      .replace(/^\s*-\s/gm, "• ")
      .replace(/^\s*\*\s/gm, "• ")
      // Remove HTML tags if any
      .replace(/<[^>]*>/g, "")
      .trim()
  );
}

/**
 * Generate email subject and body from note and summary
 */
export function generateEmailContent(
  noteTitle: string,
  summary: string,
  options: EmailContentOptions = {},
): EmailContent {
  const title = noteTitle || "Untitled Note";
  const subject = `AI meeting notes: ${title}`;

  // Plain Text Body
  let body = `AI meeting notes: ${title}\n\n`;
  body += cleanMarkdown(summary);

  if (options.includeLinks) {
    const links = [];
    if (options.shareLink) links.push(`Full Note: ${options.shareLink}`);
    if (options.transcriptLink)
      links.push(`Transcript: ${options.transcriptLink}`);

    if (links.length > 0) {
      body += "\n\n---\nShared via Meeting Assistant\n" + links.join("\n");
    }
  }

  // HTML Body (for clipboard)
  // Simple markdown-to-html conversion for the summary part
  let summaryHtml = summary
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/\*\*(.*)\*\*/gim, "<strong>$1</strong>")
    .replace(/\n/gim, "<br />");

  let htmlBody = `
    <div style="font-family: sans-serif; color: #1f2937;">
      <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin-bottom: 24px; color: #1e40af; font-weight: 600; font-size: 16px;">
        AI meeting notes: ${title}
      </div>
      <div>
        ${summaryHtml}
      </div>
    `;

  if (options.includeLinks && (options.shareLink || options.transcriptLink)) {
    htmlBody += `
      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 14px; color: #6b7280;">
        <p>Shared via Meeting Assistant</p>
        ${options.shareLink ? `<a href="${options.shareLink}" style="color: #2563eb; text-decoration: none; margin-right: 16px;">View Full Note</a>` : ""}
        ${options.transcriptLink ? `<a href="${options.transcriptLink}" style="color: #2563eb; text-decoration: none;">View Transcript</a>` : ""}
      </div>
    `;
  }
  htmlBody += `</div>`;

  return { subject, body, htmlBody };
}

/**
 * Generate compose URLs for different providers
 */
export function getComposeUrl(
  provider: "gmail" | "mailto",
  content: EmailContent,
): string {
  const { subject, body } = content;

  if (provider === "gmail") {
    // Gmail limits ~2000 chars roughly in URL before issues, but modern browsers handle more.
    // We'll trust the browser but be safer to encode properly.
    const params = new URLSearchParams({
      fs: "1",
      tf: "cm",
      su: subject,
      body: body,
    });
    return `https://mail.google.com/mail/u/0/?${params.toString()}`;
  }

  // Mailto fallback
  const params = new URLSearchParams({
    subject: subject,
    body: body,
  });
  return `mailto:?${params.toString()}`;
}
