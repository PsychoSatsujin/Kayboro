// Kayboro Virtual Screen Driver (KBVDD): the control contract between the driver and its clients
// (Kayboro's main process and kbvdd-setup.exe). Plain little-endian structs, METHOD_BUFFERED IOCTLs.
// Kayboro mirrors these values in src/main/vdd/kayboro.js; keep both in sync.
#pragma once

#include <windows.h>
#include <winioctl.h>

// Device interface the driver registers; clients open it with SetupDiGetClassDevs(DIGCF_DEVICEINTERFACE).
// {633cce24-bc1a-43cb-9ad2-5147803bced6}
DEFINE_GUID(GUID_DEVINTERFACE_KBVDD, 0x633cce24, 0xbc1a, 0x43cb, 0x9a, 0xd2, 0x51, 0x47, 0x80, 0x3b, 0xce, 0xd6);

#define KBVDD_HARDWARE_ID L"Root\\KayboroVDD"
#define KBVDD_VERSION 0x00010000u // 1.0: major << 16 | minor
#define KBVDD_MAX_MONITORS 4
#define KBVDD_ALL 0xFFFFFFFFu
// Screens are unplugged when no IOCTL arrives for this long (the client crashed or quit).
#define KBVDD_WATCHDOG_MS 3000

// out: KBVDD_INFO
#define IOCTL_KBVDD_INFO CTL_CODE(FILE_DEVICE_UNKNOWN, 0x900, METHOD_BUFFERED, FILE_ANY_ACCESS)
// in: KBVDD_ADD_IN, out: UINT32 connector index of the new screen
#define IOCTL_KBVDD_ADD CTL_CODE(FILE_DEVICE_UNKNOWN, 0x901, METHOD_BUFFERED, FILE_ANY_ACCESS)
// in: UINT32 connector index, or KBVDD_ALL
#define IOCTL_KBVDD_REMOVE CTL_CODE(FILE_DEVICE_UNKNOWN, 0x902, METHOD_BUFFERED, FILE_ANY_ACCESS)
// no buffers: keeps the screens alive (send at least every second)
#define IOCTL_KBVDD_PING CTL_CODE(FILE_DEVICE_UNKNOWN, 0x903, METHOD_BUFFERED, FILE_ANY_ACCESS)

#pragma pack(push, 4)
typedef struct _KBVDD_INFO {
    UINT32 Version;     // KBVDD_VERSION
    UINT32 MaxMonitors; // KBVDD_MAX_MONITORS
    UINT32 ActiveMask;  // bit i set: connector i has a screen plugged in
    UINT32 Ready;       // 1 once the display adapter finished initializing
} KBVDD_INFO;

typedef struct _KBVDD_ADD_IN {
    UINT32 Width;   // 640..7680
    UINT32 Height;  // 480..4320
    UINT32 Refresh; // 24..240 Hz, 0 = 60
    UINT32 Flags;   // reserved, 0
} KBVDD_ADD_IN;
#pragma pack(pop)
