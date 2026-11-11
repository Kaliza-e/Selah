# Selah Multi-Platform Distribution & Release Guide

This guide covers packaging, native SQLite rebuilding, optional code signing/notarization, SHA-256 verification, and publishing **Selah** installers across Windows, macOS, and Linux via GitHub Actions and the release website.

---

## 1. Supported Platforms & Artifact Matrix

| Operating System | Architecture | Target Formats | Output Filenames (`${version}`) | Build Environment |
| --- | --- | --- | --- | --- |
| Windows 10 / 11 | `x64` | NSIS Installer, Portable `.exe` | `Selah-Setup-${version}-x64.exe`, `Selah-Portable-${version}-x64.exe` | Local Windows or `windows-latest` |
| macOS 12+ | `arm64`, `x64` | `.dmg`, `.zip` | `Selah-${version}-arm64.dmg`, `Selah-${version}-x64.dmg`, `Selah-${version}-arm64.zip`, `Selah-${version}-x64.zip` | `macos-latest` |
| Linux | `x64` | `.AppImage`, `.deb`, `.rpm` | `selah-${version}-x64.AppImage`, `selah-${version}-x64.deb`, `selah-${version}-x64.rpm` | `ubuntu-latest` (with `rpm` package installed) |

### Architecture Scope & Known Limitations
- **Windows ARM64 & Linux ARM64**: Omitted intentionally from automated targets until native ARM64 runners and `better-sqlite3` ABI testing on ARM64 hardware are available. Cross-compiling native `.node` addons without native testing risks broken runtime startup.
- **Unsigned Builds**: If signing secrets are not configured in GitHub Actions, releases are explicitly built unsigned (`CSC_IDENTITY_AUTO_DISCOVERY=false` on macOS when `MAC_CSC_LINK` is unset) and labeled as unsigned on the release website with SmartScreen / Gatekeeper guidance.

---

## 2. Local Packaging Commands

Run inside `daylight-desktop/`:

```bash
npm install
npm run typecheck
npm run build
npm test
```

Platform-specific package scripts:

```bash
# Windows NSIS Setup (.exe) + Portable (.exe)
npm run package:win

# Windows Portable (.exe) only
npm run package:win:portable

# macOS .dmg and .zip (arm64 + x64) - requires macOS host
npm run package:mac

# Linux .AppImage, .deb, and .rpm (x64) - requires Linux host with rpmbuild
npm run package:linux
```

Generated artifacts are written to `daylight-desktop/release/`. Native dependencies (`better-sqlite3`) are unpacked via `asarUnpack: ["node_modules/better-sqlite3/**/*"]` and rebuilt with `"npmRebuild": true`.

---

## 3. SQLite Persistence & Update Safety

User data is strictly separated from installer and temporary extraction directories:

- **Database file**: `selah.sqlite` inside Electron `app.getPath('userData')`:
  - **Windows**: `%APPDATA%\selah\selah.sqlite`
  - **macOS**: `~/Library/Application Support/selah/selah.sqlite`
  - **Linux**: `~/.config/selah/selah.sqlite`
- **Upgrade & reinstall preservation**: NSIS updates (`deleteAppDataOnUninstall: false`) and portable launches never overwrite `%APPDATA%\selah`.
- **Automatic rolling backups**: Startup migrations create timestamped snapshots (`selah-backup-*.sqlite`, retaining the newest 5) inside `userData` before applying schema changes.

---

## 4. Optional Code Signing & Notarization Secrets

Add these GitHub Repository Secrets under **Settings -> Secrets and variables -> Actions** when ready to ship signed binaries:

### Windows Authenticode Signing
- `WIN_CSC_LINK`: Base64-encoded `.pfx` code signing certificate.
- `WIN_CSC_KEY_PASSWORD`: Password protecting the `.pfx` file.

Verify locally in PowerShell:
```powershell
Get-AuthenticodeSignature "release\Selah-Setup-*.exe"
```

### macOS Code Signing & Apple Notarization
Requires `build/entitlements.mac.plist` (`allow-jit`, `allow-unsigned-executable-memory` for V8 and `better-sqlite3`):
- `MAC_CSC_LINK`: Base64-encoded Developer ID Application `.p12` certificate.
- `MAC_CSC_KEY_PASSWORD`: Password for `.p12`.
- `APPLE_ID`: Apple Developer account email.
- `APPLE_APP_SPECIFIC_PASSWORD`: App-specific password generated at [appleid.apple.com](https://appleid.apple.com).
- `APPLE_TEAM_ID`: 10-character Apple Developer Team ID.

---

## 5. GitHub Actions Workflows

- `.github/workflows/build.yml` (push/PR verification): Runs `typecheck`, `build`, `test`, packages all three platforms with `--publish never`, generates per-platform checksums, and uploads CI build artifacts.
- `.github/workflows/release.yml` (tag release pipeline): Triggered automatically on SemVer tags matching `v[0-9]+.[0-9]+.[0-9]+`:
  1. Verifies the pushed tag matches both `daylight-desktop/package.json` `"version"` and `daylight-desktop/src/shared/appConfig.ts` `APP_CONFIG.version`.
  2. Runs tests and builds in parallel on `windows-latest`, `macos-latest`, and `ubuntu-latest`.
  3. Collects all platform binaries, generates unified `SHA256SUMS.txt`, and publishes them atomically to the GitHub Release via `softprops/action-gh-release@v2`.

---

## 6. Release Checklist (Step-by-Step)

1. Update `"version"` in `daylight-desktop/package.json` (e.g., `0.2.0`) and `version` in `daylight-desktop/src/shared/appConfig.ts` (`'0.2.0'`).
2. Run local validation inside `daylight-desktop/`:
   ```powershell
   npm run typecheck
   npm run build
   npm test
   npm run package:win
   ```
3. Run website validation inside `website/`:
   ```powershell
   npm test
   npm run build
   ```
4. Commit and push to `main`:
   ```bash
   git add -A
   git commit -m "chore(release): prepare v0.2.0 multi-platform distribution"
   git push origin main
   ```
5. Create and push the matching SemVer tag:
   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```
6. Monitor `.github/workflows/release.yml` until all runners (`windows-latest`, `macos-latest`, `ubuntu-latest`, and `publish-release`) succeed.
7. Verify on `https://github.com/Kaliza-e/Hello_118_24/releases/tag/v0.2.0` that `.exe`, `.dmg`, `.zip`, `.AppImage`, `.deb`, `.rpm`, and `SHA256SUMS.txt` are attached, and verify the live Selah website refreshes to show the new packages and checksums.
