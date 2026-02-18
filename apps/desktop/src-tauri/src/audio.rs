use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{FromSample, Sample, SampleFormat, StreamConfig, SupportedStreamConfig};
use std::sync::{Arc, Mutex};

/// Wrapper to make cpal::Stream Send-safe.
/// The stream is only ever accessed behind a Mutex and never
/// shared directly across threads.
#[allow(dead_code)]
struct SendStream(Option<cpal::Stream>);

// SAFETY: cpal::Stream is not Send on all platforms, but we only
// access it behind a Mutex in Tauri's managed state. The stream
// callbacks run on cpal's own audio thread and only touch Arc<Mutex>
// shared data, so this is safe in practice.
unsafe impl Send for SendStream {}

pub struct AudioDrain {
    pub microphone_samples: Vec<i16>,
    pub system_samples: Vec<i16>,
}

/// Cross-platform audio capture using cpal.
/// Captures 16kHz mono s16le PCM from the default microphone,
/// and best-effort system loopback on Windows via default output device.
pub struct AudioCapture {
    mic_stream: SendStream,
    system_stream: SendStream,
    mic_buffer: Arc<Mutex<Vec<i16>>>,
    system_buffer: Arc<Mutex<Vec<i16>>>,
    mic_level: Arc<Mutex<f32>>,
    system_level: Arc<Mutex<f32>>,
    system_capture_enabled: bool,
}

impl AudioCapture {
    pub fn new() -> Self {
        Self {
            mic_stream: SendStream(None),
            system_stream: SendStream(None),
            mic_buffer: Arc::new(Mutex::new(Vec::new())),
            system_buffer: Arc::new(Mutex::new(Vec::new())),
            mic_level: Arc::new(Mutex::new(0.0)),
            system_level: Arc::new(Mutex::new(0.0)),
            system_capture_enabled: false,
        }
    }

    pub fn start(&mut self, enable_system_audio: bool) -> Result<(), String> {
        self.stop();
        self.system_capture_enabled = enable_system_audio;

        let host = cpal::default_host();
        let mic_device = host
            .default_input_device()
            .ok_or("No input device available")?;
        self.mic_stream = SendStream(Some(start_device_capture(
            mic_device,
            self.mic_buffer.clone(),
            self.mic_level.clone(),
            false,
        )?));

        if enable_system_audio {
            if let Some(output_device) = host.default_output_device() {
                match start_device_capture(
                    output_device,
                    self.system_buffer.clone(),
                    self.system_level.clone(),
                    true,
                ) {
                    Ok(stream) => {
                        self.system_stream = SendStream(Some(stream));
                    }
                    Err(error) => {
                        // Keep mic capture running even if loopback is unavailable.
                        log::warn!(
                            "System loopback unavailable; continuing mic-only: {}",
                            error
                        );
                    }
                }
            } else {
                log::warn!("No default output device found for loopback capture");
            }
        }

        Ok(())
    }

    pub fn stop(&mut self) {
        self.mic_stream = SendStream(None);
        self.system_stream = SendStream(None);
        self.system_capture_enabled = false;
        if let Ok(mut mic) = self.mic_buffer.lock() {
            mic.clear();
        }
        if let Ok(mut system) = self.system_buffer.lock() {
            system.clear();
        }
    }

    /// Drain both buffers and return accumulated samples by source.
    pub fn drain_buffers(&self) -> AudioDrain {
        let mut mic = self.mic_buffer.lock().unwrap_or_else(|e| e.into_inner());
        let mut system = self.system_buffer.lock().unwrap_or_else(|e| e.into_inner());

        let microphone_samples = mic.clone();
        let system_samples = system.clone();
        mic.clear();
        system.clear();

        AudioDrain {
            microphone_samples,
            system_samples,
        }
    }

    /// Get the current active level (0-1), max of mic/system.
    pub fn get_level(&self) -> f32 {
        let mic = *self.mic_level.lock().unwrap_or_else(|e| e.into_inner());
        let system = *self.system_level.lock().unwrap_or_else(|e| e.into_inner());
        mic.max(system)
    }
}

fn start_device_capture(
    device: cpal::Device,
    target_buffer: Arc<Mutex<Vec<i16>>>,
    target_level: Arc<Mutex<f32>>,
    allow_output_fallback: bool,
) -> Result<cpal::Stream, String> {
    let (config, sample_format) = resolve_device_config(&device, allow_output_fallback)?;
    let sample_rate_hz = config.sample_rate.0;
    let channels = config.channels as usize;

    let stream = match sample_format {
        SampleFormat::F32 => build_input_stream::<f32>(
            &device,
            &config,
            sample_rate_hz,
            channels,
            target_buffer,
            target_level,
        ),
        SampleFormat::I16 => build_input_stream::<i16>(
            &device,
            &config,
            sample_rate_hz,
            channels,
            target_buffer,
            target_level,
        ),
        SampleFormat::U16 => build_input_stream::<u16>(
            &device,
            &config,
            sample_rate_hz,
            channels,
            target_buffer,
            target_level,
        ),
        SampleFormat::I32 => build_input_stream::<i32>(
            &device,
            &config,
            sample_rate_hz,
            channels,
            target_buffer,
            target_level,
        ),
        SampleFormat::U32 => build_input_stream::<u32>(
            &device,
            &config,
            sample_rate_hz,
            channels,
            target_buffer,
            target_level,
        ),
        SampleFormat::F64 => build_input_stream::<f64>(
            &device,
            &config,
            sample_rate_hz,
            channels,
            target_buffer,
            target_level,
        ),
        other => Err(format!("Unsupported input sample format: {:?}", other)),
    }?;

    stream
        .play()
        .map_err(|e| format!("Failed to start stream: {}", e))?;
    Ok(stream)
}

fn resolve_device_config(
    device: &cpal::Device,
    allow_output_fallback: bool,
) -> Result<(StreamConfig, SampleFormat), String> {
    if let Ok(cfg) = device.default_input_config() {
        return Ok((cfg.clone().into(), cfg.sample_format()));
    }

    if allow_output_fallback {
        let output_cfg: SupportedStreamConfig = device
            .default_output_config()
            .map_err(|e| format!("No usable capture config: {}", e))?;
        return Ok((output_cfg.clone().into(), output_cfg.sample_format()));
    }

    Err("No input configuration available".to_string())
}

fn build_input_stream<T>(
    device: &cpal::Device,
    config: &StreamConfig,
    source_sample_rate: u32,
    source_channels: usize,
    target_buffer: Arc<Mutex<Vec<i16>>>,
    target_level: Arc<Mutex<f32>>,
) -> Result<cpal::Stream, String>
where
    T: Sample + cpal::SizedSample,
    f32: FromSample<T>,
{
    device
        .build_input_stream(
            config,
            move |data: &[T], _: &cpal::InputCallbackInfo| {
                if data.is_empty() {
                    return;
                }

                // Mix down to mono first.
                let mono: Vec<f32> = if source_channels > 1 {
                    data.chunks(source_channels)
                        .map(|frame| {
                            let sum: f32 =
                                frame.iter().map(|sample| f32::from_sample(*sample)).sum();
                            sum / source_channels as f32
                        })
                        .collect()
                } else {
                    data.iter()
                        .map(|sample| f32::from_sample(*sample))
                        .collect()
                };

                if mono.is_empty() {
                    return;
                }

                // RMS for live meter.
                let sum_sq: f32 = mono.iter().map(|sample| sample * sample).sum();
                let rms = (sum_sq / mono.len() as f32).sqrt();

                // Resample to 16kHz via simple decimation/interleaved pick.
                let resampled: Vec<f32> = if source_sample_rate != 16_000 {
                    let ratio = source_sample_rate as f64 / 16_000.0;
                    let out_len = (mono.len() as f64 / ratio).ceil().max(1.0) as usize;
                    (0..out_len)
                        .map(|index| {
                            let source_index = ((index as f64) * ratio) as usize;
                            mono[source_index.min(mono.len() - 1)]
                        })
                        .collect()
                } else {
                    mono
                };

                let samples_i16: Vec<i16> = resampled
                    .iter()
                    .map(|sample| (sample * 32767.0).clamp(-32768.0, 32767.0) as i16)
                    .collect();

                if let Ok(mut buffer) = target_buffer.lock() {
                    buffer.extend_from_slice(&samples_i16);
                }
                if let Ok(mut level) = target_level.lock() {
                    *level = (rms.min(1.0) * 3.0).min(1.0);
                }
            },
            |err| {
                log::error!("Audio capture stream error: {}", err);
            },
            None,
        )
        .map_err(|e| format!("Failed to build input stream: {}", e))
}
