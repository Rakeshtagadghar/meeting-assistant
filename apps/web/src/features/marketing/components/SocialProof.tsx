"use client";

import { motion } from "framer-motion";

const proofItems = [
  "Built for fast note-taking",
  "Designed for privacy-first teams",
  "Optimized for low-latency live capture",
];

export function SocialProof() {
  return (
    <section className="py-12 bg-white border-y border-gray-100">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4"
        >
          {proofItems.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full gradient-primary" />
              <span className="text-sm font-medium text-text-body">{item}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
