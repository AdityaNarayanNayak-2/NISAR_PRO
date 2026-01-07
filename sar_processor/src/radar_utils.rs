use ndarray::{Array1, ArrayView1};
use num_complex::Complex32;
use rustfft::{Fft, FftPlanner};
use std::f32::consts::PI;
use std::sync::Arc;

/// Generates a Linear Frequency Modulated (LFM) chirp signal.
///
/// This is the "pulse" the satellite sends out.
/// We need to replicate it to create the "Matched Filter".
///
/// * `duration`: Pulse duration in seconds
/// * `bandwidth`: Bandwidth in Hz
/// * `sample_rate`: Sampling frequency in Hz
pub fn generate_chirp(duration: f32, bandwidth: f32, sample_rate: f32) -> Array1<Complex32> {
    let num_samples = (duration * sample_rate).ceil() as usize;
    let k = bandwidth / duration; // Chirp rate (slope)
    let dt = 1.0 / sample_rate;

    let mut chirp = Vec::with_capacity(num_samples);

    // t goes from -duration/2 to +duration/2
    let t_start = -duration / 2.0;

    for i in 0..num_samples {
        let t = t_start + (i as f32) * dt;

        // Phase formula: phi(t) = pi * k * t^2
        let phase = PI * k * t.powi(2);

        // Signal = exp(j * phase)
        chirp.push(Complex32::from_polar(1.0, phase));
    }

    Array1::from(chirp)
}

/// Helper struct to manage FFT planners efficiently.
/// Creating a planner is expensive, so we reuse it.
pub struct FFTProcessor {
    forward_fft: Arc<dyn Fft<f32>>,
    inverse_fft: Arc<dyn Fft<f32>>,
    len: usize,
}

impl FFTProcessor {
    pub fn new(len: usize) -> Self {
        let mut planner = FftPlanner::new();
        let forward_fft = planner.plan_fft_forward(len);
        let inverse_fft = planner.plan_fft_inverse(len);

        Self {
            forward_fft,
            inverse_fft,
            len,
        }
    }

    /// Performs Forward FFT (Time -> Frequency)
    pub fn forward(&self, data: &mut [Complex32]) {
        self.forward_fft.process(data);
    }

    /// Performs Inverse FFT (Frequency -> Time)
    /// Note: Result is NOT normalized by 1/N. You usually don't need to in radar math until the very end.
    pub fn inverse(&self, data: &mut [Complex32]) {
        self.inverse_fft.process(data);
    }
}
