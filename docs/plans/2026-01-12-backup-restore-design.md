# Backup and Restore Feature Design

## Understanding Your Needs

I see you want to add **Backup and Restore** to your wallet while keeping the core package (`@bifold/core`) clean and avoiding conflicts with the main fork. This is a smart architectural goal for maintainability.

To give you the best solution, I need to understand a few details about what you're building:

1.  **What data needs to be backed up?**

    - (A) Full wallet (keys + credentials + history)
    - (B) Only Credentials and DIDs (verifiable data)
    - (C) Only Metadata/History (keys are managed elsewhere)

2.  **Where will the backup be stored?**

    - (A) Local file export (zip/json)
    - (B) Cloud Storage (Google Drive / iCloud)
    - (C) Dedicated Backup Server (HTTP/WebDAV)

3.  **Security Model:**

    - (A) User-managed password (encryption key derived from PIN/Passphrase)
    - (B) Cloud-managed keys
    - (C) No additional encryption (relying on storage security - not recommended)

4.  **Architecture Preference:**
    - (A) A separate package (e.g., `packages/backup`) added to the workspace
    - (B) A module inside your app's source (`samples/app/src/modules/backup`)
    - (C) A plugin that extends `core` at runtime

Let's start here. Which of these match your vision?
