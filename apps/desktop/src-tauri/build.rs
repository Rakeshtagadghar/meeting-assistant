fn main() {
    // Ensure sidecar binary exists without target-triple suffix for dev mode.
    // The shell plugin resolves `sidecar("whisper")` to `{exe_dir}/whisper.exe`,
    // but the source binary has the triple suffix. Copy it so dev mode works.
    #[cfg(target_os = "windows")]
    {
        let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR not set");
        let src = std::path::Path::new(&manifest_dir)
            .join("binaries")
            .join("whisper-x86_64-pc-windows-msvc.exe");

        if let Ok(out_dir) = std::env::var("OUT_DIR") {
            // OUT_DIR is target/{profile}/build/{crate}-{hash}/out
            // Navigate up to target/{profile}
            let out_path = std::path::PathBuf::from(&out_dir);
            if let Some(profile_dir) = out_path.ancestors().nth(3) {
                let dst = profile_dir.join("whisper.exe");
                if src.exists() && !dst.exists() {
                    let _ = std::fs::copy(&src, &dst);
                }

                // Also copy required DLLs next to the exe
                for dll in &["whisper.dll", "ggml.dll", "ggml-base.dll", "ggml-cpu.dll"] {
                    let dll_src = std::path::Path::new(&manifest_dir)
                        .join("binaries")
                        .join(dll);
                    let dll_dst = profile_dir.join(dll);
                    if dll_src.exists() && !dll_dst.exists() {
                        let _ = std::fs::copy(&dll_src, &dll_dst);
                    }
                }
            }
        }

        println!("cargo:rerun-if-changed=binaries/");
    }

    tauri_build::build()
}
