# 🏗️ Construction Daily Report Tracker (PWA)

A field-ready, offline-first Progressive Web App (PWA) for construction superintendents and project managers. Log daily site activity, dictate field notes hands-free with voice recognition, document job site photos with captions, and export clean PDF daily reports.

![Daily Report Tracker dashboard](docs/dashboard.png)

## 🌟 Key Features

- **📱 Installable PWA** – Installs on iOS, Android, macOS, and Windows with its own app icon (a report page as a microphone, to show voice-first reporting for any field-work industry) and home-screen name ("Daily Reports"). Critical assets and icons are cached locally, so the app opens and runs in job site dead zones with no cell service.
- **🔐 Accounts & Login** – Email and password sign-up with email confirmation (Supabase Auth), plus **Forgot password** (reset link by email, then a Set New Password screen). Users stay signed in on their device, and the sign-in check works offline. Row Level Security ensures each user can only see and change their own data.
- **☁️ Offline-First Cloud Sync** – Every change is saved on the device first, marked as unsent, and synced to Supabase automatically: when the app opens, a few seconds after each change, when the connection returns after a dead zone, and every 5 minutes (plus a **sync button** in the header). Changes from other devices are downloaded, the newest version wins, and unsent local edits are never overwritten. Deletions sync too.
- **🚪 Safe Sign-Out** – Signing out sends any unsent changes first, warns if something couldn't be sent, then clears the device so the next person can't see the previous user's reports. Data returns automatically on the next sign-in.
- **💾 Offline Storage with IndexedDB** – Profiles, reports, and photos are stored on the device in IndexedDB (via Dexie.js), so the app works fully without signal. The app only confirms a save after the data is actually stored.
- **🖼️ Cloud Photo Storage** – Photos are uploaded once to a private Supabase Storage bucket (one folder per user, protected by a security policy) and downloaded only on devices that don't have them yet. Reports in the cloud store just each photo's ID, caption, and location. Removing a photo, deleting a report, or deleting a project also deletes the photo files from Storage.
- **🆕 Clean Start for New Users** – New accounts start empty: the profile menu shows "Welcome!" with a **Set Up Profile** option, and the dashboard shows an **Add your first project** screen. Old sample data is removed automatically from devices (only if it was never edited or synced).
- **✉️ Invite-Only Testing** – Public sign-ups are turned off in Supabase. Testers are invited from **Authentication → Users → Invite user**; the invite link opens a **Set Password** screen, then the dashboard.
- **🗂️ Project Management** – Add, edit, and delete projects (name, code, location, and optional start and end dates, which appear on the report when filled in). The newest project appears as the first tab and opens by default. Deleting a project also deletes its reports, after a confirmation warning. Deleting the last project returns to the "Add your first project" screen.
- **📅 Smart Report Defaults** – New reports open with today's date (with a calendar picker to change it) and the current local weather, fetched automatically from your location. Both can be edited manually.
- **🎙️ AI Voice Dictation** – Tap **Record**, speak, and tap **Stop**. The recording is transcribed by OpenAI (`gpt-4o-mini-transcribe`) through a Supabase Edge Function, with a built-in list of construction terms (FF&E, RFI, MEP, punch list, and more) to improve spelling of site language. Works on iPhone (Safari) as well as Chrome and Edge. The OpenAI key stays on the server and is never exposed to the app, and only signed-in users can use the function.
- **✨ AI Cleanup** – Each transcript is tidied by an OpenAI text model (`gpt-4o-mini`) into short, professional bullet points: one fact per bullet, misheard terms fixed from context (e.g. "epiphany" → "FF&E"), filler and side conversations removed, and every number, name, and location kept exactly. If cleanup fails, the plain transcript is used instead.
- **⌨️ Smart Bullets** – In the notes box, pressing **Enter** starts a new bullet automatically, and tapping into an empty box starts the first one, so typed additions match dictated ones. **Shift + Enter** makes a plain new line.
- **📡 Offline Voice Notes** – With no signal (or too weak a signal to reach the server), recordings are saved on the device and the form shows how many are waiting. A note under the notes box explains that the text won't appear until the phone is back online and that **Save Report** must be tapped. Leaving a new, unsaved report with waiting notes shows a warning so they aren't lost. Once the phone is back online, waiting notes are transcribed automatically, added to their report in the order they were recorded, and synced to the cloud.
- **📸 Photo Documentation & Labeling** – Add photos from the camera or device storage, store them offline, and attach trade or location captions. Photos are automatically resized (max 1600px) and compressed to JPEG before saving, typically about 15–20× smaller (e.g., 2.7 MB → 159 KB). iPhone HEIC photos are converted automatically, so they also work in Windows browsers. In the report, photos are shown in full without cropping.
- **📄 PDF Export** – The app builds the **Daily Report** PDF itself with jsPDF (no browser printing), so it looks identical on iPhone, Android, Chrome, and Edge, and works in the installed home-screen app. Pages after the first repeat a header with the project name and report date, every page shows "Page X of Y", photos appear in rows of 3 and are never split across pages, and photos are resized for the PDF to keep files small (about 1 MB for a report with 10 photos). On phones, **Export PDF Report** opens the Share menu (Mail, Messages, Files); on laptops it downloads the file. Files are named `Daily Report - Project - Date.pdf`. After saving, the report opens straight to the preview, with an **Edit Report** button for quick fixes.
- **🧭 Simple Dashboard** – A clean header with a **sync** icon (spins while syncing) and a round **profile button** with the user's initials, which opens a menu with **Edit Profile** and **Sign Out**. A yellow **No signal** banner appears on every screen when the phone is offline and shows how many reports are saved on the phone, waiting to sync. A small **+ Add Project** link sits above the project tabs. Tabs are narrower on phones (about 2½ visible, swipe for more), long names are cut off with "…", and the full name shows on hover. The project name is smaller and wraps neatly next to the project code. A large **Add New Report** button floats at the bottom of the screen and stays in place while scrolling.
- **📋 Clean Report List** – Each report shows only its full title (wrapping to two lines if needed) with the date below, plus large Edit and Delete buttons, so the report history is easy to scan on a phone. Search still finds reports by their note text.
- **👓 Readable on Phones** – Larger, darker text on phones for report previews, field notes, and form fields, tested with users of different ages. Form text is 16px, which also stops iPhones from auto-zooming when a field is tapped.
- **⚡ Responsive, High-Contrast UI** – Built with React 19, Vite, and Tailwind CSS v4, with high contrast for outdoor visibility.

## 🛠️ Tech Stack

| Area | Technology |
| --- | --- |
| Frontend | React 19 + Vite |
| Styling | Tailwind CSS v4 |
| Icons | Lucide React |
| Offline Storage | IndexedDB via Dexie.js |
| Backend & Auth | Supabase (Postgres, Auth, Row Level Security, Storage) via `@supabase/supabase-js` |
| Hosting | Netlify (auto-deploys from GitHub `main`) |
| PWA / Offline | vite-plugin-pwa (service worker) |
| Weather | Open-Meteo API (free, no API key) + browser Geolocation |
| Photo Processing | Browser Canvas API (resize & compress) + heic2any (HEIC → JPEG) |
| Speech-to-Text | Browser `MediaRecorder` + OpenAI transcription API via Supabase Edge Function (`transcribe`) |
| PDF Export | jsPDF (built in the app, loaded only when exporting) + Web Share API on phones |

## 📁 Project Structure

```
daily-report-tracker/
├── docs/                  # README screenshots
├── public/
│   ├── favicon.svg            # App icon (browser tab, app header & login screen)
│   ├── apple-touch-icon.png   # iPhone/iPad home-screen icon (180×180)
│   ├── pwa-192x192.png        # Android home-screen icon
│   ├── pwa-512x512.png        # Android splash screen / large icon
│   ├── maskable-512x512.png   # Android icon for circle/rounded crops
│   └── icons.svg
├── src/
│   ├── App.jsx            # Main component, views & state management
│   ├── AuthScreen.jsx     # Sign-in, create-account, forgot & set-new-password screens
│   ├── db.js              # IndexedDB database setup (Dexie.js)
│   ├── supabase.js        # Supabase connection
│   ├── sync.js            # Offline-first cloud sync (send & receive)
│   ├── voiceQueue.js      # Offline voice notes: transcribe when back online
│   ├── pdf.js             # Builds the Daily Report PDF (jsPDF)
│   ├── main.jsx           # Application entry point
│   └── index.css          # Tailwind directives & @media print styles
├── .env.local             # Supabase settings (not committed to Git)
├── vite.config.js         # Vite config with Tailwind CSS v4 & PWA plugin
├── package.json
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Node.js v18 or later
- Google Chrome or Microsoft Edge (recommended for voice dictation)

### Installation

```bash
git clone https://github.com/Kiki-K82/daily-report-tracker.git
cd daily-report-tracker
npm install
```

### Supabase Settings

Create a file named `.env.local` in the project folder (next to `package.json`) with your Supabase project's URL and **publishable** key:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here
```

- Use the base URL only (no `/rest/v1/` at the end).
- Never use the **secret** key in this app.
- `.env.local` is excluded from Git. For the live site, add the same two variables in **Netlify → Project configuration → Environment variables** (not marked as secret).

### Voice Dictation (Supabase Edge Function)

The `transcribe` Edge Function is created in the Supabase dashboard (**Edge Functions → Deploy a new function → Via Editor**). Name it `transcribe` *before* the first save, since the first name becomes its web address. Keep **Verify JWT** on so only signed-in users can call it.

Store the OpenAI API key under **Edge Functions → Secrets** as `OPENAI_API_KEY`. Never put this key in the app, `.env.local`, or Netlify. Use a low spending limit and keep auto-recharge off while testing.

To improve recognition of site terms, edit the `CONSTRUCTION_TERMS` list in the function and redeploy. The cleanup rules are in `CLEANUP_INSTRUCTIONS`, written in plain English, and can be adjusted the same way. A backup copy of the function's code is kept in `supabase/functions/transcribe/index.ts`. Update it whenever the function is changed in Supabase.

Then start the app:

```bash
npm run dev
```

Open http://localhost:5173/ in your browser.

> ⚠️ **Note:** Test in a regular Chrome or Edge window, not an embedded IDE preview (such as VS Code's built-in browser), so microphone, location, and storage permissions work correctly.

### Inspecting Stored Data

Press **F12 → Application → IndexedDB → DailyReportTrackerDB** to see the `reports`, `profile`, `projects`, `deletions`, and `meta` tables. Records with `dirty: 1` haven't been sent to the cloud yet. Use **Refresh database** to update the view (never **Delete database**).

Cloud data is in the Supabase dashboard under **Table Editor** (`projects`, `reports`, `profiles`). Photo files are under **Storage → photos**, organized as `user-id/report-id/photo-id.jpg`.

**Testing sync on one laptop:** An InPrivate/Incognito window has its own storage, so it acts like a second device. Sign in with the same account in both windows.

## 📱 Testing on Your Phone

**Phone view in the browser:** Press **F12**, then **Ctrl + Shift + M**, and choose a phone from the **Dimensions** dropdown.

**On a real phone:** With the phone and laptop on the same Wi-Fi, start the server with:

```bash
npm run dev -- --host
```

Then open the **Network** address shown in the terminal (e.g., `http://192.168.1.25:5173/`) in the phone's browser.

> ⚠️ **Note:** The microphone and automatic weather usually won't work this way, because phones only allow them on secure (https) sites. Layout and text sizes are accurate.

## 📲 Testing Offline Mode

Service workers only run in a production build:

```bash
npm run build
npm run preview
```

1. Open the preview URL (usually http://localhost:4173/).
2. Press **F12** to open Developer Tools.
3. In the **Network** tab, set throttling to **Offline** (or check **Offline** under **Application → Service Workers**), then refresh the page. A yellow **No signal** banner appears under the header.

## 📝 Usage Guide

1. **Sign In** – Accept your invite email and set a password (or sign in if you already have an account). Forgot it? Tap **Forgot password?** to get a reset link by email.
2. **Profile Setup** – Tap the round profile button at the top right, then **Set Up Profile**, and enter your name, company, and role. They appear on your reports.
3. **Projects** – Tap **+ Add Project** above the tabs to create a project, optionally with start and end dates (for sequenced projects, use the current sequence's dates). Use the **pencil** next to the project code to edit or delete it.
4. **Create a Daily Report** – Select a project tab and tap the **Add New Report** button at the bottom of the screen. Today's date and local weather fill in automatically (allow location access when prompted); change either if needed.
5. **Voice Dictation** – Tap **Record**, speak your field observations naturally, then tap **Stop**. The AI turns them into clean bullet points. To add something by hand, tap at the end and press **Enter** for a new bullet. No signal? The note is saved and added automatically once you're back online. Just save the report as usual.
6. **Photos** – Click **+ Add Site Photo**, then add a caption (e.g., "Foundation Pour – Grid C4").
7. **Save & Export** – Click **Save Report**. The finished report opens immediately. Click **Export PDF Report**: on a phone, choose Mail, Messages, or Files from the Share menu (if the button changes to **Share PDF**, tap it once more); on a laptop, the PDF downloads. Use **Edit Report** to make changes.
8. **Sync** – Happens automatically. Tap the **sync icon** at the top right to sync immediately. With no signal, a yellow banner shows how many reports are waiting. Sign in on another device to see the same reports.
9. **Sign Out** – Tap the profile button, then **Sign Out**. It sends unsent changes, then clears the device. Your data stays in the cloud.

![Daily report view](docs/reportpage.png)

## ⚠️ Known Limitations

- **Older photos:** Reports synced before photo storage was added keep their images inside the report's cloud record. They move to Storage automatically the next time the report is edited and saved.
- **PDF fonts:** The PDF uses a standard built-in font, so a few special characters outside Western European languages (for example "č", "ć", "đ") may not display correctly.
- **"Powered by Netlify" badge:** Shown on the free plan for new public projects; removing it requires a paid Netlify plan (or another host). The floating **Add New Report** button is raised to sit above the badge; without the badge, change `bottom-[4.25rem]` to `bottom-5` in `App.jsx`.
- **Email sending:** Supabase's built-in email service is limited to a few emails per hour, which is fine for testing.
- **Voice dictation:** Accuracy depends on how clearly terms are spoken; the AI cleanup fixes many misheard terms from context, but supers should still review the bullets before saving. Background conversations on a noisy site may be picked up. Holding the phone close or using earbuds with a mic helps.
- **Offline voice notes:** Notes recorded in a report that is never saved (form cancelled) are discarded after 7 days.
- **Weather:** Automatic weather requires location permission and an internet connection. Offline, the field stays blank for manual entry.

## 🗺️ Roadmap

- [x] Move storage to IndexedDB (Dexie.js) for larger, more reliable offline storage
- [x] Default to today's date with a calendar picker, and auto-fill local weather
- [x] Open the saved report directly after saving
- [x] Add, edit, and delete projects (newest project first)
- [x] Larger, higher-contrast text for phone readability
- [x] Compress photos before saving to reduce storage use (with HEIC support)
- [x] Data export/import backup (temporary, for testing; removed once cloud sync was added)
- [x] Accounts and login with Supabase (email & password, Row Level Security)
- [x] Offline-first cloud sync across devices (automatic, with safe sign-out)
- [x] Move photos to Supabase Storage (with cleanup of deleted photos)
- [x] "Forgot password" flow
- [x] Remove the temporary backup buttons
- [x] AI transcription with construction terminology (OpenAI via Supabase Edge Function)
- [x] Offline recording that transcribes automatically once back online
- [x] Remove sample data; clean start for new users
- [x] Invite-only tester accounts
- [x] AI cleanup of dictated notes (split into clean bullets, fix terms, drop off-topic chatter)
- [x] Automatic bullets when typing (Enter key)
- [x] Edit Report button on the report view
- [x] New app icon (report page as a microphone, suitable for any field-work industry)
- [x] PDF polish: "Daily Report" title, "Prepared By", repeating page header, page numbers, removed placeholder "Status: Verified" label
- [x] Optional project start and end dates (shown on the report)
- [x] App-built PDFs (jsPDF): same on every device, works in the home-screen app, small files, Share menu on phones
- [x] Pop-up messages moved to the top of the screen
- [x] Offline voice note reminder and leave-without-saving warning
- [x] Cleaner report list (title with date below)
- [x] Cleaner dashboard: header sync icon and profile menu, No signal banner, Add Project link, narrower tabs, smaller project name, floating Add New Report button
- [ ] Archive finished projects (keep reports, hide tabs), with export options
- [ ] Ideas from pilot feedback: daily report reminders, location-based project suggestion, larger-screen layout
- [x] Hosted deployment on Netlify (accessible from any network)
- [x] Custom app icons and PWA manifest (installable with its own icon)
