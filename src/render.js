// Canvas colony view: nodes, building blocks and walking workers.
import { BUILDINGS } from './data.js';
import { tierUnlocked, workerCount, walkSpeedMult } from './sim.js';
import { RES_INFO } from './data.js';

const W = 800;
const H = 450;
const TOWN = { x: 400, y: 225 };
const NODES = {
  wood:   { x: 120, y: 110, label: 'Forest' },
  stone:  { x: 120, y: 340, label: 'Quarry Hill' },
  metal:  { x: 680, y: 110, label: 'Iron Peak' },
  energy: { x: 680, y: 340, label: 'Power Field' },
};

export function createWorld(canvas) {
  const ctx = canvas.getContext('2d');
  const workers = [];
  const floats = [];
  let scale = 1;

  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(r.width * dpr));
    const h = Math.round((w * H) / W);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    scale = canvas.width / W;
  }

  function newWorker() {
    return { x: TOWN.x + (Math.random() - 0.5) * 30, y: TOWN.y + 20, state: 'idle', timer: Math.random(), res: 'wood', tx: 0, ty: 0 };
  }

  function moveToward(w, dt, speed) {
    const dx = w.tx - w.x;
    const dy = w.ty - w.y;
    const d = Math.hypot(dx, dy);
    const stepLen = speed * dt;
    if (d <= stepLen) { w.x = w.tx; w.y = w.ty; return true; }
    w.x += (dx / d) * stepLen;
    w.y += (dy / d) * stepLen;
    return false;
  }

  function update(dt, s) {
    dt = Math.min(dt, 0.1);
    const want = workerCount(s);
    while (workers.length < want) workers.push(newWorker());
    while (workers.length > want) workers.pop();
    const speed = 70 * walkSpeedMult(s);
    const open = Object.keys(NODES).filter((k) => tierUnlocked(s, k));
    for (const w of workers) {
      if (w.state === 'idle') {
        w.timer -= dt;
        if (w.timer <= 0) {
          w.res = open[Math.floor(Math.random() * open.length)];
          const n = NODES[w.res];
          w.tx = n.x + (Math.random() - 0.5) * 60;
          w.ty = n.y + (Math.random() - 0.5) * 40;
          w.state = 'out';
        }
      } else if (w.state === 'out') {
        if (moveToward(w, dt, speed)) { w.state = 'gather'; w.timer = 0.8 + Math.random() * 0.6; }
      } else if (w.state === 'gather') {
        w.timer -= dt;
        if (w.timer <= 0) {
          w.tx = TOWN.x + (Math.random() - 0.5) * 50;
          w.ty = TOWN.y + 25 + Math.random() * 15;
          w.state = 'back';
        }
      } else if (w.state === 'back') {
        if (moveToward(w, dt, speed)) {
          floats.push({ x: w.x, y: w.y, res: w.res, age: 0 });
          w.state = 'idle';
          w.timer = Math.random() * 0.5;
        }
      }
    }
    for (let i = floats.length - 1; i >= 0; i--) {
      floats[i].age += dt;
      if (floats[i].age > 1) floats.splice(i, 1);
    }
  }

  function drawNode(res, open) {
    const n = NODES[res];
    ctx.globalAlpha = open ? 1 : 0.22;
    if (res === 'wood') {
      for (let i = 0; i < 5; i++) {
        const x = n.x - 40 + i * 20;
        const y = n.y + (i % 2) * 14 - 8;
        ctx.fillStyle = '#5b3a1e'; ctx.fillRect(x - 2, y + 8, 4, 10);
        ctx.fillStyle = '#2f7d3a';
        ctx.beginPath(); ctx.moveTo(x, y - 18); ctx.lineTo(x + 12, y + 10); ctx.lineTo(x - 12, y + 10); ctx.fill();
      }
    } else if (res === 'stone') {
      ctx.fillStyle = '#7c8794';
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(n.x - 30 + i * 20, n.y + (i % 2) * 10, 16, 11, 0, 0, 7); ctx.fill(); }
    } else if (res === 'metal') {
      ctx.fillStyle = '#4d5560';
      ctx.beginPath(); ctx.moveTo(n.x - 50, n.y + 30); ctx.lineTo(n.x - 8, n.y - 36); ctx.lineTo(n.x + 50, n.y + 30); ctx.fill();
      ctx.fillStyle = '#e0894a';
      ctx.beginPath(); ctx.arc(n.x + 6, n.y + 4, 5, 0, 7); ctx.arc(n.x - 14, n.y + 14, 4, 0, 7); ctx.fill();
    } else {
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = '#1f4e79'; ctx.fillRect(n.x - 48 + i * 34, n.y - 16, 28, 22);
        ctx.fillStyle = '#4aa3e0'; ctx.fillRect(n.x - 45 + i * 34, n.y - 13, 22, 16);
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = open ? '#cfd8c8' : '#6b7468';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(open ? n.label : n.label + ' (locked)', n.x, n.y + (n.y < 200 ? -44 : 48));
  }

  function draw(s) {
    resize();
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#22382a'); g.addColorStop(1, '#1a2a21');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    for (const k of Object.keys(NODES)) {
      const open = tierUnlocked(s, k);
      ctx.strokeStyle = open ? '#4b3b2b' : '#2b3a30';
      ctx.lineWidth = 12; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(TOWN.x, TOWN.y); ctx.lineTo(NODES[k].x, NODES[k].y); ctx.stroke();
    }
    for (const k of Object.keys(NODES)) drawNode(k, tierUnlocked(s, k));

    // town hall
    ctx.fillStyle = '#c9b38a'; ctx.fillRect(TOWN.x - 30, TOWN.y - 24, 60, 40);
    ctx.fillStyle = '#9a3b32';
    ctx.beginPath(); ctx.moveTo(TOWN.x - 38, TOWN.y - 24); ctx.lineTo(TOWN.x, TOWN.y - 50); ctx.lineTo(TOWN.x + 38, TOWN.y - 24); ctx.fill();
    ctx.fillStyle = '#5b3a1e'; ctx.fillRect(TOWN.x - 7, TOWN.y - 2, 14, 18);

    // building blocks: one row per building type next to its resource node
    const rowIdx = {};
    for (const b of BUILDINGS) {
      const n = NODES[b.res];
      const idx = rowIdx[b.res] || 0;
      rowIdx[b.res] = idx + 1;
      const count = Math.min(s.b[b.id], 12);
      const y = n.y + (n.y < 200 ? 58 : -76) + idx * 18;
      const x0 = n.x < 400 ? 24 : W - 24 - 12 * 16;
      ctx.fillStyle = b.color;
      for (let i = 0; i < count; i++) ctx.fillRect(x0 + i * 16, y, 12, 12);
    }

    for (const w of workers) {
      ctx.fillStyle = '#f4d35e';
      ctx.beginPath(); ctx.arc(w.x, w.y, 5, 0, 7); ctx.fill();
      if (w.state === 'back') {
        ctx.fillStyle = RES_INFO[w.res].color;
        ctx.beginPath(); ctx.arc(w.x, w.y - 8, 3.5, 0, 7); ctx.fill();
      }
    }
    for (const f of floats) {
      ctx.globalAlpha = 1 - f.age;
      ctx.fillStyle = RES_INFO[f.res].color;
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('+', f.x, f.y - 14 - f.age * 22);
      ctx.globalAlpha = 1;
    }
  }

  return { update, draw, workers, floats };
}
