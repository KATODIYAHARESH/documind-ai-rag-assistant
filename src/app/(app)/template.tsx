"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

/** Re-mounted on every route change to provide a soft page transition. */
export default function Template({ children }: { children: ReactNode }) {
  return (
    <motion.div
      className="flex h-full w-full min-w-0 flex-1 flex-col"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
