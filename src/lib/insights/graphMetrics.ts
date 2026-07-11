import type {
  GraphSnapshot,
  InsightResult,
} from "@/lib/domain/types";

export interface PathResult {
  nodeIds: string[];
  edgeIds: string[];
  insight: InsightResult;
}

interface GraphIndex {
  adjacency: Map<string, Set<string>>;
  edgeIds: Map<string, string[]>;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
}

function graphIndex(snapshot: GraphSnapshot): GraphIndex {
  const adjacency = new Map<string, Set<string>>(
    snapshot.nodes.map((node) => [node.id, new Set<string>()]),
  );
  const edgeIds = new Map<string, string[]>();

  for (const edge of snapshot.edges) {
    const sourceNeighbors = adjacency.get(edge.source);
    const targetNeighbors = adjacency.get(edge.target);
    if (!sourceNeighbors || !targetNeighbors) {
      throw new Error(`Edge ${edge.id} references a missing node`);
    }
    sourceNeighbors.add(edge.target);
    targetNeighbors.add(edge.source);
    const key = pairKey(edge.source, edge.target);
    edgeIds.set(key, [...(edgeIds.get(key) ?? []), edge.id].sort());
  }

  return { adjacency, edgeIds };
}

function sortedNeighbors(index: GraphIndex, nodeId: string): string[] {
  return [...(index.adjacency.get(nodeId) ?? [])].sort((a, b) =>
    a.localeCompare(b),
  );
}

export function connectedComponents(snapshot: GraphSnapshot): string[][] {
  const index = graphIndex(snapshot);
  const unvisited = new Set(
    snapshot.nodes.map((node) => node.id).sort((a, b) => a.localeCompare(b)),
  );
  const components: string[][] = [];

  while (unvisited.size > 0) {
    const start = unvisited.values().next().value as string;
    const queue = [start];
    const component: string[] = [];
    unvisited.delete(start);

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const nodeId = queue[cursor];
      component.push(nodeId);
      for (const neighbor of sortedNeighbors(index, nodeId)) {
        if (!unvisited.has(neighbor)) continue;
        unvisited.delete(neighbor);
        queue.push(neighbor);
      }
    }

    components.push(component);
  }

  return components;
}

export function shortestPath(
  snapshot: GraphSnapshot,
  source: string,
  target: string,
): PathResult {
  const index = graphIndex(snapshot);
  if (!index.adjacency.has(source)) throw new Error(`Unknown source node ${source}`);
  if (!index.adjacency.has(target)) throw new Error(`Unknown target node ${target}`);

  const queue = [source];
  const previous = new Map<string, string | null>([[source, null]]);

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const nodeId = queue[cursor];
    if (nodeId === target) break;
    for (const neighbor of sortedNeighbors(index, nodeId)) {
      if (previous.has(neighbor)) continue;
      previous.set(neighbor, nodeId);
      queue.push(neighbor);
    }
  }

  const nodeIds: string[] = [];
  if (previous.has(target)) {
    let cursor: string | null = target;
    while (cursor !== null) {
      nodeIds.push(cursor);
      cursor = previous.get(cursor) ?? null;
    }
    nodeIds.reverse();
  }

  const edgeIds = nodeIds.slice(1).map((nodeId, indexInPath) => {
    const ids = index.edgeIds.get(pairKey(nodeIds[indexInPath], nodeId));
    if (!ids?.[0]) throw new Error("Path is missing its visible edge");
    return ids[0];
  });

  return {
    nodeIds,
    edgeIds,
    insight: {
      method: "breadth-first-shortest-path",
      sequence: snapshot.sequence,
      inputIds: [source, target],
      formula: "Breadth-first traversal on visible unweighted relations",
      value: nodeIds,
      caveat: "Relation direction and confidence are not part of this path.",
    },
  };
}

export function degreeCentrality(
  snapshot: GraphSnapshot,
  nodeId: string,
): InsightResult {
  const index = graphIndex(snapshot);
  const neighbors = index.adjacency.get(nodeId);
  if (!neighbors) throw new Error(`Unknown node ${nodeId}`);
  const denominator = Math.max(1, snapshot.nodes.length - 1);

  return {
    method: "degree-centrality",
    sequence: snapshot.sequence,
    inputIds: [nodeId, ...[...neighbors].sort()],
    formula: "unique visible neighbors / max(1, visible nodes - 1)",
    value: neighbors.size / denominator,
    caveat: "A high degree shows local connectivity, not importance or truth.",
  };
}

export function betweennessCentrality(
  snapshot: GraphSnapshot,
): Map<string, InsightResult> {
  const index = graphIndex(snapshot);
  const nodeIds = [...index.adjacency.keys()].sort((a, b) => a.localeCompare(b));
  const scores = new Map(nodeIds.map((nodeId) => [nodeId, 0]));

  for (const source of nodeIds) {
    const stack: string[] = [];
    const predecessors = new Map(
      nodeIds.map((nodeId) => [nodeId, [] as string[]]),
    );
    const pathCounts = new Map(nodeIds.map((nodeId) => [nodeId, 0]));
    const distances = new Map(nodeIds.map((nodeId) => [nodeId, -1]));
    pathCounts.set(source, 1);
    distances.set(source, 0);
    const queue = [source];

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor];
      stack.push(current);
      for (const neighbor of sortedNeighbors(index, current)) {
        if (distances.get(neighbor) === -1) {
          distances.set(neighbor, (distances.get(current) ?? -1) + 1);
          queue.push(neighbor);
        }
        if (distances.get(neighbor) === (distances.get(current) ?? -1) + 1) {
          pathCounts.set(
            neighbor,
            (pathCounts.get(neighbor) ?? 0) + (pathCounts.get(current) ?? 0),
          );
          predecessors.get(neighbor)?.push(current);
        }
      }
    }

    const dependency = new Map(nodeIds.map((nodeId) => [nodeId, 0]));
    while (stack.length > 0) {
      const node = stack.pop() as string;
      for (const predecessor of predecessors.get(node) ?? []) {
        const nodePaths = pathCounts.get(node) ?? 0;
        if (nodePaths === 0) continue;
        const contribution =
          ((pathCounts.get(predecessor) ?? 0) / nodePaths) *
          (1 + (dependency.get(node) ?? 0));
        dependency.set(
          predecessor,
          (dependency.get(predecessor) ?? 0) + contribution,
        );
      }
      if (node !== source) {
        scores.set(node, (scores.get(node) ?? 0) + (dependency.get(node) ?? 0));
      }
    }
  }

  const denominator = (nodeIds.length - 1) * (nodeIds.length - 2);
  return new Map(
    nodeIds.map((nodeId) => {
      const undirectedScore = (scores.get(nodeId) ?? 0) / 2;
      const normalized = denominator > 0 ? (2 * undirectedScore) / denominator : 0;
      return [
        nodeId,
        {
          method: "brandes-betweenness-centrality",
          sequence: snapshot.sequence,
          inputIds: nodeIds,
          formula: "normalized share of visible unweighted shortest paths",
          value: normalized,
          caveat: "Relation direction, confidence, and hidden nodes are excluded.",
        },
      ];
    }),
  );
}
