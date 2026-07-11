"use client";

import { ChevronDown, X } from "lucide-react";
import { useState } from "react";

import {
  EPISTEMIC_STATUSES,
  NODE_KINDS,
  RELATION_KINDS,
} from "@/lib/domain/types";
import { epistemicColor, relationVisual } from "@/lib/visual/encodings";

export function Legend() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button className="legend-minimized" type="button" onClick={() => setOpen(true)} aria-label="Open visual key">
        <span>VISUAL KEY</span>
        <ChevronDown aria-hidden="true" size={14} />
      </button>
    );
  }

  return (
    <aside className="visual-key" aria-label="Visual key">
      <header>
        <span>VISUAL KEY</span>
        <button type="button" onClick={() => setOpen(false)} aria-label="Minimize visual key">
          <X aria-hidden="true" size={14} />
        </button>
      </header>
      <div className="key-section">
        <b>SHAPE / OBJECT</b>
        <ul className="node-key">
          {NODE_KINDS.map((kind) => (
            <li key={kind}>
              <i className={`shape shape-${kind}`} />
              {kind}
            </li>
          ))}
        </ul>
      </div>
      <div className="key-section">
        <b>FILL / CERTAINTY</b>
        <ul className="fill-key">
          {EPISTEMIC_STATUSES.map((status) => (
            <li key={status}>
              <i style={{ background: epistemicColor(status) }} />
              {status}
            </li>
          ))}
        </ul>
        <span className="key-note">
          A dark outline means attached evidence; a faint outline means none.
        </span>
      </div>
      <div className="key-section">
        <b>LINE / RELATION</b>
        <ul className="relation-key">
          {RELATION_KINDS.map((relation) => {
            const visual = relationVisual(relation);
            return (
              <li key={relation}>
                <i
                  style={{
                    borderColor: visual.color,
                    borderTopStyle: visual.dash.length === 0 ? "solid" : "dashed",
                  }}
                />
                {relation}
              </li>
            );
          })}
        </ul>
      </div>
      <p>Layout distance has no semantic meaning. A moving wake marks one committed event, not model thought.</p>
    </aside>
  );
}
