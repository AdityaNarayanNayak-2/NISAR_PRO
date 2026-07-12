use crate::radar_utils::{generate_chirp, FFTProcessor};
use crate::rcmc::{apply_rcmc, RcmcParams};
use log::info;
use ndarray::prelude::*;
use num_complex::Complex32;
use num_traits::Zero;
use rayon::prelude::*;

/// Core Structure for SAR Processing
pub struct SARProcessor {
    pub carrier_frequency: f32,
    pub sample_rate: f32,
    pub pulse_duration: f32,
    pub bandwidth: f32,
    pub prf: f32,
    pub rcmc_params: Option<RcmcParams>,
}

impl SARProcessor {
    pub fn new(carrier_freq: f32, sample_rate: f32, pulse_dur: f32, bw: f32, prf: f32) -> Self {
        let rcmc_params = Some(RcmcParams::from_frequency(
            carrier_freq,
            7500.0,
            800_000.0,
        ));

        Self {
            carrier_frequency: carrier_freq,
            sample_rate,
            pulse_duration: pulse_dur,
            bandwidth: bw,
            prf,
            rcmc_params,
        }
    }

    pub fn with_rcmc_params(mut self, params: RcmcParams) -> Self {
        self.rcmc_params = Some(params);
        self
    }

    pub fn without_rcmc(mut self) -> Self {
        self.rcmc_params = None;
        self
    }

    /// Step 1: Range Compression
    /// Uses overlap-save style zero-padding to prevent circular convolution artifacts.
    pub fn range_compression(&self, raw_data: &Array2<Complex32>) -> Array2<Complex32> {
        let (n_az, n_rg) = raw_data.dim();
        info!("Range Compression: {} azimuth × {} range...", n_az, n_rg);

        let chirp = generate_chirp(self.pulse_duration, self.bandwidth, self.sample_rate);
        let chirp_len = chirp.len();

        // Zero-pad FFT length to avoid wrap-around and align with power-of-two FFT plans
        let fft_len = (n_rg + chirp_len - 1).next_power_of_two();
        let fft_proc = FFTProcessor::new(fft_len);

        // Prepare matched filter in frequency domain: H(f) = conj(FFT(h(t)))
        let mut h_freq = vec![Complex32::new(0.0, 0.0); fft_len];
        for i in 0..chirp_len.min(fft_len) {
            h_freq[i] = chirp[i];
        }
        fft_proc.forward(&mut h_freq);
        for h in &mut h_freq {
            *h = h.conj();
        }

        // Process each azimuth line in parallel
        let mut compressed = Array2::zeros((n_az, n_rg));
        compressed
            .axis_iter_mut(Axis(0))
            .into_par_iter()
            .zip(raw_data.axis_iter(Axis(0)))
            .for_each(|(mut out_row, in_row)| {
                let mut line = in_row.to_vec();
                line.resize(fft_len, Complex32::zero());

                fft_proc.forward(&mut line);

                for j in 0..fft_len {
                    line[j] *= h_freq[j];
                }

                fft_proc.inverse(&mut line);

                // Crop to original range dimension (discard linear convolution tail)
                for j in 0..n_rg {
                    out_row[j] = line[j];
                }
            });

        info!("Range Compression complete.");
        compressed
    }

    /// Step 2: Azimuth Compression with RCMC
    /// Fixed phase sign, cache-friendly transposition, and parallel Doppler processing.
    pub fn azimuth_compression(&self, range_compressed: &Array2<Complex32>) -> Array2<Complex32> {
        let (n_az, n_rg) = range_compressed.dim();
        info!("Azimuth Compression: {} × {}...", n_az, n_rg);

        let fft_len = n_az.next_power_of_two();
        let fft_proc = FFTProcessor::new(fft_len);

        // Transpose to [Range × Azimuth] for cache-friendly column FFTs
        let mut range_doppler = Array2::zeros((n_rg, n_az));
        range_doppler
            .axis_iter_mut(Axis(0))
            .into_par_iter()
            .zip(range_compressed.axis_iter(Axis(1)))
            .for_each(|(mut rd_col, rg_col)| {
                let mut buf = rg_col.to_vec();
                buf.resize(fft_len, Complex32::zero());
                fft_proc.forward(&mut buf);
                for i in 0..n_az {
                    rd_col[i] = buf[i];
                }
            });

        // Apply RCMC
        let rcmc_corrected = if let Some(ref params) = self.rcmc_params {
            info!("Applying RCMC (λ={:.4}m, v={:.0}m/s)...", params.wavelength, params.velocity);
            apply_rcmc(
                &range_doppler,
                self.sample_rate,
                self.prf,
                params.wavelength,
                params.velocity,
                params.near_range,
            )
        } else {
            info!("RCMC disabled.");
            range_doppler
        };

        // Azimuth Matched Filtering (Range-Dependent FM Rate)
        info!("Applying azimuth matched filter...");
        let c = 299_792_458.0_f32;
        let range_spacing = c / (2.0 * self.sample_rate);
        let (wavelength, velocity, near_range) = self.rcmc_params
            .as_ref()
            .map(|p| (p.wavelength, p.velocity, p.near_range))
            .unwrap_or((0.0555, 7500.0, 800_000.0));

        let mut filtered = rcmc_corrected.clone();
        filtered
            .axis_iter_mut(Axis(0))
            .into_par_iter()
            .enumerate()
            .for_each(|(rg_idx, mut dop_line)| {
                let slant_range = near_range + (rg_idx as f32) * range_spacing;
                // Azimuth FM rate: $K_a = \frac{2v^2}{\lambda R_0}$
                let ka = 2.0 * velocity.powi(2) / (wavelength * slant_range);

                for dop_idx in 0..n_az {
                    // Centered Doppler frequency
                    let f_dop = ((dop_idx as f32) - (n_az as f32 / 2.0)) * self.prf / (n_az as f32);
                    
                    // Matched filter phase: $\exp\left(+j \frac{\pi f_\eta^2}{K_a}\right)$
                    // Signal phase is $\exp\left(-j \frac{\pi f_\eta^2}{K_a}\right)$, so we multiply by positive phase
                    let phase = std::f32::consts::PI * f_dop.powi(2) / ka;
                    dop_line[dop_idx] *= Complex32::from_polar(1.0, phase);
                }
            });

        // IFFT back to azimuth domain
        let mut focused = Array2::zeros((n_az, n_rg));
        focused
            .axis_iter_mut(Axis(1))
            .into_par_iter()
            .zip(filtered.axis_iter(Axis(0)))
            .for_each(|(mut az_col, dop_line)| {
                let mut buf = dop_line.to_vec();
                buf.resize(fft_len, Complex32::zero());
                fft_proc.inverse(&mut buf);
                for i in 0..n_az {
                    az_col[i] = buf[i];
                }
            });

        info!("Azimuth Compression complete.");
        focused
    }

    /// Full Range-Doppler Algorithm Pipeline
    pub fn process_rda(&self, raw_data: &Array2<Complex32>) -> Array2<Complex32> {
        info!("=== Starting Full RDA Pipeline ===");
        let rng_compressed = self.range_compression(raw_data);
        let focused = self.azimuth_compression(&rng_compressed);
        info!("=== RDA Pipeline Complete ===");
        focused
    }
}
