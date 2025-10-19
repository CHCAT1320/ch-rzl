const { pow, sin, cos, PI, sqrt } = Math;

// 1. 缓动函数定义（19个，严格匹配提供的列表）
function linear(x) {
    return x;
}

function easeInQuad(x) {
    return x * x;
}

function easeOutQuad(x) {
    return 1 - (1 - x) * (1 - x);
}

function easeInOutQuad(x) {
    return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

function easeInCubic(x) {
    return x * x * x;
}

function easeOutCubic(x) {
    return 1 - Math.pow(1 - x, 3);
}

function easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function easeInQuart(x) {
    return x * x * x * x;
}

function easeOutQuart(x) {
    return 1 - Math.pow(1 - x, 4);
}

function easeInOutQuart(x) {
    return x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2;
}

function easeInQuint(x) {
    return x * x * x * x * x;
}

function easeOutQuint(x) {
    return 1 - Math.pow(1 - x, 5);
}

function easeInOutQuint(x) {
    return x < 0.5 ? 16 * x * x * x * x * x : 1 - Math.pow(-2 * x + 2, 5) / 2;
}

function easeZero(x) {
    return 0;
}

function easeOne(x) {
    return 1;
}

function easeInCirc(x) {
    return 1 - Math.sqrt(1 - Math.pow(x, 2));
}

function easeOutCirc(x) {
    return Math.sqrt(1 - Math.pow(x - 1, 2));
}

function easeOutSine(x) {
    return Math.sin((x * Math.PI) / 2);
}

function easeInSine(x) {
    return 1 - Math.cos((x * Math.PI) / 2);
}

// 2. 缓动函数数组（19个，索引0-18，严格匹配提供的顺序）
const easeFuncs = [
    linear,          // 0: Linear
    easeInQuad,      // 1: InQuad
    easeOutQuad,     // 2: OutQuad
    easeInOutQuad,   // 3: InOutQuad
    easeInCubic,     // 4: InCubic
    easeOutCubic,    // 5: OutCubic
    easeInOutCubic,  // 6: InOutCubic
    easeInQuart,     // 7: InQuart
    easeOutQuart,    // 8: OutQuart
    easeInOutQuart,  // 9: InOutQuart
    easeInQuint,     // 10: InQuint
    easeOutQuint,    // 11: OutQuint
    easeInOutQuint,  // 12: InOutQuint
    easeZero,        // 13: Zero
    easeOne,         // 14: One
    easeInCirc,      // 15: InCirc
    easeOutCirc,     // 16: OutCirc
    easeOutSine,     // 17: OutSine
    easeInSine       // 18: InSine
];

// 3. 线性插值（保持原逻辑，确保缓动结果正确映射）
function lerp(start, end, t) {
    return start + (end - start) * t;
}

// 4. 缓动执行函数（适配新的缓动函数数组，保留原参数以兼容调用）
function tweenExecute(nowTime, startTime, endTime, start, end, easeType = 0, easeHead = 0, easeTail = 1) {
    // 计算时间进度（处理时长为0的异常，避免NaN）
    const duration = endTime - startTime;
    const rdt = duration <= 0 ? 0 : (nowTime - startTime) / duration;

    try {
        // 根据指定的缓动类型计算进度，再执行插值
        const t = easeFuncs[easeType](rdt);
        return lerp(start, end, t);
    } catch (error) {
        console.error(`Ease calculation error! rdt: ${rdt}, error: ${error.message}`);
        // 异常时返回边界值，保证函数稳定性
        return rdt < 0 ? start : end;
    }
}