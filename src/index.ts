import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { loadConfig } from "./config.js";
import { parseIcsFile } from "./ics-parser.js";
import { GCalClient } from "./gcal-client.js";
import { SyncEngine } from "./sync-engine.js";

async function main(): Promise<void> {
  console.log("=== TimeTree → Google Calendar Sync ===\n");

  // 1. 設定読み込み
  const config = loadConfig();
  console.log("Config loaded.");

  // 2. timetree-exporter CLI で ICS エクスポート
  console.log("Exporting events from TimeTree...");
  exportFromTimeTree(config);

  if (!existsSync(config.icsFilePath)) {
    throw new Error(`ICS file not found: ${config.icsFilePath}`);
  }

  // 3. ICS パース
  console.log("Parsing ICS file...");
  const events = parseIcsFile(config.icsFilePath);
  console.log(`  Found ${events.length} events in ICS.`);

  // 4. Google Calendar クライアント初期化
  const gcal = new GCalClient(config.googleCredentials, config.googleCalendarId);

  // 5. 同期済みイベント取得
  console.log("Fetching synced events from Google Calendar...");
  const syncedEvents = await gcal.listSyncedEvents();
  console.log(`  Found ${syncedEvents.length} synced events in Google Calendar.`);

  // 6. 差分計算
  const engine = new SyncEngine(gcal);
  
const diff = engine.computeDiff(events, syncedEvents);

// Safety: stop if the source calendar is unexpectedly small.
if (
  syncedEvents.length >= 20 &&
  events.length < syncedEvents.length * 0.9
) {
  throw new Error(
    `Safety stop: source events dropped from ${syncedEvents.length} to ${events.length}`
  );
}

// Safety: never delete more than 5 events in one run.
if (diff.toDelete.length > 5) {
  throw new Error(
    `Safety stop: ${diff.toDelete.length} deletions requested (maximum 5)`
  );
}

console.log(`Deletion candidates: ${diff.toDelete.length}`);


for (const item of diff.toDelete) {
  const matched = syncedEvents.find(
    (event) => event.timetreeUid === item.timetreeUid
  );

  console.log(
    `Deletion candidate: ${matched?.summary ?? "(no title)"} | UID: ${item.timetreeUid}`
  );
}





console.log(
  `\nDiff: ${diff.toCreate.length} to create, ${diff.toUpdate.length} to update, ${diff.toDelete.length} to delete`
);


  // 7. 差分適用
  if (
    diff.toCreate.length === 0 &&
    diff.toUpdate.length === 0 &&
    diff.toDelete.length === 0
  ) {
    console.log("\nNo changes to sync.");
    return;
  }

  console.log("\nApplying changes...");
  const result = await engine.applyDiff(diff);

  console.log(
    `\nSync complete: created=${result.created}, updated=${result.updated}, deleted=${result.deleted}, errors=${result.errors}`
  );

  if (result.errors > 0) {
    process.exitCode = 1;
  }
}

function exportFromTimeTree(config: {
  timetreeEmail: string;
  timetreePassword: string;
  timetreeCalendarCode: string;
  icsFilePath: string;
}): void {
 const args = [
  "-e", config.timetreeEmail,
  "-c", config.timetreeCalendarCode,
  "-o", config.icsFilePath,
];

execFileSync("timetree-exporter", args, {
  env: {
    ...process.env,
    TIMETREE_PASSWORD: config.timetreePassword,
  },
  stdio: "inherit",
});
}

main().catch((err) => {
  console.error("::error::Sync failed:", err);
  process.exitCode = 1;
});
