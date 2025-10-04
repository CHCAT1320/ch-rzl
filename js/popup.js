function showPopup(e, type) {
    const popup = document.createElement("div");
    popup.classList.add("popup");
    popup.style.position = "absolute";
    popup.style.top = "15px";
    popup.style.left = "0";
    popup.style.width = "500px";
    popup.style.height = "auto";
    if (type === "error") {
        popup.style.backgroundColor = "rgb(255, 0, 0)";
        popup.innerText = "发生错误：" + e;
    } else if (type === "info") {
        popup.style.backgroundColor = "rgb(0, 162, 255)";
        popup.innerText = e;
    } else if (type === "warn") {
        popup.style.backgroundColor = "rgb(255, 180, 0)";
        popup.innerText = "警告：" + e;
    }
    popup.style.color = "white";
    popup.style.padding = "10px";
    popup.style.borderRadius = "5px";
    popup.style.textAlign = "center";
    // 计算 y 偏移量
    let yOffset = 0;
    const popups = Array.from(document.getElementsByClassName("popup"));
    for (let i = 0; i < popups.length; i++) {
        const popupi = popups[i];
        if (popupi.parentNode === document.body) {
            yOffset += popupi.offsetHeight + 15;
        }
    }
    popup.style.top = `${yOffset}px`;
    document.body.appendChild(popup);

    function animation(t) {
        if (t >= 270) {
            document.body.removeChild(popup);
            updatePopupsYPosition();
            return;
        }
        if (t < 100) {
            const windowWidth = window.innerWidth;
            const width = popup.offsetWidth;
            const offset = windowWidth - (width * easeFuncs[9](t / 100)) - 15;
            popup.style.left = `${offset}px`;
            popup.style.opacity = easeFuncs[10](t / 100);
        }
        if (t >= 100) {
            const d = easeFuncs[9]((t - 200) / 100);
            popup.style.opacity = 1 - d;
        }
        requestAnimationFrame(() => animation(t + 1.5));
    }

    requestAnimationFrame(() => animation(0));

    function updatePopupsYPosition() {
        const popups = Array.from(document.getElementsByClassName("popup"));
        let yOffset = 0;
        for (let i = 0; i < popups.length; i++) {
            const popupi = popups[i];
            if (popupi.parentNode === document.body) {
                popupi.style.top = `${yOffset}px`;
                yOffset += popupi.offsetHeight + 15;
            }
        }
    }
}