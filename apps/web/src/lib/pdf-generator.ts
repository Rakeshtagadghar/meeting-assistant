import chromium from "@sparticuz/chromium";
import playwright from "playwright-core";

// Interface for PDF generation options
export interface PdfOptions {
  format?: "A4" | "Letter";
  printBackground?: boolean;
  margin?: {
    top?: string | number;
    right?: string | number;
    bottom?: string | number;
    left?: string | number;
  };
}

/**
 * Wraps raw HTML content with a styled template including branding and typography.
 */
function wrapHtml(content: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Merriweather:ital,wght@0,300;0,400;0,700;1,400&display=swap" rel="stylesheet">
      <style>
        @page {
          margin: 0;
        }

        :root {
          --color-warm-50: #fefcf9;
          --color-warm-100: #fdf8f0;
          --color-warm-200: #f5efe6;
          --color-warm-300: #e8dfd3;
          --color-warm-400: #bfb5a8;
          --color-warm-500: #9a8e7f;
          --color-accent: #d4a843;
          --color-accent-light: #f5ecd4;
          --color-text-heading: #111827; // Gray 900
          --color-text-body: #374151;    // Gray 700
        }

        html, body {
          height: 100%;
          width: 100%;
          margin: 0;
          padding: 0;
          background-color: var(--color-warm-50);
          color: var(--color-text-body);
          font-family: 'Merriweather', serif;
          -webkit-font-smoothing: antialiased;
        }

        /* Container to provide the "margins" for the content */
        .page-container {
            padding: 40px;
            max-width: 800px;
            margin: 0 auto;
        }

        /* Branding Header */
        .brand-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 24px;
          border-bottom: 2px solid var(--color-warm-200);
          margin-bottom: 32px;
          font-family: 'Inter', sans-serif;
        }
        
        .brand-logo {
          font-size: 24px;
          font-weight: 700;
          color: var(--color-text-heading);
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .brand-logo svg {
          color: var(--color-accent);
          height: 24px;
          width: 24px;
        }

        .date {
          font-size: 12px;
          color: var(--color-warm-500);
          font-weight: 500;
        }

        /* Footer */
        .brand-footer {
          margin-top: 48px;
          padding-top: 24px;
          border-top: 1px solid var(--color-warm-200);
          text-align: center;
          font-family: 'Inter', sans-serif;
          font-size: 10px;
          color: var(--color-warm-400);
        }

        /* Typography matching .streaming-prose */
        h1, h2, h3, h4, h5, h6 {
          font-family: 'Inter', sans-serif;
          color: var(--color-text-heading);
          margin-top: 1.5em;
          margin-bottom: 0.5em;
          line-height: 1.3;
        }

        h1 {
          font-size: 24px;
          font-weight: 700;
          border-bottom: 1px solid var(--color-warm-200);
          padding-bottom: 12px;
          margin-top: 0;
        }

        h2 {
          font-size: 18px;
          font-weight: 600;
          padding-bottom: 6px;
          border-bottom: 1px solid var(--color-warm-200);
        }

        h3 {
          font-size: 16px;
          font-weight: 600;
        }

        p {
          margin-bottom: 1em;
        }

        ul, ol {
          padding-left: 20px;
          margin-bottom: 1em;
        }

        li {
          margin-bottom: 0.5em;
        }

        li::marker {
          color: var(--color-warm-400);
        }

        strong {
          color: var(--color-text-heading);
          font-weight: 600;
        }

        blockquote {
          border-left: 4px solid var(--color-accent);
          background-color: var(--color-warm-100);
          margin: 1.5em 0;
          padding: 12px 20px;
          border-radius: 4px;
          font-style: italic;
          color: var(--color-warm-500);
        }

        code {
          background-color: var(--color-warm-100);
          padding: 2px 4px;
          border-radius: 4px;
          font-family: monospace;
          font-size: 0.9em;
        }

        a {
          color: var(--color-accent);
          text-decoration: none;
        }

        /* Task list checkboxes */
        input[type="checkbox"] {
          margin-right: 8px;
          accent-color: var(--color-accent);
        }

      </style>
    </head>
    <body>
      <div class="page-container">
        <div class="brand-header">
          <div class="brand-logo">
             <svg fill="currentColor" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
               <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
             </svg>
             ScribeAI
          </div>
          <div class="date">${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
        </div>

        <div class="content">
          ${content}
        </div>

        <div class="brand-footer">
          Generated by ScribeAI &bull; Meeting Notes
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generates a PDF from HTML content using Playwright.
 * Compatible with serverless environments (Vercel) via @sparticuz/chromium.
 */
export async function generatePdf(
  html: string,
  options: PdfOptions = {},
): Promise<Buffer> {
  let browser = null;

  try {
    // Configure browser launching based on environment
    if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
      // Serverless / Production environment
      browser = await playwright.chromium.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: true,
      });
    } else {
      // Local Development environment
      try {
        const { chromium: localChromium } = require("playwright");
        browser = await localChromium.launch({
          headless: true,
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("Failed to launch local playwright instance:", e);
        // eslint-disable-next-line no-console
        console.warn(
          "Falling back to playwright-core (this may fail if executablePath is not set)",
        );
        browser = await playwright.chromium.launch({
          headless: true,
          channel: "chrome", // Try to use installed chrome
        });
      }
    }

    const page = await browser.newPage();

    // Wrap the raw HTML with our styling template
    const styledHtml = wrapHtml(html);

    // Set content and wait for network to be idle (load images, fonts, etc.)
    await page.setContent(styledHtml, { waitUntil: "networkidle" });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: options.format || "A4",
      printBackground: options.printBackground ?? true,
      margin: options.margin || {
        top: "0",
        right: "0",
        bottom: "0",
        left: "0",
      },
      // Note: We use CSS margins in the body/padding, but PDF margins are safe.
    });

    return pdfBuffer;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error generating PDF:", error);
    throw new Error("Failed to generate PDF");
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
