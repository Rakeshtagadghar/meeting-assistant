mod audio;
mod whisper;

use audio::AudioCapture;
use serde::Serialize;
use std::collections::HashSet;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{Emitter, Manager, State};
use whisper::WhisperManager;

/// Global state for the audio/transcription pipeline.
struct TranscriptionState {
    audio: Mutex<AudioCapture>,
    whisper: Mutex<Option<WhisperManager>>,
    is_recording: Mutex<bool>,
}

/// Tracks meeting providers currently detected so we do not spam notifications.
struct MeetingDetectorState {
    active_providers: Mutex<HashSet<String>>,
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

#[derive(Debug, Serialize, Clone)]
#[allow(non_snake_case)]
struct MeetingDetectedEvent {
    title: String,
    subtitle: String,
    actionLabel: String,
    meetingSessionId: String,
    autoStartOnAction: bool,
    route: String,
}

fn show_quick_note_window(app: &tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("quick-note") {
        window.show().map_err(|e| e.to_string())?;
        let _ = window.unminimize();
        window.set_focus().map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn show_meeting_alert_window(app: &tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("meeting-alert") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn navigate_main_to(app: &tauri::AppHandle, route: &str) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.show().map_err(|e| e.to_string())?;
        let _ = window.unminimize();
        window.set_focus().map_err(|e| e.to_string())?;

        let route_json = serde_json::to_string(route).map_err(|e| e.to_string())?;
        let script = format!("window.location.assign({});", route_json);
        window.eval(&script).map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn emit_meeting_detected(app: &tauri::AppHandle, subtitle: String, provider_key: &str) {
    let meeting_session_id = format!("auto-{}-{}", provider_key, chrono_like_timestamp());
    let route = format!(
        "/quick-note?meetingSessionId={}&autostart=1",
        meeting_session_id
    );

    let _ = app.emit(
        "meeting-detected",
        MeetingDetectedEvent {
            title: "Meeting detected".to_string(),
            subtitle,
            actionLabel: "Take Notes".to_string(),
            meetingSessionId: meeting_session_id,
            autoStartOnAction: true,
            route,
        },
    );

    let _ = show_meeting_alert_window(app);
}

#[cfg(target_os = "windows")]
fn start_windows_meeting_detector(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        use sysinfo::{ProcessesToUpdate, System};

        let mut system = System::new_all();

        loop {
            system.refresh_processes(ProcessesToUpdate::All, true);

            let mut detected_now: HashSet<String> = HashSet::new();

            for process in system.processes().values() {
                let name = process.name().to_string_lossy().to_lowercase();
                let cmd = process
                    .cmd()
                    .iter()
                    .map(|v| v.to_string_lossy().to_lowercase())
                    .collect::<Vec<_>>()
                    .join(" ");

                if name.contains("zoom") || cmd.contains("zoom") {
                    detected_now.insert("zoom".to_string());
                }

                if name.contains("teams") || cmd.contains("teams") {
                    detected_now.insert("teams".to_string());
                }

                if cmd.contains("meet.google.com") || cmd.contains("google meet") {
                    detected_now.insert("google_meet".to_string());
                }
            }

            let newly_detected: Vec<String> = {
                let state = app.state::<MeetingDetectorState>();
                let mut active = match state.active_providers.lock() {
                    Ok(v) => v,
                    Err(poisoned) => poisoned.into_inner(),
                };

                let fresh = detected_now
                    .iter()
                    .filter(|provider| !active.contains(*provider))
                    .cloned()
                    .collect::<Vec<_>>();

                *active = detected_now;
                fresh
            };

            for provider in newly_detected {
                match provider.as_str() {
                    "zoom" => {
                        emit_meeting_detected(&app, "Zoom".to_string(), "zoom");
                    }
                    "teams" => {
                        emit_meeting_detected(&app, "Microsoft Teams".to_string(), "teams");
                    }
                    "google_meet" => {
                        emit_meeting_detected(&app, "Google Meet".to_string(), "google_meet");
                    }
                    _ => {}
                }
            }

            tokio::time::sleep(Duration::from_secs(5)).await;
        }
    });
}

#[cfg(not(target_os = "windows"))]
fn start_windows_meeting_detector(_app: tauri::AppHandle) {
    // No-op outside Windows in MVP.
}

fn chrono_like_timestamp() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    now.as_millis() as i64
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

    show_quick_note_window(&app)?;

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
                state_ref.is_recording.lock().map(|r| *r).unwrap_or(false)
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
                guard
                    .as_ref()
                    .map(|wm| (wm.model_path().to_string(), wm.language().to_string()))
            };

            let Some((mp, lang)) = wm_config else {
                continue;
            };

            // Notify frontend that we are processing
            let _ = app_handle.emit(
                "asr-event",
                ASREvent::Status {
                    state: "processing".to_string(),
                    message: "Processing audio...".to_string(),
                },
            );

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

            // Notify frontend back to listening (idle)
            let _ = app_handle.emit(
                "asr-event",
                ASREvent::Status {
                    state: "listening".to_string(),
                    message: "Listening...".to_string(),
                },
            );
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

    show_quick_note_window(&app)?;

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
async fn trigger_meeting_detected_notification(
    app: tauri::AppHandle,
    meeting_app: Option<String>,
    meeting_session_id: String,
) -> Result<(), String> {
    let subtitle = meeting_app.unwrap_or_else(|| "Online meeting".to_string());

    app.emit(
        "meeting-detected",
        MeetingDetectedEvent {
            title: "Meeting detected".to_string(),
            subtitle,
            actionLabel: "Take Notes".to_string(),
            meetingSessionId: meeting_session_id,
            autoStartOnAction: true,
            route: format!(
                "/quick-note?meetingSessionId={}&autostart=1",
                meeting_session_id
            ),
        },
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn open_meeting_capture(app: tauri::AppHandle, meeting_session_id: String) -> Result<(), String> {
    let route = format!(
        "/quick-note?meetingSessionId={}&autostart=1",
        meeting_session_id
    );

    navigate_main_to(&app, &route)?;

    if let Some(alert) = app.get_webview_window("meeting-alert") {
        let _ = alert.hide();
    }

    Ok(())
}

#[tauri::command]
fn dismiss_meeting_alert(app: tauri::AppHandle) {
    if let Some(alert) = app.get_webview_window("meeting-alert") {
        let _ = alert.hide();
    }
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
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .manage(TranscriptionState {
            audio: Mutex::new(AudioCapture::new()),
            whisper: Mutex::new(None),
            is_recording: Mutex::new(false),
        })
        .manage(MeetingDetectorState {
            active_providers: Mutex::new(HashSet::new()),
        })
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            start_windows_meeting_detector(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            start_transcription,
            stop_transcription,
            pause_transcription,
            resume_transcription,
            trigger_meeting_detected_notification,
            open_meeting_capture,
            dismiss_meeting_alert,
            get_mic_level,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
