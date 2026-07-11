import { describe, expect, it, vi } from "vitest";

import { dispatchGraphSelection } from "@/components/graph/selection";

describe("dispatchGraphSelection", () => {
  it("selects a node without clearing it through the edge callback", () => {
    const onSelectNode = vi.fn();
    const onSelectEdge = vi.fn();

    dispatchGraphSelection("node", "node-1", onSelectNode, onSelectEdge);

    expect(onSelectNode).toHaveBeenCalledWith("node-1");
    expect(onSelectEdge).not.toHaveBeenCalled();
  });

  it("selects an edge without clearing it through the node callback", () => {
    const onSelectNode = vi.fn();
    const onSelectEdge = vi.fn();

    dispatchGraphSelection("edge", "edge-1", onSelectNode, onSelectEdge);

    expect(onSelectEdge).toHaveBeenCalledWith("edge-1");
    expect(onSelectNode).not.toHaveBeenCalled();
  });

  it("clears both selections for the stage", () => {
    const onSelectNode = vi.fn();
    const onSelectEdge = vi.fn();

    dispatchGraphSelection("stage", null, onSelectNode, onSelectEdge);

    expect(onSelectNode).toHaveBeenCalledWith(null);
    expect(onSelectEdge).toHaveBeenCalledWith(null);
  });
});
