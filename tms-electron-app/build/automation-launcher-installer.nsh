!macro customInstall
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "TOSAutomationLauncher" '"$INSTDIR\TOS.exe" --automation-launcher-background'
  ExecWait '"$INSTDIR\TOS.exe" --automation-launcher-background'
!macroend

!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "TOSAutomationLauncher"
!macroend
