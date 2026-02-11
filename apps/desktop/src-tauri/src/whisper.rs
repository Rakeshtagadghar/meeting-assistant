use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

/// Result from the whisper sidecar process.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WhisperResult {
    pub text: String,
    pub t_start_ms: i64,
    pub t_end_ms: i64,
}

/// Manages the whisper.cpp sidecar process.
pub struct WhisperManager {
    model_path: String,
    language: String,
}

impl WhisperManager {
    pub fn new(model_path: String, language: String) -> Self {
        Self {
            model_path,
            language,
        }
    }

    pub fn model_path(&self) -> &str {
        &self.model_path
    }

    pub fn language(&self) -> &str {
        &self.language
    }

    /// Transcribe a chunk of audio using the whisper sidecar.
    /// The audio should be 16kHz mono s16le PCM.
    pub async fn transcribe(
        &self,
        app: &AppHandle,
        audio_samples: &[i16],
    ) -> Result<Vec<WhisperResult>, String> {
        if audio_samples.is_empty() {
            return Ok(Vec::new());
        }

        // Write audio to a temp file for the sidecar
        let temp_dir = std::env::temp_dir();
        let temp_path = temp_dir.join("ainotes_whisper_input.wav");
        write_wav(&temp_path, audio_samples, 16000)
            .map_err(|e| format!("Failed to write temp WAV: {}", e))?;

        // Build sidecar arguments
        let mut args = vec![
            "--model".to_string(),
            self.model_path.clone(),
            "--output-json".to_string(),
            "--threads".to_string(),
            "4".to_string(),
            "--file".to_string(),
            temp_path.to_string_lossy().to_string(),
        ];

        if self.language != "auto" {
            args.push("--language".to_string());
            args.push(self.language.clone());
        }

        // Spawn whisper sidecar
        let shell = app.shell();
        let output = shell
            .sidecar("binaries/whisper")
            .map_err(|e| format!("Failed to create sidecar: {}", e))?
            .args(&args)
            .output()
            .await
            .map_err(|e| format!("Sidecar execution failed: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Whisper failed: {}", stderr));
        }

        // Parse JSON output
        let stdout = String::from_utf8_lossy(&output.stdout);

        // whisper.cpp JSON output format: array of segments
        let segments: Vec<WhisperSegment> = serde_json::from_str(&stdout)
            .unwrap_or_else(|_| {
                // Try to extract text from plain output
                vec![WhisperSegment {
                    text: stdout.trim().to_string(),
                    t0: 0,
                    t1: 0,
                }]
            });

        // Clean up temp file
        let _ = std::fs::remove_file(&temp_path);

        Ok(segments
            .into_iter()
            .filter(|s| !s.text.trim().is_empty())
            .map(|s| WhisperResult {
                text: s.text.trim().to_string(),
                t_start_ms: s.t0 * 10, // whisper.cpp uses centiseconds
                t_end_ms: s.t1 * 10,
            })
            .collect())
    }

}

#[derive(Debug, Deserialize)]
struct WhisperSegment {
    text: String,
    #[serde(default)]
    t0: i64,
    #[serde(default)]
    t1: i64,
}

/// Write PCM samples to a WAV file.
fn write_wav(
    path: &std::path::Path,
    samples: &[i16],
    sample_rate: u32,
) -> std::io::Result<()> {
    use std::io::Write;

    let data_size = (samples.len() * 2) as u32;
    let file_size = 36 + data_size;

    let mut file = std::fs::File::create(path)?;

    // RIFF header
    file.write_all(b"RIFF")?;
    file.write_all(&file_size.to_le_bytes())?;
    file.write_all(b"WAVE")?;

    // fmt chunk
    file.write_all(b"fmt ")?;
    file.write_all(&16u32.to_le_bytes())?; // chunk size
    file.write_all(&1u16.to_le_bytes())?; // PCM format
    file.write_all(&1u16.to_le_bytes())?; // mono
    file.write_all(&sample_rate.to_le_bytes())?;
    file.write_all(&(sample_rate * 2).to_le_bytes())?; // byte rate
    file.write_all(&2u16.to_le_bytes())?; // block align
    file.write_all(&16u16.to_le_bytes())?; // bits per sample

    // data chunk
    file.write_all(b"data")?;
    file.write_all(&data_size.to_le_bytes())?;
    for &sample in samples {
        file.write_all(&sample.to_le_bytes())?;
    }

    Ok(())
}
