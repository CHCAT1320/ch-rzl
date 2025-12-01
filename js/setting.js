var speedValue = 10
var speed = (215 / 32 + speedValue) * (10 / 129);

const bodyDiv = document.getElementById("body");
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
bodyDiv.appendChild(inputRange);

var revelationSize = 0.3
var isDrawAutoHand = false