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
            .sidecar("whisper")
            .map_err(|e| format!("Failed to create sidecar: {}", e))?
            .args(&args)
            .output()
            .await
            .map_err(|e| format!("Sidecar execution failed: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Whisper failed: {}", stderr));
        }

        // whisper.cpp --output-json writes a .json file next to the input
        let json_path = temp_path.with_extension("wav.json");
        let segments: Vec<WhisperSegment> = std::fs::read_to_string(&json_path)
            .ok()
            .and_then(|json_str| {
                // The JSON file has { "transcription": [ { "timestamps": {...}, "text": "..." }, ... ] }
                serde_json::from_str::<WhisperJsonOutput>(&json_str)
                    .ok()
                    .map(|out| {
                        out.transcription
                            .into_iter()
                            .map(|seg| WhisperSegment {
                                text: seg.text,
                                t0: parse_timestamp_ms(&seg.timestamps.from),
                                t1: parse_timestamp_ms(&seg.timestamps.to),
                            })
                            .collect()
                    })
            })
            .unwrap_or_else(|| {
                // Fallback: strip timestamps from stdout text
                let stdout = String::from_utf8_lossy(&output.stdout);
                let text = strip_timestamps(&stdout);
                if text.is_empty() {
                    Vec::new()
                } else {
                    vec![WhisperSegment { text, t0: 0, t1: 0 }]
                }
            });

        // Clean up temp files
        let _ = std::fs::remove_file(&temp_path);
        let _ = std::fs::remove_file(&json_path);

        Ok(segments
            .into_iter()
            .filter(|s| !s.text.trim().is_empty())
            .map(|s| WhisperResult {
                text: s.text.trim().to_string(),
                t_start_ms: s.t0,
                t_end_ms: s.t1,
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

/// Top-level JSON output from whisper.cpp --output-json
#[derive(Debug, Deserialize)]
struct WhisperJsonOutput {
    transcription: Vec<WhisperJsonSegment>,
}

#[derive(Debug, Deserialize)]
struct WhisperJsonSegment {
    timestamps: WhisperTimestamps,
    text: String,
}

#[derive(Debug, Deserialize)]
struct WhisperTimestamps {
    from: String,
    to: String,
}

/// Parse "HH:MM:SS.mmm" into milliseconds.
fn parse_timestamp_ms(ts: &str) -> i64 {
    // Format: "00:00:04.880"
    let parts: Vec<&str> = ts.split(':').collect();
    if parts.len() != 3 {
        return 0;
    }
    let hours: i64 = parts[0].parse().unwrap_or(0);
    let mins: i64 = parts[1].parse().unwrap_or(0);
    let secs_parts: Vec<&str> = parts[2].split('.').collect();
    let secs: i64 = secs_parts.first().and_then(|s| s.parse().ok()).unwrap_or(0);
    let millis: i64 = secs_parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(0);
    (hours * 3600 + mins * 60 + secs) * 1000 + millis
}

/// Strip "[HH:MM:SS.mmm --> HH:MM:SS.mmm]" prefixes from whisper.cpp stdout.
fn strip_timestamps(text: &str) -> String {
    text.lines()
        .map(|line| {
            let trimmed = line.trim();
            if trimmed.starts_with('[') {
                // Strip "[00:00:00.000 --> 00:00:04.880] "
                if let Some(end) = trimmed.find(']') {
                    trimmed[end + 1..].trim().to_string()
                } else {
                    trimmed.to_string()
                }
            } else {
                trimmed.to_string()
            }
        })
        .filter(|l| !l.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
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
