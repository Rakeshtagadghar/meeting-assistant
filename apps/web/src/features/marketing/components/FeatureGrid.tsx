"use client";

import { motion } from "framer-motion";
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
      "Click Generate after you're done—get summary, key points, action items, decisions.",
    icon: SparklesIcon,
    badge: "Post-processing",
  },
  {
    title: "Download-ready Exports",
    description:
      "PDF/DOCX downloads with progress UI. Download appears only when ready.",
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
      "Built-in consent reminder + checkbox before meeting transcription.",
    icon: ShieldCheckIcon,
    badge: "Compliance",
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

const cardVariants = {
  hidden: { opacity: 0, y: 18, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45 },
  },
};

export function FeatureGrid() {
  return (
    <section id="features" className="py-24 sm:py-32 bg-bg-secondary">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section header */}
        <div className="mx-auto max-w-2xl text-center mb-16">
          <h2 className="text-base font-semibold leading-7 gradient-text">
            Features
          </h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-text-heading sm:text-4xl">
            Everything you need to capture, summarize, and share
          </p>
        </div>

        {/* Feature cards grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              variants={cardVariants}
              className="glass-card rounded-2xl p-6 group cursor-default"
            >
              {/* Icon and badge row */}
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl icon-gradient flex items-center justify-center">
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <span className="gradient-badge px-3 py-1 rounded-full text-xs font-medium text-text-body">
                  {feature.badge}
                </span>
              </div>

              {/* Content */}
              <h3 className="text-lg font-semibold text-text-heading mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-text-body leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
