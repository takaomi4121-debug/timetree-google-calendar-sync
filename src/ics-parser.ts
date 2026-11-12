import { readFileSync } from "node:fs";
import ical, { type VEvent, type ParameterValue } from "node-ical";
import type { CalendarEvent } from "./types.js";

/**
 * ICS ファイルをパースして CalendarEvent 配列を返す
 */
export function parseIcsFile(filePath: string): CalendarEvent[] {
  const content = readFileSync(filePath, "utf-8");
  const parsed = ical.sync.parseICS(content);
  const events: CalendarEvent[] = [];

  for (const component of Object.values(parsed)) {
    if (!component || component.type !== "VEVENT") continue;

    const vevent = component as VEvent;
    if (!vevent.end) continue;

    const allDay = vevent.datetype === "date";

    events.push({
      uid: vevent.uid,
      summary: parameterValueToString(vevent.summary),
      description: parameterValueToString(vevent.description),
      location: parameterValueToString(vevent.location),
      start: new Date(vevent.start),
      end: new Date(vevent.end),
      allDay,
      recurrence: extractRecurrence(vevent),
      lastModified: vevent.lastmodified ? new Date(vevent.lastmodified) : null,
    });
  }

  return events;
}

/** ParameterValue<string> を plain string に変換 */
function parameterValueToString(value: ParameterValue | undefined): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.val;
}


function extractRecurrence(event: VEvent): string[] {
  const rules: string[] = [];

  if (event.rrule) {
    const raw = event.rrule.toString();

    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const rrule = lines.find((line) => line.startsWith("RRULE:"));

    if (rrule) {
      rules.push(rrule);
    } else if (raw.trim().startsWith("FREQ=")) {
      rules.push(`RRULE:${raw.trim()}`);
    } else {
      throw new Error(`Cannot parse recurrence rule for event ${event.uid}`);
    }
  }

  return rules;
}

