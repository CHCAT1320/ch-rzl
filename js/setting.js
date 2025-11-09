var speedValue = 10
var speed = (215 / 32 + speedValue) * (10 / 129);

const inputRange = document.createElement("input");
inputRange.type = "range";
inputRange.min = 3;
inputRange.max = 20;
inputRange.value = 10;
inputRange.step = 1;
inputRange.id = "speedRange";
inputRange.oninput = function() {
    speedValue = Number(this.value);
    speed = (215 / 32 + speedValue) * (10 / 129);
}
document.body.appendChild(inputRange);

var revelationSize = 1
var isDrawAutoHand = true