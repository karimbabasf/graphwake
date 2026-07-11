"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import type { ReactNode } from "react";

interface ActionButtonProps extends HTMLMotionProps<"button"> {
  children: ReactNode;
  tone?: "ink" | "signal" | "quiet" | "danger";
}

export function ActionButton({
  children,
  className = "",
  tone = "ink",
  type = "button",
  ...props
}: ActionButtonProps) {
  return (
    <motion.button
      type={type}
      className={`action-button action-button-${tone} ${className}`.trim()}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.975 }}
      {...props}
    >
      {children}
    </motion.button>
  );
}
