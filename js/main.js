const cvs = document.getElementById("playerCanvas");
const ctx = cvs.getContext("2d");
// cvs.width = 360;
// cvs.height = 640;
// cvs.width = 720;
// cvs.height = 1280;
// cvs.width = 2160;
// cvs.height = 3840;
cvs.width = 1080;
cvs.height = 1920;
ctx.translate(cvs.width / 2, cvs.height / 2 + 200 * (cvs.height / 640));

var frameCount = 0;
var lastTime = 0;

// 创建音频上下文
const audioContext = new window.AudioContext();
var hitAudioBuffers = [];

function preloadSounds() {
    return new Promise((resolve, reject) => {
        const soundUrls = [
            'audio/hit.wav',
            'audio/drag.wav',
            'audio/hit.wav',
            'audio/fresh.ogg',
        ];
        const sounds = [];
        let loadedCount = 0;

        console.log('开始预加载音效');

        if (soundUrls.length === 0) {
            console.log('没有音效需要加载');
            resolve(sounds);
            return;
        }

        soundUrls.forEach((url, index) => {
            console.log(`正在加载音效: ${url}`);
            fetch(url)
                .then(response => {
                    console.log(`音效 ${url} 请求成功，状态码: ${response.status}`);
                    if (!response.ok) throw new Error(`请求音效 ${url} 失败，状态码: ${response.status}`);
                    return response.arrayBuffer();
                })
                .then(arrayBuffer => {
                    console.log(`音效 ${soundUrls[index]} 获取数组缓冲成功`);
                    return audioContext.decodeAudioData(arrayBuffer);
                })
                .then(audioBuffer => {
                    console.log(`音效 ${soundUrls[index]} 解码成功`);
                    sounds[index] = audioBuffer;
                    loadedCount++;
                    if (loadedCount === soundUrls.length) {
                        console.log('所有音效加载完成');
                        resolve(sounds);
                    }
                })
                .catch(error => {
                    console.error(`音效 ${soundUrls[index]} 加载失败:`, error);
                    reject(error);
                });
        });
    });
}

// 预加载音效
preloadSounds()
.then(sounds => {
    hitAudioBuffers = sounds;
    showPopup("音效加载完成", "info")
})
.catch(error => {
    console.error('音效加载失败:', error);
    showPopup("音效加载失败将忽略音效", "error");
});

function playSound(audioBufferIndex) {
    const audioBuffer = hitAudioBuffers[audioBufferIndex];
    if (!audioBuffer) {
        console.error('音频缓冲不存在');
        return;
    }
    // console.log('音频缓冲:', audioBuffer);
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.start(0);
}


var chart = null;
function loadSettingJs(){
    const settingJs = document.createElement("script");
    settingJs.src = "js/setting.js";
    settingJs.onload = function(){
        console.log("setting.js加载成功")
    }
    document.head.appendChild(settingJs);
}
loadSettingJs();
function loadFormatJs(){
    const formatJs = document.createElement("script");
    formatJs.src = "js/format.js";
    formatJs.onload = function(){
        console.log("format.js加载成功")
    }
    document.head.appendChild(formatJs);
    const formatCheckJs = document.createElement("script");
    formatCheckJs.src = "js/formatCheck.js";
    formatCheckJs.onload = function(){
        console.log("formatCheck.js加载成功")
        checkFormatChart();
    }
    document.head.appendChild(formatCheckJs);
}

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
                loadFormatJs();
                // console.log(chart.lines)
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
            audio.src = e.target.result;
        }
        catch(error){
            console.log(error)
        }

    }
    // 调用readAsText并传入文件内容
    reader.readAsDataURL(file);
}

// function start(){
//     const audio = document.getElementById("bgm");
//     audio.play();
// }