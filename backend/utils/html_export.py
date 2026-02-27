# Standalone HTML presentation template.
# Placeholders: __SLIDES__ (JSON array) and __TITLE__ (JSON string).
# All JS is inline; images use relative <img src> paths — works from file://.

TEMPLATE = """\
<!DOCTYPE html>
<html lang="no">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Presentasjon</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { height: 100%; overflow: hidden; background: #000; color: #fff;
  font-family: system-ui, sans-serif; user-select: none; }
#app { display: flex; flex-direction: column; height: 100vh; }
#header { display: flex; align-items: center; gap: 8px; padding: 10px 16px;
  background: rgba(0,0,0,.6); border-bottom: 1px solid rgba(255,255,255,.05);
  flex-shrink: 0; }
#title { flex: 1; text-align: center; font-size: 13px; color: #d1d5db;
  font-weight: 500; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; padding: 0 8px; }
#counter { font-size: 13px; color: #6b7280; flex-shrink: 0; }
.hbtn { background: none; border: none; color: #9ca3af; cursor: pointer;
  font-size: 13px; padding: 4px 8px; border-radius: 4px; }
.hbtn:hover { color: #fff; background: rgba(255,255,255,.07); }
.hbtn:disabled { opacity: .2; cursor: default; pointer-events: none; }
#notes-btn.has-notes { background: #374151; color: #d1d5db; }
#notes-btn.has-notes.open { background: #1d4ed8; color: #fff; }
#notes-btn.no-notes { opacity: .3; cursor: default; }
#slide-area { flex: 1; min-height: 0; position: relative; overflow: hidden; }
#slide-wrap { position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 16px; padding: 24px;
  transition: opacity .15s ease; }
#slide-wrap img { max-height: 100%; max-width: 100%; object-fit: contain; }
.caption { font-size: 13px; color: #9ca3af; font-style: italic;
  text-align: center; flex-shrink: 0; }
.text-content { max-width: 48rem; width: 100%; }
.text-content h1 { font-size: 2.5rem; font-weight: 700; color: #fff;
  line-height: 1.2; margin-bottom: 1.25rem; }
.text-content h2 { font-size: 1.625rem; font-weight: 600; color: #e5e7eb;
  line-height: 1.3; margin-bottom: 1rem; }
.text-content p { font-size: 1.2rem; color: #d1d5db;
  line-height: 1.7; margin-bottom: .75rem; }
.nav { position: absolute; top: 0; height: 100%; width: 50%; z-index: 10;
  display: flex; align-items: center; cursor: pointer; }
.nav.left { left: 0; padding-left: 20px; }
.nav.right { right: 0; padding-right: 20px; justify-content: flex-end; }
.nav.off { pointer-events: none; }
.nav-arrow { font-size: 4rem; font-weight: 100; color: #fff; opacity: 0;
  transition: opacity .15s; line-height: 1; }
.nav:hover .nav-arrow { opacity: .3; }
#notes-panel { flex-shrink: 0; background: #111827;
  border-top: 1px solid #374151; padding: 14px 24px;
  max-height: 10rem; overflow-y: auto; display: none; }
#notes-panel.open { display: block; }
#notes-label { font-size: 11px; color: #6b7280; text-transform: uppercase;
  letter-spacing: .05em; margin-bottom: 6px; }
#notes-text { font-size: 13px; color: #d1d5db; line-height: 1.6; white-space: pre-wrap; }
</style>
</head>
<body>
<div id="app">
  <div id="header">
    <span id="title"></span>
    <span id="counter"></span>
    <button id="notes-btn" class="hbtn no-notes" title="Notater (N)">N</button>
    <button id="prev-btn" class="hbtn" title="Forrige (&larr;)" disabled>&#8592;</button>
    <button id="next-btn" class="hbtn" title="Neste (&rarr;)">&#8594;</button>
    <button id="fs-btn"   class="hbtn" title="Fullskjerm (F)">&#x26F6;</button>
  </div>
  <div id="slide-area">
    <div class="nav left off" id="prev-zone"><span class="nav-arrow">&#8249;</span></div>
    <div class="nav right"    id="next-zone"><span class="nav-arrow">&#8250;</span></div>
    <div id="slide-wrap"></div>
  </div>
  <div id="notes-panel">
    <div id="notes-label">Notater</div>
    <div id="notes-text"></div>
  </div>
</div>
<script>
const SLIDES = __SLIDES__;
const TITLE  = __TITLE__;

let idx = 0, notesOpen = false, fading = false;

document.getElementById('title').textContent = TITLE;
document.title = TITLE;

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderMarkup(s) {
  return s.trim().split(/\\n{2,}/).map(function(b) {
    var t = b.trim();
    if (t.indexOf('# ')  === 0) return '<h1>' + esc(t.slice(2))  + '</h1>';
    if (t.indexOf('## ') === 0) return '<h2>' + esc(t.slice(3)) + '</h2>';
    return '<p>' + esc(t) + '</p>';
  }).join('');
}

function render() {
  var s = SLIDES[idx];
  document.getElementById('counter').textContent = (idx + 1) + ' / ' + SLIDES.length;

  var atFirst = idx === 0, atLast = idx === SLIDES.length - 1;
  document.getElementById('prev-btn').disabled = atFirst;
  document.getElementById('next-btn').disabled = atLast;
  document.getElementById('prev-zone').className = 'nav left'  + (atFirst ? ' off' : '');
  document.getElementById('next-zone').className = 'nav right' + (atLast  ? ' off' : '');

  var hasNotes = Boolean(s.notes);
  var nb = document.getElementById('notes-btn');
  nb.className = 'hbtn ' + (hasNotes ? ('has-notes' + (notesOpen ? ' open' : '')) : 'no-notes');
  var panel = document.getElementById('notes-panel');
  panel.className = (notesOpen && hasNotes) ? 'open' : '';
  if (hasNotes) document.getElementById('notes-text').textContent = s.notes;

  var wrap = document.getElementById('slide-wrap');
  if (s.kind === 'photo') {
    var cap = (s.caption && !notesOpen) ? '<p class="caption">' + esc(s.caption) + '</p>' : '';
    wrap.innerHTML = '<img src="' + esc(s.src) + '" alt="">' + cap;
  } else {
    wrap.innerHTML = '<div class="text-content">' + renderMarkup(s.markup) + '</div>';
  }
}

function goTo(n) {
  if (n < 0 || n >= SLIDES.length || fading) return;
  var wrap = document.getElementById('slide-wrap');
  fading = true;
  wrap.style.opacity = '0';
  setTimeout(function() { idx = n; render(); wrap.style.opacity = '1'; fading = false; }, 150);
}

document.getElementById('prev-btn').onclick  = function() { goTo(idx - 1); };
document.getElementById('next-btn').onclick  = function() { goTo(idx + 1); };
document.getElementById('prev-zone').onclick = function() { goTo(idx - 1); };
document.getElementById('next-zone').onclick = function() { goTo(idx + 1); };
document.getElementById('fs-btn').onclick = function() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen();
  else document.exitFullscreen();
};
document.getElementById('notes-btn').onclick = function() {
  if (!SLIDES[idx].notes) return;
  notesOpen = !notesOpen;
  render();
};
document.addEventListener('keydown', function(e) {
  if      (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goTo(idx + 1); }
  else if (e.key === 'ArrowLeft')                   { e.preventDefault(); goTo(idx - 1); }
  else if (e.key === 'f' || e.key === 'F')          { document.getElementById('fs-btn').click(); }
  else if (e.key === 'n' || e.key === 'N')          { document.getElementById('notes-btn').click(); }
});

render();
</script>
</body>
</html>
"""
