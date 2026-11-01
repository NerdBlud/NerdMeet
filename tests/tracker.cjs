const { readFileSync } = require('node:fs');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const source = readFileSync(require('node:path').join(__dirname, '../content-script.js'), 'utf8');
const dom = new JSDOM(`<div data-self-name="Alice Smith"></div>
<button aria-label="Microphone settings">mic_off</button>
<button id="mic" aria-labelledby="mic-label"><span>mic</span></button>
<span id="mic-label">Turn off microphone (ctrl + d)</span>
<button id="hand" aria-label="Raise hand" aria-pressed="true"><span>front_hand</span></button>
<section id="chat"><div data-sender-name="Alice Smith" data-message-id="group1">
<div dir="auto">hello</div><div dir="auto">hello</div><div dir="auto">hello</div><div dir="auto">hello</div>
</div><div role="region"><textarea aria-label="Send a message"></textarea></div></section>`, {
  url: 'https://meet.google.com/abc-defg-hij', runScripts: 'outside-only'
});
const { window } = dom;
window.eval(source.replace('    buildHud();', '    window.tracker = { scan, data, readLocalToggle }; return;'));
const t = window.tracker;
assert.equal(t.readLocalToggle('mic'), true);
assert.equal(t.readLocalToggle('hand'), true);
t.scan();
let p = t.data.participants['Alice Smith'];
assert.equal(p.micOpens, 1);
assert.equal(p.handRaises, 1);
assert.equal(p.chatMessages, 4);
t.scan();
assert.equal(p.chatMessages, 4, 'rescanning must not duplicate messages');
window.document.getElementById('mic-label').textContent = 'Turn on microphone (ctrl + d)';
window.document.getElementById('hand').setAttribute('aria-pressed', 'false');
t.scan(); t.scan();
assert.equal(p.isUnmuted, false);
assert.equal(p.isHandRaised, false);
window.document.getElementById('mic-label').textContent = 'Turn off microphone (ctrl + d)';
t.scan();
assert.equal(p.micOpens, 2);
window.document.querySelector('[data-message-id]').insertAdjacentHTML('beforeend', '<div dir="auto">hello</div>');
t.scan();
assert.equal(p.chatMessages, 5, 'identical messages are separate sends');
window.document.querySelector('[data-message-id]').insertAdjacentHTML('beforeend', '<div dir="auto">different message</div>');
t.scan();
assert.equal(p.chatMessages, 6, 'different messages in the same group count independently');
window.document.getElementById('chat').remove();
window.document.body.insertAdjacentHTML('beforeend', '<div role="status">A generic announcement</div>');
t.scan();
assert.equal(p.chatMessages, 6, 'status announcements are not messages');
assert.equal(readFileSync(require('node:path').join(__dirname, '../nerdmeet.user.js'), 'utf8').slice(readFileSync(require('node:path').join(__dirname, '../nerdmeet.user.js'), 'utf8').indexOf('(() => {')), source);
window.close();
console.log('Passed: microphone toggles, hand transitions, repeated messages, deduplication, announcements, userscript parity.');
