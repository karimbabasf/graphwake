import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ManualMutation } from "@/components/studio/ManualMutation";
import type { GraphSnapshot } from "@/lib/domain/types";
import { makeNode } from "@/test/factories";

describe("ManualMutation", () => {
  it("defaults an unselected relation to two different nodes", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const snapshot: GraphSnapshot = {
      sequence: 2,
      status: "stopped",
      stateHash: "a".repeat(64),
      nodes: [
        makeNode({ id: "node-a", label: "Alpha" }),
        makeNode({ id: "node-b", label: "Beta" }),
      ],
      edges: [],
    };

    render(
      <ManualMutation
        mode="edge"
        snapshot={snapshot}
        selectedNodeId={null}
        onModeChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText("Stored rationale"), "Alpha supports Beta.");
    await user.click(screen.getByRole("button", { name: "Commit relation" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ sourceRef: "node-a", targetRef: "node-b" }),
    );
  });
});
