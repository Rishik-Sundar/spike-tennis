// Spike Tennis — Self-contained 2D Canvas Game (no external deps except optional PeerJS)
(function(){
'use strict';

// ── Canvas setup ──────────────────────────────────────
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
let W = 0, H = 0;
function resize(){
  W = cv.width = innerWidth * devicePixelRatio;
  H = cv.height = innerHeight * devicePixelRatio;
  cv.style.width = innerWidth+'px';
  cv.style.height = innerHeight+'px';
  ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
  W = innerWidth; H = innerHeight;
}
window.addEventListener('resize', resize); resize();

// ── Court constants (world units) ─────────────────────
// World coords:  x = side-to-side (-CHW..CHW),  z = depth (positive = near player)
const CW=10, CL=22, CHW=5, CHL=11;
const NET_H=0.92, SVC_Z=5.5;

// ── Perspective projection ───────────────────────────
// Camera: behind P1, looking toward far baseline
// Maps (x,y,z) -> (screenX, screenY)
const CAM = { x:0, y:3.4, z:14, lookY:1.4 };
function project(wx, wy, wz){
  // Translate world so camera is at origin looking down -z
  const dx = wx - CAM.x;
  const dy = wy - CAM.y;
  const dz = CAM.z - wz; // distance from camera (always positive when in front)
  if (dz < 0.5) return { x: -9999, y: -9999, scale: 0, behind: true };
  const f = 540; // focal length in pixels
  const sx = W*0.5 + (dx / dz) * f;
  const sy = H*0.55 + (-dy / dz) * f;
  return { x: sx, y: sy, scale: f / dz, behind: false };
}

// ── Game state ────────────────────────────────────────
let gPhase = 'lobby'; // lobby | countdown | serve_meter | serve_toss | rally | point_end | match_over
let gMode  = 'ai_1v1';
let cdVal=3, cdTimer=0, ptTimer=0;
let activePL=[0,1], humanPL=[0], aiPL=[1];
let srvMeter=0, srvDir=1, srvPower=0, tossHit=false;
let aiCDs=[0,0,0,0];
let mX = innerWidth/2;
const KEYS = {};

// ── Difficulty ────────────────────────────────────────
const DIFF = {
  easy:   { spdMult: 0.55, range: 4.0, reactCD: 38, missChance: 0.22, aimNoise: 2.4, power: 0.72, srvBaseCD: 90 },
  medium: { spdMult: 1.00, range: 5.5, reactCD: 22, missChance: 0.06, aimNoise: 1.2, power: 1.00, srvBaseCD: 65 },
  hard:   { spdMult: 1.40, range: 6.5, reactCD:  8, missChance: 0.00, aimNoise: 0.5, power: 1.30, srvBaseCD: 38 },
};
let DIFF_CUR = DIFF.medium;

// ── Online ────────────────────────────────────────────
let peerConn=null, isHost=false;

// ── Players ───────────────────────────────────────────
const P = [
  { x: 0,  z: 9,  side:'near', col:'#00c8ff', speed:3.5, sprintSpd:5.5, swingT:0, hitCD:0, jumpH:0, serving:false },
  { x: 0,  z:-9,  side:'far',  col:'#ff6050', speed:3.5, sprintSpd:5.5, swingT:0, hitCD:0, jumpH:0, serving:false },
  { x: 2,  z: 9,  side:'near', col:'#40e890', speed:3.5, sprintSpd:5.5, swingT:0, hitCD:0, jumpH:0, serving:false },
  { x:-2,  z:-9,  side:'far',  col:'#ff9632', speed:3.5, sprintSpd:5.5, swingT:0, hitCD:0, jumpH:0, serving:false },
];

// ── Ball ──────────────────────────────────────────────
const B = {
  x:0, y:0.18, z:9, vx:0, vy:0, vz:0,
  active:false, lastHitter:0, bounces:0, trail:[],
  GRAV:16, BOUNCE:0.58,
  reset(side){
    this.x=0; this.y=0.18; this.z=side===0?9:-9;
    this.vx=this.vy=this.vz=0;
    this.active=false; this.bounces=0; this.trail=[];
  },
  launch(fromPi, tx, tz, speed, arcH){
    const p = P[fromPi];
    this.x = p.x; this.y = 0.9; this.z = p.z + (fromPi<2 ? -0.4 : 0.4);
    this.bounces=0; this.lastHitter=fromPi; this.active=true; this.trail=[];
    const dx = tx-this.x, dz = tz-this.z;
    const dist = Math.sqrt(dx*dx + dz*dz) || 1;
    const t = dist / speed;
    this.vx = dx/t;
    this.vz = dz/t;
    this.vy = this.GRAV*t*0.5 + (arcH-this.y)/t;
  },
  update(dt){
    if (!this.active) return;
    this.trail.unshift({x:this.x, y:this.y, z:this.z});
    if (this.trail.length > 14) this.trail.pop();
    this.vy -= this.GRAV * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.z += this.vz * dt;
    // Ground bounce
    if (this.y <= 0.18){
      this.y = 0.18;
      if (Math.abs(this.vy) > 0.4){
        this.vy = Math.abs(this.vy)*this.BOUNCE;
        this.vx *= 0.84; this.vz *= 0.84;
        this.bounces++;
        onBounce();
      } else { this.vy = 0; }
    }
    // Net check
    if (this.y < NET_H+0.1){
      const prevZ = this.z - this.vz*dt;
      if ((prevZ > 0.15 && this.z <= 0.15) || (prevZ < -0.15 && this.z >= 0.15)){
        if (Math.abs(this.x) < CHW) onNet();
      }
    }
  }
};

// ── Scoring ───────────────────────────────────────────
const SC = {
  pts:[0,0], games:[0,0], sets:[0,0], server:0, deuce:false, adv:-1, matchOver:false, winner:-1,
  D:['0','15','30','40'],
  reset(){ Object.assign(this,{pts:[0,0],games:[0,0],sets:[0,0],server:0,deuce:false,adv:-1,matchOver:false,winner:-1}); },
  award(i){
    if (this.matchOver) return null;
    if (this.deuce){
      if (this.adv<0){ this.adv=i; return {msg:'ADVANTAGE  P'+(i+1)}; }
      if (this.adv===i) return this._g(i);
      this.adv=-1; return {msg:'DEUCE'};
    }
    this.pts[i]++;
    if (this.pts[0]===3 && this.pts[1]===3){ this.deuce=true; this.adv=-1; return {msg:'DEUCE'}; }
    if (this.pts[i]>=4) return this._g(i);
    return {msg:this.str()};
  },
  _g(i){
    this.pts=[0,0]; this.deuce=false; this.adv=-1; this.games[i]++; this.server=1-this.server;
    const g0=this.games[0], g1=this.games[1];
    if (g0===7||g1===7||(Math.max(g0,g1)>=6&&Math.abs(g0-g1)>=2)) return this._s(i);
    return {msg:'GAME  P'+(i+1)+'   '+g0+' – '+g1};
  },
  _s(i){
    this.sets[i]++; this.games=[0,0];
    if (this.sets[i]>=2){ this.matchOver=true; this.winner=i; return {msg:'P'+(i+1)+' WINS THE MATCH!'}; }
    return {msg:'SET  P'+(i+1)+'   '+this.sets[0]+' – '+this.sets[1]};
  },
  str(){
    if (this.deuce) return this.adv<0 ? 'DEUCE' : 'ADV  P'+(this.adv+1);
    return this.D[this.pts[0]]+' – '+this.D[this.pts[1]];
  }
};

// ── Toss (serve phase 2) ─────────────────────────────
const TOSS = {
  x:0, z:0, y:0, t:0, dur:95, peak:3.4, active:false,
  start(x,z){ this.x=x; this.z=z; this.y=0; this.t=0; this.active=true; },
  update(){
    if (!this.active) return;
    this.t++;
    const tn = this.t/this.dur;
    this.y = this.peak*4*tn*(1-tn);
    if (this.t>=this.dur) this.active=false;
  },
  stop(){ this.active=false; }
};

// ── Hit ring ──────────────────────────────────────────
let ringR=0.7, ringActive=false;
function ringQuality(){ return ringR<0.22 ? 1 : ringR<0.38 ? 0.62 : 0.35; }

// ── DOM refs ──────────────────────────────────────────
const $pts    = document.getElementById('pts');
const $gms    = document.getElementById('gms');
const $srv    = document.getElementById('srv-dot');
const $bigmsg = document.getElementById('bigmsg');

function showHUD(on){
  document.getElementById('hud').style.display = on?'block':'none';
  document.getElementById('back-btn').style.display = on?'block':'none';
  document.getElementById('ctrl-hint').style.display = on?'block':'none';
}
function updateScoreHUD(){
  $pts.textContent = SC.str();
  $gms.textContent = 'Games '+SC.games[0]+'–'+SC.games[1]+'  ·  Sets '+SC.sets[0]+'–'+SC.sets[1];
  const col = SC.server===0 ? '#00c8ff' : '#ff6050';
  $srv.style.background = col;
  $srv.style.boxShadow = '0 0 8px '+col;
}
let msgTimer=null;
function showMsg(txt, ms){
  ms = ms || 2000;
  $bigmsg.textContent = txt;
  $bigmsg.style.display = 'block';
  if (msgTimer) clearTimeout(msgTimer);
  msgTimer = setTimeout(()=>{ $bigmsg.style.display='none'; }, ms);
}
function showServeUI(on){ document.getElementById('serve-ui').style.display = on?'flex':'none'; }
function showTossUI(on, tn){
  const el = document.getElementById('toss-ui');
  el.style.display = on?'flex':'none';
  if (on){
    tn = tn || 0;
    const lbl = document.getElementById('toss-label');
    const col = tn>0.4&&tn<0.6 ? '#60ff80' : tn>0.2&&tn<0.8 ? '#ffdc32' : '#ff5050';
    lbl.textContent = tn>0.4&&tn<0.6 ? '🎾 HIT NOW!' : tn<0.4 ? 'WAIT…' : 'TOO LATE…';
    lbl.style.color = col;
    lbl.style.textShadow = '0 0 16px '+col;
  }
}
function updateServeMeter(v){
  document.getElementById('meter-needle').style.left = (v*100)+'%';
  const zone = v>0.4&&v<0.6 ? 'PERFECT!' : v>0.25&&v<0.75 ? 'GOOD' : 'WEAK';
  const col = v>0.4&&v<0.6 ? '#60ff80' : v>0.25&&v<0.75 ? '#ffdc32' : '#ff5050';
  document.getElementById('meter-zone').textContent = zone;
  document.getElementById('meter-zone').style.color = col;
  document.getElementById('meter-needle').style.background = col;
  document.getElementById('meter-needle').style.boxShadow = '0 0 14px '+col;
}
function setCtrlHint(){
  const hints = gMode==='local_1v1'
    ? ['P1: A/D move · W/S depth · SPACE hit', 'P2: ←/→ move · ↑/↓ depth · ENTER hit', 'Q topspin · E slice · R lob · F smash']
    : ['A/D — move · W/S — depth', 'CLICK or SPACE — hit / serve', 'Q topspin · E slice · R lob · F smash'];
  document.getElementById('ctrl-hint').innerHTML = hints.join('<br>');
}

// ── Input ─────────────────────────────────────────────
document.addEventListener('keydown', e=>{
  KEYS[e.code] = true;
  if (e.code==='Space')      { e.preventDefault(); onAction(0); }
  if (e.code==='Enter' || e.code==='NumpadEnter') { e.preventDefault(); onAction(1); }
});
document.addEventListener('keyup', e=>{ delete KEYS[e.code]; });
cv.addEventListener('mousemove', e=>{ mX = e.clientX; });
cv.addEventListener('click', e=>{
  mX = e.clientX;
  if (gPhase==='match_over'){ goLobby(); return; }
  onAction(0);
});

function onAction(who){
  const srvPi = SC.server===0 ? 0 : 1;
  if (gPhase==='serve_meter' && humanPL.indexOf(srvPi)>=0 && who===(srvPi===0?0:1)) lockPower(srvPi);
  else if (gPhase==='serve_toss' && humanPL.indexOf(srvPi)>=0 && who===(srvPi===0?0:1)) doServeHit(srvPi);
  else if (gPhase==='rally') doHit(who===0?0:1);
}

// ── Serve ─────────────────────────────────────────────
function lockPower(pi){
  srvPower = srvMeter;
  TOSS.start(P[pi].x, P[pi].z + (P[pi].side==='near'?-0.3:0.3));
  gPhase='serve_toss'; tossHit=false;
  showServeUI(false); showTossUI(true, 0);
}
function doServeHit(pi){
  if (tossHit) return;
  const tn = TOSS.t / TOSS.dur;
  const dev = Math.abs(tn - 0.5);
  const timing = Math.max(0, 1 - dev*3.0);
  const quality = srvPower*0.5 + timing*0.5;
  tossHit = true; TOSS.stop();
  P[pi].swingT = 22; P[pi].jumpH = 0.5;
  showTossUI(false);
  const txR = (mX/innerWidth)*2 - 1;
  const tx = txR * 3.5;
  const tz = P[pi].side==='near' ? -SVC_Z*0.65 : SVC_Z*0.65;
  B.launch(pi, tx, tz, 5 + quality*6, 1.5);
  gPhase='rally'; P[pi].serving=false;
}

// ── Rally hit ─────────────────────────────────────────
function doHit(who){
  if (gPhase!=='rally') return;
  const pi = who===0?0:1;
  if (humanPL.indexOf(pi)<0) return;
  const p = P[pi];
  if (p.hitCD>0) return;
  const onMySide = p.side==='near' ? B.z>0 : B.z<0;
  if (!onMySide) return;
  const dx=p.x-B.x, dz=p.z-B.z;
  const dist = Math.sqrt(dx*dx+dz*dz);
  if (dist > 5) return;
  const q = ringActive ? ringQuality() : 0.42;
  ringActive = false;
  p.swingT = 18; p.hitCD = 22;
  const txR = (mX/innerWidth)*2 - 1;
  const tx = Math.max(-CHW+0.5, Math.min(CHW-0.5, txR*3.8));
  const tz = p.side==='near' ? -(3+Math.random()*5) : (3+Math.random()*5);
  let arcH=1.6, spd=5.5;
  if (KEYS.KeyQ){ arcH=2.2; spd=4.5; }
  else if (KEYS.KeyE){ arcH=1.0; spd=4.5; }
  else if (KEYS.KeyR){ arcH=5.0; spd=3.5; }
  else if (KEYS.KeyF){ arcH=0.7; spd=8.0; }
  spd *= 0.7 + q*0.58;
  B.launch(pi, tx, tz, spd, arcH);
  if (peerConn && isHost){ try { peerConn.send({type:'hit', pi:pi, tx:tx, tz:tz, spd:spd, arcH:arcH}); } catch(_){} }
}

// ── AI ────────────────────────────────────────────────
function updateAI(dt){
  const D = DIFF_CUR;
  for (let k=0; k<aiPL.length; k++){
    const pi = aiPL[k]; const p = P[pi];
    const srv = SC.server===0?0:1;
    if (gPhase==='serve_meter' && pi===srv){
      aiCDs[pi] -= dt*60;
      if (aiCDs[pi]<=0){
        srvPower = (D.power<1?0.40:D.power>1.1?0.85:0.65) + Math.random()*0.18;
        TOSS.start(p.x, p.z + (p.side==='near'?-0.3:0.3));
        gPhase='serve_toss'; tossHit=false; showServeUI(false);
        aiCDs[pi] = D.srvBaseCD;
      }
      continue;
    }
    if (gPhase==='serve_toss' && pi===srv){
      if (TOSS.t > TOSS.dur*0.46 && !tossHit){
        tossHit = true; TOSS.stop(); P[pi].swingT=18; P[pi].jumpH=0.4;
        const tx = (Math.random()-0.5)*5;
        const tz = p.side==='near' ? -SVC_Z*0.7 : SVC_Z*0.7;
        const srvSpd = (4 + Math.random()*2) * D.power;
        B.launch(pi, tx, tz, srvSpd, 1.4);
        gPhase='rally'; P[pi].serving=false;
        showTossUI(false);
      }
      continue;
    }
    if (gPhase!=='rally' || !B.active) continue;
    const onMySide = p.side==='near' ? B.z>0 : B.z<0;
    const dx = B.x - p.x;
    const baseSpd = Math.abs(dx)>1.5 ? p.sprintSpd : p.speed;
    const spd2 = baseSpd * D.spdMult;
    if (Math.abs(dx)>0.08) p.x += (dx>0?1:-1) * Math.min(Math.abs(dx), spd2*dt);
    p.x = Math.max(-CHW+0.4, Math.min(CHW-0.4, p.x));
    if (aiCDs[pi]>0) aiCDs[pi] -= dt*60;
    if (onMySide && aiCDs[pi]<=0 && B.y<2.2 && p.hitCD<=0){
      const ddx=p.x-B.x, ddz=p.z-B.z;
      const dist = Math.sqrt(ddx*ddx+ddz*ddz);
      if (dist < D.range){
        if (Math.random() < D.missChance){ aiCDs[pi] = D.reactCD*0.6; continue; }
        p.swingT = 16; p.hitCD = 28;
        const tx = (Math.random()-0.5) * (3 + D.aimNoise*2);
        const tz = p.side==='near' ? -(3+Math.random()*5) : (3+Math.random()*5);
        const spd = (4.5 + Math.random()*2) * D.power;
        const arcH = 1.4 + Math.random()*0.8;
        B.launch(pi, tx, tz, spd, arcH);
        aiCDs[pi] = D.reactCD;
      }
    }
    if (p.hitCD>0) p.hitCD -= dt*60;
    if (p.swingT>0) p.swingT -= dt*60;
    p.jumpH = Math.max(0, p.jumpH - dt*3);
  }
}

// ── Human movement ────────────────────────────────────
function updateHumans(dt){
  const p0 = P[0];
  const spd = (KEYS.ShiftLeft||KEYS.ShiftRight) ? p0.sprintSpd : p0.speed;
  if (KEYS.KeyA) p0.x -= spd*dt;
  if (KEYS.KeyD) p0.x += spd*dt;
  if (KEYS.KeyW) p0.z -= spd*dt*0.5;
  if (KEYS.KeyS) p0.z += spd*dt*0.5;
  p0.x = Math.max(-CHW+0.4, Math.min(CHW-0.4, p0.x));
  p0.z = Math.max(0.5, Math.min(CHL-0.5, p0.z));
  if (p0.hitCD>0) p0.hitCD -= dt*60;
  if (p0.swingT>0) p0.swingT -= dt*60;
  p0.jumpH = Math.max(0, p0.jumpH - dt*3);

  if (gMode==='local_1v1'){
    const p1 = P[1];
    const spd2 = p1.speed;
    if (KEYS.ArrowLeft)  p1.x -= spd2*dt;
    if (KEYS.ArrowRight) p1.x += spd2*dt;
    if (KEYS.ArrowUp)    p1.z += spd2*dt*0.5;
    if (KEYS.ArrowDown)  p1.z -= spd2*dt*0.5;
    p1.x = Math.max(-CHW+0.4, Math.min(CHW-0.4, p1.x));
    p1.z = Math.max(-CHL+0.5, Math.min(-0.5, p1.z));
    if (p1.hitCD>0) p1.hitCD -= dt*60;
    if (p1.swingT>0) p1.swingT -= dt*60;
    p1.jumpH = Math.max(0, p1.jumpH - dt*3);
  }
  // Hit ring
  if (gPhase==='rally'){
    const onNear = B.z>0;
    if (humanPL.indexOf(0)>=0){
      const dx=p0.x-B.x, dz=p0.z-B.z;
      const d = Math.sqrt(dx*dx+dz*dz);
      if (onNear && d<5 && B.y<2.2){ if (!ringActive){ ringActive=true; ringR=0.7; } }
      else if (d>6) ringActive=false;
    }
    if (gMode==='local_1v1' && humanPL.indexOf(1)>=0){
      const p1=P[1];
      const dx=p1.x-B.x, dz=p1.z-B.z;
      const d=Math.sqrt(dx*dx+dz*dz);
      if (!onNear && d<5 && B.y<2.2){ if (!ringActive){ ringActive=true; ringR=0.7; } }
    }
    if (ringActive){
      ringR = Math.max(0.08, ringR - 0.012);
      if (ringR<=0.09) ringActive=false;
    }
  }
}

// ── Bounce/Net handlers ──────────────────────────────
function onBounce(){
  if (gPhase!=='rally') return;
  const onNear = B.z>0;
  const inX = Math.abs(B.x) <= CHW;
  const inZ = Math.abs(B.z) <= CHL;
  if (!inX || !inZ){ endPoint(B.lastHitter<2 ? 1 : 0, 'out'); return; }
  if (B.bounces>=2) endPoint(onNear ? 1 : 0, 'double_bounce');
}
function onNet(){
  if (gPhase!=='rally' && gPhase!=='serve_toss') return;
  endPoint(B.lastHitter<2 ? 1 : 0, 'net');
}

// ── Point end ─────────────────────────────────────────
function endPoint(winner, reason){
  gPhase='point_end'; B.active=false; TOSS.stop(); ringActive=false;
  showServeUI(false); showTossUI(false);
  const msgs = { out:'OUT  ·  P'+(winner+1)+' POINT', net:'NET  ·  P'+(winner+1)+' POINT', double_bounce:'P'+(winner+1)+' POINT' };
  showMsg(msgs[reason] || ('P'+(winner+1)+' POINT'), 1400);
  const result = SC.award(winner);
  updateScoreHUD();
  ptTimer = 2400;
  if (result && result.msg) setTimeout(()=>showMsg(result.msg, 2000), 1000);
  if (SC.matchOver) setTimeout(()=>{ gPhase='match_over'; }, 2700);
}

// ── Start point ───────────────────────────────────────
function startPoint(){
  const srv = SC.server;
  P[0].x=0; P[0].z=9; P[1].x=0; P[1].z=-9;
  B.reset(srv===0?0:1);
  ringActive=false;
  TOSS.stop(); srvMeter=0; srvDir=1; srvPower=0; tossHit=false;
  gPhase='serve_meter';
  const srvPi = srv===0?0:1;
  P[srvPi].serving = true;
  P[1-srvPi].serving = false;
  aiCDs[srvPi] = 65;
  showMsg('P'+(srv+1)+' TO SERVE  ·  SET POWER!', 1600);
  if (humanPL.indexOf(srvPi)>=0) showServeUI(true);
  updateScoreHUD();
}

// ── Countdown ─────────────────────────────────────────
function updateCountdown(dt){
  cdTimer += dt;
  if (cdTimer>=1){ cdTimer=0; cdVal--; if (cdVal<=0) startPoint(); else showMsg(String(cdVal), 900); }
}

// ── Mode setup ────────────────────────────────────────
function setupMode(mode){
  gMode = mode;
  if (mode==='ai_2v2') activePL = [0,1,2,3];
  else activePL = [0,1];
  if (mode==='local_1v1')      humanPL=[0,1];
  else if (mode==='ai_1v1')    humanPL=[0];
  else if (mode==='ai_2v2')    humanPL=[0];
  else if (mode==='online')    humanPL=[0]; // your local hits send to peer
  else                          humanPL=[0];
  aiPL = activePL.filter(i => humanPL.indexOf(i)<0);
  if (mode==='online') aiPL = []; // no AI in online mode
  setCtrlHint();
}

// ── Public API ────────────────────────────────────────
function startMode(mode, conn, host, diff){
  peerConn = conn || null;
  isHost = !!host;
  DIFF_CUR = (diff && DIFF[diff]) ? DIFF[diff] : DIFF.medium;
  setupMode(mode);
  SC.reset();
  // Hide ALL overlays, decisively
  document.getElementById('lobby').style.display = 'none';
  document.getElementById('diff-panel').style.display = 'none';
  document.getElementById('online-panel').style.display = 'none';
  showHUD(true);
  gPhase='countdown'; cdVal=3; cdTimer=0;
  showMsg('3', 900);
}
function goLobby(){
  gPhase='lobby';
  B.active=false; TOSS.stop();
  showHUD(false); showServeUI(false); showTossUI(false);
  $bigmsg.style.display='none';
  document.getElementById('diff-panel').style.display = 'none';
  document.getElementById('online-panel').style.display = 'none';
  document.getElementById('lobby').style.display = 'flex';
}
function onPeerData(d){
  if (d.type==='state'){ B.x=d.bx; B.y=d.by; B.z=d.bz; B.vx=d.vx; B.vy=d.vy; B.vz=d.vz; B.active=d.act; P[1].x=d.p2x; P[1].z=d.p2z; }
  if (d.type==='hit' && !isHost) B.launch(d.pi, d.tx, d.tz, d.spd, d.arcH);
  if (d.type==='input' && isHost){ /* update remote P2 input */ KEYS['_remote'] = d; }
}

window.game = { startMode: startMode, goLobby: goLobby, onPeerData: onPeerData };
if (window._pendingMode){
  startMode(window._pendingMode, undefined, undefined, window._pendingDiff);
  window._pendingMode = null; window._pendingDiff = null;
}

// ── Render ────────────────────────────────────────────
const COURT_BLUE   = '#0a5ab4';
const COURT_DARK   = '#094ea0';
const SURROUND     = '#1e4228';
const NEON_BLUE    = '#00b4ff';
const LINE_WHITE   = '#ffffff';

function drawQuad(p1,p2,p3,p4, fill){
  ctx.beginPath();
  ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y); ctx.lineTo(p3.x,p3.y); ctx.lineTo(p4.x,p4.y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}
function drawLine(x1,z1,x2,z2,col,w){
  const a = project(x1, 0, z1), b = project(x2, 0, z2);
  if (a.behind || b.behind) return;
  ctx.strokeStyle = col;
  ctx.lineWidth = w * (a.scale + b.scale) * 0.5 * 0.04;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
}

function drawCourt(){
  // Sky gradient
  const skyG = ctx.createLinearGradient(0,0,0,H);
  skyG.addColorStop(0, '#0a1430');
  skyG.addColorStop(0.6, '#06091a');
  skyG.addColorStop(1, '#03060f');
  ctx.fillStyle = skyG; ctx.fillRect(0,0,W,H);

  // Surround (green)
  const sa=project(-30,0,-30), sb=project(30,0,-30), sc=project(30,0,30), sd=project(-30,0,30);
  drawQuad(sa,sb,sc,sd, SURROUND);

  // Court surface
  const ca=project(-CHW,0,-CHL), cb=project(CHW,0,-CHL), cc=project(CHW,0,CHL), cd=project(-CHW,0,CHL);
  drawQuad(ca,cb,cc,cd, COURT_BLUE);

  // Service boxes (slightly darker overlay)
  ctx.globalAlpha = 0.5;
  const sb1a=project(-CHW,0,SVC_Z), sb1b=project(0,0,SVC_Z), sb1c=project(0,0,0), sb1d=project(-CHW,0,0);
  drawQuad(sb1a,sb1b,sb1c,sb1d, COURT_DARK);
  const sb2a=project(0,0,SVC_Z), sb2b=project(CHW,0,SVC_Z), sb2c=project(CHW,0,0), sb2d=project(0,0,0);
  drawQuad(sb2a,sb2b,sb2c,sb2d, COURT_DARK);
  const sb3a=project(-CHW,0,0), sb3b=project(CHW,0,0), sb3c=project(CHW,0,-SVC_Z), sb3d=project(-CHW,0,-SVC_Z);
  drawQuad(sb3a,sb3b,sb3c,sb3d, COURT_DARK);
  ctx.globalAlpha = 1;

  // Lines (glow + white)
  const lines = [
    [-CHW, CHL, CHW, CHL],   [-CHW,-CHL, CHW,-CHL],
    [-CHW, CHL,-CHW,-CHL],   [ CHW, CHL, CHW,-CHL],
    [-CHW, SVC_Z, CHW, SVC_Z], [-CHW,-SVC_Z, CHW,-SVC_Z],
    [0, SVC_Z, 0,-SVC_Z],
    [-0.22, CHL, 0.22, CHL], [-0.22,-CHL, 0.22,-CHL],
  ];
  // White lines
  ctx.shadowBlur = 8;
  ctx.shadowColor = 'rgba(255,255,255,0.7)';
  for (let i=0; i<lines.length; i++){
    const L = lines[i];
    drawLine(L[0],L[1],L[2],L[3], LINE_WHITE, 0.06);
  }
  ctx.shadowBlur = 0;

  // Neon edge strips
  ctx.shadowBlur = 16;
  ctx.shadowColor = NEON_BLUE;
  drawLine(-CHW, CHL, CHW, CHL, NEON_BLUE, 0.08);
  drawLine(-CHW,-CHL, CHW,-CHL, NEON_BLUE, 0.08);
  drawLine(-CHW, CHL,-CHW,-CHL, NEON_BLUE, 0.08);
  drawLine( CHW, CHL, CHW,-CHL, NEON_BLUE, 0.08);
  ctx.shadowBlur = 0;

  // Net
  drawNet();
}

function drawNet(){
  // Net is a 2D rectangle from (-CHW-0.5, 0, 0) to (CHW+0.5, NET_H, 0)
  const nL_b = project(-CHW-0.5, 0, 0), nR_b = project(CHW+0.5, 0, 0);
  const nL_t = project(-CHW-0.5, NET_H, 0), nR_t = project(CHW+0.5, NET_H, 0);
  // Mesh
  ctx.fillStyle = 'rgba(34,51,85,0.55)';
  ctx.beginPath();
  ctx.moveTo(nL_b.x,nL_b.y); ctx.lineTo(nR_b.x,nR_b.y); ctx.lineTo(nR_t.x,nR_t.y); ctx.lineTo(nL_t.x,nL_t.y);
  ctx.closePath(); ctx.fill();
  // Mesh lines
  ctx.strokeStyle = 'rgba(180,200,230,0.35)';
  ctx.lineWidth = 1;
  for (let i=1; i<10; i++){
    const ty = NET_H * (i/10);
    const a = project(-CHW-0.5, ty, 0), b = project(CHW+0.5, ty, 0);
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
  }
  for (let i=0; i<=20; i++){
    const tx = -CHW-0.5 + (CW+1)*(i/20);
    const a = project(tx, 0, 0), b = project(tx, NET_H, 0);
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
  }
  // Tape (white glowing line at top)
  ctx.shadowBlur = 12; ctx.shadowColor = '#fff';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(2, 4*(nL_t.scale*0.04));
  ctx.beginPath(); ctx.moveTo(nL_t.x, nL_t.y); ctx.lineTo(nR_t.x, nR_t.y); ctx.stroke();
  ctx.shadowBlur = 0;
  // Posts
  ctx.fillStyle = '#888899';
  for (const sx of [-CHW-0.5, CHW+0.5]){
    const top = project(sx, NET_H+0.12, 0);
    const bot = project(sx, 0, 0);
    if (top.behind || bot.behind) continue;
    const w = Math.max(3, 6*top.scale*0.04);
    ctx.fillRect(top.x - w/2, top.y, w, bot.y - top.y);
  }
}

function drawCharacter(p, isMain){
  const baseY = p.jumpH || 0;
  const head  = project(p.x, 1.7+baseY, p.z);
  const torso = project(p.x, 1.08+baseY, p.z);
  const feet  = project(p.x, 0+baseY, p.z);
  if (head.behind || feet.behind) return;
  const sc = head.scale * 0.04;
  // Shadow
  const sh = project(p.x, 0.01, p.z);
  if (!sh.behind){
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(sh.x, sh.y+2, 18*sc, 6*sc, 0, 0, Math.PI*2);
    ctx.fill();
  }
  // Legs
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(feet.x - 8*sc, feet.y - 30*sc, 16*sc, 30*sc);
  // Torso
  ctx.fillStyle = p.col;
  ctx.shadowBlur = 8; ctx.shadowColor = p.col;
  ctx.fillRect(torso.x - 12*sc, torso.y - 20*sc, 24*sc, 38*sc);
  ctx.shadowBlur = 0;
  // Head
  ctx.fillStyle = '#d4956a';
  ctx.beginPath();
  ctx.arc(head.x, head.y, 9*sc, 0, Math.PI*2); ctx.fill();
  // Racket arm (animates on swing)
  const swingT = p.swingT > 0 ? Math.sin((p.swingT/18) * Math.PI) : 0;
  const armDir = p.side==='near' ? -1 : 1;
  const armBaseX = torso.x + 14*sc*armDir;
  const armBaseY = torso.y - 12*sc;
  const racketX = armBaseX + (18 + swingT*22)*sc*armDir;
  const racketY = armBaseY - (12 - swingT*20)*sc;
  // Arm
  ctx.strokeStyle = '#d4956a';
  ctx.lineWidth = 4*sc;
  ctx.beginPath(); ctx.moveTo(armBaseX, armBaseY); ctx.lineTo(racketX, racketY); ctx.stroke();
  // Racket head
  ctx.fillStyle = p.col;
  ctx.shadowBlur = 10; ctx.shadowColor = p.col;
  ctx.beginPath(); ctx.ellipse(racketX, racketY, 10*sc, 13*sc, 0, 0, Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0;
  // Strings
  ctx.strokeStyle = 'rgba(170,200,255,0.7)';
  ctx.lineWidth = 1;
  for (let i=-2; i<=2; i++){
    ctx.beginPath();
    ctx.moveTo(racketX-9*sc, racketY+i*4*sc);
    ctx.lineTo(racketX+9*sc, racketY+i*4*sc);
    ctx.stroke();
  }
}

function drawBall(){
  if (!B.active && !TOSS.active) return;
  // Trail
  for (let i=0; i<B.trail.length; i++){
    const t = B.trail[i];
    const p = project(t.x, t.y, t.z);
    if (p.behind) continue;
    const a = (1 - i/B.trail.length) * 0.5;
    const r = (1 - i/B.trail.length) * 8 * p.scale * 0.04;
    ctx.fillStyle = 'rgba(178,255,20,'+a+')';
    ctx.shadowBlur = 12; ctx.shadowColor = '#b2ff14';
    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1, r), 0, Math.PI*2); ctx.fill();
  }
  ctx.shadowBlur = 0;
  // Ball
  if (B.active){
    const p = project(B.x, B.y, B.z);
    if (!p.behind){
      const r = Math.max(3, 12 * p.scale * 0.04);
      ctx.fillStyle = '#b2ff14';
      ctx.shadowBlur = 22; ctx.shadowColor = '#b2ff14';
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
  // Toss ball
  if (TOSS.active){
    const p = project(TOSS.x, TOSS.y+0.18, TOSS.z);
    if (!p.behind){
      const r = Math.max(3, 12 * p.scale * 0.04);
      ctx.fillStyle = '#b2ff14';
      ctx.shadowBlur = 22; ctx.shadowColor = '#b2ff14';
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
}

function drawHitRing(){
  if (!ringActive || !B.active) return;
  const p = project(B.x, B.y+0.05, B.z);
  if (p.behind) return;
  const baseR = ringR / 0.7 * 35 * p.scale * 0.04;
  const q = ringR<0.22 ? 1 : ringR<0.38 ? 0.6 : 0.3;
  const col = q>0.85 ? '#60ff80' : q>0.5 ? '#ffdd33' : '#ff5050';
  ctx.strokeStyle = col;
  ctx.lineWidth = Math.max(2, 4*p.scale*0.04);
  ctx.shadowBlur = 14; ctx.shadowColor = col;
  ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(4, baseR), 0, Math.PI*2); ctx.stroke();
  ctx.shadowBlur = 0;
}

function render(){
  ctx.clearRect(0,0,W,H);
  drawCourt();
  // Painter's algorithm: draw far things first, near things last
  const objs = [];
  for (let i=0; i<activePL.length; i++){
    const pi = activePL[i];
    objs.push({ z:P[pi].z, type:'p', i:pi });
  }
  if (B.active) objs.push({ z:B.z, type:'b' });
  if (TOSS.active) objs.push({ z:TOSS.z, type:'t' });
  // Sort by z DESCENDING (far to near; far has more negative z, near has positive z, but camera is at z=14 looking -z, so smallest z is farthest)
  objs.sort((a,b)=> a.z - b.z);
  for (let i=0; i<objs.length; i++){
    const o = objs[i];
    if (o.type==='p') drawCharacter(P[o.i], o.i===0);
    else if (o.type==='b' || o.type==='t') drawBall();
  }
  drawHitRing();
}

// ── Camera follow ────────────────────────────────────
function updateCamera(){
  const p0 = P[0];
  const tx = p0.x*0.6, ty = 3.4, tz = p0.z + 5.2;
  CAM.x += (tx - CAM.x) * 0.08;
  CAM.y += (ty - CAM.y) * 0.08;
  CAM.z += (tz - CAM.z) * 0.08;
}

// ── Sync character on swing animation ────────────────
function syncChar(pi){
  P[pi].swingT = Math.max(0, P[pi].swingT - 1);
}

// ── Main loop ────────────────────────────────────────
let lastT = 0;
function animate(now){
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastT)/1000, 0.05) || 0.016;
  lastT = now;

  if (gPhase==='lobby'){ ctx.clearRect(0,0,W,H); return; }

  if (gPhase==='countdown') updateCountdown(dt);

  if (gPhase==='serve_meter'){
    srvMeter += srvDir * 0.008 * (dt*60);
    if (srvMeter>=1){ srvMeter=1; srvDir=-1; }
    if (srvMeter<=0){ srvMeter=0; srvDir=1; }
    updateServeMeter(srvMeter);
    updateAI(dt);
  }

  if (gPhase==='serve_toss'){
    TOSS.update();
    const tn = TOSS.t / TOSS.dur;
    showTossUI(true, tn);
    updateAI(dt);
    P[0].jumpH = Math.max(0, P[0].jumpH - dt*3);
    P[1].jumpH = Math.max(0, P[1].jumpH - dt*3);
  }

  if (gPhase==='rally'){
    updateHumans(dt);
    updateAI(dt);
    B.update(dt);
    if (peerConn && isHost){
      try { peerConn.send({type:'state', bx:B.x, by:B.y, bz:B.z, vx:B.vx, vy:B.vy, vz:B.vz, act:B.active, p2x:P[1].x, p2z:P[1].z}); } catch(_){}
    }
  }

  if (gPhase==='point_end'){
    ptTimer -= dt*1000;
    if (ptTimer<=0){ if (SC.matchOver) gPhase='match_over'; else startPoint(); }
  }

  updateCamera();
  for (let i=0; i<activePL.length; i++) syncChar(activePL[i]);

  if (gPhase==='match_over'){
    showMsg('P'+(SC.winner+1)+' WINS THE MATCH!\n\nClick to return', 99999);
  }

  render();
}
requestAnimationFrame(animate);

// ── Wire up ALL UI buttons in this same script ───────
let pendingAIMode = null;
function selectMode(m, diff){
  startMode(m, undefined, undefined, diff);
}
function openDiff(mode, label){
  pendingAIMode = mode;
  document.getElementById('diff-modename').textContent = label;
  document.getElementById('diff-panel').style.display = 'flex';
  document.getElementById('lobby').style.display = 'none';
}
function closeDiff(){
  document.getElementById('diff-panel').style.display = 'none';
  document.getElementById('lobby').style.display = 'flex';
  pendingAIMode = null;
}
function pickDiff(d){
  document.getElementById('diff-panel').style.display = 'none';
  selectMode(pendingAIMode, d);
  pendingAIMode = null;
}

document.getElementById('m-ai').onclick     = function(){ openDiff('ai_1v1','1V1 VS AI'); };
document.getElementById('m-local').onclick  = function(){ selectMode('local_1v1'); };
document.getElementById('m-2v2').onclick    = function(){ openDiff('ai_2v2','2V2 VS AI'); };
document.getElementById('m-online').onclick = function(){ openOnline(); };
document.getElementById('d-easy').onclick   = function(){ pickDiff('easy'); };
document.getElementById('d-med').onclick    = function(){ pickDiff('medium'); };
document.getElementById('d-hard').onclick   = function(){ pickDiff('hard'); };
document.getElementById('d-back').onclick   = function(){ closeDiff(); };
document.getElementById('back-btn').onclick = function(){ goLobby(); };

// ── Online (PeerJS) ──────────────────────────────────
let myPeer=null, pConn=null;
function openOnline(){
  document.getElementById('online-panel').style.display='flex';
  document.getElementById('lobby').style.display='none';
  swTab('h'); initHost();
}
function closeOnline(showLobby){
  document.getElementById('online-panel').style.display='none';
  if (showLobby) document.getElementById('lobby').style.display='flex';
  if (myPeer && !pConn){ try { myPeer.destroy(); } catch(_){} myPeer=null; }
}
function swTab(t){
  document.getElementById('hv').style.display = t==='h' ? 'flex' : 'none';
  document.getElementById('jv').style.display = t==='j' ? 'flex' : 'none';
  document.getElementById('t-h').className = 'tab' + (t==='h'?' on':'');
  document.getElementById('t-j').className = 'tab' + (t==='j'?' on':'');
  if (t==='j' && myPeer){ try { myPeer.destroy(); } catch(_){} myPeer=null; pConn=null; }
  if (t==='h') initHost();
}
function setSt(id, msg, cls){
  const e = document.getElementById(id);
  e.textContent = msg;
  e.className = 'st' + (cls?' '+cls:'');
}
function genCode(){
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = 'spk-';
  for (let i=0; i<6; i++) s += chars[Math.floor(Math.random()*chars.length)];
  return s;
}
function initHost(){
  document.getElementById('rcode').textContent = '– – – –';
  setSt('hst', 'Connecting…', '');
  if (myPeer){ try { myPeer.destroy(); } catch(_){} myPeer=null; pConn=null; }
  let attempts=0;
  function tryCreate(){
    if (typeof Peer==='undefined'){ setTimeout(tryCreate, 300); return; }
    if (attempts++ > 5){ setSt('hst', 'Could not get a code. Refresh and try again.', 'err'); return; }
    const code = genCode();
    myPeer = new Peer(code);
    myPeer.on('open', function(id){
      document.getElementById('rcode').textContent = id.replace('spk-','').toUpperCase();
      setSt('hst', 'Waiting for opponent…', '');
    });
    myPeer.on('connection', function(conn){
      pConn = conn;
      setSt('hst', 'Opponent connected! Starting…', 'ok');
      conn.on('open', function(){
        conn.on('data', function(d){ if (window.game) window.game.onPeerData(d); });
      });
      setTimeout(function(){
        document.getElementById('online-panel').style.display='none';
        startMode('online', conn, true);
      }, 1200);
    });
    myPeer.on('error', function(e){
      if (e.type==='unavailable-id'){ try { myPeer.destroy(); } catch(_){} tryCreate(); return; }
      setSt('hst', 'Connection error ('+e.type+'). Try refreshing.', 'err');
    });
  }
  tryCreate();
}
function joinRoom(){
  const inp = document.getElementById('jin');
  const raw = (inp.value || '').trim().toUpperCase();
  if (raw.length<4){ setSt('jst', 'Enter a valid code', 'err'); return; }
  const code = 'spk-' + raw;
  setSt('jst', 'Connecting…', '');
  if (myPeer){ try { myPeer.destroy(); } catch(_){} myPeer=null; }
  function tryJoin(){
    if (typeof Peer==='undefined'){ setTimeout(tryJoin, 300); return; }
    myPeer = new Peer();
    myPeer.on('open', function(){
      pConn = myPeer.connect(code, {reliable:true});
      pConn.on('open', function(){
        setSt('jst', 'Connected! Starting…', 'ok');
        pConn.on('data', function(d){ if (window.game) window.game.onPeerData(d); });
        setTimeout(function(){
          document.getElementById('online-panel').style.display='none';
          startMode('online', pConn, false);
        }, 1200);
      });
      pConn.on('error', function(){ setSt('jst', 'Could not connect. Check the code.', 'err'); });
    });
    myPeer.on('error', function(e){
      if (e.type==='peer-unavailable'){ setSt('jst', 'Room not found. Check the code.', 'err'); return; }
      setSt('jst', 'Error: '+e.type+'. Try again.', 'err');
    });
  }
  tryJoin();
}

document.getElementById('t-h').onclick      = function(){ swTab('h'); };
document.getElementById('t-j').onclick      = function(){ swTab('j'); };
document.getElementById('o-cancel-h').onclick = function(){ closeOnline(true); };
document.getElementById('o-cancel-j').onclick = function(){ closeOnline(true); };
document.getElementById('o-join').onclick   = function(){ joinRoom(); };
document.getElementById('jin').addEventListener('input', function(e){
  e.target.value = e.target.value.toUpperCase();
});

})();
