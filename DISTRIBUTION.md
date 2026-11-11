# Selah Distribution & Code Signing Guide

This guide covers building, signing, notarizing, and publishing **Selah** installers across Windows, macOS, and Linux.

## 1. Local Package Builds

Run inside `daylight-desktop/`:

```bash
npm install
npm run typecheck
npm run build
npm test
```

Platform-specific packages:

- **Windows (NSIS `.exe` installer):** `npm run package:win`
- **macOS (Universal `.dmg` & `.zip`):** `npm run package:mac`
- **Linux (`.AppImage` & `.deb`):** `npm run package:linux`

Generated artifacts are written to `daylight-desktop/release/`.

---

## 2. Windows Authenticode Signing (SmartScreen Mitigation)

Unsigned Windows installers trigger Microsoft Defender SmartScreen warnings. To sign `Selah Setup X.Y.Z.exe`:

1. Obtain an EV or OV Code Signing certificate (`.pfx` or hardware HSM/Azure Trusted Signing).
2. Configure environment variables before running `electron-builder`:
   - `WIN_CSC_LINK`: Base64-encoded `.pfx` or file path to certificate.
   - `WIN_CSC_KEY_PASSWORD`: Certificate password.
3. Run:
   ```bash
   npx electron-builder --win nsis --publish never
   ```
4. Verify the signature on Windows PowerShell:
   ```powershell
   Get-AuthenticodeSignature "release\Selah Setup *.exe"
   ```

---

## 3. macOS Code Signing & Notarization

Apple Gatekeeper requires signed + notarized binaries for smooth installation on macOS:

1. Generate a **Developer ID Application** certificate in Apple Developer Portal and export as `.p12`.
2. Create an App-Specific Password at [appleid.apple.com](https://appleid.apple.com).
3. Configure CI or local environment secrets:
   - `MAC_CSC_LINK`: Base64 `.p12` certificate
   - `MAC_CSC_KEY_PASSWORD`: `.p12` password
   - `APPLE_ID`: Apple Developer email
   - `APPLE_APP_SPECIFIC_PASSWORD`: App-specific password
   - `APPLE_TEAM_ID`: 10-character Team ID
4. Entitlements in `build/entitlements.mac.plist` enable hardened runtime permissions needed by `better-sqlite3` and Electron.

---

## 4. Publishing a GitHub Release

1. Update `"version"` in `daylight-desktop/package.json` and `APP_CONFIG.version` in `daylight-desktop/src/shared/appConfig.ts`.
2. Commit changes and push a matching SemVer git tag:
   ```bash
   git tag v0.2.0
   git push origin main --tags
   ```
3. Download the verified artifacts from the **Cross-Platform Build & Verification** GitHub Actions workflow (`selah-windows-x64`, `selah-macos-universal`, `selah-linux-x64`) or attach them directly to the GitHub Release.
4. Ensure filenames follow standard patterns (`.exe` for Windows, `.dmg` for macOS, `.AppImage` / `.deb` for Linux) so the Selah landing website's live GitHub Releases download detector matches each OS automatically.
