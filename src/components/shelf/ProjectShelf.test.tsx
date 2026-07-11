import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProjectShelf } from "@/components/shelf/ProjectShelf";
import { makeProject } from "@/test/factories";

describe("ProjectShelf", () => {
  it("creates the first project from a bounded prompt", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(
      <ProjectShelf
        projects={[]}
        loading={false}
        error={null}
        onCreate={onCreate}
        onOpen={vi.fn()}
        onRename={vi.fn()}
        onExport={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /create your first graph/i }));
    await user.type(screen.getByLabelText(/project name/i), "Image evolution");
    await user.type(screen.getByLabelText(/purpose/i), "Trace visible state changes.");
    await user.type(
      screen.getByLabelText(/starting prompt/i),
      "Map the decisions that transform one image state into the next.",
    );
    await user.click(screen.getByRole("button", { name: /^create project$/i }));

    expect(onCreate).toHaveBeenCalledWith({
      name: "Image evolution",
      purpose: "Trace visible state changes.",
      seedPrompt: "Map the decisions that transform one image state into the next.",
      engine: "local",
    });
  });

  it("requires the exact project name before delete", async () => {
    const user = userEvent.setup();
    const project = makeProject({ name: "Evidence atlas" });
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(
      <ProjectShelf
        projects={[project]}
        loading={false}
        error={null}
        onCreate={vi.fn()}
        onOpen={vi.fn()}
        onRename={vi.fn()}
        onExport={vi.fn()}
        onDelete={onDelete}
      />,
    );

    await user.click(screen.getByRole("button", { name: /delete evidence atlas/i }));
    const confirm = screen.getByRole("button", { name: /^delete project$/i });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText(/type evidence atlas/i), "Evidence atlas");
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    expect(onDelete).toHaveBeenCalledWith(project.id);
  });
});
