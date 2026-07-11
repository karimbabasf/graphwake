"use client";

import { Pause, Play } from "lucide-react";

import { ActionButton } from "@/components/ui/ActionButton";
import type { EngineKind, ProjectStatus } from "@/lib/domain/types";
import { RUN_LIMITS } from "@/lib/runtime/limits";

interface RunControlProps {
  status: ProjectStatus;
  engine: EngineKind;
  running: boolean;
  disabled?: boolean;
  nodeCount: number;
  edgeCount: number;
  onStart: () => void;
  onStop: () => void;
}

export function RunControl({
  status,
  engine,
  running,
  disabled,
  nodeCount,
  edgeCount,
  onStart,
  onStop,
}: RunControlProps) {
  return (
    <section className="run-control" aria-label="Graph runner">
      <div className="run-state">
        <i className={running ? "run-live" : ""} aria-hidden="true" />
        <span>{running ? "RUNNING" : status.toUpperCase()}</span>
        <small>{engine === "local" ? "LOCAL STUDY" : "AI GATEWAY"}</small>
      </div>
      <div className="budget-meter" aria-label={`${nodeCount} of ${RUN_LIMITS.nodeBudget} nodes`}>
        <span>OBJECT BUDGET</span>
        <i>
          <b style={{ transform: `scaleX(${Math.min(1, nodeCount / RUN_LIMITS.nodeBudget)})` }} />
        </i>
        <output>{nodeCount}/{RUN_LIMITS.nodeBudget}</output>
      </div>
      <span className="relation-count">{edgeCount} RELATIONS</span>
      {running ? (
        <ActionButton tone="ink" onClick={onStop}>
          <Pause aria-hidden="true" size={16} />
          Stop
        </ActionButton>
      ) : (
        <ActionButton tone="signal" onClick={onStart} disabled={disabled}>
          <Play aria-hidden="true" size={16} />
          {status === "draft" ? "Start" : "Resume"}
        </ActionButton>
      )}
    </section>
  );
}
