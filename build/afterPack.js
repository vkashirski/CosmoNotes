// Not used any more (since 1.1.1).
//
// This used to stamp the CosmoNotes icon and name into CosmoNotes.exe. Any change to that file makes it a
// brand-new, unsigned program that Windows Smart App Control blocks. CosmoNotes.exe is now left
// byte-identical to Electron's own electron.exe (which Windows trusts). The icon comes from
// build/installer.nsh, which points the shortcuts at resources\icon.ico, and from the window icon set in main.js.
// See ai-context/CONTEXT.md, "Smart App Control".
