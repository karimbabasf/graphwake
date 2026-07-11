"use client";

import { Plus, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";

import { ActionButton } from "@/components/ui/ActionButton";
import { Dialog } from "@/components/ui/Dialog";
import type { CreateProjectInput } from "@/lib/persistence/projects";

interface CreateProjectProps {
  onCreate: (input: CreateProjectInput) => Promise<void>;
  empty?: boolean;
}

export function CreateProject({ onCreate, empty = false }: CreateProjectProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      await onCreate({
        name: String(data.get("name") ?? ""),
        purpose: String(data.get("purpose") ?? ""),
        seedPrompt: String(data.get("seedPrompt") ?? ""),
        engine: data.get("engine") === "gateway" ? "gateway" : "local",
      });
      setOpen(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Project creation failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <ActionButton
        tone={empty ? "signal" : "ink"}
        onClick={() => setOpen(true)}
        className={empty ? "create-first" : ""}
      >
        <Plus aria-hidden="true" size={17} />
        {empty ? "Create your first graph" : "New project"}
      </ActionButton>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Create a graph project"
        description="Give the runner a purpose and a bounded starting prompt. You can stop it at any time."
      >
        <form className="project-form" onSubmit={submit}>
          <label>
            <span>Project name</span>
            <input name="name" required maxLength={80} placeholder="Image evolution" />
          </label>
          <label>
            <span>Purpose</span>
            <textarea
              name="purpose"
              required
              maxLength={600}
              rows={3}
              placeholder="What should this graph help you inspect?"
            />
          </label>
          <label>
            <span>Starting prompt</span>
            <textarea
              name="seedPrompt"
              required
              maxLength={1200}
              rows={5}
              placeholder="Map the states, decisions, evidence, and open questions around..."
            />
          </label>
          <fieldset>
            <legend>Runner</legend>
            <label className="engine-option">
              <input type="radio" name="engine" value="local" defaultChecked />
              <span>
                <strong>Local study mode</strong>
                Deterministic, private, and ready without a key.
              </span>
            </label>
            <label className="engine-option">
              <input type="radio" name="engine" value="gateway" />
              <span>
                <strong>AI Gateway</strong>
                Model-generated proposals through your server configuration.
              </span>
            </label>
          </fieldset>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <div className="dialog-actions">
            <ActionButton tone="quiet" onClick={() => setOpen(false)}>
              Cancel
            </ActionButton>
            <ActionButton tone="signal" type="submit" disabled={submitting}>
              <Sparkles aria-hidden="true" size={16} />
              {submitting ? "Creating" : "Create project"}
            </ActionButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}
