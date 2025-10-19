var msgBoxI = [];

var msg = ["你到底回不回？我气炸了！😠","发那么多不回，你根本不在乎我！","故意晾我是吧？我超生气！💢","消息没回音，你什么意思啊！","懒得回消息？我快忍不了了！😤","不回还消失，我一肚子火！🔥","眼里没我是吧？越想越气！","不回消息，你欺负我呢？😡","等不到回复，我气到发抖！","不回就算了，连解释都没？","忙到没空回？骗谁呢！💢","没回音的态度，太过分了！😠","我着急等你，你却不搭理！","装没看见？我真的气炸了！😤","故意让我生气是吧？太过分！🔥","这么对我？失望又生气！","等半天没影，我气坏了！😡","不回消息，你搞什么啊！","没尊重！我真的超生气！💢","消失就算了？我不会难过吗？","没回音，你心里有我吗？😠","把我当空气？我快气死了！","无所谓是吧？我气到哭！😤","晾着我？我一肚子火！🔥","石沉大海，你太伤人了！😡","装死？你想怎么样啊！","我担心又气，你不回应！💢","不回消息，你根本不在乎！😠","等不到消息，我超恼火！","失联？你太过分了！😤","故意不理我？我气炸了！🔥","这态度，我真的很生气！😡","等半天没动静，又气又委屈！","不回就算了，没交代？💢","没空回？我才不信！😠","消失？你觉得我好哄？","不把我当回事？我超气！😤","没回音，你什么意思！🔥","装没看见？我气到不行！😡","这么对我？我特别生气！💢","没考虑我感受？太气人！😠","故意让我上火是吧？","忍不下去了！你太过分！😤","眼里没我？发消息不回！🔥","我又气又急，你不搭理！😡","消失？我太失望了！💢","等半天没回复，气炸了！😠","装死？我真的受不了！","晾着我？火没处撒！😤","不回消息，你不在乎我！🔥","太伤人了！消息石沉大海！😡","没动静，我真的超生气！💢","装没看见？你什么意思！😠","没空回？骗谁呢！","没回音，心里有我吗？😤","越想越气！等不到回复！🔥","消失？你太过分了！😡","这么对我？我快气哭了！💢","没把我当回事！气炸了！😠","故意气我？我忍不了！","眼里没我？发消息不回！😤","失联？我太失望了！🔥","等半天没影，气坏了！😡","装死？我气到不行！💢","晾着我？特别恼火！😠","没回音，你什么意思！","太伤人！消息石沉大海！😤","没动静，越想越气！🔥","故意不理？我气炸了！😡","没空回？我才不信！💢","心里有我吗？没回音！😠","火没处发！等不到回复！","消失？你太过分了！😤","这么对我？我超生气！🔥","没考虑我！太气人了！😡","故意上火？我忍不了！💢","眼里没我？不回消息！😠","又气又急！你不搭理！","消失？我太失望了！😤","没回复？我气炸了！🔥","装死？真的受不了！😡","晾着我？火没处撒！💢","不在乎我？不回消息！😠","太伤人！消息没回音！","没动静，我超生气！😤"]

var imgQQWV = [new Image(), new Image()]
imgQQWV[0].src = "../wx.webp"
imgQQWV[1].src = "../qq.png"

class msgBox {
    constructor(time, fatherY) {
        this.time = time;
        this.holdTime = 3;
        this.transitionTime = 0.5;
        this.fatherY = fatherY - 60;
        this.y = fatherY;
        // 胶囊尺寸参数（调整圆角半径）
        this.width = 270 * (cvs.width / 360);
        this.height = 60 * (cvs.height / 640);
        this.radius = 23 * (cvs.width / 360); // 圆角半径设为15px（可根据需要调整），小于高度的一半
        this.show = Math.random() > 0.7
        console.log(this.show)
        if (this.show) {
            playSound(3)
            msgH.push({type: 3, time: time})
        }
        this.msgIndex = Math.floor(Math.random() * msg.length)
        this.imgIndex = Math.floor(Math.random() * 2)
    }
    easeOutBack(x) {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    }
    // 绘制圆角矩形（胶囊的弱化版）
    drawRoundedRect(x, y, width, height, radius) {
        ctx.beginPath();
        // 左上角
        ctx.moveTo(x + radius, y);
        // 右上角
        ctx.arcTo(x + width, y, x + width, y + height, radius);
        // 右下角
        ctx.arcTo(x + width, y + height, x, y + height, radius);
        // 左下角
        ctx.arcTo(x, y + height, x, y, radius);
        // 闭合到左上角
        ctx.arcTo(x, y, x + width, y, radius);
        ctx.closePath();
        ctx.fill();
    }
    draw(time) {
        return
        if (this.show === false) return;
        if (time > this.time && time < this.time + this.transitionTime && time < this.time + this.holdTime) {
            const easeValue = this.easeOutBack((time - this.time) / this.transitionTime);
            this.y = this.fatherY + easeValue * 135 * (cvs.height / 640);
            const audio = document.getElementById('bgm')
            audio.volume = Math.max(0.2, 1 - easeValue)
        }
        if (time > this.time + this.holdTime && time < this.time + this.holdTime + this.transitionTime) {
            const t = (time - this.time - this.holdTime) / this.transitionTime;
            const easeValue = t * t * t * t;
            this.y = (this.fatherY + 125 * (cvs.height / 640)) - easeValue * 135 * (cvs.height / 640);
            const audio = document.getElementById('bgm')
            audio.volume = Math.max(1, easeValue)
        }
        // 绘制圆角矩形
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        this.drawRoundedRect(
            -this.width / 2,  // x坐标（居中）
            this.y - this.height,  // y坐标
            this.width,  // 宽度
            this.height,  // 高度
            this.radius  // 圆角半径（已调整）
        );
        // 绘制文字
        ctx.font = `${12 * (cvs.width / 360)}px rizline`;
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const msgText = "宝宝： " + msg[this.msgIndex]
        const msgWidth = ctx.measureText(msgText).width
        const x = (-this.width / 2 + msgWidth / 2 + 50) * (cvs.width / 360)
        const y = (this.y - this.height / 2) * (cvs.height / 640)
        ctx.fillText(msgText, x + 20 * (cvs.width / 360), y);

        // 绘制头像
        const imgX = ((-this.width / 2 + 20) * (cvs.width / 360)) * (cvs.width / 360)
        const imgY = ((this.y - this.height / 2 - 20) * (cvs.height / 640)) * (cvs.height / 640)
        ctx.drawImage(imgQQWV[this.imgIndex], imgX, imgY, 40 * (cvs.width / 360), 40 * (cvs.height / 640))
    }
}