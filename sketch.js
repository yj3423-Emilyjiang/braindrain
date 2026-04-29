let faceMesh;
let video;
let faces = [];
let brainImg; 
let particles = [];
let virtualTime = 23; 
let meltRate = 0; 
let brainOffsets = []; 
let isBrainInitialized = false;

// 状态系统
let lastHour = 23;
let stayUpCount = 0; 
let currentMsg = null; 
let isSleeping = false;
let forceCollapse = false; 
let endingAlpha = 0; 

// 音频
let videoSounds = []; 
let videoIndex = 0; 
let textingSound, tinnitusSound, sleepSound;

function preload() {
  brainImg = loadImage('brain.png'); 
  // 关键：开启面部网格检测，maxFaces为1，不精细Landmarks
  faceMesh = ml5.faceMesh({ maxFaces: 1, refineLandmarks: false });
  soundFormats('mp3', 'wav');
  videoSounds.push(loadSound('shortvideo.mp3'));
  videoSounds.push(loadSound('shortvideo2.mp3'));
  videoSounds.push(loadSound('shortvideo3.mp3'));
  textingSound = loadSound('texting.mp3');
  tinnitusSound = loadSound('sound.mp3'); 
  sleepSound = loadSound('sleep.mp3'); 
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();
  faceMesh.detectStart(video, gotFaces);
  
  brainImg.loadPixels();
  let samplingRes = 8; 
  for (let x = 0; x < brainImg.width; x += samplingRes) {
    for (let y = 0; y < brainImg.height; y += samplingRes) {
      let index = (x + y * brainImg.width) * 4;
      if (brainImg.pixels[index + 3] > 50) {
        let offset = createVector(x - brainImg.width/2, y - brainImg.height/2);
        brainOffsets.push({ pos: offset, color: color(brainImg.pixels[index], brainImg.pixels[index+1], brainImg.pixels[index+2]) });
      }
    }
  }

  // 时间推进
  setInterval(() => {
    if(!isSleeping && !forceCollapse) virtualTime = (virtualTime + 1) % 24;
  }, 30000);
}

function gotFaces(results) { faces = results; }

function draw() {
  if (isSleeping) {
    drawEnding("Your brain is finally resting...\nHowever, some neural damage is irreversible.\nYou survived, but at a cost.");
    return;
  }
  
  if (forceCollapse) {
    drawEnding("CRITICAL ERROR: SYNAPTIC FAILURE.\nYour brain has forcefully shut down due to exhaustion.\nControl is an illusion now.");
    return;
  }

  background(15);
  
  // Glitch 效果
  let glitchOffset = createVector(0, 0);
  if (stayUpCount >= 4) {
    if (random(1) < 0.15) { 
      glitchOffset.x = random(-15, 15);
      glitchOffset.y = random(-5, 5);
      push();
      fill(random([color(255,0,0,50), color(0,0,255,50)]));
      noStroke();
      rect(random(width), random(height), random(100, 400), random(2, 15));
      pop();
    }
  }

  // 1. 绘制视频背景
  push();
  translate(width + glitchOffset.x, glitchOffset.y); 
  scale(-1, 1);
  let vW = width;
  let vH = (video.height / video.width) * width;
  let vY = (height - vH) / 2;
  image(video, 0, vY, vW, vH);
  pop();

  // 2. 检测脸部并绘制 AR
  if (faces.length > 0) {
    let face = faces[0];
    let forehead = face.keypoints[10]; // 额头参考点
    
    // 转换额头坐标
    let headX = width - map(forehead.x, 0, 640, 0, width); 
    let headY = map(forehead.y, 0, 480, vY, vY + vH);

    // 绘制脑子粒子
    if (!isBrainInitialized) {
      for (let data of brainOffsets) {
        particles.push(new BrainParticle(headX, headY, data.pos, data.color));
      }
      isBrainInitialized = true;
    }
    for (let p of particles) {
      p.updateBehavior(headX, headY);
      p.update();
      p.show();
    }

    // --- 【新功能】绘制高精度虹膜充血红色效果 ---
    // 这个位置在脑子后面绘制，确保脑子看起来还是浮在上面的
    drawIrisBloodshot(face, vY, vH);
  }

  // 整点对话逻辑
  if (virtualTime !== lastHour) {
    triggerDialog();
    lastHour = virtualTime;
  }
  if (currentMsg) currentMsg.display();
  
  drawUI();

  // 屏幕变暗
  let brightnessDrop = map(stayUpCount, 0, 5, 0, 255);
  fill(0, brightnessDrop);
  rect(0, 0, width, height);
}

// --- 【新版】高精度虹膜充血红色绘图函数 ---
function drawIrisBloodshot(face, vY, vH) {
  // 定义两眼虹膜的参考关键点 (FaceMesh的标准点位)
  // 左虹膜(leftIris): center(468), right(469), left(471), bottom(470), top(472)
  // 右虹膜(rightIris): center(473), right(474), left(476), bottom(475), top(477)
  let lIris = face.keypoints[468], lRight = face.keypoints[469];
  let rIris = face.keypoints[473], rRight = face.keypoints[474];

  if (lIris && lRight && rIris && rRight) {
    push();
    
    // 动态计算充血程度：越到后面越重 (Alpha 0 -> 210强烈浓红)
    let redAlpha = map(stayUpCount, 0, 5, 50, 255);
    
    // 颜色：带有羽化边缘的浓血红色
    let circleColor = color(200, 20, 20, redAlpha); 

    if (redAlpha < 1) { pop(); return; }

    // 绘制羽化软边缘，让红色自然地晕染在眼周，模拟“充血”
    drawingContext.filter = 'blur(8px)'; 

    // 绘制单虹膜充血辅助函数
    let drawSingleIrisCircle = (center, rightRef) => {
      // 转换虹膜坐标
      let cx = width - map(center.x, 0, 640, 0, width);
      let cy = map(center.y, 0, 480, vY, vY + vH);
      let rxRef = width - map(rightRef.x, 0, 640, 0, width);
      let ryRef = map(rightRef.y, 0, 480, vY, vY + vH);

      // 计算虹膜半径供参考
      let irisRadiusRef = dist(cx, cy, rxRef, ryRef);
      
      // 圆心位置设定在虹膜正下方，radius 的一小部分偏移量（紧贴眼下，不盖住眼睑）
      // 这里不偏移，直接用虹膜中心，大小随stayUpCount变化
      // 将半径增大，使其能覆盖更大的眼睛区域，模拟充血晕染
      let currentRedRadius = irisRadiusRef * 1.5; 

      fill(circleColor);
      noStroke();
      
      // 绘制覆盖虹膜的大椭圆
      // 如果stayUpCount增加，则让椭圆慢慢变大
      let dynamicEllipseW = currentRedRadius * map(redAlpha, 0, 210, 1.0, 1.3);
      let dynamicEllipseH = currentRedRadius * map(redAlpha, 0, 210, 1.1, 1.4);
      ellipse(cx, cy, dynamicEllipseW, dynamicEllipseH);
    };

    // 依次绘制两眼
    drawSingleIrisCircle(lIris, lRight); // 左虹膜充血
    drawSingleIrisCircle(rIris, rRight); // 右虹膜充血

    pop();
  }
}

// --- 结局渐显函数 (保持不变) ---
function drawEnding(msg) {
  background(0); 
  if(tinnitusSound.isPlaying() && !forceCollapse) tinnitusSound.stop();
  if (endingAlpha < 255) endingAlpha += 0.6; 

  textAlign(CENTER, CENTER);
  let titleCol = forceCollapse ? color(255, 0, 0, endingAlpha) : color(255, 255, 255, endingAlpha);
  
  fill(titleCol);
  textSize(28);
  text("SYSTEM STATUS", width/2, height/2 - 80);
  
  fill(200, 200, 200, endingAlpha); 
  textSize(18);
  text(msg, width/2, height/2 + 20);
}

// --- 其他类与函数 (保持不变) ---
class BrainParticle { constructor(hx, hy, offset, col) { this.offset = offset.copy().mult(0.12); this.pos = createVector(hx + this.offset.x, hy + this.offset.y); this.vel = createVector(0, 0); this.acc = createVector(0, 0); this.isFalling = false; this.alpha = 255; this.baseColor = col; } updateBehavior(hx, hy) { if (meltRate === 0) { this.pos.x = hx + this.offset.x; this.pos.y = hy + this.offset.y; } else { if (!this.isFalling && random(1) < 0.0004 * meltRate) this.isFalling = true; if (this.isFalling) { this.applyForce(createVector(0, 0.02 * meltRate)); this.vel.mult(0.97); } else { this.pos.x = hx + this.offset.x; this.pos.y = hy + this.offset.y; } } } applyForce(f) { this.acc.add(f); } update() { this.vel.add(this.acc); this.pos.add(this.vel); this.acc.mult(0); if (this.isFalling) this.alpha -= 0.4; } show() { if (this.alpha <= 0) return; noStroke(); fill(red(this.baseColor), green(this.baseColor), blue(this.baseColor), this.alpha); rect(this.pos.x, this.pos.y, 2.5, 2.5); } }
class BrainDialog { constructor(txt) { this.txt = txt; this.w = 420; this.h = 180; } display() { let x = width/2 - this.w/2; let y = height/2 - this.h/2; fill(0, 240); stroke(255, 100); strokeWeight(2); rect(x, y, this.w, this.h, 15); fill(255); noStroke(); textAlign(CENTER); textSize(18); text(this.txt, x+20, y+40, this.w-40); this.drawBtn(x + 60, y + 110, "YES (Sleep)", color(40, 120, 40)); this.drawBtn(x + 240, y + 110, "NO (Stay Up)", color(120, 40, 40)); } drawBtn(x, y, label, col) { fill(col); rect(x, y, 120, 40, 8); fill(255); textSize(14); text(label, x + 60, y + 25); } checkClick(mx, my) { let x = width/2 - this.w/2; let y = height/2 - this.h/2; if (mx > x+60 && mx < x+180 && my > y+110 && my < y+150) { isSleeping = true; endingAlpha = 0; if(tinnitusSound.isPlaying()) tinnitusSound.stop(); if(sleepSound.isLoaded()) sleepSound.play(); } if (mx > x+240 && mx < x+360 && my > y+110 && my < y+150) { stayUpCount++; meltRate = 2 + stayUpCount; currentMsg = null; if (stayUpCount >= 3) { if (!tinnitusSound.isPlaying()) { tinnitusSound.setVolume(0); tinnitusSound.loop(); } let targetVol = map(stayUpCount, 3, 5, 0.4, 1.0); tinnitusSound.setVolume(targetVol, 8.0); } if (stayUpCount >= 5) { forceCollapse = true; endingAlpha = 0; for (let s of videoSounds) { s.stop(); } textingSound.stop(); } } } }
function triggerDialog() { let msgs = ["I'm feeling slow...", "Connections flickering...", "Information leak...", "W-h-y stay up?", "SYSTEM COLLAPSE NEAR..."]; let baseText = msgs[min(stayUpCount, msgs.length-1)]; currentMsg = new BrainDialog(corruptText(baseText, stayUpCount)); }
function corruptText(str, level) { let chars = str.split(''); for (let i = 0; i < chars.length; i++) { if (random(1) < level * 0.15) chars[i] = level > 3 ? char(random(33, 126)) : char(random(97, 122)); } return chars.join(''); }
function drawUI() { fill(255); textAlign(LEFT); textSize(24); text("TIME: " + virtualTime + ":00", 40, 50); let btnY = 80; drawIconBtn(40, btnY, "📽️ VIDEOS", color(200, 50, 50, 200)); drawIconBtn(170, btnY, "💬 TEXTING", color(50, 150, 200, 200)); if (stayUpCount >= 3) { fill(255, 50, 50); textSize(16); textAlign(LEFT); text("WARNING: AUDITORY HALLUCINATIONS DETECTED", 40, 150); } }
function drawIconBtn(x, y, label, col) { stroke(255, 150); fill(col); rect(x, y, 120, 40, 8); fill(255); noStroke(); textAlign(CENTER); textSize(12); text(label, x + 60, y + 25); }
function mousePressed() { if (currentMsg) currentMsg.checkClick(mouseX, mouseY); let btnY = 80; if (mouseX > 40 && mouseX < 160 && mouseY > btnY && mouseY < btnY + 40) { meltRate += 1.5; for (let s of videoSounds) { if (s.isPlaying()) s.stop(); } let currentSound = videoSounds[videoIndex]; if (currentSound.isLoaded()) currentSound.play(); videoIndex = (videoIndex + 1) % videoSounds.length; } if (mouseX > 170 && mouseX < 290 && mouseY > btnY && mouseY < btnY + 40) { meltRate += 1.5; if (textingSound.isPlaying()) textingSound.stop(); if (textingSound.isLoaded()) textingSound.play(); } }
function windowResized() { resizeCanvas(windowWidth, windowHeight); }