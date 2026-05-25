# Infornexus External App

Place the complete unpacked Electron application in this directory.

Expected local entry:

```text
tms-electron-app/external-apps/infornexus/electron-app.exe
```

Do not copy only `electron-app.exe` or only `resources/app.asar`; the app
depends on the surrounding Electron runtime files from the same `win-unpacked`
directory.

The binary runtime is intentionally ignored by Git. Use a local artifact,
Git LFS, or a release/cache copy step when packaging TOS with this external app.
