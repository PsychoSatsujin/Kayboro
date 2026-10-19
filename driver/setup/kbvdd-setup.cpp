// kbvdd-setup: installs, removes and checks the Kayboro Virtual Screen Driver. Run elevated for install and
// uninstall (Steam's install script does this on first launch; see driver/README.md).
//
//   kbvdd-setup install [path\KayboroVdd.inf]   create the Root\KayboroVDD device and install the driver
//   kbvdd-setup uninstall                       remove the device(s) and the driver package
//   kbvdd-setup status                          print installed / running / screens (no admin needed)
//   kbvdd-setup test [WxH[@Hz]]                 plug a screen in for 5 s, then let the watchdog unplug it
//
// Exit codes: 0 ok, 1 failure, 2 usage, 3 not installed, 4 reboot required.
#define NOMINMAX
#include <windows.h>
#include <initguid.h>
#include <setupapi.h>
#include <newdev.h>
#include <cfgmgr32.h>
#include <devguid.h>

#include <cstdio>
#include <cwchar>
#include <string>
#include <vector>

#include "kbvdd_ioctl.h"

#pragma comment(lib, "setupapi.lib")
#pragma comment(lib, "newdev.lib")
#pragma comment(lib, "cfgmgr32.lib")

static int Fail(const wchar_t* What, DWORD Err = GetLastError())
{
    wchar_t* Msg = nullptr;
    FormatMessageW(FORMAT_MESSAGE_ALLOCATE_BUFFER | FORMAT_MESSAGE_FROM_SYSTEM | FORMAT_MESSAGE_IGNORE_INSERTS, nullptr, Err, 0, (LPWSTR)&Msg, 0, nullptr);
    fwprintf(stderr, L"kbvdd-setup: %s failed (0x%08lX) %s", What, Err, Msg ? Msg : L"\n");
    if (Msg) LocalFree(Msg);
    return 1;
}

// True when the device's hardware ID list contains Root\KayboroVDD.
static bool IsOurs(HDEVINFO Devs, SP_DEVINFO_DATA* Info)
{
    wchar_t Buf[512] = {};
    if (!SetupDiGetDeviceRegistryPropertyW(Devs, Info, SPDRP_HARDWAREID, nullptr, (PBYTE)Buf, sizeof(Buf) - sizeof(wchar_t), nullptr)) return false;
    for (const wchar_t* p = Buf; *p; p += wcslen(p) + 1)
    {
        if (_wcsicmp(p, KBVDD_HARDWARE_ID) == 0) return true;
    }
    return false;
}

// Calls fn for every present or phantom Kayboro device; returns how many there are.
template <typename F> static int ForEachDevice(F Fn)
{
    HDEVINFO Devs = SetupDiGetClassDevsW(&GUID_DEVCLASS_DISPLAY, nullptr, nullptr, 0);
    if (Devs == INVALID_HANDLE_VALUE) return 0;
    int Count = 0;
    SP_DEVINFO_DATA Info = { sizeof(Info) };
    for (DWORD i = 0; SetupDiEnumDeviceInfo(Devs, i, &Info); i++)
    {
        if (!IsOurs(Devs, &Info)) continue;
        Count++;
        Fn(Devs, &Info);
    }
    SetupDiDestroyDeviceInfoList(Devs);
    return Count;
}

static std::wstring FullPath(const wchar_t* Path)
{
    wchar_t Buf[MAX_PATH] = {};
    return GetFullPathNameW(Path, MAX_PATH, Buf, nullptr) ? Buf : Path;
}

// The INF next to this exe (the Steam depot layout), unless a path was given.
static std::wstring DefaultInf()
{
    wchar_t Exe[MAX_PATH] = {};
    GetModuleFileNameW(nullptr, Exe, MAX_PATH);
    std::wstring Dir(Exe);
    Dir.resize(Dir.find_last_of(L"\\/") + 1);
    return Dir + L"KayboroVdd.inf";
}

static int Install(const std::wstring& Inf)
{
    if (GetFileAttributesW(Inf.c_str()) == INVALID_FILE_ATTRIBUTES) return Fail(L"finding the INF", ERROR_FILE_NOT_FOUND);

    // A root-enumerated device needs a device node first (what "devcon install" does), unless one exists.
    if (ForEachDevice([](HDEVINFO, SP_DEVINFO_DATA*) {}) == 0)
    {
        GUID ClassGuid = GUID_DEVCLASS_DISPLAY;
        HDEVINFO Devs = SetupDiCreateDeviceInfoList(&ClassGuid, nullptr);
        if (Devs == INVALID_HANDLE_VALUE) return Fail(L"SetupDiCreateDeviceInfoList");
        SP_DEVINFO_DATA Info = { sizeof(Info) };
        const wchar_t HwIds[] = KBVDD_HARDWARE_ID L"\0";
        BOOL Ok = SetupDiCreateDeviceInfoW(Devs, L"Display", &ClassGuid, nullptr, nullptr, DICD_GENERATE_ID, &Info)
            && SetupDiSetDeviceRegistryPropertyW(Devs, &Info, SPDRP_HARDWAREID, (const BYTE*)HwIds, sizeof(HwIds))
            && SetupDiCallClassInstaller(DIF_REGISTERDEVICE, Devs, &Info);
        DWORD Err = GetLastError();
        SetupDiDestroyDeviceInfoList(Devs);
        if (!Ok) return Fail(L"creating the device", Err);
    }

    BOOL Reboot = FALSE;
    if (!UpdateDriverForPlugAndPlayDevicesW(nullptr, KBVDD_HARDWARE_ID, Inf.c_str(), INSTALLFLAG_FORCE, &Reboot))
    {
        return Fail(L"installing the driver");
    }
    wprintf(L"Kayboro Virtual Screen Driver installed.%s\n", Reboot ? L" Restart Windows to finish." : L"");
    return Reboot ? 4 : 0;
}

static int Uninstall()
{
    bool Reboot = false;
    int Count = ForEachDevice([&](HDEVINFO Devs, SP_DEVINFO_DATA* Info) {
        BOOL NeedReboot = FALSE;
        if (!DiUninstallDevice(nullptr, Devs, Info, 0, &NeedReboot)) Fail(L"removing a device");
        Reboot = Reboot || NeedReboot;
    });

    // Remove every copy of our package from the driver store.
    HDEVINFO None = SetupDiCreateDeviceInfoList(&GUID_DEVCLASS_DISPLAY, nullptr);
    if (None != INVALID_HANDLE_VALUE)
    {
        if (SetupDiBuildDriverInfoList(None, nullptr, SPDIT_CLASSDRIVER))
        {
            SP_DRVINFO_DATA_W Drv = { sizeof(Drv) };
            for (DWORD i = 0; SetupDiEnumDriverInfoW(None, nullptr, SPDIT_CLASSDRIVER, i, &Drv); i++)
            {
                if (_wcsicmp(Drv.MfgName, L"Kayboro") != 0) continue;
                std::vector<BYTE> Buf(4096);
                auto* Detail = (SP_DRVINFO_DETAIL_DATA_W*)Buf.data();
                Detail->cbSize = sizeof(SP_DRVINFO_DETAIL_DATA_W);
                if (!SetupDiGetDriverInfoDetailW(None, nullptr, &Drv, Detail, (DWORD)Buf.size(), nullptr)) continue;
                const wchar_t* Name = wcsrchr(Detail->InfFileName, L'\\');
                if (Name && SetupUninstallOEMInfW(Name + 1, SUOI_FORCEDELETE, nullptr)) wprintf(L"Removed %s from the driver store.\n", Name + 1);
            }
        }
        SetupDiDestroyDeviceInfoList(None);
    }

    wprintf(Count ? L"Kayboro Virtual Screen Driver removed.%s\n" : L"Nothing to remove.%s\n", Reboot ? L" Restart Windows to finish." : L"");
    return Reboot ? 4 : 0;
}

// Opens the driver's control interface (no admin rights needed).
static HANDLE OpenDriver()
{
    HDEVINFO Devs = SetupDiGetClassDevsW(&GUID_DEVINTERFACE_KBVDD, nullptr, nullptr, DIGCF_PRESENT | DIGCF_DEVICEINTERFACE);
    if (Devs == INVALID_HANDLE_VALUE) return INVALID_HANDLE_VALUE;
    HANDLE H = INVALID_HANDLE_VALUE;
    SP_DEVICE_INTERFACE_DATA If = { sizeof(If) };
    if (SetupDiEnumDeviceInterfaces(Devs, nullptr, &GUID_DEVINTERFACE_KBVDD, 0, &If))
    {
        DWORD Size = 0;
        SetupDiGetDeviceInterfaceDetailW(Devs, &If, nullptr, 0, &Size, nullptr);
        std::vector<BYTE> Buf(Size);
        auto* Detail = (SP_DEVICE_INTERFACE_DETAIL_DATA_W*)Buf.data();
        Detail->cbSize = sizeof(SP_DEVICE_INTERFACE_DETAIL_DATA_W);
        if (SetupDiGetDeviceInterfaceDetailW(Devs, &If, Detail, Size, nullptr, nullptr))
        {
            H = CreateFileW(Detail->DevicePath, GENERIC_READ | GENERIC_WRITE, FILE_SHARE_READ | FILE_SHARE_WRITE, nullptr, OPEN_EXISTING, 0, nullptr);
        }
    }
    SetupDiDestroyDeviceInfoList(Devs);
    return H;
}

static bool Ioctl(HANDLE H, DWORD Code, const void* In, DWORD InSize, void* Out, DWORD OutSize)
{
    DWORD Got = 0;
    return !!DeviceIoControl(H, Code, (void*)In, InSize, Out, OutSize, &Got, nullptr);
}

static int Status()
{
    int Devices = 0;
    ULONG Problem = 0, State = 0;
    ForEachDevice([&](HDEVINFO, SP_DEVINFO_DATA* Info) {
        Devices++;
        CM_Get_DevNode_Status(&State, &Problem, Info->DevInst, 0);
    });
    if (!Devices)
    {
        wprintf(L"not installed\n");
        return 3;
    }
    HANDLE H = OpenDriver();
    KBVDD_INFO Info = {};
    const bool Talking = H != INVALID_HANDLE_VALUE && Ioctl(H, IOCTL_KBVDD_INFO, nullptr, 0, &Info, sizeof(Info));
    if (H != INVALID_HANDLE_VALUE) CloseHandle(H);
    wprintf(L"installed: %d device(s), %s%s\n", Devices, (State & DN_STARTED) ? L"running" : L"not running",
        (State & DN_HAS_PROBLEM) ? (Problem == CM_PROB_NEED_RESTART ? L" (restart Windows)" : L" (has a problem)") : L"");
    if (Talking) wprintf(L"driver %u.%u, adapter %s, screens mask 0x%X of %u\n", Info.Version >> 16, Info.Version & 0xFFFF, Info.Ready ? L"ready" : L"starting", Info.ActiveMask, Info.MaxMonitors);
    else wprintf(L"control interface unavailable\n");
    return Talking ? 0 : 1;
}

static int Test(const wchar_t* Spec)
{
    KBVDD_ADD_IN Add = { 1920, 1080, 60, 0 };
    if (Spec && swscanf_s(Spec, L"%ux%u@%u", &Add.Width, &Add.Height, &Add.Refresh) < 2) return 2;
    HANDLE H = OpenDriver();
    if (H == INVALID_HANDLE_VALUE) return Fail(L"opening the driver");
    UINT32 Index = 0;
    if (!Ioctl(H, IOCTL_KBVDD_ADD, &Add, sizeof(Add), &Index, sizeof(Index)))
    {
        DWORD Err = GetLastError();
        CloseHandle(H);
        return Fail(L"adding a screen", Err);
    }
    wprintf(L"screen %u plugged in at %ux%u@%u; pinging for 5 s...\n", Index, Add.Width, Add.Height, Add.Refresh ? Add.Refresh : 60);
    for (int i = 0; i < 10; i++)
    {
        Sleep(500);
        Ioctl(H, IOCTL_KBVDD_PING, nullptr, 0, nullptr, 0);
    }
    wprintf(L"stopped pinging; the watchdog should unplug it within %u ms\n", KBVDD_WATCHDOG_MS + 500);
    CloseHandle(H);
    Sleep(KBVDD_WATCHDOG_MS + 1500);
    H = OpenDriver();
    KBVDD_INFO Info = {};
    const bool Ok = H != INVALID_HANDLE_VALUE && Ioctl(H, IOCTL_KBVDD_INFO, nullptr, 0, &Info, sizeof(Info)) && !(Info.ActiveMask & (1u << Index));
    if (H != INVALID_HANDLE_VALUE) CloseHandle(H);
    wprintf(Ok ? L"PASS: the screen was unplugged\n" : L"FAIL: the screen is still plugged in\n");
    return Ok ? 0 : 1;
}

int wmain(int argc, wchar_t** argv)
{
    if (argc < 2)
    {
        fwprintf(stderr, L"usage: kbvdd-setup install [inf] | uninstall | status | test [WxH[@Hz]]\n");
        return 2;
    }
    const wchar_t* Cmd = argv[1];
    if (_wcsicmp(Cmd, L"install") == 0) return Install(FullPath(argc > 2 ? argv[2] : DefaultInf().c_str()));
    if (_wcsicmp(Cmd, L"uninstall") == 0) return Uninstall();
    if (_wcsicmp(Cmd, L"status") == 0) return Status();
    if (_wcsicmp(Cmd, L"test") == 0) return Test(argc > 2 ? argv[2] : nullptr);
    fwprintf(stderr, L"unknown command: %s\n", Cmd);
    return 2;
}
