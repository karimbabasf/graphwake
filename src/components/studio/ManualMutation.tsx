"use client";

import { Link2, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";

import { ActionButton } from "@/components/ui/ActionButton";
import { Dialog } from "@/components/ui/Dialog";
import {
  EPISTEMIC_STATUSES,
  NODE_KINDS,
  RELATION_KINDS,
  type GraphSnapshot,
  type MutationProposal,
} from "@/lib/domain/types";

export type ManualMode = "node" | "edge" | null;

interface ManualMutationProps {
  mode: ManualMode;
  snapshot: GraphSnapshot;
  selectedNodeId: string | null;
  disabled?: boolean;
  onModeChange: (mode: ManualMode) => void;
  onSubmit: (proposal: MutationProposal) => Promise<void>;
}

export function ManualMutation({
  mode,
  snapshot,
  selectedNodeId,
  disabled,
  onModeChange,
  onSubmit,
}: ManualMutationProps) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const defaultSourceId = selectedNodeId ?? snapshot.nodes[0]?.id ?? "";
  const defaultTargetId =
    snapshot.nodes.find((node) => node.id !== defaultSourceId)?.id ?? "";

  async function submitNode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const evidenceLabel = String(data.get("evidenceLabel") ?? "").trim();
    const evidenceUri = String(data.get("evidenceUri") ?? "").trim();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        type: "add-node",
        ref: crypto.randomUUID(),
        label: String(data.get("label") ?? ""),
        summary: String(data.get("summary") ?? ""),
        kind: String(data.get("kind")) as (typeof NODE_KINDS)[number],
        epistemicStatus: String(data.get("status")) as (typeof EPISTEMIC_STATUSES)[number],
        confidence: Number(data.get("confidence")),
        evidence: evidenceLabel
          ? [{
              id: crypto.randomUUID(),
              label: evidenceLabel,
              ...(evidenceUri ? { uri: evidenceUri } : {}),
            }]
          : [],
        reason: String(data.get("reason") ?? ""),
      });
      onModeChange(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The object could not be added.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitEdge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        type: "add-edge",
        sourceRef: String(data.get("source")),
        targetRef: String(data.get("target")),
        relation: String(data.get("relation")) as (typeof RELATION_KINDS)[number],
        confidence: Number(data.get("confidence")),
        evidence: [],
        reason: String(data.get("reason") ?? ""),
      });
      onModeChange(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The relation could not be added.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="mutation-tools" aria-label="Manual graph editing">
        <button type="button" onClick={() => onModeChange("node")} disabled={disabled}>
          <Plus aria-hidden="true" size={15} />
          Object <kbd>N</kbd>
        </button>
        <button
          type="button"
          onClick={() => onModeChange("edge")}
          disabled={disabled || snapshot.nodes.length < 2}
        >
          <Link2 aria-hidden="true" size={15} />
          Relation <kbd>E</kbd>
        </button>
      </div>

      <Dialog
        open={mode === "node"}
        onClose={() => onModeChange(null)}
        title="Add object"
        description="The object becomes a hashed event in this project's local ledger."
      >
        <form className="project-form compact-form" onSubmit={submitNode}>
          <div className="form-grid">
            <label>
              <span>Label</span>
              <input name="label" required maxLength={100} />
            </label>
            <label>
              <span>Kind</span>
              <select name="kind" defaultValue="concept">
                {NODE_KINDS.map((kind) => <option key={kind}>{kind}</option>)}
              </select>
            </label>
          </div>
          <label>
            <span>Summary</span>
            <textarea name="summary" required maxLength={600} rows={3} />
          </label>
          <div className="form-grid form-grid-three">
            <label>
              <span>Epistemic status</span>
              <select name="status" defaultValue="asserted">
                {EPISTEMIC_STATUSES.map((status) => <option key={status}>{status}</option>)}
              </select>
            </label>
            <label>
              <span>Confidence</span>
              <input name="confidence" type="number" min="0" max="1" step="0.05" defaultValue="0.7" required />
            </label>
          </div>
          <label>
            <span>Why this object belongs</span>
            <textarea name="reason" required maxLength={600} rows={2} />
          </label>
          <div className="form-grid">
            <label>
              <span>Evidence label (optional)</span>
              <input name="evidenceLabel" maxLength={160} />
            </label>
            <label>
              <span>Source URL (optional)</span>
              <input name="evidenceUri" type="url" maxLength={2048} />
            </label>
          </div>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <div className="dialog-actions">
            <ActionButton tone="quiet" onClick={() => onModeChange(null)}>Cancel</ActionButton>
            <ActionButton tone="signal" type="submit" disabled={submitting}>Commit object</ActionButton>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={mode === "edge"}
        onClose={() => onModeChange(null)}
        title="Add relation"
        description="Choose an explicit relation. A causal hypothesis remains a claim, not proof."
      >
        <form className="project-form compact-form" onSubmit={submitEdge}>
          <label>
            <span>Source object</span>
            <select name="source" defaultValue={defaultSourceId} required>
              {snapshot.nodes.map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}
            </select>
          </label>
          <label>
            <span>Relation</span>
            <select name="relation" defaultValue="supports">
              {RELATION_KINDS.map((relation) => <option key={relation}>{relation}</option>)}
            </select>
          </label>
          <label>
            <span>Target object</span>
            <select name="target" defaultValue={defaultTargetId} required>
              {snapshot.nodes.map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}
            </select>
          </label>
          <label>
            <span>Confidence</span>
            <input name="confidence" type="number" min="0" max="1" step="0.05" defaultValue="0.7" required />
          </label>
          <label>
            <span>Stored rationale</span>
            <textarea name="reason" required maxLength={600} rows={3} />
          </label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <div className="dialog-actions">
            <ActionButton tone="quiet" onClick={() => onModeChange(null)}>Cancel</ActionButton>
            <ActionButton tone="signal" type="submit" disabled={submitting}>Commit relation</ActionButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}
