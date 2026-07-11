"use client";

import { Box, Network, Sigma as SigmaIcon } from "lucide-react";
import {
  useId,
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { ActionButton } from "@/components/ui/ActionButton";
import type {
  GraphEdge,
  GraphEvent,
  GraphNode,
  GraphSnapshot,
} from "@/lib/domain/types";
import { degreeCentrality } from "@/lib/insights/graphMetrics";
import { cosineSimilarity } from "@/lib/insights/vectors";

type InspectorTab = "object" | "vector" | "insight";

const INSPECTOR_TABS = [
  ["object", Box, "Object"],
  ["vector", SigmaIcon, "Vector"],
  ["insight", Network, "Insight"],
] as const;

interface InspectorProps {
  snapshot: GraphSnapshot;
  node: GraphNode | null;
  edge: GraphEdge | null;
  event: GraphEvent | null;
  onEmbed?: (node: GraphNode) => Promise<void>;
}

function confidenceLabel(value: number): string {
  if (value >= 0.8) return "high asserted confidence";
  if (value >= 0.5) return "medium asserted confidence";
  return "low asserted confidence";
}

function shortHash(value: string | null): string {
  return value ? `${value.slice(0, 10)}…${value.slice(-6)}` : "genesis";
}

export function Inspector({ snapshot, node, edge, event, onEmbed }: InspectorProps) {
  const [tab, setTab] = useState<InspectorTab>("object");
  const [embedding, setEmbedding] = useState(false);
  const tabGroupId = useId();
  const insight = useMemo(
    () => (node ? degreeCentrality(snapshot, node.id) : null),
    [node, snapshot],
  );
  const nearest = useMemo(() => {
    if (!node) return null;
    return snapshot.nodes
      .filter((candidate) => candidate.id !== node.id && candidate.vector.dimensions === node.vector.dimensions)
      .map((candidate) => ({
        candidate,
        score: cosineSimilarity(node.vector.values, candidate.vector.values),
      }))
      .sort((a, b) => b.score - a.score)[0] ?? null;
  }, [node, snapshot.nodes]);

  async function createEmbedding() {
    if (!node || !onEmbed) return;
    setEmbedding(true);
    try {
      await onEmbed(node);
    } finally {
      setEmbedding(false);
    }
  }

  const title = node?.label ?? edge?.relation ?? (event ? `Event ${event.sequence}` : "Nothing selected");

  function moveTab(event: ReactKeyboardEvent<HTMLButtonElement>) {
    const currentIndex = INSPECTOR_TABS.findIndex(([value]) => value === tab);
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % INSPECTOR_TABS.length;
    else if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + INSPECTOR_TABS.length) % INSPECTOR_TABS.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = INSPECTOR_TABS.length - 1;
    else return;

    event.preventDefault();
    const nextTab = INSPECTOR_TABS[nextIndex][0];
    setTab(nextTab);
    event.currentTarget.parentElement
      ?.querySelector<HTMLButtonElement>(`[data-inspector-tab="${nextTab}"]`)
      ?.focus();
  }

  return (
    <aside className="inspector" aria-label="Object inspector">
      <header className="inspector-heading">
        <span className="eyebrow">INSPECTOR / {snapshot.sequence.toString().padStart(3, "0")}</span>
        <h2 tabIndex={-1}>{title}</h2>
        <p>
          {node?.summary ?? edge?.rationale ?? event?.reason ?? "Select an object or event to inspect its stored meaning and trace."}
        </p>
      </header>

      <div className="inspector-tabs" role="tablist" aria-label="Inspector views">
        {INSPECTOR_TABS.map(([value, Icon, label]) => (
          <button
            key={value}
            id={`${tabGroupId}-${value}-tab`}
            type="button"
            role="tab"
            aria-selected={tab === value}
            aria-controls={`${tabGroupId}-panel`}
            tabIndex={tab === value ? 0 : -1}
            data-inspector-tab={value}
            onClick={() => setTab(value)}
            onKeyDown={moveTab}
          >
            <Icon aria-hidden="true" size={14} />
            {label}
          </button>
        ))}
      </div>

      <div
        id={`${tabGroupId}-panel`}
        className="inspector-body"
        role="tabpanel"
        aria-labelledby={`${tabGroupId}-${tab}-tab`}
        tabIndex={0}
      >
        {tab === "object" ? (
          <div className="specimen-sheet">
            {node ? (
              <>
                <dl>
                  <div><dt>Kind</dt><dd>{node.kind}</dd></div>
                  <div><dt>Status</dt><dd>{node.epistemicStatus}</dd></div>
                  <div><dt>Confidence</dt><dd>{Math.round(node.confidence * 100)}%<small>{confidenceLabel(node.confidence)}</small></dd></div>
                  <div><dt>Object ID</dt><dd><code>{node.id}</code></dd></div>
                  <div><dt>Created by</dt><dd><code>{node.createdByEventId}</code></dd></div>
                  <div><dt>Updated by</dt><dd><code>{node.updatedByEventId}</code></dd></div>
                </dl>
              </>
            ) : null}
            {edge ? (
              <dl>
                <div><dt>Relation</dt><dd>{edge.relation}</dd></div>
                <div><dt>Source</dt><dd><code>{edge.source}</code></dd></div>
                <div><dt>Target</dt><dd><code>{edge.target}</code></dd></div>
                <div><dt>Confidence</dt><dd>{Math.round(edge.confidence * 100)}%</dd></div>
                <div><dt>Created by</dt><dd><code>{edge.createdByEventId}</code></dd></div>
              </dl>
            ) : null}
            {event ? (
              <div className="transition-trace">
                <span>TRANSITION TRACE</span>
                <dl>
                  <div><dt>Event type</dt><dd>{event.type}</dd></div>
                  <div><dt>Actor</dt><dd>{event.actor}</dd></div>
                  <div><dt>Reducer</dt><dd>version {event.reducerVersion}</dd></div>
                  <div><dt>Input link</dt><dd><code>{shortHash(event.previousEventHash)}</code></dd></div>
                  <div><dt>Event hash</dt><dd><code>{shortHash(event.eventHash)}</code></dd></div>
                  <div><dt>Output state</dt><dd><code>{shortHash(event.resultingStateHash)}</code></dd></div>
                </dl>
                <p>This trace explains the application transition. It is not hidden model reasoning.</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === "vector" ? (
          node ? (
            <div className="vector-sheet">
              <div className="vector-readout">
                {node.vector.values.slice(0, 20).map((value, index) => (
                  <i
                    key={index}
                    style={{ transform: `scaleY(${Math.max(0.08, Math.abs(value))})` }}
                    data-sign={value < 0 ? "negative" : "positive"}
                  />
                ))}
              </div>
              <dl>
                <div><dt>Method</dt><dd>{node.vector.method}</dd></div>
                <div><dt>Space</dt><dd>{node.vector.dimensions} dimensions</dd></div>
                <div><dt>Normalized</dt><dd>{node.vector.normalized ? "yes" : "no"}</dd></div>
                {nearest ? (
                  <div><dt>Nearest visible</dt><dd>{nearest.candidate.label}<small>cosine {nearest.score.toFixed(3)}</small></dd></div>
                ) : null}
              </dl>
              <p>Cosine score measures angle in this named vector space. It does not prove shared meaning.</p>
              {onEmbed ? (
                <ActionButton tone="quiet" onClick={() => void createEmbedding()} disabled={embedding}>
                  {embedding ? "Creating embedding" : "Create model embedding"}
                </ActionButton>
              ) : null}
            </div>
          ) : (
            <div className="empty-inspector"><p>Select a node to inspect its vector.</p></div>
          )
        ) : null}

        {tab === "insight" ? (
          insight ? (
            <div className="insight-sheet">
              <span className="insight-number">{Number(insight.value).toFixed(3)}</span>
              <strong>{insight.method}</strong>
              <dl>
                <div><dt>Sequence</dt><dd>{insight.sequence}</dd></div>
                <div><dt>Formula</dt><dd>{insight.formula}</dd></div>
                <div><dt>Inputs</dt><dd>{insight.inputIds.length} visible IDs</dd></div>
              </dl>
              <p>{insight.caveat}</p>
            </div>
          ) : (
            <div className="empty-inspector"><p>Select a node to compute an inspectable graph metric.</p></div>
          )
        ) : null}
      </div>
    </aside>
  );
}
