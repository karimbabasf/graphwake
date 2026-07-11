import type { ProjectedGraph } from "@/lib/visual/projection";

export interface LayoutWorker {
  start(): void;
  stop(): void;
  kill(): void;
}

export async function createLayoutWorker(
  graph: ProjectedGraph,
): Promise<LayoutWorker> {
  const [{ default: ForceAtlas2Layout }, { default: forceAtlas2 }] =
    await Promise.all([
      import("graphology-layout-forceatlas2/worker"),
      import("graphology-layout-forceatlas2"),
    ]);

  return new ForceAtlas2Layout(graph, {
    settings: {
      ...forceAtlas2.inferSettings(graph),
      barnesHutOptimize: graph.order > 250,
      gravity: 0.08,
      slowDown: 4,
    },
  });
}

export function graphPositions(graph: ProjectedGraph) {
  return graph.mapNodes((nodeId, attributes) => ({
    nodeId,
    x: attributes.x,
    y: attributes.y,
  }));
}
