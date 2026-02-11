use anyhow::{Context, Result};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use hound::{WavReader, WavSpec, WavWriter};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Cursor;
use std::path::Path;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct HitData {
    pub time: f64,
    pub r#type: u32,
}

pub struct AudioMixer {
    base_samples: Vec<i32>,
    sample_rate: u32,
    channels: u16,
    preloaded_effects: HashMap<u32, (Vec<i32>, usize)>,
    base_volume: f32,
    effect_volume: f32,
}

impl AudioMixer {
    pub fn new() -> Self {
        Self {
            base_samples: Vec::new(),
            sample_rate: 44100,
            channels: 2,
            preloaded_effects: HashMap::new(),
            base_volume: 1.0,
            effect_volume: 1.0,
        }
    }

    pub fn set_volume(&mut self, base: f32, effect: f32) {
        self.base_volume = base.clamp(0.0, 2.0);
        self.effect_volume = effect.clamp(0.0, 2.0);
    }

    pub fn load(&mut self, base64_audio: &str) -> Result<()> {
        let audio_bytes = STANDARD.decode(base64_audio)?;
        let cursor = Cursor::new(audio_bytes);
        let reader = WavReader::new(cursor)?;

        let spec = reader.spec();
        self.sample_rate = spec.sample_rate;
        self.channels = spec.channels;

        tracing::info!(
            "加载基础音频: {} 样本, {}Hz, {} 声道",
            reader.len(),
            self.sample_rate,
            self.channels
        );

        self.base_samples = reader
            .into_samples::<i16>()
            .filter_map(|s| s.ok())
            .map(|s| (s as f32 * self.base_volume) as i32)
            .collect();

        tracing::info!("基础音频加载完成，样本数: {}", self.base_samples.len());

        self.preload_effects()?;
        Ok(())
    }

    fn preload_effects(&mut self) -> Result<()> {
        self.preloaded_effects.clear();

        let effect_files = vec![
            (0u32, "audio/hit.wav"),
            (1u32, "audio/drag.wav"),
            (2u32, "audio/hit.wav"),
            (3u32, "audio/drag.wav"),
        ];

        for (effect_type, path) in effect_files {
            if !Path::new(path).exists() {
                tracing::warn!("音效文件不存在: {}", path);
                continue;
            }

            let reader = WavReader::open(path)?;
            let spec = reader.spec();

            let samples: Vec<i32> = reader
                .into_samples::<i16>()
                .filter_map(|s| s.ok())
                .map(|s| (s as f32 * self.effect_volume) as i32)
                .collect();

            tracing::info!(
                "预加载音效 {}: {} 样本, {}Hz",
                effect_type,
                samples.len(),
                spec.sample_rate
            );

            self.preloaded_effects
                .insert(effect_type, (samples.clone(), samples.len()));
        }

        Ok(())
    }

    pub fn mix_hit(&mut self, time_sec: f64, effect_type: u32) -> Result<()> {
        let (effect_samples, effect_len) = self
            .preloaded_effects
            .get(&effect_type)
            .context(format!("音效类型 {} 未找到", effect_type))?
            .clone();

        let frame_per_sec = (self.sample_rate * self.channels as u32) as f64;
        let start_idx = (time_sec * frame_per_sec) as usize;
        let end_idx = start_idx + effect_len;

        // 扩展基础音频（如果音效超出长度）
        if end_idx > self.base_samples.len() {
            let old_len = self.base_samples.len();
            self.base_samples.resize(end_idx, 0);
            tracing::debug!(
                "扩展基础音频: {} -> {} 样本 (添加 {} 静音样本)",
                old_len,
                end_idx,
                end_idx - old_len
            );
        }

        // 混合音效
        let overlap_start = start_idx;
        let overlap_end = end_idx.min(self.base_samples.len());
        let actual_mix_len = overlap_end.saturating_sub(overlap_start);

        if actual_mix_len > 0 {
            for i in 0..actual_mix_len {
                self.base_samples[overlap_start + i] += effect_samples[i];
            }
        }

        Ok(())
    }

    pub fn export(&self, output_path: &str) -> Result<()> {
        tracing::info!("开始导出音频到: {}", output_path);

        // 找到实际的最大/最小值用于调试
        let max_val = self.base_samples.iter().copied().max().unwrap_or(0);
        let min_val = self.base_samples.iter().copied().min().unwrap_or(0);
        tracing::info!("音频振幅范围: {} 到 {}", min_val, max_val);

        let clipped: Vec<i16> = self
            .base_samples
            .iter()
            .map(|&s| s.clamp(i16::MIN as i32, i16::MAX as i32) as i16)
            .collect();

        let spec = WavSpec {
            channels: self.channels,
            sample_rate: self.sample_rate,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };

        let mut writer = WavWriter::create(output_path, spec)?;
        for sample in &clipped {
            writer.write_sample(*sample)?;
        }
        writer.finalize()?;

        tracing::info!("音频导出完成: {} 样本写入", clipped.len());
        Ok(())
    }
}