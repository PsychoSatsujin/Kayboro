// Pop-out mode (index.html?popout=<screen id>): this window shows one screen of the main window's scene,
// sized exactly to its shell, on a transparent background with no chrome, outline or handles. The mouse
// only belongs to this window over the console: opaque shell pixels drag it, the shell's outer edge
// resizes it (resize cursor, nothing drawn), the screen opening starts play mode, Ctrl+wheel resizes,
// right-click opens the menu. Everywhere else clicks fall through to the
// desktop (main toggles setIgnoreMouseEvents from our hit reports; forwarded moves keep them coming).
const ALPHA_HIT = 24; // shell pixels at or above this alpha belong to the console
const ZOOM = 1.08;
const EDGE = 12; // px from the window's border where the shell resizes instead of dragging
const RESIZE = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize' };

export async function bootPopout(app, id, Stage) {
  const { ror } = app;
  document.body.classList.add('popout');
  document.documentElement.classList.add('popout');
  app.popout = id;
  app.playId = id;
  const info = await ror.popoutInfo().catch(() => null);
  if (!info?.screen) { window.close(); return null; }

  const s = { ...info.screen, id, rect: { x: 0, y: 0, w: 1, h: 1 }, visible: true, z: 1 };
  app.scene = { screens: [s], selectedId: null, background: { type: 'color', color: 'transparent' } };
  const stage = new Stage(app, document.getElementById('stage'));
  const alpha = { url: '', w: 0, h: 0, data: null };

  // The screen fills the shell's opening; the shell fills the window. The alpha map is rebuilt once a
  // resize settles (not on every step of an edge drag).
  let alphaTimer = 0;
  function fit() {
    const f = app.frameOf(s), W = innerWidth, H = innerHeight;
    s.rect = f ? { x: f.hole.x * W, y: f.hole.y * H, w: f.hole.w * W, h: f.hole.h * H } : { x: 0, y: 0, w: W, h: H };
    stage.render();
    clearTimeout(alphaTimer);
    alphaTimer = setTimeout(() => loadAlpha(f), 120);
  }

  // Shell alpha at window size, read through a data URL so the canvas is never tainted.
  async function loadAlpha(f) {
    const W = innerWidth, H = innerHeight, url = f?.url || '';
    if (!url) return Object.assign(alpha, { url: '', w: W, h: H, data: null });
    if (alpha.url === url && alpha.w === W && alpha.h === H) return;
    Object.assign(alpha, { url, w: W, h: H, data: null });
    const src = await ror.popoutFrame(url).catch(() => null);
    if (!src || alpha.url !== url) return;
    const img = new Image();
    img.src = src;
    try { await img.decode(); } catch { return; }
    const c = Object.assign(document.createElement('canvas'), { width: W, height: H }), g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, W, H);
    if (alpha.url === url && alpha.w === W && alpha.h === H) alpha.data = g.getImageData(0, 0, W, H).data;
  }

  const inHole = (x, y) => x >= s.rect.x && y >= s.rect.y && x < s.rect.x + s.rect.w && y < s.rect.y + s.rect.h;
  function onShell(x, y) {
    if (inHole(x, y)) return true;
    if (!app.frameOf(s)) return true;
    if (!alpha.data) return true; // not loaded yet: the whole window counts until it is
    const px = Math.floor(x), py = Math.floor(y);
    return px >= 0 && py >= 0 && px < alpha.w && py < alpha.h && alpha.data[(py * alpha.w + px) * 4 + 3] >= ALPHA_HIT;
  }

  // Which edge or corner of the shell (n, se, ...) the point is on, or '' (only on the shell itself).
  function edgeAt(x, y) {
    if (inHole(x, y) || !onShell(x, y)) return '';
    return (y < EDGE ? 'n' : y >= innerHeight - EDGE ? 's' : '') + (x < EDGE ? 'w' : x >= innerWidth - EDGE ? 'e' : '');
  }
  const showEdge = (edge) => {
    document.body.toggleAttribute('data-edge', !!edge);
    document.body.style.setProperty('--edge-cursor', RESIZE[edge] || 'auto');
  };

  let hit = null, dragging = false;
  const report = (h) => { if (h !== hit) { hit = h; ror.popoutHit(h).catch(() => {}); } };
  addEventListener('mousemove', (e) => {
    if (app.playing || dragging) return;
    report(onShell(e.clientX, e.clientY));
    showEdge(edgeAt(e.clientX, e.clientY));
  });
  document.documentElement.addEventListener('mouseleave', () => { if (!dragging) { report(false); showEdge(''); } });

  addEventListener('pointerdown', (e) => {
    if (app.playing || e.button !== 0 || !onShell(e.clientX, e.clientY)) return;
    if (e.target.closest?.('.arcade-host')) return; // Fandom Clash is played right here: clicks belong to the game
    e.preventDefault();
    if (inHole(e.clientX, e.clientY)) return void play();
    const edge = edgeAt(e.clientX, e.clientY);
    dragging = true;
    (edge ? ror.popoutResizeDrag(edge) : ror.popoutDrag(true)).catch(() => {});
    const end = () => {
      dragging = false;
      showEdge('');
      (edge ? ror.popoutResizeDrag(null) : ror.popoutDrag(false)).catch(() => {});
      removeEventListener('pointerup', end);
      removeEventListener('pointercancel', end);
    };
    addEventListener('pointerup', end);
    addEventListener('pointercancel', end);
  }, true);
  addEventListener('contextmenu', (e) => { e.preventDefault(); if (onShell(e.clientX, e.clientY)) ror.popoutMenu().catch(() => {}); });
  addEventListener('wheel', (e) => {
    if (!e.ctrlKey || !onShell(e.clientX, e.clientY)) return;
    e.preventDefault();
    ror.popoutResize(e.deltaY < 0 ? ZOOM : 1 / ZOOM).catch(() => {});
  }, { passive: false });
  addEventListener('keydown', (e) => {
    if (e.key === '+' || e.key === '=') ror.popoutResize(ZOOM).catch(() => {});
    else if (e.key === '-' || e.key === '_') ror.popoutResize(1 / ZOOM).catch(() => {});
  });

  // Click in the opening: play the game inside this console (Ctrl+Alt+P gives the mouse back).
  async function play() {
    const hwnd = s.hwnd || (await ror.detectSteamGame().catch(() => null))?.hwnd;
    if (!hwnd) return hint('Pick a game window for this screen in Kayboro first.');
    if (await ror.startPlay(hwnd, id, stage.playRect(s)).catch(() => false)) hint('Playing. Press Ctrl+Alt+P to take the mouse back.');
  }

  let hintTimer = 0;
  function hint(text) {
    let el = document.getElementById('popoutHint');
    if (!el) { el = Object.assign(document.createElement('div'), { id: 'popoutHint', role: 'status' }); document.body.append(el); }
    el.textContent = text;
    el.hidden = false;
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => { el.hidden = true; }, 2600);
  }

  ror.onPlayState((p) => {
    if (!p) return;
    app.playing = !!p.playing;
    document.body.classList.toggle('playing', app.playing);
    if (!app.playing) stage.showCursor(null);
  });
  ror.onCursor((c) => { if (app.playing && c) stage.showCursor(s, c.u, c.v, c.inside); });
  ror.onPopout((ev) => {
    if (ev?.type === 'screen' && ev.screen) {
      const keep = { id, rect: s.rect, visible: true, z: 1 };
      Object.assign(s, ev.screen, keep);
      document.title = `Kayboro: ${s.sourceName || 'Shell'}`;
      fit();
    } else if (ev?.type === 'rehit') hit = null;
    else if (ev?.type === 'playRequest') play();
  });
  addEventListener('storage', (e) => { // effect switches flipped in the main window
    if (e.key === 'kayboro.fx') { try { app.fxPrefs = { particles: true, glass: true, depth: true, ...JSON.parse(e.newValue) }; } catch {} stage.render(); }
  });
  addEventListener('resize', fit);
  fit();
  return stage;
}
