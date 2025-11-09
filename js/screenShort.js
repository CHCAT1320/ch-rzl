var screenShortI = []

class screenShort {
    constructor(time, fatherY) {
        this.fatherY = fatherY
        this.time = time
        this.holdTime = 3
        this.transitionTime = 0.7
        this.show = Math.random() > 0.7
        console.log(this.show)
        this.img = new Image()
        this.isOnlode = false
        this.w = cvs.width
        this.h = cvs.height
        this.eW = this.w / 4
        this.eH = this.h / 4
        this.x = 0
        this.y = fatherY
    }
    draw(timer) {
        return
        if (this.show === false) return
        if (this.img.src === null || this.img.src === "" ) this.img.src = cvs.toDataURL()
        this.img.onload = () => {
            this.isOnlode = true
        }
        if (! this.isOnlode) return
        if (timer > this.time && timer < this.time + this.transitionTime && timer < this.time + this.holdTime) {
            const easeValue = easeFuncs[11]((timer - this.time) / this.transitionTime)
            this.w = cvs.width + (this.eW - cvs.width) * easeValue
            this.h = cvs.height + (this.eH - cvs.height) * easeValue
            this.x = (cvs.width - this.w - 20) / 2 * easeValue
            this.y = this.fatherY + (-cvs.height / 2 - 200 - this.fatherY + 20 + this.h / 2) * easeValue
        }
        if (timer > this.time + this.holdTime && timer < this.time + this.holdTime + this.transitionTime) {
            const easeValue = easeFuncs[11]((timer - this.time - this.holdTime) / this.transitionTime)
            this.y = (-cvs.height / 2 - 200 - this.fatherY + 20 + this.h / 2) + ((-cvs.height / 2 - 200 - this.fatherY - 20 - this.h * 2) - (-cvs.height / 2 - 200 - this.fatherY + 20 + this.h / 2)) * easeValue
        }
        // 保存当前绘图状态
        ctx.save();

        // 设置阴影参数（顺序可调整）
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'; // 阴影颜色（半透明黑色）
        ctx.shadowBlur = 10; // 阴影模糊程度
        ctx.shadowOffsetX = 5; // 水平偏移量
        ctx.shadowOffsetY = 5; // 垂直偏移量

        // 绘制图像（带阴影）
        ctx.drawImage(this.img, this.x - this.w / 2, this.y - this.h / 2, this.w, this.h);

        // 恢复绘图状态（清除阴影设置，不影响后续绘制）
        ctx.restore();
    }
}