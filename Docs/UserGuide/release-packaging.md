# NISAR Pro release packaging

## Release flow

Development happens on `dev`. A release is produced only after the changes
are merged into `main` and pushed to GitLab.

1. GitLab mirrors `main` to GitHub using `GITHUB_PAT`.
2. GitLab publishes the Linux x86_64 package to its Generic Package Registry.
3. GitHub Actions builds the Windows x64 package and deploys the hosted
   dashboard.
4. Windows: a version tag (`v1.1.0`) publishes a GitHub release with `NISAR-Pro-Setup.exe` and
   `NISAR-Pro-windows-x64-portable.zip`. Linux: GitLab publishes the tarball to its package registry.

The CI jobs do not process NISAR granules. They package the already-built
gateway, processor, and dashboard. Full-scene processing remains a user-side
operation.

## Windows users

Run `NISAR-Pro-Setup.exe`, or extract `NISAR-Pro-windows-x64-portable.zip` and double-click
`NISAR Pro.exe`. Rust, Cargo, Node.js, and Python are not required.

## Linux users

Download the Linux archive and extract it:

```bash
tar -xzf NISAR-Pro-1.0.0-linux-x86_64.tar.gz
cd NISAR-Pro-1.0.0-linux-x86_64
./nisar-pro
```

The installer published with the release installs into
`~/.local/share/nisar-pro/1.0.0` and creates `~/.local/bin/nisar-pro`.

The Linux release targets x86_64 systems with a compatible glibc runtime.
The original NISAR `.h5` granules are intentionally not included in the
release.
