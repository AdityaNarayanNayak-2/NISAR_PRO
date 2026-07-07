use rustyhdf5::File;
use ndarray::Array2;

fn main() {
    let path = "/home/aditya/Desktop/nisar_data/NISAR_L2_PR_GUNW_009_127_A_011_010_4000_SH_20260105T235314_20260105T235347_20260117T235314_20260117T235347_X05010_N_F_J_001.h5";
    
    let file1 = File::open(path).expect("Failed to open file");
    let phase_data = file1.dataset("/science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/HH/unwrappedPhase")
        .expect("phase ds").read_f32().expect("read phase");
    
    let file2 = File::open(path).expect("Failed to open file");
    let coh_data = file2.dataset("/science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/HH/coherenceMagnitude")
        .expect("coh ds").read_f32().expect("read coh");
    
    let rows = 4230;
    let cols = 4311;
    let phase = Array2::from_shape_vec((rows, cols), phase_data).unwrap();
    let coherence = Array2::from_shape_vec((rows, cols), coh_data).unwrap();

    let r_center = 1962;
    let c_center = 2862;
    
    println!("=== Test opening file twice ===");
    for r in (r_center - 3)..(r_center + 3) {
        let mut line_p = String::new();
        let mut line_c = String::new();
        for c in (c_center - 3)..(c_center + 3) {
            let p = phase[[r, c]];
            let coh = coherence[[r, c]];
            line_p.push_str(&format!("{:6.2} ", p));
            line_c.push_str(&format!("{:5.2} ", coh));
        }
        println!("Row {:4} Phase: {}", r, line_p);
        println!("         Coh:   {}", line_c);
    }
}
