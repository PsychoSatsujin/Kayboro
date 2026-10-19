; Kayboro installer additions (electron-builder includes build/installer.nsh automatically).
; The license page shows EULA.txt, which discloses the Kayboro Virtual Screen Driver before anything is
; installed. After the files are copied, the driver is installed with Windows' administrator prompt; it is
; removed again when Kayboro is uninstalled (not when an update replaces the old version).

!macro customInstall
  IfFileExists "$INSTDIR\driver\kbvdd-setup.exe" 0 kbvdd_install_done
    DetailPrint "Installing the Kayboro Virtual Screen driver (Windows asks for administrator approval)..."
    ExecShellWait "runas" "$INSTDIR\driver\kbvdd-setup.exe" "install" SW_HIDE
  kbvdd_install_done:
!macroend

!macro customUnInstall
  ${ifNot} ${isUpdated}
    IfFileExists "$INSTDIR\driver\kbvdd-setup.exe" 0 kbvdd_uninstall_done
      DetailPrint "Removing the Kayboro Virtual Screen driver..."
      ExecShellWait "runas" "$INSTDIR\driver\kbvdd-setup.exe" "uninstall" SW_HIDE
    kbvdd_uninstall_done:
  ${endIf}
!macroend
