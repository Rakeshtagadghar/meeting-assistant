import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seed(): Promise<void> {
  console.log("Seeding database...");

  const user = await prisma.user.upsert({
    where: { email: "dev@ainotes.local" },
    update: {},
    create: {
      email: "dev@ainotes.local",
      displayName: "Dev User",
    },
  });

  console.log(`Created user: ${user.email} (${user.id})`);

  const note = await prisma.note.create({
    data: {
      userId: user.id,
      title: "Welcome to AINotes",
      contentRich: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "This is your first note. Start capturing your meeting insights!",
              },
            ],
          },
        ],
      },
      contentPlain:
        "This is your first note. Start capturing your meeting insights!",
      type: "FREEFORM",
      tags: ["welcome"],
    },
  });

  console.log(`Created note: ${note.title} (${note.id})`);
  console.log("Seed complete.");
}

seed()
  .catch((e: unknown) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
