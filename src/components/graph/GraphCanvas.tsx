"use client";

import { LocateFixed, Orbit } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type Sigma from "sigma";

import { WakeLayer } from "@/components/graph/WakeLayer";
import type {
  GraphEvent,
  GraphSnapshot,
  LayoutPosition,
} from "@/lib/domain/types";
import { createLayoutWorker, graphPositions } from "@/lib/visual/layout";
import {
  projectSnapshot,
  type ProjectedEdgeAttributes,
  type ProjectedGraph,
  type ProjectedNodeAttributes,
} from "@/lib/visual/projection";

interface GraphCanvasProps {
  snapshot: GraphSnapshot;
  layouts: LayoutPosition[];
  activeEvent: GraphEvent | null;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
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

export function GraphCanvas({
  snapshot,
  layouts,
  activeEvent,
  selectedNodeId,
  onSelectNode,
  onSaveLayout,
  readOnly = false,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [graph] = useState<ProjectedGraph>(() => projectSnapshot(snapshot, layouts));
  const selectNodeRef = useRef(onSelectNode);
  const [renderer, setRenderer] = useState<Sigma<
    ProjectedNodeAttributes,
    ProjectedEdgeAttributes
  > | null>(null);
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    selectNodeRef.current = onSelectNode;
  }, [onSelectNode]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let localRenderer: Sigma<
      ProjectedNodeAttributes,
      ProjectedEdgeAttributes
    > | null = null;
    void Promise.all([import("sigma"), import("sigma/rendering")]).then(
      ([{ default: SigmaRenderer }, { createEdgeArrowProgram }]) => {
        if (disposed) return;
        const created = new SigmaRenderer<
          ProjectedNodeAttributes,
          ProjectedEdgeAttributes
        >(graph, container, {
          defaultEdgeType: "arrow",
          edgeProgramClasses: {
            arrow: createEdgeArrowProgram<
              ProjectedNodeAttributes,
              ProjectedEdgeAttributes
            >(),
          },
          enableEdgeEvents: false,
          hideEdgesOnMove: true,
          labelColor: { color: "#151719" },
          labelFont: "var(--font-sans)",
          labelRenderedSizeThreshold: 7,
          labelSize: 12,
          renderEdgeLabels: false,
          stagePadding: 42,
          zIndex: true,
        });
        created.on("clickNode", ({ node }) => selectNodeRef.current(node));
        created.on("clickStage", () => selectNodeRef.current(null));
        localRenderer = created;
        setRenderer(created);
      },
    );

    return () => {
      disposed = true;
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
      />
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
