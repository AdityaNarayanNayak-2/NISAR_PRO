/// Quick NISAR HDF5 inspector — lists available datasets and their shapes
use rustyhdf5::File;
use std::env;

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: inspect_h5 <file.h5>");
        std::process::exit(1);
    }

    let file = File::open(&args[1]).expect("Failed to open HDF5 file");

    println!("=== NISAR HDF5 Inspector ===");
    println!("File: {}\n", args[1]);

    // Check GCOV datasets
    let gcov_base = "/science/LSAR/GCOV/grids/frequencyA";
    let terms = ["HHHH", "HVHV", "HHHV", "VVVV", "VHVH"];
    println!("--- GCOV Datasets (frequencyA) ---");
    for term in &terms {
        let path = format!("{}/{}", gcov_base, term);
        match file.dataset(&path) {
            Ok(ds) => {
                let shape = ds.shape().unwrap_or_default();
                // Read first few values to check for NaN
                let sample: Vec<f32> = ds.read_f32().unwrap_or_default();
                let finite_count = sample.iter().filter(|v| v.is_finite() && **v != 0.0).count();
                let total = sample.len();
                let pct = if total > 0 { 100.0 * finite_count as f64 / total as f64 } else { 0.0 };
                println!("  {} → shape={:?}, valid={:.1}% ({}/{})",
                    term, shape, pct, finite_count, total);
            }
            Err(_) => println!("  {} → NOT FOUND", term),
        }
    }

    // Check frequencyB
    let gcov_base_b = "/science/LSAR/GCOV/grids/frequencyB";
    println!("\n--- GCOV Datasets (frequencyB) ---");
    for term in &terms {
        let path = format!("{}/{}", gcov_base_b, term);
        match file.dataset(&path) {
            Ok(ds) => {
                let shape = ds.shape().unwrap_or_default();
                let sample: Vec<f32> = ds.read_f32().unwrap_or_default();
                let finite_count = sample.iter().filter(|v| v.is_finite() && **v != 0.0).count();
                let total = sample.len();
                let pct = if total > 0 { 100.0 * finite_count as f64 / total as f64 } else { 0.0 };
                println!("  {} → shape={:?}, valid={:.1}% ({}/{})",
                    term, shape, pct, finite_count, total);
            }
            Err(_) => println!("  {} → NOT FOUND", term),
        }
    }

    // Check RSLC paths too
    println!("\n--- RSLC Datasets (if present) ---");
    for pol in &["HH", "HV", "VV", "VH"] {
        let path = format!("/science/LSAR/RSLC/swaths/frequencyA/{}", pol);
        match file.dataset(&path) {
            Ok(ds) => {
                let shape = ds.shape().unwrap_or_default();
                println!("  {} → shape={:?}", pol, shape);
            }
            Err(_) => println!("  {} → NOT FOUND", pol),
        }
    }
}
