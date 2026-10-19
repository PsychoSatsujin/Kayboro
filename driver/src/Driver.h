/*++

Kayboro Virtual Screen Driver (KBVDD), an Indirect Display Driver (UMDF 2 + IddCx).
Derived from Microsoft's IddSampleDriver (Windows-driver-samples, Microsoft Public License).
Copyright (c) Microsoft Corporation. Modifications copyright (c) Kayboro contributors.

Screens are created on request (IOCTL_KBVDD_ADD) at the resolution the client asks for, report a
"Kayboro" EDID, and are unplugged by a watchdog when the client stops pinging. Frames are consumed
and dropped: the desktop is composed by DWM, which is what Kayboro captures.

--*/
#pragma once

#define NOMINMAX
#include <windows.h>
#include <bugcodes.h>
#include <wudfwdm.h>
#include <wdf.h>
#include <iddcx.h>
#include <initguid.h>

#include <dxgi1_5.h>
#include <d3d11_2.h>
#include <avrt.h>
#include <wrl.h>

#include <memory>
#include <mutex>
#include <vector>

#include "kbvdd_ioctl.h"

namespace Microsoft { namespace WRL { namespace Wrappers {
    // Adds a wrapper for thread handles to the existing set of WRL handle wrapper classes
    typedef HandleT<HandleTraits::HANDLENullTraits> Thread;
} } }

namespace Kayboro
{
    struct Mode
    {
        DWORD Width;
        DWORD Height;
        DWORD VSync;
    };

    /// Manages the creation and lifetime of a Direct3D render device.
    struct Direct3DDevice
    {
        Direct3DDevice(LUID AdapterLuid);
        HRESULT Init();

        LUID AdapterLuid;
        Microsoft::WRL::ComPtr<IDXGIFactory5> DxgiFactory;
        Microsoft::WRL::ComPtr<IDXGIAdapter1> Adapter;
        Microsoft::WRL::ComPtr<ID3D11Device> Device;
        Microsoft::WRL::ComPtr<ID3D11DeviceContext> DeviceContext;
    };

    /// Manages a thread that consumes (and drops) buffers from an indirect display swap-chain object.
    class SwapChainProcessor
    {
    public:
        SwapChainProcessor(IDDCX_SWAPCHAIN hSwapChain, std::shared_ptr<Direct3DDevice> Device, HANDLE NewFrameEvent);
        ~SwapChainProcessor();

    private:
        static DWORD CALLBACK RunThread(LPVOID Argument);
        void Run();
        void RunCore();

        IDDCX_SWAPCHAIN m_hSwapChain;
        std::shared_ptr<Direct3DDevice> m_Device;
        HANDLE m_hAvailableBufferEvent;
        Microsoft::WRL::Wrappers::Thread m_hThread;
        Microsoft::WRL::Wrappers::Event m_hTerminateEvent;
    };

    /// The display adapter: owns the screens (one per connector) and the watchdog.
    class IndirectDeviceContext
    {
    public:
        IndirectDeviceContext(_In_ WDFDEVICE WdfDevice);
        virtual ~IndirectDeviceContext();

        void InitAdapter();
        void AdapterReady();
        bool IsAdapterInitialized() const { return m_Adapter != nullptr; }

        NTSTATUS AddMonitor(const KBVDD_ADD_IN& Request, UINT32* pConnectorIndex);
        NTSTATUS RemoveMonitor(UINT32 ConnectorIndex);
        void Ping();
        void Watchdog();
        void FillInfo(KBVDD_INFO* pInfo);

    private:
        NTSTATUS RemoveMonitorLocked(UINT32 ConnectorIndex);

        WDFDEVICE m_WdfDevice;
        IDDCX_ADAPTER m_Adapter = nullptr;
        WDFTIMER m_Watchdog = nullptr;
        bool m_Ready = false;
        std::mutex m_Lock;
        IDDCX_MONITOR m_Monitors[KBVDD_MAX_MONITORS] = {};
        ULONGLONG m_LastPing = 0;
    };

    /// One Kayboro screen.
    class IndirectMonitorContext
    {
    public:
        IndirectMonitorContext(_In_ IDDCX_MONITOR Monitor, UINT32 ConnectorIndex);
        virtual ~IndirectMonitorContext();

        void AssignSwapChain(IDDCX_SWAPCHAIN SwapChain, LUID RenderAdapter, HANDLE NewFrameEvent);
        void UnassignSwapChain();

        const UINT32 ConnectorIndex;

    private:
        IDDCX_MONITOR m_Monitor;
        std::unique_ptr<SwapChainProcessor> m_ProcessingThread;
    };

    // Mode lists of the screens, by connector index. Shared with the EDID parse callback, which only
    // gets the EDID (the connector index travels in the EDID serial number).
    std::vector<Mode> ModesFor(UINT32 ConnectorIndex);
    void SetModesFor(UINT32 ConnectorIndex, std::vector<Mode> Modes);
    std::vector<Mode> BuildModeList(const Mode& Preferred);
    void BuildEdid(UINT32 ConnectorIndex, const Mode& Preferred, BYTE (&Edid)[128]);
    bool EdidConnector(const BYTE* pEdid, size_t Size, UINT32* pConnectorIndex);
}
