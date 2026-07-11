import type { GraphEvent, GraphSnapshot } from "@/lib/domain/types";

function normalize(value: unknown): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Canonical JSON does not support non-finite numbers");
    }
    return Object.is(value, -0) ? 0 : value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalize(item));
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .filter((key) => record[key] !== undefined)
        .sort((a, b) => a.localeCompare(b))
        .map((key) => [key, normalize(record[key])]),
    );
  }

  throw new TypeError(`Canonical JSON does not support ${typeof value}`);
}

export function canonicalize(value: unknown): string {
  return JSON.stringify(normalize(value));
}

export async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function hashSnapshot(snapshot: GraphSnapshot): Promise<string> {
  return sha256(
    canonicalize({
      edges: [...snapshot.edges].sort((a, b) => a.id.localeCompare(b.id)),
      name: snapshot.name,
      nodes: [...snapshot.nodes].sort((a, b) => a.id.localeCompare(b.id)),
      sequence: snapshot.sequence,
      status: snapshot.status,
    }),
  );
}

export async function hashEvent(event: GraphEvent): Promise<string> {
  const { eventHash: _eventHash, ...hashableEvent } = event;
  void _eventHash;
  return sha256(canonicalize(hashableEvent));
}
