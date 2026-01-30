fn main() {
    // Build cxx bridge when isce3 feature is enabled
    #[cfg(feature = "isce3")]
    {
        cxx_build::bridge("src/isce3_ffi.rs")
            .file("cxx_iface/RangeCompFacade.cpp")
            .include("cxx_iface")
            .flag_if_supported("-std=c++17")
            .compile("isce3proc");

        println!("cargo:rustc-link-lib=dylib=isce3proc");
        println!("cargo:rustc-link-search=native=cxx_iface/build");

        // Link ISCE3 and dependencies if available
        if std::env::var("ISCE3_LIB_PATH").is_ok() {
            println!(
                "cargo:rustc-link-search=native={}",
                std::env::var("ISCE3_LIB_PATH").unwrap()
            );
            println!("cargo:rustc-link-lib=dylib=isce3");
            println!("cargo:rustc-link-lib=dylib=fftw3");
            println!("cargo:rustc-link-lib=dylib=hdf5");
        }
    }

    // Rerun if C++ files change
    println!("cargo:rerun-if-changed=cxx_iface/RangeCompFacade.h");
    println!("cargo:rerun-if-changed=cxx_iface/RangeCompFacade.cpp");
    println!("cargo:rerun-if-changed=src/isce3_ffi.rs");
}
