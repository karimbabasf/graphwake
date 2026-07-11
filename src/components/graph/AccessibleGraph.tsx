"use client";

import { useDeferredValue, useId, useMemo, useState } from "react";

import type { GraphSnapshot } from "@/lib/domain/types";

interface AccessibleGraphProps {
  snapshot: GraphSnapshot;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onSelectNode: (nodeId: string) => void;
  onSelectEdge: (edgeId: string) => void;
}

export function AccessibleGraph({
  snapshot,
  selectedNodeId,
  selectedEdgeId,
  onSelectNode,
  onSelectEdge,
}: AccessibleGraphProps) {
  const [query, setQuery] = useState("");
  const searchId = useId();
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase("en-US"));
  const nodes = useMemo(
    () =>
      snapshot.nodes.filter((node) =>
        `${node.label} ${node.summary} ${node.kind}`
          .toLocaleLowerCase("en-US")
          .includes(deferredQuery),
      ),
    [deferredQuery, snapshot.nodes],
  );
  const visibleNodeIds = useMemo(
    () => new Set(nodes.map((node) => node.id)),
    [nodes],
  );
  const edges = useMemo(
    () =>
      snapshot.edges.filter(
        (edge) =>
          deferredQuery.length === 0 ||
          edge.relation.includes(deferredQuery) ||
          visibleNodeIds.has(edge.source) ||
          visibleNodeIds.has(edge.target),
      ),
    [deferredQuery, snapshot.edges, visibleNodeIds],
  );

  return (
    <section className="accessible-graph" aria-label="Graph object list">
      <label htmlFor={searchId}>Find an object</label>
      <input
        id={searchId}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Node, relation, or summary"
      />
      <p className="object-count" aria-live="polite">
        {nodes.length} nodes, {edges.length} relations
      </p>

      <div className="accessible-list-group">
        <h3>Nodes</h3>
        <ul>
          {nodes.map((node) => (
            <li key={node.id}>
              <button
                type="button"
                aria-pressed={selectedNodeId === node.id}
                onClick={() => onSelectNode(node.id)}
                onFocus={() => onSelectNode(node.id)}
              >
                <span>{node.label}</span>
                <small>
                  {node.kind} · {node.epistemicStatus}
                </small>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="accessible-list-group">
        <h3>Relations</h3>
        <ul>
          {edges.map((edge) => (
            <li key={edge.id}>
              <button
                type="button"
                aria-pressed={selectedEdgeId === edge.id}
                onClick={() => onSelectEdge(edge.id)}
                onFocus={() => onSelectEdge(edge.id)}
              >
                <span>{edge.relation}</span>
                <small>
                  {edge.source.slice(0, 8)} to {edge.target.slice(0, 8)}
                </small>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
