var chart
var bpm
var playerCanvasI = []
var allCanvasX = []
var allCanvasFP = []
var playerLine = []
var allLinepointX = []

function chartFiles(files){
    // 获取文件
    var file = files[0];
    // 创建FileReader对象
    var reader = new FileReader();
    // 解析文件数据
    reader.onload = function(e) {

        try{
            var data = JSON.parse(e.target.result);
            console.log(data)
            if ("fileVersion" in data){
                console.log("已知谱面格式fileVersion = " + data.fileVersion)
                chart = data
                console.log(chart.lines)
            }else {
                console.error("未知谱面格式")
            }
        }
        catch(error){
            console.log(error)
        }

    }
    // 调用readAsText并传入文件内容
    reader.readAsText(file);
}

function bgmFiles(files){
    // 获取文件
    var file = files[0];
    // 创建FileReader对象
    var reader = new FileReader();
    // 解析文件数据
    reader.onload = function(e) {

        try{
            console.log("音乐文件")
            var audio = document.getElementById("bgm")
            audio.src = URL.createObjectURL(file);
        }
        catch(error){
            console.log(error)
        }

    }
    // 调用readAsText并传入文件内容
    reader.readAsText(file);
}

// 获取 canvas 上下文
// const canvas = document.getElementById("playerCanvas")
// const ctx = canvas.getContext("2d")
// canvas.width = 360
// canvas.height = 640
// ctx.translate(canvas.width / 2, canvas.height / 2)
// console.log(canvas.width,canvas.height)



// bpm 变化
function bpmChange(nowTime){
    bpm = chart.bPM
    let eIndex = 0
    // 遍历 bpmShifts 列表
    for (e of chart.bpmShifts){
        if(chart.bpmShifts.length > 1){
            if (nowTime >= e.time * 60 / bpm && nowTime <= chart.bpmShifts[eIndex].time * 60 / bpm){
                bpm = bpm * e.value
            }
        }else {
            bpm = bpm * chart.bpmShifts[0].value
        }
    }
    // console.log(bpm)
}

// 创建canvas
function createPlayerCanvas(){
    let canvasMoveList = chart.canvasMoves
    let canvasCount = canvasMoveList.length
    for (var i = 0; i < canvasCount; i++){
        playerCanvasI.push(new playerCanvas(i))
    }
}

// 创建线
function createLines(){
    let linesList = chart.lines
    let lineCount = linesList.length
    for (var i = 0; i < lineCount; i++){
        playerLine.push(new lines(i))
    }
}

var scale = 1
var scaleListNumber = 0
function camera(timer){
    let scaleList = chart.cameraMove.scaleKeyPoints
    if (scaleListNumber < scaleList.length - 1){
        let t1 = scaleList[scaleListNumber].time * 60 / bpm
        let t2 = scaleList[scaleListNumber + 1].time * 60 / bpm
        let v1 = scaleList[scaleListNumber].value
        let v2 = scaleList[scaleListNumber + 1].value
        let ease = scaleList[scaleListNumber].easeType
        if (timer > t1){
            let easeValue = easeFuncs[ease]((timer - t1) / (t2 - t1))
            scale = v1 + v2 - v1 * easeValue
            // scale = scale * canvas.height
            if (timer > t2){
                scaleListNumber += 1
            }
        }

    }
}

// canvas类
class playerCanvas{
    constructor(ci){
        this.canvasIndex = ci
        // console.log(this.canvasIndex)
        this.canvasMoveList = chart.canvasMoves[this.canvasIndex]
        this.canvasMoveNumber = 0
        this.canvasX = 0
        allCanvasX[this.canvasIndex] = this.canvasX
        this.speedList = this.canvasMoveList.speedKeyPoints
        this.speedNumber = 0
        this.fp = 0
        allCanvasFP[this.canvasIndex] = this.fp
    }
    canvasMove(timer){
        if(this.canvasMoveNumber < this.canvasMoveList.xPositionKeyPoints.length - 1){
            if(timer > this.canvasMoveList.xPositionKeyPoints[this.canvasMoveNumber].time * 60 / bpm){
                let x1 = this.canvasMoveList.xPositionKeyPoints[this.canvasMoveNumber].value * canvas.width
                let x2 = this.canvasMoveList.xPositionKeyPoints[this.canvasMoveNumber + 1].value * canvas.width
                let t1 = this.canvasMoveList.xPositionKeyPoints[this.canvasMoveNumber].time * 60 / bpm
                let t2 = this.canvasMoveList.xPositionKeyPoints[this.canvasMoveNumber + 1].time * 60 / bpm
                let ease = this.canvasMoveList.xPositionKeyPoints[this.canvasMoveNumber].easeType
                let easeValue = easeFuncs[ease]((timer - t1) / (t2 - t1))
                this.canvasX = x1 + x2 - x1 * easeValue
                allCanvasX[this.canvasIndex] = this.canvasX
                if(timer > t2){
                    this.canvasMoveNumber += 1
                }
            }
        }
        ctx.fillStyle = "rgb(0,0,0)"
        ctx.font = "20px Arial"
        ctx.fillText(this.canvasIndex, this.canvasX, 0)
    }
    canvasFP(timer){
        if (this.speedNumber < this.speedList.length - 1){
            let t1 = this.speedList[this.speedNumber].time * 60 / bpm
            let t2 = this.speedList[this.speedNumber + 1].time * 60 / bpm
            let fp1 = this.speedList[this.speedNumber].floorPosition
            let fp2 = this.speedList[this.speedNumber + 1].floorPosition
            let ease = this.speedList[this.speedNumber].easeType
            if (timer > t1){
                let easeValue = easeFuncs[ease]((timer - t1) / (t2 - t1))
                // this.fp = fp1 + fp2 - fp1 * easeValue
                //this.fp = this.fp// * scale * (215 / 32 + 7.6) * 10 / 129
                //this.fp = this.fp * 1
                this.fp = fp1 + (timer - t1) * this.speedList[this.speedNumber].value
                allCanvasFP[this.canvasIndex] = this.fp
                if (timer > t2){
                    this.speedNumber += 1
                }
            }
        }
    }
}

// 绘制曲线
class lines {
    constructor(lI) {
        this.lineIndex = lI;
        this.linePoints = chart.lines[this.lineIndex].linePoints;
        this.linePointsNumber = 0;
        this.linePX = 0;
        allLinepointX[this.lineIndex] = this.linePX;
    }

    drawLinePoints(timer) {
        this.linePointsNumber = 0;
        for (var i = 0; i < this.linePoints.length; i++) {
            if (this.linePointsNumber < this.linePoints.length - 1) {
                let t1 = this.linePoints[this.linePointsNumber].time * 60 / bpm;
                let t2 = this.linePoints[this.linePointsNumber + 1].time * 60 / bpm;
                let p1 = this.linePoints[this.linePointsNumber].xPosition * canvas.width;
                let p2 = this.linePoints[this.linePointsNumber + 1].xPosition * canvas.width;
                let y1 = this.linePoints[this.linePointsNumber].floorPosition;
                let y2 = this.linePoints[this.linePointsNumber + 1].floorPosition;
                let ease = this.linePoints[this.linePointsNumber].easeType;

                // 绘制曲线
                ctx.beginPath();
                ctx.strokeStyle = `rgba(${this.linePoints[this.linePointsNumber].color.r}, ${this.linePoints[this.linePointsNumber].color.g}, ${this.linePoints[this.linePointsNumber].color.b}, ${this.linePoints[this.linePointsNumber].color.a})`;
                ctx.lineWidth = 2;

                // 计算曲线的每个点
                for (let t = 0; t <= 1; t += 0.01) {
                    let x = p1 + (p2 - p1) * easeFuncs[ease](t);
                    let y = y1 + (y2 - y1) * easeFuncs[ease](t);
                    let canvasY = -canvas.height * (y - allCanvasFP[this.linePoints[this.linePointsNumber].canvasIndex]) + 200;

                    if (t === 0) {
                        ctx.moveTo(allCanvasX[this.linePoints[this.linePointsNumber].canvasIndex] + x, canvasY);
                    } else {
                        ctx.lineTo(allCanvasX[this.linePoints[this.linePointsNumber].canvasIndex] + x, canvasY);
                    }
                }
                ctx.stroke();

                // 绘制点
                ctx.beginPath();
                ctx.arc(allCanvasX[this.linePoints[this.linePointsNumber].canvasIndex] + p1, -canvas.height * (y1 - allCanvasFP[this.linePoints[this.linePointsNumber].canvasIndex]) + 200, 4, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${this.linePoints[this.linePointsNumber].color.r}, ${this.linePoints[this.linePointsNumber].color.g}, ${this.linePoints[this.linePointsNumber].color.b}, ${this.linePoints[this.linePointsNumber].color.a})`;
                ctx.fill();

                this.linePointsNumber += 1;
            }
        }
    }
}

// 开始播放
function start(){
    // 获取 audio 元素
    var audio = document.getElementById("bgm")
    audio.play()
    createPlayerCanvas()
    createLines()
    // 调用更新并递归
    Update()
    function Update(){
        let currTime = audio.currentTime
        bpmChange(currTime)
        camera(currTime)
        ctx.clearRect(-canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height)
        // ctx.clear()
        for (i of playerCanvasI){
            i.canvasMove(currTime)
            i.canvasFP(currTime)
        }
        for (i of playerLine){
            i.drawLinePoints(currTime)
        }
        ctx.beginPath()
        ctx.moveTo(-canvas.width / 2, 200)
        ctx.lineTo(canvas.width, 200)
        ctx.strokeStyle = 'black'
        ctx.lineWidth = 2
        ctx.stroke()
        document.getElementById("test").innerHTML = allCanvasFP
        // 计算谱面现在时间
        time = currTime.toFixed(3);
        document.getElementById("chartTime").innerHTML = `谱面时间：${time}s`
        
    }
}


// 计算 fps
let frameCount = 0
let lastTime = 0
function updateFPS() {
    const now = performance.now()
    frameCount++
    if (now - lastTime >= 1000) {
        document.getElementById('fps').textContent = 'FPS: ' + frameCount
        frameCount = 0
        lastTime = now
    }
    requestAnimationFrame(updateFPS)
}
requestAnimationFrame(updateFPS)