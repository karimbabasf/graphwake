import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Inspector } from "@/components/studio/Inspector";

describe("Inspector", () => {
  it("moves tabs with the arrow keys", async () => {
    const user = userEvent.setup();
    render(
      <Inspector
        snapshot={{
          sequence: 0,
          status: "draft",
          stateHash: "0".repeat(64),
          nodes: [],
          edges: [],
        }}
        node={null}
        edge={null}
        event={null}
      />,
    );

    const objectTab = screen.getByRole("tab", { name: "Object" });
    objectTab.focus();
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("tab", { name: "Evidence" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Evidence" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
