// ========= BASIC SETUP =========
const canvas = document.getElementById("gameCanvas");

// Kích thước "thiết kế" cho game
const DESIGN_W = 600;
const DESIGN_H = 900;

// luôn vẽ theo size này (bất kể màn hình thật to hay nhỏ)
canvas.width  = DESIGN_W;
canvas.height = DESIGN_H;

const ctx = canvas.getContext("2d");
const W = DESIGN_W;
const H = DESIGN_H;


// Sửa để icon to hơn, vòng màu mỏng lại
const INNER_RATIO = 0.84;   // 0.68 → 0.84: vòng neon mỏng lại
const IMG_RATIO   = 1.28;

let currentScale = 1;

function resizeGame() {
  const wrapper = document.getElementById("gameWrapper");

  const availableW = window.innerWidth;
  const availableH = window.innerHeight;

  // game + HUD cao khoảng 960px (900 canvas + HUD + khoảng cách)
  const DESIGN_WRAPPER_H = 960;

  // scale theo chiều hạn chế hơn
  currentScale = Math.min(
    availableW / DESIGN_W,
    availableH / DESIGN_WRAPPER_H
  );

  wrapper.style.transform = `scale(${currentScale})`;
}

window.addEventListener("resize", resizeGame);
resizeGame();










const scoreEl = document.getElementById("score");
const timeEl = document.getElementById("time");

const HAMMER_HANDLE_LENGTH = 80;   // chiều dài cán búa
const HAMMER_HEAD_HEIGHT  = 26;    // cao đầu búa


// ========= LAYOUT =========

// Khung chơi neon bên trong (được hạ xuống cho cách PALSYS)
const frame = {
  x: 90,
  y: 160,
  w: 420,
  h: 360,
  radius: 28
};

// Khung lớn bên ngoài (card) – viền vàng, nằm dưới PALSYS
const outerCard = {
  x: 40,
  y: 110,
  w: W - 80,
  h: 430,
  radius: 40
};

// Bảng nâu hiển thị sản phẩm – nằm riêng bên dưới
// Bảng nâu hiển thị sản phẩdrawBottomPanelm – to hơn, gần bằng khung chính
const bottomPanel = {
  x: outerCard.x + 10,
  y: outerCard.y + outerCard.h + 30,
  w: outerCard.w - 20,
  h: 300,          // ↑ tăng chiều cao
  radius: 26
};
// Card hướng dẫn xuất hiện trước khi chơi
const introCard = {
  x: 70,
  y: 120,
  w: W - 140,
  h: 460,
  radius: 24
};

// Nút "Bắt đầu" bên trong card hướng dẫn
// Nút "Bắt đầu" bên trong card hướng dẫn
const startButton = {
  w: 180,
  h: 44,
  radius: 24,
  get x() {
    return introCard.x + introCard.w / 2 - this.w / 2;
  },
  get y() {
    return introCard.y + introCard.h - this.h - 8;
  }
};

// Nút "再玩一次" khi TIME UP
const restartButton = {
  w: 180,
  h: 48,
  radius: 24,
  get x() {
    return frame.x + frame.w / 2 - this.w / 2;
  },
  get y() {
    // nằm trong khung chơi, dưới dòng chữ TIME UP + Score
    return frame.x + frame.h / 2 + 130  // nếu thấy lệch có thể chỉnh lại
  }
};






// ========= GAME STATE =========
let score = 0;
let timeLeft = 1;
let lastTimeUpdate = null;
let gameOver = false;
let hasStarted = false;      // đã bấm Bắt đầu hay chưa
let showingIntro = true;     // đang ở màn hướng dẫn lần đầu
canvas.style.cursor = "default";  // lúc mới vào: thấy chuột

// ========= 6 SẢN PHẨM =========
const PRODUCTS = [
  {
    name: "產品 1",
    points: 1,
    outer1: "#ff80ab",
    outer2: "#ff4081",
    inner: "#2a0816",
    imageSrc: "product1.png"
  },
  {
    name: "產品 2",
    points: 2,
    outer1: "#ffa726",
    outer2: "#ff7043",
    inner: "#281307",
    imageSrc: "product2.png"
  },
  {
    name: " 產品 3",
    points: 3,
    outer1: "#42a5f5",
    outer2: "#7e57c2",
    inner: "#0a1024",
    imageSrc: "product3.png"
  },
  {
    name: "產品 4",
    points: 4,
    outer1: "#66bb6a",
    outer2: "#00e676",
    inner: "#021b11",
    imageSrc: "product4.png"
  },
  {
    name: "產品 5",
    points: 5,
    outer1: "#ffd54f",
    outer2: "#ffca28",
    inner: "#231400",
    imageSrc: "product5.png"
  },
  {
    name: "Palsys",
    points: -3,
    outer1: "#ff5252",
    outer2: "#ff1744",
    inner: "#270308",
    imageSrc: "palsys.png"
  }
];

const NUM_PRODUCTS = PRODUCTS.length;

// Load ảnh sản phẩm
const productImages = PRODUCTS.map(p => {
  const img = new Image();
  img.src = p.imageSrc;
  return img;
});

// Đếm số lần đập từng sản phẩm
let hitCounts = new Array(NUM_PRODUCTS).fill(0);

// Danh sách mục tiêu, particle, impact, floating scores
const targets = [];
const particles = [];
const impacts = [];
const floatingScores = [];

// ========= SPAWN RANDOM TRONG KHUNG =========
const TARGET_RADIUS = 55;
const TARGET_LIFE = 1500;
const BASE_SPAWN_INTERVAL = 250;  // mặc định
const BASE_MAX_TARGETS = 6;       // mặc định
let lastSpawn = 0;
function isFeverActive(timestamp) {
  return feverActive && timestamp < feverEndTime;
}

function getCurrentSpawnInterval(timestamp) {
  return isFeverActive(timestamp)
    ? BASE_SPAWN_INTERVAL / FEVER_SPEED_MULT
    : BASE_SPAWN_INTERVAL;
}

function getCurrentMaxTargets(timestamp) {
  return isFeverActive(timestamp)
    ? Math.round(BASE_MAX_TARGETS * FEVER_SPEED_MULT)
    : BASE_MAX_TARGETS;
}


// ========= COMBO =========
let combo = 0;
let comboTimer = 0;

// combo càng cao, nhân điểm càng nhiều
function getComboMultiplier(combo) {
  if (combo <= 1) return 1;      // hit đầu tiên: bình thường
  if (combo <= 3) return 1.5;    // 2–3 hit liên tiếp
  if (combo <= 5) return 2;      // 4–5 hit liên tiếp
  return 3;                      // 6+ hit: x3
}
// ===== FEVER MODE (combo >= 15) =====
const FEVER_DURATION = 5000;       // 5 giây
const FEVER_SPEED_MULT = 4.5;      // nhanh + nhiều mục tiêu gấp 2.5 lần

let feverActive = false;           // đang trong Fever hay không
let feverEndTime = 0;              // timestamp kết thúc Fever
let feverFlashTimer = 0;           // để vẽ Combo chữ to + sáng lúc vừa kích hoạt



// ========= HAMMER =========
const hammer = {
  x: W / 2,
  y: H / 2,
  angle: -1.2,      // góc nghỉ hơi ngửa lên (giống bản bạn khen)
  restAngle: -1.2,
  swingAngle: 1.6,  // xoay xuống khoảng ~90°
  isSwinging: false,
  swingStart: 0,
  swingDuration: 130,
  offset: 0,
  maxOffset: 10
};







// ========= SCREEN SHAKE =========
const shake = {
  time: 0,
  duration: 0,
  intensity: 0
};

function triggerScreenShake() {
  shake.time = 0;
  shake.duration = 200;
  shake.intensity = 7;
}
let negativeFlashTime = 0;
const NEGATIVE_FLASH_DURATION = 200;  // 0.2s flash đỏ



// ========= DECORATIONS =========
const orbs = [];
for (let i = 0; i < 5; i++) {
  orbs.push({
    cx: frame.x + frame.w / 2,
    cy: frame.y + frame.h / 2,
    radius: 90 + Math.random() * 80,
    size: 4 + Math.random() * 4,
    angle: Math.random() * Math.PI * 2,
    speed: (Math.random() * 0.0006 + 0.0003) * (i % 2 === 0 ? 1 : -1),
    color1: i % 2 === 0 ? "rgba(255, 214, 0, 0.9)" : "rgba(255, 138, 101, 0.9)",
    color2: "rgba(0,0,0,0)"
  });
}

// ========= UTILS =========
function updateHUD() {
  scoreEl.textContent = score;
  timeEl.textContent = Math.max(0, Math.floor(timeLeft));
}

function activeTargetCount(now) {
  return targets.filter(t => !t.hit && now - t.spawnTime <= TARGET_LIFE).length;
}

function randomTargetPosition() {
  const margin = TARGET_RADIUS + 10;
  const minX = frame.x + margin;
  const maxX = frame.x + frame.w - margin;
  const minY = frame.y + margin;
  const maxY = frame.y + frame.h - margin;

  return {
    x: minX + Math.random() * (maxX - minX),
    y: minY + Math.random() * (maxY - minY)
  };
}

function spawnTarget(timestamp) {
  const maxTargets = getCurrentMaxTargets(timestamp);
  if (activeTargetCount(timestamp) >= maxTargets) return;

  const pos = randomTargetPosition();

  let variant;
  if (isFeverActive(timestamp)) {
    // Trong FEVER: chỉ spawn 5 sản phẩm cộng điểm (bỏ Palsys trừ điểm)
    variant = Math.floor(Math.random() * (NUM_PRODUCTS - 1));
  } else {
    // Bình thường: spawn cả 6 loại
    variant = Math.floor(Math.random() * NUM_PRODUCTS);
  }

  targets.push({
    x: pos.x,
    y: pos.y,
    radius: TARGET_RADIUS,
    spawnTime: timestamp,
    hit: false,
    variant
  });

  lastSpawn = timestamp;
}


function spawnHitParticles(x, y) {
  const count = 24;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 4;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 400 + Math.random() * 300,
      age: 0,
      size: 3 + Math.random() * 3
    });
  }
}

function spawnImpactEffect(x, y) {
  const segments = [];
  const count = 14;
  const baseR = 28;

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
    const innerR = baseR + (Math.random() - 0.5) * 8;
    const outerR = innerR + 10 + Math.random() * 12;
    segments.push({ angle, innerR, outerR });
  }

  impacts.push({
    x,
    y,
    age: 0,
    life: 220,
    segments
  });
}

function triggerHitEffects(x, y) {
  spawnHitParticles(x, y);
  spawnImpactEffect(x, y);
  triggerScreenShake();
}

// ========= FLOATING SCORES =========
function spawnFloatingScore(x, y, points) {
  const text = points > 0 ? `+${points}` : `${points}`;
  const color = points > 0 ? "#c5ff90" : "#ff5252";

  floatingScores.push({
    x,
    y,
    text,
    color,
    age: 0,
    life: 900
  });
}

function drawFloatingScores(delta) {
  for (let i = floatingScores.length - 1; i >= 0; i--) {
    const f = floatingScores[i];
    f.age += delta;
    if (f.age >= f.life) {
      floatingScores.splice(i, 1);
      continue;
    }
    const t = f.age / f.life;
    const alpha = 1 - t;
    f.y -= 0.06 * delta;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = f.color;
    ctx.font = "bold 26px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(f.text, f.x, f.y);
    ctx.restore();
  }
}

// ========= INPUT: MOUSE =========
function getCanvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
  const my = (e.clientY - rect.top) * (canvas.height / rect.height);
  return { mx, my };
}

canvas.addEventListener("mousemove", (e) => {
  const { mx, my } = getCanvasPos(e);
  hammer.x = mx;   // ĐẦU BÚA = chuột
  hammer.y = my;
});


canvas.addEventListener("mousedown", (e) => {
  const { mx, my } = getCanvasPos(e);

  // Nếu đang ở màn intro: chỉ xử lý nút Bắt đầu
 if (showingIntro) {
  if (
    mx >= startButton.x &&
    mx <= startButton.x + startButton.w &&
    my >= startButton.y &&
    my <= startButton.y + startButton.h
  ) {
    showingIntro = false;
    hasStarted = true;
    lastTimeUpdate = lastFrameTime;
    canvas.style.cursor = "none";  // vào game: ẩn chuột, chỉ thấy búa
  }
  return;
}

  hammer.x = mx;
  hammer.y = my;

  // Nếu TIME UP và click: chơi lại ngay, không hiện intro nữa
    // Nếu TIME UP: chỉ khi click nút "再玩一次" mới chơi lại
  if (gameOver) {
    const bx = restartButton.x;
    const by = restartButton.y;
    const bw = restartButton.w;
    const bh = restartButton.h;

    if (mx >= bx && mx <= bx + bw && my >= by && my <= by + bh) {
      resetGame();
      hasStarted = true;
      gameOver = false;
      lastTimeUpdate = lastFrameTime;
      canvas.style.cursor = "none";   // vào game ẩn con trỏ, chỉ còn búa
    }
    return;
  }



  hammer.isSwinging = true;
  hammer.swingStart = lastFrameTime;

  // LẤY VỊ TRÍ ĐẦU BÚA TẠI THỜI ĐIỂM CLICK
  const headPos = getHammerHeadPos();

  for (let i = targets.length - 1; i >= 0; i--) {
    const t = targets[i];
    if (t.hit) continue;

    const dx = headPos.x - t.x;
    const dy = headPos.y - t.y;
    const dist = Math.hypot(dx, dy);

        if (dist <= t.radius) {
      t.hit = true;
      const product = PRODUCTS[t.variant];

      let earned = product.points;

      if (product.points > 0) {
        // ===== ĐÁNH TRÚNG SẢN PHẨM CỘNG ĐIỂM =====
        combo++;
        comboTimer = 800;

        const mult = getComboMultiplier(combo);
        earned = Math.round(product.points * mult);

        // Khi combo đạt 15 lần liên tiếp → bật FEVER
        if (!feverActive && combo === 10) {
          feverActive = true;
          feverEndTime = lastFrameTime + FEVER_DURATION;
          feverFlashTimer = 800;  // Combo chữ to & sáng trong khoảng 0.8s
        }
      } else {
        // ===== ĐÁNH TRÚNG SẢN PHẨM TRỪ ĐIỂM =====
        combo = 0;
        comboTimer = 0;

        // tắt FEVER nếu đang bật
        feverActive = false;
        feverFlashTimer = 0;

        // flash đỏ + rung mạnh hơn
        negativeFlashTime = NEGATIVE_FLASH_DURATION;
        shake.intensity = 12;
        shake.duration = 260;
        shake.time = 0;
      }

      score += earned;
      hitCounts[t.variant] += 1;

      // Hiệu ứng nổ chung
      triggerHitEffects(t.x, t.y);
      // Bong bóng điểm (dương / âm)
      spawnFloatingScore(t.x, t.y - 10, earned);

      updateHUD();
      break;
    }

  }
});



// ========= RESET =========
function resetGame() {
  score = 0;
  timeLeft = 60;
  gameOver = false;
  hasStarted = false;   // reset trạng thái đã bắt đầu

  lastSpawn = 0;
  lastTimeUpdate = null;
  combo = 0;
  comboTimer = 0;

  targets.length = 0;
  particles.length = 0;
  impacts.length = 0;
  floatingScores.length = 0;
  hitCounts = new Array(NUM_PRODUCTS).fill(0);

  updateHUD();
}


// ========= BACKGROUND & TOP BAR =========
function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#2c2d5c");
  g.addColorStop(0.4, "#131228");
  g.addColorStop(1, "#060511");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// Thanh vàng PALSYS – đã bỏ 2 thanh nhỏ hai bên
function drawTopBar() {
  const barX = 30;
  const barY = 10;
  const barW = W - 60;
  const barH = 60;

  ctx.save();

  const grad = ctx.createLinearGradient(barX, barY, barX, barY + barH);
  grad.addColorStop(0, "#fff8e1");
  grad.addColorStop(0.4, "#ffe082");
  grad.addColorStop(1, "#ffb74d");

  ctx.shadowColor = "rgba(255, 215, 64, 0.8)";
  ctx.shadowBlur = 25;
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, 30);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#5d4037";
  ctx.font = "bold 32px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Palsys 打地鼠 ", barX + barW / 2, barY + barH / 2 + 2);

  ctx.restore();
}

// ========= OUTER CARD & DECOR =========
function drawOuterCard() {
  ctx.save();
  const { x, y, w, h, radius } = outerCard;

  ctx.shadowColor = "rgba(255, 214, 0, 0.7)";
  ctx.shadowBlur = 40;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fillStyle = "#05040d";
  ctx.fill();

  const borderGrad = ctx.createLinearGradient(x, y, x + w, y + h);
  borderGrad.addColorStop(0, "rgba(255, 241, 118, 0.95)");
  borderGrad.addColorStop(0.5, "rgba(255, 213, 79, 0.9)");
  borderGrad.addColorStop(1, "rgba(255, 171, 64, 0.95)");
  ctx.shadowBlur = 0;
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.restore();
}

function drawDecorations(delta) {
  for (const orb of orbs) {
    orb.angle += orb.speed * delta;
    const x = orb.cx + Math.cos(orb.angle) * orb.radius;
    const y = orb.cy + Math.sin(orb.angle) * orb.radius;

    ctx.save();
    const g = ctx.createRadialGradient(x, y, 0, x, y, orb.size * 3);
    g.addColorStop(0, orb.color1);
    g.addColorStop(1, orb.color2);
    ctx.fillStyle = g;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.arc(x, y, orb.size * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ========= FRAME =========
function drawFrame() {
  ctx.save();

  const borderGrad = ctx.createLinearGradient(
    frame.x,
    frame.y,
    frame.x + frame.w,
    frame.y + frame.h
  );
  borderGrad.addColorStop(0, "#40c4ff");
  borderGrad.addColorStop(0.5, "#18ffff");
  borderGrad.addColorStop(1, "#ff4081");

  ctx.lineWidth = 6;
  ctx.strokeStyle = borderGrad;
  ctx.beginPath();
  ctx.roundRect(frame.x, frame.y, frame.w, frame.h, frame.radius);
  ctx.stroke();

  const innerGrad = ctx.createLinearGradient(
    0,
    frame.y,
    0,
    frame.y + frame.h
  );
  innerGrad.addColorStop(0, "#17152f");
  innerGrad.addColorStop(1, "#050513");
  ctx.fillStyle = innerGrad;
  ctx.beginPath();
  ctx.roundRect(
    frame.x + 3,
    frame.y + 3,
    frame.w - 6,
    frame.h - 6,
    frame.radius - 6
  );
  ctx.fill();

  ctx.restore();
}
const TARGET_INNER_COLOR = "#e4e6f3ff";  // tím đậm dịu dịu

// ========= TARGETS =========
function drawTargets(timestamp) {
  for (const t of targets) {
    const age = timestamp - t.spawnTime;
    if (t.hit || age > TARGET_LIFE) continue;

    const lifeRatio = age / TARGET_LIFE;
    let scale = 1;
    if (lifeRatio < 0.2) {
      scale = 0.4 + (lifeRatio / 0.2) * 0.6;
    } else if (lifeRatio > 0.8) {
      scale = 1 - ((lifeRatio - 0.8) / 0.2) * 0.4;
    }

    const radius = t.radius * scale;
    const product = PRODUCTS[t.variant];

    ctx.save();
    ctx.translate(t.x, t.y);

    ctx.shadowColor = product.outer1;
    ctx.shadowBlur = 32;

    const outer = ctx.createRadialGradient(0, 0, radius * 0.25, 0, 0, radius);
    outer.addColorStop(0, "rgba(255,255,255,0.95)");
    outer.addColorStop(0.4, product.outer1);
    outer.addColorStop(1, product.outer2);
    ctx.beginPath();
    ctx.fillStyle = outer;
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    const inner = ctx.createRadialGradient(0, 0, 4, 0, 0, radius * 0.68);
    // ĐỔI THÀNH
    inner.addColorStop(0, "#ffffff");
    inner.addColorStop(1, TARGET_INNER_COLOR);
    ctx.beginPath();
    ctx.fillStyle = inner;
    ctx.arc(0, 0, radius *INNER_RATIO, 0, Math.PI * 2);
    ctx.fill();

    const img = productImages[t.variant];
    if (img && img.complete) {
      const size = radius * IMG_RATIO;
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
    }

    ctx.restore();
  }
}




// ========= PARTICLES & IMPACT =========
function drawParticles(delta) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.age += delta;
    if (p.age >= p.life) {
      particles.splice(i, 1);
      continue;
    }
    const t = p.age / p.life;

    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.08;

    ctx.save();
    ctx.globalAlpha = 1 - t;
    const g = ctx.createRadialGradient(
      p.x,
      p.y,
      0,
      p.x,
      p.y,
      p.size
    );
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.4, "#00e5ff");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.beginPath();
    ctx.fillStyle = g;
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawImpacts(delta) {
  for (let i = impacts.length - 1; i >= 0; i--) {
    const imp = impacts[i];
    imp.age += delta;
    if (imp.age >= imp.life) {
      impacts.splice(i, 1);
      continue;
    }
    const t = imp.age / imp.life;
    const alpha = 1 - t;
    const scale = 1 + t * 0.8;

    ctx.save();
    ctx.translate(imp.x, imp.y);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;

    ctx.beginPath();
    imp.segments.forEach((seg) => {
      const r1 = seg.innerR * scale;
      const r2 = seg.outerR * scale;
      const x1 = Math.cos(seg.angle) * r1;
      const y1 = Math.sin(seg.angle) * r1;
      const x2 = Math.cos(seg.angle) * r2;
      const y2 = Math.sin(seg.angle) * r2;
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    });
    ctx.stroke();
    ctx.restore();
  }
}

// ========= COMBO =========
function drawCombo() {
  if (comboTimer <= 0 || combo <= 1) return;

  const baseAlpha = Math.min(1, comboTimer / 800);

  ctx.save();

  let fontSize = 28;
  let color = "#ffdd33";
  let glow = false;

  // Nếu đang trong FEVER hoặc vừa kích hoạt FEVER → chữ to & sáng
  if (feverActive || feverFlashTimer > 0) {
    fontSize = 38;
    color = "#fff59d";
    glow = true;

    // nhẹ hiệu ứng phập phồng cho đã mắt
    const pulse = 1 + 0.08 * Math.sin(Date.now() / 80);
    ctx.translate(W / 2, frame.y - 15);
    ctx.scale(pulse, pulse);
    ctx.translate(-W / 2, -(frame.y - 15));
  }

  ctx.globalAlpha = baseAlpha;
  ctx.fillStyle = color;
  ctx.font = `bold ${fontSize}px 'Segoe UI', sans-serif`;
  ctx.textAlign = "center";

  if (glow) {
    ctx.shadowColor = "rgba(255, 241, 118, 0.9)";
    ctx.shadowBlur = 18;
  }

  ctx.fillText(`Combo x${combo}`, W / 2, frame.y - 15);

  ctx.restore();
}


// ========= MINI ICON =========
function drawMiniProductIcon(cx, cy, productIndex, r) {
  const product = PRODUCTS[productIndex];

  ctx.save();
  ctx.translate(cx, cy);

  // outer glow mỏng
  ctx.beginPath();
  const outer = ctx.createRadialGradient(0, 0, r * 0.25, 0, 0, r);
  outer.addColorStop(0, "#ffffff");
  outer.addColorStop(0.5, product.outer1);
  outer.addColorStop(1, product.outer2);
  ctx.fillStyle = outer;
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // inner
   ctx.beginPath();
  const inner = ctx.createRadialGradient(0, 0, 3, 0, 0, r * 0.75);
  inner.addColorStop(0, "#ffffff");
  inner.addColorStop(1, TARGET_INNER_COLOR);  // <<< dùng hằng màu sáng
  ctx.fillStyle = inner;
  ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2);
  ctx.fill();

  const img = productImages[productIndex];
  if (img && img.complete) {
    const size = r * 1.5;
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
  }

  ctx.restore();
}


// ========= BẢNG NÂU – GRID 2 HÀNG =========
function drawBottomPanel() {
  const p = bottomPanel;
  ctx.save();

  // Panel nâu
  ctx.beginPath();
  ctx.roundRect(p.x, p.y, p.w, p.h, p.radius);
  const g = ctx.createLinearGradient(0, p.y, 0, p.y + p.h);
  g.addColorStop(0, "#5b3b26");
  g.addColorStop(1, "#2b1a11");
  ctx.fillStyle = g;
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Score & Time
  ctx.fillStyle = "#ffe9c6";
  ctx.font = "bold 22px 'Segoe UI', sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`Score: ${score}`, p.x + 26, p.y + 34);

  ctx.textAlign = "right";
  ctx.fillText(
    `Time: ${Math.max(0, Math.floor(timeLeft))}s`,
    p.x + p.w - 26,
    p.y + 34
  );

  // gạch ngang
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(p.x + 24, p.y + 46);
  ctx.lineTo(p.x + p.w - 24, p.y + 46);
  ctx.stroke();

// ====== GRID 2 HÀNG × 3 CỘT ======
const rows = 2;
const cols = 3;
const gridMarginX = 32;

// chừa chỗ trên cho Score/Time, dưới chừa 1 chút margin
const gridTop = p.y + 60;
const gridBottom = p.y + p.h - 28;

const cellW = (p.w - gridMarginX * 2) / cols;
const cellH = (gridBottom - gridTop) / rows;
const cellRadius = 20;



  for (let i = 0; i < NUM_PRODUCTS; i++) {
    const product = PRODUCTS[i];
    const row = Math.floor(i / cols);
    const col = i % cols;

    const sx = p.x + gridMarginX + col * cellW;
    const sy = gridTop + row * cellH;

    const isNegative = product.points < 0;

    // nền card
    ctx.save();
    ctx.beginPath();
    const cardGrad = ctx.createLinearGradient(sx, sy, sx, sy + cellH);
    if (isNegative) {
      cardGrad.addColorStop(0, "#4a1515");
      cardGrad.addColorStop(1, "#2b0505");
    } else {
      cardGrad.addColorStop(0, "#4b3623");
      cardGrad.addColorStop(1, "#2a1a11");
    }
    ctx.roundRect(
      sx + 6,
      sy + 4,
      cellW - 12,
      cellH - 8,
      cellRadius
    );
    ctx.fillStyle = cardGrad;
    ctx.fill();

    ctx.strokeStyle = isNegative
      ? "rgba(255, 138, 128, 0.8)"
      : "rgba(255, 241, 188, 0.6)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // ICON Ở TRÊN, TEXT Ở DƯỚI – KHÔNG ĐÈ LÊN NHAU
   const cx = sx + cellW / 2;
    const iconRadius = 28;                 // icon lớn hơn
    const iconY = sy + 10 + iconRadius;    // đẩy xuống chút cho cân

    drawMiniProductIcon(cx, iconY, i, iconRadius);

    // Tên sản phẩm – to hơn và thấp hơn
    ctx.font = "14px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffe9c6";
    const nameY = sy + cellH - 25;
    ctx.fillText(product.name, cx, nameY);

    // Dòng xN + điểm – rõ hơn
    const count = hitCounts[i];
    const ptsSign = product.points > 0 ? `+${product.points}` : `${product.points}`;
    const prefix = product.points > 0 ? "" : "";
    const statsText = `${prefix} x${count} ${ptsSign}`;

    ctx.font = "13px 'Segoe UI', sans-serif";
    ctx.fillStyle = isNegative ? "#ff8a80" : "#c5ff90";
    const statsY = sy + cellH - 10;
    ctx.fillText(statsText, cx, statsY);
    }

    ctx.restore();
}

function drawIntroOverlay() {
  ctx.save();

  // nền mờ phủ toàn màn
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, 0, W, H);

  const c = introCard;

  // ===== CARD NÂU =====
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 24;
  ctx.beginPath();
  ctx.roundRect(c.x, c.y, c.w, c.h, c.radius);
  const grad = ctx.createLinearGradient(c.x, c.y, c.x, c.y + c.h);
  grad.addColorStop(0, "#5b3b26");
  grad.addColorStop(1, "#2b1a11");
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // ===== 標題 =====
  ctx.fillStyle = "#ffe9c6";
  ctx.font = "bold 28px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("遊戲說明", c.x + c.w / 2, c.y + 18);

  // ===== 玩法說明 / Combo / FEVER =====
  ctx.font = "15px 'Segoe UI', sans-serif";
  ctx.fillStyle = "#fff3e0";
  const centerX = c.x + c.w / 2;
  const lineY = c.y + 64;

  ctx.fillText("・點擊發光的商品圖示來「打地鼠」🎯", centerX, lineY);
  ctx.fillText("・每個商品有不同分數，連續命中會累積 Combo。", centerX, lineY + 22);
  ctx.fillText("・Combo 達 10 進入 FEVER 模式：商品變多變快，", centerX, lineY + 44);
  ctx.fillText("　且 5 秒內不會出現扣分商品。", centerX, lineY + 66);

  // ===== LƯỚI 2x3 – Ô SẢN PHẨM =====
  const rows = 2;
  const cols = 3;
  const gridMarginX = 24;
  const gridTop = lineY + 90;          // đẩy xuống thấp hơn 1 chút cho đủ chỗ text
  const gridBottom = c.y + c.h - 80;   // chừa chỗ cho cảnh báo + nút

  const cellW = (c.w - gridMarginX * 2) / cols;
  const cellH = (gridBottom - gridTop) / rows;
  const cellRadius = 20;
  const iconRadius = 30;

  for (let i = 0; i < NUM_PRODUCTS; i++) {
    const product = PRODUCTS[i];
    const row = Math.floor(i / cols);
    const col = i % cols;

    const sx = c.x + gridMarginX + col * cellW;
    const sy = gridTop + row * cellH;

    const isNegative = product.points < 0;

    // nền card
    ctx.save();
    ctx.beginPath();
    const cardGrad = ctx.createLinearGradient(sx, sy, sx, sy + cellH);
    if (isNegative) {
      cardGrad.addColorStop(0, "#4a1515");
      cardGrad.addColorStop(1, "#2b0505");
    } else {
      cardGrad.addColorStop(0, "#4b3623");
      cardGrad.addColorStop(1, "#2a1a11");
    }
    ctx.roundRect(
      sx + 4,
      sy + 4,
      cellW - 8,
      cellH - 8,
      cellRadius
    );
    ctx.fillStyle = cardGrad;
    ctx.fill();

    ctx.strokeStyle = isNegative
      ? "rgba(255, 138, 128, 0.8)"
      : "rgba(255, 241, 188, 0.6)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    // ICON
    const cx = sx + cellW / 2;
    const iconY = sy + 10 + iconRadius;
    drawMiniProductIcon(cx, iconY, i, iconRadius);

    // Tên sản phẩm
    ctx.font = "14px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffe9c6";
    const nameY = sy + cellH - 38;
    ctx.fillText(product.name, cx, nameY);

    // Điểm
    const ptsText = product.points > 0
      ? `+${product.points} 分`
      : `${product.points} 分`;
    ctx.font = "13px 'Segoe UI', sans-serif";
    ctx.fillStyle = isNegative ? "#ff8a80" : "#c5ff90";
    const ptsY = sy + cellH - 20;
    ctx.fillText(ptsText, cx, ptsY);
  }

  // ===== Cảnh báo Palsys trừ điểm / mất combo / tắt FEVER =====
  const warnY = gridBottom + 8;
  ctx.font = "13px 'Segoe UI', sans-serif";
  ctx.fillStyle = "#ffcc80";
  ctx.textAlign = "center";
  ctx.fillText(
    "避開 Palsys（紅色）產品 ─ 打中會扣分，並重置 Combo / 結束 FEVER！",
    c.x + c.w / 2,
    warnY
  );

  // ===== Nút 「開始遊戲」 =====
  const bx = startButton.x;
  const by = startButton.y;
  const bw = startButton.w;
  const bh = startButton.h;

  ctx.beginPath();
  const btnGrad = ctx.createLinearGradient(bx, by, bx, by + bh);
  btnGrad.addColorStop(0, "#ffecb3");
  btnGrad.addColorStop(1, "#ffb74d");
  ctx.roundRect(bx, by, bw, bh, startButton.radius);
  ctx.fillStyle = btnGrad;
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#5d4037";
  ctx.font = "bold 18px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("開始遊戲", bx + bw / 2, by + bh / 2 + 1);

  ctx.restore();
}






// ========= GAME OVER =========
function drawGameOver() {
  ctx.save();

  // Che mờ phần khung chơi
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.beginPath();
  ctx.roundRect(
    frame.x + 3,
    frame.y + 3,
    frame.w - 6,
    frame.h - 6,
    frame.radius - 6
  );
  ctx.fill();

  const centerX = frame.x + frame.w / 2;
  const centerY = frame.y + frame.h / 2;

  // 標題：時間到！
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 40px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("時間到！", centerX, centerY - 50);

  // 得分
  ctx.fillStyle = "#00e5ff";
  ctx.font = "24px 'Segoe UI', sans-serif";
  ctx.fillText(`得分：${score}`, centerX, centerY - 10);

  // 提示文字
  ctx.fillStyle = "#ffeb3b";
  ctx.font = "16px 'Segoe UI', sans-serif";
  ctx.fillText("點擊「再玩一次」開始新遊戲！", centerX, centerY + 24);

  // Nút 再玩一次
  const bx = restartButton.x;
  const by = restartButton.y;
  const bw = restartButton.w;
  const bh = restartButton.h;

  ctx.beginPath();
  const grad = ctx.createLinearGradient(bx, by, bx, by + bh);
  grad.addColorStop(0, "#ffecb3");
  grad.addColorStop(1, "#ffb74d");
  ctx.roundRect(bx, by, bw, bh, restartButton.radius);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#5d4037";
  ctx.font = "bold 18px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("再玩一次", bx + bw / 2, by + bh / 2 + 1);

  ctx.restore();
}


// ========= HAMMER UPDATE & DRAW =========
function updateHammer(timestamp) {
  if (!hammer.isSwinging) {
    hammer.angle = hammer.restAngle;
    hammer.offset = 0;
    return;
  }
  const t = (timestamp - hammer.swingStart) / hammer.swingDuration;
  if (t >= 1) {
    hammer.isSwinging = false;
    hammer.angle = hammer.restAngle;
    hammer.offset = 0;
  } else {
    const swing = Math.sin(t * Math.PI);
    hammer.angle = hammer.restAngle + hammer.swingAngle * swing;
    hammer.offset = hammer.maxOffset * swing;
  }
}
function drawHammer() {
  const h = hammer;

  const handleLen   = HAMMER_HANDLE_LENGTH;
  const headWidth   = 70;
  const headHeight  = HAMMER_HEAD_HEIGHT;
  const handleWidth = 12;

  // (x, y) = CHÂN CÁN BÚA
  ctx.save();
  ctx.translate(h.x, h.y + h.offset);
  ctx.rotate(h.angle);

  // ===== CÁN BÚA (từ pivot đi lên trên) =====
  const handleGrad = ctx.createLinearGradient(0, 0, 0, -handleLen);
  handleGrad.addColorStop(0, "#ffe082");
  handleGrad.addColorStop(1, "#ffb300");

  ctx.beginPath();
  ctx.fillStyle = handleGrad;
  ctx.roundRect(
    -handleWidth / 2,
    -handleLen,
    handleWidth,
    handleLen,
    handleWidth / 2
  );
  ctx.fill();

  ctx.strokeStyle = "#5d4037";
  ctx.lineWidth = 2;
  ctx.stroke();

  // núm tròn ở chân cán
  ctx.beginPath();
  ctx.arc(0, 0, handleWidth / 1.3, 0, Math.PI * 2);
  ctx.fillStyle = "#5d4037";
  ctx.fill();

  // ===== ĐẦU BÚA – thanh ngang ở đỉnh cán =====
  ctx.save();
  ctx.translate(0, -handleLen - headHeight / 2);

  ctx.shadowColor = "rgba(0, 229, 255, 0.9)";
  ctx.shadowBlur = 18;

  const headGrad = ctx.createLinearGradient(
    -headWidth / 2,
    -headHeight / 2,
    headWidth / 2,
    headHeight / 2
  );
  headGrad.addColorStop(0, "#ffcc80");
  headGrad.addColorStop(0.5, "#ffb74d");
  headGrad.addColorStop(1, "#ff9800");

  ctx.beginPath();
  ctx.roundRect(
    -headWidth / 2,
    -headHeight / 2,
    headWidth,
    headHeight,
    headHeight / 2
  );
  ctx.fillStyle = headGrad;
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#5d4037";
  ctx.lineWidth = 3;
  ctx.stroke();

  // highlight nhẹ
  ctx.beginPath();
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 2;
  ctx.moveTo(-headWidth / 2 + 6, -headHeight / 4);
  ctx.lineTo(headWidth / 2 - 6, -headHeight / 4);
  ctx.stroke();

  ctx.restore();  // xong đầu búa
  ctx.restore();  // xong búa
}


function getHammerHeadPos() {
  const handleLen  = HAMMER_HANDLE_LENGTH;
  const headHeight = HAMMER_HEAD_HEIGHT;

  // khoảng cách từ chân cán tới tâm đầu búa
  const offset = handleLen + headHeight / 2;

  const angle = hammer.angle;
  const sinA  = Math.sin(angle);
  const cosA  = Math.cos(angle);

  // trong hệ trục local: đầu búa ở (0, -offset)
  const localX = 0;
  const localY = -offset;

  // đổi sang tọa độ canvas
  const worldX = hammer.x + localX * cosA - localY * sinA;
  const worldY = hammer.y + localX * sinA + localY * cosA;

  return { x: worldX, y: worldY };
}



// ========= MAIN LOOP =========
let lastFrameTime = 0;

function loop(timestamp) {
  const delta = timestamp - lastFrameTime;
  lastFrameTime = timestamp;

  // ===== cập nhật thời gian / logic như cũ =====
  if (!lastTimeUpdate) lastTimeUpdate = timestamp;
  const dtSec = (timestamp - lastTimeUpdate) / 1000;
  if (!gameOver && hasStarted) {
  timeLeft -= dtSec;
  if (timeLeft <= 0) {
    timeLeft = 0;
    gameOver = true;

    // === hiện lại mouse để dễ bấm "再玩一次" ===
    canvas.style.cursor = "default";
  }
  lastTimeUpdate = timestamp;
  updateHUD();
}



    if (!gameOver && hasStarted) {
    const interval = getCurrentSpawnInterval(timestamp);
    if (timestamp - lastSpawn > interval) {
      spawnTarget(timestamp);
    }
  }



  for (let i = targets.length - 1; i >= 0; i--) {
    const t = targets[i];
    const age = timestamp - t.spawnTime;
    if (t.hit || age > TARGET_LIFE) {
      targets.splice(i, 1);
    }
  }

    // Combo đếm ngược
  if (comboTimer > 0) {
    comboTimer -= delta;
    if (comboTimer <= 0) combo = 0;
  }

  // Hết thời gian FEVER thì tắt
  if (feverActive && timestamp >= feverEndTime) {
    feverActive = false;
  }

  // thời gian chữ Combo to + sáng khi mới vào FEVER
  if (feverFlashTimer > 0) {
    feverFlashTimer -= delta;
    if (feverFlashTimer < 0) feverFlashTimer = 0;
  }

  // thời gian flash đỏ khi trúng sản phẩm trừ điểm
  if (negativeFlashTime > 0) {
    negativeFlashTime -= delta;
    if (negativeFlashTime < 0) negativeFlashTime = 0;
  }


  updateHammer(timestamp);

  // ===== tính shake như cũ =====
  let shakeX = 0;
  let shakeY = 0;
  if (shake.duration > 0) {
    shake.time += delta;
    const t = shake.time / shake.duration;
    if (t >= 1) {
      shake.duration = 0;
    } else {
      const mag = shake.intensity * (1 - t);
      shakeX = (Math.random() * 2 - 1) * mag;
      shakeY = (Math.random() * 2 - 1) * mag;
    }
  }

  // ======= FIX: reset transform + clear toàn bộ =======
  ctx.setTransform(1, 0, 0, 1, 0, 0); // reset mọi translate/rotate/scale
  ctx.clearRect(0, 0, W, H);

  // từ đây mới bắt đầu vẽ với shake
  ctx.save();
  ctx.translate(shakeX, shakeY);

  drawBackground();
  drawTopBar();
  drawOuterCard();
  drawDecorations(delta);
  drawFrame();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(
    frame.x + 3,
    frame.y + 3,
    frame.w - 6,
    frame.h - 6,
    frame.radius - 6
  );
  ctx.clip();

  drawTargets(timestamp);
  drawParticles(delta);
  drawImpacts(delta);
  drawFloatingScores(delta);

  ctx.restore();

   drawCombo();
  drawHammer();
  drawBottomPanel();
    // Flash đỏ ngắn khi đập trúng sản phẩm trừ điểm
  if (negativeFlashTime > 0) {
    const tFlash = negativeFlashTime / NEGATIVE_FLASH_DURATION;
    const alphaFlash = tFlash * 0.5;   // tối đa 0.5
    ctx.save();
    ctx.fillStyle = `rgba(255,0,0,${alphaFlash})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }


  if (showingIntro) {
    drawIntroOverlay();
  } else if (gameOver) {
    drawGameOver();
  }

  ctx.restore();


  requestAnimationFrame(loop);
}


// ========= START =========
resetGame();
requestAnimationFrame(loop);
