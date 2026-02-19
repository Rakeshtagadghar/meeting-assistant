import type { MeetingState } from "@/shared/types";

type Trigger =
  | "url_classified"
  | "prompt_displayed"
  | "user_start"
  | "user_snooze_or_deny"
  | "user_dismiss"
  | "deep_link_opened"
  | "recording_started"
  | "tab_closed_or_navigated"
  | "cooldown_expired"
  | "reset";

interface TransitionRule {
  from: MeetingState;
  trigger: Trigger;
  to: MeetingState;
}

const TRANSITIONS: TransitionRule[] = [
  { from: "IDLE", trigger: "url_classified", to: "MEETING_CANDIDATE" },
  {
    from: "MEETING_CANDIDATE",
    trigger: "prompt_displayed",
    to: "PROMPT_SHOWN",
  },
  { from: "PROMPT_SHOWN", trigger: "user_start", to: "USER_ACCEPTED" },
  {
    from: "PROMPT_SHOWN",
    trigger: "user_snooze_or_deny",
    to: "USER_DECLINED",
  },
  { from: "PROMPT_SHOWN", trigger: "user_dismiss", to: "IDLE" },
  {
    from: "USER_ACCEPTED",
    trigger: "recording_started",
    to: "RUNNING",
  },
  {
    from: "USER_ACCEPTED",
    trigger: "deep_link_opened",
    to: "RUNNING",
  },
  { from: "RUNNING", trigger: "tab_closed_or_navigated", to: "ENDED" },
  { from: "USER_DECLINED", trigger: "cooldown_expired", to: "IDLE" },
  { from: "ENDED", trigger: "reset", to: "IDLE" },
];

export function transition(
  current: MeetingState,
  trigger: Trigger,
): MeetingState | null {
  const rule = TRANSITIONS.find(
    (t) => t.from === current && t.trigger === trigger,
  );
  return rule?.to ?? null;
}

export type { Trigger };
