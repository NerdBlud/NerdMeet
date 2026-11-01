const ext = globalThis.browser || globalThis.chrome;

if (ext.sidePanel?.setPanelBehavior) {
  ext.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
}

ext.action?.onClicked?.addListener(async (tab) => {
  await openAnalyticsPanel(tab);
});

async function openAnalyticsPanel(tab) {
  const windowId = tab?.windowId;

  if (ext.sidePanel?.open && windowId) {
    try {
      await ext.sidePanel.open({ windowId });
      return;
    } catch (e) {
      console.warn('sidePanel.open failed, trying fallbacks:', e);
    }
  }

  if (ext.sidebarAction?.open) {
    try {
      await ext.sidebarAction.open();
      return;
    } catch (e) {
      console.warn('sidebarAction.open failed, trying fallbacks:', e);
    }
  }

  try {
    if (ext.windows?.create) {
      await ext.windows.create({
        url: ext.runtime.getURL('sidepanel.html'),
        type: 'popup',
        width: 420,
        height: 700
      });
      return;
    }
  } catch (e) {
    console.warn('windows.create failed, falling back to tab:', e);
  }

  if (ext.tabs?.create) {
    await ext.tabs.create({ url: ext.runtime.getURL('sidepanel.html') });
  }
}

ext.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OPEN_SIDEPANEL') {
    (async () => {
      try {
        await openAnalyticsPanel(sender.tab);
        sendResponse({ success: true });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true; 
  }

  if (message.type === 'UPDATE_BADGE') {
    (async () => {
      try {
        const tabId = sender.tab?.id;
        const text = message.text || '';
        const color = message.color || '#E5A50A';
        if (ext.action?.setBadgeText) {
          await ext.action.setBadgeText(tabId ? { tabId, text } : { text });
          if (ext.action?.setBadgeBackgroundColor) {
            await ext.action.setBadgeBackgroundColor(tabId ? { tabId, color } : { color });
          }
        }
        sendResponse({ success: true });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === 'SYNC_MEET_DATA') {
    (async () => {
      try {
        const { meetCode, data } = message;
        if (meetCode && data && ext.storage?.local) {
          const key = `nerdmeet_${meetCode}`;
          await ext.storage.local.set({
            [key]: data,
            nerdmeet_latest_meet: meetCode,
            nerdmeet_last_updated: Date.now()
          });
        }
        sendResponse({ success: true });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }
});
