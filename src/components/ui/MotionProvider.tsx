"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

export const INTERACTION_SPRING = {
  type: "spring" as const,
  stiffness: 400,
  damping: 28,
};

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={INTERACTION_SPRING}>
      {children}
    </MotionConfig>
  );
}
