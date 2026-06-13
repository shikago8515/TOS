Automation helper installers are served by the backend MinIO endpoint:

/api/system/config/automation-helper/download

Do not place installer binaries in the frontend public directory.
Use VITE_AUTOMATION_HELPER_DOWNLOAD_URL only when an environment needs a custom URL.
