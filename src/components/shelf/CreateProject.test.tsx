import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CreateProject } from "@/components/shelf/CreateProject";
import {
  gatewayRequestHeaders,
  setGatewayAccessToken,
} from "@/lib/runtime/gatewayAccess";

describe("CreateProject", () => {
  beforeEach(() => sessionStorage.clear());

  it("preserves an existing access token when the optional field is blank", async () => {
    const user = userEvent.setup();
    setGatewayAccessToken("existing-session-token-value");
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<CreateProject onCreate={onCreate} />);

    await user.click(screen.getByRole("button", { name: /new project/i }));
    await user.type(screen.getByLabelText("Project name"), "Gateway map");
    await user.type(screen.getByLabelText("Purpose"), "Test token reuse.");
    await user.type(screen.getByLabelText("Starting prompt"), "Map one idea.");
    await user.click(screen.getByRole("radio", { name: /ai gateway/i }));
    await user.click(screen.getByRole("button", { name: /create project/i }));

    expect(onCreate).toHaveBeenCalledOnce();
    expect(gatewayRequestHeaders().Authorization).toBe(
      "Bearer existing-session-token-value",
    );
  });
});
