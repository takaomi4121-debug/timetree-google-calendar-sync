/** TimeTree-Exporter が出力する ICS イベントをパースした結果 */
export interface CalendarEvent {
  uid: string;
  summary: string;
  description: string;
  location: string;
  start: Date;
  end: Date;
  allDay: boolean;
  recurrence: string[];
  lastModified: Date | null;
}

/** Google Calendar に同期済みのイベント情報 */

export interface SyncedEvent {
  googleEventId: string;
  timetreeUid: string;
  lastModified: string;
  summary?: string;
}


/** 差分計算の結果 */
export interface SyncDiff {
  toCreate: CalendarEvent[];
  toUpdate: { source: CalendarEvent; googleEventId: string }[];
  toDelete: { googleEventId: string; timetreeUid: string }[];
}

/** 同期結果 */
export interface SyncResult {
  created: number;
  updated: number;
  deleted: number;
  errors: number;
}

/** 環境変数から読み込む設定 */
export interface Config {
  timetreeEmail: string;
  timetreePassword: string;
  timetreeCalendarCode: string;
  googleCalendarId: string;
  googleCredentials: Record<string, unknown>;
  icsFilePath: string;
}
