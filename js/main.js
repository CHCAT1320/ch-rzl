const cvs = document.getElementById("playerCanvas");
// const canvas = cvs
const ctx = cvs.getContext("2d");
cvs.width = 360;
cvs.height = 640;
ctx.translate(cvs.width / 2, cvs.height / 2 + 200);


var chart = null;
function loadFormatJs(){
    const formatJs = document.createElement("script");
    formatJs.src = "js/format.js";
    formatJs.onload = function(){
        console.log("format.js加载成功")
    }
    document.head.appendChild(formatJs);
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
            audio.src = URL.createObjectURL(file);
        }
        catch(error){
            console.log(error)
        }

    }
    // 调用readAsText并传入文件内容
    reader.readAsText(file);
}

function start(){
    const audio = document.getElementById("bgm");
    audio.play();
}