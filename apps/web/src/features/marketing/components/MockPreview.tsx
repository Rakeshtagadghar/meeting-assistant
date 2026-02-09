"use client";

import { motion } from "framer-motion";

export function MockPreview() {
  return (
    <div className="relative">
      {/* Main preview card */}
      <div className="glass-card rounded-3xl p-6 max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <span className="text-xs text-text-muted">Quick Note</span>
        </div>

        {/* Recording indicator */}
        <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl bg-red-50 border border-red-100">
          <motion.div
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-2 h-2 rounded-full bg-red-500"
          />
          <span className="text-sm text-red-600 font-medium">Recording...</span>
          <span className="text-xs text-red-400 ml-auto">02:34</span>
        </div>

        {/* Transcript lines */}
        <div className="space-y-3 mb-4">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="flex gap-3"
          >
            <div className="w-6 h-6 rounded-full gradient-primary flex-shrink-0" />
            <div>
              <p className="text-xs text-text-muted">Sarah</p>
              <p className="text-sm text-text-heading">
                Let&apos;s discuss the Q4 roadmap priorities...
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 }}
            className="flex gap-3"
          >
            <div className="w-6 h-6 rounded-full gradient-accent flex-shrink-0" />
            <div>
              <p className="text-xs text-text-muted">Mike</p>
              <p className="text-sm text-text-heading">
                I think we should focus on the API first.
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.1 }}
            className="flex gap-3"
          >
            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 flex-shrink-0" />
            <div>
              <p className="text-xs text-text-muted">You</p>
              <p className="text-sm text-text-heading">
                <motion.span
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="inline-block"
                >
                  Typing...
                </motion.span>
              </p>
            </div>
          </motion.div>
        </div>

        {/* Generate button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full py-3 rounded-xl btn-gradient-primary text-white font-medium text-sm flex items-center justify-center gap-2"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
            />
          </svg>
          Generate Summary
        </motion.button>
      </div>

      {/* Floating decoration cards */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-4 -right-4 glass-card rounded-xl p-3 shadow-lg"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg gradient-badge flex items-center justify-center">
            <svg
              className="w-4 h-4 text-text-heading"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium text-text-heading">
              3 Action Items
            </p>
            <p className="text-xs text-text-muted">Extracted</p>
          </div>
        </div>
      </motion.div>

      <motion.div
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -bottom-4 -left-4 glass-card rounded-xl p-3 shadow-lg"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg icon-gradient flex items-center justify-center">
            <svg
              className="w-4 h-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium text-text-heading">Private</p>
            <p className="text-xs text-text-muted">End-to-end</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
