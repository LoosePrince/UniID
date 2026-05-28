"use client";

import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import * as React from "react";

export function PageTransition({
  children,
  variant = "default"
}: {
  children: React.ReactNode;
  variant?: "default" | "console";
}) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const distance = variant === "console" ? 8 : 12;

  if (reduceMotion) {
    return <div key={pathname}>{children}</div>;
  }

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: distance }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className={variant === "console" ? "min-h-full" : undefined}
    >
      {children}
    </motion.div>
  );
}