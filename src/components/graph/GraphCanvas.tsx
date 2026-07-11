"use client";

import { LocateFixed, Orbit } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type Sigma from "sigma";

import { WakeLayer } from "@/components/graph/WakeLayer";
import { dispatchGraphSelection } from "@/components/graph/selection";
import type {
  GraphEvent,
  GraphSnapshot,
  LayoutPosition,
} from "@/lib/domain/types";
import { createLayoutWorker, graphPositions } from "@/lib/visual/layout";
import {
  distanceToQuadratic,
  quadraticControlPoint,
} from "@/lib/visual/edgeGeometry";
import {
  projectSnapshot,
  type ProjectedEdgeAttributes,
  type ProjectedGraph,
  type ProjectedNodeAttributes,
} from "@/lib/visual/projection";

interface GraphCanvasProps {
  snapshot: GraphSnapshot;
  events: GraphEvent[];
  layouts: LayoutPosition[];
  activeEvent: GraphEvent | null;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onSelectEdge: (edgeId: string | null) => void;
  onSaveLayout?: (
    positions: Array<{ nodeId: string; x: number; y: number }>,
  ) => Promise<void>;
  readOnly?: boolean;
}

function syncGraph(target: ProjectedGraph, source: ProjectedGraph) {
  target.forEachEdge((edgeId) => {
    if (!source.hasEdge(edgeId)) target.dropEdge(edgeId);
  });
  target.forEachNode((nodeId) => {
    if (!source.hasNode(nodeId)) target.dropNode(nodeId);
  });
  source.forEachNode((nodeId, attributes) => {
    if (target.hasNode(nodeId)) target.replaceNodeAttributes(nodeId, attributes);
    else target.addNode(nodeId, attributes);
  });
  source.forEachEdge((edgeId, attributes, sourceId, targetId) => {
    if (target.hasEdge(edgeId)) target.replaceEdgeAttributes(edgeId, attributes);
    else target.addDirectedEdgeWithKey(edgeId, sourceId, targetId, attributes);
  });
}

function edgeAtPoint(
  renderer: Sigma<ProjectedNodeAttributes, ProjectedEdgeAttributes>,
  x: number,
  y: number,
): string | null {
  let closestEdge: string | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;
  const graph = renderer.getGraph();

  graph.forEachEdge((edgeId, attributes, sourceId, targetId) => {
    const sourceData = renderer.getNodeDisplayData(sourceId);
    const targetData = renderer.getNodeDisplayData(targetId);
    if (!sourceData || !targetData || sourceData.hidden || targetData.hidden) {
      return;
    }
    const source = renderer.framedGraphToViewport(sourceData);
    const target = renderer.framedGraphToViewport(targetData);
    const control = quadraticControlPoint(source, target, attributes.lane);
    const distance = distanceToQuadratic(
      { x, y },
      source,
      control,
      target,
    );
    const tolerance = Math.max(7, attributes.size + 4);
    if (distance <= tolerance && distance < closestDistance) {
      closestDistance = distance;
      closestEdge = edgeId;
    }
  });

  return closestEdge;
}

export function GraphCanvas({
  snapshot,
  events,
  layouts,
  activeEvent,
  selectedNodeId,
  selectedEdgeId,
  onSelectNode,
  onSelectEdge,
  onSaveLayout,
  readOnly = false,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [graph] = useState<ProjectedGraph>(() => projectSnapshot(snapshot, layouts));
  const selectNodeRef = useRef(onSelectNode);
  const selectEdgeRef = useRef(onSelectEdge);
  const [renderer, setRenderer] = useState<Sigma<
    ProjectedNodeAttributes,
    ProjectedEdgeAttributes
  > | null>(null);
  const [settling, setSettling] = useState(false);
  const [hovered, setHovered] = useState<
    { kind: "node" | "edge"; id: string; x: number; y: number } | null
  >(null);

  useEffect(() => {
    selectNodeRef.current = onSelectNode;
    selectEdgeRef.current = onSelectEdge;
  }, [onSelectEdge, onSelectNode]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let localRenderer: Sigma<
      ProjectedNodeAttributes,
      ProjectedEdgeAttributes
    > | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let cleanupInteractions = () => undefined;
    void Promise.all([import("sigma"), import("sigma/rendering")]).then(
      ([{ default: SigmaRenderer }, { createEdgeArrowProgram }]) => {
        if (disposed) return;
        const created = new SigmaRenderer<
          ProjectedNodeAttributes,
          ProjectedEdgeAttributes
        >(graph, container, {
          allowInvalidContainer: true,
          defaultEdgeType: "arrow",
          edgeProgramClasses: {
            arrow: createEdgeArrowProgram<
              ProjectedNodeAttributes,
              ProjectedEdgeAttributes
            >(),
          },
          enableEdgeEvents: false,
          edgeReducer: (_edgeId, data) => ({
            ...data,
            color: "#00000000",
            size: Math.max(8, data.size),
          }),
          hideEdgesOnMove: true,
          labelColor: { color: "#151719" },
          labelFont: "var(--font-sans)",
          labelRenderedSizeThreshold: 7,
          labelSize: 12,
          renderEdgeLabels: false,
          stagePadding: 42,
          zIndex: true,
        });
        let hoveredNodeId: string | null = null;
        let hoveredEdgeId: string | null = null;
        let nodeClick = false;
        created.on("clickNode", ({ node, event }) => {
          nodeClick = true;
          queueMicrotask(() => {
            nodeClick = false;
          });
          event.preventSigmaDefault();
          dispatchGraphSelection(
            "node",
            node,
            selectNodeRef.current,
            selectEdgeRef.current,
          );
        });
        created.on("clickStage", () => {
          dispatchGraphSelection(
            "stage",
            null,
            selectNodeRef.current,
            selectEdgeRef.current,
          );
        });
        created.on("enterNode", ({ node, event }) => {
          hoveredNodeId = node;
          hoveredEdgeId = null;
          setHovered({ kind: "node", id: node, x: event.x, y: event.y });
        });
        created.on("leaveNode", () => {
          hoveredNodeId = null;
          setHovered(null);
        });

        const position = (event: MouseEvent) => {
          const bounds = container.getBoundingClientRect();
          return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
        };
        const handleMove = (event: MouseEvent) => {
          if (hoveredNodeId) return;
          const point = position(event);
          const edge = edgeAtPoint(created, point.x, point.y);
          if (edge === hoveredEdgeId) return;
          hoveredEdgeId = edge;
          setHovered(
            edge
              ? { kind: "edge", id: edge, x: point.x, y: point.y }
              : null,
          );
        };
        const handleClick = (event: MouseEvent) => {
          if (nodeClick) return;
          const point = position(event);
          const edge = edgeAtPoint(created, point.x, point.y);
          if (!edge) return;
          dispatchGraphSelection(
            "edge",
            edge,
            selectNodeRef.current,
            selectEdgeRef.current,
          );
        };
        const handleLeave = () => {
          if (!hoveredNodeId) {
            hoveredEdgeId = null;
            setHovered(null);
          }
        };
        container.addEventListener("mousemove", handleMove);
        container.addEventListener("click", handleClick);
        container.addEventListener("mouseleave", handleLeave);
        cleanupInteractions = () => {
          container.removeEventListener("mousemove", handleMove);
          container.removeEventListener("click", handleClick);
          container.removeEventListener("mouseleave", handleLeave);
        };
        localRenderer = created;
        resizeObserver = new ResizeObserver(() => {
          if (container.clientWidth === 0 || container.clientHeight === 0) {
            return;
          }
          created.resize(true);
          created.scheduleRefresh();
        });
        resizeObserver.observe(container);
        setRenderer(created);
      },
    );

    return () => {
      disposed = true;
      cleanupInteractions();
      resizeObserver?.disconnect();
      localRenderer?.kill();
    };
  }, [graph]);

  useEffect(() => {
    if (!renderer) return;
    syncGraph(graph, projectSnapshot(snapshot, layouts));
    renderer.scheduleRefresh();
  }, [graph, layouts, renderer, snapshot]);

  useEffect(() => {
    if (!renderer) return;
    renderer.setSetting("nodeReducer", (nodeId, data) => ({
      ...data,
      highlighted: nodeId === selectedNodeId,
      zIndex: nodeId === selectedNodeId ? 2 : 1,
    }));
    renderer.scheduleRefresh({ layoutUnchange: true });
  }, [renderer, selectedNodeId]);

  async function settle() {
    if (graph.order < 2 || settling || readOnly) return;
    setSettling(true);
    const worker = await createLayoutWorker(graph);
    worker.start();
    window.setTimeout(async () => {
      worker.stop();
      worker.kill();
      renderer?.scheduleRefresh();
      await onSaveLayout?.(graphPositions(graph));
      setSettling(false);
    }, 900);
  }

  return (
    <div className="graph-canvas-shell">
      <div
        ref={containerRef}
        className="sigma-stage"
        role="img"
        aria-label={`Knowledge graph with ${snapshot.nodes.length} nodes and ${snapshot.edges.length} relations`}
        aria-describedby="graph-caveat"
      />
      <WakeLayer
        renderer={renderer}
        activeEvent={activeEvent}
        selectedNodeId={selectedNodeId}
        selectedEdgeId={selectedEdgeId}
      />
      {hovered?.kind === "node" ? (() => {
        const node = snapshot.nodes.find((candidate) => candidate.id === hovered.id);
        if (!node) return null;
        const relationCount = snapshot.edges.filter(
          (edge) => edge.source === node.id || edge.target === node.id,
        ).length;
        const lastEvent = events.find(
          (event) => event.id === node.updatedByEventId,
        );
        return (
          <div
            className="graph-tooltip"
            role="status"
            style={{ left: hovered.x + 14, top: hovered.y + 14 }}
          >
            <span>{node.kind} / {node.epistemicStatus}</span>
            <strong>{node.label}</strong>
            <p>{node.summary}</p>
            <dl>
              <div><dt>Relations</dt><dd>{relationCount}</dd></div>
              <div><dt>Confidence</dt><dd>{Math.round(node.confidence * 100)}%</dd></div>
              <div><dt>Last event</dt><dd>{lastEvent?.sequence ?? "unknown"}</dd></div>
            </dl>
            {lastEvent ? <small>Why event {lastEvent.sequence}: {lastEvent.reason}</small> : null}
          </div>
        );
      })() : null}
      {hovered?.kind === "edge" ? (() => {
        const edge = snapshot.edges.find((candidate) => candidate.id === hovered.id);
        if (!edge) return null;
        const source = snapshot.nodes.find((node) => node.id === edge.source);
        const target = snapshot.nodes.find((node) => node.id === edge.target);
        const createdEvent = events.find((event) => event.id === edge.createdByEventId);
        return (
          <div
            className="graph-tooltip"
            role="status"
            style={{ left: hovered.x + 14, top: hovered.y + 14 }}
          >
            <span>relation / {edge.relation}</span>
            <strong>{source?.label ?? edge.source} to {target?.label ?? edge.target}</strong>
            <p>{edge.rationale}</p>
            <dl>
              <div><dt>Confidence</dt><dd>{Math.round(edge.confidence * 100)}%</dd></div>
              <div><dt>Created event</dt><dd>{createdEvent?.sequence ?? "unknown"}</dd></div>
            </dl>
          </div>
        );
      })() : null}
      <div className="graph-tools" aria-label="Graph view tools">
        <button
          type="button"
          onClick={() => void renderer?.getCamera().animatedReset({ duration: 250 })}
          aria-label="Reset graph view"
        >
          <LocateFixed aria-hidden="true" size={16} />
          <span>Center</span>
        </button>
        <button
          type="button"
          onClick={() => void settle()}
          disabled={settling || readOnly || snapshot.nodes.length < 2}
          aria-label="Settle graph layout"
        >
          <Orbit aria-hidden="true" size={16} />
          <span>{settling ? "Settling" : "Settle"}</span>
        </button>
      </div>
      {snapshot.nodes.length === 0 ? (
        <div className="graph-empty" aria-live="polite">
          <span>FIELD 00</span>
          <h2>Ready for the first event.</h2>
          <p>Start the run or add an object. Every accepted change will appear here and in the ledger.</p>
        </div>
      ) : null}
      <p id="graph-caveat" className="sr-only">
        Spatial distance in this generated layout does not represent semantic similarity or cause.
      </p>
    </div>
  );
}
