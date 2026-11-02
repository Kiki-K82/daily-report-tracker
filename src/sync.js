// Cloud sync: sends changes made on this device to Supabase
import { db } from "./db";
import { supabase } from "./supabase";

// --- Convert app format (camelCase) to cloud format (snake_case) ---
const projectToCloud = (p, userId) => ({
  user_id: userId,
  id: p.id,
  name: p.name,
  code: p.code || null,
  location: p.location || null,
  created_at: new Date(p.createdAt || 0).toISOString(),
  updated_at: new Date(p.updatedAt || Date.now()).toISOString(),
});

const reportToCloud = (r, userId) => ({
  user_id: userId,
  id: r.id,
  project_id: r.projectId,
  title: r.title,
  date: r.date,
  weather: r.weather || null,
  bullets: r.bullets || "",
  prep_by: r.prepBy || null,
  photos: r.photos || [],
  updated_at: new Date(r.updatedAt || Date.now()).toISOString(),
});

// Mark a record as synced, but only if it wasn't edited again during the sync
async function markClean(table, record) {
  await db[table]
    .where("id").equals(record.id)
    .and((x) => x.updatedAt === record.updatedAt)
    .modify({ dirty: 0 });
}

// --- Send all local changes to the cloud ---
export async function pushChanges(userId) {
  const dirtyReports = await db.reports.where("dirty").equals(1).toArray();

  // 1. Projects first (the cloud needs a report's project to exist before the report)
  const neededProjectIds = new Set(dirtyReports.map((r) => r.projectId));
  const allProjects = await db.projects.toArray();
  const projectsToPush = allProjects.filter((p) => p.dirty === 1 || neededProjectIds.has(p.id));

  if (projectsToPush.length > 0) {
    const { error } = await supabase.from("projects").upsert(projectsToPush.map((p) => projectToCloud(p, userId)));
    if (error) throw error;
    for (const p of projectsToPush) await markClean("projects", p);
  }

  // 2. Reports, one at a time (photos can make them large)
  for (const r of dirtyReports) {
    const { error } = await supabase.from("reports").upsert(reportToCloud(r, userId));
    if (error) throw error;
    await markClean("reports", r);
  }

  // 3. Profile
  const profile = await db.profile.get("me");
  if (profile?.dirty === 1) {
    const { error } = await supabase.from("profiles").upsert({
      user_id: userId,
      name: profile.name,
      company: profile.company,
      role: profile.role,
      updated_at: new Date(profile.updatedAt || Date.now()).toISOString(),
    });
    if (error) throw error;
    await db.profile.where("id").equals("me").and((x) => x.updatedAt === profile.updatedAt).modify({ dirty: 0 });
  }

  // 4. Deletions made on this device
  const deletions = await db.deletions.toArray();
  for (const d of deletions) {
    const { error } = await supabase.from(d.table).delete().eq("user_id", userId).eq("id", d.id);
    if (error) throw error;
    await db.deletions.delete(d.key);
  }
}
// --- Convert cloud format back to app format ---
const projectFromCloud = (p) => ({
  id: p.id,
  name: p.name,
  code: p.code || "",
  location: p.location || "",
  createdAt: Date.parse(p.created_at),
  updatedAt: Date.parse(p.updated_at),
  dirty: 0,
});

const reportFromCloud = (r) => ({
  id: r.id,
  projectId: r.project_id,
  title: r.title,
  date: r.date,
  weather: r.weather || "",
  bullets: r.bullets || "",
  prepBy: r.prep_by || "",
  photos: r.photos || [],
  updatedAt: Date.parse(r.updated_at),
  dirty: 0,
});

// --- Receive changes from the cloud (made on other devices) ---
export async function pullChanges() {
  // 1. Profile
  const { data: cloudProfile, error: profileError } = await supabase.from("profiles").select("*").maybeSingle();
  if (profileError) throw profileError;
  const localProfile = await db.profile.get("me");
  if (cloudProfile && localProfile?.dirty !== 1 &&
      (localProfile?.updatedAt || 0) < Date.parse(cloudProfile.updated_at)) {
    await db.profile.put({
      id: "me",
      name: cloudProfile.name,
      company: cloudProfile.company,
      role: cloudProfile.role,
      updatedAt: Date.parse(cloudProfile.updated_at),
      dirty: 0,
    });
  }

  // 2. Projects
  const { data: cloudProjects, error: projectsError } = await supabase.from("projects").select("*");
  if (projectsError) throw projectsError;
  if (cloudProjects.length === 0) return; // brand-new account: nothing in the cloud yet

  for (const cp of cloudProjects) {
    const local = await db.projects.get(cp.id);
    if (local?.dirty === 1) continue; // local edit wins until it's sent
    if (!local || (local.updatedAt || 0) < Date.parse(cp.updated_at)) {
      await db.projects.put(projectFromCloud(cp));
    }
  }

  // 3. Reports: first get just IDs and dates (small), then download only what's new
  const { data: cloudList, error: listError } = await supabase.from("reports").select("id, updated_at");
  if (listError) throw listError;

  for (const cr of cloudList) {
    const local = await db.reports.get(cr.id);
    if (local?.dirty === 1) continue;
    if (!local || (local.updatedAt || 0) < Date.parse(cr.updated_at)) {
      const { data, error } = await supabase.from("reports").select("*").eq("id", cr.id).single();
      if (error) throw error;
      await db.reports.put(reportFromCloud(data));
    }
  }

  // 4. Remove things that were deleted on another device
  const cloudProjectIds = new Set(cloudProjects.map((p) => p.id));
  const cloudReportIds = new Set(cloudList.map((r) => r.id));
  await db.reports.filter((r) => r.dirty !== 1 && !cloudReportIds.has(r.id)).delete();
  await db.projects.filter((p) => p.dirty !== 1 && !cloudProjectIds.has(p.id)).delete();
}

// --- Full sync: send first, then receive ---
export async function syncAll(userId) {
  await pushChanges(userId);
  await pullChanges();
}