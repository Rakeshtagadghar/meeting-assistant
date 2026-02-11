use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
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

/// Cross-platform audio capture using cpal.
/// Captures 16kHz mono s16le PCM from the default microphone.
pub struct AudioCapture {
    stream: SendStream,
    buffer: Arc<Mutex<Vec<i16>>>,
    level: Arc<Mutex<f32>>,
}

impl AudioCapture {
    pub fn new() -> Self {
        Self {
            stream: SendStream(None),
            buffer: Arc::new(Mutex::new(Vec::new())),
            level: Arc::new(Mutex::new(0.0)),
        }
    }

    pub fn start(&mut self) -> Result<(), String> {
        let host = cpal::default_host();
        let device = host
            .default_input_device()
            .ok_or("No input device available")?;

        let config = cpal::StreamConfig {
            channels: 1,
            sample_rate: cpal::SampleRate(16000),
            buffer_size: cpal::BufferSize::Default,
        };

        let buffer = self.buffer.clone();
        let level = self.level.clone();

        let stream = device
            .build_input_stream(
                &config,
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    // Convert f32 samples to i16
                    let samples: Vec<i16> = data
                        .iter()
                        .map(|&s| (s * 32767.0).clamp(-32768.0, 32767.0) as i16)
                        .collect();

                    // Calculate RMS level
                    let sum_sq: f32 = data.iter().map(|s| s * s).sum();
                    let rms = (sum_sq / data.len() as f32).sqrt();

                    if let Ok(mut buf) = buffer.lock() {
                        buf.extend_from_slice(&samples);
                    }
                    if let Ok(mut lvl) = level.lock() {
                        *lvl = rms.min(1.0) * 3.0; // Amplify for visual range
                    }
                },
                |err| {
                    log::error!("Audio capture error: {}", err);
                },
                None,
            )
            .map_err(|e| format!("Failed to build input stream: {}", e))?;

        stream
            .play()
            .map_err(|e| format!("Failed to start stream: {}", e))?;

        self.stream = SendStream(Some(stream));
        Ok(())
    }

    pub fn stop(&mut self) {
        self.stream = SendStream(None);
        if let Ok(mut buf) = self.buffer.lock() {
            buf.clear();
        }
    }

    /// Drain the audio buffer and return all accumulated samples.
    pub fn drain_buffer(&self) -> Vec<i16> {
        let mut buf = self.buffer.lock().unwrap_or_else(|e| e.into_inner());
        let samples = buf.clone();
        buf.clear();
        samples
    }

    /// Get the current microphone level (0-1).
    pub fn get_level(&self) -> f32 {
        *self.level.lock().unwrap_or_else(|e| e.into_inner())
    }
}
