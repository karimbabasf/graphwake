"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  useEffect,
  useId,
  useRef,
  type MouseEvent,
  type ReactNode,
} from "react";

interface DialogProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}

export function Dialog({
  open,
  title,
  description,
  onClose,
  children,
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>("input, textarea, select, button")?.focus();

    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !panel) return;
      const controls = [...panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )];
      if (controls.length === 0) return;
      const first = controls[0];
      const last = controls.at(-1) as HTMLElement;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", keydown);
    document.body.classList.add("dialog-open");
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.classList.remove("dialog-open");
      previous?.focus();
    };
  }, [onClose, open]);

  function closeFromBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="dialog-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={closeFromBackdrop}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            className="dialog-panel"
            initial={{ opacity: 0, scale: 0.98, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.985, y: 8 }}
          >
            <header className="dialog-heading">
              <span className="eyebrow">LOCAL RECORD</span>
              <h2 id={titleId}>{title}</h2>
              {description ? <p id={descriptionId}>{description}</p> : null}
            </header>
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
