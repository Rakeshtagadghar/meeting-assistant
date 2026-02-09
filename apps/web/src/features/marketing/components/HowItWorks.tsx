"use client";

import { motion } from "framer-motion";

const steps = [
  {
    number: "01",
    title: "Start a note",
    text: "Create a new note in the web app or open Quick Note on desktop.",
  },
  {
    number: "02",
    title: "Capture the conversation",
    text: "Live transcript appears as people speak. You can pause/resume any time.",
  },
  {
    number: "03",
    title: "Click Generate",
    text: "AI processes transcript after you're done and produces structured summaries.",
  },
  {
    number: "04",
    title: "Export or share",
    text: "Download PDF/DOCX or share a restricted link with specific emails.",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

const stepVariants = {
  hidden: { opacity: 0, y: 18, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45 },
  },
};

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 sm:py-32 bg-white">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section header */}
        <div className="mx-auto max-w-2xl text-center mb-16">
          <h2 className="text-base font-semibold leading-7 gradient-text">
            Simple workflow
          </h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-text-heading sm:text-4xl">
            How it works
          </p>
        </div>

        {/* Steps */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
        >
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              variants={stepVariants}
              className="relative"
            >
              {/* Connector line (not on last item) */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-0.5 bg-gradient-to-r from-primary/30 to-accent-pink/30" />
              )}

              {/* Step content */}
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary text-white text-xl font-bold mb-4 shadow-lg">
                  {step.number}
                </div>
                <h3 className="text-lg font-semibold text-text-heading mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-text-body leading-relaxed">
                  {step.text}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
