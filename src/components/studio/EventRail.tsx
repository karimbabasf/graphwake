"use client";

import { Radio, RotateCcw } from "lucide-react";

import type { GraphEvent } from "@/lib/domain/types";

interface EventRailProps {
  events: GraphEvent[];
  replaySequence: number | null;
  selectedEventId: string | null;
  onReplay: (sequence: number) => void;
  onReturnLive: () => void;
  onSelectEvent: (eventId: string) => void;
}

function eventLabel(event: GraphEvent): string {
  return event.type.replace(".", " ");
}

export function EventRail({
  events,
  replaySequence,
  selectedEventId,
  onReplay,
  onReturnLive,
  onSelectEvent,
}: EventRailProps) {
  const latest = events.at(-1)?.sequence ?? 1;
  const value = replaySequence ?? latest;

  return (
    <section className="event-rail" aria-label="Event replay">
      <header>
        <div>
          <Radio aria-hidden="true" size={15} />
          <span>EVENT LEDGER</span>
        </div>
        <output>
          {replaySequence === null
            ? `LIVE / ${latest}`
            : `REPLAY ${replaySequence} OF ${latest}`}
        </output>
        {replaySequence !== null ? (
          <button type="button" onClick={onReturnLive}>
            <RotateCcw aria-hidden="true" size={14} />
            Return to live
          </button>
        ) : null}
      </header>
      <div className="event-track">
        <input
          type="range"
          aria-label="Replay sequence"
          min={1}
          max={latest}
          value={value}
          onChange={(event) => onReplay(Number(event.target.value))}
        />
        <div className="event-ticks" aria-label="Recorded events">
          {events.map((event) => (
            <button
              type="button"
              key={event.id}
              className={`${event.type.replace(".", "-")} ${selectedEventId === event.id ? "is-selected" : ""}`}
              aria-label={`Event ${event.sequence}: ${eventLabel(event)}`}
              title={`${event.sequence}. ${eventLabel(event)}`}
              onClick={() => {
                onSelectEvent(event.id);
                onReplay(event.sequence);
              }}
            >
              <i />
              <span>{event.sequence}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
