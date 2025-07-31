const { pow, sin, cos, PI } = Math;

// easing functions
function linear(x) {
    return x;
}

function sineIn(x) {
    return 1 - cos((x * PI) / 2);
}

function sineOut(x) {
    return sin((x * PI) / 2);
}

function sineInOut(x) {
    return (1 - cos(x * PI)) / 2;
}

function quadIn(x) {
    return pow(x, 2);
}

function quadOut(x) {
    return 1 - pow((1 - x), 2);
}

function quadInOut(x) {
    x *= 2;
    if (x < 1) {
        return quadIn(x) / 2;
    } else {
        return (-(pow((x - 2), 2) - 2)) / 2;
    }
}

function cubicIn(x) {
    return pow(x, 3);
}

function cubicOut(x) {
    return 1 + pow((x - 1), 3);
}

function cubicInOut(x) {
    x *= 2;
    if (x < 1) {
        return cubicIn(x) / 2;
    } else {
        return (pow((x - 2), 3) + 2) / 2;
    }
}

function quartIn(x) {
    return pow(x, 4);
}

function quartOut(x) {
    return 1 - pow((x - 1), 4);
}

function quartInOut(x) {
    x *= 2;
    if (x < 1) {
        return quartIn(x) / 2;
    } else {
        return (-(pow((x - 2), 4) - 2)) / 2;
    }
}

function _0(x) {
    return 0;
}

function _1(x) {
    return 1;
}

// easing functions array
const easeFuncs = [
    linear,
    sineIn,
    sineOut,
    sineInOut,
    quadIn,
    quadOut,
    quadInOut,
    cubicIn,
    cubicOut,
    cubicInOut,
    quartIn,
    quartOut,
    quartInOut,
    _0,
    _1
];

// linear interpolation
function lerp(start, end, t) {
    return start + (end - start) * t;
}

// tween execute function
function tweenExecute(nowTime, startTime, endTime, start, end, easeType = 0, easeHead = 0, easeTail = 1) {
    // calculate delta
    const rdt = ((nowTime - startTime) / (endTime - startTime));

    // if the easing is LINEAR, then return
    try {
        if (easeType === 0) {
            return lerp(start, end, rdt);
        } else {
            return lerp(start, end, easeFuncs[easeType](rdt));
        }
    } catch (error) {
        console.error(`Error! rdt:${rdt}`);
        if (rdt < 0) {
            return start;
        } else {
            return end;
        }
    }
}