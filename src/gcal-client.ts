import { google, type calendar_v3 } from "googleapis";
import { GoogleAuth } from "googleapis-common";
import type { CalendarEvent, SyncedEvent } from "./types.js";

const SYNC_TAG = "timetree-gcal-sync";

export class GCalClient {
  private calendar: calendar_v3.Calendar;
  private calendarId: string;

  constructor(credentials: Record<string, unknown>, calendarId: string) {
    const auth = new GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });

    this.calendar = google.calendar({ version: "v3", auth });
    this.calendarId = calendarId;
  }

  /**
   * syncedBy=timetree-gcal-sync の拡張プロパティを持つ全イベントを取得
   */
  async listSyncedEvents(): Promise<SyncedEvent[]> {
    const events: SyncedEvent[] = [];
    let pageToken: string | undefined;

    do {
      const res = await this.calendar.events.list({
        calendarId: this.calendarId,
        privateExtendedProperty: [`syncedBy=${SYNC_TAG}`],
        maxResults: 2500,
        pageToken,
        showDeleted: false,
        singleEvents: false,
      });

      for (const item of res.data.items ?? []) {
        const props = item.extendedProperties?.private ?? {};
        if (props.timetreeUid && item.id) {
          
events.push({
  googleEventId: item.id,
  timetreeUid: props.timetreeUid,
  lastModified: props.timetreeLastModified ?? "",
  summary: item.summary ?? "",
});

        }
      }

      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);

    return events;
  }

  /**
   * Google Calendar にイベントを作成
   */
  async createEvent(event: CalendarEvent): Promise<string> {
    const body = this.toGCalEvent(event);
    const res = await this.calendar.events.insert({
      calendarId: this.calendarId,
      requestBody: body,
    });
    return res.data.id!;
  }

  /**
   * Google Calendar のイベントを更新
   */
  async updateEvent(
    googleEventId: string,
    event: CalendarEvent
 
): Promise<void> {
 
const body = this.toGCalEvent(event);

if (event.allDay) {
  Object.assign(body.start!, { dateTime: null, timeZone: null });
  Object.assign(body.end!, { dateTime: null, timeZone: null });
} else {
  Object.assign(body.start!, { date: null });
  Object.assign(body.end!, { date: null });
}

await this.calendar.events.patch({
  calendarId: this.calendarId,
  eventId: googleEventId,
  requestBody: body,
});

  }

  /**
   * Google Calendar のイベントを削除
   */
  async deleteEvent(googleEventId: string): Promise<void> {
    await this.calendar.events.delete({
      calendarId: this.calendarId,
      eventId: googleEventId,
    });
  }

  /**
   * CalendarEvent を Google Calendar API のイベント形式に変換
   */
  private toGCalEvent(
    event: CalendarEvent
  ): calendar_v3.Schema$Event {
    const body: calendar_v3.Schema$Event = {
      summary: event.summary,
      description: event.description || undefined,
      location: event.location || undefined,
      extendedProperties: {
        private: {
          syncedBy: SYNC_TAG,
          timetreeUid: event.uid,
          timetreeLastModified: event.lastModified?.toISOString() ?? "",
        },
      },
    };

    if (event.allDay) {
      body.start = { date: formatDate(event.start) };
      body.end = { date: formatDate(event.end) };
    } else {
  body.start = {
    dateTime: event.start.toISOString(),
    timeZone: "Europe/Berlin",
  };
  body.end = {
    dateTime: event.end.toISOString(),
    timeZone: "Europe/Berlin",
  };
}

    if (event.recurrence.length > 0) {
      body.recurrence = event.recurrence;
    }

    return body;
  }
}

/** YYYY-MM-DD 形式にフォーマット */
function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
