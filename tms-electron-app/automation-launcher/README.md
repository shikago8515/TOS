# Automation Launcher

This folder contains the local bootstrap and HTTP launcher for web-driven browser automation.

## Dev usage

Register the current source workspace as the `tos://` handler and start the launcher:

```powershell
npm run launcher:register:dev
```

Register the launcher and also auto-start it on Windows sign-in:

```powershell
npm run launcher:register:dev:startup
```

Remove the dev registration:

```powershell
npm run launcher:unregister:dev
```

Manually ensure the local launcher is running:

```powershell
npm run launcher:ensure:dev
```
