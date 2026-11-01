(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const ext = globalThis.browser || globalThis.chrome;

  let currentMeetCode = null;
  let currentData = null;
  let anonymize = false;
  let filterQuery = '';

  const dur = (ms) => {
    const s = Math.round((ms || 0) / 1000);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    if (m >= 60) {
      const h = Math.floor(m / 60);
      return `${h}h ${m % 60}m`;
    }
    return m > 0 ? `${m}m ${rem}s` : `${rem}s`;
  };

  const anonMap = new Map();
  function getDisplayName(realName) {
    if (!anonymize) return realName;
    if (!anonMap.has(realName)) {
      anonMap.set(realName, `Participant ${anonMap.size + 1}`);
    }
    return anonMap.get(realName);
  }

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

  function cleanMeetingParticipants(item) {
    if (!item?.participants) return false;
    let modified = false;

    const realNames = Object.keys(item.participants).filter(n => isValidParticipantName(n) && !['you', 'you (host)', 'host'].includes(n.toLowerCase()));

    if (realNames.length > 0) {
      const primaryReal = realNames[0];
      ['You', 'You (Host)', 'Host', 'You (Presentation)'].forEach((alias) => {
        if (item.participants[alias]) {
          const old = item.participants[alias];
          const target = item.participants[primaryReal];
          if (target) {
            target.totalStayMs = Math.max(target.totalStayMs || 0, old.totalStayMs || 0);
            target.talkTimeMs = Math.max(target.talkTimeMs || 0, old.talkTimeMs || 0);
            target.cameraTimeMs = Math.max(target.cameraTimeMs || 0, old.cameraTimeMs || 0);
            target.screenShareTimeMs = Math.max(target.screenShareTimeMs || 0, old.screenShareTimeMs || 0);
            target.handRaises = Math.max(target.handRaises || 0, old.handRaises || 0);
            target.micOpens = Math.max(target.micOpens || 0, old.micOpens || 0);
            target.cameraOpens = Math.max(target.cameraOpens || 0, old.cameraOpens || 0);
            target.chatMessages = (target.chatMessages || 0) + (old.chatMessages || 0);
          }
          delete item.participants[alias];
          modified = true;
        }
      });
    }

    Object.keys(item.participants).forEach((name) => {
      if (!isValidParticipantName(name)) {
        delete item.participants[name];
        modified = true;
      }
    });

    return modified;
  }

  async function loadMeetingsList() {
    if (!ext?.storage?.local) return;
    const all = await ext.storage.local.get(null);
    const sel = $('#meetingSelect');
    const delBtn = $('#btnDeleteMeeting');
    const existing = sel.value;

    const meetKeys = Object.keys(all).filter((k) => k.startsWith('nerdmeet_') && k !== 'nerdmeet_latest_meet' && k !== 'nerdmeet_last_updated');
    
    meetKeys.forEach((k) => {
      const item = all[k];
      if (cleanMeetingParticipants(item)) {
        ext.storage.local.set({ [k]: item }).catch(() => {});
      }
    });

    if (meetKeys.length === 0) {
      sel.innerHTML = '<option value="">No tracked meetings found</option>';
      if (delBtn) delBtn.disabled = true;
      currentMeetCode = null;
      currentData = null;
      render();
      return;
    }

    sel.innerHTML = '<option value="">Select tracked meeting...</option>' +
      meetKeys.map((k) => {
        const c = k.replace('nerdmeet_', '');
        const item = all[k];
        const dateStr = item?.startedAt ? new Date(item.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        const count = Object.keys(item?.participants || {}).length;
        return `<option value="${c}">${c} (${count} participant${count === 1 ? '' : 's'}${dateStr ? ' · ' + dateStr : ''})</option>`;
      }).join('') +
      '<option value="__clear_all__">🗑 Delete all meetings...</option>';

    const latest = all.nerdmeet_latest_meet;
    if (existing && meetKeys.includes(`nerdmeet_${existing}`)) {
      sel.value = existing;
      currentMeetCode = existing;
    } else if (latest && meetKeys.includes(`nerdmeet_${latest}`)) {
      sel.value = latest;
      currentMeetCode = latest;
    } else if (meetKeys.length > 0) {
      const first = meetKeys[0].replace('nerdmeet_', '');
      sel.value = first;
      currentMeetCode = first;
    } else {
      currentMeetCode = null;
    }

    if (delBtn) delBtn.disabled = !currentMeetCode;

    if (currentMeetCode) {
      currentData = all[`nerdmeet_${currentMeetCode}`];
    } else {
      currentData = null;
    }
    render();
  }

  function render() {
    if (currentData) {
      cleanMeetingParticipants(currentData);
    }

    if (!currentData || !currentData.participants) {
      $('#tableBody').innerHTML = '<tr><td colspan="6" class="empty-msg">No data for this meeting.</td></tr>';
      $('#queueList').innerHTML = '<div class="empty-msg">No active hand raises.</div>';
      $('#queueCount').textContent = '0';
      $('#kpiJoined').textContent = '-';
      $('#kpiTalkTime').textContent = '-';
      $('#kpiHands').textContent = '-';
      $('#kpiActive').textContent = '-';
      $('#kpiMicOpens').textContent = '0 mic opens';
      $('#kpiCamOpens').textContent = '0 cam opens';
      $('#kpiChatMsgs').textContent = '0 messages';
      return;
    }

    const participants = Object.entries(currentData.participants);
    const activeParticipants = participants.filter(([, p]) => p.isOnline);
    const totalTalkMs = participants.reduce((sum, [, p]) => sum + (p.talkTimeMs || 0), 0);
    const totalHands = participants.reduce((sum, [, p]) => sum + (p.handRaises || 0), 0);
    const totalMicOpens = participants.reduce((sum, [, p]) => sum + (p.micOpens || 0), 0);
    const totalCamOpens = participants.reduce((sum, [, p]) => sum + (p.cameraOpens || 0), 0);
    const totalChats = participants.reduce((sum, [, p]) => sum + (p.chatMessages || 0), 0);

    const sel = $('#meetingSelect');
    const activeOpt = sel.querySelector(`option[value="${currentMeetCode}"]`);
    if (activeOpt) {
      const dateStr = currentData.startedAt ? new Date(currentData.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      activeOpt.textContent = `${currentMeetCode} (${participants.length} participant${participants.length === 1 ? '' : 's'}${dateStr ? ' · ' + dateStr : ''})`;
    }

    $('#kpiJoined').textContent = String(participants.length);
    $('#kpiTalkTime').textContent = dur(totalTalkMs);
    $('#kpiHands').textContent = String(totalHands);
    $('#kpiActive').textContent = String(activeParticipants.length);
    $('#kpiMicOpens').textContent = `${totalMicOpens} mic open${totalMicOpens === 1 ? '' : 's'}`;
    $('#kpiCamOpens').textContent = `${totalCamOpens} cam open${totalCamOpens === 1 ? '' : 's'}`;
    $('#kpiChatMsgs').textContent = `${totalChats} message${totalChats === 1 ? '' : 's'}`;

    const raisedList = participants
      .filter(([, p]) => p.isHandRaised)
      .sort((a, b) => (a[1].handRaisedAt || 0) - (b[1].handRaisedAt || 0));

    $('#queueCount').textContent = String(raisedList.length);
    const queueList = $('#queueList');

    if (raisedList.length === 0) {
      if (!queueList.querySelector('.empty-msg')) {
        queueList.innerHTML = '<div class="empty-msg">No active hand raises.</div>';
      }
    } else {
      const emptyMsg = queueList.querySelector('.empty-msg');
      if (emptyMsg) emptyMsg.remove();

      const activeNames = new Set(raisedList.map(([name]) => name));

      queueList.querySelectorAll('.queue-item').forEach((el) => {
        const itemKey = el.getAttribute('data-name');
        if (!activeNames.has(itemKey)) {
          el.remove();
        }
      });

      raisedList.forEach(([name, p], idx) => {
        const waitSec = p.handRaisedAt ? Math.max(0, Math.round((Date.now() - p.handRaisedAt) / 1000)) : 0;
        const waitStr = waitSec >= 60 ? `${Math.floor(waitSec / 60)}m ${waitSec % 60}s` : `${waitSec}s`;
        const displayName = getDisplayName(name);

        let item = queueList.querySelector(`.queue-item[data-name="${CSS.escape(name)}"]`);
        if (!item) {
          item = document.createElement('div');
          item.className = 'queue-item';
          item.setAttribute('data-name', name);
          item.innerHTML = `
            <div style="display:flex;align-items:center;gap:6px;">
              <span class="queue-order">#${idx + 1}</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>
              <span class="queue-name" style="font-weight:500;">${displayName}</span>
            </div>
            <span class="queue-wait" style="font-weight:600;font-size:11px;color:var(--err);">${waitStr}</span>
          `;
          queueList.appendChild(item);
        } else {
          const orderEl = item.querySelector('.queue-order');
          if (orderEl && orderEl.textContent !== `#${idx + 1}`) {
            orderEl.textContent = `#${idx + 1}`;
          }
          const nameEl = item.querySelector('.queue-name');
          if (nameEl && nameEl.textContent !== displayName) {
            nameEl.textContent = displayName;
          }
          const waitEl = item.querySelector('.queue-wait');
          if (waitEl && waitEl.textContent !== waitStr) {
            waitEl.textContent = waitStr;
          }
        }
      });
    }

    const maxTalk = Math.max(1, ...participants.map(([, p]) => p.talkTimeMs || 0));
    const filtered = participants.filter(([name]) => {
      const display = getDisplayName(name).toLowerCase();
      return display.includes(filterQuery.toLowerCase());
    });

    if (filtered.length === 0) {
      $('#tableBody').innerHTML = '<tr><td colspan="6" class="empty-msg">No matching attendees.</td></tr>';
    } else {
      $('#tableBody').innerHTML = filtered
        .sort((a, b) => (b[1].talkTimeMs || 0) - (a[1].talkTimeMs || 0))
        .map(([name, p]) => {
          const talkPct = Math.min(100, Math.round(((p.talkTimeMs || 0) / maxTalk) * 100));
          const displayName = getDisplayName(name);
          const isSpeakingNow = p.isUnmuted;

          const micIcon = isSpeakingNow
            ? `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:3px;"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>`
            : '';

          return `
            <tr>
              <td>
                <span style="font-weight:${isSpeakingNow ? '700' : '500'};color:${isSpeakingNow ? 'var(--accent)' : 'inherit'};">
                  ${micIcon}${displayName}
                </span>
              </td>
              <td>
                ${dur(p.talkTimeMs)}
                <span class="sub-stat" title="Mic unmuted ${p.micOpens || 0} times">${p.micOpens || 0}×</span>
                <span class="bar-track"><i class="bar-fill" style="display:block;width:${talkPct}%;"></i></span>
              </td>
              <td>${dur(p.totalStayMs)}</td>
              <td>
                ${dur(p.cameraTimeMs)}
                <span class="sub-stat" title="Camera opened ${p.cameraOpens || 0} times">${p.cameraOpens || 0}×</span>
              </td>
              <td>${p.handRaises || 0}</td>
              <td>${p.chatMessages || 0}</td>
            </tr>
          `;
        }).join('');
    }
  }

  function exportCSV() {
    if (!currentData || !currentData.participants) return alert('No meeting data to export.');
    const rows = [
      ['Participant', 'Total Stay', 'Talk Time (sec)', 'Mic Opens', 'Camera Time (sec)', 'Camera Opens', 'Screenshare Time (sec)', 'Hand Raises', 'Chat Messages', 'Rejoins']
    ];
    Object.entries(currentData.participants).forEach(([name, p]) => {
      rows.push([
        `"${getDisplayName(name).replace(/"/g, '""')}"`,
        `"${dur(p.totalStayMs)}"`,
        Math.round((p.talkTimeMs || 0) / 1000),
        p.micOpens || 0,
        Math.round((p.cameraTimeMs || 0) / 1000),
        p.cameraOpens || 0,
        Math.round((p.screenShareTimeMs || 0) / 1000),
        p.handRaises || 0,
        p.chatMessages || 0,
        p.rejoins || 0
      ]);
    });
    const csvContent = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nerdmeet-${currentMeetCode || 'export'}-report.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function exportJSON() {
    if (!currentData) return alert('No meeting data to export.');
    const exportCopy = JSON.parse(JSON.stringify(currentData));
    if (anonymize) {
      const anonParts = {};
      Object.entries(exportCopy.participants).forEach(([name, p]) => {
        anonParts[getDisplayName(name)] = p;
      });
      exportCopy.participants = anonParts;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(exportCopy, null, 2)], { type: 'application/json' }));
    a.download = `nerdmeet-${currentMeetCode || 'export'}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function openPdfModal() {
    if (!currentData || !currentData.participants) return alert('No meeting data to export.');
    $('#exportModal').classList.add('open');
  }

  function closePdfModal() {
    $('#exportModal').classList.remove('open');
  }

  function generateCustomPDF() {
    if (!currentData || !currentData.participants) return;
    if (!window.jspdf?.jsPDF) return alert('PDF library not ready.');

    const incStay = $('#colStay')?.checked;
    const incTalk = $('#colTalk')?.checked;
    const incMicOpens = $('#colMicOpens')?.checked;
    const incCam = $('#colCam')?.checked;
    const incCamOpens = $('#colCamOpens')?.checked;
    const incHands = $('#colHands')?.checked;
    const incChat = $('#colChat')?.checked;
    const incRejoins = $('#colRejoins')?.checked;
    const incKpiHeader = $('#incKpiHeader')?.checked;

    const parts = Object.entries(currentData.participants);
    const totalTalk = parts.reduce((a, [, p]) => a + (p.talkTimeMs || 0), 0);

    const headers = ['Participant'];
    if (incStay) headers.push('Stay Duration');
    if (incTalk) headers.push('Talk Time');
    if (incMicOpens) headers.push('Mic Opens');
    if (incCam) headers.push('Cam Time');
    if (incCamOpens) headers.push('Cam Opens');
    if (incHands) headers.push('Hands');
    if (incChat) headers.push('Chat');
    if (incRejoins) headers.push('Rejoins');

    const tableRows = parts.map(([name, p]) => {
      const row = [getDisplayName(name)];
      if (incStay) row.push(dur(p.totalStayMs));
      if (incTalk) row.push(dur(p.talkTimeMs));
      if (incMicOpens) row.push(String(p.micOpens || 0));
      if (incCam) row.push(dur(p.cameraTimeMs));
      if (incCamOpens) row.push(String(p.cameraOpens || 0));
      if (incHands) row.push(String(p.handRaises || 0));
      if (incChat) row.push(String(p.chatMessages || 0));
      if (incRejoins) row.push(String(p.rejoins || 0));
      return row;
    });

    const doc = window.NerdMeetPDF.create({
      meetingCode: currentMeetCode,
      startedAt: currentData.startedAt || Date.now(),
      headers,
      rows: tableRows,
      anonymized: anonymize,
      metrics: incKpiHeader ? [
        { label: 'Participants', value: parts.length },
        { label: 'Mic-on time', value: dur(totalTalk) },
        { label: 'Hand raises', value: parts.reduce((sum, [, p]) => sum + (p.handRaises || 0), 0) },
        { label: 'Messages', value: parts.reduce((sum, [, p]) => sum + (p.chatMessages || 0), 0) }
      ] : []
    });

    doc.save(`nerdmeet-${currentMeetCode || 'export'}-report.pdf`);
    closePdfModal();
  }

  function applyPreset(preset) {
    const setAll = (val) => {
      ['colStay', 'colTalk', 'colMicOpens', 'colCam', 'colCamOpens', 'colHands', 'colChat', 'colRejoins'].forEach((id) => {
        const el = $(`#${id}`);
        if (el) el.checked = val;
      });
    };

    if (preset === 'all') {
      setAll(true);
    } else if (preset === 'attendance') {
      setAll(false);
      $('#colStay').checked = true;
      $('#colRejoins').checked = true;
    } else if (preset === 'speech') {
      setAll(false);
      $('#colTalk').checked = true;
      $('#colMicOpens').checked = true;
      $('#colHands').checked = true;
      $('#colChat').checked = true;
    } else if (preset === 'minimal') {
      setAll(false);
      $('#colStay').checked = true;
      $('#colTalk').checked = true;
    }
  }

  async function deleteMeeting(codeToDelete) {
    if (!codeToDelete || !ext?.storage?.local) return;
    const all = await ext.storage.local.get(null);
    await ext.storage.local.remove(`nerdmeet_${codeToDelete}`);
    try {
      localStorage.removeItem(`nerdmeet:${codeToDelete}`);
    } catch (e) {}

    const remainingKeys = Object.keys(all).filter((k) => k.startsWith('nerdmeet_') && k !== 'nerdmeet_latest_meet' && k !== 'nerdmeet_last_updated' && k !== `nerdmeet_${codeToDelete}`);

    if (all.nerdmeet_latest_meet === codeToDelete) {
      if (remainingKeys.length > 0) {
        const nextCode = remainingKeys[0].replace('nerdmeet_', '');
        await ext.storage.local.set({
          nerdmeet_latest_meet: nextCode,
          nerdmeet_last_updated: Date.now()
        });
      } else {
        await ext.storage.local.remove('nerdmeet_latest_meet');
        await ext.storage.local.set({ nerdmeet_last_updated: Date.now() });
      }
    } else {
      await ext.storage.local.set({ nerdmeet_last_updated: Date.now() });
    }

    currentMeetCode = null;
    currentData = null;
    await loadMeetingsList();
  }

  async function deleteAllMeetings() {
    if (!ext?.storage?.local) return;
    const all = await ext.storage.local.get(null);
    const keysToRemove = Object.keys(all).filter((k) => k.startsWith('nerdmeet_'));
    if (keysToRemove.length > 0) {
      await ext.storage.local.remove(keysToRemove);
    }
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith('nerdmeet:')) {
          localStorage.removeItem(k);
        }
      }
    } catch (e) {}

    currentMeetCode = null;
    currentData = null;
    await loadMeetingsList();
  }

  $('#meetingSelect').onchange = async (e) => {
    const val = e.target.value;
    if (val === '__clear_all__') {
      const confirmAll = confirm('Delete ALL tracked meetings from history?');
      if (confirmAll) {
        await deleteAllMeetings();
      } else {
        e.target.value = currentMeetCode || '';
      }
      return;
    }

    currentMeetCode = val;
    const delBtn = $('#btnDeleteMeeting');
    if (delBtn) delBtn.disabled = !currentMeetCode;

    if (currentMeetCode && ext?.storage?.local) {
      const res = await ext.storage.local.get(`nerdmeet_${currentMeetCode}`);
      currentData = res[`nerdmeet_${currentMeetCode}`];
    } else {
      currentData = null;
    }
    render();
  };

  $('#btnDeleteMeeting').onclick = async () => {
    if (!currentMeetCode) return;
    const confirmed = confirm(`Delete meeting "${currentMeetCode}" and its attendance data?`);
    if (!confirmed) return;
    await deleteMeeting(currentMeetCode);
  };

  $('#btnRefresh').onclick = () => loadMeetingsList();

  $('#chkAnonymize').onchange = (e) => {
    anonymize = e.target.checked;
    render();
  };

  $('#filterInput').oninput = (e) => {
    filterQuery = e.target.value;
    render();
  };

  $('#btnExportCSV').onclick = exportCSV;
  $('#btnExportJSON').onclick = exportJSON;
  $('#btnOpenPdfModal').onclick = openPdfModal;
  $('#btnCloseModal').onclick = closePdfModal;
  $('#btnCancelPdf').onclick = closePdfModal;
  $('#btnGeneratePdf').onclick = generateCustomPDF;

  document.querySelectorAll('.preset-btn').forEach((btn) => {
    btn.onclick = () => applyPreset(btn.getAttribute('data-preset'));
  });

  $('#exportModal').onclick = (e) => {
    if (e.target === $('#exportModal')) closePdfModal();
  };

  if (ext?.storage?.onChanged) {
    ext.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        const targetKey = `nerdmeet_${currentMeetCode}`;
        if (changes[targetKey]) {
          currentData = changes[targetKey].newValue;
          render();
        } else if (changes.nerdmeet_latest_meet) {
          if (!currentMeetCode || !currentData) {
            currentMeetCode = changes.nerdmeet_latest_meet.newValue;
          }
          loadMeetingsList();
        }
      }
    });
  }

  setInterval(() => {
    if (currentData && Object.values(currentData.participants || {}).some((p) => p.isHandRaised)) {
      render();
    }
  }, 1000);

  loadMeetingsList();
})();
