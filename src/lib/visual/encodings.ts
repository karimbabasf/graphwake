import type {
  EpistemicStatus,
  EventType,
  GraphEdge,
  GraphNode,
  NodeKind,
  RelationKind,
} from "@/lib/domain/types";

export type NodeShape =
  | "circle"
  | "diamond"
  | "hexagon"
  | "pill"
  | "ring"
  | "square"
  | "triangle";

export interface NodeVisual {
  color: string;
  borderColor: string;
  shape: NodeShape;
  size: number;
}

export interface EdgeVisual {
  color: string;
  dash: number[];
  size: number;
  type: "arrow";
}

const NODE_SHAPES: Record<NodeKind, NodeShape> = {
  source: "square",
  observation: "circle",
  assertion: "diamond",
  concept: "hexagon",
  question: "triangle",
  decision: "pill",
  state: "ring",
};

const EPISTEMIC_COLORS: Record<EpistemicStatus, string> = {
  observed: "#16735a",
  asserted: "#2b50d6",
  inferred: "#7b4bb7",
  hypothesis: "#b26622",
};

const RELATION_VISUALS: Record<
  RelationKind,
  Pick<EdgeVisual, "color" | "dash">
> = {
  supports: { color: "#16735a", dash: [] },
  refutes: { color: "#bd3a32", dash: [3, 3] },
  "derived-from": { color: "#2b50d6", dash: [8, 3] },
  "depends-on": { color: "#6c6472", dash: [2, 3] },
  "similar-to": { color: "#7b4bb7", dash: [1, 4] },
  "causal-hypothesis": { color: "#b26622", dash: [10, 4, 2, 4] },
  "transitions-to": { color: "#167b82", dash: [12, 3] },
  contains: { color: "#3f4448", dash: [5, 2] },
};

const WAKE_COLORS: Partial<Record<EventType, string>> = {
  "node.added": "#16735a",
  "node.updated": "#7b4bb7",
  "edge.added": "#2b50d6",
  "run.started": "#167b82",
  "run.stopped": "#6c6472",
  "run.failed": "#bd3a32",
  "run.interrupted": "#b26622",
};

export function nodeVisual(
  node: GraphNode,
  options: { mode?: "semantic" | "degree"; degree?: number } = {},
): NodeVisual {
  const mode = options.mode ?? "semantic";
  const size =
    mode === "degree"
      ? Math.min(18, 8 + Math.sqrt(Math.max(0, options.degree ?? 0)) * 1.8)
      : 10;

  return {
    color: EPISTEMIC_COLORS[node.epistemicStatus],
    borderColor: node.evidence.length > 0 ? "#151719" : "#8a8f91",
    shape: NODE_SHAPES[node.kind],
    size,
  };
}

export function edgeVisual(edge: GraphEdge): EdgeVisual {
  const visual = RELATION_VISUALS[edge.relation];

  return {
    color: visual.color,
    dash: [...visual.dash],
    size: 0.8 + edge.confidence * 1.8,
    type: "arrow",
  };
}

export function wakeColor(type: EventType): string {
  return WAKE_COLORS[type] ?? "#6c6472";
}

export function relationVisual(relation: RelationKind) {
  return RELATION_VISUALS[relation];
}
