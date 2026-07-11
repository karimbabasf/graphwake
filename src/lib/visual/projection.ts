import { DirectedGraph } from "graphology";

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
}

export type ProjectedGraph = DirectedGraph<
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
  const graph = new DirectedGraph<
    ProjectedNodeAttributes,
    ProjectedEdgeAttributes
  >();
  const positions = new Map(layouts.map((position) => [position.nodeId, position]));

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
    });
  });

  return graph;
}
