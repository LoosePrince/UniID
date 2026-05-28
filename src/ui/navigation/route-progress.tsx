"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useNavigationTransition } from "./navigation-transition";

export function RouteProgress() {
  const { isPending } = useNavigationTransition();
  const reduceMotion = useReducedMotion();

  if (!isPending) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[80] h-0.5 overflow-hidden bg-transparent">
      <motion.div
        className="h-full origin-left bg-accent-500 shadow-[0_0_18px_rgba(91,91,214,0.55)] dark:bg-accent-300"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: reduceMotion ? 1 : [0.12, 0.68, 0.92] }}
        transition={{ duration: reduceMotion ? 0.01 : 1.1, ease: "easeOut", repeat: reduceMotion ? 0 : Infinity }}
      />
    </div>
  );
}