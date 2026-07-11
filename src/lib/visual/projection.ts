import { MultiDirectedGraph } from "graphology";

import type {
  GraphSnapshot,
  LayoutPosition,
  NodeKind,
  RelationKind,
} from "@/lib/domain/types";
import { edgeVisual, nodeVisual, type NodeShape } from "@/lib/visual/encodings";

export interface ProjectedNodeAttributes {
  [key: string]: unknown;
  x: number;
  y: number;
  label: string;
  size: number;
  color: string;
  borderColor: string;
  shape: NodeShape;
  kind: NodeKind;
  confidence: number;
}

export interface ProjectedEdgeAttributes {
  [key: string]: unknown;
  label: string;
  relation: RelationKind;
  color: string;
  dash: number[];
  size: number;
  type: "arrow";
  confidence: number;
  lane: number;
}

export type ProjectedGraph = MultiDirectedGraph<
  ProjectedNodeAttributes,
  ProjectedEdgeAttributes
>;

function stableNumber(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function deterministicPosition(
  id: string,
  index: number,
): { x: number; y: number } {
  const seed = stableNumber(id);
  const angle = (index * 2.3999632297 + (seed % 360) * (Math.PI / 180)) %
    (Math.PI * 2);
  const radius = 2.4 + Math.sqrt(index + 1) * 2.2 + (seed % 100) / 180;

  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

export function projectSnapshot(
  snapshot: GraphSnapshot,
  layouts: LayoutPosition[],
): ProjectedGraph {
  const graph = new MultiDirectedGraph<
    ProjectedNodeAttributes,
    ProjectedEdgeAttributes
  >();
  const positions = new Map(layouts.map((position) => [position.nodeId, position]));
  const parallelGroups = new Map<string, typeof snapshot.edges>();
  for (const edge of snapshot.edges) {
    const first = edge.source < edge.target ? edge.source : edge.target;
    const second = edge.source < edge.target ? edge.target : edge.source;
    const key = `${first}\u0000${second}`;
    const group = parallelGroups.get(key) ?? [];
    group.push(edge);
    parallelGroups.set(key, group);
  }
  const lanes = new Map<string, number>();
  for (const group of parallelGroups.values()) {
    const ordered = [...group].sort((left, right) =>
      left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
    );
    ordered.forEach((edge, index) => {
      const centeredLane = index - (ordered.length - 1) / 2;
      const direction = edge.source <= edge.target ? 1 : -1;
      lanes.set(edge.id, centeredLane * direction);
    });
  }

  snapshot.nodes.forEach((node, index) => {
    const position = positions.get(node.id) ?? deterministicPosition(node.id, index);
    const visual = nodeVisual(node);

    graph.addNode(node.id, {
      x: position.x,
      y: position.y,
      label: node.label,
      size: visual.size,
      color: visual.color,
      borderColor: visual.borderColor,
      shape: visual.shape,
      kind: node.kind,
      confidence: node.confidence,
    });
  });

  snapshot.edges.forEach((edge) => {
    const visual = edgeVisual(edge);

    graph.addDirectedEdgeWithKey(edge.id, edge.source, edge.target, {
      label: edge.relation,
      relation: edge.relation,
      color: visual.color,
      dash: visual.dash,
      size: visual.size,
      type: visual.type,
      confidence: edge.confidence,
      lane: lanes.get(edge.id) ?? 0,
    });
  });

  return graph;
}
