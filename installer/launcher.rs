#![windows_subsystem = "windows"]

use std::env;
use std::fs::OpenOptions;
use std::io::Write;
use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

fn log_line(log: &mut std::fs::File, message: &str) {
    let _ = writeln!(log, "{message}");
}

fn main() {
    let root = env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(PathBuf::from))
        .unwrap_or_else(|| PathBuf::from("."));

    let log_path = root.join("nisar-pro-launcher.log");
    let mut log = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .expect("could not create launcher log");

    let gateway_dir = root.join("sar-gateway");
    let gateway = gateway_dir
        .join("target")
        .join("release")
        .join("sar-gateway.exe");

    if !gateway.exists() {
        log_line(&mut log, &format!("Gateway binary not found: {}", gateway.display()));
        return;
    }

    let mut gateway_child: Child = match Command::new(&gateway)
        .current_dir(&gateway_dir)
        .env("LOCAL_MODE", "true")
        .env("RUST_LOG", "info")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
    {
        Ok(child) => child,
        Err(error) => {
            log_line(&mut log, &format!("Could not start gateway: {error}"));
            return;
        }
    };

    log_line(&mut log, "NISAR Pro 1.0.0 launcher started the local gateway.");

    let deadline = Instant::now() + Duration::from_secs(45);
    let mut ready = false;
    while Instant::now() < deadline {
        if let Ok(Some(status)) = gateway_child.try_wait() {
            log_line(&mut log, &format!("Gateway exited before readiness: {status}"));
            return;
        }
        if TcpStream::connect(("127.0.0.1", 3000)).is_ok() {
            ready = true;
            break;
        }
        thread::sleep(Duration::from_millis(500));
    }

    if ready {
        let _ = Command::new("cmd")
            .args(["/C", "start", "", "http://localhost:3000/"])
            .current_dir(&root)
            .spawn();
        log_line(&mut log, "Dashboard opened at http://localhost:3000/.");
    } else {
        log_line(&mut log, "Gateway did not become ready within 45 seconds.");
    }

    // Keep the launcher alive so the gateway remains associated with the app.
    let _ = gateway_child.wait();
}
