# NerdMeet

NerdMeet is an automated, real-time analytics and attendance tracking tool for **Google Meet**. It tracks speaking time, camera activity, mic and camera toggle counts, a real-time chronological (FIFO) hand-raise queue, screen-share duration, and chat engagement -- with custom PDF, CSV, and JSON export capabilities.

Everything runs 100% locally in your browser with zero servers, zero external dependencies, and zero telemetry.

---

## What It Does

During any Google Meet call, NerdMeet automatically gathers meeting insights without interrupting the call:

* **Accurate Participant Tracking**: Automatically isolates real attendees from screen shares, presentation tiles, toolbar buttons, and UI controls.
* **FIFO Hand-Raise Queue**: Tracks exactly who raised their hand first with live wait durations to help hosts call on participants fairly.
* **Speaking Time & Mic Toggles**: Measures cumulative speech duration (in seconds/minutes) and records how many times each participant unmuted their microphone.
* **Camera Duration & Camera Toggles**: Tracks how long each participant's webcam was turned on and how many times they toggled their camera.
* **Screen Sharing Attribution**: Correctly attributes screen share time to the presenter rather than creating duplicate "Presentation" attendees.
* **Custom PDF Report Generator**: Choose exactly which columns and KPIs to include in exported PDF reports (e.g., Attendance only, Speech & Hands, or full detailed stats).
* **Cross-Browser & Userscript Ready**: Works as an unpacked browser extension for Mozilla Firefox, Google Chrome, Brave, and Edge, or as a standalone userscript via Tampermonkey.

---

## Setup & Installation

> [!NOTE]
> Install either the **Browser Extension** or the **Tampermonkey Userscript** (not both at the same time) to avoid duplicate tracking.

### 1. Mozilla Firefox (Recommended)

1. Open your terminal in this repository and ensure the manifest is in Firefox mode:
   ```bash
   node switch-browser.js firefox
   ```
2. In Firefox, open a new tab and go to:
   ```text
   about:debugging#/runtime/this-firefox
   ```
3. Click **Load Temporary Add-on...**
4. Select the `manifest.json` file in this directory.
5. Pin the **NerdMeet** icon to your toolbar using the Extensions puzzle piece.

---

### 2. Google Chrome, Brave, Microsoft Edge

1. Switch the manifest to Chrome mode:
   ```bash
   node switch-browser.js chrome
   ```
2. Open your browser and navigate to:
   ```text
   chrome://extensions/
   ```
   *(or `edge://extensions/` / `brave://extensions/`)*
3. Enable **Developer mode** using the toggle switch in the top-right corner.
4. Click **Load unpacked** in the top-left corner.
5. Select the root folder of this repository (`NerdMeet`).
6. Pin the **NerdMeet** icon to your browser toolbar.

---

### 3. Tampermonkey / Violentmonkey (Any Browser)

If you prefer using a userscript manager without loading an extension in developer mode:

1. Install the **Tampermonkey** or **Violentmonkey** extension from your browser's store.
2. Open the userscript dashboard and click **Create a new script** (`+`).
3. Copy all code from `nerdmeet.user.js` and paste it into the script editor.
4. Save the script (`Ctrl + S` or `Cmd + S`).

---

## How to Use

### In the Meeting (Floating HUD)

1. Start or join any Google Meet call at [meet.google.com](https://meet.google.com).
2. The draggable **NerdMeet HUD** will automatically mount in the meeting:
   * **Hands Tab**: Displays active hand-raisers in chronological order with elapsed wait timers.
   * **Roster Tab**: Displays live active attendees, current speaker indications, and quick stats.
   * **Quick Export**: Download CSV or JSON data with one click.
   * **Side Panel Button**: Opens the analytics side panel directly from the call.

### In the Analytics Side Panel

Click the **NerdMeet** icon in your browser toolbar (or click the sidebar icon inside the in-meeting HUD) to open the docked panel:

* **Live Meeting Selector**: Select any current or past meeting session stored in local browser memory.
* **Search & Filter**: Search participants by name or filter by active/all.
* **Privacy Anonymizer**: Mask participant names (*Participant 1*, *Participant 2*, etc.) before sharing or exporting reports.
* **Metrics Tracked**:
  * Total stay duration
  * Talk time and mic open counts
  * Camera active time and camera open counts
  * Hand raises and rejoins
  * Chat messages sent

### Exporting Reports

Click **PDF Report** in the side panel to open the custom export dialog:

1. **Pick Presets**: Quickly select *Select All*, *Attendance Only*, *Talk & Hands*, or *Minimal*.
2. **Custom Column Selection**: Toggle specific columns on or off (Stay Duration, Talk Time, Mic Opens, Cam Time, Cam Opens, Hands, Chat, Rejoins).
3. **KPI Summary**: Toggle summary attendance and duration header cards.
4. Click **Generate PDF** to download a styled PDF report.

---

## Privacy & Local Architecture

* **100% Client-Side**: All data is collected and processed purely in the browser runtime.
* **No Telemetry**: No third-party network requests, tracking scripts, or analytics servers.
* **Local Storage**: Meeting data is stored only in your browser's extension storage (`chrome.storage.local` / `browser.storage.local` / `localStorage`).

---

## License

MIT
