// Spike Tennis — Three.js 3D Game Engine (global THREE loaded via <script> tag)

// ── Renderer ──────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
renderer.domElement.style.cssText = 'position:fixed;inset:0;z-index:1';

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ── Scene & Camera ────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050810);
scene.fog = new THREE.FogExp2(0x0a1020, 0.016);

const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.1, 300);
camera.position.set(0, 3.5, 16);
camera.lookAt(0, 1.5, 0);

// ── Lighting ──────────────────────────────────────────
const ambient = new THREE.AmbientLight(0x112233, 0.8);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xffeedd, 1.4);
sun.position.set(8, 20, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 80;
sun.shadow.camera.left = -20; sun.shadow.camera.right = 20;
sun.shadow.camera.top = 20;   sun.shadow.camera.bottom = -20;
scene.add(sun);

// Fill light from opposite side
scene.add(Object.assign(new THREE.DirectionalLight(0x334466, 0.5), {
  position: new THREE.Vector3(-5, 8, -12)
}));

const ballLight = new THREE.PointLight(0xb2ff14, 3, 6);
scene.add(ballLight);

// ── Court constants ────────────────────────────────────
// Z: positive = near (P1), negative = far (P2)
const CW = 10, CL = 22, CHW = 5, CHL = 11;
const NET_H = 0.92, SVC_Z = 5.5;
// P1 starts at z ≈ 9, P2 at z ≈ -9

// ── Court builder ──────────────────────────────────────
function buildCourt() {
  // Surround
  const surroundM = new THREE.MeshStandardMaterial({ color: 0x1e4228, roughness: 0.95 });
  const surround = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), surroundM);
  surround.rotation.x = -Math.PI / 2;
  surround.position.y = -0.01;
  surround.receiveShadow = true;
  scene.add(surround);

  // Surface
  const surfM = new THREE.MeshStandardMaterial({ color: 0x0a5ab4, roughness: 0.75, metalness: 0.05 });
  const surf = new THREE.Mesh(new THREE.PlaneGeometry(CW, CL), surfM);
  surf.rotation.x = -Math.PI / 2;
  surf.receiveShadow = true;
  scene.add(surf);

  // Service box overlay (slightly darker)
  const svcM = new THREE.MeshStandardMaterial({ color: 0x094ea0, roughness: 0.75, transparent: true, opacity: 0.5 });
  [[CHW, SVC_Z], [-CHW, SVC_Z], [0, -SVC_Z]].forEach(([_x, z]) => {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(CHW, SVC_Z), svcM);
    s.rotation.x = -Math.PI / 2;
    s.position.set(z > 0 ? CHW / 2 : -CHW / 2, 0.001, z > 0 ? SVC_Z / 2 : -SVC_Z / 2);
    scene.add(s);
  });

  // Lines (thin white emissive boxes)
  const lineM = new THREE.MeshStandardMaterial({
    color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.55
  });
  function wline(x1, z1, x2, z2, w = 0.055) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.022, len), lineM);
    mesh.position.set((x1 + x2) / 2, 0.011, (z1 + z2) / 2);
    mesh.rotation.y = Math.atan2(x2 - x1, z2 - z1);
    scene.add(mesh);
  }
  wline(-CHW, CHL, CHW, CHL);   // near baseline
  wline(-CHW, -CHL, CHW, -CHL); // far baseline
  wline(-CHW, CHL, -CHW, -CHL); // left sideline
  wline(CHW, CHL, CHW, -CHL);   // right sideline
  wline(-CHW, SVC_Z, CHW, SVC_Z);    // near service line
  wline(-CHW, -SVC_Z, CHW, -SVC_Z);  // far service line
  wline(0, SVC_Z, 0, -SVC_Z);        // center service line
  wline(-0.22, CHL, 0.22, CHL, 0.055);  // center marks
  wline(-0.22, -CHL, 0.22, -CHL, 0.055);

  // Neon court edge strips
  const neonM = new THREE.MeshStandardMaterial({
    color: 0x00b4ff, emissive: 0x00b4ff, emissiveIntensity: 2.5
  });
  function nline(x1, z1, x2, z2) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, len), neonM);
    m.position.set((x1 + x2) / 2, 0.03, (z1 + z2) / 2);
    m.rotation.y = Math.atan2(x2 - x1, z2 - z1);
    scene.add(m);
  }
  nline(-CHW, CHL, CHW, CHL); nline(-CHW, -CHL, CHW, -CHL);
  nline(-CHW, CHL, -CHW, -CHL); nline(CHW, CHL, CHW, -CHL);

  // Net
  const netM = new THREE.MeshStandardMaterial({
    color: 0x223355, transparent: true, opacity: 0.55, side: THREE.DoubleSide
  });
  const netMesh = new THREE.Mesh(new THREE.PlaneGeometry(CW + 1, NET_H), netM);
  netMesh.position.set(0, NET_H / 2, 0);
  scene.add(netMesh);

  // Net tape
  const tapeM = new THREE.MeshStandardMaterial({
    color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.45
  });
  const tape = new THREE.Mesh(new THREE.BoxGeometry(CW + 1, 0.045, 0.07), tapeM);
  tape.position.set(0, NET_H + 0.02, 0);
  scene.add(tape);

  // Net posts
  const postM = new THREE.MeshStandardMaterial({ color: 0x888899, metalness: 0.6 });
  [-CHW - 0.5, CHW + 0.5].forEach(x => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, NET_H + 0.12, 10), postM);
    p.position.set(x, (NET_H + 0.12) / 2, 0);
    p.castShadow = true;
    scene.add(p);
  });

  // Stadium walls (far backdrop)
  const wallM = new THREE.MeshStandardMaterial({ color: 0x0d1a2a, roughness: 1 });
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(80, 20), wallM);
  backWall.position.set(0, 8, -24);
  scene.add(backWall);

  const sideL = new THREE.Mesh(new THREE.PlaneGeometry(30, 20), wallM);
  sideL.position.set(-20, 8, 0);
  sideL.rotation.y = Math.PI / 2;
  scene.add(sideL);

  const sideR = new THREE.Mesh(new THREE.PlaneGeometry(30, 20), wallM);
  sideR.position.set(20, 8, 0);
  sideR.rotation.y = -Math.PI / 2;
  scene.add(sideR);
}

// ── Character builder ─────────────────────────────────
function buildChar(hex) {
  const g = new THREE.Group();
  const col = new THREE.Color(hex);

  const bodyM = new THREE.MeshStandardMaterial({
    color: hex, emissive: col.clone().multiplyScalar(0.35), roughness: 0.4
  });
  const skinM = new THREE.MeshStandardMaterial({ color: 0xd4956a, roughness: 0.8 });
  const shortM = new THREE.MeshStandardMaterial({ color: 0x0a0a1a, roughness: 0.9 });
  const shoeM  = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.82, 0.30), bodyM);
  torso.position.y = 1.08; torso.castShadow = true; g.add(torso);

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 14), skinM);
  head.position.y = 1.72; head.castShadow = true; g.add(head);

  // Shorts
  const shorts = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.32, 0.30), shortM);
  shorts.position.y = 0.62; shorts.castShadow = true; g.add(shorts);

  // Legs
  [-0.14, 0.14].forEach(x => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.52, 0.2), skinM);
    leg.position.set(x, 0.2, 0); leg.castShadow = true; g.add(leg);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.32), shoeM);
    shoe.position.set(x, -0.06, 0.04); g.add(shoe);
  });

  // Non-racket arm
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.52, 0.18), skinM);
  armL.position.set(-0.42, 1.02, 0); armL.rotation.z = 0.35; armL.castShadow = true; g.add(armL);

  // Racket arm group (pivots on swing)
  const armR = new THREE.Group();
  armR.position.set(0.32, 1.08, 0);
  const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.50, 0.17), skinM);
  forearm.position.set(0.28, 0.05, 0); forearm.rotation.z = -0.55; armR.add(forearm);

  // Racket
  const racketG = new THREE.Group();
  racketG.position.set(0.62, 0.0, 0);

  // Handle
  const handleM = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.7 });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.38, 8), handleM);
  handle.rotation.z = Math.PI / 2; handle.position.set(0, -0.28, 0); racketG.add(handle);

  // Frame
  const frameM = new THREE.MeshStandardMaterial({
    color: hex, emissive: col.clone().multiplyScalar(0.8), emissiveIntensity: 1.0, roughness: 0.3
  });
  const frame = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.045, 8, 24), frameM);
  frame.rotation.x = Math.PI / 2; racketG.add(frame);

  // Strings
  const strM = new THREE.MeshStandardMaterial({
    color: 0xaaccff, emissive: 0x5588ff, emissiveIntensity: 0.7, transparent: true, opacity: 0.75
  });
  for (let i = -2; i <= 2; i++) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.018, 0.018), strM);
    h.position.y = i * 0.11; racketG.add(h);
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.54, 0.018), strM);
    v.position.x = i * 0.11; racketG.add(v);
  }
  armR.add(racketG);
  g.add(armR);

  return { group: g, armR, racketG };
}

// ── Ball ──────────────────────────────────────────────
const ballGeo = new THREE.SphereGeometry(0.18, 20, 20);
const ballMat = new THREE.MeshStandardMaterial({
  color: 0xb2ff14, emissive: 0x5a9900, emissiveIntensity: 0.9, roughness: 0.25, metalness: 0.1
});
const ballMesh = new THREE.Mesh(ballGeo, ballMat);
ballMesh.castShadow = true;
scene.add(ballMesh);

// Ball trail (pool of small spheres)
const TRAIL_LEN = 14;
const trailMeshes = Array.from({ length: TRAIL_LEN }, (_, i) => {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.18 * (1 - i / TRAIL_LEN) * 0.8, 8, 8),
    new THREE.MeshStandardMaterial({
      color: 0xb2ff14, emissive: 0x446600,
      emissiveIntensity: 0.6 * (1 - i / TRAIL_LEN),
      transparent: true, opacity: 0.7 * (1 - i / TRAIL_LEN)
    })
  );
  m.visible = false;
  scene.add(m);
  return m;
});

// ── Toss ball (separate mesh for serve) ──────────────
const tossMesh = ballMesh.clone();
scene.add(tossMesh);
tossMesh.visible = false;

// ── Ball state ────────────────────────────────────────
const B = {
  pos: new THREE.Vector3(0, 0.18, 9),
  vel: new THREE.Vector3(),
  active: false, lastHitter: 0, bounces: 0,
  trail: [],
  GRAV: 16, BOUNCE: 0.58,
  reset(side) {
    this.pos.set(0, 0.18, side === 0 ? 9 : -9);
    this.vel.set(0, 0, 0);
    this.active = false; this.bounces = 0; this.trail = [];
    ballMesh.position.copy(this.pos);
    trailMeshes.forEach(m => m.visible = false);
  },
  launch(fromPi, tx, tz, speed, arcH) {
    const p = chars[fromPi].group;
    this.pos.set(p.position.x, 0.9, p.position.z + (fromPi < 2 ? -0.4 : 0.4));
    this.bounces = 0; this.lastHitter = fromPi; this.active = true; this.trail = [];
    const dx = tx - this.pos.x, dz = tz - this.pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz) || 1;
    const t = dist / speed;
    this.vel.set(dx / t, this.GRAV * t * 0.5 + (arcH - this.pos.y) / t, dz / t);
  },
  update(dt) {
    if (!this.active) return;
    this.trail.unshift(this.pos.clone());
    if (this.trail.length > TRAIL_LEN) this.trail.pop();

    this.vel.y -= this.GRAV * dt;
    this.pos.addScaledVector(this.vel, dt);

    // Bounce
    if (this.pos.y <= 0.18) {
      this.pos.y = 0.18;
      if (Math.abs(this.vel.y) > 0.4) {
        this.vel.y = Math.abs(this.vel.y) * this.BOUNCE;
        this.vel.x *= 0.84; this.vel.z *= 0.84;
        this.bounces++;
        onBounce();
      } else { this.vel.y = 0; }
    }

    // Net check
    if (this.pos.y < NET_H + 0.1) {
      const prevZ = this.pos.z - this.vel.z * dt;
      if ((prevZ > 0.15 && this.pos.z <= 0.15) || (prevZ < -0.15 && this.pos.z >= -0.15)) {
        if (Math.abs(this.pos.x) < CHW) onNet();
      }
    }

    ballMesh.position.copy(this.pos);
    ballLight.position.copy(this.pos);

    // Trail update
    this.trail.forEach((tp, i) => {
      trailMeshes[i].visible = true;
      trailMeshes[i].position.copy(tp);
    });
    for (let i = this.trail.length; i < TRAIL_LEN; i++) trailMeshes[i].visible = false;
  }
};

// ── Characters ────────────────────────────────────────
const chars = [
  buildChar(0x00c8ff),  // P1 cyan
  buildChar(0xff6050),  // P2 red
  buildChar(0x40e890),  // P3 green (2v2 partner)
  buildChar(0xff9632),  // P4 orange (2v2 opponent)
];
chars.forEach(c => scene.add(c.group));

// ── Player state ──────────────────────────────────────
const P = [
  { x: 0, z: 9,  side: 'near', speed: 3.5, sprintSpd: 5.5, swingT: 0, hitCD: 0, jumpH: 0, serving: false },
  { x: 0, z: -9, side: 'far',  speed: 3.5, sprintSpd: 5.5, swingT: 0, hitCD: 0, jumpH: 0, serving: false },
  { x: 2, z: 9,  side: 'near', speed: 3.5, sprintSpd: 5.5, swingT: 0, hitCD: 0, jumpH: 0, serving: false },
  { x: -2,z: -9, side: 'far',  speed: 3.5, sprintSpd: 5.5, swingT: 0, hitCD: 0, jumpH: 0, serving: false },
];

function syncChar(pi) {
  const p = P[pi], c = chars[pi].group;
  c.position.set(p.x, p.jumpH * 1.2, p.z);
  // Swing animation
  const sw = p.swingT > 0 ? Math.sin(p.swingT / 18 * Math.PI) : 0;
  chars[pi].armR.rotation.z = -0.55 + sw * 1.4;
  chars[pi].armR.rotation.y = sw * 0.6;
  // Face net
  c.rotation.y = p.side === 'near' ? Math.PI : 0;
}

// ── Toss state (serve phase 2) ────────────────────────
const TOSS = {
  x: 0, z: 0, y: 0,
  t: 0, dur: 95, peak: 3.4, active: false,
  start(x, z) { this.x = x; this.z = z; this.y = 0; this.t = 0; this.active = true; tossMesh.visible = true; },
  update() {
    if (!this.active) return;
    this.t++;
    const tn = this.t / this.dur;
    this.y = this.peak * 4 * tn * (1 - tn);
    tossMesh.position.set(this.x, this.y + 0.18, this.z);
    if (this.t >= this.dur) { this.active = false; tossMesh.visible = false; }
  },
  stop() { this.active = false; tossMesh.visible = false; }
};

// ── Hit ring (3D billboard) ───────────────────────────
const ringGeo = new THREE.RingGeometry(0.45, 0.52, 36);
const ringMat = new THREE.MeshBasicMaterial({
  color: 0xffdd33, side: THREE.DoubleSide, transparent: true, opacity: 0.92
});
const ring3d = new THREE.Mesh(ringGeo, ringMat);
ring3d.visible = false;
scene.add(ring3d);
let ringR = 0.7, ringActive = false;

function updateRing3d() {
  if (!ringActive) { ring3d.visible = false; return; }
  ringR = Math.max(0.08, ringR - 0.012);
  if (ringR <= 0.09) { ringActive = false; ring3d.visible = false; return; }

  ring3d.visible = true;
  ring3d.position.copy(B.pos);
  ring3d.position.y += 0.05;
  ring3d.lookAt(camera.position);

  const q = ringR < 0.22 ? 1 : ringR < 0.38 ? 0.6 : 0.3;
  const col = q > 0.85 ? 0x60ff80 : q > 0.5 ? 0xffdd33 : 0xff5050;
  ringMat.color.setHex(col);

  // Scale ring based on radius
  ring3d.scale.setScalar(ringR / 0.7 * 1.4);
}
function ringQuality() { return ringR < 0.22 ? 1 : ringR < 0.38 ? 0.62 : 0.35; }

// ── Game state ────────────────────────────────────────
let gMode = 'ai_1v1';
let gPhase = 'lobby'; // lobby|countdown|serve_meter|serve_toss|rally|point_end|match_over
let cdVal = 3, cdTimer = 0, ptTimer = 0;
let activePL = [0,1], humanPL = [0], aiPL = [1];
let srvMeter = 0, srvDir = 1, srvPower = 0, tossHit = false;
let aiCDs = [0, 0, 0, 0];

// Difficulty (Easy / Medium / Hard) — affects AI behavior
const DIFF = {
  easy:   { spdMult: 0.55, range: 4.0, reactCD: 38, missChance: 0.22, aimNoise: 2.4, power: 0.72, srvBaseCD: 90 },
  medium: { spdMult: 1.00, range: 5.5, reactCD: 22, missChance: 0.06, aimNoise: 1.2, power: 1.00, srvBaseCD: 65 },
  hard:   { spdMult: 1.40, range: 6.5, reactCD:  8, missChance: 0.00, aimNoise: 0.5, power: 1.30, srvBaseCD: 38 },
};
let difficulty = 'medium';
let DIFF_CUR = DIFF.medium;

// Online
let peerConn = null, isHost = false;

// ── Scoring ───────────────────────────────────────────
const SC = {
  pts:[0,0],games:[0,0],sets:[0,0],server:0,deuce:false,adv:-1,matchOver:false,winner:-1,
  D:['0','15','30','40'],
  reset(){Object.assign(this,{pts:[0,0],games:[0,0],sets:[0,0],server:0,deuce:false,adv:-1,matchOver:false,winner:-1});},
  award(i){
    if(this.matchOver)return null;
    if(this.deuce){
      if(this.adv<0){this.adv=i;return{msg:'ADVANTAGE  P'+(i+1)};}
      if(this.adv===i)return this._g(i);
      this.adv=-1;return{msg:'DEUCE'};
    }
    this.pts[i]++;
    if(this.pts[0]===3&&this.pts[1]===3){this.deuce=true;this.adv=-1;return{msg:'DEUCE'};}
    if(this.pts[i]>=4)return this._g(i);
    return{msg:this.str()};
  },
  _g(i){
    this.pts=[0,0];this.deuce=false;this.adv=-1;this.games[i]++;this.server=1-this.server;
    const[g0,g1]=[this.games[0],this.games[1]];
    if(g0===7||g1===7||(Math.max(g0,g1)>=6&&Math.abs(g0-g1)>=2))return this._s(i);
    return{msg:'GAME  P'+(i+1)+'   '+g0+' – '+g1};
  },
  _s(i){
    this.sets[i]++;this.games=[0,0];
    if(this.sets[i]>=2){this.matchOver=true;this.winner=i;return{msg:'P'+(i+1)+' WINS THE MATCH!'};}
    return{msg:'SET  P'+(i+1)+'   '+this.sets[0]+' – '+this.sets[1]};
  },
  str(){
    if(this.deuce)return this.adv<0?'DEUCE':'ADV  P'+(this.adv+1);
    return this.D[this.pts[0]]+' – '+this.D[this.pts[1]];
  },
};

// ── UI helpers ────────────────────────────────────────
const $pts   = document.getElementById('pts');
const $gms   = document.getElementById('gms');
const $srv   = document.getElementById('srv-dot');
const $bigmsg = document.getElementById('bigmsg');

function showHUD(on) {
  document.getElementById('hud').style.display = on ? 'block' : 'none';
  document.getElementById('back-btn').style.display = on ? 'block' : 'none';
  document.getElementById('ctrl-hint').style.display = on ? 'block' : 'none';
}
function updateScoreHUD() {
  $pts.textContent = SC.str();
  $gms.textContent = `Games ${SC.games[0]}–${SC.games[1]}  ·  Sets ${SC.sets[0]}–${SC.sets[1]}`;
  const col = SC.server === 0 ? '#00c8ff' : '#ff6050';
  $srv.style.background = col;
  $srv.style.boxShadow = `0 0 8px ${col}`;
}
let msgTimer = null;
function showMsg(txt, ms = 2000) {
  $bigmsg.textContent = txt;
  $bigmsg.style.display = 'block';
  if (msgTimer) clearTimeout(msgTimer);
  msgTimer = setTimeout(() => { $bigmsg.style.display = 'none'; }, ms);
}

function showServeUI(on) {
  document.getElementById('serve-ui').style.display = on ? 'flex' : 'none';
}
function updateServeMeter(v) {
  document.getElementById('meter-needle').style.left = (v * 100) + '%';
  const zone = v > 0.4 && v < 0.6 ? 'PERFECT!' : v > 0.25 && v < 0.75 ? 'GOOD' : 'WEAK';
  const col = v > 0.4 && v < 0.6 ? '#60ff80' : v > 0.25 && v < 0.75 ? '#ffdc32' : '#ff5050';
  document.getElementById('meter-zone').textContent = zone;
  document.getElementById('meter-zone').style.color = col;
  document.getElementById('meter-needle').style.background = col;
  document.getElementById('meter-needle').style.boxShadow = `0 0 14px ${col}`;
}
function showTossUI(on, tn = 0) {
  const el = document.getElementById('toss-ui');
  el.style.display = on ? 'flex' : 'none';
  if (on) {
    const lbl = document.getElementById('toss-label');
    const col = tn > 0.4 && tn < 0.6 ? '#60ff80' : tn > 0.2 && tn < 0.8 ? '#ffdc32' : '#ff5050';
    lbl.textContent = tn > 0.4 && tn < 0.6 ? '🎾 HIT NOW!' : tn < 0.4 ? 'WAIT…' : 'TOO LATE…';
    lbl.style.color = col;
    lbl.style.textShadow = `0 0 16px ${col}`;
  }
}
function setCtrlHint() {
  const hints = gMode === 'local_1v1'
    ? ['P1: A/D  move  ·  W/S  depth  ·  SPACE  hit', 'P2: ←/→ move  ·  ↑/↓  depth  ·  ENTER  hit', 'Q topspin · E slice · R lob · F smash']
    : ['A / D  —  move   ·   W / S  —  depth', 'CLICK or SPACE  —  hit  /  serve', 'Q topspin  ·  E slice  ·  R lob  ·  F smash'];
  document.getElementById('ctrl-hint').innerHTML = hints.join('<br>');
}

// ── Input ─────────────────────────────────────────────
const KEYS = {};
let mX = innerWidth / 2, mZ = 0.5;
document.addEventListener('keydown', e => {
  KEYS[e.code] = true;
  if (e.code === 'Space')       { e.preventDefault(); onAction(0); }
  if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); onAction(1); }
});
document.addEventListener('keyup', e => delete KEYS[e.code]);
renderer.domElement.addEventListener('mousemove', e => { mX = e.clientX; });
renderer.domElement.addEventListener('click', e => {
  mX = e.clientX;
  if (gPhase === 'match_over') { goLobby(); return; }
  onAction(0);
});

function onAction(who) {
  const srv = SC.server; // 0=near side, 1=far side
  const srvPi = srv === 0 ? 0 : 1;
  if (gPhase === 'serve_meter' && humanPL.includes(srvPi) && who === (srvPi === 0 ? 0 : 1)) lockPower(srvPi);
  else if (gPhase === 'serve_toss' && humanPL.includes(srvPi) && who === (srvPi === 0 ? 0 : 1)) doServeHit(srvPi);
  else if (gPhase === 'rally') doHit(who === 0 ? 0 : 1);
}

// ── Serve phase 1 ─────────────────────────────────────
function lockPower(pi) {
  srvPower = srvMeter;
  TOSS.start(P[pi].x, P[pi].z + (P[pi].side === 'near' ? -0.3 : 0.3));
  gPhase = 'serve_toss'; tossHit = false;
  showServeUI(false);
  showTossUI(true, 0);
}

// ── Serve phase 2 ─────────────────────────────────────
function doServeHit(pi) {
  if (tossHit) return;
  const tn = TOSS.t / TOSS.dur;
  const dev = Math.abs(tn - 0.5);
  const timing = Math.max(0, 1 - dev * 3.0);
  const quality = srvPower * 0.5 + timing * 0.5;

  tossHit = true;
  TOSS.stop();
  P[pi].swingT = 22; P[pi].jumpH = 0.5;
  showTossUI(false);

  // Aim: mouse X maps to court width
  const txR = (mX / innerWidth) * 2 - 1;
  const tx = txR * 3.5;
  const tz = P[pi].side === 'near' ? -SVC_Z * 0.65 : SVC_Z * 0.65;

  B.launch(pi, tx, tz, 5 + quality * 6, 1.5);
  gPhase = 'rally';
  P[pi].serving = false;
}

// ── Rally hit ─────────────────────────────────────────
function doHit(who) {
  if (gPhase !== 'rally') return;
  const pi = who === 0 ? 0 : 1;
  if (!humanPL.includes(pi)) return;
  const p = P[pi];
  if (p.hitCD > 0) return;

  const onMySide = p.side === 'near' ? B.pos.z > 0 : B.pos.z < 0;
  if (!onMySide) return;

  const dist = new THREE.Vector3(p.x, 0, p.z).distanceTo(B.pos);
  if (dist > 5) return;

  const q = ringActive ? ringQuality() : 0.42;
  ringActive = false; ring3d.visible = false;

  p.swingT = 18; p.hitCD = 22;

  const txR = (mX / innerWidth) * 2 - 1;
  const tx = Math.max(-CHW + 0.5, Math.min(CHW - 0.5, txR * 3.8));
  const tz = p.side === 'near' ? -(3 + Math.random() * 5) : (3 + Math.random() * 5);

  let arcH = 1.6, spd = 5.5;
  if (KEYS.KeyQ) { arcH = 2.2; spd = 4.5; }
  else if (KEYS.KeyE) { arcH = 1.0; spd = 4.5; }
  else if (KEYS.KeyR) { arcH = 5.0; spd = 3.5; }
  else if (KEYS.KeyF) { arcH = 0.7; spd = 8.0; }
  spd *= 0.7 + q * 0.58;

  B.launch(pi, tx, tz, spd, arcH);
  if (peerConn && isHost) peerConn.send({ type: 'hit', pi, tx, tz, spd, arcH });
}

// ── AI ────────────────────────────────────────────────
function updateAI(dt) {
  const D = DIFF_CUR;
  aiPL.forEach(pi => {
    const p = P[pi];
    const srv = SC.server === 0 ? 0 : 1;

    if (gPhase === 'serve_meter' && pi === srv) {
      aiCDs[pi] -= dt * 60;
      if (aiCDs[pi] <= 0) {
        // Hard AI gets stronger serves; easy AI gets weaker ones
        srvPower = (D.power < 1 ? 0.40 : D.power > 1.1 ? 0.85 : 0.65) + Math.random() * 0.18;
        TOSS.start(p.x, p.z + (p.side === 'near' ? -0.3 : 0.3));
        gPhase = 'serve_toss'; tossHit = false; showServeUI(false);
        aiCDs[pi] = D.srvBaseCD;
      }
      return;
    }
    if (gPhase === 'serve_toss' && pi === srv) {
      if (TOSS.t > TOSS.dur * 0.46 && !tossHit) {
        tossHit = true; TOSS.stop(); P[pi].swingT = 18; P[pi].jumpH = 0.4;
        const tx = (Math.random() - 0.5) * 5;
        const tz = p.side === 'near' ? -SVC_Z * 0.7 : SVC_Z * 0.7;
        const srvSpd = (4 + Math.random() * 2) * D.power;
        B.launch(pi, tx, tz, srvSpd, 1.4);
        gPhase = 'rally'; P[pi].serving = false;
        showTossUI(false);
      }
      return;
    }
    if (gPhase !== 'rally' || !B.active) return;

    const onMySide = p.side === 'near' ? B.pos.z > 0 : B.pos.z < 0;

    // Move toward ball x — speed scaled by difficulty
    const dx = B.pos.x - p.x;
    const baseSpd = Math.abs(dx) > 1.5 ? p.sprintSpd : p.speed;
    const spd2 = baseSpd * D.spdMult;
    if (Math.abs(dx) > 0.08) p.x += Math.sign(dx) * Math.min(Math.abs(dx), spd2 * dt);
    p.x = Math.max(-CHW + 0.4, Math.min(CHW - 0.4, p.x));

    if (aiCDs[pi] > 0) { aiCDs[pi] -= dt * 60; }
    if (onMySide && aiCDs[pi] <= 0 && B.pos.y < 2.2 && p.hitCD <= 0) {
      const dist = new THREE.Vector3(p.x, 0, p.z).distanceTo(new THREE.Vector3(B.pos.x, 0, B.pos.z));
      if (dist < D.range) {
        // Easy AI sometimes whiffs the ball entirely
        if (Math.random() < D.missChance) {
          aiCDs[pi] = D.reactCD * 0.6; // brief recovery, ball passes
          return;
        }
        p.swingT = 16; p.hitCD = 28;
        // Aim noise: hard AI places shots accurately, easy AI is wild
        const tx = (Math.random() - 0.5) * (3 + D.aimNoise * 2);
        const tz = p.side === 'near' ? -(3 + Math.random() * 5) : (3 + Math.random() * 5);
        const spd  = (4.5 + Math.random() * 2) * D.power;
        const arcH = 1.4 + Math.random() * 0.8;
        B.launch(pi, tx, tz, spd, arcH);
        aiCDs[pi] = D.reactCD;
      }
    }
    if (p.hitCD > 0) p.hitCD -= dt * 60;
    if (p.swingT > 0) p.swingT -= dt * 60;
    p.jumpH = Math.max(0, p.jumpH - dt * 3);
  });
}

// ── Human movement ────────────────────────────────────
function updateHumans(dt) {
  const p0 = P[0];
  const spd = (KEYS.ShiftLeft || KEYS.ShiftRight) ? p0.sprintSpd : p0.speed;
  if (KEYS.KeyA) p0.x -= spd * dt;
  if (KEYS.KeyD) p0.x += spd * dt;
  if (KEYS.KeyW) p0.z -= spd * dt * 0.5;
  if (KEYS.KeyS) p0.z += spd * dt * 0.5;
  p0.x = Math.max(-CHW + 0.4, Math.min(CHW - 0.4, p0.x));
  p0.z = Math.max(0.5, Math.min(CHL - 0.5, p0.z));
  if (p0.hitCD > 0) p0.hitCD -= dt * 60;
  if (p0.swingT > 0) p0.swingT -= dt * 60;
  p0.jumpH = Math.max(0, p0.jumpH - dt * 3);

  if (gMode === 'local_1v1') {
    const p1 = P[1];
    const spd2 = p1.speed;
    if (KEYS.ArrowLeft)  p1.x -= spd2 * dt;
    if (KEYS.ArrowRight) p1.x += spd2 * dt;
    if (KEYS.ArrowUp)    p1.z += spd2 * dt * 0.5;
    if (KEYS.ArrowDown)  p1.z -= spd2 * dt * 0.5;
    p1.x = Math.max(-CHW + 0.4, Math.min(CHW - 0.4, p1.x));
    p1.z = Math.max(-CHL + 0.5, Math.min(-0.5, p1.z));
    if (p1.hitCD > 0) p1.hitCD -= dt * 60;
    if (p1.swingT > 0) p1.swingT -= dt * 60;
    p1.jumpH = Math.max(0, p1.jumpH - dt * 3);
  }

  // Hit ring activation
  if (gPhase === 'rally') {
    const onNear = B.pos.z > 0;
    if (humanPL.includes(0)) {
      const d = new THREE.Vector3(p0.x, 0, p0.z).distanceTo(new THREE.Vector3(B.pos.x, 0, B.pos.z));
      if (onNear && d < 5 && B.pos.y < 2.2) {
        if (!ringActive) { ringActive = true; ringR = 0.7; }
      } else if (d > 6) { ringActive = false; }
    }
    if (gMode === 'local_1v1' && humanPL.includes(1)) {
      const d = new THREE.Vector3(P[1].x, 0, P[1].z).distanceTo(new THREE.Vector3(B.pos.x, 0, B.pos.z));
      if (!onNear && d < 5 && B.pos.y < 2.2) {
        if (!ringActive) { ringActive = true; ringR = 0.7; }
      }
    }
  }
}

// ── Bounce / Net events ───────────────────────────────
function onBounce() {
  if (gPhase !== 'rally') return;
  const onNear = B.pos.z > 0;
  const inX = Math.abs(B.pos.x) <= CHW;
  const inZ = Math.abs(B.pos.z) <= CHL;
  if (!inX || !inZ) { endPoint(B.lastHitter < 2 ? 1 : 0, 'out'); return; }
  if (B.bounces >= 2) endPoint(onNear ? 1 : 0, 'double_bounce');
}
function onNet() {
  if (gPhase !== 'rally' && gPhase !== 'serve_toss') return;
  endPoint(B.lastHitter < 2 ? 1 : 0, 'net');
}

// ── Point end ─────────────────────────────────────────
function endPoint(winner, reason) {
  gPhase = 'point_end'; B.active = false; TOSS.stop(); ringActive = false;
  showServeUI(false); showTossUI(false);
  const msgs = { out: `OUT  ·  P${winner+1} POINT`, net: `NET  ·  P${winner+1} POINT`, double_bounce: `P${winner+1} POINT` };
  showMsg(msgs[reason] || `P${winner+1} POINT`, 1400);
  const result = SC.award(winner);
  updateScoreHUD();
  ptTimer = 2400;
  if (result?.msg) setTimeout(() => showMsg(result.msg, 2000), 1000);
  if (SC.matchOver) setTimeout(() => { gPhase = 'match_over'; }, 2700);
}

function startPoint() {
  const srv = SC.server;
  P[0].x = 0; P[0].z = 9; P[1].x = 0; P[1].z = -9;
  B.reset(srv === 0 ? 0 : 1);
  ringActive = false; ring3d.visible = false;
  TOSS.stop(); srvMeter = 0; srvDir = 1; srvPower = 0; tossHit = false;
  gPhase = 'serve_meter';
  const srvPi = srv === 0 ? 0 : 1;
  P[srvPi].serving = true;
  P[1 - srvPi].serving = false;
  aiCDs[srvPi] = 65;
  showMsg(`P${srv+1} TO SERVE  ·  SET POWER!`, 1600);
  if (humanPL.includes(srvPi)) showServeUI(true);
  updateScoreHUD();
}

// ── Camera ────────────────────────────────────────────
const camPos = new THREE.Vector3(0, 3.5, 16);
const camLook = new THREE.Vector3(0, 1.5, 0);
const tmpLook = new THREE.Vector3();

function updateCamera() {
  const p0 = P[0];
  // Position behind P1, slightly above
  camPos.set(p0.x * 0.6, 3.2, p0.z + 5.2);
  camera.position.lerp(camPos, 0.06);

  // Look toward ball or center net
  tmpLook.set(
    B.active ? B.pos.x * 0.5 : 0,
    B.active ? Math.max(1.5, B.pos.y * 0.6) : 1.6,
    B.active ? B.pos.z * 0.4 : 0
  );
  camLook.lerp(tmpLook, 0.05);
  camera.lookAt(camLook);
}

// ── Countdown ─────────────────────────────────────────
function updateCountdown(dt) {
  cdTimer += dt;
  if (cdTimer >= 1) { cdTimer = 0; cdVal--; if (cdVal <= 0) startPoint(); else showMsg(String(cdVal), 0.9); }
}

// ── Mode setup ────────────────────────────────────────
function setupMode(mode) {
  gMode = mode;
  activePL = mode === 'ai_2v2' ? [0,1,2,3] : [0,1];
  humanPL  = mode === 'ai_1v1' ? [0] : mode === 'local_1v1' ? [0,1] : mode === 'ai_2v2' ? [0] : [0];
  aiPL     = activePL.filter(i => !humanPL.includes(i));
  // Show/hide characters
  chars.forEach((c, i) => c.group.visible = activePL.includes(i));
  setCtrlHint();
}

// ── Public API (called from HTML) ─────────────────────
function startMode(mode, conn, host, diff) {
  peerConn = conn || null;
  isHost = host || false;
  difficulty = diff && DIFF[diff] ? diff : 'medium';
  DIFF_CUR = DIFF[difficulty];
  setupMode(mode);
  SC.reset();
  document.getElementById('lobby').style.display = 'none';
  document.getElementById('diff-panel').style.display = 'none';
  showHUD(true);
  gPhase = 'countdown'; cdVal = 3; cdTimer = 0;
  showMsg('3', 0.9);
}

function goLobby() {
  gPhase = 'lobby';
  B.active = false; TOSS.stop();
  showHUD(false); showServeUI(false); showTossUI(false);
  $bigmsg.style.display = 'none';
  const dp = document.getElementById('diff-panel'); if (dp) dp.style.display = 'none';
  document.getElementById('lobby').style.display = 'flex';
}

function onPeerData(d) {
  if (d.type === 'state') { Object.assign(B.pos, d.ball.pos); Object.assign(B.vel, d.ball.vel); B.active = d.ball.active; }
  if (d.type === 'hit' && !isHost) B.launch(d.pi, d.tx, d.tz, d.spd, d.arcH);
}

window.game = { startMode, goLobby, onPeerData };
if (window._pendingMode) {
  startMode(window._pendingMode, undefined, undefined, window._pendingDiff);
  window._pendingMode = null; window._pendingDiff = null;
}

// ── Main loop ─────────────────────────────────────────
const clock = new THREE.Clock();
let frameN = 0;

function animate() {
  requestAnimationFrame(animate);
  if (gPhase === 'lobby') { renderer.render(scene, camera); return; }

  const dt = Math.min(clock.getDelta(), 0.05);
  frameN++;

  if (gPhase === 'countdown') updateCountdown(dt);

  if (gPhase === 'serve_meter') {
    srvMeter += srvDir * 0.008 * (dt * 60);
    if (srvMeter >= 1) { srvMeter = 1; srvDir = -1; }
    if (srvMeter <= 0) { srvMeter = 0; srvDir = 1; }
    updateServeMeter(srvMeter);
    updateAI(dt);
  }

  if (gPhase === 'serve_toss') {
    TOSS.update();
    const tn = TOSS.t / TOSS.dur;
    showTossUI(true, tn);
    updateAI(dt);
    P[0].jumpH = Math.max(0, P[0].jumpH - dt * 3);
    P[1].jumpH = Math.max(0, P[1].jumpH - dt * 3);
  }

  if (gPhase === 'rally') {
    updateHumans(dt);
    updateAI(dt);
    B.update(dt);
    updateRing3d();
    if (peerConn && isHost && frameN % 3 === 0)
      peerConn.send({ type: 'state', ball: { pos: B.pos, vel: B.vel, active: B.active } });
  }

  if (gPhase === 'point_end') {
    ptTimer -= dt * 1000;
    if (ptTimer <= 0) { if (SC.matchOver) gPhase = 'match_over'; else startPoint(); }
  }

  // Sync characters to state
  activePL.forEach(syncChar);
  updateCamera();

  // Match over overlay
  if (gPhase === 'match_over') {
    showMsg(`P${SC.winner+1} WINS THE MATCH!\n\nClick to return`, 99999);
  }

  renderer.render(scene, camera);
}

// ── Init ──────────────────────────────────────────────
buildCourt();
chars.forEach((c, i) => { c.group.visible = i < 2; });
ballMesh.visible = true;
camera.position.set(0, 3.5, 16);
camera.lookAt(0, 1.5, 0);
animate();
