import { describe, expect, it } from "vitest";

import manifest from "@/app/manifest";

describe("web manifest", () => {
  it("describes an installable Graphwake workspace", () => {
    const value = manifest();

    expect(value.name).toBe("Graphwake");
    expect(value.display).toBe("standalone");
    expect(value.start_url).toBe("/");
    expect(value.icons?.map((icon) => icon.sizes)).toEqual([
      "192x192",
      "512x512",
    ]);
  });
});
