var canvasI = []
var lineI = []
var noteI = []
var speed = 10

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

// // ✅ 示例使用
// const bpmShifts = [
//     { time: 0, value: 1, floorPosition: 0 },
//     { time: 33, value: 1.46, floorPosition: 13.2 },
//     { time: 73, value: 1.2, floorPosition: 24.1589 },
//     // ... 其他点
// ];

// console.log(secondsToTick(10, bpmShifts)); // 输出对应 tick

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

// function mixColors(color1, color2, ratio = 0.5) {
//     // // 确保输入的颜色数组是有效的
//     // if (!Array.isArray(color1) || !Array.isArray(color2) || color1.length !== 4 || color2.length !== 4) {
//     //     throw new Error("Invalid color array format. Expected [r, g, b, a]");
//     // }

//     // 提取颜色分量
//     const [r1, g1, b1, a1] = color1;
//     const [r2, g2, b2, a2] = color2;

//     // 计算混合后的颜色分量
//     const r = Math.round(r1 * (1 - ratio) + r2 * ratio);
//     const g = Math.round(g1 * (1 - ratio) + g2 * ratio);
//     const b = Math.round(b1 * (1 - ratio) + b2 * ratio);
//     const a = a1 * (1 - ratio) + a2 * ratio;

//     // 返回混合后的颜色数组
//     return [r, g, b, a];
// }
/**
 * 将两个 RGBA 颜色（0–255 整数）按源色（c2）的 alpha 做一次 Alpha 合成。
 *
 * @param {number[]} c1 背景 RGBA，[r, g, b, a]，各分量 0–255 整数。
 * @param {number[]} c2 前景 RGBA，[r, g, b, a]，各分量 0–255 整数。
 * @returns {[number, number, number, number]} 合成后的 RGBA，四舍五入为 0–255 整数。
 */
function mixColors(c1, c2) {
  const a2 = c2[3] / 255;            // 把前景 alpha 转成 0–1
  const ia = 1 - a2;                 // 背景的权重
  return [
    Math.round(c1[0] * ia + c2[0] * a2),
    Math.round(c1[1] * ia + c2[1] * a2),
    Math.round(c1[2] * ia + c2[2] * a2),
    c1[3]                            // 背景 alpha 保持不变
  ];
}

// // 示例用法
// const color1 = [255, 0, 0, 0.5]; // 红色半透明
// const color2 = [0, 0, 255, 0.5]; // 蓝色半透明
// const mixedColor = mixRGBAArray(color1, color2, 0.5); // 混合比例为 0.5
// console.log(mixedColor); // 输出混合后的颜色数组
// function mixColors(lineColorArray, linePointArray) {
//     // 线性混合函数
//     function mix(start, end, alpha) {
//         return start + (end - start) * alpha;
//     }

//     // 解构颜色数组
//     const [lineR, lineG, lineB, lineA] = lineColorArray;
//     const [pointR, pointG, pointB, pointA] = linePointArray;

//     // 混合 RGB 通道，保留 LinePoint 的 A 通道
//     const finalR = mix(pointR, lineR, pointA / 255);
//     const finalG = mix(pointG, lineG, pointA / 255);
//     const finalB = mix(pointB, lineB, pointA / 255);
//     const finalA = pointA; // 保留 LinePoint 的透明度

//     return [finalR, finalG, finalB, finalA];
// }
// function mixColors(lineColor, linePointColors) {
//     // 确保两个颜色数组的长度相等
//     if (lineColor.length !== 4 || linePointColors.length !== 4) {
//         throw new Error("Color arrays must have 4 elements (RGBA)");
//     }

//     // 提取 RGBA 通道值
//     const B = lineColor; // 基础颜色
//     const C = linePointColors; // 局部颜色

//     // 混合计算
//     const mixedColor = [
//         ((B[0] * B[3] + C[0] * (255 - B[3])) / (255 * 2)) * (C[3] / 255) * 255,
//         ((B[1] * B[3] + C[1] * (255 - B[3])) / (255 * 2)) * (C[3] / 255) * 255,
//         ((B[2] * B[3] + C[2] * (255 - B[3])) / (255 * 2)) * (C[3] / 255) * 255,
//         C[3] // alpha 通道直接取 linePointColors 的 alpha
//     ];

//     // 确保颜色值在 0 到 255 之间
//     // mixedColor[0] = Math.min(255, Math.max(0, mixedColor[0]));
//     // mixedColor[1] = Math.min(255, Math.max(0, mixedColor[1]));
//     // mixedColor[2] = Math.min(255, Math.max(0, mixedColor[2]));
//     // mixedColor[3] = Math.min(255, Math.max(0, mixedColor[3]));

//     return mixedColor;
// }

// function mixColors(a, b) {
//     if (b[3] <= 0) return [...a];
//     if (b[3] >= 255) return [...b.slice(0, 3), a[3]];
//     const alphaFactor = b[3] / 255;
//     return [
//         a[0] + (b[0] - a[0]) * alphaFactor,
//         a[1] + (b[1] - a[1]) * alphaFactor,
//         a[2] + (b[2] - a[2]) * alphaFactor,
//         a[3]
//     ];
// }

function cameraScale(tick){
    const scaleList = chart.cameraMove.scaleKeyPoints
    if (scaleList.length === 1){
        if (tick >= scaleList[0].time){
            return scaleList[0].value;
        }
    }
    for (let i = 0; i < scaleList.length; i++) {
        if(! scaleList[i + 1]) return scaleList[i].value
        if (tick >= scaleList[i].time && tick < scaleList[i + 1].time) {
            const ease = scaleList[i].easeType;
            const v1 = scaleList[i].value;
            const v2 = scaleList[i + 1].value;
            return easeFuncs[ease]((tick - scaleList[i].time) / (scaleList[i + 1].time - scaleList[i].time)) * (v2 - v1) + v1;
        }
    }
}

function cameraMoveX(tick){
    const xPositionList = chart.cameraMove.xPositionKeyPoints
    if (xPositionList.length === 1){
        if (tick >= xPositionList[0].time){
            return xPositionList[0].value * cvs.width;
        }
    }
    for (let i = 0; i < xPositionList.length; i++) {
        if(! xPositionList[i + 1]) return xPositionList[i].value * cvs.width
        if (tick >= xPositionList[i].time && tick < xPositionList[i + 1].time) {
            const ease = xPositionList[i].easeType;
            const x1 = xPositionList[i].value * cvs.width;
            const x2 = xPositionList[i + 1].value * cvs.width;
            return easeFuncs[ease]((tick - xPositionList[i].time) / (xPositionList[i + 1].time - xPositionList[i].time)) * (x2 - x1) + x1;
        }
    }
}

function drawBackground(tick) {
    for(let i = 0; i < chart.challengeTimes.length; i++){
        const challengeTime = chart.challengeTimes[i];
        if (tick >= challengeTime.start && tick < challengeTime.end){
            const theme = chart.themes[1]
            const color = theme.colorsList[0]
            ctx.save()
            ctx.beginPath();
            ctx.fillStyle = "rgba(" + color.r + "," + color.g + "," + color.b + "," + color.a + ")";
            ctx.fillRect(-cvs.width / 2, -cvs.height / 2 - 200, cvs.width, cvs.height);
            ctx.restore()
            return
        }
    }
    const theme = chart.themes[0]
    const color = theme.colorsList[0]
    ctx.save()
    ctx.beginPath();
    ctx.fillStyle = "rgba(" + color.r + "," + color.g + "," + color.b + "," + color.a + ")";
    ctx.fillRect(-cvs.width / 2, -cvs.height / 2 - 200, cvs.width, cvs.height);
    ctx.restore()
}

class canvas {
    constructor(index, cM) {
        this.index = index;
        this.cM = cM;
        this.x = 0;
        this.moveXIndex = 0;
        this.speedIndex = 0;
        this.fp = 0;
    }
    move(tick){
        const xPositionKeyPoints = this.cM.xPositionKeyPoints;
        if (xPositionKeyPoints.length === 1){
            if (tick >= xPositionKeyPoints[0].time){
                this.x = xPositionKeyPoints[0].value * cvs.width;
            }
        }else {
            if (this.moveXIndex >= xPositionKeyPoints.length - 1){
                this.moveXIndex = xPositionKeyPoints.length - 1;
                this.x = xPositionKeyPoints[this.moveXIndex].value * cvs.width;
                return;
            }
            if (tick >= xPositionKeyPoints[this.moveXIndex].time && tick < xPositionKeyPoints[this.moveXIndex + 1].time){
                const ease = xPositionKeyPoints[this.moveXIndex].easeType;
                const x1 = xPositionKeyPoints[this.moveXIndex].value * cvs.width;
                const x2 = xPositionKeyPoints[this.moveXIndex + 1].value * cvs.width;
                const easeValue = easeFuncs[ease]((tick - xPositionKeyPoints[this.moveXIndex].time) / (xPositionKeyPoints[this.moveXIndex + 1].time - xPositionKeyPoints[this.moveXIndex].time))
                this.x = x1 + (x2 - x1) * easeValue;
            }else {
                this.moveXIndex++
            }
        }
        // this.x -= cameraMoveX(tick)
    }
    speed(timer){
        const speedKeyPoints = this.cM.speedKeyPoints;
        // this.fp = 0
        const fp = speedKeyPoints[this.speedIndex].floorPosition;
        const v = speedKeyPoints[this.speedIndex].value;
        const t = tickToSeconds(speedKeyPoints[this.speedIndex].time);
        if (speedKeyPoints.length === 1 || this.speedIndex >= speedKeyPoints.length - 1){
            const t2 = tickToSeconds(speedKeyPoints[speedKeyPoints.length - 1].time);
            const t3 = timer - t2;
            this.fp = fp + t3 * v
        }else {
            const t2 = tickToSeconds(speedKeyPoints[this.speedIndex + 1].time);
            if (timer > t2) {
                this.speedIndex++;
                return;
            }
            const t3 = timer - t;
            this.fp = fp + t3 * v
        }

        ctx.save()
        ctx.beginPath();
        ctx.font = "16px Arial";
        ctx.fillStyle = "black";
        ctx.fillText(this.index, this.x, 0);
        ctx.restore()

    }
}

class line {
    constructor(index, info) {
        this.index = index;
        this.info = info;
        this.lC = info.lineColor;
    }
    // drawLinePoint(tick) {
    //     for (let i = 0; i < this.info.linePoints.length; i++) {
    //         const point = this.info.linePoints[i];
    //         // if (tick >= point.time) return;
    //         const canvasIndex = point.canvasIndex;
    //         const x = canvasI[canvasIndex].x + (point.xPosition * cvs.width);
    //         const y = -cameraScale(tick) * (point.floorPosition - canvasI[canvasIndex].fp) * cvs.height * (215 / 32 + 8) * (10 / 129)
    //         const x1 = canvasI[canvasIndex].x + (point.xPosition * cvs.width);
    //         const ease = point.easeType;
    //         const color = point.color;
    //         ctx.save()
    //         ctx.beginPath();
    //         ctx.arc(x, y, 5, 0, 2 * Math.PI);
    //         ctx.fillStyle = "rgba(" + color.r + "," + color.g + "," + color.b + "," + color.a + ")";
    //         ctx.fill();
    //         ctx.restore()
    //         ctx.save()
    //         ctx.beginPath();
    //         ctx.strockWidth = 2;
    //         ctx.strockStyle = "rgba(" + color.r + "," + color.g + "," + color.b + "," + color.a + ")";
    //         moveTo(x, y);
    //         lineTo()
    //     }
    // }
    lineColor(tick){
        for (let i = 0; i < this.lC.length; i++){
            if (this.lC.length < 1) return null;
            const eC = [this.lC[i].endColor.r, this.lC[i].endColor.g, this.lC[i].endColor.b, this.lC[i].endColor.a]
            if (! this.lC[i + 1]) return [...eC];
            if (this.lC.length === 1){
                if (tick >= this.lC[0].time){
                    const sC = [this.lC[0].startColor.r, this.lC[0].startColor.g, this.lC[0].startColor.b, this.lC[0].startColor.a]
                    return [...sC];
                }
            }
            else if (tick >= this.lC[i].time && tick < this.lC[i + 1].time){
                const sC = [this.lC[i].startColor.r, this.lC[i].startColor.g, this.lC[i].startColor.b, this.lC[i].startColor.a]
                return [...sC];
            }
        }
    }
    lerpColor(color1, color2, t) {
        return [
            color1[0] + (color2[0] - color1[0]) * t,
            color1[1] + (color2[1] - color1[1]) * t,
            color1[2] + (color2[2] - color1[2]) * t,
            color1[3] + (color2[3] - color1[3]) * t
        ];
    }
    drawLine(tick){
        for (let i = 0; i < this.info.linePoints.length; i++) {
            const point = this.info.linePoints[i];
            const canvasIndex = point.canvasIndex;
            const x = canvasI[canvasIndex].x + (point.xPosition * cvs.width);
            const y = -cameraScale(tick) * (point.floorPosition - canvasI[canvasIndex].fp) * cvs.height * (215 / 32 + speed) * (10 / 129)
            if (this.info.linePoints.length === 1 || i >= this.info.linePoints.length - 1) return;
            const point1 = this.info.linePoints[i + 1];
            const canvasIndex1 = point1.canvasIndex;
            const x1 = canvasI[canvasIndex1].x + (point1.xPosition * cvs.width);
            const y1 = -cameraScale(tick) * (point1.floorPosition - canvasI[canvasIndex1].fp) * cvs.height * (215 / 32 + speed) * (10 / 129)
            const ease = point.easeType;
            const color = point.color;
            const color1 = point1.color;
            // if (y < -cvs.height * 3) return;
            // if (y1 > cvs.height * 3) return;
            // if (y > 0 && y1 > 0) return;
            ctx.save()
            ctx.beginPath();
            ctx.moveTo(x, y);
            for (let t = 0; t <= 1; t += 1 / 16){
                const lX = x + (easeFuncs[ease](t) * (x1 - x))
                const lY = y + (t * (y1 - y))
                // if (lY > 0) break;
                ctx.lineTo(lX, lY);
            }
            ctx.lineWidth = 3 * cameraScale(tick);
            const lC = this.lineColor(tick);
            if (lC !== null && Array.isArray(lC)){
                const t = (tick - point.time) / (this.info.linePoints[i + 1].time - point.time);
                const lerpColorR = this.lerpColor([color.r, color.g, color.b, color.a], [color1.r, color1.g, color1.b, color1.a], easeFuncs[ease](t));
                const mixColor = mixColors(lC, [color.r, color.g, color.b, color.a]);
                ctx.strokeStyle = "rgba(" + mixColor[0] + "," + mixColor[1] + "," + mixColor[2] + "," + mixColor[3] + ")";
            }else ctx.strokeStyle = "rgba(" + color.r + "," + color.g + "," + color.b + "," + color.a + ")";
            ctx.stroke();
            ctx.restore()
        }
    }
    drawJudgeCircle(tick){
        for (let i = 0; i < this.info.linePoints.length; i++) {
            if (! this.info.linePoints[i + 1]) return;
            if (tick >= this.info.linePoints[i].time && tick < this.info.linePoints[i + 1].time){
                const point = this.info.linePoints[i];
                const canvasIndex = point.canvasIndex;
                const x = canvasI[canvasIndex].x + (point.xPosition * cvs.width);
                const y = 0;
                const x1 = x + (easeFuncs[point.easeType]((tick - point.time) / (this.info.linePoints[i + 1].time - point.time)) * (this.info.linePoints[i + 1].xPosition * cvs.width - point.xPosition * cvs.width))
                ctx.save()
                ctx.beginPath();
                ctx.rect(x1 - (15 * cameraScale(tick)), y - (15 * cameraScale(tick)), 30 * cameraScale(tick), 30 * cameraScale(tick));
                // ctx.strokeStyle = "rgba(0, 0, 0, 1)";
                // ctx.strokeStyle = "rgba(255, 255, 255, 0)"
                for (let j = 0; j < this.info.judgeRingColor.length; j++) {
                    if (this.info.judgeRingColor.length === 0){
                        ctx.strokeStyle = "rgba(0, 0, 0, 0)";
                    }
                    // if (! this.info.judgeRingColor[j]) break;
                    // const judgeRingColor = this.info.judgeRingColor[j];
                    // if (! this.info.judgeRingColor[j + 1]) break;
                    // console.log(judgeRingColor)
                    // if (tick > this.info.judgeRingColor[this.info.judgeRingColor.length - 1].time){
                    //     ctx.strokeStyle = "rgba(" + this.info.judgeRingColor[this.info.judgeRingColor.length - 1].endColor.r + "," + this.info.judgeRingColor[this.info.judgeRingColor.length - 1].endColor.g + "," + this.info.judgeRingColor[this.info.judgeRingColor.length - 1].endColor.b + "," + this.info.judgeRingColor[this.info.judgeRingColor.length - 1].endColor.a + ")";
                    //     break;
                    // }
                    // if (tick >= judgeRingColor.time && tick < this.info.judgeRingColor[j + 1].time){
                    //     ctx.strokeStyle = "rgba(" + judgeRingColor.startColor.r + "," + judgeRingColor.startColor.g + "," + judgeRingColor.startColor.b + "," + judgeRingColor.startColor.a + ")";
                    //     break;
                    // }
                    

                }
                ctx.lineWidth = 5 * cameraScale(tick);
                ctx.stroke();
                ctx.restore()
            }
        }
    }
}

class note {
    constructor(index, info, lInfo) {
        this.index = index;
        this.info = info;
        this.fp = info.floorPosition;
        this.otherInformations = info.otherInformations;
        this.type = info.type;
        this.time = info.time;
        this.lInfo = lInfo;
        this.xY = {}
        this.holdHit = false;
    }
    findLinePoint(tick, tick1){
        for (let i = 0; i < this.lInfo.linePoints.length; i++) {
            if (i > this.lInfo.linePoints.length - 1 || this.lInfo.linePoints.length === 1){
                const point = this.lInfo.linePoints[this.lInfo.linePoints.length - 1];
                const canvasIndex = point.canvasIndex;
                const x1 = canvasI[canvasIndex].x + (point.xPosition * cvs.width);
                const x = x1 + (easeFuncs[point.easeType]((tick1 - point.time) / (this.lInfo.linePoints[this.lInfo.linePoints.length - 1].time - point.time)) * (this.lInfo.linePoints[this.lInfo.linePoints.length - 1].xPosition * cvs.width - point.xPosition * cvs.width))
                const y = -cameraScale(tick) * (this.fp - canvasI[canvasIndex].fp) * cvs.height * (215 / 32 + speed) * (10 / 129)
                return {x, y}
            }
            if (! this.lInfo.linePoints[i + 1]) return;
            if (tick >= this.lInfo.linePoints[i].time && tick < this.lInfo.linePoints[i + 1].time){
                const point = this.lInfo.linePoints[i];
                const canvasIndex = point.canvasIndex;
                const x1 = canvasI[canvasIndex].x + (point.xPosition * cvs.width);
                const x = x1 + (easeFuncs[point.easeType]((tick1 - point.time) / (this.lInfo.linePoints[i + 1].time - point.time)) * (this.lInfo.linePoints[i + 1].xPosition * cvs.width - point.xPosition * cvs.width))
                const y = -cameraScale(tick) * (this.fp - canvasI[canvasIndex].fp) * cvs.height * (215 / 32 + speed) * (10 / 129)
                const fp = canvasI[canvasIndex].fp;
                return {x, y, fp}
            }
        }
    }
    drawNote(tick){
        this.xY = this.findLinePoint(this.time, this.time);
        if (! this.xY) return;
        if (tick >= this.otherInformations[0]) {
            noteI[this.index] = null;
            return;
        }
        if (tick >= this.time) {
            if (this.type !== 2){
                playSound(this.type)
                // console.info(this.type)
                noteI[this.index] = null;
                return;
            }
            if (! this.holdHit){
                this.holdHit = true;
                playSound(this.type)
                // console.info(this.type)
            }
            this.xY = this.findLinePoint(tick, tick);
            this.fp = this.xY.fp;
            this.xY.y = 0
         }
        ctx.save()
        ctx.beginPath();
        if (this.type === 2){
            const color = chart.themes[0].colorsList[2];
            const h = -cameraScale(tick) * -(this.fp - this.otherInformations[2]) * cvs.height * (215 / 32 + speed) * (10 / 129);
            ctx.fillStyle = "rgba(" + color.r + "," + color.g + "," + color.b + "," + color.a + ")";
            ctx.rect(this.xY.x - (5 * cameraScale(tick)), this.xY.y - 15, 10 * cameraScale(tick), h);
            ctx.lineWidth = 3 * cameraScale(tick);
            ctx.stroke()
        }
        if (this.type !== 1){
            ctx.rect(this.xY.x - (10 * cameraScale(tick)), this.xY.y - (10 * cameraScale(tick)), 20 * cameraScale(tick), 20 * cameraScale(tick));
            const color = chart.themes[0].colorsList[1];
            ctx.fillStyle = "rgba(" + color.r + "," + color.g + "," + color.b + "," + color.a + ")";
            ctx.lineWidth = 3 * cameraScale(tick);
            ctx.stroke()
        }else{
            const color = [255, 255, 255, 1]
            ctx.fillStyle = "rgba(" + color[0] + "," + color[1] + "," + color[2] + "," + color[3] + ")";
            ctx.rect(this.xY.x - (10 * cameraScale(tick)), this.xY.y - (10 * cameraScale(tick)), 20 * cameraScale(tick), 20 * cameraScale(tick));
            ctx.lineWidth = 3 * cameraScale(tick);
            ctx.stroke()
        }
        ctx.fill();
        ctx.restore()
    }
}

function start(){
    for (let i = 0; i < chart.canvasMoves.length; i++) {
        canvasI.push(new canvas(i, chart.canvasMoves[i]));
    }
    for (let i = 0; i < chart.lines.length; i++) {
        lineI.push(new line(i, chart.lines[i]));
    }
    let noteIndex = 0;
    for (let i = 0; i < chart.lines.length; i++) {
        if (! chart.lines[i].notes) continue;
        for (let j = 0; j < chart.lines[i].notes.length; j++) {
            noteI.push(new note(noteIndex, chart.lines[i].notes[j], chart.lines[i]));
            noteIndex++;
        }
    }
    const audio = document.getElementById("bgm");
    audio.play();
    function update() {
        ctx.clearRect(-cvs.width / 2, -cvs.height / 2 - 200, cvs.width, cvs.height);
        const timer = audio.currentTime;
        const tick = secondsToTick(timer);
        drawBackground(tick);
        for (let i = 0; i < canvasI.length; i++) {
            canvasI[i].move(tick);
            canvasI[i].speed(timer);
        }
        for (let i = 0; i < lineI.length; i++) {
            // lineI[i].drawLinePoint(tick);
            lineI[i].drawLine(tick);
            lineI[i].drawJudgeCircle(tick);
        }
        for(let i = 0; i < noteI.length; i++){
            if (! noteI[i] || noteI[i] === null) continue;
            noteI[i].drawNote(tick);
        }
        // const test = document.getElementById("test");
        // const fp = []
        // for (let i = 0; i < canvasI.length; i++) {
        //     fp.push(canvasI[i].fp)
        // }
        // test.innerHTML = fp
        requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}