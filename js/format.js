var canvasI = []
var lineI = []
var noteI = []
var hitI = []
var msgH = []
var autoHandData = []
var autoHandDataTemp = 0

/**
 * 将秒数转换为 tick
 * @param {number} seconds - 目标秒数
 * @param {Array} bpmShifts - BPM变化点数组，按 time(tick) 升序排列
 * @param {number} baseBPM - 基础 BPM，默认 150
 * @returns {number} - 对应的 tick
 */
function secondsToTick(seconds, bpmShifts = chart.bpmShifts, baseBPM = chart.bPM) {
    if (bpmShifts.length === 0) {
        return seconds / (60 / baseBPM); // 无变化时直接计算
    }

    let prev = bpmShifts[0];
    if (seconds <= prev.floorPosition) {
        return seconds / (60 / (baseBPM * prev.value));
    }

    for (let i = 1; i < bpmShifts.length; i++) {
        const curr = bpmShifts[i];

        if (seconds <= curr.floorPosition) {
            const tickStart = prev.time;
            const tickEnd = curr.time;
            const timeStart = prev.floorPosition;
            const timeEnd = curr.floorPosition;

            const ratio = (seconds - timeStart) / (timeEnd - timeStart);
            return tickStart + ratio * (tickEnd - tickStart);
        }

        prev = curr;
    }

    // 如果秒数大于最后一个 shift 的 floorPosition
    const last = bpmShifts[bpmShifts.length - 1];
    const extraSeconds = seconds - last.floorPosition;
    const extraTicks = extraSeconds / (60 / (baseBPM * last.value));
    return last.time + extraTicks;
}

/**
 * 将 tick 转换为秒数
 * @param {number} tick          - 目标 tick
 * @param {Array}  bpmShifts     - BPM 变化点数组，已按 time(tick) 升序排列
 * @param {number} baseBPM       - 基础 BPM，默认 150
 * @returns {number}             - 对应的秒数
 */
function tickToSeconds(tick, bpmShifts = chart.bpmShifts, baseBPM = chart.bPM) {
    // 没有 BPM 变化：匀速
    if (bpmShifts.length === 0) {
        return tick * (60 / baseBPM);
    }

    // 落在第一段之前
    const first = bpmShifts[0];
    if (tick <= first.time) {
        return tick * (60 / (baseBPM * first.value));
    }

    // 扫描区间
    for (let i = 1; i < bpmShifts.length; i++) {
        const curr = bpmShifts[i];
        if (tick <= curr.time) {
            const prev = bpmShifts[i - 1];

            const ratio = (tick - prev.time) / (curr.time - prev.time);
            const secStart = prev.floorPosition;
            const secEnd   = curr.floorPosition;

            return secStart + ratio * (secEnd - secStart);
        }
    }

    // 超出最后一个变化点
    const last = bpmShifts[bpmShifts.length - 1];
    const extraTicks = tick - last.time;
    const extraSeconds = extraTicks * (60 / (baseBPM * last.value));
    return last.floorPosition + extraSeconds;
}

/**
 * 根据 tick 从 event 列表中查找 value
 * @param {number} tick
 * @param {Array} events 
 * @returns {number}
 */
function findValue(tick, events) {
    // 处理列表只有一项的情况
    if (events.length === 1) {
        return tick >= events[0].time ? events[0].value : 0; // 假设时间在第一个关键帧之前返回0
    }
    
    // 处理时间大于最后一项的情况
    const lastEvent = events[events.length - 1];
    if (tick > lastEvent.time) {
        // 题目中说time2 = 999999，但未明确value2，这里假设value2与最后一项相同
        return lastEvent.value;
    }
    
    // 二分查找找到对应的区间
    let left = 0;
    let right = events.length - 1;
    let event1 = null;
    let event2 = null;
    
    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const midEvent = events[mid];
        
        if (midEvent.time === tick) {
            // 恰好找到匹配的时间点
            return midEvent.value;
        } else if (midEvent.time < tick) {
            // 当前中间点时间小于目标时间，继续向右查找
            event1 = midEvent;
            left = mid + 1;
        } else {
            // 当前中间点时间大于目标时间，继续向左查找
            event2 = midEvent;
            right = mid - 1;
        }
    }
    
    // 如果找到了对应的区间，返回两个值的和
    if (event1 && event2) {
        const easeValue = easeFuncs[event1.easeType]((tick - event1.time) / (event2.time - event1.time));
        return  event1.value + (event2.value - event1.value) * easeValue;
    }
    
    // 如果没有找到合适的区间（理论上不会走到这里）
    return 0;
}

/**
 * 根据 tick 从 event 列表中查找 Svalue
 * @param {number} tick
 * @param {Array} events 
 * @returns {number}
 */
function findSpeedValue(tick, events) {
    // 处理空列表情况
    if (events.length === 0) {
        return 0; // 或根据业务需求返回合理的默认值
    }
    
    // 统一转换为秒单位，避免重复计算
    const targetTime = tickToSeconds(tick);
    const processedEvents = events.map(event => ({
        ...event,
        timeInSec: tickToSeconds(event.time)
    })).sort((a, b) => a.timeInSec - b.timeInSec); // 确保事件按时间排序
    
    // 处理列表只有一项的情况
    if (processedEvents.length === 1) {
        const event = processedEvents[0];
        // 如果时间在关键帧之后，应用变化率；之前则返回0
        if (targetTime >= event.timeInSec) {
            return event.fp + (targetTime - event.timeInSec) * event.value;
        } else {
            return 0;
        }
    }
    
    // 处理时间大于最后一项的情况
    const lastEvent = processedEvents[processedEvents.length - 1];
    if (targetTime > lastEvent.timeInSec) {
        // 应用最后一项的变化率，而不是固定返回fp
        return lastEvent.fp + (targetTime - lastEvent.timeInSec) * lastEvent.value;
    }
    
    // 二分查找找到对应的区间
    let left = 0;
    let right = processedEvents.length - 1;
    let event1 = null;
    let event2 = null;
    
    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const midEvent = processedEvents[mid];
        
        if (midEvent.timeInSec === targetTime) {
            // 恰好找到匹配的时间点
            return midEvent.fp;
        } else if (midEvent.timeInSec < targetTime) {
            // 当前中间点时间小于目标时间，继续向右查找
            event1 = midEvent;
            left = mid + 1;
        } else {
            // 当前中间点时间大于目标时间，继续向左查找
            event2 = midEvent;
            right = mid - 1;
        }
    }
    
    // 如果找到了对应的区间，返回计算值
    if (event1 && event2) {
        return event1.fp + (targetTime - event1.timeInSec) * event1.value;
    }
    
    // 兜底返回（理论上不会走到这里）
    return 0;
}

function getChallengeTimeIndex(tick) {
    const challengeTimes = chart.challengeTimes;
    for (let i = 0; i < challengeTimes.length; i++) {
        const challengeTime = challengeTimes[i];
        if (tick >= challengeTime.start && tick <= challengeTime.end) {
            return i + 1;
        }
    }
    return -1;
}
function drawBackground(tick) {
    const themes = chart.themes;
    const challengeTimesIndex = getChallengeTimeIndex(tick);
    // if (challengeTimesIndex !== -1) {
    //     ctx.save();
    //     const color = themes[challengeTimesIndex].colorsList[0];
    //     ctx.beginPath();
    //     ctx.fillStyle = "rgba(" + color.r + "," + color.g + "," + color.b + "," + color.a + ")";
    //     ctx.fillRect(-cvs.width / 2, -cvs.height / 2 - 200 * (cvs.height / 640), cvs.width, cvs.height);
    //     ctx.restore();
    //     return;
    // }
    const color = themes[0].colorsList[0];
    ctx.save();
    ctx.beginPath();
    ctx.fillStyle = "rgba(" + color.r + "," + color.g + "," + color.b + "," + color.a + ")";
    ctx.fillRect(-cvs.width / 2, -cvs.height / 2 - 200 * (cvs.height / 640), cvs.width, cvs.height);
    ctx.restore();
    drawRiztimeBackground(tick);
}

function drawRiztimeBackground(tick) {
    const themes = chart.themes;
    var r = (640 + 200) * (cvs.height / 640);
    var y = 150 * (cvs.height / 640);
    for (let i = 0; i < chart.challengeTimes.length; i++) {
        const challengeTime = chart.challengeTimes[i];
        if (tick >= challengeTime.start && tick <= challengeTime.end + challengeTime.transTime) {
            var color = themes[i + 1].colorsList[0];
            if (tick >= challengeTime.start && tick <= challengeTime.start + challengeTime.transTime) {
                 r = r * easeFuncs[2]((tick - challengeTime.start) / challengeTime.transTime);
            } else if (tick >= challengeTime.end && tick <= challengeTime.end + challengeTime.transTime) {
                 r = r + (-r) * easeFuncs[3]((tick - challengeTime.end) / challengeTime.transTime);
                 y = -cvs.height / 2 - 200 * (cvs.height / 640)
            }

        }
    }
    if (!color || !r) return;
    ctx.save();;
    ctx.beginPath();
    ctx.fillStyle = "rgba(" + color.r + "," + color.g + "," + color.b + "," + color.a + ")";
    ctx.arc(0, y, r, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();

}

function drawCover(tick) {
    if (revelationSize !== 1) return;
    ctx.save();
    ctx.beginPath();
    const themes = chart.themes;
    const challengeTimesIndex = getChallengeTimeIndex(tick);
    for (let i = 0; i < 5; i += 0.2) {
        if (challengeTimesIndex !== -1) {
            const color = themes[challengeTimesIndex].colorsList[0];
            ctx.fillStyle = "rgba(" + color.r + "," + color.g + "," + color.b + "," + i + ")";
        } else {
            const color = themes[0].colorsList[0];
            ctx.fillStyle = "rgba(" + color.r + "," + color.g + "," + color.b + "," + i + ")";
        }
        let times = 30 * (cvs.height / 640)
        ctx.fillRect(-cvs.width / 2, -cvs.height / 2 - (170 * (cvs.height / 640) + (times * i)), cvs.width, 30 * (cvs.height / 640));
        ctx.fillRect(-cvs.width / 2, -cvs.height / 2 - (230 * (cvs.height / 640) - (times * i)) + cvs.height - 70 * (cvs.height / 640), cvs.width, 30 * (cvs.height / 640));
    }
    ctx.fill();
    ctx.restore();
}

function cameraScale(tick) {
    const scaleList = chart.cameraMove.scaleKeyPoints;
    const value = findValue(tick, scaleList);
    return value * revelationSize
}
function cameraMoveX(tick) {
    const xPositionList = chart.cameraMove.xPositionKeyPoints;
    const value = findValue(tick, xPositionList);
    return value;
}

function calculateMixedColor(tick, pointColor, lineColor) {
  // 如果线颜色列表为空，直接返回点颜色
  if (!lineColor || lineColor.length === 0) {
    return { ...pointColor };
  }
  
  // 获取当前时间点的线颜色
  const currentLineColor = getCurrentLineColor(lineColor, tick);
  
  // 如果当前时间在第一个颜色点之前，返回点原色
  if (!currentLineColor) {
    return { ...pointColor };
  }
  
  // 使用mixColor函数混合线颜色和点颜色，点的a通道作为混合权重
  return mixColor(pointColor, currentLineColor);
}

// /**
//  * 混合两种颜色
//  * @param {Object} color1 - 第一种颜色 {r, g, b, a}
//  * @param {Object} color2 - 第二种颜色 {r, g, b, a}
//  * @returns {Object} 混合后的颜色
//  */
// function mixColor({ r: r1, g: g1, b: b1, a: a1 }, { r: r2, g: g2, b: b2, a: a2 }) {
//   // 边界情况处理
//   if (a2 === 0) return { r: r1, g: g1, b: b1, a: a1 };
//   if (a2 === 255) return { r: r2, g: g2, b: b2, a: a1 };
  
//   // 计算混合比例并应用
//   const mixRatio = a2 / 255;
//   return { 
//     r: Math.round(r1 + (r2 - r1) * mixRatio), 
//     g: Math.round(g1 + (g2 - g1) * mixRatio), 
//     b: Math.round(b1 + (b2 - b1) * mixRatio), 
//     a: a1
//   };
// }

// 抛弃lchzh3473的混合函数，以下函数由豆包编写 ==> 原因是混合出来的颜色太浅了

/**
 * 混合两种颜色（标准Alpha混合算法，最终透明度固定为第一个颜色的透明度）
 * @param {Object} color1 - 第一种颜色 {r, g, b, a}，a取值0-255
 * @param {Object} color2 - 第二种颜色 {r, g, b, a}，a取值0-255
 * @returns {Object} 混合后的颜色 {r, g, b, a}
 */
function mixColor({ r: r1, g: g1, b: b1, a: a1 }, { r: r2, g: g2, b: b2, a: a2 }) {
  // 边界情况处理：第二个颜色完全透明，直接返回第一个颜色
  if (a2 === 0) return { r: r1, g: g1, b: b1, a: a1 };
  // 第二个颜色完全不透明，直接返回第二个颜色但保留第一个的透明度
  if (a2 === 255) return { r: r2, g: g2, b: b2, a: a1 };

  // 转换透明度为0-1的浮点数
  const alpha2 = a2 / 255;

  // 标准Alpha混合公式计算RGB值（核心优化：解决颜色偏浅问题）
  // 公式调整：适配固定使用第一个颜色透明度的场景
  const mixRatio = alpha2; // 第二个颜色的透明度占比
  const r = Math.round(r1 * (1 - mixRatio) + r2 * mixRatio);
  const g = Math.round(g1 * (1 - mixRatio) + g2 * mixRatio);
  const b = Math.round(b1 * (1 - mixRatio) + b2 * mixRatio);

  // 返回混合结果（透明度固定为第一个颜色的a值，RGB值限制在0-255）
  return {
    r: Math.max(0, Math.min(255, r)),
    g: Math.max(0, Math.min(255, g)),
    b: Math.max(0, Math.min(255, b)),
    a: a1 // 固定沿用第一个颜色的透明度
  };
}

/**
 * 从lineColor数组中根据当前时间获取线的插值颜色
 * @param {Array} lineColor - 线颜色数组，每个元素包含startColor, endColor, time
 * @param {number} tick - 当前时间点
 * @returns {Object|null} 插值后的颜色 {r, g, b, a}，如果无有效颜色返回null
 */
function getCurrentLineColor(lineColor, tick) {
  // 处理空数组情况
  if (!lineColor || !Array.isArray(lineColor) || lineColor.length === 0) {
    return null;
  }
  if (lineColor.length === 1) {
    return lineColor[0].startColor;
  }
  if (tick >= lineColor[lineColor.length - 1].time) {
    return lineColor[lineColor.length - 1].endColor;
  }

  // 转换为时间片段结构
  const colorSegments = lineColor.map((segment, index) => {
    const nextSegment = lineColor[index + 1];
    const ret =  {
      startSeconds: segment.time,
      endSeconds: nextSegment ? nextSegment.time : segment.time,
      startColor: segment.startColor,
      endColor: segment.endColor
    };
    if (!ret) console.log("Error color is null", segment, nextSegment);
    return ret;
  });

  // 调用通用的时间颜色插值函数
  const ret = getCurrentColor(colorSegments, tick);
  if (!ret) console.log("Error ret is null", colorSegments, tick);
  return ret
}

/**
 * 通用的时间颜色插值函数
 * @param {Array} colorSegments - 颜色片段数组，每个包含startSeconds, endSeconds, startColor, endColor
 * @param {number} nowSeconds - 当前时间
 * @returns {Object|null} 插值后的颜色
 */
function getCurrentColor(colorSegments, nowSeconds) {
  // 空数组处理
  if (!colorSegments || !Array.isArray(colorSegments) || colorSegments.length === 0) {
    return null;
  }
  
  // 默认取第一个片段的起始颜色
  let currentColor = { ...colorSegments[0].startColor };
  
  // 遍历颜色片段寻找当前时间所在的区间
  for (const segment of colorSegments) {
    // 时间在当前片段结束之后，继续检查下一个
    if (nowSeconds > segment.endSeconds) {
      continue;
    }
    
    // 时间在当前片段开始之前，使用默认颜色并退出循环
    if (nowSeconds < segment.startSeconds) {
      break;
    }
    
    // 计算在当前片段中的时间比例（避免除以零）
    const duration = segment.endSeconds - segment.startSeconds;
    const progress = duration > 0 ? (nowSeconds - segment.startSeconds) / duration : 1;
    
    // 计算RGBa各通道的插值
    currentColor = interpolateColor(segment.startColor, segment.endColor, progress);
    break;
  }
  
  return currentColor;
}

/**
 * 颜色插值辅助函数
 * @param {Object} startColor - 起始颜色
 * @param {Object} endColor - 结束颜色
 * @param {number} progress - 插值进度（0-1）
 * @returns {Object} 插值后的颜色
 */
function interpolateColor(startColor, endColor, progress) {
  return {
    r: Math.round(startColor.r + (endColor.r - startColor.r) * progress),
    g: Math.round(startColor.g + (endColor.g - startColor.g) * progress),
    b: Math.round(startColor.b + (endColor.b - startColor.b) * progress),
    a: Math.round(startColor.a + (endColor.a - startColor.a) * progress)
  };
}

// 提取颜色格式化函数
function getRGBAString(color) {
    return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
}

function calculateCombo(comb) {
    if (comb === 0) return 0;
    if (comb <= 5) {
        return comb;
    } else if (comb >= 5 && comb <= 8) {
        return 2 * comb - 5;
    } else if (comb >= 8 && comb <= 11) {
        return 3 * comb - 13;
    } else { // comb >= 12
        return 4 * comb - 24;
    }
}

function drawCombo() {
    let hitCount = 0;
    for (let i = 0; i < noteI.length; i++) {
        // if (noteI[i].isBad !== false && noteI[i].isHit) {
        //     hitCount = 0
        //     continue
        // }
        if (noteI[i].isHit) {
            hitCount++;
            if (noteI[i].info.type === 2) {
                hitCount++
            }
        }
    }
    hitCount = hitCount
    const combo = calculateCombo(hitCount);
    if (combo === 0) return;
    ctx.save();
    ctx.font = `${30 * (cvs.width / 360)}px rizline`;
    ctx.fillStyle = "black";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2 * (cvs.width / 360);
    const comboWidth = ctx.measureText(combo.toString()).width
    const x = cvs.width / 2 - comboWidth / 2 - 25 * (cvs.width / 360);
    const y = -cvs.height / 2 - 150 * (cvs.height / 640);
    ctx.strokeText(combo, x, y);
    ctx.fillText(combo, x, y);
    ctx.font = `${20 * (cvs.width / 360)}px rizline`;
    const comboTextWidth = ctx.measureText("CATPLAY").width
    ctx.strokeText("CATPLAY", x - comboWidth / 2 - comboTextWidth / 2, y);
    ctx.fillText("CATPLAY", x - comboWidth / 2 - comboTextWidth / 2, y);
    ctx.restore();
}
// drawCombo();

function drawShuiYin() {
    ctx.save();
    ctx.font = `${9 * (cvs.width / 360)}px rizline`;
    let shuiYin = "CHART REVELATION : CH-RZL Player VERSION 0.1.1 ALL CODE BY CHCAT1320"
    if (revelationSize === 1) {
        ctx.font = `${12 * (cvs.width / 360)}px rizline`;
        shuiYin = "CH-RZL Player VERSION 0.1.2 ALL CODE BY CHCAT1320"
    }
    ctx.fillStyle = "white";
    ctx.strokeStyle = "black";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = 1;
    const shuiYinWidth = ctx.measureText(shuiYin).width
    const x = 0
    const y = -cvs.height / 2 + 150 * (cvs.height / 640);
    ctx.fillText(shuiYin, x, y);
    ctx.lineWidth =0.5 * (cvs.width / 360);
    ctx.strokeText(shuiYin, x, y);
    ctx.restore();
}
drawShuiYin()

function drawScreenBoard() {
    if (revelationSize === 1) return;
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255, 0, 0, 1)";
    ctx.rect(-cvs.width / 2 * revelationSize, -cvs.height / 2 * revelationSize - 200 * (cvs.height / 640) * revelationSize, cvs.width * revelationSize, cvs.height * revelationSize);
    ctx.stroke();
    ctx.restore();
}
drawScreenBoard()
    
class canvas {
    constructor(index) {
        this.index = index;
        for (let i = 0; i < chart.canvasMoves.length; i++) {
            if (chart.canvasMoves[i].index === index) {
                this.moveList = chart.canvasMoves[i];
                break;
            }
        }
        this.xM = this.moveList.xPositionKeyPoints;
        this.sK = this.moveList.speedKeyPoints;
        this.sK = this.recalculateAllFP(this.sK);
        // console.log(this.sK)
        this.x = 0;
        this.fp = 0;
    }
    recalculateAllFP() {
        this.sK[0].fp = 0;
        for (let i = 1; i < this.sK.length; i++) {
            const prev = this.sK[i - 1];
            const current = this.sK[i];
            
            const timeDiff = tickToSeconds(current.time) - tickToSeconds(prev.time);
            
            current.fp = prev.fp + prev.value * timeDiff;
        }
        
        return this.sK;
    }
    speedToFP(timer) {
        let left = 0;
        let right = this.sK.length - 1;
        let targetIndex = right;
        
        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            const midTime = tickToSeconds(this.sK[mid].time);
            
            if (midTime <= timer) {
                targetIndex = mid;
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }
        
        const current = this.sK[targetIndex];
        const currentTime = tickToSeconds(current.time);
        const t2 = timer - currentTime;
        
        return current.fp + t2 * current.value;
    }
    updated(tick) {
        this.x = (findValue(tick, this.xM) - cameraMoveX(tick)) * cameraScale(tick) * cvs.width;
        this.fp = this.speedToFP(tickToSeconds(tick))//findSpeedValue(tick, this.sK);
        if (revelationSize === 1) return;
        ctx.font = `${35 * cameraScale(tick) * (cvs.width / 360)}px rizline`;
        ctx.fillText(this.index, this.x, 200 * cameraScale(tick) * (cvs.height / 540));
    }
}

class line {
    constructor(index, info) {
        this.info = info;
        this.index = index;
        this.points = info.linePoints;
    }
    updatePoints(tick) {
        const scale = cameraScale(tick); // 缓存缩放值，避免重复计算
        
        for (let i = 0; i < this.points.length; i++) {
            const point = this.points[i];
            if (!point) continue; // 简化null检查
            
            // 缓存画布引用
            const canvas = canvasI[point.canvasIndex];
            if (!canvas) continue; // 增加画布有效性检查
            
            // 初始化fp（只做一次）
            if (point.fp === undefined) {
                point.fp = canvas.speedToFP(tickToSeconds(point.time));
            }
            
            // 计算坐标
            const x = point.xPosition * scale * cvs.width + canvas.x;
            const y = -(point.fp - canvas.fp) * cvs.height * speed * scale;
            
            // 超出可视区域则跳过
            const unNextPoint = this.points[i - 1] ? this.points[i - 1] : this.points[i];
            const unNextPointFp = canvasI[unNextPoint.canvasIndex].speedToFP(tickToSeconds(unNextPoint.time));
            const unNextPointY = -(unNextPointFp - canvasI[unNextPoint.canvasIndex].fp) * cvs.height * speed * scale;
            const offsetY = point.fp - unNextPointFp;
            if (unNextPointY < -1280 * (cvs.height / 640) + offsetY) continue;
            
            // 更新颜色
            point.mixColor = calculateMixedColor(tick, point.color, this.info.lineColor);
            // const { r, g, b, a } = point.mixColor;
            // ctx.fillText([r, g, b, a], x, y)

            if (revelationSize !== 1){
                ctx.save();
                ctx.beginPath();
                ctx.arc(x, y, 5 * scale * (cvs.width / 360), 0, 2 * Math.PI);
                ctx.fillStyle = "black"
                ctx.fill();
                ctx.restore();
            }
            
            // 获取下一个点
            const nextPoint = this.points[i + 1];
            
            // 绘制线条和判断圈
            if (nextPoint) {
                // 初始化下一个点的fp（只做一次）
                if (nextPoint.fp === undefined) {
                    nextPoint.fp = canvasI[nextPoint.canvasIndex].speedToFP(tickToSeconds(nextPoint.time));
                }
                
                // 计算下一个点坐标
                const nextCanvas = canvasI[nextPoint.canvasIndex];
                const x1 = nextPoint.xPosition * scale * cvs.width + nextCanvas.x;
                const y1 = -(nextPoint.fp - nextCanvas.fp) * cvs.height * speed * scale;
                
                // 更新下一个点颜色
                nextPoint.mixColor = calculateMixedColor(nextPoint.time, nextPoint.color, this.info.lineColor);
                // const { r, g, b, a } = nextPoint.mixColor;
                // ctx.fillText([r, g, b, a], x1, y1)
                
                // 超出可视区域则跳过
                if (y1 > cvs.height) continue;
                
                this.drawLine(tick, [point, nextPoint], x, x1, y, y1, scale * (cvs.width / 360));
                this.drawJudgeCircle(tick, [point, nextPoint], x, x1, scale * (cvs.width / 360));
            } else {
                // 单个点的绘制
                this.drawLine(tick, [point, point], x, x, y, y, scale);
                this.drawJudgeCircle(tick, [point, point], x, x, scale);
            }
        }
    }

    drawLine(tick, points, x1, x2, y1, y2, scale) {
        // 避免绘制零长度线段
        if (x1 === x2 && y1 === y2) return;
        
        // 参数验证
        if (!points || points.length < 2 || !easeFuncs) return;
        
        const point0 = points[0];
        const point1 = points[1];
        const easeFunc = easeFuncs[point0.easeType] || easeFuncs[0];
        
        // 计算颜色差值，避免重复计算
        const deltaR = point1.mixColor.r - point0.mixColor.r;
        const deltaG = point1.mixColor.g - point0.mixColor.g;
        const deltaB = point1.mixColor.b - point0.mixColor.b;
        const deltaA = point1.mixColor.a - point0.mixColor.a;
        
        // 计算坐标差值
        const deltaX = x2 - x1;
        const deltaY = y2 - y1;
        
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        
        // 计算步长绘制曲线
        const stepCount = 16;
        const step = 1 / stepCount;
        
        // 缓存当前颜色和位置，减少状态切换
        let currentR = point0.mixColor.r;
        let currentG = point0.mixColor.g;
        let currentB = point0.mixColor.b;
        let currentA = point0.mixColor.a;
        
        // 使用缓存的差值进行计算，减少运算量
        for (let t = step; t < 1; t += step) {
            // 计算颜色
            const colorEase = easeFuncs[0](t);
            currentR = point0.mixColor.r + deltaR * colorEase;
            currentG = point0.mixColor.g + deltaG * colorEase;
            currentB = point0.mixColor.b + deltaB * colorEase;
            currentA = point0.mixColor.a + deltaA * colorEase;
            
            // 计算位置
            const posEase = easeFunc(t);
            const x = x1 + posEase * deltaX;
            const y = y1 + t * deltaY;
            
            ctx.lineTo(x, y);
        }
        
        // 最后一个点
        ctx.lineTo(x2, y2);
        
        // 设置线宽和绘制
        ctx.lineWidth = 3 * scale;
        
        // 创建渐变用于描边，提高性能
        const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
        gradient.addColorStop(0, getRGBAString(point0.mixColor));
        gradient.addColorStop(1, getRGBAString(point1.mixColor));
        ctx.strokeStyle = gradient;
        
        ctx.stroke();
        ctx.restore();
    }

    drawJudgeCircle(tick, points, x1, x2, scale) {
        // 两点相同则无需绘制
        if (points[0] === points[1]) return;
        if (tick < points[0].time) return; // 还没开始
        if (tick >= points[1].time) return; // 已经结束
        
        // 计算时间差，避免除以零
        const timeDiff = points[1].time - points[0].time;
        if (timeDiff <= 0) return;
        
        ctx.save();
        ctx.beginPath();
        
        // 计算当前位置
        const progress = (tick - points[0].time) / timeDiff;
        const easeValue = easeFuncs[points[0].easeType](Math.max(0, Math.min(1, progress))); // 限制在0-1范围
        const x = x1 + easeValue * (x2 - x1);
        const y = 0;
        
        // 绘制判断环
        const judgeRingColor = this.info.judgeRingColor;
        if (judgeRingColor && judgeRingColor.length > 0) {
            // 找到当前应该使用的颜色
            let currentColor = null;
            // for (let i = 0; i < judgeRingColor.length; i++) {
            //     if (tick >= judgeRingColor[i].time) {
            //         currentColor = judgeRingColor[i].startColor;

            //     } else {
            //         break; // 后面的时间更大，无需继续检查
            //     }
            // }
            currentColor = getCurrentLineColor(judgeRingColor, tick); 
            currentColor = calculateMixedColor(tick, currentColor, this.info.lineColor)          
            if (currentColor) {
                ctx.strokeStyle = getRGBAString(currentColor);
                
                // 计算大小（基于缩放）
                const size = 30 * scale;
                const offset = size / 2;
                
                ctx.rect(x - offset, y - offset, size, size);
                ctx.lineWidth = 5 * scale;
                ctx.stroke();
            }
        }
        
        ctx.restore();
    }
}

class note {
    constructor(index, info, lineInfo) {
        this.info = info;
        this.index = index;
        this.lineInfo = lineInfo;
        this.points = lineInfo.linePoints;
        this.findedPoints = this.findPoint(info.time)
        this.fp = findSpeedValue(info.time, canvasI[this.findedPoints[0].canvasIndex].sK);
        // console.log(this.findPoint(info.time)[0], this.fp, info.floorPosition)
        this.otherInformations = info.otherInformations;
        this.isHit = false;
        this.isPlayHit = false;
        this.isBad =false// Math.random() < 0.1;
    }
    findPoint(tick) {
        let left = 0;
        let right = this.points.length - 1;
        let targetIndex = right;
        
        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            const midTime = this.points[mid].time;
            
            if (midTime <= tick) {
                targetIndex = mid;
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }
        
        return [this.points[targetIndex], this.points[targetIndex + 1] || this.points[targetIndex]];//.xPosition * cameraScale(tick) * cvs.width + canvasI[this.points[targetIndex].canvasIndex].x;
    }
    drawNote(tick) {
        // 早期返回条件检查
        if (this.isHit === true && tick > this.info.time && this.info.type !== 2) return;
        if (this.isHit === true && this.info.type === 2 && tick >= this.otherInformations[0] + 0.5) return;
        
        // **** 关键修复：在最开始保存上下文状态 ****
        ctx.save();
        
        const point = this.findedPoints[0];
        const nextPoint = this.findedPoints[1];
        const canvas = canvasI[point.canvasIndex];
        const nextCanvas = canvasI[nextPoint.canvasIndex];
        const scale = cameraScale(tick);
        const pointX = point.xPosition * scale * cvs.width + canvas.x;
        const nextPointX = nextPoint.xPosition * scale * cvs.width + nextCanvas.x;
        
        const easeValue = easeFuncs[point.easeType](
            (this.info.time - point.time) / (nextPoint.time - point.time)
        );
        let x = pointX + (easeValue * (nextPointX - pointX));
        
        if (this.info.time === point.time) x = pointX;
        if (this.info.time === nextPoint.time) x = nextPointX;
        
        if (this.info.type === 2 && tick >= this.info.time) {
            const easeV = easeFuncs[point.easeType](
                (tick - point.time) / (nextPoint.time - point.time)
            );
            x = pointX + (easeV * (nextPointX - pointX));
        }
        
        // 击打逻辑
        if (this.isHit === false && this.isPlayHit === false && tick >= this.info.time) {
            hitI.push(new hit(tick, x, this.isBad));
            if (!this.isBad) playSound(this.info.type);
            this.isPlayHit = true;
        }
        
        // 状态更新
        if (tick < this.info.time) {
            this.isHit = false;
            this.isPlayHit = false;
        } else {
            this.isHit = true;
        }
        
        // 计算Y坐标
        let y = -(this.fp - canvas.fp) * cvs.height * speed * cameraScale(tick);
        if (y < -cvs.height) {
            ctx.restore(); // 提前返回时也要恢复状态
            return;
        }
        
        // Hold音符特殊处理
        if (this.info.type === 2 && tick >= this.info.time && tick <= this.otherInformations[0] + 0.5) {
            y = 0;
        }
        
        // **** 颜色计算和绘制头部 ****
        const challengeTimeIndex = getChallengeTimeIndex(tick);
        let color = challengeTimeIndex === -1 
            ? chart.themes[0].colorsList[1] 
            : chart.themes[challengeTimeIndex].colorsList[1];
        
        // 尺寸计算
        const wh = (this.info.type === 2 || this.info.type === 1)
            ? 18 * scale * this.getHoldHeadScale(tick, this.info.type) * (cvs.width / 360)
            : 20 * scale * this.getHoldHeadScale(tick, this.info.type) * (cvs.width / 360);
        const offset = wh / 2;
        
        // 动态X计算（用于拖动中的Hold）
        if (tick > this.info.time) {
            const dynamicPoint = this.findPoint(tick);
            const point1 = dynamicPoint[0];
            const point2 = dynamicPoint[1];
            const canvas1 = canvasI[point1.canvasIndex];
            const canvas2 = canvasI[point2.canvasIndex];
            const dynamicEase = easeFuncs[point1.easeType](
                (tick - point1.time) / (point2.time - point1.time)
            );
            const x1 = point1.xPosition * scale * cvs.width + canvas1.x;
            const x2 = point2.xPosition * scale * cvs.width + canvas2.x;
            x = x1 + (dynamicEase * (x2 - x1));
        }
        
        // **** 绘制音符头 ****
        ctx.beginPath();
        ctx.rect(x - offset, y - offset, wh, wh);
        
        // 设置颜色：Hold和Drag音符头为白色
        ctx.fillStyle = getRGBAString(color);
        if (this.info.type === 1 || this.info.type === 2) {
            ctx.fillStyle = "white"; // 你的白色设置在这里生效
        }
        
        ctx.strokeStyle = "black";
        ctx.lineWidth = 3 * scale * (cvs.width / 360);
        ctx.fill();
        ctx.stroke();
        
        // **** 绘制Hold身体（在restore之前） ****
        if (this.info.type === 2) {
            // drawHoldBody 内部有自己的 save/restore，不会污染外部状态
            this.drawHoldBody(tick, x, y, scale, color);
        }
        
        // **** 关键修复：在最后恢复上下文状态 ****
        ctx.restore();
    }
    
    // 辅助方法保持不变
    drawHoldBody(tick, x, y, scale, color) {
        if (tick > this.otherInformations[0]) return;
        
        // Hold身体内部独立的save/restore
        ctx.save();
        
        const otherInformations = this.otherInformations;
        const endFp = findSpeedValue(otherInformations[0], canvasI[otherInformations[1]].sK);
        const endY = (canvasI[otherInformations[1]].fp - endFp) * cvs.height * speed * scale;
        
        const h = endY - y;
        const w = 10 * scale * (cvs.width / 360);
        const offset = w / 2;
        const offsetY = 10 * scale * (cvs.height / 640);
        
        ctx.beginPath();
        ctx.rect(x - offset, y - offsetY, w, h);
        
        ctx.fillStyle = getRGBAString(color); // 身体使用主题色
        ctx.strokeStyle = "black";
        ctx.lineWidth = 3 * scale * (cvs.width / 360);
        
        ctx.fill();
        ctx.stroke();
        ctx.restore(); // 恢复Hold身体绘制前的状态
    }
    
    getHoldHeadScale(tick, type) {
        if (type !== 2) return 1
        const otherInformations = this.otherInformations;
        if (tick < otherInformations[0]) return 1
        if (tick >= otherInformations[0] && tick <= otherInformations[0] + 0.5) {
            const easeValue = easeFuncs[1]((tick - otherInformations[0]) / 0.5)
            return 1 - easeValue
        }
    }
}

class hit {
    constructor(tick, x, isBad) {
        this.x = x;
        this.timer = tickToSeconds(tick)
        const challengeTimeIndex = getChallengeTimeIndex(tick)
        if (challengeTimeIndex === -1) {
            this.color = chart.themes[0].colorsList[2]
        }else {
            this.color = chart.themes[challengeTimeIndex].colorsList[2]
        }
        this.colorStr = getRGBAString(this.color)
        if (isBad) this.colorStr = "black"
        this.size = 0
        this.lineWidth = 0
        this.blockCount = Math.floor(Math.random() * 2) + 3
        this.blocksR = []
        this.blocksD = []
        this.blockS = []
        for (let i = 0; i < this.blockCount; i++) {
            this.blocksR.push(Math.floor(Math.random() * 361))
            this.blocksD.push(1)
            this.blockS.push(Math.floor(Math.random() * 20) + 10)
        }
        this.t = 0
        if (challengeTimeIndex === -1) return
        this.rBOffset = []
        this.rBS = []
        for (let i = 0; i < Math.floor(Math.random() * 5) + 1; i++) {
            this.rBOffset.push(Math.random() * 440)
            this.rBS.push(Math.floor(Math.random() * 10) + 10)
        }
    }
    draw(tick) {
        ctx.save();
        ctx.beginPath();
        const scale = cameraScale(tick)
        const timer = tickToSeconds(tick)
        this.t = (timer - this.timer) / 0.5
        const easeValue = easeFuncs[11](this.t)
        this.size = 30 + 70 * easeValue * (cvs.width / 360)
        // this.color.a = 255 - (255 * easeValue)
        // this.colorStr = getRGBAString(this.color)
        ctx.strokeStyle = this.colorStr
        ctx.lineWidth = (30 - (30 * easeValue)) * scale * (cvs.width / 360)
        ctx.rect(this.x - (this.size * scale) / 2, 0 - (this.size * scale) / 2, this.size * scale, this.size * scale);
        ctx.stroke()
        ctx.restore();
        this.drawBlock(tick, this.x, 0, scale, this.color)
        if (this.rBOffset) this.drawRiztimeBolock(tick, this.x, 0, scale, this.color)
    }
    drawBlock(tick, x, y, scale, color) {
        for (let i = 0; i < this.blockCount; i++) {
            const angle = this.blocksR[i] * Math.PI / 180
            const wh = this.blockS[i] * scale * (cvs.width / 360)
            const offset = wh / 2
            const blockOffset = easeFuncs[11](this.t) * 100 * scale * (cvs.width / 360)
            const x1 = x + blockOffset * Math.cos(angle) - offset
            const y1 = y + blockOffset * Math.sin(angle) - offset
            const blockSizeAndD = easeFuncs[10](this.t)
            color.a = 255 - (255 * blockSizeAndD)
            ctx.save();
            ctx.beginPath();
            ctx.fillStyle = getRGBAString(color)
            ctx.rect(x1 + (wh * blockSizeAndD) / 2, y1 + (wh * blockSizeAndD) / 2 , wh - wh * blockSizeAndD, wh - wh * blockSizeAndD);
            ctx.fill();
            ctx.restore();
        }
    }
    drawRiztimeBolock(tick, x, y, scale, color) {
        for (let i = 0; i < this.rBOffset.length; i++) {
            const wh = this.rBS[i] * scale * (cvs.width / 360)
            const offset = wh / 2
            const blockOffset = easeFuncs[11](this.t) * this.rBOffset[i] * scale * (cvs.width / 360)
            const y1 = -(blockOffset - offset)
            const blockSizeAndD = easeFuncs[10](this.t)
            color.a = 255 - (255 * blockSizeAndD)
            ctx.save();
            ctx.beginPath();
            ctx.fillStyle = getRGBAString(color)
            ctx.rect(x + (wh * blockSizeAndD) / 2, y1 + (wh * blockSizeAndD) / 2, wh - wh * blockSizeAndD, wh - wh * blockSizeAndD);
            ctx.fill();
            ctx.restore();
        }
    }
}

function drawAutoHand(){
    if (isDrawAutoHand === false) return
    ctx.save();
    ctx.beginPath();
    ctx.font = `${50 * (cvs.width / 360)}px Arial`;
    // const scale = cameraScale(tick)
    const x = autoHandData[0] ?? autoHandDataTemp
    autoHandDataTemp = autoHandData[0] ?? autoHandDataTemp
    const y = 0
    ctx.fillText("🖕", x - ctx.measureText("🖕").width / 2, y + ctx.measureText("🖕").actualBoundingBoxAscent / 2)
    ctx.restore();
    autoHandData.splice(0, 1)

}

function drawRevelationInfo(tick) {
    if (revelationSize === 1) return
    function drawText(text, x, y) {
        ctx.save();
        ctx.beginPath();
        ctx.font = `${12 * (cvs.width / 360)}px rizline`;
        ctx.strokeStyle = "white"
        ctx.lineWidth = 0.5 * (cvs.width / 360)
        // ctx.textAlign = "center";
        // ctx.textBaseline = "middle";
        ctx.strokeText(text, x, y)
        ctx.fillText(text, x, y)
    }
    let text = `Canvas count: ${canvasI.length}`
    let w = ctx.measureText(text).width
    let x = -170 * (cvs.width / 360)
    let y = -cvs.height / 2 - 170 * (cvs.height / 640)
    drawText(text, x, y)
    let h = ctx.measureText(text).actualBoundingBoxAscent + 6 * (cvs.width / 360)
    let moveCount = 0
    let speedCount = 0
    for (let i = 0; i < canvasI.length; i++) {
        const canvas = canvasI[i]
        moveCount += canvas.xM.length
        speedCount += canvas.sK.length
    }
    text = `Canvas move event count: ${moveCount}`
    w = ctx.measureText(text).width
    y = y + h
    drawText(text, x, y)
    text = `Canvas speed event count: ${speedCount}`
    w = ctx.measureText(text).width
    y = y + h
    drawText(text, x, y)
    text = `Line count: ${chart.lines.length}`
    w = ctx.measureText(text).width
    y = y + h
    drawText(text, x, y)
    let pointCount = 0
    for (let i = 0; i < chart.lines.length; i++) {
        const line = chart.lines[i]
        pointCount += line.linePoints.length
    }
    text = `Point count: ${pointCount}`
    w = ctx.measureText(text).width
    y = y + h
    drawText(text, x, y)
    text = `Note count: ${noteI.length}`
    w = ctx.measureText(text).width
    y = y + h
    drawText(text, x, y)
    text = `Camera scale: ${cameraScale(tick) / revelationSize}`
    w = ctx.measureText(text).width
    y = y + h
    drawText(text, x, y)
    text = `Revelation scale: ${revelationSize}`
    w = ctx.measureText(text).width
    y = y + h
    drawText(text, x, y)
    text = `Camera scale event count: ${chart.cameraMove.scaleKeyPoints.length}`
    w = ctx.measureText(text).width
    y = y + h
    drawText(text, x, y)
    text = `Camera move event count: ${chart.cameraMove.xPositionKeyPoints.length}`
    w = ctx.measureText(text).width
    y = y + h
    drawText(text, x, y)
    text = `Camera X: ${cameraMoveX(tick)}`
    w = ctx.measureText(text).width
    y = y + h
    drawText(text, x, y)
    text = `Challange time count: ${chart.challengeTimes.length}`
    w = ctx.measureText(text).width
    y = y + h
    drawText(text, x, y)
    text = `Speed: ${speedValue}`
    w = ctx.measureText(text).width
    y = y + h
    drawText(text, x, y)
    
}

function start() {
    let canSendScreen = false
    const audio = document.getElementById("bgm");
    for (let i = 0; i < chart.canvasMoves.length; i++) {
        canvasI.push(new canvas(i));
    }
    for (let i = 0; i < chart.lines.length; i++) {
        lineI.push(new line(i, chart.lines[i]));
        for (let j = 0; j < chart.lines[i].notes.length; j++) {
            for (let k = 0; k < 1; k++) {
                const noteJ = chart.lines[i].notes[j]
                if (noteJ.otherInformations !== undefined && noteJ.otherInformations.length !== 0){
                   noteJ.otherInformations[0] = noteJ.otherInformations[0]// + (0.01*k)
                }
                noteJ.time = noteJ.time// + (0.01*k)
                noteI.push(new note(j, noteJ, chart.lines[i]));
            }
        }
    }
    audio.play();
    // const time1 = new Date()
    const data = {
        type: "audio",
        data: audio.src
    }
    const recorderDiv = document.getElementById("recorder")
    const ws = new WebSocket('ws://localhost:8085');
    ws.onopen = () => {
        audio.pause()
        console.log('ws open')
        cvs.style.display = "none"
        recorderDiv.innerText = "解析音频中..."
        ws.send(JSON.stringify(data))
        const hitData = []
        for (let i = 0; i < noteI.length; i++) {
            const note = noteI[i]
            hitData.push({
                type: note.info.type,
                time: tickToSeconds(note.info.time),
            })
        }
        hitData.sort((a, b) => a.time - b.time)
        data.type = "hit"
        data.data = hitData
        recorderDiv.innerText = "混合音效中..."
        ws.send(JSON.stringify(data))
        data.type = "screen"
        data.data = cvs.toDataURL()
        ws.send(JSON.stringify(data))
    }
    ws.onmessage = (event) => {
        if (event.data === "ok") {
            canSendScreen = true
        }
    }
    function recorder() {
        if (canSendScreen === false) return
        if (audio.currentTime >= audio.duration) {
            data.type = "msg"
            data.data = "stop"
            ws.send(JSON.stringify(data))
            ws.close()
            return
        }
        data.type = "screen"
        data.data = cvs.toDataURL()
        ws.send(JSON.stringify(data))
        audio.currentTime += 1 / 60
        recorderDiv.innerText = `正在渲染 ${(audio.currentTime / audio.duration * 100).toFixed(2)}%`
    }
    function update() {
        ctx.clearRect(-cvs.width / 2, -cvs.height / 2 - 200 * (cvs.height / 640), cvs.width, cvs.height);
        const timer = audio.currentTime;
        const tick = secondsToTick(timer);
        drawBackground(tick);
        for (let i = 0; i < canvasI.length; i++) {
            canvasI[i].updated(tick);
        }
        for (let i = 0; i < lineI.length; i++) {
            lineI[i].updatePoints(tick);
        }
        for (let i = 0; i < noteI.length; i++) {
            noteI[i].drawNote(tick);
        }
        drawCover(tick);
        for (let i = 0; i < hitI.length; i++) {
            if (timer > hitI[i].timer + 0.5) {
                hitI.splice(i, 1);
                i--;
                continue
            }
            if (hitI[i].t < 0) {
                hitI.splice(i, 1);
                i--;
                continue
            }
            hitI[i].draw(tick);
        }
        drawCombo();
        drawScreenBoard()
        drawShuiYin()
        drawRevelationInfo(tick)
        for (let i = 0; i < msgBoxI.length; i++) {
            if (timer > msgBoxI[i].time + msgBoxI[i].holdTime + msgBoxI[i].transitionTime) {
                msgBoxI.splice(i, 1);
                i--;
                continue
            }
            for (let j = i + 1; j < msgBoxI.length; j++) {
                if (msgBoxI[j].show === false) continue;
                if (msgBoxI[j].show === true) {
                    msgBoxI[i].holdTime = 0
                    break;
                }else {
                    break;
                }
            }
            msgBoxI[i].draw(timer);
        }
        for (let i = 0; i < screenShortI.length; i++) {
            if (timer > screenShortI[i].time + screenShortI[i].holdTime + screenShortI[i].transitionTime) {
                screenShortI.splice(i, 1);
                i--;
                continue
            }
            for (let j = i + 1; j < screenShortI.length; j++) {
                if (screenShortI[j].show === false) continue;
                if (screenShortI[j].show === true) {
                    screenShortI[i].holdTime = 0
                    break;
                }else {
                    break;
                }
            }
            screenShortI[i].draw(timer);
        }
        // drawAutoHand()
        
        recorder()
        // 更新 FPS
        const now = performance.now();
        frameCount++;
        if (now - lastTime >= 1000) {
            document.getElementById('fps').textContent = 'FPS: ' + frameCount;
            frameCount = 0;
            lastTime = now;
        }
        requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}