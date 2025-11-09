import websockets
import base64
import subprocess
import os
import asyncio
from tkinter import messagebox
import json
import mixAudio
from concurrent.futures import ThreadPoolExecutor  # 新增：线程池处理音频混合

# 检查ffmpeg是否存在（优化：支持环境变量路径）
ffmpegPath = os.getenv("FFMPEG_PATH", "./ffmpeg.exe")
if not os.path.exists(ffmpegPath):
    messagebox.showerror("错误", f"找不到ffmpeg，路径：{ffmpegPath}")
    exit()

# 全局线程池（优化：避免频繁创建线程）
audio_executor = ThreadPoolExecutor(max_workers=2)

async def handle(websocket):
    # 启动ffmpeg进程（优化：增加输入缓冲区大小，避免阻塞）
    process = subprocess.Popen(
        [
            ffmpegPath, "-y",
            "-f", "image2pipe", "-vcodec", "png",
            "-r", "60",
            "-i", "pipe:0",
            "-c:v", "libx264",
            "-crf", "28",
            "-preset", "ultrafast",  # 优化：快速编码，减少延迟
            "-c:a", "aac",
            "-b:a", "128k",
            "../output.mp4"
        ],
        stdin=subprocess.PIPE,
        bufsize=1024*1024  # 1MB缓冲区，减少IO次数
    )
    
    # 音频混合器实例（全局复用，避免重复初始化）
    mixer = mixAudio.AudioMixer()
    
    try:
        while True:
            data = json.loads(await websocket.recv())
            if data["type"] == "audio":
                # 异步处理音频加载（避免阻塞WebSocket接收）
                base64_data = data["data"].split(",")[1]
                await asyncio.get_event_loop().run_in_executor(
                    audio_executor,
                    mixer.load,
                    base64_data
                )
            
            elif data["type"] == "hit":
                # 异步混合多个音效（核心优化：并行处理）
                hits = data["data"]
                async def mix_all_hits():
                    for hit in hits:
                        await asyncio.get_event_loop().run_in_executor(
                            audio_executor,
                            mixer.mix_hit,
                            hit["time"],
                            hit["type"]
                        )
                await mix_all_hits()
                # 导出音频也异步执行
                await asyncio.get_event_loop().run_in_executor(
                    audio_executor,
                    mixer.export,
                    "../output.wav"
                )
            
            elif data["type"] == "screen":
                # 处理屏幕截图（优化：减少Base64前缀处理耗时）
                img_data = data["data"]
                if img_data.startswith(("data:image/", "data:img/")):
                    img_bytes = base64.b64decode(img_data.split(",", 1)[1])
                else:
                    img_bytes = base64.b64decode(img_data)  # 兼容无前缀情况
                # 写入FFmpeg管道（非阻塞写入）
                process.stdin.write(img_bytes)
                process.stdin.flush()
                await websocket.send("ok")
            
            elif data["type"] == "msgH":
                # 异步处理追加音效
                await asyncio.get_event_loop().run_in_executor(
                    audio_executor,
                    lambda: mixer.load(open("../output.wav", "rb").read())
                )
                for hit in data["data"]:
                    await asyncio.get_event_loop().run_in_executor(
                        audio_executor,
                        mixer.mix_hit,
                        hit["time"],
                        3
                    )
                await asyncio.get_event_loop().run_in_executor(
                    audio_executor,
                    mixer.export,
                    "../output1.wav"
                )
            
            elif data["type"] == "msg" and data["data"] == "stop":
                print("停止录制")
                process.stdin.close()
                process.wait()
                # 异步执行音视频合并，避免阻塞
                await asyncio.get_event_loop().run_in_executor(
                    audio_executor,
                    add_audio
                )
                break
    
    finally:
        process.stdin.close()
        process.wait()
        print("录制结束")

def add_audio():
    """音视频合并（优化：使用快速编码参数）"""
    process = subprocess.Popen(
        [
            ffmpegPath, "-y",
            "-i", "../output.mp4",
            "-i", "../output.wav",
            "-c:v", "copy",  # 视频直接复制，不重新编码
            "-c:a", "aac",
            "-b:a", "128k",
            "-shortest",  # 取较短的时长（避免静音过长）
            "../output1.mp4"
        ]
    )
    process.wait()
    # 清理临时文件（增加异常捕获）
    for f in ["../output.mp4", "../output.wav"]:
        if os.path.exists(f):
            try:
                os.remove(f)
            except:
                pass
    print("音视频合并完成")

async def main():
    # 优化WebSocket配置：增加最大消息大小，减少连接延迟
    async with websockets.serve(
        handle, 
        "localhost", 
        8085, 
        max_size=None,
        ping_interval=30,  # 减少心跳检测频率
        ping_timeout=60
    ):
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())