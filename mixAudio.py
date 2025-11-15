import base64
import io
import numpy as np
from pydub import AudioSegment
from pydub.utils import make_chunks
import os

# 配置本地ffmpeg路径（优先使用环境变量，其次本地路径）
AudioSegment.converter = os.getenv("FFMPEG_PATH", "./ffmpeg")

class AudioMixer:
    def __init__(self):
        self.base_audio = None  # 基础音频段
        self.sample_rate = None  # 采样率（样本/秒）
        self.channels = None  # 声道数
        self.sample_width = 2  # 16位音频（固定，减少转换）
        self.frame_per_sec = None  # 每秒钟的帧数（采样率×声道数，预计算）
        # 音效路径映射（0,1,2,3四种类型）
        self.sound_effects = [
            'audio/hit.wav',
            'audio/drag.wav',
            'audio/hit.wav',
            'audio/drag.wav',
        ]
        # 预加载音效缓存（key: 音效类型，value: (numpy数组, 长度)）
        self.preloaded_effects = {}
        # 基础音频数组缓存（避免重复转换）
        self.base_array = None

    def load(self, base64_audio):
        """加载base64编码的WAV格式基础音频（优化：减少格式转换次数）"""
        try:
            # 解码base64数据并加载音频
            audio_bytes = base64.b64decode(base64_audio)
            audio_segment = AudioSegment.from_file(
                io.BytesIO(audio_bytes),
                # format="wav" # shut the fuck up
            )
            
            # 只在必要时转换格式（减少计算）
            if (audio_segment.sample_width != self.sample_width 
                or audio_segment.channels != self.channels 
                or audio_segment.frame_rate != self.sample_rate):
                # 统一格式为16位，保持与后续音效一致
                audio_segment = audio_segment.set_sample_width(self.sample_width)
                self.sample_rate = audio_segment.frame_rate
                self.channels = audio_segment.channels
                # 预计算每秒钟的帧数（核心优化：避免重复计算）
                self.frame_per_sec = self.sample_rate * self.channels
            
            self.base_audio = audio_segment
            # 直接转换为int32数组缓存（混合时无需重复转换）
            self.base_array = np.array(
                self.base_audio.get_array_of_samples(),
                dtype=np.int32  # 用int32避免混合时溢出
            )
            
            # 预加载所有音效并适配格式（仅在基础音频格式变化时执行）
            self._preload_and_adapt_effects()
            return True
        except Exception as e:
            print(f"加载基础音频失败: {e}")
            return False

    def _preload_and_adapt_effects(self):
        """预加载音效并缓存（优化：只在基础音频格式变化时重新加载）"""
        # 清空旧缓存（格式变化后旧缓存无效）
        self.preloaded_effects.clear()
        for effect_type in [0, 1, 2, 3]:
            try:
                # 加载原始音效（如果文件不存在则跳过，避免崩溃）
                if not os.path.exists(self.sound_effects[effect_type]):
                    print(f"音效文件不存在: {self.sound_effects[effect_type]}")
                    continue
                effect = AudioSegment.from_wav(self.sound_effects[effect_type])
                
                # 适配基础音频格式（只转换必要参数）
                effect = effect.set_frame_rate(self.sample_rate)\
                             .set_channels(self.channels)\
                             .set_sample_width(self.sample_width)
                
                # 转换为int32数组并缓存（同时存储长度，避免重复计算len()）
                effect_array = np.array(effect.get_array_of_samples(), dtype=np.int32)
                self.preloaded_effects[effect_type] = (effect_array, len(effect_array))
            except Exception as e:
                print(f"预加载音效 {effect_type} 失败: {e}")

    def mix_hit(self, time_sec, effect_type):
        """
        在指定时间点混合音效（优化：减少内存操作，简化计算）
        :param time_sec: 音效开始时间（秒）
        :param effect_type: 音效类型（0-3）
        """
        if self.base_audio is None or self.base_array is None:
            print("请先调用load()加载基础音频")
            return False
        
        if effect_type not in self.preloaded_effects:
            print(f"音效类型 {effect_type} 未加载成功")
            return False
        
        try:
            # 从缓存获取音效数组和长度（避免重复计算len()）
            effect_array, effect_len = self.preloaded_effects[effect_type]
            
            # 计算开始索引（核心优化：用预计算的frame_per_sec减少乘法）
            start_idx = round(time_sec * self.frame_per_sec)
            end_idx = start_idx + effect_len
            base_len = len(self.base_array)

            # 扩展基础音频（如果音效超出长度）
            if end_idx > base_len:
                # 计算需要补充的静音长度（直接操作数组，避免AudioSegment拼接）
                pad_length = end_idx - base_len
                self.base_array = np.pad(
                    self.base_array,
                    (0, pad_length),
                    mode='constant',
                    constant_values=0
                )
                base_len = len(self.base_array)  # 更新长度

            # 混合音效（只处理重叠区域，减少计算量）
            overlap_start = max(0, start_idx)
            overlap_end = min(end_idx, base_len)
            if overlap_start < overlap_end:
                # 计算音效和基础音频的重叠区间
                effect_slice = effect_array[overlap_start - start_idx : overlap_end - start_idx]
                self.base_array[overlap_start:overlap_end] += effect_slice

            return True
        except Exception as e:
            print(f"混合音效失败: {e}")
            return False

    def export(self, output_path):
        """导出音频（优化：避免重复转换数组）"""
        if self.base_array is None:
            print("无音频可导出")
            return False
        
        try:
            # 振幅限制（原地操作，节省内存）
            np.clip(self.base_array, -32768, 32767, out=self.base_array)
            # 转换为int16并生成音频段（直接用数组tobytes()，避免重复采样）
            audio_segment = AudioSegment(
                self.base_array.astype(np.int16).tobytes(),
                frame_rate=self.sample_rate,
                sample_width=self.sample_width,
                channels=self.channels
            )
            audio_segment.export(output_path, format="wav")
            print(f"音频已导出至: {output_path}")
            return True
        except Exception as e:
            print(f"导出失败: {e}")
            return False