var canvasI = []
var lineI = []
var noteI = []
var hitI = []

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
    if (challengeTimesIndex !== -1) {
        ctx.save();
        const color = themes[challengeTimesIndex].colorsList[0];
        ctx.beginPath();
        ctx.fillStyle = "rgba(" + color.r + "," + color.g + "," + color.b + "," + color.a + ")";
        ctx.fillRect(-cvs.width / 2, -cvs.height / 2 - 200, cvs.width, cvs.height);
        ctx.restore();
        return;
    }
    const color = themes[0].colorsList[0];
    ctx.save();
    ctx.beginPath();
    ctx.fillStyle = "rgba(" + color.r + "," + color.g + "," + color.b + "," + color.a + ")";
    ctx.fillRect(-cvs.width / 2, -cvs.height / 2 - 200, cvs.width, cvs.height);
    ctx.restore();
}
function drawCover(tick) {
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
        ctx.fillRect(-cvs.width / 2, -cvs.height / 2 - (170 + (30 * i)), cvs.width, 30);
        ctx.fillRect(-cvs.width / 2, -cvs.height / 2 - (230 - (30 * i)) + cvs.height - 70, cvs.width, 30);
    }
    ctx.fill();
    ctx.restore();
}

function cameraScale(tick) {
    const scaleList = chart.cameraMove.scaleKeyPoints;
    const value = findValue(tick, scaleList);
    return value;
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

/**
 * 混合两种颜色
 * @param {Object} color1 - 第一种颜色 {r, g, b, a}
 * @param {Object} color2 - 第二种颜色 {r, g, b, a}
 * @returns {Object} 混合后的颜色
 */
function mixColor({ r: r1, g: g1, b: b1, a: a1 }, { r: r2, g: g2, b: b2, a: a2 }) {
  // 边界情况处理
  if (a2 === 0) return { r: r1, g: g1, b: b1, a: a1 };
  if (a2 === 255) return { r: r2, g: g2, b: b2, a: a1 };
  
  // 计算混合比例并应用
  const mixRatio = a2 / 255;
  return { 
    r: Math.round(r1 + (r2 - r1) * mixRatio), 
    g: Math.round(g1 + (g2 - g1) * mixRatio), 
    b: Math.round(b1 + (b2 - b1) * mixRatio), 
    a: a1 
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

  // 转换为时间片段结构
  const colorSegments = lineColor.map((segment, index) => {
    const nextSegment = lineColor[index + 1];
    return {
      startSeconds: segment.time,
      endSeconds: nextSegment ? nextSegment.time : segment.time,
      startColor: segment.startColor,
      endColor: segment.endColor
    };
  });

  // 调用通用的时间颜色插值函数
  return getCurrentColor(colorSegments, tick);
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
        ctx.font = "20px rizline";
        ctx.fillText(this.index, this.x, 20);
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
            if (y < -1280) continue;
            
            // 更新颜色
            point.mixColor = calculateMixedColor(tick, point.color, this.info.lineColor);
            
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
                
                // 超出可视区域则跳过
                if (y1 > 640) continue;
                
                this.drawLine(tick, [point, nextPoint], x, x1, y, y1, scale);
                this.drawJudgeCircle(tick, [point, nextPoint], x, x1, scale);
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
        
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = getRGBAString(points[0].mixColor);
        ctx.moveTo(x1, y1);
        
        // 计算步长绘制曲线
        const stepCount = 16;
        const step = 1 / stepCount;
        for (let t = 0; t < 1; t += step) {
            // try {
            //     easeFuncs[points[0].easeType](t);
            // }catch(e){
            //     console.log(`不支持的缓动：${points[0].easeType}`, "位于：", points[0], "将视为0")
            //     points[0].easeType = 0
            // }
            const ease = easeFuncs[points[0].easeType](t);
            const x = x1 + ease * (x2 - x1);
            const y = y1 + t * (y2 - y1);
            ctx.lineTo(x, y);
        }
        
        ctx.lineTo(x2, y2);
        ctx.lineWidth = 3 * scale;
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
        if (this.isHit === true && this.info.type!== 2) return;
        if (this.isHit === true && this.info.type === 2 && tick >= this.otherInformations[0] + 0.5) return;
        // this.findedPoints = this.findPoint(this.info.time)
        const point = this.findedPoints[0];
        const nextPoint = this.findedPoints[1];
        const canvas = canvasI[point.canvasIndex];
        const nextCanvas = canvasI[nextPoint.canvasIndex];
        // this.fp = this.info.floorPosition//findSpeedValue(this.info.time, canvas.sK)
        const scale = cameraScale(tick)
        const pointX = point.xPosition * scale * cvs.width + canvas.x;
        const nextPointX = nextPoint.xPosition * scale * cvs.width + nextCanvas.x;
        const easeValue = easeFuncs[point.easeType]((this.info.time - point.time) / (nextPoint.time - point.time))
        let x = pointX + (easeValue * (nextPointX - pointX));
        if (this.info.time === point.time) {
            x = pointX;
        }
        if (this.info.time === nextPoint.time) {
            x = nextPointX;
        }
        if (this.info.type === 2) {
            if (tick >= this.info.time) {
                const easeV = easeFuncs[point.easeType]((tick - point.time) / (nextPoint.time - point.time))
                x = pointX + (easeV * (nextPointX - pointX));
            }
        }
        if (this.isHit === false && this.isPlayHit === false && tick >= this.info.time) {
            playSound(this.info.type);
            hitI.push(new hit(tick, x))
            this.isPlayHit = true;
        }
        if (tick < this.info.time) {
            this.isHit = false;
            this.isPlayHit = false;
        }else {
            this.isHit = true;
        }
        let y = -(this.fp - canvas.fp) * cvs.height * speed * cameraScale(tick);
        if (y < -cvs.height) return;
        if (this.info.type === 2) if (tick >= this.info.time && tick <= this.otherInformations[0] + 0.5) y = 0;
        ctx.save();
        ctx.beginPath();
        const challengeTimeIndex = getChallengeTimeIndex(tick)
        let color
        if (challengeTimeIndex === -1) {
            color = chart.themes[0].colorsList[1]
        }else {
            color = chart.themes[challengeTimeIndex].colorsList[1]
        }
        const wh = 20 * scale * this.getHoldHeadScale(tick, this.info.type)
        const offset = wh / 2;
        ctx.fillStyle = getRGBAString(color);
        if (this.info.type === 1) ctx.fillStyle = "white"
        ctx.strokeStyle = "black"
        ctx.lineWidth = 3 * scale;
        ctx.rect(x - offset, y - offset, wh, wh);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        if (this.info.type === 2) this.drawHoldBody(tick, x, y, scale, color)
    }
    drawHoldBody(tick, x, y, scale, color) {
        ctx.save();
        const otherInformations = this.otherInformations;
        const endFp = otherInformations[2] //findSpeedValue(otherInformations[0], canvasI[otherInformations[1]].sK);
        const endY = (endFp - canvasI[otherInformations[1]].fp) * cvs.height * speed * scale;
        const h = -(endY - y) * speed * scale * 6.5;
        const w = 10 * scale;
        const offset = w / 2;
        const offsetY = 10 * scale;
        const midY = y + h / 8;
        const quarterY = y + h / 16;
        if (tick >= otherInformations[0]) {
            ctx.restore()
            return
        }
        
        const fillGradient = ctx.createLinearGradient(x - offset, quarterY, x - offset, midY);
        fillGradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 1)`);
        fillGradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);
        
        const borderGradient = ctx.createLinearGradient(x - offset, y, x - offset, midY);
        borderGradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
        borderGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = fillGradient;
        ctx.fillRect(x - offset, y - offsetY, w, h);
        
        ctx.strokeStyle = borderGradient;
        ctx.lineWidth = 3;
        ctx.strokeRect(x - offset, y - offsetY, w, h);
        ctx.restore();
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
    constructor(tick, x) {
        this.x = x;
        this.timer = tickToSeconds(tick)
        const challengeTimeIndex = getChallengeTimeIndex(tick)
        if (challengeTimeIndex === -1) {
            this.color = chart.themes[0].colorsList[2]
        }else {
            this.color = chart.themes[challengeTimeIndex].colorsList[2]
        }
        this.colorStr = getRGBAString(this.color)
        this.size = 0
        this.lineWidth = 0
        this.blockCount = Math.floor(Math.random() * 2) + 3
        this.blocksR = []
        this.blocksD = []
        this.blockS = []
        for (let i = 0; i < this.blockCount; i++) {
            this.blocksR.push(Math.floor(Math.random() * 361))
            this.blocksD.push(1)
            this.blockS.push(Math.floor(Math.random() * 21) + 10)
        }
    }
    draw(tick) {
        ctx.save();
        ctx.beginPath();
        const scale = cameraScale(tick)
        const timer = tickToSeconds(tick)
        const easeValue = easeFuncs[11]((timer - this.timer) / 0.5)
        this.size = 100 * easeValue
        // this.color.a = 255 - (255 * easeValue)
        // this.colorStr = getRGBAString(this.color)
        ctx.strokeStyle = this.colorStr
        ctx.lineWidth = 40 - (40 * easeValue) * scale
        ctx.rect(this.x - (this.size * scale) / 2, 0 - (this.size * scale) / 2, this.size * scale, this.size * scale);
        ctx.stroke()
        ctx.restore();
        this.drawBlock(tick, this.x, 0, scale, this.color)
    }
    drawBlock(tick, x, y, scale, color) {
        for (let i = 0; i < this.blockCount; i++) {
            const angle = this.blocksR[i] * Math.PI / 180
            const wh = this.blockS[i] * scale
            const offset = wh / 2
            const blockOffset = easeFuncs[11]((tickToSeconds(tick) - this.timer) / 0.5) * 100 * scale
            const x1 = x + blockOffset * Math.cos(angle) - offset
            const y1 = y + blockOffset * Math.sin(angle) - offset
            const blockSizeAndD = easeFuncs[10]((tickToSeconds(tick) - this.timer) / 0.5)
            color.a = 255 - (255 * blockSizeAndD)
            ctx.save();
            ctx.beginPath();
            ctx.fillStyle = getRGBAString(color)
            ctx.rect(x1 + (wh * blockSizeAndD) / 2, y1 + (wh * blockSizeAndD) / 2 , wh - wh * blockSizeAndD, wh - wh * blockSizeAndD);
            ctx.fill();
            ctx.restore();
        }
    }
}

function start() {
    const audio = document.getElementById("bgm");
    for (let i = 0; i < chart.canvasMoves.length; i++) {
        canvasI.push(new canvas(i));
    }
    for (let i = 0; i < chart.lines.length; i++) {
        lineI.push(new line(i, chart.lines[i]));
        for (let j = 0; j < chart.lines[i].notes.length; j++) {
            noteI.push(new note(j, chart.lines[i].notes[j], chart.lines[i]));
        }
    }
    audio.play();
    function update() {
        ctx.clearRect(-cvs.width / 2, -cvs.height / 2 - 200, cvs.width, cvs.height);
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
            hitI[i].draw(tick);
        }
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