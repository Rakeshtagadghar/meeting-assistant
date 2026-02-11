mod audio;
mod whisper;

use audio::AudioCapture;
use serde::Serialize;
use std::sync::Mutex;
use tauri::{Emitter, Manager, State};
use whisper::WhisperManager;

/// Global state for the audio/transcription pipeline.
struct TranscriptionState {
    audio: Mutex<AudioCapture>,
    whisper: Mutex<Option<WhisperManager>>,
    is_recording: Mutex<bool>,
}

/// ASR event emitted to the frontend.
#[derive(Debug, Serialize, Clone)]
#[serde(tag = "type")]
#[allow(non_snake_case, dead_code)]
enum ASREvent {
    #[serde(rename = "ASR_STATUS")]
    Status { state: String, message: String },
    #[serde(rename = "ASR_PARTIAL")]
    Partial { text: String, tStartMs: i64 },
    #[serde(rename = "ASR_FINAL")]
    Final {
        text: String,
        tStartMs: i64,
        tEndMs: i64,
        speaker: Option<String>,
        confidence: Option<f64>,
        sequence: u32,
    },
}

#[tauri::command]
async fn start_transcription(
    app: tauri::AppHandle,
    state: State<'_, TranscriptionState>,
    model_path: String,
    language: String,
) -> Result<(), String> {
    // Start audio capture
    {
        let mut audio = state.audio.lock().map_err(|e| e.to_string())?;
        audio.start()?;
    }

    // Initialize whisper manager
    {
        let mut whisper = state.whisper.lock().map_err(|e| e.to_string())?;
        *whisper = Some(WhisperManager::new(model_path, language));
    }

    {
        let mut recording = state.is_recording.lock().map_err(|e| e.to_string())?;
        *recording = true;
    }

    app.emit(
        "asr-event",
        ASREvent::Status {
            state: "listening".to_string(),
            message: "Listening...".to_string(),
        },
    )
    .map_err(|e| e.to_string())?;

    // Start the transcription loop in a background task
    let app_handle = app.clone();

    tauri::async_runtime::spawn(async move {
        let mut sequence: u32 = 0;
        let mut total_samples: i64 = 0;

        loop {
            // Check if still recording
            let is_recording = {
                let state_ref = app_handle.state::<TranscriptionState>();
                state_ref
                    .is_recording
                    .lock()
                    .map(|r| *r)
                    .unwrap_or(false)
            };
            if !is_recording {
                break;
            }

            // Wait for audio to accumulate (5 second step per desktop.json)
            tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;

            // Drain audio buffer
            let samples = {
                let state_ref = app_handle.state::<TranscriptionState>();
                let audio = state_ref.audio.lock().unwrap();
                audio.drain_buffer()
            };

            if samples.is_empty() {
                continue;
            }

            let sample_count = samples.len() as i64;
            let t_start_ms = (total_samples * 1000) / 16000;
            total_samples += sample_count;
            let t_end_ms = (total_samples * 1000) / 16000;

            // Extract whisper config without holding lock across await
            let wm_config = {
                let state_ref = app_handle.state::<TranscriptionState>();
                let guard = state_ref.whisper.lock().unwrap();
                guard.as_ref().map(|wm| {
                    (wm.model_path().to_string(), wm.language().to_string())
                })
            };

            let Some((mp, lang)) = wm_config else {
                continue;
            };

            // Create a temporary manager for this transcription call
            // to avoid holding the Mutex across the async boundary
            let temp_wm = WhisperManager::new(mp, lang);
            match temp_wm.transcribe(&app_handle, &samples).await {
                Ok(results) => {
                    for result in results {
                        let _ = app_handle.emit(
                            "asr-event",
                            ASREvent::Final {
                                text: result.text,
                                tStartMs: t_start_ms + result.t_start_ms,
                                tEndMs: t_end_ms.min(t_start_ms + result.t_end_ms),
                                speaker: None,
                                confidence: None,
                                sequence,
                            },
                        );
                        sequence += 1;
                    }
                }
                Err(e) => {
                    log::error!("Transcription error: {}", e);
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
async fn stop_transcription(
    app: tauri::AppHandle,
    state: State<'_, TranscriptionState>,
) -> Result<(), String> {
    {
        let mut recording = state.is_recording.lock().map_err(|e| e.to_string())?;
        *recording = false;
    }

    {
        let mut audio = state.audio.lock().map_err(|e| e.to_string())?;
        audio.stop();
    }

    app.emit(
        "asr-event",
        ASREvent::Status {
            state: "stopped".to_string(),
            message: "Transcription stopped".to_string(),
        },
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn pause_transcription(
    app: tauri::AppHandle,
    state: State<'_, TranscriptionState>,
) -> Result<(), String> {
    {
        let mut recording = state.is_recording.lock().map_err(|e| e.to_string())?;
        *recording = false;
    }

    app.emit(
        "asr-event",
        ASREvent::Status {
            state: "paused".to_string(),
            message: "Transcription paused".to_string(),
        },
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn resume_transcription(
    app: tauri::AppHandle,
    state: State<'_, TranscriptionState>,
) -> Result<(), String> {
    {
        let mut recording = state.is_recording.lock().map_err(|e| e.to_string())?;
        *recording = true;
    }

    app.emit(
        "asr-event",
        ASREvent::Status {
            state: "listening".to_string(),
            message: "Transcription resumed".to_string(),
        },
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn get_mic_level(state: State<'_, TranscriptionState>) -> f32 {
    let audio = state.audio.lock().unwrap();
    audio.get_level()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(TranscriptionState {
            audio: Mutex::new(AudioCapture::new()),
            whisper: Mutex::new(None),
            is_recording: Mutex::new(false),
        })
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            start_transcription,
            stop_transcription,
            pause_transcription,
            resume_transcription,
            get_mic_level,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
