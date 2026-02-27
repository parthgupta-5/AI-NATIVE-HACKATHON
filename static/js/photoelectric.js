function startPhotoelectric() {

if (window.photoStarted) return;
window.photoStarted = true;
  "use strict";

  /* ── Constants ── */
  const H_EV = 4.1357e-15;          // Planck's constant in eV·s
  const CANVAS_W = 620;
  const CANVAS_H = 440;
  const METAL_X = 400;              // x position of metal plate
  const METAL_TOP = 60;
  const METAL_BOT = 380;
  const LIGHT_SOURCE_X = 40;

  /* ── Materials: work function in eV ── */
  const MATERIALS = {
    sodium:   { phi: 2.28, color: "#a8a29e", name: "Sodium" },
    zinc:     { phi: 3.63, color: "#a1a1aa", name: "Zinc" },
    copper:   { phi: 4.65, color: "#d97706", name: "Copper" },
    platinum: { phi: 5.65, color: "#9ca3af", name: "Platinum" },
  };

  /* ── State ── */
  let material = "sodium";
  let freqVal = 10;                  // ×10¹⁴ Hz
  let intensityVal = 8;
  let photons = [];
  let electrons = [];
  let sparks = [];
  let lastSpawn = 0;

  /* ── DOM refs ── */
  const canvas = document.getElementById("sim");
  const ctx = canvas.getContext("2d");
  const freqSlider = document.getElementById("freqSlider");
  const intensitySlider = document.getElementById("intensitySlider");
  const freqDisplay = document.getElementById("freqVal");
  const intensityDisplay = document.getElementById("intensityVal");
  const photonEDisplay = document.getElementById("photonE");
  const workFuncDisplay = document.getElementById("workFunc");
  const electronKEDisplay = document.getElementById("electronKE");
  const threshFreqDisplay = document.getElementById("threshFreq");
  const statusBar = document.getElementById("statusBar");
  const statusText = document.getElementById("statusText");
  const keCard = document.getElementById("keCard");
  const materialBtns = document.getElementById("materialBtns");

  /* ── Retina scaling ── */
  function setupCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    const w = Math.min(rect.width, CANVAS_W);
    const scale = w / CANVAS_W;
    canvas.style.width = w + "px";
    canvas.style.height = (CANVAS_H * scale) + "px";
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ── Physics helpers ── */
  function freq() { return freqVal * 1e14; }
  function photonEnergy() { return H_EV * freq(); }
  function workFunction() { return MATERIALS[material].phi; }
  function thresholdFreq() { return workFunction() / H_EV; }
  function kineticEnergy() { return Math.max(0, photonEnergy() - workFunction()); }
  function aboveThreshold() { return photonEnergy() >= workFunction(); }

  /* ── Frequency → visible colour ── */
  function freqToColor(f) {
    const nm = 3e17 / f;            // wavelength in nm
    let r = 0, g = 0, b = 0, a = 1;
    if (nm >= 380 && nm < 440)      { r = -(nm - 440) / 60; b = 1; }
    else if (nm >= 440 && nm < 490) { g = (nm - 440) / 50; b = 1; }
    else if (nm >= 490 && nm < 510) { g = 1; b = -(nm - 510) / 20; }
    else if (nm >= 510 && nm < 580) { r = (nm - 510) / 70; g = 1; }
    else if (nm >= 580 && nm < 645) { r = 1; g = -(nm - 645) / 65; }
    else if (nm >= 645 && nm <= 780){ r = 1; }
    else if (nm < 380)              { r = 0.6; b = 1; }          // UV
    else                            { r = 1; }                   // IR
    // intensity drop-off at edges of visible spectrum
    if (nm >= 380 && nm < 420)      a = 0.3 + 0.7 * (nm - 380) / 40;
    else if (nm > 700 && nm <= 780) a = 0.3 + 0.7 * (780 - nm) / 80;
    else if (nm < 380)              a = 0.85;
    else if (nm > 780)              a = 0.6;
    return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${a})`;
  }

  function photonGlowColor(f) {
    const nm = 3e17 / f;
    let r = 0, g = 0, b = 0;
    if (nm >= 380 && nm < 440)      { r = -(nm - 440) / 60; b = 1; }
    else if (nm >= 440 && nm < 490) { g = (nm - 440) / 50; b = 1; }
    else if (nm >= 490 && nm < 510) { g = 1; b = -(nm - 510) / 20; }
    else if (nm >= 510 && nm < 580) { r = (nm - 510) / 70; g = 1; }
    else if (nm >= 580 && nm < 645) { r = 1; g = -(nm - 645) / 65; }
    else if (nm >= 645 && nm <= 780){ r = 1; }
    else if (nm < 380)              { r = 0.5; b = 1; }
    else                            { r = 1; }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
  }

  /* ── Spawn photon ── */
  function spawnPhoton() {
    const ySpread = METAL_BOT - METAL_TOP - 20;
    const targetY = METAL_TOP + 10 + Math.random() * ySpread;
    photons.push({
      x: LIGHT_SOURCE_X + Math.random() * 10,
      y: 30 + Math.random() * (CANVAS_H - 60),
      targetY: targetY,
      speed: 2.5 + Math.random() * 1.5,
      alive: true,
    });
  }

  /* ── Spawn electron from impact point ── */
  function spawnElectron(hitY) {
    const ke = kineticEnergy();
    const speedFactor = 1.5 + (ke / 4) * 3;
    electrons.push({
      x: METAL_X + 8,
      y: hitY,
      vx: speedFactor + Math.random() * 1.5,
      vy: (Math.random() - 0.5) * 2.5,
      life: 1.0,
      alive: true,
    });
  }

  /* ── Spawn spark particles on impact ── */
  function spawnSparks(x, y, ejected) {
    const count = ejected ? 6 : 3;
    for (let i = 0; i < count; i++) {
      const angle = ejected
        ? (-Math.PI / 3 + Math.random() * Math.PI * 2 / 3)
        : (Math.PI * 0.6 + Math.random() * Math.PI * 0.8);
      sparks.push({
        x, y,
        vx: Math.cos(angle) * (1 + Math.random() * 2),
        vy: Math.sin(angle) * (1 + Math.random() * 2),
        life: 1.0,
        color: ejected ? "59,130,246" : "239,68,68",
      });
    }
  }

  /* ── Draw helpers ── */
  function drawBackground() {
    // gradient background
    const bg = ctx.createLinearGradient(0, 0, CANVAS_W, 0);
    bg.addColorStop(0, "#fefce8");
    bg.addColorStop(0.55, "#f0f9ff");
    bg.addColorStop(1, "#f8fafc");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  function drawLightSource() {
    const col = photonGlowColor(freq());
    // glow
    const glow = ctx.createRadialGradient(LIGHT_SOURCE_X, CANVAS_H / 2, 5, LIGHT_SOURCE_X, CANVAS_H / 2, 60);
    glow.addColorStop(0, `rgba(${col.r},${col.g},${col.b},0.25)`);
    glow.addColorStop(1, `rgba(${col.r},${col.g},${col.b},0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, CANVAS_H / 2 - 70, 120, 140);

    // bulb body
    ctx.fillStyle = "#334155";
    ctx.beginPath();
    ctx.roundRect(LIGHT_SOURCE_X - 14, CANVAS_H / 2 - 40, 28, 80, 6);
    ctx.fill();

    // lens
    ctx.fillStyle = freqToColor(freq());
    ctx.beginPath();
    ctx.arc(LIGHT_SOURCE_X, CANVAS_H / 2, 12, 0, Math.PI * 2);
    ctx.fill();

    // label
    ctx.fillStyle = "#64748b";
    ctx.font = "bold 10px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("LIGHT", LIGHT_SOURCE_X, CANVAS_H / 2 + 56);
    ctx.fillText("SOURCE", LIGHT_SOURCE_X, CANVAS_H / 2 + 68);
  }

  function drawMetal() {
    const mat = MATERIALS[material];

    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.06)";
    ctx.beginPath();
    ctx.roundRect(METAL_X - 16, METAL_TOP + 4, 36, METAL_BOT - METAL_TOP, 4);
    ctx.fill();

    // plate
    const metalGrad = ctx.createLinearGradient(METAL_X - 18, 0, METAL_X + 18, 0);
    metalGrad.addColorStop(0, mat.color);
    metalGrad.addColorStop(0.5, "#e2e8f0");
    metalGrad.addColorStop(1, mat.color);
    ctx.fillStyle = metalGrad;
    ctx.beginPath();
    ctx.roundRect(METAL_X - 18, METAL_TOP, 36, METAL_BOT - METAL_TOP, 4);
    ctx.fill();

    // edge highlight
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(METAL_X - 18, METAL_TOP + 4);
    ctx.lineTo(METAL_X - 18, METAL_BOT - 4);
    ctx.stroke();

    // label
    ctx.fillStyle = "#475569";
    ctx.font = "bold 11px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(mat.name, METAL_X, METAL_BOT + 20);
    ctx.font = "10px system-ui";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`φ = ${mat.phi} eV`, METAL_X, METAL_BOT + 34);
  }

  function drawLabels() {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px system-ui";
    ctx.textAlign = "left";
    ctx.fillText("Photons →", 90, 26);
    if (aboveThreshold()) {
      ctx.textAlign = "right";
      ctx.fillText("← Electrons", CANVAS_W - 20, 26);
    }

    // collector plate hint
    ctx.fillStyle = "#cbd5e1";
    ctx.beginPath();
    ctx.roundRect(CANVAS_W - 30, METAL_TOP + 30, 10, METAL_BOT - METAL_TOP - 60, 3);
    ctx.fill();
    ctx.fillStyle = "#94a3b8";
    ctx.font = "9px system-ui";
    ctx.textAlign = "center";
    ctx.save();
    ctx.translate(CANVAS_W - 25, CANVAS_H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("COLLECTOR", 0, 3);
    ctx.restore();
  }

  function drawBeam() {
    const col = photonGlowColor(freq());
    const alpha = 0.04 + (intensityVal / 20) * 0.08;
    ctx.fillStyle = `rgba(${col.r},${col.g},${col.b},${alpha})`;
    ctx.beginPath();
    ctx.moveTo(LIGHT_SOURCE_X + 14, CANVAS_H / 2 - 12);
    ctx.lineTo(METAL_X - 20, METAL_TOP + 10);
    ctx.lineTo(METAL_X - 20, METAL_BOT - 10);
    ctx.lineTo(LIGHT_SOURCE_X + 14, CANVAS_H / 2 + 12);
    ctx.closePath();
    ctx.fill();
  }

  function drawPhoton(p) {
    const color = freqToColor(freq());
    const col = photonGlowColor(freq());
    // glow
    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 10);
    glow.addColorStop(0, `rgba(${col.r},${col.g},${col.b},0.6)`);
    glow.addColorStop(1, `rgba(${col.r},${col.g},${col.b},0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(p.x - 10, p.y - 10, 20, 20);

    // dot
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // wavy trail
    ctx.strokeStyle = `rgba(${col.r},${col.g},${col.b},0.3)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const tx = p.x - i * 2;
      const ty = p.y + Math.sin((p.x - i * 2) * 0.15) * 3;
      if (i === 0) ctx.moveTo(tx, ty);
      else ctx.lineTo(tx, ty);
    }
    ctx.stroke();
  }

  function drawElectron(e) {
    const alpha = e.life;
    // glow
    const glow = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, 12);
    glow.addColorStop(0, `rgba(59,130,246,${0.5 * alpha})`);
    glow.addColorStop(1, `rgba(59,130,246,0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(e.x - 12, e.y - 12, 24, 24);

    // dot
    ctx.fillStyle = `rgba(37,99,235,${alpha})`;
    ctx.beginPath();
    ctx.arc(e.x, e.y, 3, 0, Math.PI * 2);
    ctx.fill();

    // minus sign
    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.9})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(e.x - 1.8, e.y);
    ctx.lineTo(e.x + 1.8, e.y);
    ctx.stroke();

    // trail
    ctx.strokeStyle = `rgba(59,130,246,${0.2 * alpha})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(e.x, e.y);
    ctx.lineTo(e.x - e.vx * 6, e.y - e.vy * 6);
    ctx.stroke();
  }

  function drawSpark(s) {
    ctx.fillStyle = `rgba(${s.color},${s.life})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 1.5 * s.life, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawThresholdIndicator() {
    if (aboveThreshold()) return;
    const ratio = photonEnergy() / workFunction();
    const barW = 120;
    const barH = 8;
    const bx = METAL_X - 60;
    const by = METAL_TOP - 22;

    ctx.fillStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.roundRect(bx, by, barW, barH, 4);
    ctx.fill();

    ctx.fillStyle = "#f87171";
    ctx.beginPath();
    ctx.roundRect(bx, by, barW * Math.min(ratio, 1), barH, 4);
    ctx.fill();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "9px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(`Energy: ${(ratio * 100).toFixed(0)}% of threshold`, METAL_X, by - 4);
  }

  /* ── Update loop ── */
  function update(now) {
    // spawn photons at rate proportional to intensity
    const interval = 1000 / intensityVal;
    if (now - lastSpawn > interval) {
      spawnPhoton();
      lastSpawn = now;
    }

    // move photons toward metal
    for (const p of photons) {
      if (!p.alive) continue;
      const dx = METAL_X - 18 - p.x;
      const dy = p.targetY - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < p.speed) {
        p.alive = false;
        if (aboveThreshold()) {
          spawnElectron(p.targetY);
          spawnSparks(METAL_X - 10, p.targetY, true);
        } else {
          spawnSparks(METAL_X - 18, p.targetY, false);
        }
      } else {
        p.x += (dx / dist) * p.speed;
        p.y += (dy / dist) * p.speed;
      }
    }

    // move electrons away from metal
    for (const e of electrons) {
      if (!e.alive) continue;
      e.x += e.vx;
      e.y += e.vy;
      e.life -= 0.004;
      if (e.life <= 0 || e.x > CANVAS_W + 10) e.alive = false;
    }

    // update sparks
    for (const s of sparks) {
      s.x += s.vx;
      s.y += s.vy;
      s.life -= 0.035;
    }

    // clean up dead particles
    photons = photons.filter(p => p.alive);
    electrons = electrons.filter(e => e.alive);
    sparks = sparks.filter(s => s.life > 0);
  }

  /* ── Render ── */
  function render() {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    drawBackground();
    drawBeam();
    drawLightSource();
    drawMetal();
    drawLabels();
    drawThresholdIndicator();
    for (const p of photons) drawPhoton(p);
    for (const e of electrons) drawElectron(e);
    for (const s of sparks) drawSpark(s);
  }

  /* ── UI update ── */
  function updateUI() {
    const ePhoton = photonEnergy();
    const phi = workFunction();
    const ke = kineticEnergy();
    const fThresh = thresholdFreq();
    const above = aboveThreshold();

    freqDisplay.textContent = `${freqVal.toFixed(1)} × 10¹⁴ Hz`;
    intensityDisplay.textContent = `${intensityVal} photons/s`;
    photonEDisplay.textContent = ePhoton.toFixed(2);
    workFuncDisplay.textContent = phi.toFixed(2);
    electronKEDisplay.textContent = above ? ke.toFixed(2) : "0.00";
    threshFreqDisplay.textContent = (fThresh / 1e14).toFixed(2);

    if (above) {
      statusBar.className = "status-bar active";
      statusText.textContent = `Electrons ejected — KE = ${ke.toFixed(2)} eV`;
      keCard.classList.add("highlight");
    } else {
      statusBar.className = "status-bar inactive";
      statusText.textContent = "Below threshold — no electrons ejected";
      keCard.classList.remove("highlight");
    }
  }

  /* ── Main loop ── */
  function loop(now) {
    update(now);
    render();
    requestAnimationFrame(loop);
  }

  /* ── Event listeners ── */
  freqSlider.addEventListener("input", () => {
    freqVal = parseFloat(freqSlider.value);
    updateUI();
  });

  intensitySlider.addEventListener("input", () => {
    intensityVal = parseInt(intensitySlider.value, 10);
    updateUI();
  });

  materialBtns.addEventListener("click", (e) => {
    const btn = e.target.closest(".material-btn");
    if (!btn) return;
    material = btn.dataset.mat;
    materialBtns.querySelectorAll(".material-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    updateUI();
  });

  window.addEventListener("resize", setupCanvas);

  /* ── Init ── */
  setupCanvas();
  updateUI();
  requestAnimationFrame(loop);
}