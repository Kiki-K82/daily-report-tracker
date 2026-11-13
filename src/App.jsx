import React, { useState, useEffect } from "react";
import { db } from "./db";
import { supabase, openedFromResetLink } from "./supabase";
import AuthScreen, { SetNewPasswordScreen } from "./AuthScreen";
import { syncAll } from "./sync";
import { processQueuedNotes, setOpenReport } from "./voiceQueue";
import {
  Mic,
  Plus,
  Trash2,
  Pencil,
  User,
  Calendar,
  Check,
  X,
  ChevronRight,
  ArrowLeft,
  Camera,
  Download,
  AlertCircle,
  Filter,
  Building2,
  Folder,
  Search,
  LogOut,
  RefreshCw
} from "lucide-react";

// New accounts start empty: the super fills in their own profile and projects
const DEFAULT_PROFILE = { name: "", company: "", role: "" };

// IDs of the old sample data, used once to clean it off devices
const SAMPLE_PROJECT_IDS = ["proj-1", "proj-2", "proj-3"];
const SAMPLE_REPORT_IDS = ["rep-101", "rep-102", "rep-103"];

export default function App() {
  const todayFormatted = toDisplay(todayISO());

  const reportRef = React.useRef(null);

  // --- Export: build the PDF in the app, then share (phones) or download (laptops) ---
  const handleExportPDF = async () => {
    if (!selectedReport) return;
    setIsExporting(true);
    try {
      const { buildReportPdf } = await import("./pdf"); // load the PDF tool only when needed
      const blob = await buildReportPdf({ report: selectedReport, project: activeProject, profile });

      const safe = (s) => String(s || "").replace(/[\\/:*?"<>|]/g, "").trim();
      const fileName = `Daily Report - ${safe(activeProject?.name)} - ${safe(selectedReport.date)}.pdf`;
      const file = new File([blob], fileName, { type: "application/pdf" });

      // Phones and tablets: open the Share menu (email, text, save to Files)
      const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
      if (isTouchDevice && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: fileName });
          return;
        } catch (err) {
          if (err.name === "AbortError") return; // the user closed the Share menu
          if (err.name === "NotAllowedError") {
            // Building took too long for the phone to allow sharing right away: ask for one more tap
            setPdfToShare(file);
            showToast("Your PDF is ready. Tap Share PDF to send it.");
            return;
          }
        }
      }

      // Laptops (or if sharing isn't available): download the file
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast("PDF downloaded.");
    } catch (err) {
      console.error("PDF export failed:", err);
      showToast("Could not create the PDF. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  // Second tap: share the PDF that's already built
  const handleSharePdf = async () => {
    try {
      await navigator.share({ files: [pdfToShare], title: pdfToShare.name });
    } catch (err) {
      if (err.name !== "AbortError") showToast("Could not open the Share menu.");
    } finally {
      setPdfToShare(null);
    }
  };

  // --- State with LocalStorage Persistence ---
  const [activeTab, setActiveTab] = useState(null);
  const [activeView, setActiveView] = useState("dashboard");
  const [selectedReport, setSelectedReport] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [isExporting, setIsExporting] = useState(false); // true while the PDF is being built
  const [pdfToShare, setPdfToShare] = useState(null);    // a finished PDF waiting for a second tap

  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [reports, setReports] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false); // profile dropdown open/closed
  const [tempProfile, setTempProfile] = useState({ ...profile });
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [tempProject, setTempProject] = useState({ id: null, name: "", code: "", location: "", startDate: "", endDate: "" });

  // Load data from IndexedDB once when the app opens
  useEffect(() => {
    async function loadData() {
      try {
        // Ask the browser not to auto-delete our data when space runs low
        if (navigator.storage?.persist) await navigator.storage.persist();

        // One-time move of old localStorage data into IndexedDB
        const oldReports = localStorage.getItem("apex_daily_reports");
        const oldProfile = localStorage.getItem("apex_user_profile");
        if (oldReports) await db.reports.bulkPut(JSON.parse(oldReports));
        if (oldProfile) await db.profile.put({ id: "me", ...JSON.parse(oldProfile) });
        localStorage.removeItem("apex_daily_reports");
        localStorage.removeItem("apex_user_profile");

        // One-time cleanup: remove old sample data that was never edited or synced
        await db.reports.where("id").anyOf(SAMPLE_REPORT_IDS).and((r) => r.updatedAt === undefined).delete();
        for (const pid of SAMPLE_PROJECT_IDS) {
          const p = await db.projects.get(pid);
          const inUse = await db.reports.where("projectId").equals(pid).count();
          if (p && p.updatedAt === undefined && inUse === 0) await db.projects.delete(pid);
        }
        const savedProfile = await db.profile.get("me");
        if (savedProfile) {
          const { id, ...rest } = savedProfile;
          setProfile(rest);
          setReports(await db.reports.reverse().toArray());
        } else {
          // Very first run: start with an empty profile
          await db.profile.put({ id: "me", ...DEFAULT_PROFILE });
        }
        // Load projects (first time: save the 3 default projects)
        const savedProjects = await db.projects.toArray();
        if (savedProjects.length > 0) {
          // Newest Project First-Keep projects in the order they were created
          savedProjects.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          setProjects(savedProjects);
          setActiveTab(savedProjects[0].id);
        }
      } catch (err) {
        console.error("Failed to load data:", err);
      } finally {
        setIsLoaded(true);
      }
    }
    loadData();
  }, []);

  // Projects State (saved in IndexedDB)
  const [projects, setProjects] = useState([]);
  // --- Login session (who is signed in) ---
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isRecovery, setIsRecovery] = useState(openedFromResetLink);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncingRef = React.useRef(false); // true while a sync is running
  const syncRef = React.useRef(null);     // always points to the latest handleSync
  const syncTimerRef = React.useRef(null); // timer for "sync soon after a change"

  useEffect(() => {
    // Check if someone is already signed in on this device
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthChecked(true);
    });

    // Update automatically when someone signs in or out
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === "PASSWORD_RECOVERY") setIsRecovery(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Toast Helper
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  };

  // Handlers
  const handleOpenReportForm = (report = null) => {
    setSelectedReport(report);
    setActiveView("report_form");
  };

  const handleOpenViewReport = (report) => {
    setSelectedReport(report);
    setActiveView("view_report");
  };

  const handleDeleteReport = async (id, title) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;
    try {
      await db.transaction("rw", db.reports, db.deletions, async () => {
        await db.reports.delete(id);
        await db.deletions.add({ table: "reports", id });
      });
      setReports((prev) => prev.filter((r) => r.id !== id));
      showToast("Report deleted successfully.");
      scheduleSync();
      if (selectedReport?.id === id) {
        setSelectedReport(null);
        setActiveView("dashboard");
      }
    } catch (err) {
      console.error(err);
      showToast("Could not delete report. Please try again.");
    }
  };

  const handleSaveReport = async (reportData) => {
    try {
      await db.reports.put({ ...reportData, updatedAt: Date.now(), dirty: 1 });
      setReports((prevReports) => {
        const exists = prevReports.some((r) => r.id === reportData.id);
        return exists
          ? prevReports.map((r) => (r.id === reportData.id ? reportData : r))
          : [reportData, ...prevReports];
      });
      showToast(selectedReport ? "Report updated successfully!" : "New report created successfully!");
      scheduleSync();
      setSelectedReport(reportData);
      setActiveView("view_report");
    } catch (err) {
      console.error(err);
      showToast("Save failed: storage may be full. Report not saved.");
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      await db.profile.put({ id: "me", ...tempProfile, updatedAt: Date.now(), dirty: 1 });
      setProfile({ ...tempProfile });
      setIsEditProfileOpen(false);
      showToast("Profile updated successfully!");
      scheduleSync();
    } catch (err) {
      console.error(err);
      showToast("Could not save profile.");
    }
  };

  const handleOpenEditProfile = () => {
    setTempProfile({ ...profile });
    setIsEditProfileOpen(true);
  };
  // --- Project handlers ---
  const handleOpenAddProject = () => {
    setTempProject({ id: null, name: "", code: "", location: "", startDate: "", endDate: "" });
    setIsProjectModalOpen(true);
  };

  const handleOpenEditProject = () => {
    setTempProject({ ...activeProject });
    setIsProjectModalOpen(true);
  };

  const handleSaveProject = async (e) => {
    e.preventDefault();
    const isNew = !tempProject.id;
    const projectData = isNew
      ? { ...tempProject, id: `proj-${Date.now()}`, createdAt: Date.now() }
      : { ...tempProject };
    try {
      await db.projects.put({ ...projectData, updatedAt: Date.now(), dirty: 1 });
      setProjects((prev) =>
        isNew ? [projectData, ...prev] : prev.map((p) => (p.id === projectData.id ? projectData : p))
      );
      setActiveTab(projectData.id);
      setIsProjectModalOpen(false);
      showToast(isNew ? "Project added successfully!" : "Project updated successfully!");
      scheduleSync();
    } catch (err) {
      console.error(err);
      showToast("Could not save project.");
    }
  };

  const handleDeleteProject = async () => {

    const count = reports.filter((r) => r.projectId === tempProject.id).length;
    const message = `Delete "${tempProject.name}" and its ${count} report(s)? This cannot be undone.`;
    if (!window.confirm(message)) return;

    try {
      // Delete the project and its reports together
      await db.transaction("rw", db.projects, db.reports, db.deletions, async () => {
        await db.reports.where("projectId").equals(tempProject.id).delete();
        await db.projects.delete(tempProject.id);
        await db.deletions.add({ table: "projects", id: tempProject.id });
      });

      const remaining = projects.filter((p) => p.id !== tempProject.id);
      setProjects(remaining);
      setReports((prev) => prev.filter((r) => r.projectId !== tempProject.id));
      setActiveTab(remaining[0]?.id ?? null); // open the newest remaining project, if any
      setIsProjectModalOpen(false);
      showToast("Project deleted.");
      scheduleSync();
    } catch (err) {
      console.error(err);
      showToast("Could not delete project. Please try again.");
    }
  };

  // --- Sign out (sync first, then clear this device) ---
  const countUnsent = async () => {
    const profile = await db.profile.get("me");
    return (
      (await db.reports.where("dirty").equals(1).count()) +
      (await db.projects.where("dirty").equals(1).count()) +
      (await db.deletions.count()) +
      (profile?.dirty === 1 ? 1 : 0)
    );
  };

  const handleSignOut = async () => {
    if (!window.confirm("Sign out of Daily Report Tracker?")) return;

    // 1. Try to send any unsent changes first
    if ((await countUnsent()) > 0 && navigator.onLine) {
      try {
        await syncAll(session.user.id);
      } catch (err) {
        console.error("Sync before sign-out failed:", err);
      }
    }

    // 2. If anything still couldn't be sent, warn before it's lost
    const stillUnsent = await countUnsent();
    if (
      stillUnsent > 0 &&
      !window.confirm(
        `${stillUnsent} change(s) haven't reached the cloud yet (no connection).\n\n` +
        `If you sign out now, they will be LOST. Sign out anyway?`
      )
    ) {
      return;
    }

    // 3. Clear this device's data so the next person can't see it
    clearTimeout(syncTimerRef.current);
    await db.transaction("rw", db.reports, db.projects, db.profile, db.deletions, async () => {
      await db.reports.clear();
      await db.projects.clear();
      await db.profile.clear();
      await db.deletions.clear();
    });

    // 4. Sign out and start fresh
    const { error } = await supabase.auth.signOut();
    if (error) {
      showToast("Could not sign out. Please try again.");
      return;
    }
    window.location.reload();
  };

  // Reload what's on screen from the local database (after a sync)
  const reloadFromDb = async () => {
    const savedProfile = await db.profile.get("me");
    if (savedProfile) {
      const { id, dirty, updatedAt, ...rest } = savedProfile;
      setProfile(rest);
    }
    const savedProjects = await db.projects.toArray();
    savedProjects.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (savedProjects.length > 0) {
      setProjects(savedProjects);
      // Stay on the current project if it still exists, otherwise open the newest
      setActiveTab((current) =>
        savedProjects.some((p) => p.id === current) ? current : savedProjects[0].id
      );
    }
    const freshReports = await db.reports.reverse().toArray();
    setReports(freshReports);
    // If a report is open on screen, show its latest version (e.g. newly added voice notes)
    setSelectedReport((prev) => (prev ? freshReports.find((r) => r.id === prev.id) || prev : prev));
  };

  // --- Cloud sync ---
  const handleSync = async ({ silent = false } = {}) => {
    if (syncingRef.current || !session) return; // don't run two syncs at once
    if (!navigator.onLine) {
      if (!silent) showToast("No connection. Your changes are saved on this device and will sync later.");
      return;
    }
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      const notesAdded = await processQueuedNotes();
      await syncAll(session.user.id);
      if (notesAdded > 0) showToast(`${notesAdded} voice note${notesAdded > 1 ? "s" : ""} transcribed and added.`);
      await reloadFromDb();
      if (!silent) showToast("Synced to cloud.");
    } catch (err) {
      console.error("Sync failed:", err);
      if (!silent) showToast("Sync failed. Your changes are still saved on this device.");
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  };
  syncRef.current = handleSync;

  // Sync 3 seconds after a change (waits in case more changes follow quickly)
  const scheduleSync = () => {
    clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => syncRef.current?.({ silent: true }), 3000);
  };

  // --- Automatic sync: on open, when back online, and every 5 minutes ---
  useEffect(() => {
    if (!session || !isLoaded) return;

    syncRef.current({ silent: true }); // when the app opens or after signing in

    const onOnline = () => syncRef.current({ silent: true }); // when signal comes back
    window.addEventListener("online", onOnline);

    const timer = setInterval(() => syncRef.current({ silent: true }), 5 * 60 * 1000);

    return () => {
      window.removeEventListener("online", onOnline);
      clearInterval(timer);
    };
  }, [session?.user?.id, isLoaded]);

  const activeProject = projects.find((p) => p.id === activeTab) || projects[0];
  // Initials for the profile button (e.g. "Jason Johnson" → "JJ")
  const initials = profile.name
    ? profile.name.trim().split(/\s+/).map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "";
  const projectReports = reports
    .filter((r) => r.projectId === activeTab)
    .filter((r) =>
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.date.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.bullets.toLowerCase().includes(searchQuery.toLowerCase())
    );
  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Checking sign-in...
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }
  if (isRecovery) {
    return (
      <SetNewPasswordScreen
        onDone={() => {
          setIsRecovery(false);
          showToast("Password updated. You're signed in.");
        }}
      />
    );
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Loading reports...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans flex flex-col">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-teal-500">
          <Check className="w-5 h-5 text-teal-400 shrink-0" />
          <span className="text-base font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Main Top Header Navbar */}
<header className="bg-teal-900 text-white shadow-md border-b border-teal-800">
  <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
    <div className="flex items-center gap-3 min-w-0">
      <img src="/favicon.svg" alt="Daily Report Tracker logo" className="w-10 h-10 rounded-lg shrink-0" />
      <div className="min-w-0">
        <h1 className="font-bold text-lg tracking-wide leading-none truncate">Daily Report Tracker</h1>
        <p className="text-xs text-teal-300 font-light mt-0.5 truncate">Field Inspection & AI Dictation</p>
      </div>
    </div>

    <div className="flex items-center gap-2 shrink-0">
      {/* Sync button */}
      <button
        onClick={() => handleSync()}
        disabled={isSyncing}
        title="Sync now"
        aria-label="Sync now"
        className="w-11 h-11 rounded-xl bg-teal-800 hover:bg-teal-700 disabled:opacity-60 flex items-center justify-center transition"
      >
        <RefreshCw className={`w-5 h-5 ${isSyncing ? "animate-spin" : ""}`} />
      </button>

      {/* Profile button + dropdown menu */}
      <div className="relative">
        <button
          onClick={() => setIsMenuOpen((open) => !open)}
          title="Profile"
          aria-label="Profile menu"
          className="w-11 h-11 rounded-full bg-teal-300 text-teal-950 font-bold flex items-center justify-center"
        >
          {initials || <User className="w-5 h-5" />}
        </button>

        {isMenuOpen && (
          <>
            {/* Tapping anywhere outside closes the menu */}
            <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
            <div className="absolute right-0 mt-2 w-60 bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="font-bold text-base truncate">{profile.name || "Welcome!"}</p>
                <p className="text-sm text-slate-500 truncate">{profile.company || "Add your name and company"}</p>
              </div>
              <button
                onClick={() => { setIsMenuOpen(false); handleOpenEditProfile(); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-base hover:bg-slate-50"
              >
                <Pencil className="w-4 h-4 text-slate-500" />
                {profile.name ? "Edit Profile" : "Set Up Profile"}
              </button>
              <button
                onClick={() => { setIsMenuOpen(false); handleSignOut(); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-base text-red-700 hover:bg-red-50 border-t border-slate-100"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  </div>
</header>

      {/* View Switcher: Dashboard View vs. Forms View */}
      {activeView === "dashboard" ? (
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 space-y-6">

          {/* Shown when there are no projects yet */}
          {projects.length === 0 && (
            <section className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 text-center space-y-4">
              <Folder className="w-12 h-12 text-teal-700 mx-auto" />
              <h2 className="text-2xl font-bold text-slate-900">Add your first project</h2>
              <p className="text-base text-slate-600 max-w-md mx-auto">
                Create a project for the job site you're working on. Then you can start writing daily reports for it.
              </p>
              <button
                onClick={handleOpenAddProject}
                className="inline-flex items-center gap-2 px-6 py-3 bg-teal-700 hover:bg-teal-800 text-white font-bold text-base rounded-xl transition shadow-md"
              >
                <Plus className="w-5 h-5" /> Add Project
              </button>
            </section>
          )}

          {/* Project Tabs Section */}
          {projects.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <Folder className="w-4 h-4 text-teal-700" /> Active Projects
                </h3>
                <button
                  onClick={handleOpenAddProject}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-teal-800 bg-white border border-slate-300 rounded-xl hover:bg-teal-50 transition"
                >
                  <Plus className="w-4 h-4" /> Add Project
                </button>
              </div>

              <div className="flex space-x-2 border-b border-slate-300 overflow-x-auto pb-1 scrollbar-none">
                {projects.map((proj) => {
                  const isActive = activeTab === proj.id;
                  const count = reports.filter(r => r.projectId === proj.id).length;
                  return (
                    <button
                      key={proj.id}
                      onClick={() => setActiveTab(proj.id)}
                      title={proj.name}
                      className={`max-w-[10rem] sm:max-w-[14rem] px-5 py-3 rounded-t-xl font-semibold text-sm transition flex items-center gap-2.5 whitespace-nowrap border-t border-x ${isActive
                        ? "bg-white text-teal-900 border-slate-300 border-b-white font-bold shadow-sm -mb-[1px]"
                        : "bg-slate-200/80 text-slate-600 hover:bg-slate-300/80 border-transparent"
                        }`}
                    >
                      <span className="truncate">{proj.name}</span>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs ${isActive ? "bg-teal-100 text-teal-800" : "bg-slate-300 text-slate-700"}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Active Project Dashboard Header & Report List */}
              <div className="bg-white rounded-b-2xl rounded-tr-2xl p-5 md:p-6 shadow-sm border border-slate-200 space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-bold text-slate-900">{activeProject.name}</h2>
                      <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md font-mono border border-slate-200">{activeProject.code}</span>
                      <button
                        onClick={handleOpenEditProject}
                        title="Edit Project"
                        className="p-2 text-slate-600 hover:text-teal-800 hover:bg-teal-100 rounded-lg transition"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <span>Location: {activeProject.location}</span>
                      <span>•</span>
                      <span>Total Logs: {projectReports.length}</span>
                    </p>
                  </div>

                  <button
                    onClick={() => handleOpenReportForm()}
                    className="w-full sm:w-auto px-5 py-3 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-bold text-sm rounded-xl transition shadow-md hover:shadow-lg flex items-center justify-center gap-2 group"
                  >
                    <Plus className="w-5 h-5 transition-transform group-hover:rotate-90" />
                    Add New Report
                  </button>
                </div>

                {/* Search & Filter Bar */}
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="relative w-full">
                    <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search reports by date or keyword..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery('')} className="absolute right-3 top-3 text-slate-400 hover:text-slate-600">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 whitespace-nowrap self-end sm:self-center">
                    <Filter className="w-3.5 h-3.5" />
                    <span>Showing {projectReports.length} entries</span>
                  </div>
                </div>

                {/* Reports List */}
                {projectReports.length > 0 ? (
                  <div className="space-y-3">
                    {projectReports.map((report) => (
                      <div
                        key={report.id}
                        className="group bg-slate-50 hover:bg-slate-100/90 border border-slate-200 hover:border-teal-300 rounded-xl px-3 py-2.5 sm:px-4 transition duration-150 flex items-center gap-1.5 shadow-2xs"
                      >
                        <button
                          onClick={() => handleOpenViewReport(report)}
                          className="flex-1 min-w-0 flex flex-col gap-1 text-left focus:outline-none"
                        >
                          <span className="font-bold text-slate-800 text-base leading-snug line-clamp-2 group-hover:text-teal-900 transition">
                            {report.title}
                          </span>
                          <span className="text-sm font-semibold text-teal-700">{report.date}</span>
                        </button>
                        <button
                          onClick={() => handleOpenReportForm(report)}
                          title="Edit Report"
                          className="shrink-0 p-2.5 text-slate-600 hover:text-teal-800 hover:bg-teal-100 rounded-lg transition"
                        >
                          <Pencil className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteReport(report.id, report.title)}
                          title="Delete Report"
                          className="shrink-0 p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300 space-y-3">
                    <AlertCircle className="w-10 h-10 text-slate-400 mx-auto" />
                    <p className="text-slate-600 font-medium">No reports found for this project.</p>
                    <p className="text-xs text-slate-400">Click below to record your first daily report.</p>
                    <button
                      onClick={() => handleOpenReportForm()}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-teal-700 text-white rounded-lg text-sm font-semibold hover:bg-teal-800 transition"
                    >
                      <Plus className="w-4 h-4" /> Create Daily Report
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}
        </main>
      ) : activeView === "report_form" ? (
        /* Report Form View Component */
        <ReportFormView
          selectedReport={selectedReport}
          activeProject={activeProject}
          profile={profile}
          showToast={showToast}
          onSave={handleSaveReport}
          onCancel={() => setActiveView("dashboard")}
        />
      ) : (
        /* Detailed Report PDF Preview View */
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              onClick={() => setActiveView("dashboard")}
              className="flex items-center gap-2 text-sm font-bold text-teal-800 hover:text-teal-900 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenReportForm(selectedReport)}
                className="flex items-center gap-2 text-sm font-bold text-teal-800 bg-white px-4 py-2 rounded-xl border border-slate-300 shadow-sm hover:bg-teal-50 transition"
              >
                <Pencil className="w-4 h-4" /> Edit Report
              </button>
              {pdfToShare ? (
                <button
                  onClick={handleSharePdf}
                  className="flex items-center gap-2 text-sm font-bold bg-teal-700 text-white px-4 py-2 rounded-xl shadow-md hover:bg-teal-800 transition"
                >
                  <Download className="w-4 h-4" /> Share PDF
                </button>
              ) : (
                <button
                  onClick={handleExportPDF}
                  disabled={isExporting}
                  className="flex items-center gap-2 text-sm font-bold bg-teal-700 text-white px-4 py-2 rounded-xl shadow-md hover:bg-teal-800 disabled:opacity-60 transition"
                >
                  <Download className="w-4 h-4" /> {isExporting ? "Creating PDF..." : "Export PDF Report"}
                </button>
              )}
            </div>
          </div>

          {/* Printable Report Container */}
          <div ref={reportRef} className="print-container bg-white rounded-2xl p-8 shadow-md border border-slate-200 space-y-6">
            <div className="border-b-2 border-teal-900 pb-4 flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">DAILY REPORT</h2>
                <p className="text-xs font-bold text-teal-800 mt-1 uppercase tracking-wider">{activeProject.name}</p>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-slate-800">{selectedReport?.date || todayFormatted}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-500 block font-semibold">Contractor:</span>
                <span className="font-bold text-slate-800">{profile.company}</span>
              </div>
              <div>
                <span className="text-slate-500 block font-semibold">Prepared By:</span>
                <span className="font-bold text-slate-800">{selectedReport?.prepBy || profile.name}</span>
              </div>
              <div>
                <span className="text-slate-500 block font-semibold">Weather:</span>
                <span className="font-bold text-slate-800">{selectedReport?.weather || "Clear"}</span>
              </div>
              <div>
                <span className="text-slate-500 block font-semibold">Project Code:</span>
                <span className="font-bold text-slate-800">{activeProject.code}</span>
              </div>
              {activeProject.startDate && (
                <div>
                  <span className="text-slate-500 block font-semibold">Start Date:</span>
                  <span className="font-bold text-slate-800">{toDisplay(activeProject.startDate)}</span>
                </div>
              )}
              {activeProject.endDate && (
                <div>
                  <span className="text-slate-500 block font-semibold">End Date:</span>
                  <span className="font-bold text-slate-800">{toDisplay(activeProject.endDate)}</span>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-2 border-b border-slate-200 pb-1">Field Notes</h3>
              <p className="text-base text-slate-800 leading-relaxed whitespace-pre-line bg-slate-50 p-4 rounded-xl border border-slate-200">
                {selectedReport?.bullets}
              </p>
            </div>

            {/* Attached Photos in PDF Preview */}
            {selectedReport?.photos && selectedReport.photos.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-3 border-b border-slate-200 pb-1">Photo Documentation</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {selectedReport.photos.map((photo) => (
                    <div key={photo.id} className="bg-slate-50 rounded-xl p-2 border border-slate-200 space-y-1.5">
                      <div className="h-56 bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center">
                        <img src={photo.url} alt={photo.caption} className="max-w-full max-h-full object-contain" />
                      </div>
                      <p className="text-xs font-semibold text-slate-800 text-center truncate">{photo.caption}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      )}

      {/* Profile Edit Modal */}
      {isEditProfileOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-lg text-slate-900">Edit Profile Info</h3>
              <button onClick={() => setIsEditProfileOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={tempProfile.name}
                  onChange={(e) => setTempProfile({ ...tempProfile, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-medium focus:ring-2 focus:ring-teal-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Company Name</label>
                <input
                  type="text"
                  required
                  value={tempProfile.company}
                  onChange={(e) => setTempProfile({ ...tempProfile, company: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-medium focus:ring-2 focus:ring-teal-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Role / Position</label>
                <input
                  type="text"
                  value={tempProfile.role}
                  onChange={(e) => setTempProfile({ ...tempProfile, role: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-medium focus:ring-2 focus:ring-teal-600 focus:bg-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditProfileOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-700 text-white rounded-xl text-xs font-bold hover:bg-teal-800 transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Project Add/Edit Modal */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-lg text-slate-900">
                {tempProject.id ? "Edit Project" : "Add New Project"}
              </h3>
              <button onClick={() => setIsProjectModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProject} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  value={tempProject.name}
                  onChange={(e) => setTempProject({ ...tempProject, name: e.target.value })}
                  placeholder="e.g. Marriott Downtown Refurbishment"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-base font-medium focus:ring-2 focus:ring-teal-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Project Code</label>
                <input
                  type="text"
                  value={tempProject.code}
                  onChange={(e) => setTempProject({ ...tempProject, code: e.target.value })}
                  placeholder="e.g. MD-2026"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-base font-medium focus:ring-2 focus:ring-teal-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Location</label>
                <input
                  type="text"
                  value={tempProject.location}
                  onChange={(e) => setTempProject({ ...tempProject, location: e.target.value })}
                  placeholder="e.g. Orlando, FL"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-base font-medium focus:ring-2 focus:ring-teal-600 focus:bg-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={tempProject.startDate || ""}
                    onChange={(e) => setTempProject({ ...tempProject, startDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-base font-medium focus:ring-2 focus:ring-teal-600 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={tempProject.endDate || ""}
                    min={tempProject.startDate || undefined}
                    onChange={(e) => setTempProject({ ...tempProject, endDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-base font-medium focus:ring-2 focus:ring-teal-600 focus:bg-white"
                  />
                </div>
              </div>
              <p className="text-sm text-slate-500 -mt-2">
                Optional. For projects done in sequences, you can enter the current sequence's dates.
              </p>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                {tempProject.id && (
                  <button
                    type="button"
                    onClick={handleDeleteProject}
                    className="mr-auto flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsProjectModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-teal-700 text-white rounded-xl text-sm font-bold hover:bg-teal-800 transition"
                >
                  {tempProject.id ? "Save Changes" : "Add Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer Bar */}
      <footer className="bg-slate-900 text-slate-400 text-xs py-4 px-4 text-center border-t border-slate-800 mt-auto">
        <p>© 2026 Daily Report Tracker • Built for Mobile & Hands-Free Construction Documentation</p>
      </footer>
    </div>
  );
}

// --- SUB-COMPONENT FOR CREATING & EDITING REPORTS WITH PHOTOS & VOICE ---
function ReportFormView({ selectedReport, activeProject, profile, showToast, onSave, onCancel }) {
  // The report's ID is set when the form opens, so offline voice notes can be linked to it
  const [reportId] = useState(() => selectedReport?.id || `rep-${Date.now()}`);
  // While this form is open, its waiting voice notes are held until the report is saved
  useEffect(() => {
    setOpenReport(reportId);
    return () => setOpenReport(null);
  }, [reportId]);
  const [title, setTitle] = useState(selectedReport?.title || "Daily Site Log");
  const [date, setDate] = useState(selectedReport ? toISO(selectedReport.date) : todayISO());
  const [weather, setWeather] = useState(selectedReport?.weather || "");

  // New reports only: fetch current local weather (free Open-Meteo service, no API key)
  useEffect(() => {
    if (selectedReport || !navigator.geolocation || !navigator.onLine) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`
          );
          const data = await res.json();
          const temp = Math.round(data.current.temperature_2m);
          const desc = describeWeather(data.current.weather_code);
          // Only fill it in if the user hasn't already typed something
          setWeather((prev) => prev || `${temp}°F, ${desc}`);
        } catch (err) {
          console.error("Weather lookup failed:", err);
        }
      },
      () => { }, // location denied: the user can type the weather manually
      { timeout: 10000 }
    );
  }, [selectedReport]);
  const [bullets, setBullets] = useState(selectedReport?.bullets || "");

  // Photos State
  const [photos, setPhotos] = useState(selectedReport?.photos || []);
  const fileInputRef = React.useRef(null);

  // Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = React.useRef(null); // the active recorder
  const chunksRef = React.useRef([]);          // pieces of audio while recording
  // Voice notes saved on this device, waiting for signal
  const [pendingNotes, setPendingNotes] = useState(0);
  const refreshPendingNotes = async () => {
    setPendingNotes(await db.voiceNotes.where("reportId").equals(reportId).count());
  };
  useEffect(() => {
    refreshPendingNotes();
  }, []);

  const queueVoiceNote = async (blob) => {
    await db.voiceNotes.add({ reportId, createdAt: Date.now(), blob });
    await refreshPendingNotes();
    showToast("No signal. Voice note saved, and it will be transcribed when you're back online.");
  };

  // Handle Image Upload: shrink each photo before saving
  const handleImageUpload = async (e) => {
    const input = e.target;
    const files = Array.from(input.files);
    if (!files.length) return;

    for (const file of files) {
      try {
        const url = await compressImage(file);
        const newPhoto = {
          id: `photo-${Date.now()}-${Math.random()}`,
          url,
          caption: file.name.replace(/\.[^/.]+$/, ""), // Default caption to filename
        };
        setPhotos((prev) => [...prev, newPhoto]);
      } catch (err) {
        console.error(err);
        showToast(`Could not add photo: ${file.name}`);
      }
    }

    input.value = ""; // lets the same photo be picked again if needed
  };

  const handleCaptionChange = (id, newCaption) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, caption: newCaption } : p))
    );
  };

  const handleRemovePhoto = (id) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  // Send a recording to the "transcribe" function and add the text as a bullet
  const transcribeAudio = async (blob) => {
    // No signal: keep the recording on the phone for later
    if (!navigator.onLine) {
      await queueVoiceNote(blob);
      return;
    }
    setIsTranscribing(true);
    try {
      const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm";
      const form = new FormData();
      form.append("audio", blob, `note.${ext}`);
      const { data, error } = await supabase.functions.invoke("transcribe", { body: form });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      // Use the cleaned-up bullets (fall back to the plain transcript)
      const newBullets = data?.bullets?.length ? data.bullets : data?.text ? [data.text.trim()] : [];
      if (newBullets.length > 0) {
        const added = newBullets.map((b) => `• ${b}`).join("\n");
        setBullets((prev) => (prev ? `${prev}\n${added}` : added));
      } else {
        showToast("No speech was detected. Please try again.");
      }
    } catch (err) {
      console.error("Transcription failed:", err);
      if (err.name === "FunctionsFetchError") {
        // Signal dropped or too weak to reach the server: save it for later instead of losing it
        await queueVoiceNote(blob);
      } else {
        showToast("Transcription failed. Please try again.");
      }
    } finally {
      setIsTranscribing(false);
    }
  };

  // Start or stop recording
  const handleToggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop(); // finishing the recording triggers onstop below
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      showToast("Recording isn't supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop()); // turn the microphone off
        setIsRecording(false);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        transcribeAudio(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      console.error(err);
      showToast("Microphone access was blocked. Allow the microphone and try again.");
    }
  };

  // Stop recording without transcribing (when leaving the form)
  const cancelRecording = () => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.onstop = () => rec.stream.getTracks().forEach((t) => t.stop());
      rec.stop();
    }
  };

  // Pressing Enter in the notes box starts a new bullet automatically
  const handleBulletsKeyDown = (e) => {
    if (e.key !== "Enter" || e.shiftKey) return; // Shift+Enter = plain new line
    e.preventDefault();
    const el = e.target;
    const { selectionStart: start, selectionEnd: end, value } = el;
    const insert = value.trim() === "" ? "• " : "\n• ";
    setBullets(value.slice(0, start) + insert + value.slice(end));
    // Put the cursor right after the new bullet
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + insert.length;
    });
  };

  // Tapping into an empty notes box starts the first bullet
  const handleBulletsFocus = () => {
    if (bullets.trim() === "") setBullets("• ");
  };

  // Warn before leaving a new, unsaved report that has voice notes waiting
  const confirmLeave = () =>
    pendingNotes === 0 ||
    selectedReport || // an existing report keeps its notes even if you leave
    window.confirm(
      `You have ${pendingNotes} voice note${pendingNotes > 1 ? "s" : ""} waiting for signal.\n\n` +
      `If you leave without saving, ${pendingNotes > 1 ? "they" : "it"} will be lost. Leave anyway?`
    );

  const handleSubmit = (e) => {
    e.preventDefault();
    cancelRecording();
    onSave({
      id: reportId,
      projectId: selectedReport?.projectId || activeProject.id,
      title,
      date: toDisplay(date),
      weather,
      bullets,
      photos,
      prepBy: selectedReport?.prepBy || profile.name
    });
  };

  return (
    <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            if (!confirmLeave()) return;
            cancelRecording();
            onCancel();
          }}
          className="flex items-center gap-2 text-sm font-bold text-teal-800 hover:text-teal-900 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
        <span className="text-xs font-semibold bg-amber-100 text-amber-800 px-3 py-1 rounded-full">
          {selectedReport ? "Editing Existing Report" : "New Report Creator"}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h2 className="text-2xl font-bold text-slate-900">
            {selectedReport ? `Edit Report: ${selectedReport.title}` : "New Daily Inspection Report"}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Project: {activeProject.name} ({activeProject.code})</p>
        </div>

        {/* Report Title */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Report Title</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-medium focus:ring-2 focus:ring-teal-600 focus:bg-white"
          />
        </div>

        {/* Header Form Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Contractor</label>
            <input type="text" readOnly value={profile.company} className="w-full bg-slate-100 border border-slate-200 rounded-lg p-3 text-base font-medium text-slate-800 cursor-not-allowed" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Report Preparer</label>
            <input type="text" readOnly value={selectedReport?.prepBy || profile.name} className="w-full bg-slate-100 border border-slate-200 rounded-lg p-3 text-base font-medium text-slate-800 cursor-not-allowed" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Date</label>
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg p-3 text-base font-medium text-slate-800 focus:ring-2 focus:ring-teal-600" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Weather Condition</label>
            <input type="text" required placeholder="e.g. 72°F, Sunny" value={weather} onChange={(e) => setWeather(e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg p-3 text-base font-medium text-slate-800 focus:ring-2 focus:ring-teal-600" />
          </div>
        </div>

        {/* Interactive Voice Recording Interface */}
        <div className={`rounded-2xl p-6 text-center space-y-4 shadow-md transition-all duration-300 ${isRecording ? "bg-red-950 text-white border-2 border-red-500 shadow-red-900/50" : "bg-slate-900 text-white"}`}>
          <div className={`inline-flex p-3 rounded-full ${isRecording ? "bg-red-800 text-red-200 animate-pulse" : "bg-teal-800 text-teal-300"}`}>
            <Mic className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-bold text-lg">{isRecording ? "Listening to Field Notes..." : "Hands-Free Voice AI Assistant"}</h3>
            <p className="text-base text-slate-100 max-w-md mx-auto mt-1">
              {isRecording ? "Speak naturally into your microphone. Text will append below automatically." : "Tap record and speak site notes naturally to generate bullet points."}
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={handleToggleRecording}
              disabled={isTranscribing}
              className={`w-24 h-24 rounded-full active:scale-95 transition-all text-white font-bold shadow-lg inline-flex flex-col items-center justify-center gap-1 border-4 ${isRecording ? "bg-red-600 hover:bg-red-500 border-red-300 animate-bounce shadow-red-900/80" : "bg-teal-600 hover:bg-teal-500 border-teal-400/30 shadow-teal-900/50"}`}
            >
              <Mic className="w-8 h-8" />
              <span className="text-[10px] tracking-wider uppercase">
                {isRecording ? "Stop" : isTranscribing ? "Working..." : "Record"}
              </span>
            </button>
          </div>
        </div>

        {/* AI Generated Bulletin Report Area */}
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-800">AI Bulletin Report Summary</label>
          {pendingNotes > 0 && (
            <div className="text-base rounded-xl p-3 border bg-amber-50 border-amber-200 text-amber-900">
              {pendingNotes} voice note{pendingNotes > 1 ? "s" : ""} waiting for signal. The text will appear once you're back online. Tap Save Report now so it isn't lost.
            </div>
          )}
          <textarea
            rows={6}
            value={bullets}
            onChange={(e) => setBullets(e.target.value)}
            onKeyDown={handleBulletsKeyDown}
            onFocus={handleBulletsFocus}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-base text-slate-800 focus:ring-2 focus:ring-teal-600 focus:bg-white"
            placeholder="AI-generated transcript summary will populate here..."
          />
          <p className="text-sm text-slate-600">
            <span className="font-bold text-amber-700">*</span> No signal? Your recording is saved on your phone,
            but the text will not appear here until you are back online. Please tap <strong>Save Report</strong> so
            it is added to this report automatically.
          </p>
        </div>

        {/* Photo Attachment Section */}
        <div className="space-y-3">
          <label className="block text-sm font-bold text-slate-800">
            Photo Documentation with Labels ({photos.length})
          </label>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            multiple
            accept="image/*"
            className="hidden"
          />

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* Add Photo Button */}
            <div
              onClick={() => fileInputRef.current.click()}
              className="border-2 border-dashed border-slate-300 hover:border-teal-600 rounded-xl p-4 text-center cursor-pointer transition flex flex-col items-center justify-center bg-slate-50 min-h-[140px] group"
            >
              <Camera className="w-8 h-8 text-slate-400 group-hover:text-teal-700 mb-1 transition" />
              <span className="text-xs font-semibold text-slate-600 group-hover:text-teal-900">+ Add Site Photo</span>
            </div>

            {/* Uploaded Photos Preview List */}
            {photos.map((photo) => (
              <div key={photo.id} className="bg-slate-50 rounded-xl p-2.5 border border-slate-200 space-y-2 relative group">
                <button
                  type="button"
                  onClick={() => handleRemovePhoto(photo.id)}
                  title="Remove Photo"
                  className="absolute top-3 right-3 bg-slate-900/70 hover:bg-red-600 text-white p-1 rounded-full text-xs transition z-10"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <div className="h-24 bg-slate-200 rounded-lg overflow-hidden border border-slate-300">
                  <img src={photo.url} alt={photo.caption} className="w-full h-full object-cover" />
                </div>
                <input
                  type="text"
                  value={photo.caption}
                  onChange={(e) => handleCaptionChange(photo.id, e.target.value)}
                  placeholder="Enter photo caption..."
                  className="w-full text-xs p-1.5 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-1 focus:ring-teal-600"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button type="button" onClick={() => { if (!confirmLeave()) return; cancelRecording(); onCancel(); }} className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200 transition">
            Cancel
          </button>
          <button type="submit" className="px-6 py-2.5 bg-teal-700 text-white rounded-xl text-sm font-bold hover:bg-teal-800 transition shadow-md">
            Save Report
          </button>
        </div>
      </form>
    </main>
  );
}
// --- Date helpers ---
// The calendar input uses "2026-10-27"; reports store "Oct 27, 2026"
function todayISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function toISO(displayDate) {
  const d = new Date(displayDate);
  if (isNaN(d)) return todayISO();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function toDisplay(isoDate) {
  return new Date(isoDate + "T00:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

// --- Weather helper: turns Open-Meteo weather codes into words ---
function describeWeather(code) {
  if (code === 0) return "Clear";
  if (code <= 2) return "Partly Cloudy";
  if (code === 3) return "Overcast";
  if (code <= 48) return "Fog";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Rain Showers";
  if (code <= 86) return "Snow Showers";
  return "Thunderstorm";
}

// --- Photo helper: shrink a photo before saving ---
async function compressImage(file, maxSize = 1600, quality = 0.7) {
  // Convert iPhone HEIC photos to JPEG first (Windows browsers can't open HEIC)
  if (/\.(heic|heif)$/i.test(file.name) || /image\/hei[cf]/i.test(file.type)) {
    const { default: heic2any } = await import("heic2any");
    const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
    file = Array.isArray(converted) ? converted[0] : converted;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      // Scale down so the longest side is at most 1600px (never scale up)
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      // Save as JPEG at 70% quality
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}