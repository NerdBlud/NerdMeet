const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = process.argv[2] ? readFileSync(process.argv[2], 'utf8') : `
<div data-participant-id="local-device"><span class="notranslate">Alice Smith</span>
<button aria-label="Reframe" disabled></button></div>
<button aria-label="Turn on microphone" data-is-muted="true" data-promo-anchor-id="aSBQL"></button>
<div><div jsname="xySENc" aria-live="polite"><div jsname="Ypafjf" class="Ss4fHf ydIQ1d">
${[1,2,3].map(id => `<div data-message-id="message-${id}"><div jsname="dTKtvb"><div>hello</div></div><button role="button" aria-label="Pin message" data-message-id="message-${id}"><i>keep</i></button></div>`).join('')}
</div></div><div role="region"><textarea aria-label="Send a message"></textarea></div></div>`;
const w = new JSDOM(html, { url: 'https://meet.google.com/abc-defg-hij', runScripts: 'outside-only', virtualConsole: new VirtualConsole() }).window;
const source = readFileSync(join(__dirname, '../content-script.js'), 'utf8');
w.eval(source.replace('    buildHud();', '    window.tracker = {scan, data, getSelfName}; return;'));
const t = w.tracker;
const name = t.getSelfName();
assert.ok(name, 'self tile must be recognized without a (You) suffix');
t.scan();
const p = t.data.participants[name];
assert.equal(p.chatMessages, 3, 'count message bodies, exclude nested Pin buttons');
assert.equal(p.isUnmuted, false);
const mic = w.document.querySelector('[data-promo-anchor-id="aSBQL"]');
mic.setAttribute('aria-label', 'Turn off microphone');
mic.setAttribute('data-is-muted', 'false');
t.scan();
assert.equal(p.micOpens, 1);
assert.equal(p.isUnmuted, true);
assert.ok(p.talkTimeMs > 0);
t.scan();
assert.equal(p.micOpens, 1);
assert.equal(p.chatMessages, 3);
mic.setAttribute('aria-label', 'Turn on microphone');
mic.setAttribute('data-is-muted', 'true');
t.scan();
assert.equal(p.isUnmuted, false);
const before = p.talkTimeMs;
t.scan();
assert.equal(p.talkTimeMs, before, 'muted time must not increase');
const message = w.document.querySelector('[data-message-id]:not(button)');
const copy = message.cloneNode(true);
copy.removeAttribute('data-nm-seen');
copy.querySelectorAll('[data-nm-seen]').forEach(el => el.removeAttribute('data-nm-seen'));
copy.setAttribute('data-message-id','new-message');
copy.querySelector('button')?.setAttribute('data-message-id','new-message');
copy.querySelector('[jsname="dTKtvb"]').textContent = 'another message';
message.parentElement.append(copy);
t.scan();
assert.equal(p.chatMessages,4);
t.scan();
assert.equal(p.chatMessages,4);
w.close();
console.log('Passed saved-Meet DOM: self identity, mic opens/time/muting, three messages, appended message, Pin exclusion, deduplication.');
