// NISAR Pro Windows launcher ("NISAR Pro.exe").
//
// Build (no crates needed):
//   rustc -O -C panic=abort --edition 2021 installer/launcher.rs -o "NISAR Pro.exe"
//
// What it does:
//   * If NISAR Pro is already running, it only opens the dashboard.
//   * Otherwise it starts sar-gateway.exe in the background (no console window),
//     waits until it answers, then opens http://localhost:3000/ in the browser.
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
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

const APP: &str = "NISAR Pro";
const VERSION: &str = "1.0.0";
const PORT: u16 = 3000;
const URL: &str = "http://localhost:3000/";
const START_TIMEOUT: Duration = Duration::from_secs(60);

const CREATE_NO_WINDOW: u32 = 0x0800_0000;
const MB_ICONERROR: u32 = 0x10;
const MB_ICONINFORMATION: u32 = 0x40;
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

fn message(text: &str, kind: u32) {
    let caption = wide(APP);
    let body = wide(text);
    unsafe {
        MessageBoxW(std::ptr::null_mut(), body.as_ptr(), caption.as_ptr(), kind);
    }
}

fn open_dashboard() {
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

fn port_state() -> PortState {
    let addr = SocketAddr::from(([127, 0, 0, 1], PORT));
    let mut stream = match TcpStream::connect_timeout(&addr, Duration::from_millis(700)) {
        Ok(s) => s,
        Err(_) => return PortState::Free,
    };
    let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
    let request = "GET /jobs/health-ping HTTP/1.0\r\nHost: localhost\r\n\r\n";
    if stream.write_all(request.as_bytes()).is_err() {
        return PortState::OtherProgram;
    }
    let mut reply = String::new();
    let _ = stream.read_to_string(&mut reply);
    if reply.starts_with("HTTP/1.") && reply.contains("\"ok\"") {
        PortState::NisarPro
    } else {
        PortState::OtherProgram
    }
}

fn log_dir() -> PathBuf {
    let base = env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(env::temp_dir);
    base.join(APP).join("logs")
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
            open_dashboard();
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

    let deadline = Instant::now() + START_TIMEOUT;
    while Instant::now() < deadline {
        if let Ok(Some(status)) = child.try_wait() {
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
            open_dashboard();
            // Note when this copy started, for support.
            if let Ok(mut f) = File::create(logs.join("launcher.log")) {
                let _ = writeln!(f, "{APP} {VERSION} started the server (pid {}).", child.id());
            }
            return; // The server keeps running. Use "Stop NISAR Pro" to close it.
        }
        thread::sleep(Duration::from_millis(500));
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
