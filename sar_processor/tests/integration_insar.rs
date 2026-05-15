//! Integration tests for the full InSAR pipeline
//!
//! Verifies the entire sequence from coregistration through displacement calculation.

use ndarray::Array2;
use num_complex::Complex32;
use std::f32::consts::PI;

use sar_processor::insar;
use sar_processor::coregister;
use sar_processor::multilook;
use sar_processor::phase_filter;
use sar_processor::unwrap;
use sar_processor::topo_phase;

fn generate_flat_slc(rows: usize, cols: usize) -> Array2<Complex32> {
    Array2::from_elem((rows, cols), Complex32::new(1.0, 0.0))
}

#[test]
#[ignore = "Full pipeline integration test takes significant time"]
fn test_full_insar_pipeline() {
    let rows = 512;
    let cols = 512;

    // 1. Setup Master and Slave
    let master_slc = generate_flat_slc(rows, cols);
    
    // Inject subsidence bowl into slave
    let wavelength = 0.0555_f32; // 5.55 cm (C-band)
    let max_disp_m = 0.010; // 10mm
    let max_phase = max_disp_m * 4.0 * PI / wavelength;
    let center_r = rows / 2;
    let center_c = cols / 2;
    
    let slave_slc = Array2::from_shape_fn((rows, cols), |(r, c)| {
        let dr = (r as f32 - center_r as f32) / (rows as f32 * 0.2);
        let dc = (c as f32 - center_c as f32) / (cols as f32 * 0.2);
        let gauss = (-0.5 * (dr * dr + dc * dc)).exp();
        let defo_phase = max_phase * gauss;
        // Injecting phase. Coregistration will measure 0.0 shift, which is < 0.2px.
        Complex32::from_polar(1.0, defo_phase)
    });

    // 2. Coregistration
    let coregistered_slave = coregister::coregister(&master_slc, &slave_slc, 256, 128, 16).unwrap();
    
    // 3. Multi-looking (e.g. 1x1 just to keep sizes same, or say 2x2)
    let (rg_looks, az_looks) = multilook::suggest_multilook_factors(rows, cols, 256, 256);
    let master_ml = multilook::multilook(&master_slc, rg_looks, az_looks);
    let slave_ml = multilook::multilook(&coregistered_slave, rg_looks, az_looks);
    
    // 4. Interferogram & Coherence
    let ifgram = insar::compute_interferogram(&master_ml, &slave_ml);
    let coherence = insar::estimate_coherence(&master_ml, &slave_ml, 3);
    
    // Assert coherence is high (since we have no noise)
    let avg_coh = coherence.sum() / (coherence.len() as f32);
    assert!(avg_coh > 0.7, "Average coherence should be > 0.7, got {}", avg_coh);

    // 5. Goldstein Filter
    let filtered_ifgram = phase_filter::goldstein_filter(&ifgram, &coherence, 32, 16);
    
    // 6. Wrapped Phase
    let wrapped_phase = insar::extract_phase(&filtered_ifgram);
    
    // 7. Phase Unwrapping
    let unwrapped_phase = unwrap::unwrap_phase(&wrapped_phase, &coherence);
    
    // 8. Topographic Phase Removal
    let flat_dem = Array2::zeros((unwrapped_phase.nrows(), unwrapped_phase.ncols()));
    let simulated_topo = topo_phase::simulate_topo_phase(
        &flat_dem, 
        0.0, // baseline
        wavelength as f64, 
        800_000.0, // slant_range
        30.0_f64.to_radians() // incidence_angle
    );
    let final_phase = topo_phase::remove_topo_phase(&unwrapped_phase, &simulated_topo);

    // 9. Displacement mapping
    // disp = phase * wavelength / (4π)
    let phase_to_m = wavelength / (4.0 * PI);
    
    // Find max displacement
    let mut max_measured_disp = 0.0_f32;
    for &phase in final_phase.iter() {
        if phase.is_nan() { continue; }
        // The unwrapped phase might have a global offset, but since edges have 0 injected phase,
        // the unwrapper usually starts from edges (high coherence) and sets them near 0.
        let disp = phase * phase_to_m;
        if disp.abs() > max_measured_disp {
            max_measured_disp = disp.abs();
        }
    }
    
    println!("Max injected displacement: {:.2} mm", max_disp_m * 1000.0);
    println!("Max measured displacement: {:.2} mm", max_measured_disp * 1000.0);
    
    // Assert displacement within 20% of 10mm (0.01m)
    let error_margin = 0.010 * 0.20; // 2mm
    assert!(
        (max_measured_disp - max_disp_m).abs() < error_margin,
        "Measured displacement ({:.2} mm) not within 20% of target ({:.2} mm)",
        max_measured_disp * 1000.0, max_disp_m * 1000.0
    );
}
