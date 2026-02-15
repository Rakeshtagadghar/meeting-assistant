"use client";

const steps = [
  {
    number: "01",
    title: "Start a note",
    text: "Create a new note in the web app or open Quick Note on desktop.",
  },
  {
    number: "02",
    title: "Capture the conversation",
    text: "Live transcript appears as people speak. Pause or resume whenever needed.",
  },
  {
    number: "03",
    title: "Click Generate",
    text: "AI processes your transcript after the meeting and creates structured outputs.",
  },
  {
    number: "04",
    title: "Export or share",
    text: "Download PDF or DOCX, or share a restricted link with specific emails.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-8" data-stagger-group>
        <div data-stagger-item className="mx-auto mb-16 max-w-3xl text-center">
          <h2 className="landing-kicker">Simple workflow</h2>
          <p className="landing-section-title mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">
            <span className="landing-gradient-title">
              From conversation to clarity in four steps.
            </span>
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <article key={step.number} data-stagger-item className="relative">
              {index < steps.length - 1 && (
                <div className="absolute left-[calc(50%+2rem)] top-8 hidden h-0.5 w-[calc(100%-4rem)] bg-gradient-to-r from-primary/50 via-cyan-400/50 to-orange-400/50 lg:block" />
              )}

              <div className="landing-glass-card rounded-3xl p-6 text-center">
                <div className="landing-icon-chip mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-bold text-white shadow-lg">
                  {step.number}
                </div>
                <h3 className="landing-section-title mb-2 text-lg font-bold text-text-heading">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-text-body">
                  {step.text}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
