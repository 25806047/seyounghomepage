'use strict';

// 공식 YouTube 영상을 링크합니다. 음악 파일을 복제하거나 배포하지 않습니다.
const songs = [
  { title: '어디에도', videoId: 'va5rf20Un24' },
  { title: '넘쳐흘러', videoId: 'g27XtqR7B0c' },
  { title: '행복하지 말아요', videoId: 'pMEvQz6HIA0' },
];

const player = document.querySelector('#music-player');
const currentTrack = document.querySelector('#current-track');
const youtubeLink = document.querySelector('#youtube-link');
const trackButtons = [...document.querySelectorAll('.track')];
trackButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const song = songs[Number(button.dataset.song)];
    if (!song) return;
    player.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(song.videoId)}?rel=0&playsinline=1&autoplay=1`;
    player.title = `엠씨더맥스 - ${song.title} 유튜브 영상`;
    currentTrack.textContent = song.title;
    youtubeLink.href = `https://www.youtube.com/watch?v=${encodeURIComponent(song.videoId)}`;
    trackButtons.forEach(b => { const active = b === button; b.classList.toggle('active', active); b.setAttribute('aria-pressed', String(active)); });
  });
});
document.querySelector('#year').textContent = new Date().getFullYear();

// Tetris-style game, original vanilla JS implementation.
const canvas = document.querySelector('#tetris');
const ctx = canvas.getContext('2d');
const nextCanvas = document.querySelector('#next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const COLS = 10, ROWS = 20, CELL = 30;
const COLORS = { I: '#7edce7', O: '#fbdb77', T: '#bd97f3', S: '#b2e88f', Z: '#f28a97', J: '#8eaff1', L: '#ffb27b' };
const SHAPES = {
  I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  O: [[1,1],[1,1]],
  T: [[0,1,0],[1,1,1],[0,0,0]],
  S: [[0,1,1],[1,1,0],[0,0,0]],
  Z: [[1,1,0],[0,1,1],[0,0,0]],
  J: [[1,0,0],[1,1,1],[0,0,0]],
  L: [[0,0,1],[1,1,1],[0,0,0]]
};
const PIECES = Object.keys(SHAPES);
const scoreEl = document.querySelector('#score');
const linesEl = document.querySelector('#lines');
const levelEl = document.querySelector('#level');
const overlay = document.querySelector('#game-overlay');
const overlayTitle = document.querySelector('#overlay-title');
const overlayText = document.querySelector('#overlay-text');
const overlayButton = document.querySelector('#overlay-button');
const pauseButton = document.querySelector('#pause-btn');
const restartButton = document.querySelector('#restart-btn');
let board, piece, nextType, bag, score, lines, level, playing = false, paused = false, finished = false;
let animationId = null, lastTime = 0, dropCounter = 0;

function emptyBoard() { return Array.from({ length: ROWS }, () => Array(COLS).fill(null)); }
function randomType() {
  if (!bag.length) {
    bag = [...PIECES];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
  }
  return bag.pop();
}
function makePiece(type) {
  const shape = SHAPES[type].map(row => row.slice());
  return { type, shape, x: Math.floor((COLS - shape[0].length) / 2), y: -1 };
}
function collision(candidate, x = candidate.x, y = candidate.y, matrix = candidate.shape) {
  for (let r = 0; r < matrix.length; r++) for (let c = 0; c < matrix[r].length; c++) {
    if (!matrix[r][c]) continue;
    const nx = x + c, ny = y + r;
    if (nx < 0 || nx >= COLS || ny >= ROWS || (ny >= 0 && board[ny][nx])) return true;
  }
  return false;
}
function spawn() {
  piece = makePiece(nextType);
  nextType = randomType();
  renderNext();
  if (collision(piece)) endGame();
}
function lockPiece() {
  for (let r = 0; r < piece.shape.length; r++) for (let c = 0; c < piece.shape[r].length; c++) {
    if (!piece.shape[r][c]) continue;
    const y = piece.y + r, x = piece.x + c;
    if (y < 0) { endGame(); return; }
    board[y][x] = piece.type;
  }
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(Boolean)) {
      board.splice(r, 1);
      board.unshift(Array(COLS).fill(null));
      cleared++; r++;
    }
  }
  if (cleared) {
    score += [0, 100, 300, 500, 800][cleared] * level;
    lines += cleared;
    level = 1 + Math.floor(lines / 10);
    renderStats();
  }
  spawn();
}
function descend(manual = false) {
  if (!playing || paused) return;
  if (!collision(piece, piece.x, piece.y + 1)) {
    piece.y++;
    if (manual) { score++; renderStats(); }
  } else lockPiece();
  dropCounter = 0;
  render();
}
function rotate() {
  if (!playing || paused) return;
  const n = piece.shape.length;
  const rotated = Array.from({length:n}, (_,r) => Array.from({length:n},(_,c)=>piece.shape[n-1-c][r]));
  for (const offset of [0,-1,1,-2,2]) {
    if (!collision(piece, piece.x + offset, piece.y, rotated)) {
      piece.shape = rotated;
      piece.x += offset;
      break;
    }
  }
  render();
}
function shift(dx) {
  if (!playing || paused) return;
  if (!collision(piece, piece.x + dx, piece.y)) piece.x += dx;
  render();
}
function hardDrop() {
  if (!playing || paused) return;
  let moved = 0;
  while (!collision(piece, piece.x, piece.y + 1)) { piece.y++; moved++; }
  score += moved * 2;
  renderStats();
  lockPiece();
  dropCounter = 0;
  render();
}
function renderStats() {
  scoreEl.textContent = String(score).padStart(6,'0');
  linesEl.textContent = String(lines).padStart(2,'0');
  levelEl.textContent = String(level).padStart(2,'0');
}
function tile(context, x, y, size, color) {
  context.fillStyle = color;
  context.fillRect(x + 1, y + 1, size - 2, size - 2);
  context.fillStyle = 'rgba(255,255,255,.29)';
  context.fillRect(x + 3, y + 3, size - 6, 4);
  context.fillStyle = 'rgba(0,0,0,.18)';
  context.fillRect(x + 3, y + size - 7, size - 6, 4);
}
function render() {
  ctx.fillStyle = '#151626'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle = '#29253b'; ctx.lineWidth = .65;
  for (let x=0; x<=COLS; x++) { ctx.beginPath();ctx.moveTo(x*CELL+.5,0);ctx.lineTo(x*CELL+.5,ROWS*CELL);ctx.stroke(); }
  for (let y=0; y<=ROWS; y++) { ctx.beginPath();ctx.moveTo(0,y*CELL+.5);ctx.lineTo(COLS*CELL,y*CELL+.5);ctx.stroke(); }
  for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++) if(board[y][x]) tile(ctx,x*CELL,y*CELL,CELL,COLORS[board[y][x]]);
  if (piece && !finished) {
    for (let r=0;r<piece.shape.length;r++) for(let c=0;c<piece.shape[r].length;c++) if(piece.shape[r][c] && piece.y+r>=0) tile(ctx,(piece.x+c)*CELL,(piece.y+r)*CELL,CELL,COLORS[piece.type]);
  }
}
function renderNext() {
  nextCtx.clearRect(0,0,136,100);
  if(!nextType) return;
  const shape = SHAPES[nextType], size=24;
  const cells = [];
  for(let r=0;r<shape.length;r++) for(let c=0;c<shape[r].length;c++) if(shape[r][c]) cells.push([r,c]);
  const minX = Math.min(...cells.map(v=>v[1])), maxX = Math.max(...cells.map(v=>v[1]));
  const minY = Math.min(...cells.map(v=>v[0])), maxY = Math.max(...cells.map(v=>v[0]));
  const x0 = (136 - (maxX-minX+1)*size)/2, y0 = (100 - (maxY-minY+1)*size)/2;
  cells.forEach(([r,c])=>tile(nextCtx,x0+(c-minX)*size,y0+(r-minY)*size,size,COLORS[nextType]));
}
function showOverlay(title,text,label) {
  overlayTitle.innerHTML = title;
  overlayText.textContent = text;
  overlayButton.textContent = label;
  overlay.classList.remove('hidden');
}
function tick(timestamp) {
  if (!playing || paused) return;
  if (!lastTime) lastTime = timestamp;
  dropCounter += Math.min(timestamp-lastTime,100);
  lastTime = timestamp;
  const interval = Math.max(95, 850 * Math.pow(.81,level-1));
  if(dropCounter >= interval) descend();
  render();
  animationId = requestAnimationFrame(tick);
}
function startLoop() {
  cancelAnimationFrame(animationId);
  lastTime = 0; dropCounter=0;
  if(playing && !paused) animationId=requestAnimationFrame(tick);
}
function start() {
  bag=[]; board=emptyBoard(); piece=null; nextType=randomType();
  score=0; lines=0; level=1; playing=true; paused=false; finished=false;
  spawn(); renderStats();render();
  pauseButton.disabled=false;pauseButton.textContent='Ⅱ PAUSE';
  overlay.classList.add('hidden');
  startLoop();
}
function endGame() {
  finished=true;playing=false;paused=false;
  cancelAnimationFrame(animationId);
  pauseButton.disabled=true;
  showOverlay('GAME<br>OVER!',`최종 점수 ${score.toLocaleString()}점! 다시 도전할래?`,'↻ PLAY AGAIN');
}
function pause() {
  if(!playing)return;
  paused=!paused;
  pauseButton.textContent=paused?'▶ RESUME':'Ⅱ PAUSE';
  if(paused) { cancelAnimationFrame(animationId);showOverlay('PAUSED','잠깐 쉬어가는 중!','▶ RESUME'); }
  else { overlay.classList.add('hidden');startLoop(); }
}
function action(type) {
  if(type==='restart') { start(); return; }
  if(type==='pause') { pause(); return; }
  if(!playing || paused)return;
  ({left:()=>shift(-1),right:()=>shift(1),down:()=>descend(true),rotate,drop:hardDrop})[type]?.();
}
overlayButton.addEventListener('click',()=>{if(playing&&paused)pause();else start();});
pauseButton.addEventListener('click',pause);
restartButton.addEventListener('click',start);
document.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>action(button.dataset.action)));
window.addEventListener('keydown',(event)=>{
  const keyMap = { ArrowLeft:'left', ArrowRight:'right', ArrowDown:'down', ArrowUp:'rotate', ' ':'drop', p:'pause', P:'pause', r:'restart', R:'restart' };
  if (event.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(event.target.tagName)) return;
  const move = keyMap[event.key];
  if (!move) return;
  if (document.activeElement === player) return;
  // 페이지 상단에서는 일반 스크롤을 유지하고, 게임 중에만 화살표/스페이스를 처리합니다.
  if (!playing && move !== 'restart') return;
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(event.key))event.preventDefault();
  action(move);
});
board=emptyBoard();piece=null;bag=[];score=0;lines=0;level=1;
renderStats();render();
