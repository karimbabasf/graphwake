import { beforeEach, describe, expect, it } from "vitest";

import {
  gatewayRequestHeaders,
  setGatewayAccessToken,
} from "@/lib/runtime/gatewayAccess";

describe("Gateway access", () => {
  beforeEach(() => sessionStorage.clear());

  it("keeps a deployment token in the current browser session", () => {
    setGatewayAccessToken("session-deployment-token-value");

    expect(gatewayRequestHeaders()).toMatchObject({
      Authorization: "Bearer session-deployment-token-value",
    });
  });
});
