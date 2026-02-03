use crate::radar_utils::{generate_chirp, FFTProcessor};
use crate::rcmc::{apply_rcmc, RcmcParams};
use log::info;
use ndarray::Array2;
use num_complex::Complex32;
use num_traits::Zero;

/// Core Structure for SAR Processing
pub struct SARProcessor {
    // Mission Parameters (from Metadata)
    pub carrier_frequency: f32, // e.g. 5.4 GHz for C-band
    pub sample_rate: f32,
    pub pulse_duration: f32,
    pub bandwidth: f32,
    pub prf: f32, // Pulse Repetition Frequency

    // RCMC parameters
    pub rcmc_params: Option<RcmcParams>,
}

impl SARProcessor {
    pub fn new(carrier_freq: f32, sample_rate: f32, pulse_dur: f32, bw: f32, prf: f32) -> Self {
        // Auto-calculate RCMC parameters from carrier frequency
        let rcmc_params = Some(RcmcParams::from_frequency(
            carrier_freq,
            7500.0,    // Typical LEO velocity
            800_000.0, // Typical near range
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

    /// Create processor with custom RCMC parameters
    pub fn with_rcmc_params(mut self, params: RcmcParams) -> Self {
        self.rcmc_params = Some(params);
        self
    }

    /// Disable RCMC (for comparison/testing)
    pub fn without_rcmc(mut self) -> Self {
        self.rcmc_params = None;
        self
    }

    /// Step 1: Range Compression
    /// Focuses the data in the "Range" (fast time) direction.
    ///
    /// * `raw_data`: The 2D Raw signal (L0) [Azimuth x Range]
    pub fn range_compression(&self, raw_data: &Array2<Complex32>) -> Array2<Complex32> {
        let (rows, cols) = raw_data.dim();
        info!("Starting Range Compression on {}x{} matrix...", rows, cols);

        // 1. Generate the Reference Chirp
        let chirp = generate_chirp(self.pulse_duration, self.bandwidth, self.sample_rate);
        let chirp_len = chirp.len();

        // 2. Prepare FFT Processor
        let fft_len = cols;
        let fft_proc = FFTProcessor::new(fft_len);

        // 3. Create the Matched Filter in Frequency Domain
        let mut padded_chirp = vec![Complex32::zero(); fft_len];
        let copy_len = chirp_len.min(fft_len);
        for i in 0..copy_len {
            padded_chirp[i] = chirp[i];
        }

        // FFT of Chirp
        fft_proc.forward(&mut padded_chirp);

        // Complex Conjugate (The "Match")
        for x in &mut padded_chirp {
            *x = x.conj();
        }

        // 4. Process Every Line
        let mut compressed_data = Array2::zeros((rows, cols));

        for (i, row) in raw_data.outer_iter().enumerate() {
            let mut line_buffer = row.to_vec();

            // FFT(Signal)
            fft_proc.forward(&mut line_buffer);

            // Signal * Filter
            for j in 0..fft_len {
                line_buffer[j] = line_buffer[j] * padded_chirp[j];
            }

            // IFFT(Result)
            fft_proc.inverse(&mut line_buffer);

            // Assign back to matrix
            for j in 0..cols {
                compressed_data[[i, j]] = line_buffer[j];
            }
        }

        info!("Range Compression Complete.");
        compressed_data
    }

    /// Step 2: Azimuth Compression with RCMC
    /// Focuses the data in the "Azimuth" (flight path) direction.
    ///
    /// This improved implementation includes:
    /// - Transform to range-Doppler domain
    /// - Range Cell Migration Correction (RCMC)
    /// - Azimuth matched filtering
    pub fn azimuth_compression(&self, range_compressed: &Array2<Complex32>) -> Array2<Complex32> {
        let (rows, cols) = range_compressed.dim();
        info!(
            "Starting Azimuth Compression (rows={}, cols={})...",
            rows, cols
        );

        // 1. Transform to Range-Doppler Domain
        // FFT along azimuth (rows) direction
        info!("  Transforming to Range-Doppler domain...");
        let fft_proc = FFTProcessor::new(rows);

        // We'll work with transposed data for cache efficiency
        let mut range_doppler = Array2::zeros((cols, rows));

        for col_idx in 0..cols {
            // Extract column (all azimuth samples for this range)
            let mut az_line: Vec<Complex32> =
                (0..rows).map(|r| range_compressed[[r, col_idx]]).collect();

            // Azimuth FFT → Doppler domain
            fft_proc.forward(&mut az_line);

            // Store in transposed form
            for (r, val) in az_line.into_iter().enumerate() {
                range_doppler[[col_idx, r]] = val;
            }
        }

        // 2. Apply RCMC (Range Cell Migration Correction)
        let rcmc_corrected = if let Some(ref params) = self.rcmc_params {
            info!(
                "  Applying RCMC (λ={:.4}m, v={:.0}m/s)...",
                params.wavelength, params.velocity
            );
            apply_rcmc(
                &range_doppler,
                self.sample_rate,
                self.prf,
                params.wavelength,
                params.velocity,
                params.near_range,
            )
        } else {
            info!("  RCMC disabled, skipping...");
            range_doppler
        };

        // 3. Apply Azimuth Matched Filter
        info!("  Applying azimuth matched filter...");
        let mut filtered = rcmc_corrected.clone();

        // Simple matched filter based on Doppler history
        // For more accuracy, this should vary with range
        let doppler_rate = 2.0
            * self
                .rcmc_params
                .as_ref()
                .map(|p| p.velocity.powi(2) / (p.wavelength * p.near_range))
                .unwrap_or(1000.0);

        for col_idx in 0..cols {
            for dop_idx in 0..rows {
                // Doppler frequency
                let f_dop = ((dop_idx as f32) - (rows as f32 / 2.0)) * self.prf / (rows as f32);

                // Azimuth matched filter phase
                let phase = std::f32::consts::PI * f_dop.powi(2) / doppler_rate;
                let filter = Complex32::from_polar(1.0, phase);

                filtered[[col_idx, dop_idx]] = rcmc_corrected[[col_idx, dop_idx]] * filter.conj();
            }
        }

        // 4. Transform back to Range-Azimuth Domain
        info!("  Transforming back to spatial domain...");
        let mut final_image = Array2::zeros((rows, cols));

        for col_idx in 0..cols {
            // Extract Doppler line
            let mut dop_line: Vec<Complex32> = (0..rows).map(|r| filtered[[col_idx, r]]).collect();

            // IFFT → back to azimuth time
            fft_proc.inverse(&mut dop_line);

            // Store in final image
            for (r, val) in dop_line.into_iter().enumerate() {
                final_image[[r, col_idx]] = val;
            }
        }

        info!("Azimuth Compression Complete.");
        final_image
    }

    /// Full Range-Doppler Algorithm Pipeline
    /// Combines range compression, RCMC, and azimuth compression
    pub fn process_rda(&self, raw_data: &Array2<Complex32>) -> Array2<Complex32> {
        info!("=== Starting Full RDA Pipeline ===");
        let range_compressed = self.range_compression(raw_data);
        let focused = self.azimuth_compression(&range_compressed);
        info!("=== RDA Pipeline Complete ===");
        focused
    }
}
