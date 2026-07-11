const RUN_LOCK_PREFIX = "graphwake:run:";

export class ProjectRunLockedError extends Error {
  constructor(projectId: string) {
    super(`Project ${projectId} is already running in another browser tab.`);
    this.name = "ProjectRunLockedError";
  }
}

function browserLocks(): LockManager | null {
  if (typeof navigator === "undefined" || !("locks" in navigator)) {
    return null;
  }
  return navigator.locks;
}

function lockName(projectId: string): string {
  return `${RUN_LOCK_PREFIX}${projectId}`;
}

export async function runWithProjectLock<T>(
  projectId: string,
  action: () => Promise<T>,
  locks: LockManager | null = browserLocks(),
): Promise<T> {
  if (!locks) return action();

  let acquired = false;
  let result: T | undefined;
  await locks.request(
    lockName(projectId),
    { mode: "exclusive", ifAvailable: true },
    async (lock) => {
      if (!lock) return;
      acquired = true;
      result = await action();
    },
  );

  if (!acquired) throw new ProjectRunLockedError(projectId);
  return result as T;
}

export type AvailableProjectLockResult<T> =
  | { acquired: false }
  | { acquired: true; value: T };

export async function withAvailableProjectLock<T>(
  projectId: string,
  action: () => Promise<T>,
  locks: LockManager | null = browserLocks(),
): Promise<AvailableProjectLockResult<T>> {
  if (!locks) return { acquired: false };

  let result: AvailableProjectLockResult<T> = { acquired: false };
  await locks.request(
    lockName(projectId),
    { mode: "exclusive", ifAvailable: true },
    async (lock) => {
      if (!lock) return;
      result = { acquired: true, value: await action() };
    },
  );
  return result;
}
