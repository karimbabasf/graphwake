import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

describe("security headers", () => {
  it("denies framing and limits browser capabilities", async () => {
    const rules = await nextConfig.headers?.();
    const headers = new Map(
      rules?.[0]?.headers.map((header) => [header.key, header.value]),
    );

    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Permissions-Policy")).toContain("camera=()");
    expect(headers.get("Content-Security-Policy")).toContain(
      "frame-ancestors 'none'",
    );
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});
