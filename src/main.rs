mod audio_mixer;
mod ffmpeg;

use anyhow::Result;
use audio_mixer::{AudioMixer, HitData};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use ffmpeg::FFmpegProcess;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::Mutex;
use tokio_tungstenite::{accept_async, tungstenite::Message};

#[derive(Debug, Deserialize)]
#[serde(tag = "type", content = "data")]
enum ClientMessage {
    #[serde(rename = "audio")]
    Audio(String),
    #[serde(rename = "hit")]
    Hit(Vec<HitData>),
    #[serde(rename = "screen")]
    Screen(String),
    #[serde(rename = "msg")]
    Msg(String),
}

#[derive(Debug, Serialize)]
struct ServerResponse {
    status: String,
}

#[derive(Debug)]
enum InternalMessage {
    SendToClient(String),
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();

    let ffmpeg_path = std::env::var("FFMPEG_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("./ffmpeg.exe"));

    if !ffmpeg_path.exists() {
        anyhow::bail!("找不到FFmpeg: {:?}", ffmpeg_path);
    }

    let output_dir = std::path::Path::new("../").parent().unwrap_or(std::path::Path::new("."));
    tokio::fs::create_dir_all(output_dir).await?;

    let addr = "localhost:8085";
    let listener = TcpListener::bind(addr).await?;
    tracing::info!("WebSocket服务启动: {}", addr);

    let state = Arc::new(Mutex::new(ServerState {
        base_audio: None,
        audio_mixer: AudioMixer::new(),
        ffmpeg_process: None,
        ffmpeg_path,
    }));

    while let Ok((stream, _)) = listener.accept().await {
        let state = state.clone();
        tokio::spawn(handle_connection(stream, state));
    }

    Ok(())
}

struct ServerState {
    base_audio: Option<String>,
    audio_mixer: AudioMixer,
    ffmpeg_process: Option<FFmpegProcess>,
    ffmpeg_path: PathBuf,
}

async fn handle_connection(stream: tokio::net::TcpStream, state: Arc<Mutex<ServerState>>) {
    let ws_stream = match accept_async(stream).await {
        Ok(ws) => ws,
        Err(e) => {
            tracing::error!("WebSocket握手失败: {}", e);
            return;
        }
    };

    tracing::info!("客户端已连接");
    let (mut sender, mut receiver) = ws_stream.split();

    let _ = sender.send(Message::Text("ok".to_string())).await;

    // 创建通道用于内部消息传递
    let (tx, mut rx) = tokio::sync::mpsc::channel::<InternalMessage>(10);

    loop {
        tokio::select! {
            // 处理 WebSocket 消息
            msg = receiver.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        match handle_message(&text, state.clone(), tx.clone()).await {
                            Ok(response) => {
                                let _ = sender
                                    .send(Message::Text(
                                        serde_json::to_string(&response).unwrap_or_default(),
                                    ))
                                    .await;
                            }
                            Err(e) => {
                                tracing::error!("处理消息失败: {}", e);
                            }
                        }
                    }
                    Some(Ok(Message::Close(_))) => break,
                    Some(Err(e)) => {
                        tracing::error!("WebSocket错误: {}", e);
                        break;
                    }
                    _ => {}
                }
            }
            // 处理内部消息（如发送 hitOK）
            internal = rx.recv() => {
                match internal {
                    Some(InternalMessage::SendToClient(msg)) => {
                        let _ = sender.send(Message::Text(msg)).await;
                    }
                    None => break,
                }
            }
        }
    }

    tracing::info!("客户端断开连接");
}

async fn handle_message(
    text: &str, 
    state: Arc<Mutex<ServerState>>, 
    tx: tokio::sync::mpsc::Sender<InternalMessage>
) -> Result<ServerResponse> {
    let msg: ClientMessage = serde_json::from_str(text)?;
    let mut state = state.lock().await;

    match msg {
        ClientMessage::Audio(data) => {
            tracing::info!("接收到音频数据");
            state.base_audio = Some(data);
            state.audio_mixer.set_volume(0.8, 1.0);
            Ok(ServerResponse {
                status: "audio_received".to_string(),
            })
        }
        ClientMessage::Hit(hit_data) => {
            tracing::info!("接收到音效数据: {} 个命中点", hit_data.len());

            let base_audio = state.base_audio.clone();

            if let Some(base_audio) = base_audio {
                let base64_data = base_audio.split(',').last().unwrap_or(&base_audio);
                
                tracing::info!("开始加载基础音频...");
                state.audio_mixer.load(base64_data)?;
                tracing::info!("基础音频加载完成");

                let total = hit_data.len();
                for (i, hit) in hit_data.iter().enumerate() {
                    state.audio_mixer.mix_hit(hit.time, hit.r#type)?;
                    
                    // 每100个或最后一个打印进度
                    if (i + 1) % 100 == 0 || i + 1 == total {
                        tracing::info!("混合进度: {}/{} ({}%)", i + 1, total, (i + 1) * 100 / total);
                    }
                }

                tracing::info!("开始导出混合后的音频...");
                state.audio_mixer.export("../output.wav")?;
                tracing::info!("音频导出完成");

                // 音频混合完成后立即通知前端（像原Python代码一样）
                let _ = tx.send(InternalMessage::SendToClient("hitOK".to_string())).await;
                tracing::info!("已发送 hitOK 到前端");

                tracing::info!("启动FFmpeg...");
                state.ffmpeg_process = Some(FFmpegProcess::new(
                    state.ffmpeg_path.clone(),
                    "../output.wav",
                    "../output.mp4",
                )?);
                tracing::info!("FFmpeg启动完成");
            } else {
                tracing::warn!("没有基础音频数据，跳过混合");
            }

            Ok(ServerResponse {
                status: "hitOK".to_string(),
            })
        }
        ClientMessage::Screen(data) => {
            if let Some(ref mut ffmpeg) = state.ffmpeg_process {
                let base64_data = if data.starts_with("data:image") {
                    data.split(',').last().unwrap_or(&data)
                } else {
                    &data
                };

                let png_data = STANDARD.decode(base64_data)?;
                ffmpeg.write_frame(&png_data)?;
            }
            Ok(ServerResponse {
                status: "frame_received".to_string(),
            })
        }
        ClientMessage::Msg(msg) if msg == "stop" => {
            tracing::info!("停止录制");
            if let Some(mut ffmpeg) = state.ffmpeg_process.take() {
                ffmpeg.close()?;
            }
            Ok(ServerResponse {
                status: "stopped".to_string(),
            })
        }
        _ => {
            tracing::warn!("未知消息类型");
            Ok(ServerResponse {
                status: "unknown".to_string(),
            })
        }
    }
}