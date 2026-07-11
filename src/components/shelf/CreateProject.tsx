"use client";

import { Plus, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";

import {
  AiConfigFields,
  type AiConfigValue,
} from "@/components/studio/AiConfigFields";
import { ActionButton } from "@/components/ui/ActionButton";
import { Dialog } from "@/components/ui/Dialog";
import {
  getAiKey,
  getAiModel,
  getAiProvider,
  saveAiConfig,
} from "@/lib/runtime/aiAccess";
import type { CreateProjectInput } from "@/lib/persistence/projects";

interface CreateProjectProps {
  onCreate: (input: CreateProjectInput) => Promise<void>;
  empty?: boolean;
}

export function CreateProject({ onCreate, empty = false }: CreateProjectProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [engine, setEngine] = useState<"local" | "model">("local");
  const [aiConfig, setAiConfig] = useState<AiConfigValue>(() => {
    const provider = getAiProvider();
    return { provider, apiKey: getAiKey(provider), model: getAiModel(provider) };
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      const selectedEngine = data.get("engine") === "model" ? "model" : "local";
      if (selectedEngine === "model") {
        if (!aiConfig.apiKey.trim()) {
          throw new Error("Add a provider API key or choose the local runner.");
        }
        saveAiConfig({
          provider: aiConfig.provider,
          apiKey: aiConfig.apiKey,
          model: aiConfig.model,
        });
      }
      await onCreate({
        name: String(data.get("name") ?? ""),
        purpose: String(data.get("purpose") ?? ""),
        seedPrompt: String(data.get("seedPrompt") ?? ""),
        engine: selectedEngine,
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
          <div className="prompt-guide">
            <p className="prompt-guide-lead">
              This is not a chatbot. You are not asking a question, you are
              laying out a problem so its parts and connections become visible.
            </p>
            <p>
              Describe a territory and its actors. The runner grows a map and
              shows where claims support, refute, or depend on each other. There
              is no single answer at the end, there is a structure you can
              inspect.
            </p>
            <dl className="prompt-guide-examples">
              <div>
                <dt>Instead of</dt>
                <dd className="is-weak">Is this lending contract safe?</dd>
              </div>
              <div>
                <dt>Write</dt>
                <dd className="is-strong">
                  Map the trust assumptions, attack hypotheses, and open
                  questions around a lending pool with oracle-based liquidation
                  and no reentrancy guard. Actors: borrower, liquidator, admin,
                  oracle.
                </dd>
              </div>
            </dl>
          </div>
          <label>
            <span>Project name</span>
            <input name="name" required maxLength={80} placeholder="Lending pool risk map" />
          </label>
          <label>
            <span>Purpose</span>
            <textarea
              name="purpose"
              required
              maxLength={600}
              rows={3}
              placeholder="The lens: what should this map help you see? The risks, the trade-offs, the open questions worth chasing."
            />
            <small className="field-hint">
              The job, not the topic. What do you want surfaced, and what should
              stay separate (proven facts vs. unverified guesses)?
            </small>
          </label>
          <label>
            <span>Starting prompt</span>
            <textarea
              name="seedPrompt"
              required
              maxLength={1200}
              rows={5}
              placeholder="Map the states, decisions, evidence, and open questions around... Name the actors, moving parts, and tensions you already suspect."
            />
            <small className="field-hint">
              The territory. Name the actors, mechanisms, and concern areas: these
              become the first nodes. Give it a seed, not a full briefing. The run
              grows the rest.
            </small>
          </label>
          <fieldset>
            <legend>Runner</legend>
            <label className="engine-option">
              <input
                type="radio"
                name="engine"
                value="local"
                checked={engine === "local"}
                onChange={() => setEngine("local")}
              />
              <span>
                <strong>Local study mode</strong>
                Deterministic, private, and ready without a key.
              </span>
            </label>
            <label className="engine-option">
              <input
                type="radio"
                name="engine"
                value="model"
                checked={engine === "model"}
                onChange={() => setEngine("model")}
              />
              <span>
                <strong>AI model</strong>
                Model-proposed graph batches using your own provider key.
              </span>
            </label>
          </fieldset>
          {engine === "model" ? (
            <AiConfigFields value={aiConfig} onChange={setAiConfig} />
          ) : null}
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
