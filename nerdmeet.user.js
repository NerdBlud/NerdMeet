// ==UserScript==
// @name         NerdMeet tracker
// @namespace    https://github.com/nerdmeet
// @version      2.0.0
// @description  Tracks speaking talk-time duration, hand raises FIFO queue, camera duration, screen sharing, and live attendance in Google Meet.
// @match        https://meet.google.com/*
// @grant        none
// ==/UserScript==
(() => {
  'use strict';

  if (window.__NERDMEET_INJECTED__) return;
  window.__NERDMEET_INJECTED__ = true;

  const getMeetCode = () => {
    const match = location.pathname.match(/[a-z]{3}-[a-z]{4}-[a-z]{3}/i);
    return match ? match[0].toLowerCase() : null;
  };

  let code = getMeetCode();
  if (!code) {
    
    let lastUrl = location.href;
    const urlCheck = setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        code = getMeetCode();
        if (code) {
          clearInterval(urlCheck);
          initTracker();
        }
      }
    }, 1000);
    return;
  }

  initTracker();

  function initTracker() {
    const ext = typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null);
    const KEY = `nerdmeet:${code}`;
    const CHROME_KEY = `nerdmeet_${code}`;

    const loadData = () => {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) return JSON.parse(raw);
      } catch (e) {
        console.warn('[NerdMeet] Could not load localStorage:', e);
      }
      return null;
    };

    const data = loadData() || {
      meetCode: code,
      startedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      participants: {}
    };

    Object.keys(data.participants).forEach((name) => {
      const p = data.participants[name];
      p.totalStayMs = p.totalStayMs || 0;
      p.talkTimeMs = p.talkTimeMs || 0;
      p.cameraTimeMs = p.cameraTimeMs || 0;
      p.screenShareTimeMs = p.screenShareTimeMs || 0;
      p.handRaises = p.handRaises || 0;
      p.micOpens = p.micOpens || 0;
      p.cameraOpens = p.cameraOpens || 0;
      p.screenShares = p.screenShares || 0;
      p.chatMessages = p.chatMessages || 0;
      p.rejoins = p.rejoins || 0;
      p.isHandRaised = false;
      p.isUnmuted = false;
      p.isCameraOn = false;
      p.isPresenting = false;
      p.events = p.events || [];
    });

    const liveStates = {}; 
    const handFalsyCount = {};
    const seenChatIds = new Set();
    let isHudExpanded = localStorage.getItem('nerdmeet_hud_expanded') !== 'false';
    let hudTab = 'queue'; 
    let lastTickTime = performance.now();

    const SELECTORS = {
      tile: '[data-participant-id]',
      selfName: '[data-self-name]',
      fallbackName: '.notranslate, [data-name]',
      micAttr: '[data-is-muted]',
      micIcon: '[aria-label*="microphone" i], [aria-label*="mic" i]',
      hand: '[aria-label*="raised hand" i], [aria-label*="hand raised" i], [aria-label*="hand is raised" i], [aria-label*="raised a hand" i], [data-is-hand-raised="true"], [data-tooltip*="hand" i]',
      video: 'video',
      presenting: '[data-is-presenting="true"], [aria-label*="presentation" i], [aria-label*="presenting" i]',
      peopleItem: '[role="listitem"]',
      chatItem: '[data-message-id], [data-sender-name]',
      chatToast: '[role="status"], [aria-live="polite"]'
    };

    Object.keys(data.participants).forEach((name) => {
      if (!isValidParticipantName(name)) {
        delete data.participants[name];
      }
    });

    function isValidParticipantName(name) {
      if (!name || typeof name !== 'string') return false;
      const str = name.trim();
      if (str.length < 2 || str.length > 50) return false;
      const lower = str.toLowerCase();
      if (lower.includes('_')) return false;
      if (/[.?!:,;()\[\]{}<>/\\|~`@#$%^&*+=_\-]$/.test(str)) return false;
      if (/^[.?!:,;()\[\]{}<>/\\|~`@#$%^&*+=_\-]/.test(str)) return false;
      if (/^\d+([.:]\d+)?(\s*(am|pm|s|m|h|px|%))?$/i.test(lower)) return false;
      if (/\b\d{1,2}:\d{2}\b/.test(str)) return false;
      if (/^\d+$/.test(str)) return false;
      if (/https?:\/\/|\.com|\.org|\.net|\.io|@/i.test(lower)) return false;
      const words = str.split(/\s+/).filter(Boolean);
      if (words.length >= 5) return false;
      const genericSelf = new Set([
        'you', 'you (host)', 'you (presentation)', 'host', 'you (you)',
        'me', 'myself', 'anonymous', 'host controls', 'meeting host', 'co-host',
        'siz', 'vous', 'du', 'tú', 'yo'
      ]);
      if (genericSelf.has(lower)) return false;
      if (/\b(presentation|presenting|presenter|screenshare|screen share|shared screen|sharing screen|your presentation|you're presenting|you are presenting|stop presenting|stop sharing|present now|entire screen|a window|a tab|chrome tab|screen of|screen|sunum|ekran|présentation|écran|präsentation|bildschirm|pantalla)\b/i.test(lower)) return false;
      if (/\b(video|camera|microphone|mic|videocam|audio|sound|speaker|headphones|volume|mikrofon|ses)\b/i.test(lower)) return false;
      if (/\b(effects|background|backgrounds|framing|preview|tooltip|lighting|filters|fullscreen|full screen|layout|sidebar|spotlight|grid|tile|picture-in-picture|picture in picture|tam ekran)\b/i.test(lower)) return false;
      if (/\b(settings|options|fullscreen|activities|whiteboard|breakout|polls|q&a|chat|messages|in-call|recording|transcript|transcription|captions|subtitles|pin|unpin|ayarlar|sohbet|mesaj)\b/i.test(lower)) return false;
      if (/\b(turn on|turn off|mute|unmute|raise hand|lower hand|hand raise|el kaldır|eli indir)\b/i.test(lower)) return false;
      if (/\b(others might still see|see your full video|send a message|messages can be seen|waiting room|contributors|attendance|meeting details|quick access|safety|lock meeting|report abuse|troubleshooting)\b/i.test(lower)) return false;
      if (/\b(add people|add others|invite|share link|copy link|search for people|everyone else)\b/i.test(lower)) return false;
      if (/^(join|leave|turn|click|select|show|hide|stop|start|present|share|pin|unpin|mute|unmute|ask|view|open|close|switch|apply|change|remove|add|invite|search|send|leave|join|raise|lower|toggle|enable|disable|report|adjust|manage|configure|sabitle|sessize|ayarla|quitter)\b/i.test(lower)) return false;
      if (/^(more options for|participant actions for|options for|actions for|tile actions for|pin |unpin |mute |turn off |turn on )/i.test(lower)) return false;
      const blacklist = new Set([
        'you', 'pin', 'unpin', 'mute', 'unmute', 'more options', 'turn off', 'turn on',
        'person', 'people', 'groups', 'mic', 'videocam', 'camera', 'video', 'hand',
        'back_hand', 'pan_tool', 'settings', 'chat', 'info', 'activities', 'fullscreen',
        'call', 'presentation', 'presenting', 'more_vert', 'more_horiz', 'circle',
        'check', 'close', 'arrow_back', 'arrow_forward', 'keyboard', 'audio', 'speaker',
        'raised hand', 'participant', 'send a message', 'in-call messages', 'messages',
        'your presentation', 'meeting host', 'host controls', 'host', 'whiteboard',
        'polls', 'q&a', 'recording', 'breakout rooms', 'visual effects', 'device settings',
        'hd', 'sd', 'ld', '4k', 'fps', 'kbps', 'mbps', 'loss', 'packet', 'auto', 'none',
        'test', 'all', 'more', 'less', 'ok', 'cancel', 'save', 'edit', 'delete', 'remove',
        'meet', 'google', 'google meet', 'participant actions', 'tile actions',
        'more actions', 'turn off microphone', 'turn on microphone', 'turn off camera',
        'turn on camera', 'pin to screen', 'pin tile', 'unpin tile', 'pin yourself',
        'show in a tile', 'stop presenting', 'start presenting', 'present now',
        'add people', 'add others', 'mute all', 'search for people', 'everyone else',
        'waiting room', 'meeting safety', 'lock meeting', 'quick access', 'send message',
        'screen share', 'screenshare', 'shared screen', 'your screen', 'someone\'s screen',
        'stop sharing', 'change layout', 'full screen', 'exit full screen',
        'picture in picture', 'companion mode', 'report abuse', 'troubleshooting & help',
        'keep', 'keep_off', 'push_pin', 'volume_up', 'volume_off', 'volume_mute',
        'chat_bubble', 'forum', 'person_add', 'lock', 'lock_open', 'security', 'shield',
        'closed_caption', 'closed_caption_off', 'subtitles', 'subtitles_off',
        'cast', 'cast_connected', 'tam ekran', 'sessize al', 'sesi aç', 'kamerayı aç',
        'kamerayı kapat', 'el kaldır', 'eli indir', 'sohbet', 'katılımcılar', 'ayarlar'
      ]);
      if (blacklist.has(lower)) return false;
      if (!/\p{L}/u.test(str)) return false;
      return true;
    }

    function isGarbageOrIcon(s) {
      return !isValidParticipantName(s);
    }

    function cleanName(raw) {
      if (!raw || typeof raw !== 'string') return null;
      let str = raw.trim();
      str = str.replace(/^(?:participant|video of|feed of|tile of|actions for|options for|more options for)\s*[:\-–]?\s*/i, '');
      str = str.replace(/^(?:Presentation\s*[:\-–]\s*|Presentation\s+of\s+|Screen\s+of\s+|Screen\s*[:\-–]\s*|Screen\s+share\s+of\s+|Sunum\s*[:\-–]\s*)/i, '');
      str = str.replace(/^(?:Meeting\s+host\s*[:\-–]?\s*)/i, '');
      str = str.replace(/\s*\((?:You|Presentation|Guest|External|Host|Co-host|Attendee|Viewer|Screen|Sunum|Ekran)\)\s*$/i, '');
      str = str.replace(/\s*[:\-–]\s*(?:Presentation|Screen|Screen\s+share|Sunum)$/i, '');
      str = str.replace(/'s\s+(?:presentation|screen|shared\s+screen|window|tab)$/i, '');
      str = str.replace(/\s+is\s+(?:presenting|sharing(?:\s+screen)?)$/i, '');
      str = str.trim();
      if (!isValidParticipantName(str)) return null;
      return str;
    }

    function extractPresenterNameFromString(text) {
      if (!text || typeof text !== 'string') return null;
      let s = text.trim();
      s = s.replace(/^(?:video feed of|feed of|tile of|video of)\s*/i, '');

      const mParen = s.match(/^(?:presentation|screen|screen\s+share|sunum)\s*\(([^)]+)\)$/i);
      if (mParen && mParen[1]) {
        const c = cleanName(mParen[1]);
        if (c && isValidParticipantName(c)) return c;
      }

      const mOf = s.match(/^(?:presentation|screen|screen\s+share)\s+of\s+(.+)$/i);
      if (mOf && mOf[1]) {
        const c = cleanName(mOf[1]);
        if (c && isValidParticipantName(c)) return c;
      }

      const mCol = s.match(/^(?:presentation|screen|screen\s+share)\s*[:\-–]\s*(.+)$/i);
      if (mCol && mCol[1]) {
        const c = cleanName(mCol[1]);
        if (c && isValidParticipantName(c)) return c;
      }

      const mPoss = s.match(/^(.+?)'s\s+(?:presentation|screen|shared\s+screen|window|tab)$/i);
      if (mPoss && mPoss[1]) {
        const c = cleanName(mPoss[1]);
        if (c && isValidParticipantName(c)) return c;
      }

      const mPres = s.match(/^(.+?)\s+is\s+(?:presenting|sharing(?:\s+screen)?)$/i);
      if (mPres && mPres[1]) {
        const c = cleanName(mPres[1]);
        if (c && isValidParticipantName(c)) return c;
      }

      const cleaned = cleanName(s);
      if (cleaned && isValidParticipantName(cleaned)) return cleaned;
      return null;
    }

    function isPresentationTile(tile) {
      if (!tile) return false;
      if (tile.getAttribute('data-is-presenting') === 'true') return true;
      if (tile.getAttribute('data-is-presentation') === 'true') return true;
      if (tile.querySelector('[data-is-presenting="true"], [data-is-presentation="true"]')) return true;

      const partId = (tile.getAttribute('data-participant-id') || '').toLowerCase();
      if (partId.includes('presentation') || partId.includes('screenshare')) return true;

      const reqId = (tile.getAttribute('data-requested-participant-id') || '').toLowerCase();
      if (reqId.includes('presentation') || reqId.includes('screenshare')) return true;

      const label = (tile.getAttribute('aria-label') || '').toLowerCase();
      if (/\b(presentation|presenting|screenshare|screen share|shared screen|sharing screen|your presentation|stop presenting|stop sharing|your screen|someone's screen|sunum|ekran|présentation|écran|präsentation|pantalla)\b/i.test(label)) return true;
      if (/'s\s+(?:presentation|screen|shared\s+screen|window|tab)/i.test(label)) return true;

      const text = (tile.textContent || '').toLowerCase();
      if (/\b(stop presenting|you're presenting|you are presenting|your presentation|stop sharing|shared screen|screen share|sharing screen)\b/i.test(text)) return true;
      if (/'s\s+(?:presentation|screen|shared\s+screen)/i.test(text)) return true;

      const icons = tile.querySelectorAll('i, span, svg');
      for (const icon of icons) {
        const t = (icon.textContent || '').trim().toLowerCase();
        if (t === 'screen_share' || t === 'stop_screen_share' || t === 'present_to_all' || t === 'cancel_presentation') {
          return true;
        }
      }

      return false;
    }

    function getPresenterName(tile, selfName) {
      if (!tile) return null;
      const text = (tile.textContent || '').toLowerCase();
      const label = (tile.getAttribute('aria-label') || '').toLowerCase();
      if (text.includes("you're presenting") || text.includes('your presentation') || text.includes('you are presenting') || text.includes('(you)') || label.includes('(you)')) {
        return selfName;
      }
      const directEl = tile.querySelector('.notranslate, [data-name], div[class*="name" i], span[class*="name" i]');
      if (directEl && !directEl.closest('button, [role="button"], i, svg')) {
        const n = extractPresenterNameFromString(directEl.textContent);
        if (n && isValidParticipantName(n)) return n;
      }
      if (label) {
        const n = extractPresenterNameFromString(label);
        if (n && isValidParticipantName(n)) return n;
      }
      return null;
    }

    function migrateSelfParticipant(realName) {
      if (!realName || !isValidParticipantName(realName)) return;
      const aliases = ['You', 'You (Host)', 'You (You)', 'You (Presentation)', 'Host', 'Me'];
      aliases.forEach((alias) => {
        if (data.participants[alias] && alias.toLowerCase() !== realName.toLowerCase()) {
          const old = data.participants[alias];
          const target = getParticipant(realName);
          target.totalStayMs = Math.max(target.totalStayMs || 0, old.totalStayMs || 0);
          target.talkTimeMs = Math.max(target.talkTimeMs || 0, old.talkTimeMs || 0);
          target.cameraTimeMs = Math.max(target.cameraTimeMs || 0, old.cameraTimeMs || 0);
          target.screenShareTimeMs = Math.max(target.screenShareTimeMs || 0, old.screenShareTimeMs || 0);
          target.handRaises = Math.max(target.handRaises || 0, old.handRaises || 0);
          target.micOpens = Math.max(target.micOpens || 0, old.micOpens || 0);
          target.cameraOpens = Math.max(target.cameraOpens || 0, old.cameraOpens || 0);
          target.chatMessages = (target.chatMessages || 0) + (old.chatMessages || 0);
          if (old.isHandRaised) { target.isHandRaised = true; target.handRaisedAt = old.handRaisedAt; }
          delete data.participants[alias];
        }
      });
    }

    let cachedSelfName = null;
    function getSelfName() {
      if (cachedSelfName && isValidParticipantName(cachedSelfName)) return cachedSelfName;

      const allNotranslate = document.querySelectorAll('.notranslate');
      for (const el of allNotranslate) {
        const parent = el.closest('[role="listitem"], [data-participant-id]');
        if (parent && (parent.textContent || '').includes('(You)')) {
          const n = cleanName(el.textContent);
          if (n && isValidParticipantName(n) && !['you', 'you (host)'].includes(n.toLowerCase())) {
            cachedSelfName = n;
            migrateSelfParticipant(n);
            return n;
          }
        }
      }

      const accountBtns = document.querySelectorAll('button[aria-label*="Google" i], a[aria-label*="Google" i], [title*="Google Account" i], [aria-label*="@" i]');
      for (const btn of accountBtns) {
        const textToSearch = btn.getAttribute('aria-label') || btn.getAttribute('title') || '';
        if (textToSearch.toLowerCase().includes('google meet')) continue;

        const emailMatch = textToSearch.match(/([^\n\r(]+?)(?:\s*\(|\s*\n|\s*-\s*|\s*:\s*)[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+/i);
        if (emailMatch && emailMatch[1]) {
          const candidate = emailMatch[1].replace(/Google\s*(?:Account|Konto|Compte|Hesabı)?\s*[:\-–]?/i, '').trim();
          const n = cleanName(candidate);
          if (n && isValidParticipantName(n)) {
            cachedSelfName = n;
            migrateSelfParticipant(n);
            return n;
          }
        }

        const m = textToSearch.match(/Google\s*(?:Account|Konto|Compte|Hesabı)\s*[:\-–]\s*([^(\n\r]+)/i);
        if (m && m[1]) {
          const n = cleanName(m[1]);
          if (n && isValidParticipantName(n)) {
            cachedSelfName = n;
            migrateSelfParticipant(n);
            return n;
          }
        }
      }

      const selfEl = document.querySelector('[data-self-name]');
      if (selfEl) {
        const val = cleanName(selfEl.getAttribute('data-self-name'));
        if (val && isValidParticipantName(val)) {
          cachedSelfName = val;
          migrateSelfParticipant(val);
          return val;
        }
      }

      for (const tile of document.querySelectorAll('[data-participant-id]')) {
        if (isPresentationTile(tile) || !tile.querySelector('button[aria-label="Reframe" i], [role="button"][aria-label="Reframe" i]')) continue;
        const name = getNameFromTile(tile, null);
        if (name && isValidParticipantName(name)) {
          cachedSelfName = name;
          migrateSelfParticipant(name);
          return name;
        }
      }

      const allTileEls = document.querySelectorAll('[data-participant-id], [data-allocation-index]');
      for (const t of allTileEls) {
        const text = t.textContent || '';
        if (text.includes('(You)')) {
          const directEl = t.querySelector('.notranslate, [data-name], div[class*="name" i], span[class*="name" i]');
          const cand = directEl?.textContent || text;
          const n = cleanName(cand);
          if (n && isValidParticipantName(n) && !['you', 'you (host)'].includes(n.toLowerCase())) {
            cachedSelfName = n;
            migrateSelfParticipant(n);
            return n;
          }
        }
      }

      return null;
    }

    function controlLabel(button) {
      const refs = ['aria-labelledby', 'aria-describedby', 'data-tooltip-id']
        .flatMap(attr => (button.getAttribute(attr) || '').split(/\s+/))
        .filter(Boolean).map(id => document.getElementById(id)?.textContent || '');
      return [button.getAttribute('aria-label'), button.getAttribute('data-tooltip'),
        button.title, ...refs].filter(Boolean).join(' ').toLowerCase();
    }

    function readLocalToggle(kind) {
      for (const button of document.querySelectorAll('button, [role="button"]')) {
        if (button.closest('[data-participant-id], [role="listitem"], #nerdmeet-hud-root')) continue;
        const label = controlLabel(button);
        if (/settings|options|troubleshoot|more|audio devices/.test(label)) continue;
        const icons = Array.from(button.querySelectorAll('i, span'))
          .map(el => el.textContent.trim().toLowerCase());
        if (kind === 'mic') {
          if (!/microphone|\bmic\b|ctrl\s*\+\s*d/.test(label) &&
              !icons.some(icon => icon === 'mic' || icon === 'mic_off')) continue;
          const muted = button.getAttribute('data-is-muted');
          if (muted !== null) return muted === 'false';
          if (/turn on|unmute|microphone (?:is )?off/.test(label)) return false;
          if (/turn off|\bmute\b|microphone (?:is )?on/.test(label)) return true;
          if (icons.includes('mic_off')) return false;
          if (icons.includes('mic')) return true;
        } else {
          if (!/hand/.test(label) && !icons.some(icon => /^(back_hand|pan_tool|front_hand)$/.test(icon))) continue;
          const pressed = button.getAttribute('aria-pressed');
          if (pressed !== null) return pressed === 'true';
          const raised = button.getAttribute('data-is-hand-raised');
          if (raised !== null) return raised === 'true';
          if (/lower (?:your )?hand/.test(label)) return true;
          if (/raise (?:your )?hand/.test(label)) return false;
        }
      }
      return null;
    }

    function getSelfControlStates() {
      let isCameraOn = false;
      const camShortcutBtn = document.querySelector(
        'button[aria-label*="ctrl + e" i], [role="button"][aria-label*="ctrl + e" i], ' +
        'button[aria-label*="ctrl+e" i], [role="button"][aria-label*="ctrl+e" i], ' +
        'button[data-tooltip*="ctrl + e" i], [role="button"][data-tooltip*="ctrl + e" i], ' +
        'button[data-tooltip*="ctrl+e" i], [role="button"][data-tooltip*="ctrl+e" i], ' +
        'button[aria-label*="⌘ + e" i], [role="button"][aria-label*="⌘ + e" i], ' +
        'button[aria-label*="⌘+e" i], [role="button"][aria-label*="⌘+e" i]'
      );
      if (camShortcutBtn) {
        const mutedAttr = camShortcutBtn.getAttribute('data-is-muted') || camShortcutBtn.closest('[data-is-muted]')?.getAttribute('data-is-muted');
        if (mutedAttr === 'false') {
          isCameraOn = true;
        } else if (mutedAttr === 'true') {
          isCameraOn = false;
        } else {
          const label = (camShortcutBtn.getAttribute('aria-label') || camShortcutBtn.getAttribute('data-tooltip') || camShortcutBtn.title || '').toLowerCase();
          if (/\b(turn off camera|turn off video|kamerayı kapat|desactivar cámara|cam off)\b/i.test(label)) {
            isCameraOn = true;
          } else if (/\b(turn on camera|turn on video|kamerayı aç|activar cámara|cam on)\b/i.test(label)) {
            isCameraOn = false;
          } else {
            const iconText = (camShortcutBtn.textContent || '').trim().toLowerCase();
            if (iconText.includes('videocam_off')) isCameraOn = false;
            else if (iconText.includes('videocam')) isCameraOn = true;
          }
        }
      } else {
        const camDirectOn = document.querySelector('button[aria-label*="turn off camera" i], [role="button"][aria-label*="turn off camera" i], button[aria-label*="turn off video" i], [role="button"][aria-label*="turn off video" i], button[aria-label*="kamerayı kapat" i], [role="button"][aria-label*="kamerayı kapat" i], [data-is-muted="false"][aria-label*="camera" i], [data-is-muted="false"][aria-label*="video" i]');
        const camDirectOff = document.querySelector('button[aria-label*="turn on camera" i], [role="button"][aria-label*="turn on camera" i], button[aria-label*="turn on video" i], [role="button"][aria-label*="turn on video" i], button[aria-label*="kamerayı aç" i], [role="button"][aria-label*="kamerayı aç" i], [data-is-muted="true"][aria-label*="camera" i], [data-is-muted="true"][aria-label*="video" i]');
        if (camDirectOn) {
          isCameraOn = true;
        } else if (camDirectOff) {
          isCameraOn = false;
        } else {
          const camCandidates = document.querySelectorAll('button[aria-label*="camera" i], button[aria-label*="video" i], [role="button"][aria-label*="camera" i], [role="button"][aria-label*="video" i]');
          for (const btn of camCandidates) {
            const l = (btn.getAttribute('aria-label') || btn.getAttribute('data-tooltip') || btn.title || '').toLowerCase();
            if (l.includes('setting') || l.includes('option') || l.includes('chevron') || l.includes('arrow') || l.includes('device') || l.includes('more') || l.includes('effect')) continue;
            const mutedAttr = btn.getAttribute('data-is-muted') || btn.closest('[data-is-muted]')?.getAttribute('data-is-muted');
            if (mutedAttr === 'false') { isCameraOn = true; break; }
            if (mutedAttr === 'true') { isCameraOn = false; break; }
            const iconText = (btn.textContent || '').trim().toLowerCase();
            if (iconText.includes('videocam_off')) { isCameraOn = false; break; }
            if (iconText.includes('videocam')) { isCameraOn = true; break; }
          }
        }
      }

      if (!isCameraOn) {
        const allTileEls = document.querySelectorAll('[data-participant-id], [data-allocation-index]');
        for (const t of allTileEls) {
          if (isPresentationTile(t)) continue;
          const text = t.textContent || '';
          const aria = t.getAttribute('aria-label') || '';
          if (text.includes('(You)') || aria.includes('(You)')) {
            const v = t.querySelector('video');
            if (v && v.readyState >= 1 && !v.paused && v.style.display !== 'none') {
              const rect = v.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) isCameraOn = true;
            }
          }
        }
      }

      let isUnmuted = false;
      const micShortcutBtn = document.querySelector(
        'button[aria-label*="ctrl + d" i], [role="button"][aria-label*="ctrl + d" i], ' +
        'button[aria-label*="ctrl+d" i], [role="button"][aria-label*="ctrl+d" i], ' +
        'button[data-tooltip*="ctrl + d" i], [role="button"][data-tooltip*="ctrl + d" i], ' +
        'button[data-tooltip*="ctrl+d" i], [role="button"][data-tooltip*="ctrl+d" i], ' +
        'button[aria-label*="⌘ + d" i], [role="button"][aria-label*="⌘ + d" i], ' +
        'button[aria-label*="⌘+d" i], [role="button"][aria-label*="⌘+d" i]'
      );

      if (micShortcutBtn) {
        const mutedAttr = micShortcutBtn.getAttribute('data-is-muted') || micShortcutBtn.closest('[data-is-muted]')?.getAttribute('data-is-muted');
        if (mutedAttr === 'false') {
          isUnmuted = true;
        } else if (mutedAttr === 'true') {
          isUnmuted = false;
        } else {
          const label = (micShortcutBtn.getAttribute('aria-label') || micShortcutBtn.getAttribute('data-tooltip') || micShortcutBtn.title || '').toLowerCase();
          if (/\b(turn off mic|turn off microphone|sessize al|couper le micro|stumm schalten|выключить микрофон|desactivar mic|mute)\b/i.test(label)) {
            isUnmuted = true;
          } else if (/\b(turn on mic|turn on microphone|sesi aç|activer le micro|ton einschalten|включить микрофон|activar mic|unmute)\b/i.test(label)) {
            isUnmuted = false;
          } else {
            const iconText = (micShortcutBtn.textContent || '').trim().toLowerCase();
            if (iconText.includes('mic_off')) {
              isUnmuted = false;
            } else if (iconText.includes('mic')) {
              isUnmuted = true;
            } else {
              try {
                const bg = window.getComputedStyle(micShortcutBtn).backgroundColor;
                if (bg && (bg.includes('234, 67, 53') || bg.includes('242, 139, 130') || bg.includes('217, 48, 37'))) {
                  isUnmuted = false;
                } else {
                  isUnmuted = true;
                }
              } catch (e) {
                isUnmuted = false;
              }
            }
          }
        }
      } else {
        const micDirectOn = document.querySelector(
          'button[aria-label*="turn off microphone" i], [role="button"][aria-label*="turn off microphone" i], ' +
          'button[aria-label*="turn off mic" i], [role="button"][aria-label*="turn off mic" i], ' +
          'button[aria-label*="sessize al" i], [role="button"][aria-label*="sessize al" i], ' +
          '[data-is-muted="false"][aria-label*="mic" i], [data-is-muted="false"][aria-label*="microphone" i]'
        );
        const micDirectOff = document.querySelector(
          'button[aria-label*="turn on microphone" i], [role="button"][aria-label*="turn on microphone" i], ' +
          'button[aria-label*="turn on mic" i], [role="button"][aria-label*="turn on mic" i], ' +
          'button[aria-label*="sesi aç" i], [role="button"][aria-label*="sesi aç" i], ' +
          '[data-is-muted="true"][aria-label*="mic" i], [data-is-muted="true"][aria-label*="microphone" i]'
        );

        if (micDirectOn) {
          isUnmuted = true;
        } else if (micDirectOff) {
          isUnmuted = false;
        } else {
          const micCandidates = document.querySelectorAll('button[aria-label*="mic" i], button[aria-label*="microphone" i], [role="button"][aria-label*="mic" i], [role="button"][aria-label*="microphone" i]');
          for (const btn of micCandidates) {
            const label = (btn.getAttribute('aria-label') || btn.getAttribute('data-tooltip') || btn.title || '').toLowerCase();
            if (label.includes('setting') || label.includes('option') || label.includes('chevron') || label.includes('arrow') || label.includes('device') || label.includes('more')) {
              continue;
            }
            const mutedAttr = btn.getAttribute('data-is-muted') || btn.closest('[data-is-muted]')?.getAttribute('data-is-muted');
            if (mutedAttr === 'false') { isUnmuted = true; break; }
            if (mutedAttr === 'true') { isUnmuted = false; break; }
            if (/\b(turn off mic|turn off microphone|sessize al|couper le micro|stumm schalten|выключить микрофон|desactivar mic)\b/i.test(label)) {
              isUnmuted = true;
              break;
            }
            if (/\b(turn on mic|turn on microphone|sesi aç|activer le micro|ton einschalten|включить микрофон|activar mic)\b/i.test(label)) {
              isUnmuted = false;
              break;
            }
            const iconText = (btn.textContent || '').trim().toLowerCase();
            if (iconText.includes('mic_off')) { isUnmuted = false; break; }
            if (iconText.includes('mic')) { isUnmuted = true; break; }
          }
        }
      }

      let isHandRaised = false;
      const handShortcutBtn = document.querySelector(
        'button[aria-label*="ctrl + alt + h" i], [role="button"][aria-label*="ctrl + alt + h" i], ' +
        'button[aria-label*="ctrl+alt+h" i], [role="button"][aria-label*="ctrl+alt+h" i], ' +
        'button[data-tooltip*="ctrl + alt + h" i], [role="button"][data-tooltip*="ctrl + alt + h" i], ' +
        'button[data-tooltip*="ctrl+alt+h" i], [role="button"][data-tooltip*="ctrl+alt+h" i], ' +
        'button[aria-label*="⌥" i][aria-label*="h" i], [role="button"][aria-label*="⌥" i][aria-label*="h" i]'
      );

      if (handShortcutBtn) {
        const pressed = handShortcutBtn.getAttribute('aria-pressed');
        const raisedAttr = handShortcutBtn.getAttribute('data-is-hand-raised');
        const label = (handShortcutBtn.getAttribute('aria-label') || handShortcutBtn.getAttribute('data-tooltip') || handShortcutBtn.title || '').toLowerCase();
        if (pressed === 'true' || raisedAttr === 'true') {
          isHandRaised = true;
        } else if (label.includes('lower hand') || label.includes('eli indir') || label.includes('bajar la mano') || label.includes('baisser la main') || label.includes('senken') || label.includes('опустить руку')) {
          isHandRaised = true;
        } else {
          try {
            const bg = window.getComputedStyle(handShortcutBtn).backgroundColor;
            if (bg && (bg.includes('138, 180, 248') || bg.includes('168, 199, 250') || bg.includes('26, 115, 232') || bg.includes('232, 240, 254'))) {
              isHandRaised = true;
            }
          } catch (e) {}
        }
      }

      if (!isHandRaised) {
        const directRaised = document.querySelector(
          'button[aria-label*="lower hand" i], [role="button"][aria-label*="lower hand" i], ' +
          'button[aria-label*="eli indir" i], [role="button"][aria-label*="eli indir" i], ' +
          'button[aria-label*="baisser la main" i], [role="button"][aria-label*="baisser la main" i], ' +
          'button[aria-label*="bajar la mano" i], [role="button"][aria-label*="bajar la mano" i], ' +
          'button[aria-label*="senken" i], [role="button"][aria-label*="senken" i], ' +
          'button[aria-label*="опустить руку" i], [role="button"][aria-label*="опустить руку" i], ' +
          'button[aria-label*="hand" i][aria-pressed="true"], [role="button"][aria-label*="hand" i][aria-pressed="true"], ' +
          '[data-is-hand-raised="true"], ' +
          'button[data-tooltip*="lower hand" i], [role="button"][data-tooltip*="lower hand" i]'
        );
        if (directRaised) {
          isHandRaised = true;
        }
      }

      if (!isHandRaised) {
        const handBtns = document.querySelectorAll('button[aria-label*="hand" i], [role="button"][aria-label*="hand" i], button[data-is-hand-raised], [role="button"][data-is-hand-raised]');
        for (const btn of handBtns) {
          const label = (btn.getAttribute('aria-label') || btn.getAttribute('data-tooltip') || btn.title || '').toLowerCase();
          if (label.includes('setting') || label.includes('option') || label.includes('more')) continue;
          if (btn.getAttribute('aria-pressed') === 'true' || btn.getAttribute('data-is-hand-raised') === 'true') {
            isHandRaised = true;
            break;
          }
          if (label.includes('lower hand') || label.includes('eli indir') || label.includes('bajar la mano') || label.includes('baisser la main') || label.includes('senken') || label.includes('опустить руку')) {
            isHandRaised = true;
            break;
          }
          try {
            const bg = window.getComputedStyle(btn).backgroundColor;
            if (bg && (bg.includes('138, 180, 248') || bg.includes('168, 199, 250') || bg.includes('26, 115, 232') || bg.includes('232, 240, 254'))) {
              isHandRaised = true;
              break;
            }
          } catch (e) {}
        }
      }

      if (!isHandRaised) {
        const allBtns = document.querySelectorAll('button, [role="button"]');
        for (const b of allBtns) {
          const t = (b.textContent || '').trim();
          if (t.includes('back_hand') || t.includes('pan_tool')) {
            const l = (b.getAttribute('aria-label') || b.getAttribute('data-tooltip') || b.title || '').toLowerCase();
            if (l.includes('setting') || l.includes('more')) continue;
            if (b.getAttribute('aria-pressed') === 'true' || b.getAttribute('data-is-hand-raised') === 'true' || l.includes('lower hand') || l.includes('eli indir')) {
              isHandRaised = true;
              break;
            }
            try {
              const bg = window.getComputedStyle(b).backgroundColor;
              if (bg && (bg.includes('138, 180, 248') || bg.includes('168, 199, 250') || bg.includes('26, 115, 232') || bg.includes('232, 240, 254'))) {
                isHandRaised = true;
                break;
              }
            } catch (e) {}
          }
        }
      }

      let isScreenSharing = false;
      const presDirectOn = document.querySelector('button[aria-label*="stop presenting" i], [role="button"][aria-label*="stop presenting" i], button[aria-label*="stop sharing" i], [role="button"][aria-label*="stop sharing" i], button[aria-label*="sunumu durdur" i], [role="button"][aria-label*="sunumu durdur" i], [data-is-presenting="true"]');
      if (presDirectOn) {
        isScreenSharing = true;
      } else {
        const presBtn = document.querySelector('button[aria-label*="present" i], button[aria-label*="share" i], [role="button"][aria-label*="present" i], [role="button"][aria-label*="share" i]');
        if (presBtn) {
          const presLabel = (presBtn.getAttribute('aria-label') || presBtn.getAttribute('data-tooltip') || presBtn.title || '').toLowerCase();
          if (presLabel.includes('stop presenting') || presLabel.includes('stop sharing') || presLabel.includes('you are presenting') || presLabel.includes('sunumu durdur')) {
            isScreenSharing = true;
          } else if (presBtn.getAttribute('aria-pressed') === 'true') {
            isScreenSharing = true;
          }
        }
      }

      isUnmuted = readLocalToggle('mic') ?? isUnmuted;
      isHandRaised = readLocalToggle('hand') ?? isHandRaised;
      return { isUnmuted, isCameraOn, isHandRaised, isScreenSharing };
    }

    function getParticipantTiles() {
      const candidates = document.querySelectorAll('[data-participant-id], [data-allocation-index], [data-requested-participant-id]');
      const tiles = [];
      const seen = new Set();

      for (const el of candidates) {
        if (!el || !(el instanceof HTMLElement)) continue;

        if (el.matches('button, [role="button"], a, input, select, textarea, [role="menuitem"], [role="tab"], [role="tooltip"], [role="dialog"], [role="status"], [role="alert"], [role="toolbar"], nav, header, footer')) {
          continue;
        }

        if (el.closest('button, [role="button"], [role="toolbar"], [role="navigation"], [role="tabpanel"], nav, header, [role="menu"], [role="tooltip"], div[aria-label*="People" i], div[aria-label*="Chat" i], div[aria-label*="Messages" i]')) {
          continue;
        }

        let parent = el.parentElement;
        let isNested = false;
        while (parent && parent !== document.body) {
          if (parent.hasAttribute('data-participant-id') || parent.hasAttribute('data-allocation-index') || parent.hasAttribute('data-requested-participant-id')) {
            isNested = true;
            break;
          }
          parent = parent.parentElement;
        }
        if (isNested) continue;

        if (!seen.has(el)) {
          seen.add(el);
          tiles.push(el);
        }
      }

      return tiles;
    }

    function getNameFromTile(tile, selfName) {
      if (!tile || isPresentationTile(tile)) return null;
      if (tile.matches('button, [role="button"], a, input, select, textarea, [role="menuitem"], [role="tooltip"]')) return null;

      const selfAttr = tile.getAttribute('data-self-name');
      if (selfAttr) {
        const n = cleanName(selfAttr);
        if (n && isValidParticipantName(n)) return n;
      }

      const innerSelf = tile.querySelector('[data-self-name]');
      if (innerSelf) {
        const n = cleanName(innerSelf.getAttribute('data-self-name') || innerSelf.textContent);
        if (n && isValidParticipantName(n)) return n;
      }

      const tileText = tile.textContent || '';
      if (tileText.includes('(You)') || (tile.getAttribute('aria-label') || '').toLowerCase().includes('(you)')) {
        if (selfName) return selfName;
      }

      const directNameEls = tile.querySelectorAll('.notranslate, [data-name], div[class*="name" i], span[class*="name" i]');
      for (const el of directNameEls) {
        if (el.matches('button, [role="button"], a, i, svg, path, input, textarea')) continue;
        if (el.closest('button, [role="button"], a, i, svg, [aria-hidden="true"], [role="menu"], [role="tooltip"]')) continue;
        const cls = typeof el.className === 'string' ? el.className.toLowerCase() : '';
        if (cls.includes('material-icons') || cls.includes('google-symbols') || cls.includes('google-material-icons')) continue;
        const text = el.textContent?.trim();
        if (text) {
          const cleaned = cleanName(text);
          if (cleaned && isValidParticipantName(cleaned)) return cleaned;
        }
      }

      const label = tile.getAttribute('aria-label');
      if (label) {
        const cleaned = cleanName(label);
        if (cleaned && isValidParticipantName(cleaned)) return cleaned;
      }

      return null;
    }

    function isMicUnmuted(tile) {
      if (!tile || isPresentationTile(tile)) return false;
      const micEl = tile.querySelector(SELECTORS.micAttr);
      if (micEl) {
        const val = micEl.getAttribute('data-is-muted');
        if (val === 'false') return true;
        if (val === 'true') return false;
      }
      const icon = tile.querySelector(SELECTORS.micIcon);
      if (icon) {
        const label = (icon.getAttribute('aria-label') || icon.getAttribute('data-tooltip') || '').toLowerCase();
        if (label.includes('unmuted') || label.includes('mic on') || label.includes('microphone is on')) return true;
        if (label.includes('muted') || label.includes('mic off') || label.includes('microphone is off')) return false;
      }
      const icons = tile.querySelectorAll('i, span, svg');
      let foundOff = false;
      let foundOn = false;
      for (const ic of icons) {
        const t = (ic.textContent || '').trim().toLowerCase();
        if (t === 'mic_off') foundOff = true;
        if (t === 'mic') foundOn = true;
      }
      if (foundOff) return false;
      if (foundOn) return true;

      const speakingIndicator = tile.querySelector('[data-is-speaking="true"], [class*="speaking" i]');
      return !!speakingIndicator;
    }

    function isCameraActive(tile) {
      if (!tile || isPresentationTile(tile)) return false;
      const v = tile.querySelector(SELECTORS.video);
      if (v && v.readyState >= 1 && !v.paused && v.style.display !== 'none') {
        const rect = v.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }
      return false;
    }

    function isHandUp(tile) {
      if (!tile || isPresentationTile(tile)) return false;
      if (tile.getAttribute('data-is-hand-raised') === 'true') return true;

      const badges = tile.querySelectorAll(SELECTORS.hand);
      for (const b of badges) {
        const l = (b.getAttribute('aria-label') || b.getAttribute('data-tooltip') || '').toLowerCase();
        if (l.includes('setting') || l.includes('option') || l.includes('more')) continue;
        return true;
      }

      const icons = tile.querySelectorAll('i, span, svg');
      for (const icon of icons) {
        const t = (icon.textContent || '').trim().toLowerCase();
        if (t === 'back_hand' || t === 'pan_tool' || t === 'front_hand') {
          return true;
        }
      }

      const anyHand = tile.querySelector('[aria-label*="hand" i], [data-tooltip*="hand" i], [title*="hand" i]');
      if (anyHand) {
        const l = (anyHand.getAttribute('aria-label') || anyHand.getAttribute('data-tooltip') || anyHand.title || '').toLowerCase();
        if (!l.includes('setting') && !l.includes('more')) {
          return true;
        }
      }

      return false;
    }

    function isScreenSharing(tile) {
      if (!tile) return false;
      if (isPresentationTile(tile)) return true;
      if (tile.matches(SELECTORS.presenting) || tile.querySelector(SELECTORS.presenting)) return true;
      const label = (tile.getAttribute('aria-label') || '').toLowerCase();
      return label.includes('presentation') || label.includes('presenting');
    }

    function getParticipant(name) {
      if (!data.participants[name]) {
        data.participants[name] = {
          firstSeen: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
          totalStayMs: 0,
          rejoins: 0,
          micOpens: 0,
          talkTimeMs: 0,
          isUnmuted: false,
          cameraOpens: 0,
          cameraTimeMs: 0,
          isCameraOn: false,
          handRaises: 0,
          isHandRaised: false,
          handRaisedAt: null,
          screenShares: 0,
          screenShareTimeMs: 0,
          isPresenting: false,
          chatMessages: 0,
          events: []
        };
      }
      return data.participants[name];
    }

    function logEvent(name, type, details = {}) {
      const p = getParticipant(name);
      p.events.push({
        type,
        at: new Date().toISOString(),
        ...details
      });
    }

    function persistData() {
      data.lastUpdated = new Date().toISOString();
      try {
        localStorage.setItem(KEY, JSON.stringify(data));
      } catch (e) {
        
      }

      if (ext?.storage?.local) {
        ext.storage.local.set({
          [CHROME_KEY]: data,
          nerdmeet_latest_meet: code,
          nerdmeet_last_updated: Date.now()
        }).catch(() => {});
      }

      const activeCount = Object.values(data.participants).filter((p) => p.isOnline).length;
      const raisedCount = Object.values(data.participants).filter((p) => p.isHandRaised).length;
      if (ext?.runtime?.sendMessage) {
        ext.runtime.sendMessage({
          type: 'UPDATE_BADGE',
          text: raisedCount > 0 ? `${raisedCount}✋` : (activeCount > 0 ? String(activeCount) : ''),
          color: raisedCount > 0 ? '#B3402A' : '#E5A50A'
        }).catch(() => {});
      }
    }

    function applyParticipantLiveState(name, currentHand, currentMic, currentCam, currentPres, deltaMs, isSelf) {
      const p = getParticipant(name);
      p.isOnline = true;
      p.totalStayMs = (p.totalStayMs || 0) + deltaMs;
      p.lastSeen = new Date().toISOString();

      const state = liveStates[name] || {
        hand: false,
        mic: false,
        cam: false,
        pres: false,
        online: false
      };

      if (currentHand) {
        handFalsyCount[name] = 0;
        if (!state.hand) {
          const now = Date.now();
          if (!p.lastLoweredAt || (now - p.lastLoweredAt > 2500)) {
            p.handRaises = (p.handRaises || 0) + 1;
            p.handRaisedAt = now;
            logEvent(name, 'hand_raised');
          } else {
            if (!p.handRaisedAt) p.handRaisedAt = p.lastRaisedAt || now;
          }
          p.isHandRaised = true;
          p.lastRaisedAt = p.handRaisedAt;
        }
      } else if (state.hand) {
        handFalsyCount[name] = (handFalsyCount[name] || 0) + 1;
        if (handFalsyCount[name] >= 2) {
          p.isHandRaised = false;
          p.lastLoweredAt = Date.now();
          p.handRaisedAt = null;
          logEvent(name, 'hand_lowered');
        }
      }

      if (currentMic && !state.mic) {
        p.micOpens = (p.micOpens || 0) + 1;
        p.isUnmuted = true;
        logEvent(name, 'mic_unmuted');
      } else if (!currentMic && state.mic) {
        p.isUnmuted = false;
        logEvent(name, 'mic_muted');
      }
      if (currentMic) {
        p.talkTimeMs = (p.talkTimeMs || 0) + deltaMs;
      }

      if (currentCam && !state.cam) {
        p.cameraOpens = (p.cameraOpens || 0) + 1;
        p.isCameraOn = true;
        logEvent(name, 'camera_on');
      } else if (!currentCam && state.cam) {
        p.isCameraOn = false;
        logEvent(name, 'camera_off');
      }
      if (currentCam) {
        p.cameraTimeMs = (p.cameraTimeMs || 0) + deltaMs;
      }

      if (currentPres && !state.pres) {
        p.screenShares = (p.screenShares || 0) + 1;
        p.isPresenting = true;
        logEvent(name, 'presentation_start');
      } else if (!currentPres && state.pres) {
        p.isPresenting = false;
        logEvent(name, 'presentation_end');
      }
      if (currentPres) {
        p.screenShareTimeMs = (p.screenShareTimeMs || 0) + deltaMs;
      }

      if (!state.online && p.lastSeen && (new Date().getTime() - new Date(p.lastSeen).getTime() > 60000)) {
        p.rejoins = (p.rejoins || 0) + 1;
        logEvent(name, 'rejoined');
      }

      liveStates[name] = {
        hand: p.isHandRaised,
        mic: currentMic,
        cam: currentCam,
        pres: currentPres,
        online: true
      };
    }

    function scan() {
      const nowMs = performance.now();
      const deltaMs = Math.min(5000, Math.max(0, nowMs - lastTickTime));
      lastTickTime = nowMs;

      const currentPresentNames = new Set();
      const activePresentersThisScan = new Set();
      const processedTileNames = new Set();

      const selfName = getSelfName();
      const selfControls = getSelfControlStates();

      if (selfControls.isScreenSharing && selfName) {
        activePresentersThisScan.add(selfName);
      }

      const allTiles = getParticipantTiles();

      allTiles.forEach((tile) => {
        if (isPresentationTile(tile)) {
          const presenter = getPresenterName(tile, selfName) || (selfControls.isScreenSharing ? selfName : null);
          if (presenter && isValidParticipantName(presenter)) {
            activePresentersThisScan.add(presenter);
            currentPresentNames.add(presenter);
            const p = getParticipant(presenter);
            p.isPresenting = true;
            p.screenShareTimeMs += deltaMs;
            p.isOnline = true;
            p.lastSeen = new Date().toISOString();
          }
          return;
        }

        const name = getNameFromTile(tile, selfName);
        if (!name || !isValidParticipantName(name)) return;

        currentPresentNames.add(name);
        processedTileNames.add(name.toLowerCase());

        const tileHand = isHandUp(tile);
        const tileMic = isMicUnmuted(tile);
        const tileCam = isCameraActive(tile);
        const isSelf = !!(selfName && name.toLowerCase() === selfName.toLowerCase());

        const currentHand = isSelf ? (readLocalToggle('hand') ?? (selfControls.isHandRaised || tileHand)) : tileHand;
        const currentMic = isSelf ? (readLocalToggle('mic') ?? (selfControls.isUnmuted || tileMic)) : tileMic;
        const currentCam = isSelf ? (selfControls.isCameraOn || tileCam) : tileCam;
        const currentPres = isSelf ? (selfControls.isScreenSharing || activePresentersThisScan.has(name)) : activePresentersThisScan.has(name);

        applyParticipantLiveState(name, currentHand, currentMic, currentCam, currentPres, deltaMs, isSelf);
      });

      if (selfName && !processedTileNames.has(selfName.toLowerCase())) {
        currentPresentNames.add(selfName);
        applyParticipantLiveState(selfName, selfControls.isHandRaised, selfControls.isUnmuted, selfControls.isCameraOn, selfControls.isScreenSharing, deltaMs, true);
      }

      const peoplePanel = document.querySelector('div[aria-label*="People" i], div[aria-label*="Participants" i], [data-panel-id="1"], div[role="tabpanel"][aria-label*="People" i]');
      if (peoplePanel) {
        peoplePanel.querySelectorAll('[role="listitem"]').forEach((item) => {
          if (item.matches('button, [role="button"]')) return;
          const itemText = (item.textContent || '').trim();
          const itemLower = itemText.toLowerCase();

          if (/^(add people|mute all|search|contributors|meeting host|host controls|waiting room)/i.test(itemLower)) return;

          if (/\b(presentation|presenting|screenshare|screen share|shared screen|sunum|ekran)\b/i.test(itemLower) || /'s\s+(presentation|screen)/i.test(itemLower)) {
            const presenter = extractPresenterNameFromString(itemText);
            if (presenter && data.participants[presenter]) {
              data.participants[presenter].isPresenting = true;
              activePresentersThisScan.add(presenter);
            }
            return;
          }

          const textEl = item.querySelector('.notranslate, [data-name], span[class*="name" i]');
          if (textEl && !textEl.closest('button, [role="button"], i, svg')) {
            const name = cleanName(textEl.textContent);
            if (name && isValidParticipantName(name)) {
              currentPresentNames.add(name);
              const p = getParticipant(name);
              if (!liveStates[name]?.online) {
                p.totalStayMs += deltaMs;
                p.lastSeen = new Date().toISOString();
                p.isOnline = true;
              }
              const hasHandIcon = !!item.querySelector('[aria-label*="hand" i], [data-is-hand-raised="true"], [data-tooltip*="hand" i]') ||
                Array.from(item.querySelectorAll('i, span')).some((el) => {
                  const t = (el.textContent || '').trim().toLowerCase();
                  return t === 'back_hand' || t === 'pan_tool' || t === 'front_hand';
                });
              if (hasHandIcon || item.closest('[aria-label*="raised hand" i]')) {
                if (!p.isHandRaised) {
                  p.handRaises = (p.handRaises || 0) + 1;
                  p.isHandRaised = true;
                  p.handRaisedAt = p.handRaisedAt || Date.now();
                  if (liveStates[name]) liveStates[name].hand = true;
                  logEvent(name, 'hand_raised');
                }
              }
            }
          }
        });
      }

      Object.keys(data.participants).forEach((name) => {
        if (!isValidParticipantName(name)) {
          delete data.participants[name];
          delete liveStates[name];
          return;
        }
        if (!currentPresentNames.has(name)) {
          data.participants[name].isOnline = false;
          data.participants[name].isUnmuted = false;
          if (liveStates[name]) liveStates[name].online = false;
        }
      });

      const chatInput = document.querySelector('textarea[aria-label*="message" i], textarea[placeholder*="message" i], input[placeholder*="message" i], [contenteditable="true"][aria-label*="message" i]');
      const messageSelector = '[data-message-id], [data-message-text], [jsname="W297wb"], [jsname="dTKtvb"]';
      let chatContainer = document.querySelector('[role="log"], [role="region"][aria-label*="message" i], [role="region"][aria-label*="chat" i]');
      if (chatInput) {
        for (let cur = chatInput.parentElement; cur && cur !== document.body; cur = cur.parentElement) {
          if (cur.querySelector(messageSelector)) { chatContainer = cur; break; }
        }
      }
      if (!chatContainer) chatContainer = document.querySelector('[data-message-id]')?.parentElement;

      if (chatContainer) {
        const rawCandidates = Array.from(chatContainer.querySelectorAll(
          '[data-message-id], [data-message-text], [jsname="W297wb"], [jsname="dTKtvb"], div[dir="auto"], span[dir="auto"], div[role="listitem"], div[class*="message" i]'
        )).filter(el => !el.closest('button, [role="button"], [role="switch"], input, textarea, label, header'));

        const leafCandidates = rawCandidates.filter((el) => {
          if (el.matches('button, [role="button"], [role="switch"], input, textarea, label, header, footer')) return false;
          if (el.closest('button, [role="button"], [role="switch"], input, textarea, label, header')) return false;
          return !rawCandidates.some((other) => other !== el && el.contains(other));
        });

        const sameMsgSeq = new Map();

        leafCandidates.forEach((el) => {
          const raw = (el.textContent || '').trim();
          if (!raw || raw.length === 0) return;

          if (/^(in-call messages|send a message|let participants send messages|continuous chat is turned off|messages will not be saved|you can pin a message|messages can be seen only|no messages yet|messages are saved)$/i.test(raw)) {
            return;
          }
          if (raw.startsWith('Messages can be seen only') || raw.startsWith('Messages will not be saved') || raw.startsWith('Continuous chat')) {
            return;
          }
          if (/^\d{1,2}:\d{2}(\s*(?:am|pm))?$/i.test(raw)) return;

          const senderEl = el.closest('[data-sender-name]') || el.parentElement?.querySelector('[data-sender-name], .YTb99d, .notranslate') || el.closest('[role="listitem"]')?.querySelector('[data-sender-name], .YTb99d, .notranslate');
          const detectedSenderName = cleanName(senderEl?.getAttribute('data-sender-name') || senderEl?.textContent);

          if (detectedSenderName && raw.toLowerCase() === detectedSenderName.toLowerCase()) return;
          if (selfName && raw.toLowerCase() === selfName.toLowerCase()) return;
          if (data.participants[raw]) return;

          let sender = detectedSenderName || (raw.includes('(You)') ? selfName : null) || selfName || Object.keys(data.participants)[0];
          if (!sender || !isValidParticipantName(sender)) {
            sender = selfName || Object.keys(data.participants)[0] || 'Participant';
          }

          const msgId = el.getAttribute('data-message-id') || el.closest('[data-message-id]')?.getAttribute('data-message-id');
          const timeEl = el.closest('[role="listitem"]')?.querySelector('[data-timestamp], span[class*="time" i]') || el.parentElement?.querySelector('span[class*="time" i]');
          const timeText = timeEl?.textContent?.trim() || '';

          const subKey = msgId ? `id:${msgId}` : `${sender}:${timeText}:${raw}`;
          const seq = sameMsgSeq.get(subKey) || 0;
          sameMsgSeq.set(subKey, seq + 1);

          const msgKey = `${subKey}:${seq}`;

          if (el.dataset.nmSeen === 'true') {
            seenChatIds.add(msgKey);
            return;
          }

          el.dataset.nmSeen = 'true';

          if (!seenChatIds.has(msgKey)) {
            seenChatIds.add(msgKey);
            const p = getParticipant(sender);
            p.chatMessages = (p.chatMessages || 0) + 1;
            logEvent(sender, 'chat_message', { preview: raw.slice(0, 30) });
          }
        });
      } else {
        document.querySelectorAll('[role="status"], [aria-live="polite"], [role="alert"], div[class*="snackbar" i], div[class*="toast" i]').forEach((toast) => {
          if (toast.dataset.nmSeen === 'true') return;
          const text = (toast.textContent || '').trim();
          if (!text || text.length < 3 || seenChatIds.has(text)) return;
          if (!toast.querySelector('[data-message-id], [data-sender-name]') && !/^(new )?message from /i.test(text)) return;
          if (/microphone|camera|network|connection|screenshare|recording|full video|joined|left/i.test(text)) return;

          let sender = null;
          let preview = text;
          if (text.includes(':')) {
            const [s, ...rest] = text.split(':');
            sender = cleanName(s.replace(/^(message from|new message from)\s*/i, ''));
            preview = rest.join(':').trim();
          } else if (text.includes('\n')) {
            const [s, ...rest] = text.split('\n');
            sender = cleanName(s);
            preview = rest.join('\n').trim();
          }

          toast.dataset.nmSeen = 'true';
          const msgKey = (sender || 'toast') + ':' + text.slice(0, 100);
          if (!seenChatIds.has(msgKey)) {
            seenChatIds.add(msgKey);
            seenChatIds.add(text);
            const actualSender = sender || selfName || Object.keys(data.participants)[0] || 'Participant';
            const p = getParticipant(actualSender);
            p.chatMessages = (p.chatMessages || 0) + 1;
            logEvent(actualSender, 'chat_message', { preview: preview.slice(0, 30) });
          }
        });
      }

      persistData();
      updateHudUI();
    }

    function formatDur(ms) {
      const s = Math.round(ms / 1000);
      const m = Math.floor(s / 60);
      const remSec = s % 60;
      if (m >= 60) {
        const h = Math.floor(m / 60);
        return `${h}h ${m % 60}m`;
      }
      return m > 0 ? `${m}m ${remSec}s` : `${remSec}s`;
    }

    let hudRoot = null;

    function buildHud() {
      if (document.getElementById('nerdmeet-hud-root')) return;

      hudRoot = document.createElement('div');
      hudRoot.id = 'nerdmeet-hud-root';

      const savedPos = (() => {
        try {
          const pos = JSON.parse(localStorage.getItem('nerdmeet_hud_pos'));
          if (pos && (pos.right || (pos.left && parseInt(pos.left, 10) > window.innerWidth - 380))) {
            return null;
          }
          return pos;
        } catch (e) {
          return null;
        }
      })() || { top: '64px', left: '18px' };

      hudRoot.setAttribute('style', `
        position: fixed;
        top: ${savedPos.top || '64px'};
        left: ${savedPos.left || '18px'};
        z-index: 999999;
        font-family: 'Poppins', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 13px;
        color: #FAF9F5;
        user-select: none;
      `);

      hudRoot.innerHTML = `
        <div id="nm-pill" style="
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(31, 30, 29, 0.94);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 999px;
          padding: 8px 14px;
          box-shadow: 0 6px 20px rgba(0,0,0,0.35);
          cursor: pointer;
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1), background 0.2s ease;
        ">
          <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#E5A50A;box-shadow:0 0 8px rgba(229,165,10,0.6);"></span>
          <span style="font-weight:700;letter-spacing:0.3px;color:#E5A50A;">NerdMeet</span>
          <span id="nm-pill-stats" style="display:inline-flex;align-items:center;gap:5px;opacity:0.92;">Tracking...</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.6;"><polyline points="6 9 12 15 18 9"/></svg>
        </div>

        <div id="nm-panel" style="
          display: ${isHudExpanded ? 'flex' : 'none'};
          flex-direction: column;
          margin-top: 8px;
          width: 330px;
          background: #1F1E1D;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 16px;
          box-shadow: 0 16px 40px rgba(0,0,0,0.5);
          overflow: hidden;
          transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        ">
          <div id="nm-header" style="
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 14px;
            background: #282725;
            border-bottom: 1px solid rgba(255,255,255,0.08);
            cursor: grab;
          ">
            <span style="font-weight:700;font-size:11px;letter-spacing:0.5px;color:#E5A50A;">LIVE ANALYTICS</span>
            <div style="display:flex;gap:6px;align-items:center;">
              <button id="nm-close-btn" title="Minimize to pill" style="
                background:none;border:none;color:#FAF9F5;cursor:pointer;opacity:0.7;padding:3px;display:flex;align-items:center;transition:opacity 0.15s ease;
              ">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
          </div>

          <div style="display:flex;background:#232220;border-bottom:1px solid rgba(255,255,255,0.08);">
            <button id="nm-tab-queue" style="
              flex:1;padding:9px;border:none;background:${hudTab === 'queue' ? '#1F1E1D' : 'transparent'};
              color:${hudTab === 'queue' ? '#E5A50A' : '#A8A69E'};font-weight:600;cursor:pointer;font-size:11px;
              display:inline-flex;align-items:center;justify-content:center;gap:6px;transition:all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
            ">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>
              Hands (<span id="nm-tab-hands-count">0</span>)
            </button>
            <button id="nm-tab-speakers" style="
              flex:1;padding:9px;border:none;background:${hudTab === 'speakers' ? '#1F1E1D' : 'transparent'};
              color:${hudTab === 'speakers' ? '#E5A50A' : '#A8A69E'};font-weight:600;cursor:pointer;font-size:11px;
              display:inline-flex;align-items:center;justify-content:center;gap:6px;transition:all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
            ">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
              Talk & Cam
            </button>
          </div>

          <div id="nm-tab-body" style="padding:12px;max-height:230px;overflow-y:auto;">
          </div>

          <div style="
            display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:10px;background:#262523;border-top:1px solid rgba(255,255,255,0.08);
          ">
            <button id="nm-btn-sidepanel" style="
              background:#E5A50A;color:#1F1E1D;border:none;border-radius:8px;padding:7px;font-size:11px;font-weight:600;cursor:pointer;
              display:inline-flex;align-items:center;justify-content:center;gap:5px;transition:opacity 0.15s ease;
            ">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
              Side Panel
            </button>
            <button id="nm-btn-csv" style="
              background:#33312E;color:#FAF9F5;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:7px;font-size:11px;font-weight:500;cursor:pointer;
              display:inline-flex;align-items:center;justify-content:center;gap:5px;transition:opacity 0.15s ease;
            ">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/></svg>
              Export CSV
            </button>
          </div>
          <div style="padding:4px 10px 8px;display:flex;justify-content:space-between;font-size:10px;opacity:0.65;">
            <span id="nm-active-count">0 in call</span>
            <a id="nm-export-json-link" href="#" style="color:#E5A50A;text-decoration:none;display:inline-flex;align-items:center;gap:3px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
              JSON
            </a>
          </div>
        </div>
      `;

      document.body.appendChild(hudRoot);

      const pill = hudRoot.querySelector('#nm-pill');
      const panel = hudRoot.querySelector('#nm-panel');
      const closeBtn = hudRoot.querySelector('#nm-close-btn');

      const togglePanel = (show) => {
        isHudExpanded = typeof show === 'boolean' ? show : panel.style.display === 'none';
        panel.style.display = isHudExpanded ? 'flex' : 'none';
        localStorage.setItem('nerdmeet_hud_expanded', isHudExpanded ? 'true' : 'false');
      };

      pill.onclick = () => togglePanel();
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        togglePanel(false);
      };

      const tabQueue = hudRoot.querySelector('#nm-tab-queue');
      const tabSpeakers = hudRoot.querySelector('#nm-tab-speakers');

      tabQueue.onclick = () => {
        hudTab = 'queue';
        tabQueue.style.background = '#1F1E1D';
        tabQueue.style.color = '#E5A50A';
        tabSpeakers.style.background = 'transparent';
        tabSpeakers.style.color = '#A8A69E';
        updateHudUI();
      };

      tabSpeakers.onclick = () => {
        hudTab = 'speakers';
        tabSpeakers.style.background = '#1F1E1D';
        tabSpeakers.style.color = '#E5A50A';
        tabQueue.style.background = 'transparent';
        tabQueue.style.color = '#A8A69E';
        updateHudUI();
      };

      const header = hudRoot.querySelector('#nm-header');
      let isDragging = false, dragStartX = 0, dragStartY = 0, initialLeft = 0, initialTop = 0;

      header.onmousedown = (e) => {
        if (e.target.closest('#nm-close-btn')) return;
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        const rect = hudRoot.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        header.style.cursor = 'grabbing';
      };

      window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const deltaX = e.clientX - dragStartX;
        const deltaY = e.clientY - dragStartY;
        hudRoot.style.left = `${Math.max(10, initialLeft + deltaX)}px`;
        hudRoot.style.top = `${Math.max(10, initialTop + deltaY)}px`;
        hudRoot.style.right = 'auto';
      });

      window.addEventListener('mouseup', () => {
        if (isDragging) {
          isDragging = false;
          header.style.cursor = 'grab';
          localStorage.setItem('nerdmeet_hud_pos', JSON.stringify({
            top: hudRoot.style.top,
            left: hudRoot.style.left
          }));
        }
      });

      hudRoot.querySelector('#nm-btn-sidepanel').onclick = () => {
        if (ext?.runtime?.sendMessage) {
          ext.runtime.sendMessage({ type: 'OPEN_SIDEPANEL' }).catch(() => {
            alert('To open the analytics panel, click the NerdMeet icon in your browser toolbar.');
          });
        } else {
          alert('Analytics Panel requires the NerdMeet browser extension.');
        }
      };

      hudRoot.querySelector('#nm-btn-csv').onclick = () => exportCSV();

      hudRoot.querySelector('#nm-export-json-link').onclick = (e) => {
        e.preventDefault();
        exportJSON();
      };
    }

    function exportJSON() {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      a.download = `nerdmeet-${code}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    }

    function exportCSV() {
      const rows = [
        ['Name', 'Total Stay', 'Talk Time (sec)', 'Camera Time (sec)', 'Screenshare Time (sec)', 'Hands Raised', 'Mic Opens', 'Cam Opens', 'Chat Messages', 'Rejoins']
      ];
      Object.keys(data.participants).forEach((name) => {
        const p = data.participants[name];
        rows.push([
          `"${name.replace(/"/g, '""')}"`,
          `"${formatDur(p.totalStayMs)}"`,
          Math.round(p.talkTimeMs / 1000),
          Math.round(p.cameraTimeMs / 1000),
          Math.round(p.screenShareTimeMs / 1000),
          p.handRaises,
          p.micOpens,
          p.cameraOpens,
          p.chatMessages,
          p.rejoins
        ]);
      });
      const csvContent = rows.map((r) => r.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `nerdmeet-${code}-report.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    }

    function updateHudUI() {
      if (!hudRoot) return;
      const allParts = Object.entries(data.participants);
      const onlineParts = allParts.filter(([, p]) => p.isOnline);
      const raisedHands = allParts
        .filter(([, p]) => p.isHandRaised)
        .sort((a, b) => (a[1].handRaisedAt || 0) - (b[1].handRaisedAt || 0)); 

      const currentSpeaker = onlineParts.find(([, p]) => p.isUnmuted);

      const pillStats = hudRoot.querySelector('#nm-pill-stats');
      if (pillStats) {
        if (raisedHands.length > 0) {
          pillStats.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#E8846C" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>
            <b style="color:#E8846C;">${raisedHands.length} hand${raisedHands.length > 1 ? 's' : ''}</b> · ${onlineParts.length} online
          `;
        } else if (currentSpeaker) {
          pillStats.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#E5A50A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
            <b style="color:#FAF9F5;">${currentSpeaker[0]}</b> · ${onlineParts.length} online
          `;
        } else {
          pillStats.innerHTML = `${onlineParts.length} online · ${allParts.length} total`;
        }
      }

      const handsCountEl = hudRoot.querySelector('#nm-tab-hands-count');
      if (handsCountEl) handsCountEl.textContent = String(raisedHands.length);

      const activeCountEl = hudRoot.querySelector('#nm-active-count');
      if (activeCountEl) activeCountEl.textContent = `${onlineParts.length} currently in call`;

      const body = hudRoot.querySelector('#nm-tab-body');
      if (!body) return;

      if (body.getAttribute('data-tab') !== hudTab) {
        body.innerHTML = '';
        body.setAttribute('data-tab', hudTab);
      }

      if (hudTab === 'queue') {
        if (raisedHands.length === 0) {
          if (!body.querySelector('.nm-empty-msg')) {
            body.innerHTML = `
              <div class="nm-empty-msg" style="text-align:center;padding:24px 8px;color:#A8A69E;font-size:12px;">
                No raised hands right now.<br>
                <span style="opacity:0.6;font-size:11px;">Hands appear here in real-time (FIFO).</span>
              </div>
            `;
          }
        } else {
          const emptyMsg = body.querySelector('.nm-empty-msg');
          if (emptyMsg) emptyMsg.remove();

          const activeNames = new Set(raisedHands.map(([name]) => name));
          body.querySelectorAll('.nm-queue-item').forEach((el) => {
            const itemKey = el.getAttribute('data-name');
            if (!activeNames.has(itemKey)) {
              el.remove();
            }
          });

          raisedHands.forEach(([name, p], idx) => {
            const waitSec = p.handRaisedAt ? Math.max(0, Math.round((Date.now() - p.handRaisedAt) / 1000)) : 0;
            const waitStr = waitSec >= 60 ? `${Math.floor(waitSec / 60)}m ${waitSec % 60}s` : `${waitSec}s`;

            let item = body.querySelector(`.nm-queue-item[data-name="${CSS.escape(name)}"]`);
            if (!item) {
              item = document.createElement('div');
              item.className = 'nm-queue-item';
              item.setAttribute('data-name', name);
              item.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 10px;margin-bottom:6px;background:#282725;border-radius:8px;border-left:3px solid #E5A50A;transition:transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);';
              item.innerHTML = `
                <div style="display:flex;gap:7px;align-items:center;min-width:0;">
                  <span class="nm-queue-order" style="font-weight:700;color:#E5A50A;font-size:11px;">#${idx + 1}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#E5A50A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>
                  <span class="nm-queue-name" style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px;">${name}</span>
                </div>
                <span class="nm-queue-wait" style="font-size:11px;color:#E8846C;font-weight:600;">${waitStr}</span>
              `;
              body.appendChild(item);
            } else {
              const orderEl = item.querySelector('.nm-queue-order');
              if (orderEl && orderEl.textContent !== `#${idx + 1}`) {
                orderEl.textContent = `#${idx + 1}`;
              }
              const waitEl = item.querySelector('.nm-queue-wait');
              if (waitEl && waitEl.textContent !== waitStr) {
                waitEl.textContent = waitStr;
              }
            }
          });
        }
      } else if (hudTab === 'speakers') {
        const topSpeakers = [...allParts]
          .sort((a, b) => b[1].talkTimeMs - a[1].talkTimeMs)
          .slice(0, 8);

        const maxTalk = Math.max(1, topSpeakers[0]?.[1].talkTimeMs || 1);

        if (topSpeakers.length === 0 || topSpeakers[0][1].talkTimeMs === 0) {
          body.innerHTML = `<div style="text-align:center;padding:20px;color:#A8A69E;font-size:12px;">No talk-time recorded yet.</div>`;
        } else {
          body.innerHTML = topSpeakers.map(([name, p]) => {
            const pct = Math.min(100, Math.round((p.talkTimeMs / maxTalk) * 100));
            const isSpeakingNow = p.isUnmuted;
            const micIcon = isSpeakingNow
              ? `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#E5A50A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:2px;"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>`
              : '';

            return `
              <div style="margin-bottom:8px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:3px;font-size:11px;">
                  <span style="font-weight:${isSpeakingNow ? '700' : '500'};color:${isSpeakingNow ? '#E5A50A' : '#FAF9F5'};">
                    ${micIcon}${name}
                  </span>
                  <span style="color:#A8A69E;font-size:10px;">
                    Talk: <b>${formatDur(p.talkTimeMs)}</b> (${p.micOpens || 0}×) · Cam: <b>${formatDur(p.cameraTimeMs)}</b> (${p.cameraOpens || 0}×)
                  </span>
                </div>
                <div style="width:100%;height:4px;background:#3A3936;border-radius:2px;overflow:hidden;">
                  <div style="width:${pct}%;height:100%;background:#E5A50A;border-radius:2px;transition:width 0.4s cubic-bezier(0.16, 1, 0.3, 1);"></div>
                </div>
              </div>
            `;
          }).join('');
        }
      }
    }

    buildHud();

    let debounceTimer;
    const observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(scan, 350);
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-is-muted', 'aria-label', 'data-is-presenting', 'data-is-hand-raised', 'aria-pressed', 'class']
    });

    setInterval(scan, 1000);

    scan();
    console.log(`[NerdMeet] Tracker active for meeting: ${code}`);
  }
})();
