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

function circIn(x) {
    return 1 - Math.sqrt(1 - x ** 2)
}

function circOut(x) {
    return Math.sqrt(1 - Math.pow(x - 1, 2))
}

function circInOut(x) {
return x < 0.5
  ? (1 - Math.sqrt(1 - Math.pow(2 * x, 2))) / 2
  : (Math.sqrt(1 - Math.pow(-2 * x + 2, 2)) + 1) / 2;
}

// function expoIn(x) {
// return x === 0 ? 0 : Math.pow(2, 10 * x - 10);
// }
function expoOut(x) {
return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

// easing functions array
const easeFuncs = [
    linear, // 0
    sineIn, // 1
    sineOut, // 2
    sineInOut, // 3
    quadIn, // 4
    quadOut, // 5
    quadInOut, // 6
    cubicIn, // 7
    cubicOut, // 8
    cubicInOut, // 9
    quartIn, // 10
    quartOut, // 11
    quartInOut, // 12
    _0, // 13
    _1, // 14
    circIn, // 15
    circOut, // 16
    circInOut, // 17
    // expoOut, // 18
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