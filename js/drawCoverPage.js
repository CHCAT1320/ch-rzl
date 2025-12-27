function drawCoverPage() {
    // 绘制圆形曲绘 方形图片 => 圆形图片 => cvs绘制圆形图片
    ctx.beginPath();
    // ctx.fillStyle = "white";
    // ctx.fillRect(-cvs.width / 2, -200 * (cvs.height / 640) - cvs.height / 2, cvs.width, cvs.height);
    const img = new Image();
    img.src = corverPage;
    img.onload = function() {
        const w = img.width / (2.5 * (img.width / 512)) * (cvs.width / 360);
        const h = img.height / (2.5 * (img.height / 512)) * (cvs.height / 640);
        const x = -w / 2;
        const y = -200 * (cvs.height / 640) - h / 2;
        ctx.arc(x + w / 2, y + h / 2, w / 2, 0, 2 * Math.PI);
        ctx.strokeStyle = "white";
        ctx.lineWidth = 10;
        ctx.stroke();
        ctx.clip();
        ctx.drawImage(img, x, y, w, h);
        ctx.closePath();
    }

}