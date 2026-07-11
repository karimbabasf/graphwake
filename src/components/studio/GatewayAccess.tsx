"use client";

import { KeyRound } from "lucide-react";
import { useState, type FormEvent } from "react";

import { ActionButton } from "@/components/ui/ActionButton";
import { Dialog } from "@/components/ui/Dialog";
import { setGatewayAccessToken } from "@/lib/runtime/gatewayAccess";

export function GatewayAccess() {
  const [open, setOpen] = useState(false);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setGatewayAccessToken(String(data.get("accessToken") ?? ""));
    setOpen(false);
  }

  return (
    <>
      <button
        className="gateway-access-button"
        type="button"
        onClick={() => setOpen(true)}
      >
        <KeyRound aria-hidden="true" size={14} />
        Gateway access
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Gateway access"
        description="Enter the access token set by this deployment operator. It stays in session storage and is never added to a project or export."
      >
        <form className="project-form" onSubmit={save}>
          <label>
            <span>Deployment access token</span>
            <input
              name="accessToken"
              type="password"
              minLength={24}
              autoComplete="off"
              required
            />
          </label>
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
