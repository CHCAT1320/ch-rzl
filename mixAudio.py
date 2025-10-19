import base64
import io
import numpy as np
from pydub import AudioSegment

# 配置本地ffmpeg路径
AudioSegment.converter = "./ffmpeg"

class AudioMixer:
    def __init__(self):
        self.base_audio = None  # 基础音频段
        self.sample_rate = None  # 采样率（样本/秒）
        self.channels = None  # 声道数
        self.sample_width = 2  # 16位音频（对应int16）
        # 音效路径映射（0,1,2三种类型）
        self.sound_effects = [
            'audio/hit.wav',
            'audio/drag.wav',
            'audio/hit.wav',
            'audio/fresh.wav',
        ]

    def load(self, base64_audio):
        """加载base64编码的WAV格式基础音频"""
        try:
            # 解码base64数据
            audio_bytes = base64.b64decode(base64_audio)
            # 从字节流加载WAV音频
            audio_segment = AudioSegment.from_file(
                io.BytesIO(audio_bytes),
                format="wav"
            )
            
            # 统一音频格式（16位）
            if audio_segment.sample_width != self.sample_width:
                audio_segment = audio_segment.set_sample_width(self.sample_width)
            
            # 存储核心参数
            self.base_audio = audio_segment
            self.sample_rate = audio_segment.frame_rate  # 采样率（例如44100样本/秒）
            self.channels = audio_segment.channels
            return True
        except Exception as e:
            print(f"加载基础音频失败: {e}")
            return False

    def mix_hit(self, time_sec, effect_type):
        """
        在指定时间点（秒）混合指定类型的音效
        :param time_sec: 音效开始的时间（单位：秒，支持小数，如1.5表示1.5秒）
        :param effect_type: 音效类型（0,1,2）
        """
        if self.base_audio is None:
            print("请先调用load()加载基础音频")
            return False
        
        if effect_type not in [0, 1, 2, 3]:
            print("音效类型必须为0、1或2 3")
            return False
        
        try:
            # 加载音效并统一格式
            effect = AudioSegment.from_wav(self.sound_effects[effect_type])
            effect = effect.set_frame_rate(self.sample_rate)\
                         .set_channels(self.channels)\
                         .set_sample_width(self.sample_width)
            
            # 转换为numpy数组（int32防止叠加溢出）
            base_array = np.array(self.base_audio.get_array_of_samples(), dtype=np.int32)
            effect_array = np.array(effect.get_array_of_samples(), dtype=np.int32)
            
            # 关键修正：时间（秒）→ 样本索引（时间×采样率）
            # 用round确保索引为整数（样本不可分割）
            start_idx = round(time_sec * self.sample_rate * 2)
            end_idx = start_idx + len(effect_array)
            
            # 若音效超出基础音频长度，扩展基础音频（补0静音）
            if end_idx > len(base_array):
                base_array = np.pad(
                    base_array,
                    (0, end_idx - len(base_array)),
                    mode='constant'
                )
            
            # 混合音频（叠加）
            base_array[start_idx:end_idx] += effect_array
            
            # 限制振幅范围并转回int16
            base_array = np.clip(base_array, -32768, 32767).astype(np.int16)
            
            # 更新基础音频
            self.base_audio = AudioSegment(
                base_array.tobytes(),
                frame_rate=self.sample_rate,
                sample_width=self.sample_width,
                channels=self.channels
            )
            return True
        except Exception as e:
            print(f"混合音效失败: {e}")
            return False

    def export(self, output_path):
        """导出为WAV格式音频"""
        if self.base_audio is None:
            print("无音频可导出")
            return False
        
        try:
            self.base_audio.export(output_path, format="wav")
            print(f"音频已导出至: {output_path}")
            return True
        except Exception as e:
            print(f"导出失败: {e}")
            return False