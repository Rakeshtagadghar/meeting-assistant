import { PrismaClient, TemplateOwnerType } from "@prisma/client";

const prisma = new PrismaClient();

const templates = [
  {
    name: "Daily Standup",
    meetingContext:
      "I attended a daily standup meeting. The goal is to document each participant’s updates regarding their recent accomplishment, current focus, and any blockers they are facing. Keep these notes short and to-the-point.",
    sections: [
      {
        title: "Announcements",
        hint: "Include any note-worthy points from the small-talk or announcements at the beginning of the call.",
      },
      {
        title: "Updates",
        hint: "Break these down into what was achieved yesterday, or accomplishments, what each person is working on today and highlight any blockers that could impact progress.",
      },
      {
        title: "Sidebar",
        hint: "Summarize any further discussions or issues that were explored after the main updates. Note any collaborative efforts, decisions made, or additional points raised.",
      },
      {
        title: "Action Items",
        hint: "Document and assign next steps from the meeting, summarize immediate tasks, provide reminders, and ensure accountability and clarity on responsibilities.",
      },
    ],
  },
  {
    name: "1:1 Meeting",
    meetingContext:
      "I am having a 1:1 meeting with someone in my team, please capture these meeting notes in a concise and actionable format. Focus on immediate priorities, progress, challenges, and personal feedback, ensuring the notes are structured for clarity, efficiency and easy follow-up.",
    sections: [
      {
        title: "Top of mind",
        hint: "What's the most pressing issue or priority? Capture the top concerns or focus areas that need immediate attention.",
      },
      {
        title: "Updates and wins",
        hint: "Highlight recent achievements and progress. What's going well? Document key updates that show momentum.",
      },
      {
        title: "Challenges and blockers",
        hint: "What obstacles are in the way? Note any blockers that are slowing progress.",
      },
      {
        title: "Mutual feedback",
        hint: "Did they give me any feedback on what I could do differently? Is there anything I should change about our team to make us more successful? Did I share any feedback for them? List it all here.",
      },
      {
        title: "Next Milestone",
        hint: "Define clear action items and next steps. Who's doing what by when? Ensure accountability and follow-up.",
      },
    ],
  },
  {
    name: "All Hands",
    meetingContext:
      "I attended our company's all-hands meeting to stay informed about our overall direction. I wanted to understand how recent developments might affect my role, catch any important announcements, and get a sense of our priorities moving forward.",
    sections: [
      {
        title: "Business Overview",
        hint: "Capture updates on company performance, major achievements, and current market position.",
      },
      {
        title: "Strategic Direction",
        hint: "Note discussions about future plans, goals, and any significant changes in company strategy or focus.",
      },
      {
        title: "Team Updates",
        hint: "Record important announcements about departments, new initiatives, or significant projects across the organization.",
      },
      {
        title: "Impact on my role",
        hint: "Summarize information relevant to my specific role and team, including any changes, expectations, or opportunities mentioned.",
      },
    ],
  },
  {
    name: "Brainstorming",
    meetingContext:
      "We're trying to solve a problem together. This discussion lets us share ideas and feedback on those ideas. This section describes the problem we are trying to solve. What's the context and current state? What's been tried before?",
    sections: [
      {
        title: "Themes discussion",
        hint: "This section describes the major themes explored in the brainstorm.",
      },
      {
        title: "Specific ideas",
        hint: "This section lists the most important specific ideas or discussion points from the brainstorm.",
      },
      {
        title: "Future directions",
        hint: "This section is about what we should keep in mind as we move forward. Are there specific directions we decided to explore?",
      },
    ],
  },
  {
    name: "VC Pitch",
    meetingContext:
      "I am an investor meeting a startup to see if I should potentially invest. Detail the background of the team members and their previous experience.",
    sections: [
      {
        title: "Problem",
        hint: "This section is about what problem the startup is trying to solve. Who has this problem? How many people or businesses have this problem? Why is it a problem?",
      },
      {
        title: "Product",
        hint: "What product is the startup building? How does the product work? How does it solve the user's problem? Any specific details about the product goes here.",
      },
      {
        title: "Go-to-market",
        hint: "How will they sell the product? Have they started selling it yet? How are they reaching customers? How much will it cost? How will they get lots of customers?",
      },
      {
        title: "Traction",
        hint: "What has the startup achieved so far? How many users do they have? How much money are they making? What other progress or traction do they have?",
      },
    ],
  },
  {
    name: "Classic Minutes",
    meetingContext:
      "Generate a formal meeting minutes document. Focus on evidence-grounded decisions, action items with owners, and key discussion points. Every claim must be backed by citations from the source material.",
    sections: [
      {
        title: "Overview",
        hint: "1-2 short paragraphs describing purpose and outcomes. Must be evidence-grounded.",
        metadata: { key: "overview", format: "freeform", required: true },
      },
      {
        title: "Decisions",
        hint: "List decisions. Each bullet must include citations.",
        metadata: {
          key: "decisions",
          format: "bullets",
          required: true,
          maxItems: 12,
        },
      },
      {
        title: "Action Items",
        hint: "Checklist. Include owner/due date only if explicitly present. Never guess.",
        metadata: { key: "action_items", format: "checklist", required: true },
      },
      {
        title: "Risks & Open Questions",
        hint: "Capture risks and unresolved points raised.",
        metadata: {
          key: "risks_open_questions",
          format: "bullets",
          required: false,
        },
      },
      {
        title: "Next Steps",
        hint: "What should happen next based on the meeting content.",
        metadata: { key: "next_steps", format: "bullets", required: false },
      },
    ],
  },
  {
    name: "Sales Call Summary",
    meetingContext:
      "Generate a sales call summary. Focus on customer context, pain points with citations and quotes, objections, and concrete next steps. Do not invent owners or dates.",
    sections: [
      {
        title: "Customer Context",
        hint: "Customer background and current situation.",
        metadata: {
          key: "customer_context",
          format: "bullets",
          required: true,
        },
      },
      {
        title: "Pain Points",
        hint: "Top pains with citations and quotes if available.",
        metadata: { key: "pain_points", format: "bullets", required: true },
      },
      {
        title: "Objections",
        hint: "Objections raised and how they were addressed.",
        metadata: { key: "objections", format: "bullets", required: false },
      },
      {
        title: "Next Steps",
        hint: "Follow-ups agreed. Do not invent owners/dates.",
        metadata: { key: "next_steps", format: "checklist", required: true },
      },
    ],
  },
];

async function seedTemplates() {
  console.log("Seeding templates...");

  for (const t of templates) {
    const existing = await prisma.template.findFirst({
      where: { name: t.name, ownerType: TemplateOwnerType.SYSTEM },
    });

    if (!existing) {
      await prisma.template.create({
        data: {
          name: t.name,
          ownerType: TemplateOwnerType.SYSTEM,
          meetingContext: t.meetingContext,
          sections: {
            create: t.sections.map((s, i) => ({
              order: i,
              title: s.title,
              hint: s.hint,
              metadata: "metadata" in s ? (s.metadata as object) : {},
            })),
          },
        },
      });
      console.log(`Created template: ${t.name}`);
    } else {
      console.log(`Template already exists: ${t.name}`);
    }
  }

  console.log("Template seeding complete.");
}

seedTemplates()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
