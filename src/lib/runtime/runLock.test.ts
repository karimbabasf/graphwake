import { describe, expect, it, vi } from "vitest";

import {
  ProjectRunLockedError,
  runWithProjectLock,
  withAvailableProjectLock,
} from "@/lib/runtime/runLock";

describe("runWithProjectLock", () => {
  it("refuses to start when another tab owns the project lock", async () => {
    const action = vi.fn();
    const locks = {
      request: async (
        _name: string,
        _options: LockOptions,
        callback: (lock: Lock | null) => Promise<void>,
      ) => callback(null),
    } as unknown as LockManager;

    await expect(
      runWithProjectLock("project-1", action, locks),
    ).rejects.toBeInstanceOf(ProjectRunLockedError);
    expect(action).not.toHaveBeenCalled();
  });

  it("holds an available lock until recovery work finishes", async () => {
    let held = false;
    const locks = {
      request: async <T>(
        _name: string,
        _options: LockOptions,
        callback: (lock: Lock | null) => Promise<T>,
      ) => {
        held = true;
        const value = await callback({} as Lock);
        held = false;
        return value;
      },
    } as unknown as LockManager;

    const result = await withAvailableProjectLock(
      "project-1",
      async () => {
        expect(held).toBe(true);
        await Promise.resolve();
        expect(held).toBe(true);
        return "recovered";
      },
      locks,
    );

    expect(result).toEqual({ acquired: true, value: "recovered" });
    expect(held).toBe(false);
  });

  it("skips automatic recovery when Web Locks are unavailable", async () => {
    const action = vi.fn();

    await expect(
      withAvailableProjectLock("project-1", action, null),
    ).resolves.toEqual({ acquired: false });
    expect(action).not.toHaveBeenCalled();
  });
});
