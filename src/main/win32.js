'use strict';
// Minimal Win32 helpers via koffi. Loaded lazily; on other platforms (or if koffi fails)
// every function is a safe stub returning null/false. HWND/HANDLE are passed as intptr_t.

const stub = {
  available: () => false,
  isWindow: () => false,
  isForeground: () => false,
  getProcessInfo: () => null, // { pid, exePath, startedAt }
  focusWindow: () => false,
  getClientRect: () => null, // client area in screen px: { x, y, width, height }
  getWindowRect: () => null,
  getCursorPos: () => null,
  clipCursor: () => false, // rect {x,y,width,height} or null to release
  moveWindow: () => false, // keep size, move top-left to (x, y)
};

const H = (h) => {
  const n = Number(h);
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
};

function bind(koffi) {
  const u = koffi.load('user32.dll');
  const k = koffi.load('kernel32.dll');
  koffi.struct('POINT', { x: 'int32', y: 'int32' });
  koffi.struct('RECT', { left: 'int32', top: 'int32', right: 'int32', bottom: 'int32' });
  koffi.struct('FILETIME', { lo: 'uint32', hi: 'uint32' });
  const f = (lib, proto) => lib.func(proto);

  const GetWindowThreadProcessId = f(u, 'uint32 __stdcall GetWindowThreadProcessId(intptr_t hWnd, _Out_ uint32 *pid)');
  const IsWindow = f(u, 'int __stdcall IsWindow(intptr_t hWnd)');
  const IsIconic = f(u, 'int __stdcall IsIconic(intptr_t hWnd)');
  const ShowWindow = f(u, 'int __stdcall ShowWindow(intptr_t hWnd, int cmd)');
  const SetForegroundWindow = f(u, 'int __stdcall SetForegroundWindow(intptr_t hWnd)');
  const GetForegroundWindow = f(u, 'intptr_t __stdcall GetForegroundWindow()');
  const GetClientRect = f(u, 'int __stdcall GetClientRect(intptr_t hWnd, _Out_ RECT *r)');
  const ClientToScreen = f(u, 'int __stdcall ClientToScreen(intptr_t hWnd, _Inout_ POINT *p)');
  const GetCursorPos = f(u, 'int __stdcall GetCursorPos(_Out_ POINT *p)');
  const ClipCursor = f(u, 'int __stdcall ClipCursor(const RECT *r)');
  const SetWindowPos = f(u, 'int __stdcall SetWindowPos(intptr_t hWnd, intptr_t after, int x, int y, int cx, int cy, uint32 flags)');
  const GetWindowRect = f(u, 'int __stdcall GetWindowRect(intptr_t hWnd, _Out_ RECT *r)');
  const keybd_event = f(u, 'void __stdcall keybd_event(uint8 vk, uint8 scan, uint32 flags, uintptr_t extra)');
  const OpenProcess = f(k, 'intptr_t __stdcall OpenProcess(uint32 access, int inherit, uint32 pid)');
  const QueryFullProcessImageNameW = f(k, 'int __stdcall QueryFullProcessImageNameW(intptr_t h, uint32 flags, void *buf, _Inout_ uint32 *size)');
  const GetProcessTimes = f(k, 'int __stdcall GetProcessTimes(intptr_t h, _Out_ FILETIME *c, _Out_ FILETIME *e, _Out_ FILETIME *k, _Out_ FILETIME *u)');
  const CloseHandle = f(k, 'int __stdcall CloseHandle(intptr_t h)');

  const SW_RESTORE = 9, VK_MENU = 0x12, KEYEVENTF_KEYUP = 2;
  const SWP_NOSIZE = 0x1, SWP_NOZORDER = 0x4, SWP_NOACTIVATE = 0x10;
  const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;
  const rectOut = (r) => ({ x: r.left, y: r.top, width: r.right - r.left, height: r.bottom - r.top });

  return {
    available: () => true,
    isWindow: (h) => !!H(h) && !!IsWindow(H(h)),
    isForeground: (h) => !!H(h) && Number(GetForegroundWindow()) === H(h),

    getProcessInfo(h) {
      const pid = [0];
      if (!H(h) || !GetWindowThreadProcessId(H(h), pid) || !pid[0]) return null;
      const proc = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid[0]);
      if (!proc) return { pid: pid[0], exePath: null, startedAt: null };
      try {
        const buf = Buffer.alloc(2048), size = [1024];
        const exePath = QueryFullProcessImageNameW(proc, 0, buf, size) ? buf.toString('utf16le', 0, size[0] * 2) : null;
        const c = {}, e = {}, kt = {}, ut = {};
        // FILETIME = 100ns ticks since 1601 -> unix ms
        const startedAt = GetProcessTimes(proc, c, e, kt, ut) ? Math.round((c.hi * 4294967296 + c.lo) / 1e4 - 11644473600000) : null;
        return { pid: pid[0], exePath, startedAt };
      } finally {
        CloseHandle(proc);
      }
    },

    focusWindow(h) {
      if (!H(h) || !IsWindow(H(h))) return false;
      if (IsIconic(H(h))) ShowWindow(H(h), SW_RESTORE);
      // Tapping Alt lets a background process take the foreground.
      keybd_event(VK_MENU, 0, 0, 0);
      const ok = !!SetForegroundWindow(H(h));
      keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, 0);
      return ok;
    },

    getClientRect(h) {
      const r = {}, p = { x: 0, y: 0 };
      if (!H(h) || !GetClientRect(H(h), r) || !ClientToScreen(H(h), p)) return null;
      return { x: p.x, y: p.y, width: r.right - r.left, height: r.bottom - r.top };
    },

    getWindowRect(h) {
      const r = {};
      return H(h) && GetWindowRect(H(h), r) ? rectOut(r) : null;
    },

    getCursorPos() {
      const p = {};
      return GetCursorPos(p) ? { x: p.x, y: p.y } : null;
    },

    clipCursor(rect) {
      const r = rect ? { left: rect.x, top: rect.y, right: rect.x + rect.width, bottom: rect.y + rect.height } : null;
      return !!ClipCursor(r);
    },

    moveWindow(h, x, y) {
      if (!H(h) || !IsWindow(H(h))) return false;
      if (IsIconic(H(h))) ShowWindow(H(h), SW_RESTORE);
      return !!SetWindowPos(H(h), 0, Math.round(x), Math.round(y), 0, 0, SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE);
    },
  };
}

let impl = null;
function get() {
  if (impl) return impl;
  impl = stub;
  if (process.platform === 'win32') {
    try {
      impl = bind(require('koffi'));
    } catch (err) {
      console.warn('[win32] native bindings unavailable:', err.message);
    }
  }
  return impl;
}

// Every export is crash-proof: native errors fall back to the stub result.
module.exports = Object.fromEntries(Object.keys(stub).map((name) => [name, (...args) => {
  try {
    return get()[name](...args);
  } catch (err) {
    console.warn(`[win32] ${name} failed:`, err.message);
    return stub[name]();
  }
}]));
