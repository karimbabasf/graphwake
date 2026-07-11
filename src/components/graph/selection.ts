type SelectionCallback = (id: string | null) => void;

export function dispatchGraphSelection(
  kind: "node" | "edge" | "stage",
  id: string | null,
  onSelectNode: SelectionCallback,
  onSelectEdge: SelectionCallback,
) {
  if (kind === "node") {
    onSelectNode(id);
    return;
  }

  if (kind === "edge") {
    onSelectEdge(id);
    return;
  }

  onSelectNode(null);
  onSelectEdge(null);
}
