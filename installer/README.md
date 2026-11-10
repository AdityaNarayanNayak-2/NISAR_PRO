# Installers

| File | Platform | What it is |
|---|---|---|
| `launcher.rs` | Windows | Source of `NISAR Pro.exe`. Starts the server with no console window, opens the dashboard, shows errors in a message box. `--stop` closes it. |
| `windows/NISAR-Pro.iss` | Windows | Inno Setup script for `NISAR-Pro-Setup-1.0.0.exe` |
| `windows/nisar-pro.ico` | Windows | App icon |
| `nisar-pro` | Linux | Start script inside the Linux package |
| `install.sh` | Linux | Downloads the Linux package and links `nisar-pro` into `~/.local/bin` |

## Windows

The GitHub workflow `.github/workflows/deploy-dashboard.yml` builds both Windows files on
every push to `main`:

- `NISAR-Pro-Setup-1.0.0.exe`: installer. Per-user install into
  `%LOCALAPPDATA%\Programs\NISAR Pro`, no admin rights. Adds Start Menu entries
  "NISAR Pro" and "Stop NISAR Pro", an optional desktop icon, and an uninstaller.
- `NISAR-Pro-1.0.0-windows-x64-portable.zip`: the same files without installing.

How the app behaves:

- The server listens on `127.0.0.1:3000` only, so Windows Firewall does not ask for access.
- Opening the app a second time only opens the dashboard again.
- If port 3000 is used by another program, a message says so.
- Logs: `%LOCALAPPDATA%\NISAR Pro\logs\gateway.log`.
- Results: `sar-gateway\results` inside the install folder.

To build by hand on Windows (Rust and Inno Setup 6 installed, dashboard built):

```powershell
cargo build --release --manifest-path sar_science_processor\Cargo.toml
cargo build --release --manifest-path sar-gateway\Cargo.toml
rustc -O -C panic=abort --edition 2021 installer\launcher.rs -o "NISAR Pro.exe"
# assemble NISAR-Pro-1.0.0\ as in the workflow, then:
iscc /DSourceDir="$PWD\NISAR-Pro-1.0.0" /O"$PWD" installer\windows\NISAR-Pro.iss
```

## Linux

```bash
curl -fsSL <install.sh URL from the GitLab release> | bash
nisar-pro
```
