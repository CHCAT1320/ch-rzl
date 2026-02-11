use anyhow::{Context, Result};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use tracing::info;

pub struct FFmpegProcess {
    child: Child,
}

impl FFmpegProcess {
    pub fn new(ffmpeg_path: PathBuf, audio_path: &str, output_path: &str) -> Result<Self> {
        let args = vec![
            "-y".to_string(),
            "-f".to_string(),
            "image2pipe".to_string(),
            "-vcodec".to_string(),
            "png".to_string(),
            "-r".to_string(),
            "60".to_string(),
            "-vsync".to_string(),
            "cfr".to_string(),
            "-i".to_string(),
            "pipe:0".to_string(),
            "-i".to_string(),
            audio_path.to_string(),
            "-c:v".to_string(),
            "libx264".to_string(),
            "-crf".to_string(),
            "28".to_string(),
            "-preset".to_string(),
            "ultrafast".to_string(),
            "-pix_fmt".to_string(),
            "yuv420p".to_string(),
            "-c:a".to_string(),
            "aac".to_string(),
            "-b:a".to_string(),
            "192k".to_string(),
            "-fflags".to_string(),
            "nobuffer".to_string(),
            "-shortest".to_string(),
            output_path.to_string(),
        ];

        info!("启动FFmpeg: {:?} {:?}", ffmpeg_path, args);

        let child = Command::new(&ffmpeg_path)
            .args(&args)
            .stdin(Stdio::piped())
            // 保留 stderr 输出，不设置为 null
            .spawn()
            .with_context(|| format!("启动FFmpeg失败: {:?}", ffmpeg_path))?;

        Ok(Self { child })
    }

    pub fn write_frame(&mut self, data: &[u8]) -> Result<()> {
        use std::io::Write;
        if let Some(stdin) = self.child.stdin.as_mut() {
            stdin.write_all(data)?;
            stdin.flush()?;
        }
        Ok(())
    }

    pub fn close(&mut self) -> Result<()> {
        if let Some(stdin) = self.child.stdin.take() {
            drop(stdin);
        }
        self.child.wait()?;
        Ok(())
    }
}

impl Drop for FFmpegProcess {
    fn drop(&mut self) {
        let _ = self.close();
    }
}