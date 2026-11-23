// NISAR Pro Windows launcher ("NISAR Pro.exe").
//
// Build (no crates needed):
//   rustc -O -C panic=abort --edition 2021 installer/launcher.rs -o "NISAR Pro.exe"
//
// What it does:
//   * Opens NISAR Pro in its own app window (Microsoft Edge or Chrome in app mode, own
//     profile in %LOCALAPPDATA%\NISAR Pro\window): no tabs, no address bar, own taskbar icon.
//     A start screen shows at once and switches to the dashboard when the server answers.
//   * Starts sar-gateway.exe in the background (no console window) if it is not running.
//   * Closing the window quits NISAR Pro. If a run is still processing, it asks first.
//   * No Edge or Chrome: falls back to the default browser; the server then keeps running.
//   * If NISAR Pro is already running, it only opens another window.
//   * "NISAR Pro.exe --stop" stops the gateway and any running engine job.
//   * Problems are shown in a message box. Logs go to %LOCALAPPDATA%\NISAR Pro\logs.
#![windows_subsystem = "windows"]

use std::env;
use std::ffi::{c_void, OsStr};
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::os::windows::ffi::OsStrExt;
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

const APP: &str = "NISAR Pro";
// Set by the release build from the git tag (NISAR_VERSION=1.1.0).
const VERSION: &str = match option_env!("NISAR_VERSION") {
    Some(v) => v,
    None => "dev",
};
const PORT: u16 = 3000;
const URL: &str = "http://localhost:3000/app";
const START_TIMEOUT: Duration = Duration::from_secs(60);

const CREATE_NO_WINDOW: u32 = 0x0800_0000;
const MB_ICONERROR: u32 = 0x10;
const MB_ICONINFORMATION: u32 = 0x40;
const MB_ICONWARNING: u32 = 0x30;
const MB_YESNO: u32 = 0x04;
const IDYES: i32 = 6;
const SW_SHOWNORMAL: i32 = 1;

#[link(name = "user32")]
extern "system" {
    fn MessageBoxW(hwnd: *mut c_void, text: *const u16, caption: *const u16, kind: u32) -> i32;
}

#[link(name = "shell32")]
extern "system" {
    fn ShellExecuteW(
        hwnd: *mut c_void,
        operation: *const u16,
        file: *const u16,
        parameters: *const u16,
        directory: *const u16,
        show: i32,
    ) -> isize;
}

fn wide(s: &str) -> Vec<u16> {
    OsStr::new(s).encode_wide().chain(std::iter::once(0)).collect()
}

fn message(text: &str, kind: u32) -> i32 {
    let caption = wide(APP);
    let body = wide(text);
    unsafe { MessageBoxW(std::ptr::null_mut(), body.as_ptr(), caption.as_ptr(), kind) }
}

fn open_in_default_browser() {
    let op = wide("open");
    let url = wide(URL);
    unsafe {
        ShellExecuteW(
            std::ptr::null_mut(),
            op.as_ptr(),
            url.as_ptr(),
            std::ptr::null(),
            std::ptr::null(),
            SW_SHOWNORMAL,
        );
    }
}

/// What is listening on port 3000?
enum PortState {
    Free,
    NisarPro,
    OtherProgram,
}

/// Plain HTTP GET on localhost. None = nothing listening.
fn http_get(path: &str) -> Option<String> {
    let addr = SocketAddr::from(([127, 0, 0, 1], PORT));
    let mut stream = TcpStream::connect_timeout(&addr, Duration::from_millis(700)).ok()?;
    let _ = stream.set_read_timeout(Some(Duration::from_secs(3)));
    let request = format!("GET {path} HTTP/1.0\r\nHost: localhost\r\n\r\n");
    let mut reply = String::new();
    if stream.write_all(request.as_bytes()).is_ok() {
        let _ = stream.read_to_string(&mut reply);
    }
    Some(reply)
}

fn port_state() -> PortState {
    match http_get("/jobs/health-ping") {
        None => PortState::Free,
        Some(r) if r.starts_with("HTTP/1.") && r.contains("\"ok\"") => PortState::NisarPro,
        Some(_) => PortState::OtherProgram,
    }
}

/// True if any run is queued or processing.
fn runs_in_progress() -> bool {
    http_get("/jobs")
        .map(|r| r.contains("\"status\":\"running\"") || r.contains("\"status\":\"queued\""))
        .unwrap_or(false)
}

fn app_data() -> PathBuf {
    env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(env::temp_dir)
        .join(APP)
}

/// Edge ships with Windows 10/11; Chrome is the second choice.
fn find_app_browser() -> Option<PathBuf> {
    let mut candidates = Vec::new();
    for var in ["ProgramFiles(x86)", "ProgramFiles", "LOCALAPPDATA"] {
        if let Some(base) = env::var_os(var).map(PathBuf::from) {
            candidates.push(base.join(r"Microsoft\Edge\Application\msedge.exe"));
            candidates.push(base.join(r"Google\Chrome\Application\chrome.exe"));
        }
    }
    // Edge before Chrome whatever the folder.
    candidates.sort_by_key(|p| !p.to_string_lossy().contains("Edge"));
    candidates.into_iter().find(|p| p.exists())
}

/// Start screen shown while the server starts. It probes the server with the app icon
/// (an image loads from a file:// page without CORS) and then opens the dashboard.
fn write_start_screen() -> Option<String> {
    let html = format!(
        r#"<!doctype html><html><head><meta charset="utf-8"><title>{APP}</title>
<style>html,body{{margin:0;height:100%;background:#0b0c0e;color:#f3f4f6;
font-family:"Segoe UI Variable","Segoe UI",system-ui,sans-serif}}
main{{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px}}
h1{{font-weight:600;font-size:28px;letter-spacing:.02em;margin:0}}
p{{margin:0;color:#9ca3af;font-size:14px}}
.bar{{width:180px;height:3px;border-radius:3px;background:#24262b;overflow:hidden}}
.bar i{{display:block;width:40%;height:100%;border-radius:3px;background:#f3f4f6;animation:m 1.2s ease-in-out infinite}}
@keyframes m{{0%{{transform:translateX(-100%)}}100%{{transform:translateX(250%)}}}}
small{{position:fixed;left:0;right:0;text-align:center;bottom:18px;color:#6b7280;font-size:12px}}</style></head>
<body><main><h1>{APP}</h1><div class="bar"><i></i></div><p>Starting the local server…</p></main>
<small>Version {VERSION} · runs on this computer</small>
<script>
function probe(){{var i=new Image();i.onload=function(){{location.replace("{URL}")}};
i.onerror=function(){{setTimeout(probe,400)}};i.src="http://localhost:{PORT}/icon.png?t="+Date.now()}}
probe();
</script></body></html>"#
    );
    let path = app_data().join("start.html");
    fs::create_dir_all(app_data()).ok()?;
    fs::write(&path, html).ok()?;
    let p = path.to_string_lossy().replace('\\', "/").replace(' ', "%20");
    Some(format!("file:///{p}"))
}

/// Open NISAR Pro in its own window. Returns the browser process when one was started.
fn open_window(start_url: &str) -> Option<Child> {
    let Some(browser) = find_app_browser() else {
        open_in_default_browser();
        return None;
    };
    let profile = app_data().join("window");
    let child = Command::new(browser)
        .arg(format!("--app={start_url}"))
        .arg(format!("--user-data-dir={}", profile.display()))
        .args([
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-background-mode",
            "--start-maximized",
        ])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn();
    match child {
        Ok(c) => Some(c),
        Err(_) => {
            open_in_default_browser();
            None
        }
    }
}

fn log_dir() -> PathBuf {
    app_data().join("logs")
}

fn last_lines(path: &Path, n: usize) -> String {
    let text = fs::read_to_string(path).unwrap_or_default();
    let lines: Vec<&str> = text.lines().collect();
    let start = lines.len().saturating_sub(n);
    lines[start..].join("\n")
}

fn stop_all() {
    for exe in ["sar-gateway.exe", "sar_science_processor.exe"] {
        let _ = Command::new("taskkill")
            .args(["/IM", exe, "/F"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .creation_flags(CREATE_NO_WINDOW)
            .status();
    }
}

fn main() {
    let root = env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(PathBuf::from))
        .unwrap_or_else(|| PathBuf::from("."));

    if env::args().any(|a| a == "--stop") {
        stop_all();
        message("NISAR Pro has stopped.", MB_ICONINFORMATION);
        return;
    }

    match port_state() {
        PortState::NisarPro => {
            // Server already running (started by another window): just open a window.
            let _ = open_window(URL);
            return;
        }
        PortState::OtherProgram => {
            message(
                "Port 3000 is already used by another program.\n\n\
                 Close that program, then start NISAR Pro again.",
                MB_ICONERROR,
            );
            return;
        }
        PortState::Free => {}
    }

    let gateway_dir = root.join("sar-gateway");
    let gateway = gateway_dir.join("target").join("release").join("sar-gateway.exe");
    let engine = root
        .join("sar_science_processor")
        .join("target")
        .join("release")
        .join("sar_science_processor.exe");
    let dashboard = root.join("sar-dashboard-v3").join("dist").join("index.html");

    let missing: Vec<String> = [&gateway, &engine, &dashboard]
        .iter()
        .filter(|p| !p.exists())
        .map(|p| p.display().to_string())
        .collect();
    if !missing.is_empty() {
        message(
            &format!(
                "NISAR Pro is not installed completely. These files are missing:\n\n{}\n\n\
                 Please run the installer again.",
                missing.join("\n")
            ),
            MB_ICONERROR,
        );
        return;
    }

    let logs = log_dir();
    let _ = fs::create_dir_all(&logs);
    let _ = fs::create_dir_all(gateway_dir.join("results"));
    let log_path = logs.join("gateway.log");
    let log_file = OpenOptions::new().create(true).write(true).truncate(true).open(&log_path);
    let (out, err) = match log_file {
        Ok(f) => {
            let err = f.try_clone().map(Stdio::from).unwrap_or_else(|_| Stdio::null());
            (Stdio::from(f), err)
        }
        Err(_) => (Stdio::null(), Stdio::null()),
    };

    let mut child = match Command::new(&gateway)
        .current_dir(&gateway_dir)
        .env("LOCAL_MODE", "true")
        .env("NISAR_BIND", "127.0.0.1")
        .env("RUST_LOG", "info")
        .stdin(Stdio::null())
        .stdout(out)
        .stderr(err)
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
    {
        Ok(c) => c,
        Err(e) => {
            message(&format!("Could not start the NISAR Pro server:\n\n{e}"), MB_ICONERROR);
            return;
        }
    };

    // Window opens at once on the start screen; it switches to the dashboard by itself.
    let start_url = write_start_screen().unwrap_or_else(|| URL.to_string());
    let opened_at = Instant::now();
    let mut window = if find_app_browser().is_some() { open_window(&start_url) } else { None };

    let deadline = Instant::now() + START_TIMEOUT;
    while Instant::now() < deadline {
        if let Ok(Some(status)) = child.try_wait() {
            if let Some(w) = window.as_mut() {
                let _ = w.kill();
            }
            message(
                &format!(
                    "The NISAR Pro server stopped while starting ({status}).\n\n\
                     Last log lines:\n{}\n\nFull log: {}",
                    last_lines(&log_path, 8),
                    log_path.display()
                ),
                MB_ICONERROR,
            );
            return;
        }
        if let PortState::NisarPro = port_state() {
            // Note when this copy started, for support.
            if let Ok(mut f) = File::create(logs.join("launcher.log")) {
                let _ = writeln!(f, "{APP} {VERSION} started the server (pid {}).", child.id());
            }
            match window {
                Some(w) => wait_then_quit(w, opened_at),
                None => open_in_default_browser(), // server keeps running; "Stop NISAR Pro" closes it
            }
            return;
        }
        thread::sleep(Duration::from_millis(400));
    }

    if let Some(w) = window.as_mut() {
        let _ = w.kill();
    }
    let _ = child.kill();
    message(
        &format!(
            "The NISAR Pro server did not start within {} seconds.\n\nFull log: {}",
            START_TIMEOUT.as_secs(),
            log_path.display()
        ),
        MB_ICONERROR,
    );
}

/// Wait until the NISAR Pro window is closed, then stop the server (asking first if a
/// run is still processing).
fn wait_then_quit(mut window: Child, opened_at: Instant) {
    let _ = window.wait();
    // The browser handed the window to an already open NISAR Pro window and exited at once:
    // that window still needs the server, so leave it running.
    if opened_at.elapsed() < Duration::from_secs(5) {
        return;
    }
    if runs_in_progress() {
        let answer = message(
            "A run is still processing.\n\n\
             Yes: stop it and quit NISAR Pro.\n\
             No: keep processing in the background. Open NISAR Pro again to see the result.",
            MB_YESNO | MB_ICONWARNING,
        );
        if answer != IDYES {
            return;
        }
    }
    stop_all();
}
