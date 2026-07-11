import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CreateProject } from "@/components/shelf/CreateProject";
import { getActiveAiConfig } from "@/lib/runtime/aiAccess";

describe("CreateProject", () => {
  beforeEach(() => sessionStorage.clear());

  it("creates a local project without any AI configuration", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<CreateProject onCreate={onCreate} />);

    await user.click(screen.getByRole("button", { name: /new project/i }));
    await user.type(screen.getByLabelText("Project name"), "Local map");
    await user.type(screen.getByLabelText(/purpose/i), "Study one idea.");
    await user.type(screen.getByLabelText(/starting prompt/i), "Map one idea.");
    await user.click(screen.getByRole("button", { name: /create project/i }));

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ engine: "local" }),
    );
    expect(getActiveAiConfig()).toBeNull();
  });

  it("saves the chosen provider, key, and model for a model project", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<CreateProject onCreate={onCreate} />);

    await user.click(screen.getByRole("button", { name: /new project/i }));
    await user.type(screen.getByLabelText("Project name"), "Model map");
    await user.type(screen.getByLabelText(/purpose/i), "Grow with a model.");
    await user.type(screen.getByLabelText(/starting prompt/i), "Map one idea.");
    await user.click(screen.getByRole("radio", { name: /ai model/i }));
    await user.type(screen.getByLabelText(/openai api key/i), "sk-example-key");
    await user.click(screen.getByRole("button", { name: /create project/i }));

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ engine: "model" }),
    );
    expect(getActiveAiConfig()).toMatchObject({
      provider: "openai",
      apiKey: "sk-example-key",
    });
  });
});
