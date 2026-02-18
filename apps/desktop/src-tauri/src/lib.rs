mod audio;
mod whisper;

use audio::AudioCapture;
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::process::Command;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{Emitter, Manager, PhysicalPosition, State};
use whisper::WhisperManager;

/// Global state for the audio/transcription pipeline.
struct TranscriptionState {
    audio: Mutex<AudioCapture>,
    whisper: Mutex<Option<WhisperManager>>,
    is_recording: Mutex<bool>,
    is_paused: Mutex<bool>,
}

/// Tracks meeting providers currently detected so we do not spam notifications.
struct MeetingDetectorState {
    active_provider_pids: Mutex<HashMap<String, HashSet<String>>>,
    active_meeting_providers: Mutex<HashSet<String>>,
    bootstrapped: Mutex<bool>,
    last_notified_ms: Mutex<HashMap<String, i64>>,
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
        speakerRole: Option<String>,
        audioSource: Option<String>,
        prosodyEnergy: Option<f64>,
        prosodyPauseRatio: Option<f64>,
        prosodyVoicedMs: Option<f64>,
        prosodySnrDb: Option<f64>,
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
        if let Ok(Some(monitor)) = window.current_monitor() {
            let monitor_pos = monitor.position();
            let monitor_size = monitor.size();
            let window_size = window
                .outer_size()
                .unwrap_or(tauri::PhysicalSize::new(460_u32, 92_u32));

            let margin_px: i32 = 16;
            let x =
                monitor_pos.x + monitor_size.width as i32 - window_size.width as i32 - margin_px;
            let y = monitor_pos.y + margin_px;

            let _ = window.set_position(PhysicalPosition::new(x, y));
        }

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
fn read_main_window_titles_by_pid() -> HashMap<String, String> {
    let script = r#"Get-Process | ForEach-Object { "$($_.Id)`t$($_.MainWindowTitle)" }"#;

    let output = Command::new("powershell")
        .args(["-NoProfile", "-Command", script])
        .output();

    let Ok(output) = output else {
        return HashMap::new();
    };

    if !output.status.success() {
        return HashMap::new();
    }

    String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter_map(|line| {
            let mut parts = line.splitn(2, '\t');
            let pid = parts.next()?.trim();
            let title = parts.next()?.trim();
            if pid.is_empty() {
                return None;
            }
            Some((pid.to_string(), title.to_lowercase()))
        })
        .collect()
}

#[cfg(target_os = "windows")]
fn is_active_meeting_process(provider: &str, cmd: &str, title: &str) -> bool {
    match provider {
        "zoom" => {
            title.contains("zoom meeting")
                || title.contains("zoom workplace") && title.contains("meeting")
                || cmd.contains("zoommtg")
        }
        "teams" => {
            (title.contains("meeting") || title.contains("call"))
                && (title.contains("teams") || cmd.contains("teams"))
        }
        "google_meet" => {
            cmd.contains("meet.google.com") && (title.contains("meet") || title.contains("meeting"))
        }
        _ => false,
    }
}

#[cfg(target_os = "windows")]
fn start_windows_meeting_detector(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        use sysinfo::{ProcessesToUpdate, System};

        let mut system = System::new_all();

        loop {
            system.refresh_processes(ProcessesToUpdate::All, true);

            let window_titles_by_pid = read_main_window_titles_by_pid();
            let mut detected_now: HashMap<String, HashSet<String>> = HashMap::new();
            let mut active_meeting_now: HashSet<String> = HashSet::new();

            for process in system.processes().values() {
                let name = process.name().to_string_lossy().to_lowercase();
                let cmd = process
                    .cmd()
                    .iter()
                    .map(|v| v.to_string_lossy().to_lowercase())
                    .collect::<Vec<_>>()
                    .join(" ");
                let pid = format!("{:?}", process.pid());

                let title = window_titles_by_pid.get(&pid).cloned().unwrap_or_default();

                if name.contains("zoom") || cmd.contains("zoom") {
                    detected_now
                        .entry("zoom".to_string())
                        .or_default()
                        .insert(pid.clone());

                    if is_active_meeting_process("zoom", &cmd, &title) {
                        active_meeting_now.insert("zoom".to_string());
                    }
                }

                if name.contains("teams") || cmd.contains("teams") {
                    detected_now
                        .entry("teams".to_string())
                        .or_default()
                        .insert(pid.clone());

                    if is_active_meeting_process("teams", &cmd, &title) {
                        active_meeting_now.insert("teams".to_string());
                    }
                }

                if cmd.contains("meet.google.com") || cmd.contains("google meet") {
                    detected_now
                        .entry("google_meet".to_string())
                        .or_default()
                        .insert(pid.clone());

                    if is_active_meeting_process("google_meet", &cmd, &title) {
                        active_meeting_now.insert("google_meet".to_string());
                    }
                }
            }

            let now_ms = chrono_like_timestamp();
            let should_notify: Vec<String> = {
                let state = app.state::<MeetingDetectorState>();

                let mut bootstrapped = match state.bootstrapped.lock() {
                    Ok(v) => v,
                    Err(poisoned) => poisoned.into_inner(),
                };
                let mut active_provider_pids = match state.active_provider_pids.lock() {
                    Ok(v) => v,
                    Err(poisoned) => poisoned.into_inner(),
                };
                let mut active_meeting_providers = match state.active_meeting_providers.lock() {
                    Ok(v) => v,
                    Err(poisoned) => poisoned.into_inner(),
                };
                let last_notified_ms = match state.last_notified_ms.lock() {
                    Ok(v) => v,
                    Err(poisoned) => poisoned.into_inner(),
                };

                if !*bootstrapped {
                    *active_provider_pids = detected_now;
                    *active_meeting_providers = active_meeting_now;
                    *bootstrapped = true;
                    Vec::new()
                } else {
                    let meeting_started = active_meeting_now
                        .iter()
                        .filter(|provider| !active_meeting_providers.contains(*provider))
                        .cloned()
                        .collect::<Vec<_>>();

                    let meeting_new_pid = active_meeting_now
                        .iter()
                        .filter_map(|provider| {
                            let pids = detected_now.get(provider)?;
                            let has_new_pid = active_provider_pids
                                .get(provider)
                                .map(|existing| pids.iter().any(|pid| !existing.contains(pid)))
                                .unwrap_or(true);
                            if has_new_pid {
                                Some(provider.clone())
                            } else {
                                None
                            }
                        })
                        .collect::<Vec<_>>();

                    let reminder_due = active_meeting_now
                        .iter()
                        .filter_map(|provider| {
                            last_notified_ms
                                .get(provider)
                                .map(|last| (provider.clone(), *last))
                        })
                        .filter(|(_, last)| now_ms - *last >= ALERT_REMINDER_INTERVAL_MS)
                        .map(|(provider, _)| provider)
                        .collect::<Vec<_>>();

                    *active_provider_pids = detected_now;
                    *active_meeting_providers = active_meeting_now;

                    let mut notify = meeting_started;
                    for provider in meeting_new_pid {
                        if !notify.contains(&provider) {
                            notify.push(provider);
                        }
                    }
                    for provider in reminder_due {
                        if !notify.contains(&provider) {
                            notify.push(provider);
                        }
                    }
                    notify
                }
            };

            for provider in should_notify {
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

                {
                    let state = app.state::<MeetingDetectorState>();
                    match state.last_notified_ms.lock() {
                        Ok(mut last_notified_ms) => {
                            last_notified_ms.insert(provider, now_ms);
                        }
                        Err(poisoned) => {
                            let mut last_notified_ms = poisoned.into_inner();
                            last_notified_ms.insert(provider, now_ms);
                        }
                    };
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

const ALERT_REMINDER_INTERVAL_MS: i64 = 120_000;

fn chrono_like_timestamp() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    now.as_millis() as i64
}

#[derive(Clone, Copy)]
struct ProsodySnapshot {
    energy: f64,
    pause_ratio: f64,
    voiced_ms: f64,
    snr_db: f64,
}

fn clamp_f64(value: f64, min: f64, max: f64) -> f64 {
    value.min(max).max(min)
}

fn compute_prosody(samples: &[i16]) -> ProsodySnapshot {
    if samples.is_empty() {
        return ProsodySnapshot {
            energy: 0.0,
            pause_ratio: 1.0,
            voiced_ms: 0.0,
            snr_db: 0.0,
        };
    }

    let mut sum_sq = 0.0_f64;
    let mut voiced_count: usize = 0;
    let mut noise_sum_sq = 0.0_f64;
    let mut noise_count: usize = 0;
    let voiced_threshold = 0.02_f64;

    for sample in samples {
        let value = (*sample as f64) / 32768.0;
        let abs = value.abs();
        sum_sq += value * value;
        if abs >= voiced_threshold {
            voiced_count += 1;
        } else {
            noise_sum_sq += value * value;
            noise_count += 1;
        }
    }

    let total = samples.len() as f64;
    let rms = (sum_sq / total).sqrt();
    let voiced_ratio = (voiced_count as f64) / total;
    let pause_ratio = clamp_f64(1.0 - voiced_ratio, 0.0, 1.0);
    let duration_ms = (total * 1000.0) / 16000.0;
    let voiced_ms = clamp_f64(duration_ms * voiced_ratio, 0.0, duration_ms);
    let noise_rms = if noise_count > 0 {
        (noise_sum_sq / (noise_count as f64)).sqrt()
    } else {
        1e-4
    };
    let snr_db = 20.0 * ((rms + 1e-6) / (noise_rms + 1e-6)).log10();
    let energy = clamp_f64(rms * 4.0, 0.0, 1.0);

    ProsodySnapshot {
        energy,
        pause_ratio,
        voiced_ms,
        snr_db: clamp_f64(snr_db, -5.0, 45.0),
    }
}

async fn transcribe_source_chunk(
    app: &tauri::AppHandle,
    model_path: &str,
    language: &str,
    audio_source: &str,
    speaker_role: &str,
    samples: &[i16],
    total_samples: &mut i64,
    sequence: &mut u32,
) {
    if samples.is_empty() {
        return;
    }

    let sample_count = samples.len() as i64;
    let t_start_ms = (*total_samples * 1000) / 16000;
    *total_samples += sample_count;
    let t_end_ms = (*total_samples * 1000) / 16000;
    let prosody = compute_prosody(samples);

    let temp_wm = WhisperManager::new(model_path.to_string(), language.to_string());
    match temp_wm.transcribe(app, samples).await {
        Ok(results) => {
            for result in results {
                let _ = app.emit(
                    "asr-event",
                    ASREvent::Final {
                        text: result.text,
                        tStartMs: t_start_ms + result.t_start_ms,
                        tEndMs: t_end_ms.min(t_start_ms + result.t_end_ms),
                        speaker: None,
                        speakerRole: Some(speaker_role.to_string()),
                        audioSource: Some(audio_source.to_string()),
                        prosodyEnergy: Some(prosody.energy),
                        prosodyPauseRatio: Some(prosody.pause_ratio),
                        prosodyVoicedMs: Some(prosody.voiced_ms),
                        prosodySnrDb: Some(prosody.snr_db),
                        confidence: None,
                        sequence: *sequence,
                    },
                );
                *sequence += 1;
            }
        }
        Err(error) => {
            log::error!(
                "Transcription error on source {} (role {}): {}",
                audio_source,
                speaker_role,
                error
            );
        }
    }
}

#[tauri::command]
async fn start_transcription(
    app: tauri::AppHandle,
    state: State<'_, TranscriptionState>,
    model_path: String,
    language: String,
    enable_system_audio: Option<bool>,
) -> Result<(), String> {
    let system_audio_enabled = enable_system_audio.unwrap_or(true);

    // Start audio capture
    {
        let mut audio = state.audio.lock().map_err(|e| e.to_string())?;
        audio.start(system_audio_enabled)?;
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
    {
        let mut paused = state.is_paused.lock().map_err(|e| e.to_string())?;
        *paused = false;
    }

    show_quick_note_window(&app)?;

    app.emit(
        "asr-event",
        ASREvent::Status {
            state: "listening".to_string(),
            message: if system_audio_enabled {
                "Listening (desktop mic + system loopback)...".to_string()
            } else {
                "Listening (desktop mic only)...".to_string()
            },
        },
    )
    .map_err(|e| e.to_string())?;

    // Start the transcription loop in a background task
    let app_handle = app.clone();
    let system_audio_enabled_for_loop = system_audio_enabled;

    tauri::async_runtime::spawn(async move {
        let mut sequence: u32 = 0;
        let mut mic_total_samples: i64 = 0;
        let mut system_total_samples: i64 = 0;

        loop {
            let (is_recording, is_paused) = {
                let state_ref = app_handle.state::<TranscriptionState>();
                let recording = state_ref.is_recording.lock().map(|r| *r).unwrap_or(false);
                let paused = state_ref.is_paused.lock().map(|p| *p).unwrap_or(false);
                (recording, paused)
            };
            if !is_recording {
                break;
            }
            if is_paused {
                tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
                continue;
            }

            // Wait for audio to accumulate.
            tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;

            // Drain audio buffers by source.
            let drained = {
                let state_ref = app_handle.state::<TranscriptionState>();
                let audio = state_ref.audio.lock().unwrap();
                audio.drain_buffers()
            };

            let has_mic_audio = !drained.microphone_samples.is_empty();
            let has_system_audio = !drained.system_samples.is_empty();
            if !has_mic_audio && !has_system_audio {
                continue;
            }

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

            let _ = app_handle.emit(
                "asr-event",
                ASREvent::Status {
                    state: "processing".to_string(),
                    message: "Processing audio...".to_string(),
                },
            );

            if has_mic_audio {
                transcribe_source_chunk(
                    &app_handle,
                    &mp,
                    &lang,
                    "microphone",
                    "SALES",
                    &drained.microphone_samples,
                    &mut mic_total_samples,
                    &mut sequence,
                )
                .await;
            }

            if system_audio_enabled_for_loop && has_system_audio {
                transcribe_source_chunk(
                    &app_handle,
                    &mp,
                    &lang,
                    "systemAudio",
                    "CLIENT",
                    &drained.system_samples,
                    &mut system_total_samples,
                    &mut sequence,
                )
                .await;
            }

            let _ = app_handle.emit(
                "asr-event",
                ASREvent::Status {
                    state: "listening".to_string(),
                    message: if system_audio_enabled_for_loop {
                        "Listening (desktop mic + system loopback)...".to_string()
                    } else {
                        "Listening (desktop mic only)...".to_string()
                    },
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
        let mut paused = state.is_paused.lock().map_err(|e| e.to_string())?;
        *paused = false;
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
        let mut paused = state.is_paused.lock().map_err(|e| e.to_string())?;
        *paused = true;
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
        let mut paused = state.is_paused.lock().map_err(|e| e.to_string())?;
        *paused = false;
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

    let route = format!(
        "/quick-note?meetingSessionId={}&autostart=1",
        meeting_session_id
    );

    app.emit(
        "meeting-detected",
        MeetingDetectedEvent {
            title: "Meeting detected".to_string(),
            subtitle,
            actionLabel: "Take Notes".to_string(),
            meetingSessionId: meeting_session_id,
            autoStartOnAction: true,
            route,
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
            is_paused: Mutex::new(false),
        })
        .manage(MeetingDetectorState {
            active_provider_pids: Mutex::new(HashMap::new()),
            active_meeting_providers: Mutex::new(HashSet::new()),
            bootstrapped: Mutex::new(false),
            last_notified_ms: Mutex::new(HashMap::new()),
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
