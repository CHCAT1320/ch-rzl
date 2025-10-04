var chartCheckResult = []

function checkFormatChart() {
    console.log("开始检查谱面格式")
    showPopup("开始检查谱面格式", "info")
    if (chart === null || chart ==="") {
        chartCheckResult.push({"type": "error", "message": "谱面数据为空，请先导入谱面数据！"})
        return
    }
    if (!("fileVersion" in chart)) {
        chartCheckResult.push({"type": "error", "message": "未知谱面格式，请先导入正确格式的谱面数据！"})
        return
    }
    if (chart.fileVersion === 1) {
        chartCheckResult.push({"type": "warn", "message": "fileVersion 1 适配中"})
        return
    }
    if (!chart.canvasMoves || chart.canvasMoves.length === 0) {
        chartCheckResult.push({"type": "error", "message": "缺少 canvasMoves 数据！"})
        return
    }
    if (!chart.lines) {
        chartCheckResult.push({"type": "error", "message": "缺少 lines 数据！"})
        return
    }
    for (let i = 0; i < chart.lines.length; i++) {
        const line = chart.lines[i];
        for (let j = 0; j < line.linePoints.length; j++) {
            const point = line.linePoints[j];
            if (point.easeType > easeFuncs.length - 1) {
                chartCheckResult.push({"type": "error", "message": `不支持的缓动类型：${point.easeType}，位于：line ${i} point ${j} ，将视为0`})
                point.easeType = 0
            }
        }
    }
    for (let i = 0; i < chart.canvasMoves.length; i++) {
        const canvas = chart.canvasMoves[i];
        const xK = canvas.xPositionKeyPoints;
        for (let j = 0; j < xK.length; j++) {
            const xKP = xK[j];
            if (xKP.easeType > easeFuncs.length - 1) {
                chartCheckResult.push({"type": "error", "message": `不支持的缓动类型：${xKP.easeType}，位于：canvas ${i} xPositionKeyPoint ${j} ，将视为0`})
                xKP.easeType = 0
            }
        }
    }
    if (chartCheckResult.length === 0) {
        console.log("格式检查通过")
        showPopup("格式检查通过", "info")
    } else {
        console.log("格式检查不通过")
        showPopup("格式检查不通过", "error")
        console.log(chartCheckResult)
    }
}