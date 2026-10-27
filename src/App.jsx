import React, { useState, useEffect } from "react";
import { db } from "./db";
import { 
  FileText, 
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
  Search
} from "lucide-react";

const DEFAULT_PROFILE = {
  name: "Alex Johnson",
  company: "Apex Construction Inc.",
  role: "Senior Superintendent",
};

const SAMPLE_REPORTS = [
  {
        id: "rep-101",
        projectId: "proj-1",
        date: "Oct 20, 2026",
        title: "Foundation Pour & Rebar Inspection",
        bullets: "• Completed foundation pour for Section 3.\n• Rebar inspection passed by city official.\n• Concrete pump truck arrived on site at 07:30 AM.",
        weather: "72°F, Clear / Sunny",
        prepBy: "Alex Johnson"
      },
      {
        id: "rep-102",
        projectId: "proj-1",
        date: "Oct 19, 2026",
        title: "Site Excavation & Underground Utilities",
        bullets: "• Excavation ongoing at north quadrant.\n• Water main tie-in prepped.\n• Safety toolbox talk conducted prior to shift.",
        weather: "68°F, Overcast",
        prepBy: "Alex Johnson"
      },
      {
        id: "rep-103",
        projectId: "proj-2",
        date: "Oct 20, 2026",
        title: "Steel Framing & Crane Setup",
        bullets: "• Structural steel erection started on grid lines A through D.\n• Mobile 50-ton crane inspected and operational.",
        weather: "70°F, Sunny",
        prepBy: "Alex Johnson"
      }
];

export default function App() {
  const todayFormatted = toDisplay(todayISO());

const reportRef = React.useRef(null);

const handleExportPDF = () => {
    showToast("Opening print dialog... Select 'Save as PDF'");
    window.print();
  };

  // --- State with LocalStorage Persistence ---
  const [activeTab, setActiveTab] = useState("proj-1");
  const [activeView, setActiveView] = useState("dashboard");
  const [selectedReport, setSelectedReport] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState("");

const [profile, setProfile] = useState(DEFAULT_PROFILE);
const [reports, setReports] = useState([]);
const [isLoaded, setIsLoaded] = useState(false);
const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
const [tempProfile, setTempProfile] = useState({ ...profile });

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

      const savedProfile = await db.profile.get("me");
      if (savedProfile) {
        const { id, ...rest } = savedProfile;
        setProfile(rest);
        setReports(await db.reports.reverse().toArray());
      } else {
        // Very first run: save the defaults and sample reports
        await db.profile.put({ id: "me", ...DEFAULT_PROFILE });
        await db.reports.bulkPut(SAMPLE_REPORTS);
        setReports(SAMPLE_REPORTS);
      }
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setIsLoaded(true);
    }
  }
  loadData();
}, []);

  // Projects State (Static)
  const [projects] = useState([
    { id: "proj-1", name: "Project Alpha", code: "PA-2026", location: "Downtown Plaza" },
    { id: "proj-2", name: "Project Beta", code: "PB-2026", location: "Industrial Park" },
    { id: "proj-3", name: "Project Gamma", code: "PG-2026", location: "Westside District" }
  ]);


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
    await db.reports.delete(id);
    setReports((prev) => prev.filter((r) => r.id !== id));
    showToast("Report deleted successfully.");
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
    await db.reports.put(reportData);
    setReports((prevReports) => {
      const exists = prevReports.some((r) => r.id === reportData.id);
      return exists
        ? prevReports.map((r) => (r.id === reportData.id ? reportData : r))
        : [reportData, ...prevReports];
    });
    showToast(selectedReport ? "Report updated successfully!" : "New report created successfully!");
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
    await db.profile.put({ id: "me", ...tempProfile });
    setProfile({ ...tempProfile });
    setIsEditProfileOpen(false);
    showToast("Profile updated successfully!");
  } catch (err) {
    console.error(err);
    showToast("Could not save profile.");
  }
};

  const handleOpenEditProfile = () => {
    setTempProfile({ ...profile });
    setIsEditProfileOpen(true);
  };

  const activeProject = projects.find((p) => p.id === activeTab) || projects[0];
  const projectReports = reports
    .filter((r) => r.projectId === activeTab)
    .filter((r) => 
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      r.date.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.bullets.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce border border-teal-500">
          <Check className="w-5 h-5 text-teal-400" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Main Top Header Navbar */}
      <header className="bg-teal-900 text-white shadow-md border-b border-teal-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-teal-800 rounded-lg text-teal-300">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-wide leading-none">Daily Report Tracker</h1>
              <p className="text-xs text-teal-300 font-light mt-0.5">Field Inspection & AI Dictation</p>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <span className="text-xs bg-teal-800 text-teal-200 px-3 py-1 rounded-full font-medium inline-flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {todayFormatted}
            </span>
          </div>
        </div>
      </header>

      {/* View Switcher: Dashboard View vs. Forms View */}
      {activeView === "dashboard" ? (
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 space-y-6">
          {/* User Profile Card */}
          <section className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between md:items-center gap-4">
            <div className="flex items-start md:items-center space-x-4">
              <div className="w-14 h-14 rounded-2xl bg-teal-800 text-teal-100 flex items-center justify-center font-bold text-xl shadow-inner border border-teal-700">
                {profile.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900">{profile.name}</h2>
                  <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md">Signed In</span>
                </div>
                <div className="flex flex-wrap items-center text-sm text-slate-600 gap-x-4 gap-y-1">
                  <span className="flex items-center gap-1">
                    <Building2 className="w-4 h-4 text-teal-700" />
                    <strong>{profile.company}</strong>
                  </span>
                  <span className="flex items-center gap-1 text-slate-500">
                    <User className="w-4 h-4 text-slate-400" />
                    {profile.role}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={handleOpenEditProfile}
              className="self-start md:self-center px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-sm transition flex items-center gap-2 border border-slate-300"
            >
              <Pencil className="w-4 h-4 text-slate-600" />
              Edit Profile
            </button>
          </section>

          {/* Project Tabs Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <Folder className="w-4 h-4 text-teal-700" /> Active Projects
              </h3>
            </div>

            <div className="flex space-x-2 border-b border-slate-300 overflow-x-auto pb-1 scrollbar-none">
              {projects.map((proj) => {
                const isActive = activeTab === proj.id;
                const count = reports.filter(r => r.projectId === proj.id).length;
                return (
                  <button
                    key={proj.id}
                    onClick={() => setActiveTab(proj.id)}
                    className={`px-5 py-3 rounded-t-xl font-semibold text-sm transition flex items-center gap-2.5 whitespace-nowrap border-t border-x ${
                      isActive
                        ? "bg-white text-teal-900 border-slate-300 border-b-white font-bold shadow-sm -mb-[1px]"
                        : "bg-slate-200/80 text-slate-600 hover:bg-slate-300/80 border-transparent"
                    }`}
                  >
                    <span>{proj.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${isActive ? "bg-teal-100 text-teal-800" : "bg-slate-300 text-slate-700"}`}>
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
                      className="group bg-slate-50 hover:bg-slate-100/90 border border-slate-200 hover:border-teal-300 rounded-xl p-4 transition duration-150 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs"
                    >
                      <button
                        onClick={() => handleOpenViewReport(report)}
                        className="text-left flex-1 space-y-1.5 focus:outline-none"
                      >
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="px-3 py-1 bg-teal-900 text-white font-semibold text-xs rounded-lg shadow-2xs">
                            {report.date}
                          </span>
                          <h4 className="font-bold text-slate-800 text-base group-hover:text-teal-900 transition flex items-center gap-1.5">
                            {report.title}
                            <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 text-teal-700 transition" />
                          </h4>
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-1 pr-4 whitespace-pre-line">
                          {report.bullets}
                        </p>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
                          <span>Weather: {report.weather}</span>
                          <span>•</span>
                          <span>By: {report.prepBy}</span>
                        </div>
                      </button>

                      <div className="flex items-center gap-2 border-t md:border-t-0 pt-3 md:pt-0 border-slate-200 justify-end">
                        <button
                          onClick={() => handleOpenReportForm(report)}
                          title="Edit Report"
                          className="p-2 text-slate-600 hover:text-teal-800 hover:bg-teal-100 rounded-lg transition"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteReport(report.id, report.title)}
                          title="Delete Report"
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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
          <div className="flex items-center justify-between">
            <button
              onClick={() => setActiveView("dashboard")}
              className="flex items-center gap-2 text-sm font-bold text-teal-800 hover:text-teal-900 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 text-sm font-bold bg-teal-700 text-white px-4 py-2 rounded-xl shadow-md hover:bg-teal-800 transition"
            >
              <Download className="w-4 h-4" /> Export PDF Report
            </button>
          </div>

         {/* Printable Report Container */}
          <div ref={reportRef} className="print-container bg-white rounded-2xl p-8 shadow-md border border-slate-200 space-y-6">
            <div className="border-b-2 border-teal-900 pb-4 flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">DAILY CONSTRUCTION REPORT</h2>
                <p className="text-xs font-bold text-teal-800 mt-1 uppercase tracking-wider">{activeProject.name}</p>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-slate-800">{selectedReport?.date || todayFormatted}</span>
                <p className="text-xs text-slate-500">Status: Verified</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-500 block font-semibold">Contractor:</span>
                <span className="font-bold text-slate-800">{profile.company}</span>
              </div>
              <div>
                <span className="text-slate-500 block font-semibold">Preparer:</span>
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
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-2 border-b border-slate-200 pb-1">Field Notes</h3>
              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50 p-4 rounded-xl border border-slate-200">
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
                      <div className="h-32 bg-slate-200 rounded-lg overflow-hidden">
                        <img src={photo.url} alt={photo.caption} className="w-full h-full object-cover" />
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

      {/* Footer Bar */}
      <footer className="bg-slate-900 text-slate-400 text-xs py-4 px-4 text-center border-t border-slate-800 mt-auto">
        <p>© 2026 Daily Report Tracker • Built for Mobile & Hands-Free Construction Documentation</p>
      </footer>
    </div>
  );
}

// --- SUB-COMPONENT FOR CREATING & EDITING REPORTS WITH PHOTOS & VOICE ---
function ReportFormView({ selectedReport, activeProject, profile, showToast, onSave, onCancel }) {
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
    () => {}, // location denied: the user can type the weather manually
    { timeout: 10000 }
  );
}, [selectedReport]);
  const [bullets, setBullets] = useState(selectedReport?.bullets || "");
  
  // Photos State
  const [photos, setPhotos] = useState(selectedReport?.photos || []);
  const fileInputRef = React.useRef(null);

  // Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recognitionInstance, setRecognitionInstance] = useState(null);

  // Handle Image File Upload & Base64 Conversion
  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newPhoto = {
          id: `photo-${Date.now()}-${Math.random()}`,
          url: reader.result, // Base64 string for local storage
          caption: file.name.replace(/\.[^/.]+$/, "") // Default caption to filename
        };
        setPhotos((prev) => [...prev, newPhoto]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleCaptionChange = (id, newCaption) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, caption: newCaption } : p))
    );
  };

  const handleRemovePhoto = (id) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  // Toggle Speech Recognition
  const handleToggleRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      showToast("Speech recognition is not supported in this browser. Please use Google Chrome.");
      return;
    }

    if (isRecording) {
      if (recognitionInstance) recognitionInstance.stop();
      setIsRecording(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => setIsRecording(true);

    recognition.onresult = (event) => {
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + "\n";
        }
      }

      const cleanText = finalTranscript.trim();
      if (cleanText) {
        setBullets((prev) => (prev ? `${prev}\n• ${cleanText}` : `• ${cleanText}`));
    }
    };

    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);

    try {
      recognition.start();
      setRecognitionInstance(recognition);
    } catch (err) {
      setIsRecording(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isRecording && recognitionInstance) recognitionInstance.stop();
    onSave({
      id: selectedReport?.id || `rep-${Date.now()}`,
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
            if (isRecording && recognitionInstance) recognitionInstance.stop();
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
            <label className="block text-xs font-semibold text-slate-600 mb-1">Contractor</label>
            <input type="text" readOnly value={profile.company} className="w-full bg-slate-100 border border-slate-200 rounded-lg p-2 text-xs font-medium text-slate-700 cursor-not-allowed" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Report Preparer</label>
            <input type="text" readOnly value={selectedReport?.prepBy || profile.name} className="w-full bg-slate-100 border border-slate-200 rounded-lg p-2 text-xs font-medium text-slate-700 cursor-not-allowed" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Date</label>
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-teal-600" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Weather Condition</label>
            <input type="text" required placeholder="e.g. 72°F, Sunny" value={weather} onChange={(e) => setWeather(e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-teal-600" />
          </div>
        </div>

        {/* Interactive Voice Recording Interface */}
        <div className={`rounded-2xl p-6 text-center space-y-4 shadow-md transition-all duration-300 ${isRecording ? "bg-red-950 text-white border-2 border-red-500 shadow-red-900/50" : "bg-slate-900 text-white"}`}>
          <div className={`inline-flex p-3 rounded-full ${isRecording ? "bg-red-800 text-red-200 animate-pulse" : "bg-teal-800 text-teal-300"}`}>
            <Mic className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-bold text-lg">{isRecording ? "Listening to Field Notes..." : "Hands-Free Voice AI Assistant"}</h3>
            <p className="text-xs text-slate-300 max-w-md mx-auto mt-1">
              {isRecording ? "Speak naturally into your microphone. Text will append below automatically." : "Tap record and speak site notes naturally to generate bullet points."}
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={handleToggleRecording}
              className={`w-24 h-24 rounded-full active:scale-95 transition-all text-white font-bold shadow-lg inline-flex flex-col items-center justify-center gap-1 border-4 ${isRecording ? "bg-red-600 hover:bg-red-500 border-red-300 animate-bounce shadow-red-900/80" : "bg-teal-600 hover:bg-teal-500 border-teal-400/30 shadow-teal-900/50"}`}
            >
              <Mic className="w-8 h-8" />
              <span className="text-[10px] tracking-wider uppercase">{isRecording ? "Listening" : "Record"}</span>
            </button>
          </div>
        </div>

        {/* AI Generated Bulletin Report Area */}
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-800">AI Bulletin Report Summary</label>
          <textarea
            rows={4}
            value={bullets}
            onChange={(e) => setBullets(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-800 focus:ring-2 focus:ring-teal-600 focus:bg-white"
            placeholder="AI-generated transcript summary will populate here..."
          />
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
          <button type="button" onClick={onCancel} className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200 transition">
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