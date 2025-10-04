var chartCheckResult = []

function checkFormatChart() {
    console.log("开始检查谱面格式")
    showPopup("开始检查谱面格式", "info")
    if (chart === null || chart ==="") {
        chartCheckResult.push({"type": "error", "message": "谱面数据为空，请先导入谱面数据！"})
    }
    if (!("fileVersion" in chart)) {
        chartCheckResult.push({"type": "error", "message": "未知谱面格式，请先导入正确格式的谱面数据！"})
    }
    if (chart.fileVersion === 1) {
        chartCheckResult.push({"type": "info", "message": "fileVersion 1 适配中"})
    }
    if (!chart.canvasMoves || chart.canvasMoves.length === 0) {
        chartCheckResult.push({"type": "error", "message": "缺少 canvasMoves 数据！"})
    }
    if (!chart.lines) {
        chartCheckResult.push({"type": "error", "message": "缺少 lines 数据！"})
    }
    if (chart.bpmShifts.length === 0) {
        chartCheckResult.push({"type": "warn", "message": "缺少 bpmShift 数据！"})
    }
    if (chart.cameraMove.length === 0) {
        chartCheckResult.push({"type": "warn", "message": "缺少 cameraMove 数据！"})
    }else {
        if (!chart.cameraMove.scaleKeyPoints || chart.cameraMove.scaleKeyPoints.length === 0) {
            chartCheckResult.push({"type": "warn", "message": "缺少 cameraMove.scaleKeyPoints 数据！"})
        } else {
            for (let i = 0; i < chart.cameraMove.scaleKeyPoints.length; i++) {
                const scaleKP = chart.cameraMove.scaleKeyPoints[i];
                if (scaleKP.easeType > easeFuncs.length - 1) {
                    chartCheckResult.push({"type": "error", "message": `不支持的缓动类型：${scaleKP.easeType}，位于：cameraMove.scaleKeyPoints ${i} ，将视为0`})
                    scaleKP.easeType = 0
                }
            }
        }
        if (!chart.cameraMove.xPositionKeyPoints || chart.cameraMove.xPositionKeyPoints.length === 0) {
            chartCheckResult.push({"type": "warn", "message": "缺少 cameraMove.xPositionKeyPoints 数据！"})
        } else {
            for (let i = 0; i < chart.cameraMove.xPositionKeyPoints.length; i++) {
                const xPositionKP = chart.cameraMove.xPositionKeyPoints[i];
                if (xPositionKP.easeType > easeFuncs.length - 1) {
                    chartCheckResult.push({"type": "error", "message": `不支持的缓动类型：${xPositionKP.easeType}，位于：cameraMove.xPositionKeyPoints ${i} ，将视为0`})
                    xPositionKP.easeType = 0
                }
            }
        }
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
        showPopup("格式检查不通过", "warn")
        console.log(chartCheckResult)
        showCheckResult()
    }
}


function showCheckResult() {
    const shadow = document.createElement("div")
    shadow.style.position = "fixed"
    shadow.style.top = "0"
    shadow.style.left = "0"
    shadow.style.width = "100%"
    shadow.style.height = "100%"
    shadow.style.backgroundColor = "rgba(0, 0, 0, 0.5)"
    shadow.style.zIndex = "9998"
    document.body.appendChild(shadow)
    const checkResultDiv = document.createElement("div")
    checkResultDiv.style.position = "absolute"
    checkResultDiv.style.width = "320px"
    checkResultDiv.style.height = "500px"
    checkResultDiv.style.zIndex = "9999"
    checkResultDiv.style.overflow = "auto"
    checkResultDiv.style.transform = "translate(-50%, -50%)"
    checkResultDiv.style.top = "50%"
    checkResultDiv.style.left = "50%"
    checkResultDiv.style.backgroundColor = "white"
    // checkResultDiv.style.padding = "20px"
    checkResultDiv.style.borderRadius = "10px"
    // checkResultDiv.style.boxShadow = "0px 0px 10px rgba(0, 0, 0, 0.5)"
    checkResultDiv.style.textAlign = "center"
    const title = document.createElement("h2")
    title.style.marginTop = "20px"
    title.innerText = "格式检查"
    checkResultDiv.appendChild(title)
    const resultTitle = document.createElement("h3")
    resultTitle.innerText = `发现 ${chartCheckResult.length} 个问题，其中：${chartCheckResult.filter(item => item.type === "error").length} 个错误，${chartCheckResult.filter(item => item.type === "warn").length} 个警告，${chartCheckResult.filter(item => item.type === "info").length} 个提示`
    checkResultDiv.appendChild(resultTitle)
    const resultList = document.createElement("ul")
    resultList.style.listStyle = "none"
    resultList.style.padding = "0"
    const fragment = document.createDocumentFragment()
    for (let i = 0; i < chartCheckResult.length; i++) {
        const result = chartCheckResult[i];
        const resultItem = document.createElement("li")
        if (result.type === "error") {
            resultItem.style.backgroundColor = "red"
        } else if (result.type === "warn") {
            resultItem.style.backgroundColor = "rgb(255, 180, 0)"
        } else if (result.type === "info") {
            resultItem.style.backgroundColor = "rgb(0, 162, 255)"
        }
        resultItem.style.padding = "10px"
        resultItem.style.marginTop = "10px"
        resultItem.innerText = `${result.type}：${result.message}`
        fragment.appendChild(resultItem)
    }
    // for (let i = 0; i < 186; i++) {
    //     const resultItem = document.createElement("li")
    //     resultItem.innerText = `test`
    //     fragment.appendChild(resultItem)
    // }
    resultList.appendChild(fragment)
    checkResultDiv.appendChild(resultList)
    document.body.appendChild(checkResultDiv)

    shadow.addEventListener("click", () => {
        document.body.removeChild(shadow)
        document.body.removeChild(checkResultDiv)
    })
}
// showCheckResult()