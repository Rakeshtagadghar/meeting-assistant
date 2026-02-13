
-- 1. Create Enums
CREATE TYPE "TemplateOwnerType" AS ENUM ('SYSTEM', 'USER');
CREATE TYPE "TemplateMode" AS ENUM ('AUTO', 'SELECTED');

-- 2. Create Template Table
CREATE TABLE IF NOT EXISTS "templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ownerType" "TemplateOwnerType" NOT NULL,
    "owner_user_id" UUID,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "meeting_context" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "templates_ownerType_owner_user_id_idx" ON "templates"("ownerType", "owner_user_id");

-- 3. Create TemplateSection Table
CREATE TABLE IF NOT EXISTS "template_sections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "template_id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "hint" TEXT,

    CONSTRAINT "template_sections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "template_sections_template_id_idx" ON "template_sections"("template_id");

ALTER TABLE "template_sections" ADD CONSTRAINT "template_sections_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Create AIGenerationRun Table
CREATE TABLE IF NOT EXISTS "ai_generation_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "note_id" UUID NOT NULL,
    "template_id" UUID,
    "template_snapshot" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "output_markdown" TEXT,
    "output_html" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_generation_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_generation_runs_note_id_idx" ON "ai_generation_runs"("note_id");

-- 5. Update Note Table
ALTER TABLE "notes" ADD COLUMN "template_id" UUID;
ALTER TABLE "notes" ADD COLUMN "template_mode" "TemplateMode" NOT NULL DEFAULT 'AUTO';
ALTER TABLE "notes" ADD COLUMN "template_selected_at" TIMESTAMP(3);

ALTER TABLE "notes" ADD CONSTRAINT "notes_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_generation_runs" ADD CONSTRAINT "ai_generation_runs_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_generation_runs" ADD CONSTRAINT "ai_generation_runs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- 6. Seed System Templates
DO $$
DECLARE
    t_id UUID;
BEGIN
    -- Daily Standup
    IF NOT EXISTS (SELECT 1 FROM templates WHERE name = 'Daily Standup' AND "ownerType" = 'SYSTEM') THEN
        INSERT INTO templates (id, "ownerType", name, "meeting_context", "updated_at")
        VALUES (gen_random_uuid(), 'SYSTEM', 'Daily Standup', 'I attended a daily standup meeting. The goal is to document each participant’s updates regarding their recent accomplishment, current focus, and any blockers they are facing. Keep these notes short and to-the-point.', NOW())
        RETURNING id INTO t_id;

        INSERT INTO template_sections ("template_id", "order", title, hint) VALUES
        (t_id, 0, 'Announcements', 'Include any note-worthy points from the small-talk or announcements at the beginning of the call.'),
        (t_id, 1, 'Updates', 'Break these down into what was achieved yesterday, or accomplishments, what each person is working on today and highlight any blockers that could impact progress.'),
        (t_id, 2, 'Sidebar', 'Summarize any further discussions or issues that were explored after the main updates. Note any collaborative efforts, decisions made, or additional points raised.'),
        (t_id, 3, 'Action Items', 'Document and assign next steps from the meeting, summarize immediate tasks, provide reminders, and ensure accountability and clarity on responsibilities.');
    END IF;

    -- 1:1 Meeting
    IF NOT EXISTS (SELECT 1 FROM templates WHERE name = '1:1 Meeting' AND "ownerType" = 'SYSTEM') THEN
        INSERT INTO templates (id, "ownerType", name, "meeting_context", "updated_at")
        VALUES (gen_random_uuid(), 'SYSTEM', '1:1 Meeting', 'I am having a 1:1 meeting with someone in my team, please capture these meeting notes in a concise and actionable format. Focus on immediate priorities, progress, challenges, and personal feedback, ensuring the notes are structured for clarity, efficiency and easy follow-up.', NOW())
        RETURNING id INTO t_id;

        INSERT INTO template_sections ("template_id", "order", title, hint) VALUES
        (t_id, 0, 'Top of mind', 'What''s the most pressing issue or priority? Capture the top concerns or focus areas that need immediate attention.'),
        (t_id, 1, 'Updates and wins', 'Highlight recent achievements and progress. What''s going well? Document key updates that show momentum.'),
        (t_id, 2, 'Challenges and blockers', 'What obstacles are in the way? Note any blockers that are slowing progress.'),
        (t_id, 3, 'Mutual feedback', 'Did they give me any feedback on what I could do differently? Is there anything I should change about our team to make us more successful? Did I share any feedback for them? List it all here.'),
        (t_id, 4, 'Next Milestone', 'Define clear action items and next steps. Who''s doing what by when? Ensure accountability and follow-up.');
    END IF;

    -- All Hands
    IF NOT EXISTS (SELECT 1 FROM templates WHERE name = 'All Hands' AND "ownerType" = 'SYSTEM') THEN
        INSERT INTO templates (id, "ownerType", name, "meeting_context", "updated_at")
        VALUES (gen_random_uuid(), 'SYSTEM', 'All Hands', 'I attended our company''s all-hands meeting to stay informed about our overall direction. I wanted to understand how recent developments might affect my role, catch any important announcements, and get a sense of our priorities moving forward.', NOW())
        RETURNING id INTO t_id;

        INSERT INTO template_sections ("template_id", "order", title, hint) VALUES
        (t_id, 0, 'Business Overview', 'Capture updates on company performance, major achievements, and current market position.'),
        (t_id, 1, 'Strategic Direction', 'Note discussions about future plans, goals, and any significant changes in company strategy or focus.'),
        (t_id, 2, 'Team Updates', 'Record important announcements about departments, new initiatives, or significant projects across the organization.'),
        (t_id, 3, 'Impact on my role', 'Summarize information relevant to my specific role and team, including any changes, expectations, or opportunities mentioned.');
    END IF;

    -- Brainstorming
    IF NOT EXISTS (SELECT 1 FROM templates WHERE name = 'Brainstorming' AND "ownerType" = 'SYSTEM') THEN
        INSERT INTO templates (id, "ownerType", name, "meeting_context", "updated_at")
        VALUES (gen_random_uuid(), 'SYSTEM', 'Brainstorming', 'We''re trying to solve a problem together. This discussion lets us share ideas and feedback on those ideas. This section describes the problem we are trying to solve. What''s the context and current state? What''s been tried before?', NOW())
        RETURNING id INTO t_id;

        INSERT INTO template_sections ("template_id", "order", title, hint) VALUES
        (t_id, 0, 'Themes discussion', 'This section describes the major themes explored in the brainstorm.'),
        (t_id, 1, 'Specific ideas', 'This section lists the most important specific ideas or discussion points from the brainstorm.'),
        (t_id, 2, 'Future directions', 'This section is about what we should keep in mind as we move forward. Are there specific directions we decided to explore?');
    END IF;

    -- VC Pitch
    IF NOT EXISTS (SELECT 1 FROM templates WHERE name = 'VC Pitch' AND "ownerType" = 'SYSTEM') THEN
        INSERT INTO templates (id, "ownerType", name, "meeting_context", "updated_at")
        VALUES (gen_random_uuid(), 'SYSTEM', 'VC Pitch', 'I am an investor meeting a startup to see if I should potentially invest. Detail the background of the team members and their previous experience.', NOW())
        RETURNING id INTO t_id;

        INSERT INTO template_sections ("template_id", "order", title, hint) VALUES
        (t_id, 0, 'Problem', 'This section is about what problem the startup is trying to solve. Who has this problem? How many people or businesses have this problem? Why is it a problem?'),
        (t_id, 1, 'Product', 'What product is the startup building? How does the product work? How does it solve the user''s problem? Any specific details about the product goes here.'),
        (t_id, 2, 'Go-to-market', 'How will they sell the product? Have they started selling it yet? How are they reaching customers? How much will it cost? How will they get lots of customers?'),
        (t_id, 3, 'Traction', 'What has the startup achieved so far? How many users do they have? How much money are they making? What other progress or traction do they have?');
    END IF;

END $$;
