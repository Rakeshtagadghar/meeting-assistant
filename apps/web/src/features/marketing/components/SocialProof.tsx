"use client";

const proofItems = [
  "Built for fast note-taking",
  "Designed for privacy-first teams",
  "Optimized for low-latency live capture",
];

export function SocialProof() {
  return (
    <section className="relative py-12">
      <div className="mx-auto max-w-7xl px-6 lg:px-8" data-stagger-group>
        <div className="landing-glass-card flex flex-wrap items-center justify-center gap-x-8 gap-y-4 rounded-3xl px-6 py-6">
          {proofItems.map((item) => (
            <div
              key={item}
              data-stagger-item
              className="flex items-center gap-2"
            >
              <div className="landing-dot h-2.5 w-2.5 rounded-full" />
              <span className="text-sm font-semibold text-text-body">
                {item}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
