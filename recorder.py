import websockets
import base64
import subprocess
import os
import asyncio
from tkinter import messagebox
import json
import mixAudio

# 检查ffmpeg是否存在
ffmpegPath = "./ffmpeg.exe"
if not os.path.exists(ffmpegPath):
    messagebox.showerror("错误", "找不到ffmpeg.exe")
    exit()

async def handle(websocket):
    # 启动ffmpeg进程，将连续图像转为视频
    # H.264 编码示例
    process = subprocess.Popen(
        [
            ffmpegPath, "-y",
            "-f", "image2pipe", "-vcodec", "png",
            "-r", "60",
            "-i", "pipe:0",
            "-c:v", "libx264",  # H.264 编码器
            "-crf", "28",  # H.264 的 CRF 建议比 H.265 低 5-10（保持相似质量）
            "-preset", "medium",
            "-c:a", "aac",
            "-b:a", "128k",
            "../output.mp4"
        ],
        stdin=subprocess.PIPE
    )
    
    try:
        # 持续接收数据
        while True:
            data = json.loads(await websocket.recv())
            if data["type"] == "audio":
                # print(data["data"])
                # 处理音频数据
                mix = mixAudio.AudioMixer()
                mix.load(data["data"].split(",")[1])
            if data["type"] == "hit":
                # 处理音效数据
                for hit in data["data"]:
                    mix.mix_hit(hit["time"], hit["type"])
                mix.export("../output.wav")
            if data["type"] == "screen":
                # 处理屏幕截图
                img_bytes = base64.b64decode(data["data"].split(",")[1])
                process.stdin.write(img_bytes)
                process.stdin.flush()
                await websocket.send("ok")
            if data["type"] == "msgH":
                with open("../output.wav", "rb") as f:
                    base64_data = base64.b64encode(f.read()).decode("utf-8")
                    mix.load(base64_data)
                for hit in data["data"]:
                    mix.mix_hit(hit["time"], 3)
                    print(hit)
                mix.export("../output1.wav")
            elif data["type"] == "msg":
                # 处理停止消息
                if data["data"] == "stop":
                    print("停止录制")
                    # 完成处理
                    process.stdin.close()
                    process.wait()
                    add_audio()
                    break

    
    finally:
        # exit()
        process.stdin.close()
        process.wait()
        print("录制结束")

def add_audio():
    process = subprocess.Popen(
        [
            ffmpegPath, "-y",
            "-i", "../output.mp4",
            "-i", "../output1.wav",
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", "128k",
            "../output1.mp4"
        ]
    )
    process.wait()
    print("done")
    os.remove("../output.mp4")
    # os.remove("../output.wav")
    # exit()

async def main():
    async with websockets.serve(handle, "localhost", 8085, max_size = None):
        await asyncio.Future()  # 保持运行

if __name__ == "__main__":
    asyncio.run(main())
    