; CosmoNotes installer additions (included by electron-builder).
;
; CosmoNotes.exe is deliberately Electron's original, untouched program file, so Windows Smart App Control
; trusts it. That file carries Electron's icon, so the shortcuts are re-made here to show the
; CosmoNotes icon (resources\icon.ico) instead. Same target, same app id, only the icon differs.
!macro customInstall
  ${if} ${FileExists} "$newStartMenuLink"
    CreateShortCut "$newStartMenuLink" "$appExe" "" "$INSTDIR\resources\icon.ico" 0 "" "" "${APP_DESCRIPTION}"
    ClearErrors
    WinShell::SetLnkAUMI "$newStartMenuLink" "${APP_ID}"
  ${endIf}
  ${if} ${FileExists} "$newDesktopLink"
    CreateShortCut "$newDesktopLink" "$appExe" "" "$INSTDIR\resources\icon.ico" 0 "" "" "${APP_DESCRIPTION}"
    ClearErrors
    WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
  ${endIf}
!macroend
