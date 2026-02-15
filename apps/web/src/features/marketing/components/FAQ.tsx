"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDownIcon } from "@heroicons/react/24/outline";

const faqItems = [
  {
    q: "Do you store meeting audio?",
    a: "By default, no. The app stores transcript and summaries only. You control retention and deletions.",
  },
  {
    q: "Can I export to PDF or DOCX?",
    a: "Yes. Exports show a progress UI and the download option appears only when ready.",
  },
  {
    q: "Does it work in the browser?",
    a: "Yes for notes management, summaries, sharing, and exports. Desktop is best for live capture.",
  },
  {
    q: "How do cookies work?",
    a: "We use a CMP (Google CMP v2 compliant). Analytics run only after opt-in consent in EEA and UK.",
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleItem = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };

  return (
    <section className="relative py-24 sm:py-28">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mx-auto max-w-3xl px-6 lg:px-8" data-stagger-group>
        <div data-stagger-item className="mb-12 text-center">
          <h2 className="landing-section-title text-4xl font-extrabold tracking-tight sm:text-5xl">
            <span className="landing-gradient-title">
              Frequently asked questions.
            </span>
          </h2>
        </div>

        <div className="space-y-4">
          {faqItems.map((item, index) => (
            <div
              key={item.q}
              data-stagger-item
              className="landing-glass-card overflow-hidden rounded-2xl"
            >
              <button
                onClick={() => toggleItem(index)}
                className="flex w-full items-center justify-between px-6 py-5 text-left"
              >
                <span className="font-semibold text-text-heading">
                  {item.q}
                </span>
                <ChevronDownIcon
                  className={`h-5 w-5 text-text-muted transition-transform duration-200 ${
                    openIndex === index ? "rotate-180" : ""
                  }`}
                />
              </button>
              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.24 }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-5 text-text-body">{item.a}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
