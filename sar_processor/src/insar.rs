use ndarray::{Array2, s, Zip};
use num_complex::Complex32;

/// Computes the complex interferogram from registered master and slave SAR images.
/// Phase difference = master * conj(slave)
pub fn compute_interferogram(master: &Array2<Complex32>, slave: &Array2<Complex32>) -> Array2<Complex32> {
    assert_eq!(master.dim(), slave.dim(), "Master and slave must have the same dimensions");
    
    // Perform element-wise multiplication: master * conj(slave)
    let mut ifgram = Array2::<Complex32>::zeros(master.dim());
    Zip::from(&mut ifgram)
        .and(master)
        .and(slave)
        .for_each(|out, &m, &s| {
            *out = m * s.conj();
        });
        
    ifgram
}

/// Estimates the coherence between two SAR images using a spatial moving window.
/// Coherence gamma = |<m * s*>| / sqrt(<|m|^2> * <|s|^2>)
pub fn estimate_coherence(master: &Array2<Complex32>, slave: &Array2<Complex32>, window_size: usize) -> Array2<f32> {
    let (rows, cols) = master.dim();
    let mut coherence = Array2::<f32>::zeros((rows, cols));
    
    let half_win = window_size / 2;
    
    // We compute coherence only where the window fits fully inside the image
    for r in half_win..(rows - half_win) {
        for c in half_win..(cols - half_win) {
            let m_window = master.slice(s![r-half_win..=r+half_win, c-half_win..=c+half_win]);
            let s_window = slave.slice(s![r-half_win..=r+half_win, c-half_win..=c+half_win]);
            
            let mut num = Complex32::new(0.0, 0.0);
            let mut den_m = 0.0;
            let mut den_s = 0.0;
            
            Zip::from(&m_window).and(&s_window).for_each(|&m, &s| {
                num += m * s.conj();
                den_m += m.norm_sqr();
                den_s += s.norm_sqr();
            });
            
            let den = (den_m * den_s).sqrt();
            if den > 1e-10 {
                coherence[[r, c]] = num.norm() / den;
            }
        }
    }
    
    coherence
}

/// Extracts the unwrapped phase from a complex interferogram.
/// Simply returns the angle (in radians) of the complex numbers.  
/// Proper 2D phase unwrapping (e.g., SNAPHU/Goldstein) would be applied here in a full pipeline.
pub fn extract_phase(ifgram: &Array2<Complex32>) -> Array2<f32> {
    ifgram.mapv(|c| c.arg())
}
