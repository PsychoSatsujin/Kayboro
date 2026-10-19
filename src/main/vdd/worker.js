'use strict';
// Virtual screen driver control, run in a worker thread: every call here is a blocking Win32 call, and a
// driver that stops answering must never freeze Kayboro's main process (which also drives play mode).
//
// Backends, best first:
//   kayboro  the Kayboro Virtual Screen Driver (driver/, Root\KayboroVDD): screens at any resolution
//   parsec   the Parsec Virtual Display Adapter, if the user has it (protocol from nomi-san/parsec-vdd, BSD-2)
// Both unplug their screens on their own when the pings stop, so a crash never strands a game on an
// invisible monitor.
//
// Messages in:  { id, op: 'status' | 'add' | 'remove' | 'removeAll' | 'displays' | 'place', args }
// Messages out: { id, ok, result } or { id, ok: false, error }
const { parentPort } = require('worker_threads');

const KAYBORO = {
  guid: '633cce24-bc1a-43cb-9ad2-5147803bced6',
  INFO: ioctl(0x900), ADD: ioctl(0x901), REMOVE: ioctl(0x902), PING: ioctl(0x903), ALL: 0xffffffff,
  adapter: /kayboro virtual screen/i,
};
const PARSEC = {
  guid: '00b41627-04c4-429e-a26e-0265cf50c8fa',
  ADD: 0x0022e004, REMOVE: 0x0022a008, UPDATE: 0x0022a00c, VERSION: 0x0022e010,
  adapter: /parsec virtual display/i,
};
function ioctl(fn) { return ((0x22 << 16) | (fn << 2)) >>> 0; } // CTL_CODE(FILE_DEVICE_UNKNOWN, fn, METHOD_BUFFERED, FILE_ANY_ACCESS)

let k = null; // Win32 bindings
let backend = null; // { name, handle, screens: Map(index -> {width, height}) }
let pinger = null;

function bind() {
  const koffi = require('koffi');
  const setupapi = koffi.load('setupapi.dll'), kernel32 = koffi.load('kernel32.dll'), user32 = koffi.load('user32.dll'), shell32 = koffi.load('shell32.dll');
  koffi.struct('KB_GUID', { Data1: 'uint32', Data2: 'uint16', Data3: 'uint16', Data4: koffi.array('uint8', 8) });
  koffi.struct('KB_SEI', { cbSize: 'uint32', fMask: 'uint32', hwnd: 'intptr', lpVerb: 'const char16_t *', lpFile: 'const char16_t *',
    lpParameters: 'const char16_t *', lpDirectory: 'const char16_t *', nShow: 'int', hInstApp: 'intptr', lpIDList: 'void *',
    lpClass: 'const char16_t *', hkeyClass: 'intptr', dwHotKey: 'uint32', hIconOrMonitor: 'intptr', hProcess: 'intptr' });
  koffi.struct('KB_IFDATA', { cbSize: 'uint32', InterfaceClassGuid: 'KB_GUID', Flags: 'uint32', Reserved: 'uintptr' });
  const f = (lib, proto) => lib.func(proto);
  return {
    SetupDiGetClassDevsW: f(setupapi, 'intptr __stdcall SetupDiGetClassDevsW(const KB_GUID *g, const char16_t *e, intptr p, uint32 flags)'),
    SetupDiEnumDeviceInterfaces: f(setupapi, 'int __stdcall SetupDiEnumDeviceInterfaces(intptr devs, void *info, const KB_GUID *g, uint32 i, _Inout_ KB_IFDATA *d)'),
    SetupDiGetDeviceInterfaceDetailW: f(setupapi, 'int __stdcall SetupDiGetDeviceInterfaceDetailW(intptr devs, KB_IFDATA *d, void *detail, uint32 size, _Out_ uint32 *need, void *info)'),
    SetupDiDestroyDeviceInfoList: f(setupapi, 'int __stdcall SetupDiDestroyDeviceInfoList(intptr devs)'),
    CreateFileW: f(kernel32, 'intptr __stdcall CreateFileW(const char16_t *name, uint32 access, uint32 share, void *sa, uint32 disp, uint32 flags, intptr tpl)'),
    DeviceIoControl: f(kernel32, 'int __stdcall DeviceIoControl(intptr h, uint32 code, void *inBuf, uint32 inSize, void *outBuf, uint32 outSize, _Out_ uint32 *got, void *ov)'),
    CreateEventW: f(kernel32, 'intptr __stdcall CreateEventW(void *sa, int manual, int initial, const char16_t *name)'),
    GetOverlappedResultEx: f(kernel32, 'int __stdcall GetOverlappedResultEx(intptr h, void *ov, _Out_ uint32 *got, uint32 ms, int alertable)'),
    CancelIoEx: f(kernel32, 'int __stdcall CancelIoEx(intptr h, void *ov)'),
    CloseHandle: f(kernel32, 'int __stdcall CloseHandle(intptr h)'),
    EnumDisplayDevicesW: f(user32, 'int __stdcall EnumDisplayDevicesW(const char16_t *dev, uint32 i, void *dd, uint32 flags)'),
    EnumDisplaySettingsW: f(user32, 'int __stdcall EnumDisplaySettingsW(const char16_t *dev, uint32 mode, void *dm)'),
    ChangeDisplaySettingsExW: f(user32, 'int32 __stdcall ChangeDisplaySettingsExW(const char16_t *dev, void *dm, intptr hwnd, uint32 flags, void *lparam)'),
    ShellExecuteExW: f(shell32, 'int __stdcall ShellExecuteExW(_Inout_ KB_SEI *info)'),
    WaitForSingleObject: f(kernel32, 'uint32 __stdcall WaitForSingleObject(intptr h, uint32 ms)'),
    GetExitCodeProcess: f(kernel32, 'int __stdcall GetExitCodeProcess(intptr h, _Out_ uint32 *code)'),
    seiSize: koffi.sizeof('KB_SEI'),
  };
}

const INVALID = -1;
const guidOf = (s) => {
  const h = s.replace(/-/g, '');
  return { Data1: parseInt(h.slice(0, 8), 16), Data2: parseInt(h.slice(8, 12), 16), Data3: parseInt(h.slice(12, 16), 16),
    Data4: Array.from({ length: 8 }, (_, i) => parseInt(h.slice(16 + i * 2, 18 + i * 2), 16)) };
};

// Opens the first present device interface of `guid`, or returns null.
function openInterface(guid, overlapped) {
  const g = guidOf(guid);
  const devs = k.SetupDiGetClassDevsW(g, null, 0, 0x2 | 0x10); // DIGCF_PRESENT | DIGCF_DEVICEINTERFACE
  if (!devs || Number(devs) === INVALID) return null;
  try {
    const d = { cbSize: 32, InterfaceClassGuid: g, Flags: 0, Reserved: 0 };
    if (!k.SetupDiEnumDeviceInterfaces(devs, null, g, 0, d)) return null;
    const need = [0];
    k.SetupDiGetDeviceInterfaceDetailW(devs, d, null, 0, need, null);
    if (!need[0]) return null;
    const detail = Buffer.alloc(need[0] + 8);
    detail.writeUInt32LE(8, 0); // sizeof(SP_DEVICE_INTERFACE_DETAIL_DATA_W) on x64
    if (!k.SetupDiGetDeviceInterfaceDetailW(devs, d, detail, detail.length, need, null)) return null;
    const path = detail.toString('utf16le', 4).split('\0')[0]; // DevicePath follows the 4-byte cbSize
    const GENERIC_RW = 0xc0000000, SHARE_RW = 3, OPEN_EXISTING = 3;
    const flags = overlapped ? 0x80 | 0x20000000 | 0x40000000 | 0x80000000 : 0x80; // NORMAL | NO_BUFFERING | OVERLAPPED | WRITE_THROUGH
    const h = k.CreateFileW(path, GENERIC_RW, SHARE_RW, null, OPEN_EXISTING, flags, 0);
    return !h || Number(h) === INVALID ? null : h;
  } finally {
    k.SetupDiDestroyDeviceInfoList(devs);
  }
}

// Kayboro driver: plain synchronous IOCTLs (it completes every request immediately).
function kbIoctl(h, code, inBuf, outSize = 0) {
  const out = outSize ? Buffer.alloc(outSize) : null, got = [0];
  const ok = k.DeviceIoControl(h, code, inBuf, inBuf ? inBuf.length : 0, out, outSize, got, null);
  return ok ? out || Buffer.alloc(0) : null;
}

// Parsec driver: overlapped IOCTL with a 32-byte input buffer and a DWORD result, 5 s timeout.
function parsecIoctl(h, code, data) {
  const inBuf = Buffer.alloc(32), out = Buffer.alloc(4), ov = Buffer.alloc(32), got = [0];
  if (data) data.copy(inBuf, 0, 0, Math.min(32, data.length));
  const ev = k.CreateEventW(null, 1, 0, null);
  if (!ev) return -1;
  try {
    ov.writeBigInt64LE(BigInt(ev), 24); // OVERLAPPED.hEvent
    k.DeviceIoControl(h, code, inBuf, 32, out, 4, got, ov);
    if (!k.GetOverlappedResultEx(h, ov, got, 5000, 0)) { k.CancelIoEx(h, ov); return -1; }
    return out.readInt32LE(0);
  } finally {
    k.CloseHandle(ev);
  }
}

function connect() {
  if (backend) return backend;
  let h = openInterface(KAYBORO.guid, false);
  if (h) {
    const info = kbIoctl(h, KAYBORO.INFO, null, 16);
    if (info) {
      backend = { name: 'kayboro', handle: h, screens: new Map(), version: info.readUInt32LE(0), max: info.readUInt32LE(4), ready: !!info.readUInt32LE(12) };
      pinger = setInterval(() => kbIoctl(h, KAYBORO.PING, null), 500);
      return backend;
    }
    k.CloseHandle(h);
  }
  h = openInterface(PARSEC.guid, true);
  if (h) {
    const v = parsecIoctl(h, PARSEC.VERSION);
    backend = { name: 'parsec', handle: h, screens: new Map(), version: v, max: 8, ready: v >= 0 };
    pinger = setInterval(() => parsecIoctl(h, PARSEC.UPDATE), 50); // the Parsec driver unplugs after ~1 s without updates
    return backend;
  }
  return null;
}

// Every display attached to the desktop: { device, adapter, x, y, width, height } in physical pixels.
function displays() {
  const out = [];
  const dd = Buffer.alloc(840), dm = Buffer.alloc(220);
  for (let i = 0; ; i++) {
    dd.fill(0); dd.writeUInt32LE(840, 0);
    if (!k.EnumDisplayDevicesW(null, i, dd, 0)) break;
    const flags = dd.readUInt32LE(324);
    if (!(flags & 1)) continue; // DISPLAY_DEVICE_ATTACHED_TO_DESKTOP
    const device = dd.toString('utf16le', 4, 68).replace(/\0.*$/s, '');
    const adapter = dd.toString('utf16le', 68, 324).replace(/\0.*$/s, '');
    dm.fill(0); dm.writeUInt16LE(220, 68);
    if (!k.EnumDisplaySettingsW(device, 0xffffffff, dm)) continue; // ENUM_CURRENT_SETTINGS
    out.push({ device, adapter, x: dm.readInt32LE(76), y: dm.readInt32LE(80), width: dm.readUInt32LE(172), height: dm.readUInt32LE(176), hz: dm.readUInt32LE(184) });
  }
  return out;
}

// Moves `device` so it only touches the rest of the desktop at its bottom-right corner (the mouse can't
// wander onto it by accident), optionally at a new resolution. Returns the new placement.
function place(device, size) {
  const all = displays(), me = all.find((d) => d.device === device);
  if (!me) return null;
  const others = all.filter((d) => d.device !== device);
  const right = Math.max(...others.map((d) => d.x + d.width)), bottom = Math.max(...others.map((d) => d.y + d.height));
  const dm = Buffer.alloc(220);
  dm.writeUInt16LE(220, 68);
  if (!k.EnumDisplaySettingsW(device, 0xffffffff, dm)) return null;
  let fields = 0x20; // DM_POSITION
  dm.writeInt32LE(Number.isFinite(right) ? right : 0, 76);
  dm.writeInt32LE(Number.isFinite(bottom) ? bottom : 0, 80);
  if (size?.width && size?.height) { dm.writeUInt32LE(size.width, 172); dm.writeUInt32LE(size.height, 176); fields |= 0x80000 | 0x100000; } // DM_PELSWIDTH | DM_PELSHEIGHT
  dm.writeUInt32LE(fields, 72);
  const CDS_UPDATEREGISTRY = 1, CDS_NORESET = 0x10000000;
  const r = k.ChangeDisplaySettingsExW(device, dm, 0, CDS_UPDATEREGISTRY | CDS_NORESET, null);
  k.ChangeDisplaySettingsExW(null, null, 0, 0, null); // apply
  return { result: r, display: displays().find((d) => d.device === device) || null };
}

// Runs kbvdd-setup.exe elevated: Windows shows its administrator prompt, the player decides. Waits up to
// two minutes. { started, exitCode } (exit 4 = installed, restart Windows to finish).
function runElevated(file, args) {
  const sei = { cbSize: k.seiSize, fMask: 0x40 | 0x100 | 0x400, hwnd: 0, lpVerb: 'runas', lpFile: file, lpParameters: args, // NOCLOSEPROCESS | NOASYNC | FLAG_NO_UI
    lpDirectory: null, nShow: 0, hInstApp: 0, lpIDList: null, lpClass: null, hkeyClass: 0, dwHotKey: 0, hIconOrMonitor: 0, hProcess: 0 };
  if (!k.ShellExecuteExW(sei) || !sei.hProcess) return { started: false, exitCode: null }; // declined, or not found
  try {
    if (k.WaitForSingleObject(sei.hProcess, 120000) !== 0) return { started: true, exitCode: null };
    const code = [0];
    return { started: true, exitCode: k.GetExitCodeProcess(sei.hProcess, code) ? code[0] : null };
  } finally {
    k.CloseHandle(sei.hProcess);
  }
}

// Forgets the connected driver so the next request looks again (after installing or removing one).
function reset() {
  clearInterval(pinger);
  pinger = null;
  if (backend) { try { OPS.removeAll(); } catch {} k.CloseHandle(backend.handle); }
  backend = null;
}

const OPS = {
  status() {
    const b = connect();
    const virt = displays().filter((d) => KAYBORO.adapter.test(d.adapter) || PARSEC.adapter.test(d.adapter));
    return { backend: b ? b.name : null, version: b ? b.version : null, ready: !!b?.ready, max: b?.max || 0,
      screens: b ? [...b.screens.entries()].map(([index, s]) => ({ index, ...s })) : [], virtualDisplays: virt };
  },
  add({ width = 1920, height = 1080, refresh = 60 } = {}) {
    const b = connect();
    if (!b) throw new Error('no virtual screen driver');
    let index;
    if (b.name === 'kayboro') {
      const req = Buffer.alloc(16);
      req.writeUInt32LE(width, 0); req.writeUInt32LE(height, 4); req.writeUInt32LE(refresh, 8);
      const out = kbIoctl(b.handle, KAYBORO.ADD, req, 4);
      if (!out) throw new Error('the Kayboro driver refused the screen');
      index = out.readUInt32LE(0);
    } else {
      index = parsecIoctl(b.handle, PARSEC.ADD);
      parsecIoctl(b.handle, PARSEC.UPDATE);
      if (index < 0) throw new Error('the Parsec driver refused the screen');
    }
    b.screens.set(index, { width, height, refresh });
    return { backend: b.name, index };
  },
  remove({ index }) {
    const b = connect();
    if (!b || !b.screens.has(index)) return false;
    if (b.name === 'kayboro') {
      const req = Buffer.alloc(4);
      req.writeUInt32LE(index >>> 0, 0);
      kbIoctl(b.handle, KAYBORO.REMOVE, req);
    } else {
      const req = Buffer.alloc(2);
      req.writeUInt16BE(index & 0xffff, 0); // the driver reads the index byte-swapped
      parsecIoctl(b.handle, PARSEC.REMOVE, req);
      parsecIoctl(b.handle, PARSEC.UPDATE);
    }
    b.screens.delete(index);
    return true;
  },
  removeAll() {
    const b = backend;
    if (!b) return 0;
    const n = b.screens.size;
    for (const index of [...b.screens.keys()].sort((x, y) => y - x)) OPS.remove({ index }); // right to left
    return n;
  },
  displays,
  place: ({ device, size }) => place(device, size),
  installDriver({ file }) {
    const r = runElevated(file, 'install');
    reset();
    return { ...r, ok: r.exitCode === 0 || r.exitCode === 4, restart: r.exitCode === 4 };
  },
};

try {
  k = bind();
} catch (err) {
  k = null;
  parentPort.postMessage({ id: 0, ok: false, error: `native bindings unavailable: ${err.message}` });
}

parentPort.on('message', ({ id, op, args }) => {
  try {
    if (!k) throw new Error('native bindings unavailable');
    if (!OPS[op]) throw new Error(`unknown op ${op}`);
    parentPort.postMessage({ id, ok: true, result: OPS[op](args || {}) });
  } catch (err) {
    parentPort.postMessage({ id, ok: false, error: String(err && err.message || err) });
  }
});

// Unplug our screens when the worker goes away (Kayboro quitting); the drivers' own timeouts are the backstop.
process.on('exit', () => { try { OPS.removeAll(); } catch {} clearInterval(pinger); });
