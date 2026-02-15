"use client";

import { motion } from "framer-motion";

export function MockPreview() {
  return (
    <div className="relative">
      <div className="landing-glass-card mx-auto max-w-md rounded-3xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-red-400" />
            <div className="h-3 w-3 rounded-full bg-yellow-400" />
            <div className="h-3 w-3 rounded-full bg-green-400" />
          </div>
          <span className="text-xs text-text-muted">Quick Note</span>
        </div>

        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
          <motion.div
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="h-2 w-2 rounded-full bg-red-500"
          />
          <span className="text-sm font-medium text-red-600">Recording...</span>
          <span className="ml-auto text-xs text-red-400">02:34</span>
        </div>

        <div className="mb-4 space-y-3">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="flex gap-3"
          >
            <div className="gradient-primary h-6 w-6 flex-shrink-0 rounded-full" />
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
            <div className="gradient-accent h-6 w-6 flex-shrink-0 rounded-full" />
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
            <div className="h-6 w-6 flex-shrink-0 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400" />
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

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="btn-gradient-landing flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium text-white"
        >
          <svg
            className="h-4 w-4"
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

      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="landing-glass-card absolute -right-4 -top-4 rounded-xl p-3 shadow-lg"
      >
        <div className="flex items-center gap-2">
          <div className="landing-pill flex h-8 w-8 items-center justify-center rounded-lg">
            <svg
              className="h-4 w-4 text-text-heading"
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
        className="landing-glass-card absolute -bottom-4 -left-4 rounded-xl p-3 shadow-lg"
      >
        <div className="flex items-center gap-2">
          <div className="landing-icon-chip flex h-8 w-8 items-center justify-center rounded-lg">
            <svg
              className="h-4 w-4 text-white"
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
