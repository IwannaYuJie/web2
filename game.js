const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const scoreEl = document.querySelector('#score');
const timeEl = document.querySelector('#time');
const statusEl = document.querySelector('#status');
const startBtn = document.querySelector('#startBtn');
const resetBtn = document.querySelector('#resetBtn');

const state = {
  running: false,
  score: 0,
  time: 30,
  lastTick: 0,
  keys: new Set(),
  player: { x: 480, y: 270, r: 28, speed: 300 },
  fish: { x: 220, y: 160, r: 20 },
  particles: []
};

function rand(min, max) { return Math.random() * (max - min) + min; }
function placeFish() { state.fish.x = rand(50, canvas.width - 50); state.fish.y = rand(60, canvas.height - 50); }
function updateHud(status) { scoreEl.textContent = state.score; timeEl.textContent = Math.max(0, Math.ceil(state.time)); statusEl.textContent = status; }
function resetGame() { state.running = false; state.score = 0; state.time = 30; state.player.x = canvas.width / 2; state.player.y = canvas.height / 2; state.particles = []; placeFish(); updateHud('待开始'); draw(); }
function startGame() { resetGame(); state.running = true; state.lastTick = performance.now(); updateHud('游戏中'); requestAnimationFrame(loop); }
function collect() {
  state.score += 10;
  for (let i = 0; i < 16; i++) state.particles.push({ x: state.fish.x, y: state.fish.y, vx: rand(-160, 160), vy: rand(-160, 160), life: rand(.35, .8) });
  placeFish();
}
function update(dt) {
  if (!state.running) return;
  state.time -= dt;
  if (state.time <= 0) { state.running = false; updateHud('结束'); draw(); return; }
  let dx = 0, dy = 0;
  if (state.keys.has('ArrowLeft') || state.keys.has('a')) dx -= 1;
  if (state.keys.has('ArrowRight') || state.keys.has('d')) dx += 1;
  if (state.keys.has('ArrowUp') || state.keys.has('w')) dy -= 1;
  if (state.keys.has('ArrowDown') || state.keys.has('s')) dy += 1;
  const len = Math.hypot(dx, dy) || 1;
  state.player.x += (dx / len) * state.player.speed * dt;
  state.player.y += (dy / len) * state.player.speed * dt;
  state.player.x = Math.max(state.player.r, Math.min(canvas.width - state.player.r, state.player.x));
  state.player.y = Math.max(state.player.r, Math.min(canvas.height - state.player.r, state.player.y));
  if (Math.hypot(state.player.x - state.fish.x, state.player.y - state.fish.y) < state.player.r + state.fish.r) collect();
  state.particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; });
  state.particles = state.particles.filter(p => p.life > 0);
  updateHud('游戏中');
}
function drawBackground() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  g.addColorStop(0, '#10213b'); g.addColorStop(1, '#08111f'); ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = .22; ctx.strokeStyle = '#9fb4ff';
  for (let x = 0; x < canvas.width; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
  for (let y = 0; y < canvas.height; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
  ctx.globalAlpha = 1;
}
function draw() {
  drawBackground();
  ctx.save(); ctx.translate(state.fish.x, state.fish.y); ctx.font = '38px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🐟', 0, 0); ctx.restore();
  ctx.save(); ctx.translate(state.player.x, state.player.y); ctx.shadowColor = 'rgba(97,244,193,.55)'; ctx.shadowBlur = 22; ctx.fillStyle = '#61f4c1'; ctx.beginPath(); ctx.arc(0, 0, state.player.r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; ctx.font = '34px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🐱', 0, 1); ctx.restore();
  state.particles.forEach(p => { ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = '#fff08a'; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill(); }); ctx.globalAlpha = 1;
  if (!state.running && state.time <= 0) { ctx.fillStyle = 'rgba(0,0,0,.42)'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#fff'; ctx.font = 'bold 48px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`游戏结束：${state.score} 分`, canvas.width / 2, canvas.height / 2); }
}
function loop(now) { const dt = Math.min(.033, (now - state.lastTick) / 1000 || 0); state.lastTick = now; update(dt); draw(); if (state.running) requestAnimationFrame(loop); }
window.addEventListener('keydown', e => state.keys.add(e.key.length === 1 ? e.key.toLowerCase() : e.key));
window.addEventListener('keyup', e => state.keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
canvas.addEventListener('pointermove', e => { if (!state.running) return; const rect = canvas.getBoundingClientRect(); state.player.x = (e.clientX - rect.left) / rect.width * canvas.width; state.player.y = (e.clientY - rect.top) / rect.height * canvas.height; });
startBtn.addEventListener('click', startGame);
resetBtn.addEventListener('click', resetGame);
resetGame();
