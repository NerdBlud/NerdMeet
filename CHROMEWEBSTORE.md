# Chrome Web Store Listing — NerdMeet

> Last Updated: 2026-10-18

## Store Listing

**Extension Name** [REQUIRED]
NerdMeet - Google Meet Analytics & Live Tracker

**Short Description** [REQUIRED]
Live speaking duration, attendance tracking, FIFO hand-raise queue, and engagement analytics in Google Meet.

**Detailed Description** [REQUIRED]
NerdMeet gives meeting hosts and facilitators live, privacy-respecting analytics directly inside Google Meet calls.

Track engagement and manage discussions without guesswork:
- Live Talk Time & Duration: See who is speaking and total cumulative speaking time per attendee.
- FIFO Hand-Raise Queue: Know exactly who raised their hand first, with real-time wait duration timers.
- Stay & Attendance Monitoring: Monitor join times, leave times, rejoins, and duration for every participant.
- Integrated Chrome Side Panel: View live attendance curves, talk-time leaderboards, and attendee lists side-by-side with your call.
- Draggable In-Meeting HUD: A compact floating widget inside Google Meet that shows live speaker status and the queue without obstructing call controls.
- One-Click Exports: Export comprehensive PDF meeting reports or CSV spreadsheets with one click.
- Privacy Mode: Built-in name masking and anonymization for sharing compliance reports.

How to use it:
1. Join or host any Google Meet call.
2. The NerdMeet indicator appears in your meeting tab, tracking participation automatically.
3. Open the Chrome Side Panel at any time by clicking the extension icon in your browser toolbar.
4. Export meeting metrics to PDF or CSV when finished.

Privacy First:
All tracking data is processed locally in your browser. Nothing is ever sent to external servers or third-party analytics.

**Category** [REQUIRED]
Productivity

**Single Purpose** [REQUIRED]
Tracks speaking duration, raised-hand queue order, and participant attendance in Google Meet calls.

**Primary Language** [REQUIRED]
English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | icons/icon-128.png |
| Screenshot 1 [REQUIRED] | 1280×800 or 640×400 | ⬜ Not created | screenshots/sidepanel.png |
| Screenshot 2 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Not created | screenshots/hud-queue.png |
| Screenshot 3 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Not created | screenshots/report-pdf.png |
| Small Promo Tile [RECOMMENDED] | 440×280 | ⬜ Not created | |
| Marquee Promo Tile | 1400×560 | ⬜ Not created | |

### Screenshot Notes
- Screenshot 1: Google Meet call with Chrome Side Panel open showing the live attendance curve and talk time bars.
- Screenshot 2: Floating HUD inside Google Meet displaying the FIFO Raised Hands Queue with wait timers.
- Screenshot 3: Exported PDF report preview with participant breakdown.

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| storage | permissions | Needed to save meeting engagement metrics and participant statistics locally on your device between sessions. |
| sidePanel | permissions | Needed to display real-time meeting analytics, attendance charts, and the raised hands queue side-by-side with your active meeting. |
| tabs | permissions | Needed to detect the active Google Meet tab and open the analytics dashboard alongside the current session. |
| https://meet.google.com/* | host_permissions | Needed to observe participant presence, microphone mute/unmute state, and hand-raise indicators inside your Google Meet calls. |

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No

All data stays strictly within `chrome.storage.local` on the user's machine. No data is transmitted off-device or collected by remote servers.

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Distribution

**Visibility**: Public
**Regions**: All regions

## Developer Info

**Publisher Name** [REQUIRED]
NerdMeet Team

**Contact Email** [REQUIRED]
support@nerdmeet.local

**Homepage URL** [RECOMMENDED]
https://github.com/nerdmeet

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 2.0.0 | 2026-10-18 | Manifest V3 Chrome Extension release: Chrome Side Panel, talk-time duration tracking, FIFO hand raise queue, CSV/PDF export, draggable HUD, and privacy mode. | Draft |
