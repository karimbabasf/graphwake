import { hashEvent, hashSnapshot } from "@/lib/domain/hash";
import { emptySnapshot, reduceEvent } from "@/lib/domain/reducer";
import type {
  GraphEvent,
  GraphSnapshot,
  LedgerVerification,
} from "@/lib/domain/types";

export function replayEvents(
  events: GraphEvent[],
  targetSequence = Number.POSITIVE_INFINITY,
): GraphSnapshot {
  if (targetSequence < 0) {
    throw new RangeError("Target sequence cannot be negative");
  }

  let snapshot = emptySnapshot();
  let expected = 1;

  for (const event of events) {
    if (event.sequence > targetSequence) break;
    if (event.sequence !== expected) {
      throw new Error(
        `Expected event sequence ${expected}, received ${event.sequence}`,
      );
    }
    snapshot = reduceEvent(snapshot, event);
    expected += 1;
  }

  return snapshot;
}

export async function verifyLedger(
  events: GraphEvent[],
): Promise<LedgerVerification> {
  const errors: string[] = [];
  let snapshot = emptySnapshot();
  let previousHash: string | null = null;
  let checkedEvents = 0;

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const expectedSequence = index + 1;
    checkedEvents += 1;

    if (event.sequence !== expectedSequence) {
      errors.push(
        `${event.id}: expected sequence ${expectedSequence}, received ${event.sequence}`,
      );
      break;
    }
    if (event.previousEventHash !== previousHash) {
      errors.push(`${event.id}: previous event hash does not match`);
    }

    const calculatedEventHash = await hashEvent(event);
    if (calculatedEventHash !== event.eventHash) {
      errors.push(`${event.id}: event hash does not match`);
    }

    try {
      const next = reduceEvent(snapshot, event);
      const calculatedStateHash = await hashSnapshot(next);
      if (calculatedStateHash !== event.resultingStateHash) {
        errors.push(`${event.id}: resulting state hash does not match`);
      }
      snapshot = { ...next, stateHash: calculatedStateHash };
    } catch (error) {
      errors.push(
        `${event.id}: ${error instanceof Error ? error.message : "reducer failed"}`,
      );
      break;
    }

    previousHash = event.eventHash;
  }

  return {
    valid: errors.length === 0,
    checkedEvents,
    finalStateHash: events.length === 0 ? null : snapshot.stateHash,
    errors,
  };
}
