import websockets
import base64
import subprocess
import os
import asyncio
from tkinter import messagebox
import json
import mixAudio

mixAudioI = mixAudio.AudioMixer()

# 检查ffmpeg是否存在本地，或者是否设置了环境变量
ffmpegPath = os.getenv("FFMPEG_PATH", "./ffmpeg.exe")
if not os.path.exists(ffmpegPath):
    messagebox.showerror("错误", f"找不到ffmpeg，路径：{ffmpegPath}")
    exit()

# 确保输出目录存在（../ 上级目录）
output_dir = os.path.dirname("../output.mp4")
if not os.path.exists(output_dir):
    os.makedirs(output_dir, exist_ok=True)

def initFFmpeg():
    # ffmpeg命令行参数优化：
    # 1. 移除音频相关参数（如果只录制屏幕，无音频输入）
    # 2. 添加 -pix_fmt yuv420p 保证兼容性（大部分播放器支持）
    # 3. 调整参数确保管道输入正常工作
    ffmpegArgs = [
        ffmpegPath, "-y",  # -y 覆盖已有文件（全局选项）
        
        # -------------- 视频输入配置（旧版本兼容，无 fps_mode）--------------
        "-f", "image2pipe",  # 输入格式：PNG管道
        "-vcodec", "png",    # 输入编码：PNG
        "-r", "60",          # 固定输入帧率 60fps（与发送端一致）
        "-vsync", "cfr",     # 替代 fps_mode=cfr：强制恒定帧率（避免丢帧/重复帧）
        "-i", "pipe:0",      # 第一个输入：PNG管道（标准输入）
        
        # -------------- 音频输入配置 --------------
        "-i", "../output.wav",  # 第二个输入：WAV音频
        
        # -------------- 输出配置 --------------
        "-c:v", "libx264",      # 视频编码：H.264（确保FFmpeg带该编码）
        "-crf", "28",           # 视频质量（0-51，越低越好）
        "-preset", "ultrafast", # 快速编码（降低延迟）
        "-pix_fmt", "yuv420p",  # 兼容所有播放器的像素格式
        "-c:a", "aac",          # 音频编码：AAC（MP4标准）
        "-b:a", "192k",         # 音频比特率（保证音质）
        "-fflags", "nobuffer",  # 禁用缓冲区（降低延迟）
        "-shortest",            # 输出时长=较短输入（避免黑屏/静音）
        
        "../output.mp4"  # 输出文件
    ]

    # 启动ffmpeg子进程（保持全局，持续写入屏幕数据）
    try:
        global process
        process = subprocess.Popen(
            ffmpegArgs,
            stdin=subprocess.PIPE,
            # stderr=subprocess.DEVNULL,  # 屏蔽ffmpeg的错误输出（可选）
            bufsize=10**8  # 增大缓冲区，避免数据丢失
        )
    except Exception as e:
        messagebox.showerror("错误", f"启动ffmpeg失败：{str(e)}")
        exit()

def mix_audio(baseAudioData, hitData):
    """
    处理音频数据：Base64解码后混合音效
    :param audio_data: Base64编码的音频数据
    """
    global mixAudioI
    mixAudioI.load(baseAudioData.split(",")[1])
    for hit in hitData:
        mixAudioI.mix_hit(hit["time"], hit["type"])
    mixAudioI.export("../output.wav")

    

def holdScreen(screen_data):
    """
    处理屏幕数据：Base64解码后写入ffmpeg管道
    :param screen_data: Base64编码的PNG图片数据
    """
    global process
    try:
        # 1. Base64解码（去掉可能的前缀，如"data:image/png;base64,"）
        if screen_data.startswith("data:image"):
            screen_data = screen_data.split(",")[1]
        png_data = base64.b64decode(screen_data)
        
        # 2. 写入ffmpeg标准输入（必须保持进程打开）
        if process.poll() is None:  # 检查ffmpeg进程是否还在运行
            process.stdin.write(png_data)
            process.stdin.flush()  # 强制刷新缓冲区，避免数据堆积
            
    except base64.binascii.Error:
        messagebox.showerror("错误", "Base64解码失败，数据格式错误")
    except BrokenPipeError:
        messagebox.showerror("错误", "ffmpeg管道已断开，无法写入数据")
    except Exception as e:
        messagebox.showerror("错误", f"处理屏幕数据失败：{str(e)}")

async def communicate(websocket):
    """WebSocket通信处理"""
    print("客户端已连接")
    await websocket.send("ok")
    try:
        async for message in websocket:
            # 接收客户端消息（JSON格式）
            try:
                data = json.loads(message)
                if data.get("type") == "audio" and "data" in data:
                    baseAudioData = data["data"]
                elif data.get("type") == "hit" and "data" in data:
                    hitData = data["data"]
                    mix_audio(baseAudioData, hitData)
                    initFFmpeg()
                elif data.get("type") == "screen" and "data" in data:
                    holdScreen(data["data"])
                elif data["type"] == "msg" and data["data"] == "stop":
                    print("停止录制")
                    process.stdin.close()
                    process.wait()
                else:
                    print(f"未知消息类型：{data.get('type')}")
            except json.JSONDecodeError:
                print("接收到非JSON格式消息")
            except Exception as e:
                print(f"处理消息失败：{str(e)}")
    except websockets.exceptions.ConnectionClosed:
        print("客户端已断开连接")
    finally:
        print("连接已关闭")

def main():
    """启动WebSocket服务"""
    print("启动WebSocket服务，监听 localhost:8085...")
    # 修复：使用正确的websockets启动方式
    start_server = websockets.serve(
        communicate,
        "localhost",
        8085,
        max_size=None,  # 无限制接收消息大小
        ping_interval=30,  # 心跳检测间隔
        ping_timeout=60  # 心跳超时时间
    )
    
    # 运行事件循环
    loop = asyncio.get_event_loop()
    try:
        loop.run_until_complete(start_server)
        loop.run_forever()
    except KeyboardInterrupt:
        print("服务正在关闭...")
    finally:
        # 关闭ffmpeg进程
        if process.poll() is None:
            process.stdin.close()
            process.terminate()
            process.wait()
        print("服务已关闭")

if __name__ == "__main__":
    main()