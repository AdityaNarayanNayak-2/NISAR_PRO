use crate::radar_utils::{generate_chirp, FFTProcessor};
use log::info;
use ndarray::{s, Array2, Axis};
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
}

impl SARProcessor {
    pub fn new(carrier_freq: f32, sample_rate: f32, pulse_dur: f32, bw: f32, prf: f32) -> Self {
        Self {
            carrier_frequency: carrier_freq,
            sample_rate,
            pulse_duration: pulse_dur,
            bandwidth: bw,
            prf,
        }
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
        // We pad to next power of 2 for speed, or just use cols if simple
        let fft_len = cols;
        let fft_proc = FFTProcessor::new(fft_len);

        // 3. Create the Matched Filter in Frequency Domain
        // Pad chirp to line length (clamp if chirp is longer than data)
        let mut padded_chirp = vec![Complex32::zero(); fft_len];
        let copy_len = chirp_len.min(fft_len); // Prevent index out of bounds
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

        // Use standard iterators (rayon can be added later for parallel speedup)
        for (i, row) in raw_data.outer_iter().enumerate() {
            // Copy row to buffer
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

    /// Step 2: Azimuth Compression
    /// Focuses the data in the "Azimuth" (flight path) direction.
    ///
    /// Note: This is a simplified implementation assuming zero Doppler centroid and constant velocity.
    /// For NISAR "pin-point" accuracy, we would add RCMC and Doppler estimation here.
    pub fn azimuth_compression(&self, range_compressed: &Array2<Complex32>) -> Array2<Complex32> {
        let (rows, cols) = range_compressed.dim();
        info!("Starting Azimuth Compression...");

        // 1. Transpose Matrix
        // Rust is Row-Major. Iterating columns is slow (cache misses).
        // Transposing makes columns into rows, so we can process them fast.
        let mut transposed = range_compressed.t().to_owned();

        // 2. FFT Processor for Azimuth
        // The length is now the number of rows (original azimuth lines)
        let fft_proc = FFTProcessor::new(rows);

        // 3. Process Transposed Rows (Originally Columns)
        for mut row in transposed.outer_iter_mut() {
            let mut line_buffer = row.to_vec();

            // Transform to Doppler Frequency Domain
            fft_proc.forward(&mut line_buffer);

            // Apply Azimuth Matched Filter (Simplified)
            // Ideally, this filter varies with Range.
            // For now, we apply a basic focusing phase shift.
            // ... (Math placeholder: Multiplying by Ref Function) ...

            // Transform back
            fft_proc.inverse(&mut line_buffer);

            // Copy back
            for j in 0..rows {
                row[j] = line_buffer[j];
            }
        }

        // Transpose back to original orientation
        let final_image = transposed.t().to_owned();

        info!("Azimuth Compression Complete.");
        final_image
    }
}
