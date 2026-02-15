"use client";

import {
  MicrophoneIcon,
  SparklesIcon,
  ArrowDownTrayIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

const features = [
  {
    title: "Quick Note (Live)",
    description:
      "See transcript appear as people speak. No distracting AI mid-meeting.",
    icon: MicrophoneIcon,
    badge: "Desktop",
  },
  {
    title: "Generate Summary",
    description:
      "Click Generate after you are done, then get summary, key points, action items, and decisions.",
    icon: SparklesIcon,
    badge: "Post-processing",
  },
  {
    title: "Download-ready Exports",
    description:
      "PDF and DOCX downloads with progress UI. Download appears only when ready.",
    icon: ArrowDownTrayIcon,
    badge: "Controlled",
  },
  {
    title: "Private by default",
    description:
      "Notes stay private unless you share. Clear retention and delete controls.",
    icon: LockClosedIcon,
    badge: "Trust",
  },
  {
    title: "Search your notes",
    description:
      "Find anything across notes and transcripts with fast full-text search.",
    icon: MagnifyingGlassIcon,
    badge: "Web",
  },
  {
    title: "Consent-first",
    description:
      "Built-in consent reminder and checkbox before meeting transcription.",
    icon: ShieldCheckIcon,
    badge: "Compliance",
  },
];

export function FeatureGrid() {
  return (
    <section id="features" className="relative py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-8" data-stagger-group>
        <div data-stagger-item className="mx-auto mb-16 max-w-3xl text-center">
          <h2 className="landing-kicker">Feature stack</h2>
          <p className="landing-section-title mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">
            <span className="landing-gradient-title">
              Everything you need to capture, summarize, and ship follow-ups.
            </span>
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              data-stagger-item
              className="landing-glass-card rounded-3xl p-6"
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="landing-icon-chip flex h-12 w-12 items-center justify-center rounded-xl">
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <span className="landing-pill rounded-full px-3 py-1 text-xs font-semibold text-text-body">
                  {feature.badge}
                </span>
              </div>

              <h3 className="landing-section-title mb-2 text-xl font-bold text-text-heading">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-text-body">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
