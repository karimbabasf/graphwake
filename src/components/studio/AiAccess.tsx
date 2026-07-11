"use client";

import { KeyRound } from "lucide-react";
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

export function AiAccess() {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<AiConfigValue>(() => {
    const provider = getAiProvider();
    return { provider, apiKey: getAiKey(provider), model: getAiModel(provider) };
  });

  function openDialog() {
    const provider = getAiProvider();
    setConfig({ provider, apiKey: getAiKey(provider), model: getAiModel(provider) });
    setOpen(true);
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveAiConfig({
      provider: config.provider,
      apiKey: config.apiKey,
      model: config.model,
    });
    setOpen(false);
  }

  return (
    <>
      <button className="ai-access-button" type="button" onClick={openDialog}>
        <KeyRound aria-hidden="true" size={14} />
        AI model
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="AI model access"
        description="Choose a provider, add your own key, and pick a model. Everything stays in this browser session and never enters a project or export."
      >
        <form className="project-form" onSubmit={save}>
          <AiConfigFields value={config} onChange={setConfig} />
          <div className="dialog-actions">
            <ActionButton tone="quiet" onClick={() => setOpen(false)}>
              Cancel
            </ActionButton>
            <ActionButton tone="signal" type="submit">
              Save for this session
            </ActionButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}
