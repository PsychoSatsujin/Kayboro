/*++

Kayboro Virtual Screen Driver (KBVDD): an Indirect Display Driver that adds invisible screens on request.
Derived from Microsoft's IddSampleDriver (Windows-driver-samples, Microsoft Public License).
Copyright (c) Microsoft Corporation. Modifications copyright (c) Kayboro contributors.

Environment: User Mode, UMDF 2, IddCx 1.4+.

--*/

#include "Driver.h"

#include <algorithm>
#include <cstdarg>
#include <cstdio>

using namespace std;
using namespace Kayboro;
using namespace Microsoft::WRL;

// Debug output (DebugView / a kernel debugger); the driver keeps no log files.
static void Log(_Printf_format_string_ const wchar_t* Format, ...)
{
    wchar_t Line[256] = L"[KBVDD] ";
    va_list Args;
    va_start(Args, Format);
    _vsnwprintf_s(Line + 8, ARRAYSIZE(Line) - 9, _TRUNCATE, Format, Args);
    va_end(Args);
    wcscat_s(Line, L"\n");
    OutputDebugStringW(Line);
}

#pragma region Modes and EDID

// Common modes offered next to the requested one, so Windows' display settings still offer the
// usual choices. Every shell aspect is represented: 16:9, 16:10, 21:9, 4:3, 3:2, 1:1, 5:4, portrait.
static const Mode s_CommonModes[] =
{
    { 3840, 2160, 60 }, { 2560, 1440, 60 }, { 1920, 1080, 60 }, { 1600,  900, 60 }, { 1280,  720, 60 },
    { 2560, 1600, 60 }, { 1920, 1200, 60 }, { 1680, 1050, 60 }, { 1280,  800, 60 },
    { 3440, 1440, 60 }, { 2560, 1080, 60 },
    { 2048, 1536, 60 }, { 1600, 1200, 60 }, { 1440, 1080, 60 }, { 1280,  960, 60 }, { 1024,  768, 60 },
    { 2160, 1440, 60 }, { 1920, 1280, 60 }, { 1440,  960, 60 },
    { 1440, 1440, 60 }, { 1080, 1080, 60 }, {  720,  720, 60 },
    { 1280, 1024, 60 },
    { 1080, 1920, 60 }, {  720, 1280, 60 },
};

static mutex g_ModeLock;
static vector<Mode> g_Modes[KBVDD_MAX_MONITORS];
static BYTE g_Edid[KBVDD_MAX_MONITORS][128]; // IddCx may read a screen's EDID after MonitorCreate returns

vector<Mode> Kayboro::ModesFor(UINT32 ConnectorIndex)
{
    lock_guard<mutex> Guard(g_ModeLock);
    return ConnectorIndex < KBVDD_MAX_MONITORS ? g_Modes[ConnectorIndex] : vector<Mode>{};
}

void Kayboro::SetModesFor(UINT32 ConnectorIndex, vector<Mode> Modes)
{
    lock_guard<mutex> Guard(g_ModeLock);
    if (ConnectorIndex < KBVDD_MAX_MONITORS) g_Modes[ConnectorIndex] = move(Modes);
}

// The requested mode first (the preferred one), then the common modes it doesn't duplicate.
vector<Mode> Kayboro::BuildModeList(const Mode& Preferred)
{
    vector<Mode> Out{ Preferred };
    if (Preferred.VSync != 60) Out.push_back({ Preferred.Width, Preferred.Height, 60 });
    for (const Mode& M : s_CommonModes)
    {
        const bool Dup = any_of(Out.begin(), Out.end(), [&](const Mode& O) { return O.Width == M.Width && O.Height == M.Height && O.VSync == M.VSync; });
        if (!Dup) Out.push_back(M);
    }
    return Out;
}

// 18-byte detailed timing descriptor with reduced blanking. Cosmetic: Windows takes the mode list from
// ParseMonitorDescription, but a well-formed preferred timing keeps EDID tools happy.
static void WriteDetailedTiming(BYTE* D, Mode M)
{
    if (M.Width > 4095 || M.Height > 4095) M = { 3840, 2160, 60 }; // 12-bit fields
    const DWORD HBlank = 160, VBlank = 40, HFront = 48, HSync = 32, VFront = 3, VSync = 5;
    ULONGLONG Clock = (ULONGLONG)(M.Width + HBlank) * (M.Height + VBlank) * M.VSync / 10000; // 10 kHz units
    if (Clock > 0xFFFF) Clock = (ULONGLONG)(M.Width + HBlank) * (M.Height + VBlank) * 60 / 10000;
    if (Clock > 0xFFFF) Clock = 0xFFFF;
    const DWORD HmmW = 600, HmmH = 600 * M.Height / M.Width;

    D[0] = (BYTE)(Clock & 0xFF);
    D[1] = (BYTE)(Clock >> 8);
    D[2] = (BYTE)(M.Width & 0xFF);
    D[3] = (BYTE)(HBlank & 0xFF);
    D[4] = (BYTE)((((M.Width >> 8) & 0xF) << 4) | ((HBlank >> 8) & 0xF));
    D[5] = (BYTE)(M.Height & 0xFF);
    D[6] = (BYTE)(VBlank & 0xFF);
    D[7] = (BYTE)((((M.Height >> 8) & 0xF) << 4) | ((VBlank >> 8) & 0xF));
    D[8] = (BYTE)(HFront & 0xFF);
    D[9] = (BYTE)(HSync & 0xFF);
    D[10] = (BYTE)(((VFront & 0xF) << 4) | (VSync & 0xF));
    D[11] = (BYTE)((((HFront >> 8) & 3) << 6) | (((HSync >> 8) & 3) << 4) | (((VFront >> 4) & 3) << 2) | ((VSync >> 4) & 3));
    D[12] = (BYTE)(HmmW & 0xFF);
    D[13] = (BYTE)(HmmH & 0xFF);
    D[14] = (BYTE)((((HmmW >> 8) & 0xF) << 4) | ((HmmH >> 8) & 0xF));
    D[15] = 0;
    D[16] = 0;
    D[17] = 0x1E; // digital separate sync, positive polarities
}

// EDID 1.4 named "Kayboro". Manufacturer "KBO", product 0x4B42, and the serial number carries the
// connector index so ParseMonitorDescription (which gets only the EDID) can find the screen's modes.
void Kayboro::BuildEdid(UINT32 ConnectorIndex, const Mode& Preferred, BYTE (&E)[128])
{
    static const BYTE Header[8] = { 0x00, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0x00 };
    static const BYTE Srgb[10] = { 0xEE, 0x91, 0xA3, 0x54, 0x4C, 0x99, 0x26, 0x0F, 0x50, 0x54 };
    static const char Name[] = "Kayboro";

    memset(E, 0, sizeof(E));
    memcpy(E, Header, sizeof(Header));
    E[8] = 0x2C; E[9] = 0x4F;   // "KBO": 5-bit letters K=11, B=2, O=15, big-endian
    E[10] = 0x42; E[11] = 0x4B; // product code 0x4B42, little-endian
    const UINT32 Serial = 0x4B420000u | (ConnectorIndex + 1);
    E[12] = (BYTE)(Serial & 0xFF); E[13] = (BYTE)((Serial >> 8) & 0xFF); E[14] = (BYTE)((Serial >> 16) & 0xFF); E[15] = (BYTE)(Serial >> 24);
    E[16] = 1; E[17] = 36;      // week 1 of 2026
    E[18] = 1; E[19] = 4;       // EDID 1.4
    E[20] = 0x80;               // digital input
    E[21] = 60; E[22] = (BYTE)max<DWORD>(1, 60 * Preferred.Height / Preferred.Width); // size in cm
    E[23] = 0x78;               // gamma 2.2
    E[24] = 0x06;               // sRGB is the default colour space; the preferred timing is native
    memcpy(E + 25, Srgb, sizeof(Srgb));
    for (int i = 38; i < 54; i++) E[i] = 0x01; // no standard timings

    WriteDetailedTiming(E + 54, Preferred);

    BYTE* N = E + 72; // display product name
    N[3] = 0xFC;
    for (int i = 0; i < 13; i++) N[5 + i] = i < (int)strlen(Name) ? (BYTE)Name[i] : (i == (int)strlen(Name) ? 0x0A : 0x20);

    BYTE* R = E + 90; // range limits
    R[3] = 0xFD;
    R[5] = 24; R[6] = 240; R[7] = 15; R[8] = 255; R[9] = 255; R[10] = 0x01; R[11] = 0x0A;
    for (int i = 12; i < 18; i++) R[i] = 0x20;

    E[108 + 3] = 0x10; // dummy descriptor

    BYTE Sum = 0;
    for (int i = 0; i < 127; i++) Sum = (BYTE)(Sum + E[i]);
    E[127] = (BYTE)(0x100 - Sum);
}

bool Kayboro::EdidConnector(const BYTE* pEdid, size_t Size, UINT32* pConnectorIndex)
{
    if (!pEdid || Size < 128 || pEdid[8] != 0x2C || pEdid[9] != 0x4F || pEdid[10] != 0x42 || pEdid[11] != 0x4B) return false;
    const UINT32 Serial = pEdid[12] | (pEdid[13] << 8) | (pEdid[14] << 16) | ((UINT32)pEdid[15] << 24);
    if ((Serial >> 16) != 0x4B42 || (Serial & 0xFFFF) == 0 || (Serial & 0xFFFF) > KBVDD_MAX_MONITORS) return false;
    *pConnectorIndex = (Serial & 0xFFFF) - 1;
    return true;
}

static inline void FillSignalInfo(DISPLAYCONFIG_VIDEO_SIGNAL_INFO& Mode, DWORD Width, DWORD Height, DWORD VSync, bool bMonitorMode)
{
    Mode.totalSize.cx = Mode.activeSize.cx = Width;
    Mode.totalSize.cy = Mode.activeSize.cy = Height;
    // See https://docs.microsoft.com/en-us/windows/win32/api/wingdi/ns-wingdi-displayconfig_video_signal_info
    Mode.AdditionalSignalInfo.vSyncFreqDivider = bMonitorMode ? 0 : 1;
    Mode.AdditionalSignalInfo.videoStandard = 255;
    Mode.vSyncFreq.Numerator = VSync;
    Mode.vSyncFreq.Denominator = 1;
    Mode.hSyncFreq.Numerator = VSync * Height;
    Mode.hSyncFreq.Denominator = 1;
    Mode.scanLineOrdering = DISPLAYCONFIG_SCANLINE_ORDERING_PROGRESSIVE;
    Mode.pixelRate = ((UINT64)VSync) * ((UINT64)Width) * ((UINT64)Height);
}

static IDDCX_MONITOR_MODE CreateIddCxMonitorMode(DWORD Width, DWORD Height, DWORD VSync, IDDCX_MONITOR_MODE_ORIGIN Origin)
{
    IDDCX_MONITOR_MODE Mode = {};
    Mode.Size = sizeof(Mode);
    Mode.Origin = Origin;
    FillSignalInfo(Mode.MonitorVideoSignalInfo, Width, Height, VSync, true);
    return Mode;
}

static IDDCX_TARGET_MODE CreateIddCxTargetMode(DWORD Width, DWORD Height, DWORD VSync)
{
    IDDCX_TARGET_MODE Mode = {};
    Mode.Size = sizeof(Mode);
    FillSignalInfo(Mode.TargetVideoSignalInfo.targetVideoSignalInfo, Width, Height, VSync, false);
    return Mode;
}

#pragma endregion

extern "C" DRIVER_INITIALIZE DriverEntry;

EVT_WDF_DRIVER_DEVICE_ADD KbvddDeviceAdd;
EVT_WDF_DEVICE_D0_ENTRY KbvddDeviceD0Entry;
EVT_WDF_TIMER KbvddWatchdog;

EVT_IDD_CX_DEVICE_IO_CONTROL KbvddIoDeviceControl;
EVT_IDD_CX_ADAPTER_INIT_FINISHED KbvddAdapterInitFinished;
EVT_IDD_CX_ADAPTER_COMMIT_MODES KbvddAdapterCommitModes;

EVT_IDD_CX_PARSE_MONITOR_DESCRIPTION KbvddParseMonitorDescription;
EVT_IDD_CX_MONITOR_GET_DEFAULT_DESCRIPTION_MODES KbvddMonitorGetDefaultModes;
EVT_IDD_CX_MONITOR_QUERY_TARGET_MODES KbvddMonitorQueryModes;

EVT_IDD_CX_MONITOR_ASSIGN_SWAPCHAIN KbvddMonitorAssignSwapChain;
EVT_IDD_CX_MONITOR_UNASSIGN_SWAPCHAIN KbvddMonitorUnassignSwapChain;

struct IndirectDeviceContextWrapper
{
    IndirectDeviceContext* pContext;

    void Cleanup()
    {
        delete pContext;
        pContext = nullptr;
    }
};

struct IndirectMonitorContextWrapper
{
    IndirectMonitorContext* pContext;

    void Cleanup()
    {
        delete pContext;
        pContext = nullptr;
    }
};

// These macros create the methods for accessing the wrappers as contexts of WDF objects
WDF_DECLARE_CONTEXT_TYPE(IndirectDeviceContextWrapper);
WDF_DECLARE_CONTEXT_TYPE(IndirectMonitorContextWrapper);

extern "C" BOOL WINAPI DllMain(_In_ HINSTANCE hInstance, _In_ UINT dwReason, _In_opt_ LPVOID lpReserved)
{
    UNREFERENCED_PARAMETER(hInstance);
    UNREFERENCED_PARAMETER(lpReserved);
    UNREFERENCED_PARAMETER(dwReason);
    return TRUE;
}

_Use_decl_annotations_
extern "C" NTSTATUS DriverEntry(PDRIVER_OBJECT pDriverObject, PUNICODE_STRING pRegistryPath)
{
    WDF_DRIVER_CONFIG Config;
    WDF_OBJECT_ATTRIBUTES Attributes;
    WDF_OBJECT_ATTRIBUTES_INIT(&Attributes);
    WDF_DRIVER_CONFIG_INIT(&Config, KbvddDeviceAdd);
    return WdfDriverCreate(pDriverObject, pRegistryPath, &Attributes, &Config, WDF_NO_HANDLE);
}

_Use_decl_annotations_
NTSTATUS KbvddDeviceAdd(WDFDRIVER Driver, PWDFDEVICE_INIT pDeviceInit)
{
    UNREFERENCED_PARAMETER(Driver);

    WDF_PNPPOWER_EVENT_CALLBACKS PnpPowerCallbacks;
    WDF_PNPPOWER_EVENT_CALLBACKS_INIT(&PnpPowerCallbacks);
    PnpPowerCallbacks.EvtDeviceD0Entry = KbvddDeviceD0Entry;
    WdfDeviceInitSetPnpPowerEventCallbacks(pDeviceInit, &PnpPowerCallbacks);

    IDD_CX_CLIENT_CONFIG IddConfig;
    IDD_CX_CLIENT_CONFIG_INIT(&IddConfig);
    // IddCx redirects IoDeviceControl requests to its own queue; ours arrive through this callback.
    IddConfig.EvtIddCxDeviceIoControl = KbvddIoDeviceControl;
    IddConfig.EvtIddCxAdapterInitFinished = KbvddAdapterInitFinished;
    IddConfig.EvtIddCxParseMonitorDescription = KbvddParseMonitorDescription;
    IddConfig.EvtIddCxMonitorGetDefaultDescriptionModes = KbvddMonitorGetDefaultModes;
    IddConfig.EvtIddCxMonitorQueryTargetModes = KbvddMonitorQueryModes;
    IddConfig.EvtIddCxAdapterCommitModes = KbvddAdapterCommitModes;
    IddConfig.EvtIddCxMonitorAssignSwapChain = KbvddMonitorAssignSwapChain;
    IddConfig.EvtIddCxMonitorUnassignSwapChain = KbvddMonitorUnassignSwapChain;

    NTSTATUS Status = IddCxDeviceInitConfig(pDeviceInit, &IddConfig);
    if (!NT_SUCCESS(Status)) return Status;

    WDF_OBJECT_ATTRIBUTES Attr;
    WDF_OBJECT_ATTRIBUTES_INIT_CONTEXT_TYPE(&Attr, IndirectDeviceContextWrapper);
    Attr.EvtCleanupCallback = [](WDFOBJECT Object)
    {
        auto* pContext = WdfObjectGet_IndirectDeviceContextWrapper(Object);
        if (pContext) pContext->Cleanup();
    };

    WDFDEVICE Device = nullptr;
    Status = WdfDeviceCreate(&pDeviceInit, &Attr, &Device);
    if (!NT_SUCCESS(Status)) return Status;

    Status = IddCxDeviceInitialize(Device);
    if (!NT_SUCCESS(Status)) return Status;

    // The interface Kayboro opens to send IOCTL_KBVDD_* requests.
    Status = WdfDeviceCreateDeviceInterface(Device, &GUID_DEVINTERFACE_KBVDD, nullptr);
    if (!NT_SUCCESS(Status)) return Status;

    auto* pContext = WdfObjectGet_IndirectDeviceContextWrapper(Device);
    pContext->pContext = new IndirectDeviceContext(Device);

    // Watchdog: unplugs every screen when the client stops talking to us.
    WDF_TIMER_CONFIG TimerConfig;
    WDF_TIMER_CONFIG_INIT_PERIODIC(&TimerConfig, KbvddWatchdog, 500);
    WDF_OBJECT_ATTRIBUTES TimerAttr;
    WDF_OBJECT_ATTRIBUTES_INIT(&TimerAttr);
    TimerAttr.ParentObject = Device;
    WDFTIMER Timer = nullptr;
    Status = WdfTimerCreate(&TimerConfig, &TimerAttr, &Timer);
    if (!NT_SUCCESS(Status)) return Status;
    WdfTimerStart(Timer, WDF_REL_TIMEOUT_IN_MS(500));

    Log(L"device added");
    return STATUS_SUCCESS;
}

_Use_decl_annotations_
NTSTATUS KbvddDeviceD0Entry(WDFDEVICE Device, WDF_POWER_DEVICE_STATE PreviousState)
{
    UNREFERENCED_PARAMETER(PreviousState);
    // The adapter is initialized once; later D0 entries (resume from sleep) keep it.
    auto* pContext = WdfObjectGet_IndirectDeviceContextWrapper(Device);
    if (!pContext->pContext->IsAdapterInitialized()) pContext->pContext->InitAdapter();
    return STATUS_SUCCESS;
}

_Use_decl_annotations_
VOID KbvddWatchdog(WDFTIMER Timer)
{
    auto* pContext = WdfObjectGet_IndirectDeviceContextWrapper(WdfTimerGetParentObject(Timer));
    if (pContext && pContext->pContext) pContext->pContext->Watchdog();
}

#pragma region Direct3DDevice

Direct3DDevice::Direct3DDevice(LUID AdapterLuid) : AdapterLuid(AdapterLuid)
{
}

HRESULT Direct3DDevice::Init()
{
    // The DXGI factory could be cached, but if a new render adapter appears on the system, a new factory needs to be
    // created. If caching is desired, check DxgiFactory->IsCurrent() each time and recreate the factory if !IsCurrent.
    HRESULT hr = CreateDXGIFactory2(0, IID_PPV_ARGS(&DxgiFactory));
    if (FAILED(hr)) return hr;

    hr = DxgiFactory->EnumAdapterByLuid(AdapterLuid, IID_PPV_ARGS(&Adapter));
    if (FAILED(hr)) return hr;

    // Create a D3D device using the render adapter. BGRA support is required by the WHQL test suite.
    return D3D11CreateDevice(Adapter.Get(), D3D_DRIVER_TYPE_UNKNOWN, nullptr, D3D11_CREATE_DEVICE_BGRA_SUPPORT, nullptr, 0,
        D3D11_SDK_VERSION, &Device, nullptr, &DeviceContext);
}

#pragma endregion

#pragma region SwapChainProcessor

SwapChainProcessor::SwapChainProcessor(IDDCX_SWAPCHAIN hSwapChain, shared_ptr<Direct3DDevice> Device, HANDLE NewFrameEvent)
    : m_hSwapChain(hSwapChain), m_Device(Device), m_hAvailableBufferEvent(NewFrameEvent)
{
    m_hTerminateEvent.Attach(CreateEvent(nullptr, FALSE, FALSE, nullptr));
    m_hThread.Attach(CreateThread(nullptr, 0, RunThread, this, 0, nullptr));
}

SwapChainProcessor::~SwapChainProcessor()
{
    SetEvent(m_hTerminateEvent.Get());
    if (m_hThread.Get()) WaitForSingleObject(m_hThread.Get(), INFINITE);
}

DWORD CALLBACK SwapChainProcessor::RunThread(LPVOID Argument)
{
    reinterpret_cast<SwapChainProcessor*>(Argument)->Run();
    return 0;
}

void SwapChainProcessor::Run()
{
    // The Multimedia Class Scheduler Service keeps this thread responsive under heavy CPU load.
    DWORD AvTask = 0;
    HANDLE AvTaskHandle = AvSetMmThreadCharacteristicsW(L"Distribution", &AvTask);

    RunCore();

    // Always delete the swap-chain object when the loop ends so the system provides a new one if needed.
    WdfObjectDelete((WDFOBJECT)m_hSwapChain);
    m_hSwapChain = nullptr;

    if (AvTaskHandle) AvRevertMmThreadCharacteristics(AvTaskHandle);
}

void SwapChainProcessor::RunCore()
{
    ComPtr<IDXGIDevice> DxgiDevice;
    HRESULT hr = m_Device->Device.As(&DxgiDevice);
    if (FAILED(hr)) return;

    IDARG_IN_SWAPCHAINSETDEVICE SetDevice = {};
    SetDevice.pDevice = DxgiDevice.Get();
    hr = IddCxSwapChainSetDevice(m_hSwapChain, &SetDevice);
    if (FAILED(hr)) return;

    // Acquire and release buffers in a loop. Kayboro captures the screen through DWM, so each frame is
    // released right away: nothing is copied or encoded here.
    for (;;)
    {
        ComPtr<IDXGIResource> AcquiredBuffer;
        IDARG_OUT_RELEASEANDACQUIREBUFFER Buffer = {};
        hr = IddCxSwapChainReleaseAndAcquireBuffer(m_hSwapChain, &Buffer);

        if (hr == E_PENDING)
        {
            HANDLE WaitHandles[] = { m_hAvailableBufferEvent, m_hTerminateEvent.Get() };
            DWORD WaitResult = WaitForMultipleObjects(ARRAYSIZE(WaitHandles), WaitHandles, FALSE, 16);
            if (WaitResult == WAIT_OBJECT_0 || WaitResult == WAIT_TIMEOUT) continue;
            break; // terminate requested, or the wait failed
        }
        if (FAILED(hr)) break; // the swap-chain was likely abandoned (e.g. DXGI_ERROR_ACCESS_LOST)

        AcquiredBuffer.Attach(Buffer.MetaData.pSurface);
        AcquiredBuffer.Reset();
        hr = IddCxSwapChainFinishedProcessingFrame(m_hSwapChain);
        if (FAILED(hr)) break;
    }
}

#pragma endregion

#pragma region IndirectDeviceContext

IndirectDeviceContext::IndirectDeviceContext(_In_ WDFDEVICE WdfDevice) : m_WdfDevice(WdfDevice)
{
}

IndirectDeviceContext::~IndirectDeviceContext()
{
}

void IndirectDeviceContext::InitAdapter()
{
    IDDCX_ADAPTER_CAPS AdapterCaps = {};
    AdapterCaps.Size = sizeof(AdapterCaps);
    AdapterCaps.MaxMonitorsSupported = KBVDD_MAX_MONITORS;
    AdapterCaps.EndPointDiagnostics.Size = sizeof(AdapterCaps.EndPointDiagnostics);
    AdapterCaps.EndPointDiagnostics.GammaSupport = IDDCX_FEATURE_IMPLEMENTATION_NONE;
    AdapterCaps.EndPointDiagnostics.TransmissionType = IDDCX_TRANSMISSION_TYPE_WIRED_OTHER;
    AdapterCaps.EndPointDiagnostics.pEndPointFriendlyName = L"Kayboro Virtual Screen";
    AdapterCaps.EndPointDiagnostics.pEndPointManufacturerName = L"Kayboro";
    AdapterCaps.EndPointDiagnostics.pEndPointModelName = L"KBVDD";

    IDDCX_ENDPOINT_VERSION Version = {};
    Version.Size = sizeof(Version);
    Version.MajorVer = KBVDD_VERSION >> 16;
    Version.MinorVer = KBVDD_VERSION & 0xFFFF;
    AdapterCaps.EndPointDiagnostics.pFirmwareVersion = &Version;
    AdapterCaps.EndPointDiagnostics.pHardwareVersion = &Version;

    WDF_OBJECT_ATTRIBUTES Attr;
    WDF_OBJECT_ATTRIBUTES_INIT_CONTEXT_TYPE(&Attr, IndirectDeviceContextWrapper);

    IDARG_IN_ADAPTER_INIT AdapterInit = {};
    AdapterInit.WdfDevice = m_WdfDevice;
    AdapterInit.pCaps = &AdapterCaps;
    AdapterInit.ObjectAttributes = &Attr;

    IDARG_OUT_ADAPTER_INIT AdapterInitOut = {};
    NTSTATUS Status = IddCxAdapterInitAsync(&AdapterInit, &AdapterInitOut);
    if (NT_SUCCESS(Status))
    {
        m_Adapter = AdapterInitOut.AdapterObject;
        // The adapter shares this context (it is owned and deleted by the device).
        auto* pContext = WdfObjectGet_IndirectDeviceContextWrapper(AdapterInitOut.AdapterObject);
        pContext->pContext = this;
    }
    Log(L"adapter init: 0x%08X", Status);
}

void IndirectDeviceContext::AdapterReady()
{
    lock_guard<mutex> Guard(m_Lock);
    m_Ready = true;
}

NTSTATUS IndirectDeviceContext::AddMonitor(const KBVDD_ADD_IN& Request, UINT32* pConnectorIndex)
{
    const Mode Preferred = { Request.Width, Request.Height, Request.Refresh ? Request.Refresh : 60 };
    if (Preferred.Width < 640 || Preferred.Width > 7680 || Preferred.Height < 480 || Preferred.Height > 4320 ||
        Preferred.VSync < 24 || Preferred.VSync > 240)
    {
        return STATUS_INVALID_PARAMETER;
    }

    lock_guard<mutex> Guard(m_Lock);
    if (!m_Ready || !m_Adapter) return STATUS_DEVICE_NOT_READY;

    UINT32 Index = 0;
    while (Index < KBVDD_MAX_MONITORS && m_Monitors[Index]) Index++;
    if (Index == KBVDD_MAX_MONITORS) return STATUS_INSUFFICIENT_RESOURCES;

    SetModesFor(Index, BuildModeList(Preferred));
    BuildEdid(Index, Preferred, g_Edid[Index]);

    WDF_OBJECT_ATTRIBUTES Attr;
    WDF_OBJECT_ATTRIBUTES_INIT_CONTEXT_TYPE(&Attr, IndirectMonitorContextWrapper);
    Attr.EvtCleanupCallback = [](WDFOBJECT Object)
    {
        auto* pWrapper = WdfObjectGet_IndirectMonitorContextWrapper(Object);
        if (pWrapper) pWrapper->Cleanup();
    };

    IDDCX_MONITOR_INFO MonitorInfo = {};
    MonitorInfo.Size = sizeof(MonitorInfo);
    MonitorInfo.MonitorType = DISPLAYCONFIG_OUTPUT_TECHNOLOGY_HDMI;
    MonitorInfo.ConnectorIndex = Index;
    MonitorInfo.MonitorDescription.Size = sizeof(MonitorInfo.MonitorDescription);
    MonitorInfo.MonitorDescription.Type = IDDCX_MONITOR_DESCRIPTION_TYPE_EDID;
    MonitorInfo.MonitorDescription.DataSize = sizeof(g_Edid[Index]);
    MonitorInfo.MonitorDescription.pData = g_Edid[Index];
    // A stable container ID per connector, so Windows remembers each screen's settings.
    MonitorInfo.MonitorContainerId = GUID_DEVINTERFACE_KBVDD;
    MonitorInfo.MonitorContainerId.Data4[7] = (BYTE)(MonitorInfo.MonitorContainerId.Data4[7] ^ (Index + 1));

    IDARG_IN_MONITORCREATE MonitorCreate = {};
    MonitorCreate.ObjectAttributes = &Attr;
    MonitorCreate.pMonitorInfo = &MonitorInfo;

    IDARG_OUT_MONITORCREATE MonitorCreateOut = {};
    NTSTATUS Status = IddCxMonitorCreate(m_Adapter, &MonitorCreate, &MonitorCreateOut);
    if (!NT_SUCCESS(Status))
    {
        Log(L"monitor create failed: 0x%08X", Status);
        return Status;
    }

    auto* pWrapper = WdfObjectGet_IndirectMonitorContextWrapper(MonitorCreateOut.MonitorObject);
    pWrapper->pContext = new IndirectMonitorContext(MonitorCreateOut.MonitorObject, Index);

    IDARG_OUT_MONITORARRIVAL ArrivalOut = {};
    Status = IddCxMonitorArrival(MonitorCreateOut.MonitorObject, &ArrivalOut);
    if (!NT_SUCCESS(Status))
    {
        Log(L"monitor arrival failed: 0x%08X", Status);
        WdfObjectDelete(MonitorCreateOut.MonitorObject);
        return Status;
    }

    m_Monitors[Index] = MonitorCreateOut.MonitorObject;
    m_LastPing = GetTickCount64();
    *pConnectorIndex = Index;
    Log(L"screen %u plugged in: %ux%u@%u", Index, Preferred.Width, Preferred.Height, Preferred.VSync);
    return STATUS_SUCCESS;
}

NTSTATUS IndirectDeviceContext::RemoveMonitorLocked(UINT32 ConnectorIndex)
{
    if (ConnectorIndex >= KBVDD_MAX_MONITORS || !m_Monitors[ConnectorIndex]) return STATUS_NOT_FOUND;
    NTSTATUS Status = IddCxMonitorDeparture(m_Monitors[ConnectorIndex]);
    m_Monitors[ConnectorIndex] = nullptr;
    Log(L"screen %u unplugged: 0x%08X", ConnectorIndex, Status);
    return Status;
}

NTSTATUS IndirectDeviceContext::RemoveMonitor(UINT32 ConnectorIndex)
{
    lock_guard<mutex> Guard(m_Lock);
    if (ConnectorIndex != KBVDD_ALL) return RemoveMonitorLocked(ConnectorIndex);
    for (UINT32 i = 0; i < KBVDD_MAX_MONITORS; i++) if (m_Monitors[i]) RemoveMonitorLocked(i);
    return STATUS_SUCCESS;
}

void IndirectDeviceContext::Ping()
{
    lock_guard<mutex> Guard(m_Lock);
    m_LastPing = GetTickCount64();
}

void IndirectDeviceContext::Watchdog()
{
    lock_guard<mutex> Guard(m_Lock);
    bool Any = false;
    for (UINT32 i = 0; i < KBVDD_MAX_MONITORS; i++) Any = Any || m_Monitors[i] != nullptr;
    if (!Any || GetTickCount64() - m_LastPing <= KBVDD_WATCHDOG_MS) return;
    Log(L"client went quiet: unplugging every screen");
    for (UINT32 i = 0; i < KBVDD_MAX_MONITORS; i++) if (m_Monitors[i]) RemoveMonitorLocked(i);
}

void IndirectDeviceContext::FillInfo(KBVDD_INFO* pInfo)
{
    lock_guard<mutex> Guard(m_Lock);
    pInfo->Version = KBVDD_VERSION;
    pInfo->MaxMonitors = KBVDD_MAX_MONITORS;
    pInfo->ActiveMask = 0;
    for (UINT32 i = 0; i < KBVDD_MAX_MONITORS; i++) if (m_Monitors[i]) pInfo->ActiveMask |= 1u << i;
    pInfo->Ready = m_Ready ? 1 : 0;
}

IndirectMonitorContext::IndirectMonitorContext(_In_ IDDCX_MONITOR Monitor, UINT32 Index) : ConnectorIndex(Index), m_Monitor(Monitor)
{
}

IndirectMonitorContext::~IndirectMonitorContext()
{
    m_ProcessingThread.reset();
}

void IndirectMonitorContext::AssignSwapChain(IDDCX_SWAPCHAIN SwapChain, LUID RenderAdapter, HANDLE NewFrameEvent)
{
    m_ProcessingThread.reset();
    auto Device = make_shared<Direct3DDevice>(RenderAdapter);
    if (FAILED(Device->Init()))
    {
        // Delete the swap-chain if D3D initialization fails so the OS generates a new one and tries again.
        WdfObjectDelete(SwapChain);
    }
    else
    {
        m_ProcessingThread.reset(new SwapChainProcessor(SwapChain, Device, NewFrameEvent));
    }
}

void IndirectMonitorContext::UnassignSwapChain()
{
    m_ProcessingThread.reset();
}

#pragma endregion

#pragma region DDI Callbacks

_Use_decl_annotations_
VOID KbvddIoDeviceControl(WDFDEVICE Device, WDFREQUEST Request, size_t OutputBufferLength, size_t InputBufferLength, ULONG IoControlCode)
{
    UNREFERENCED_PARAMETER(OutputBufferLength);
    UNREFERENCED_PARAMETER(InputBufferLength);

    NTSTATUS Status = STATUS_INVALID_DEVICE_REQUEST;
    ULONG_PTR Information = 0;
    auto* pWrapper = WdfObjectGet_IndirectDeviceContextWrapper(Device);
    IndirectDeviceContext* pContext = pWrapper ? pWrapper->pContext : nullptr;
    if (!pContext)
    {
        WdfRequestComplete(Request, STATUS_DEVICE_NOT_READY);
        return;
    }
    pContext->Ping(); // every request is a sign of life

    switch (IoControlCode)
    {
    case IOCTL_KBVDD_INFO:
    {
        KBVDD_INFO* pOut = nullptr;
        Status = WdfRequestRetrieveOutputBuffer(Request, sizeof(KBVDD_INFO), (PVOID*)&pOut, nullptr);
        if (NT_SUCCESS(Status))
        {
            pContext->FillInfo(pOut);
            Information = sizeof(KBVDD_INFO);
        }
        break;
    }
    case IOCTL_KBVDD_ADD:
    {
        KBVDD_ADD_IN* pIn = nullptr;
        UINT32* pOut = nullptr;
        Status = WdfRequestRetrieveInputBuffer(Request, sizeof(KBVDD_ADD_IN), (PVOID*)&pIn, nullptr);
        if (!NT_SUCCESS(Status)) break;
        const KBVDD_ADD_IN Add = *pIn; // METHOD_BUFFERED: input and output share one buffer
        Status = WdfRequestRetrieveOutputBuffer(Request, sizeof(UINT32), (PVOID*)&pOut, nullptr);
        if (!NT_SUCCESS(Status)) break;
        UINT32 Index = 0;
        Status = pContext->AddMonitor(Add, &Index);
        if (NT_SUCCESS(Status))
        {
            *pOut = Index;
            Information = sizeof(UINT32);
        }
        break;
    }
    case IOCTL_KBVDD_REMOVE:
    {
        UINT32* pIn = nullptr;
        Status = WdfRequestRetrieveInputBuffer(Request, sizeof(UINT32), (PVOID*)&pIn, nullptr);
        if (NT_SUCCESS(Status)) Status = pContext->RemoveMonitor(*pIn);
        break;
    }
    case IOCTL_KBVDD_PING:
        Status = STATUS_SUCCESS;
        break;
    }

    WdfRequestCompleteWithInformation(Request, Status, Information);
}

_Use_decl_annotations_
NTSTATUS KbvddAdapterInitFinished(IDDCX_ADAPTER AdapterObject, const IDARG_IN_ADAPTER_INIT_FINISHED* pInArgs)
{
    // Screens are not plugged in here: they arrive when Kayboro asks for one.
    auto* pDeviceContextWrapper = WdfObjectGet_IndirectDeviceContextWrapper(AdapterObject);
    if (NT_SUCCESS(pInArgs->AdapterInitStatus) && pDeviceContextWrapper->pContext) pDeviceContextWrapper->pContext->AdapterReady();
    Log(L"adapter ready: 0x%08X", pInArgs->AdapterInitStatus);
    return STATUS_SUCCESS;
}

_Use_decl_annotations_
NTSTATUS KbvddAdapterCommitModes(IDDCX_ADAPTER AdapterObject, const IDARG_IN_COMMITMODES* pInArgs)
{
    UNREFERENCED_PARAMETER(AdapterObject);
    UNREFERENCED_PARAMETER(pInArgs);
    // Nothing to reprogram: there is no hardware behind the screens.
    return STATUS_SUCCESS;
}

_Use_decl_annotations_
NTSTATUS KbvddParseMonitorDescription(const IDARG_IN_PARSEMONITORDESCRIPTION* pInArgs, IDARG_OUT_PARSEMONITORDESCRIPTION* pOutArgs)
{
    UINT32 Index = 0;
    if (!EdidConnector((const BYTE*)pInArgs->MonitorDescription.pData, pInArgs->MonitorDescription.DataSize, &Index))
    {
        return STATUS_INVALID_PARAMETER; // not one of our EDIDs
    }
    const vector<Mode> Modes = ModesFor(Index);
    if (Modes.empty()) return STATUS_INVALID_PARAMETER;

    pOutArgs->MonitorModeBufferOutputCount = (UINT)Modes.size();
    if (pInArgs->MonitorModeBufferInputCount < Modes.size())
    {
        // No buffer: the caller only asked for a count.
        return pInArgs->MonitorModeBufferInputCount > 0 ? STATUS_BUFFER_TOO_SMALL : STATUS_SUCCESS;
    }
    for (size_t i = 0; i < Modes.size(); i++)
    {
        pInArgs->pMonitorModes[i] = CreateIddCxMonitorMode(Modes[i].Width, Modes[i].Height, Modes[i].VSync, IDDCX_MONITOR_MODE_ORIGIN_MONITORDESCRIPTOR);
    }
    pOutArgs->PreferredMonitorModeIdx = 0; // the mode Kayboro asked for
    return STATUS_SUCCESS;
}

_Use_decl_annotations_
NTSTATUS KbvddMonitorGetDefaultModes(IDDCX_MONITOR MonitorObject, const IDARG_IN_GETDEFAULTDESCRIPTIONMODES* pInArgs, IDARG_OUT_GETDEFAULTDESCRIPTIONMODES* pOutArgs)
{
    // Only used for EDID-less monitors; every Kayboro screen has an EDID, but answer sensibly anyway.
    auto* pWrapper = WdfObjectGet_IndirectMonitorContextWrapper(MonitorObject);
    const vector<Mode> Modes = pWrapper && pWrapper->pContext ? ModesFor(pWrapper->pContext->ConnectorIndex) : BuildModeList({ 1920, 1080, 60 });

    pOutArgs->DefaultMonitorModeBufferOutputCount = (UINT)Modes.size();
    if (pInArgs->DefaultMonitorModeBufferInputCount == 0) return STATUS_SUCCESS;
    if (pInArgs->DefaultMonitorModeBufferInputCount < Modes.size()) return STATUS_BUFFER_TOO_SMALL;
    for (size_t i = 0; i < Modes.size(); i++)
    {
        pInArgs->pDefaultMonitorModes[i] = CreateIddCxMonitorMode(Modes[i].Width, Modes[i].Height, Modes[i].VSync, IDDCX_MONITOR_MODE_ORIGIN_DRIVER);
    }
    pOutArgs->PreferredMonitorModeIdx = 0;
    return STATUS_SUCCESS;
}

_Use_decl_annotations_
NTSTATUS KbvddMonitorQueryModes(IDDCX_MONITOR MonitorObject, const IDARG_IN_QUERYTARGETMODES* pInArgs, IDARG_OUT_QUERYTARGETMODES* pOutArgs)
{
    // The target modes are the screen's own mode list (the OS shows the intersection with the monitor modes).
    auto* pWrapper = WdfObjectGet_IndirectMonitorContextWrapper(MonitorObject);
    const vector<Mode> Modes = pWrapper && pWrapper->pContext ? ModesFor(pWrapper->pContext->ConnectorIndex) : BuildModeList({ 1920, 1080, 60 });

    vector<IDDCX_TARGET_MODE> TargetModes;
    for (const Mode& M : Modes) TargetModes.push_back(CreateIddCxTargetMode(M.Width, M.Height, M.VSync));

    pOutArgs->TargetModeBufferOutputCount = (UINT)TargetModes.size();
    if (pInArgs->TargetModeBufferInputCount >= TargetModes.size())
    {
        copy(TargetModes.begin(), TargetModes.end(), pInArgs->pTargetModes);
    }
    return STATUS_SUCCESS;
}

_Use_decl_annotations_
NTSTATUS KbvddMonitorAssignSwapChain(IDDCX_MONITOR MonitorObject, const IDARG_IN_SETSWAPCHAIN* pInArgs)
{
    auto* pMonitorContextWrapper = WdfObjectGet_IndirectMonitorContextWrapper(MonitorObject);
    pMonitorContextWrapper->pContext->AssignSwapChain(pInArgs->hSwapChain, pInArgs->RenderAdapterLuid, pInArgs->hNextSurfaceAvailable);
    return STATUS_SUCCESS;
}

_Use_decl_annotations_
NTSTATUS KbvddMonitorUnassignSwapChain(IDDCX_MONITOR MonitorObject)
{
    auto* pMonitorContextWrapper = WdfObjectGet_IndirectMonitorContextWrapper(MonitorObject);
    pMonitorContextWrapper->pContext->UnassignSwapChain();
    return STATUS_SUCCESS;
}

#pragma endregion
