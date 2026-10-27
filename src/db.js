import Dexie from "dexie";

export const db = new Dexie("DailyReportTrackerDB");

db.version(1).stores({
  reports: "id, projectId, date",
  profile: "id",
});