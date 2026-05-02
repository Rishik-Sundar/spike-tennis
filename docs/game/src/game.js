// Spike Tennis — 3D Roblox-style with self-hosted Three.js
(function(){
'use strict';

if (typeof THREE === 'undefined'){
  document.body.innerHTML = '<div style="color:#ff5050;padding:40px;text-align:center;font-family:sans-serif">Three.js failed to load. Refresh the page.</div>';
  return;
}

// ── Renderer ──────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
renderer.outputEncoding = THREE.sRGBEncoding;
const cv = renderer.domElement;
cv.id = 'cv';
cv.style.cssText = 'position:fixed;inset:0;z-index:1;display:block';
document.body.appendChild(cv);
// Remove the placeholder canvas if it exists
const ph = document.querySelector('canvas:not(#cv)');
if (ph) ph.remove();

// ── Scene ─────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070b18);
scene.fog = new THREE.FogExp2(0x070b18, 0.018);

const camera = new THREE.PerspectiveCamera(68, innerWidth/innerHeight, 0.1, 200);

window.addEventListener('resize', ()=>{
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ── Lighting ──────────────────────────────────────────
scene.add(new THREE.AmbientLight(0x445566, 0.7));
const sun = new THREE.DirectionalLight(0xffeedd, 1.2);
sun.position.set(8, 22, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 80;
sun.shadow.camera.left=-20; sun.shadow.camera.right=20;
sun.shadow.camera.top=22;   sun.shadow.camera.bottom=-22;
scene.add(sun);
const fillLight = new THREE.DirectionalLight(0x334466, 0.4);
fillLight.position.set(-6, 8, -12);
scene.add(fillLight);
const ballLight = new THREE.PointLight(0xb2ff14, 2.5, 7);
scene.add(ballLight);

// ── Court constants ──────────────────────────────────
const CW=10, CL=22, CHW=5, CHL=11;
const NET_H=0.92, SVC_Z=5.5;

// Module-scoped refs for theme switching (set in buildCourt)
let _surfaceMesh = null, _surroundMesh = null;
const _neonMeshes = [];

// ── Court builder ────────────────────────────────────
function buildCourt(){
  // Surround (green grass)
  const surround = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({ color: 0x1e4228, roughness: 0.95 })
  );
  surround.rotation.x = -Math.PI/2;
  surround.position.y = -0.02;
  surround.receiveShadow = true;
  scene.add(surround);
  _surroundMesh = surround;

  // Court surface (blue hard court)
  const surf = new THREE.Mesh(
    new THREE.PlaneGeometry(CW, CL),
    new THREE.MeshStandardMaterial({ color: 0x0a5ab4, roughness: 0.7, metalness: 0.05 })
  );
  surf.rotation.x = -Math.PI/2;
  surf.receiveShadow = true;
  scene.add(surf);
  _surfaceMesh = surf;

  // Service boxes (subtle darker overlay)
  const svcMat = new THREE.MeshStandardMaterial({ color: 0x094ea0, roughness:0.7, transparent:true, opacity:0.5 });
  function svcBox(x, z, w, l){
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), svcMat);
    m.rotation.x = -Math.PI/2;
    m.position.set(x, 0.001, z);
    scene.add(m);
  }
  svcBox(-CHW/2, SVC_Z/2, CHW, SVC_Z);
  svcBox( CHW/2, SVC_Z/2, CHW, SVC_Z);
  svcBox(-CHW/2,-SVC_Z/2, CHW, SVC_Z);
  svcBox( CHW/2,-SVC_Z/2, CHW, SVC_Z);

  // Lines (thin white emissive boxes)
  const lineMat = new THREE.MeshStandardMaterial({ color:0xffffff, emissive:0xffffff, emissiveIntensity:0.45 });
  function line(x1,z1,x2,z2,w){
    w = w || 0.06;
    const len = Math.hypot(x2-x1, z2-z1);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, len), lineMat);
    m.position.set((x1+x2)/2, 0.015, (z1+z2)/2);
    m.rotation.y = Math.atan2(x2-x1, z2-z1);
    scene.add(m);
  }
  line(-CHW, CHL, CHW, CHL); line(-CHW,-CHL, CHW,-CHL);
  line(-CHW, CHL,-CHW,-CHL); line( CHW, CHL, CHW,-CHL);
  line(-CHW, SVC_Z, CHW, SVC_Z); line(-CHW,-SVC_Z, CHW,-SVC_Z);
  line(0, SVC_Z, 0,-SVC_Z);
  line(-0.22, CHL, 0.22, CHL); line(-0.22,-CHL, 0.22,-CHL);

  // Neon edge strips (glowing blue)
  const neonMat = new THREE.MeshStandardMaterial({ color:0x00b4ff, emissive:0x00b4ff, emissiveIntensity:2.4 });
  function neon(x1,z1,x2,z2){
    const len = Math.hypot(x2-x1, z2-z1);
    // Each neon strip needs its OWN material instance for theme switching
    const indMat = new THREE.MeshStandardMaterial({ color:0x00b4ff, emissive:0x00b4ff, emissiveIntensity:2.4 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.07, len), indMat);
    m.position.set((x1+x2)/2, 0.035, (z1+z2)/2);
    m.rotation.y = Math.atan2(x2-x1, z2-z1);
    scene.add(m);
    _neonMeshes.push(m);
  }
  neon(-CHW, CHL, CHW, CHL); neon(-CHW,-CHL, CHW,-CHL);
  neon(-CHW, CHL,-CHW,-CHL); neon( CHW, CHL, CHW,-CHL);

  // Net mesh
  const net = new THREE.Mesh(
    new THREE.PlaneGeometry(CW+1, NET_H),
    new THREE.MeshStandardMaterial({ color: 0x223355, transparent:true, opacity:0.55, side:THREE.DoubleSide })
  );
  net.position.set(0, NET_H/2, 0);
  scene.add(net);
  // Net tape
  const tape = new THREE.Mesh(
    new THREE.BoxGeometry(CW+1, 0.05, 0.08),
    new THREE.MeshStandardMaterial({ color:0xffffff, emissive:0xffffff, emissiveIntensity:0.5 })
  );
  tape.position.set(0, NET_H+0.025, 0);
  scene.add(tape);
  // Posts
  const postMat = new THREE.MeshStandardMaterial({ color:0x888899, metalness:0.6 });
  for (const x of [-CHW-0.5, CHW+0.5]){
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, NET_H+0.15, 12), postMat);
    p.position.set(x, (NET_H+0.15)/2, 0);
    p.castShadow = true; scene.add(p);
  }

  // Stadium walls
  const wallMat = new THREE.MeshStandardMaterial({ color:0x0d1a2a, roughness:1 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(80, 24), wallMat);
  back.position.set(0, 10, -28); scene.add(back);
  const front = back.clone(); front.position.z = 28; front.rotation.y = Math.PI; scene.add(front);
  const sideL = new THREE.Mesh(new THREE.PlaneGeometry(60, 24), wallMat);
  sideL.position.set(-22, 10, 0); sideL.rotation.y = Math.PI/2; scene.add(sideL);
  const sideR = sideL.clone(); sideR.position.x = 22; sideR.rotation.y = -Math.PI/2; scene.add(sideR);
}
buildCourt();

// ── Roblox-style character ────────────────────────────
function buildChar(opts){
  const g = new THREE.Group();
  const col = new THREE.Color(opts.col);
  const skin = opts.skin || '#f0c090';
  const hairCol = opts.hairCol || '#2a1810';
  const shirtMat = new THREE.MeshStandardMaterial({ color: opts.col, roughness:0.5, metalness:0.05, emissive: col.clone().multiplyScalar(0.18) });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x0a1428, roughness:0.85 });
  const skinMat  = new THREE.MeshStandardMaterial({ color: skin, roughness:0.85 });
  const shoeMat  = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness:0.8 });
  const hairMat  = new THREE.MeshStandardMaterial({ color: hairCol, roughness:0.7 });

  // Torso (Roblox proportions)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.4, 0.55), shirtMat);
  torso.position.y = 1.5; torso.castShadow = true; g.add(torso);

  // Head (block)
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.78, 0.78), skinMat);
  head.position.y = 2.6; head.castShadow = true; g.add(head);

  // Hair (depends on style)
  if (opts.hair === 'short'){
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.18, 0.82), hairMat);
    h.position.set(0, 2.95, 0); g.add(h);
  } else if (opts.hair === 'cap'){
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.32, 0.82), shirtMat);
    h.position.set(0, 3.02, 0); g.add(h);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.06, 0.4), shirtMat);
    brim.position.set(0, 2.92, 0.45); g.add(brim);
  } else if (opts.hair === 'spike'){
    for (let i=0; i<5; i++){
      const sx = (i-2)*0.16;
      const s = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.30, 4), hairMat);
      s.position.set(sx, 3.06, 0);
      g.add(s);
    }
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.12, 0.82), hairMat);
    base.position.set(0, 2.92, 0); g.add(base);
  } else if (opts.hair === 'long'){
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.22, 0.84), hairMat);
    top.position.set(0, 2.97, 0); g.add(top);
    const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.84), hairMat);
    sideL.position.set(-0.41, 2.6, 0); g.add(sideL);
    const sideR = sideL.clone(); sideR.position.x = 0.41; g.add(sideR);
  }

  // Face (eyes + mouth as small black blocks on +Z face of head)
  const faceMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.10, 0.02), faceMat);
  eyeL.position.set(-0.16, 2.66, 0.4); g.add(eyeL);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.16; g.add(eyeR);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.04, 0.02), faceMat);
  mouth.position.set(0, 2.46, 0.4); g.add(mouth);

  // Arms — pivoting groups so we can swing
  const armL = new THREE.Group();
  armL.position.set(-0.7, 2.05, 0);
  const armLMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.4, 0.4), shirtMat);
  armLMesh.position.y = -0.7; armLMesh.castShadow = true; armL.add(armLMesh);
  g.add(armL);

  const armR = new THREE.Group();
  armR.position.set(0.7, 2.05, 0);
  const armRMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.4, 0.4), shirtMat);
  armRMesh.position.y = -0.7; armRMesh.castShadow = true; armR.add(armRMesh);
  g.add(armR);

  // Racket on right arm
  const racket = new THREE.Group();
  racket.position.set(0, -1.5, 0);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 8), new THREE.MeshStandardMaterial({color:0x222222, roughness:0.7}));
  handle.position.y = -0.2; racket.add(handle);
  const frame = new THREE.Mesh(
    new THREE.TorusGeometry(0.32, 0.05, 8, 24),
    new THREE.MeshStandardMaterial({ color: opts.col, emissive: col.clone().multiplyScalar(0.7), emissiveIntensity:0.9 })
  );
  frame.rotation.x = Math.PI/2;
  frame.position.y = -0.55; racket.add(frame);
  // Strings
  const strMat = new THREE.MeshStandardMaterial({ color:0xaaccff, emissive:0x4477ff, emissiveIntensity:0.6, transparent:true, opacity:0.7 });
  for (let i=-2; i<=2; i++){
    const sx = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.018, 0.018), strMat);
    sx.position.set(0, -0.55, i*0.10); sx.rotation.x = Math.PI/2; racket.add(sx);
    const sy = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.58, 0.018), strMat);
    sy.position.set(i*0.10, -0.55, 0); sy.rotation.x = Math.PI/2; racket.add(sy);
  }
  armR.add(racket);

  // Legs — pivoting groups
  const legL = new THREE.Group();
  legL.position.set(-0.25, 0.8, 0);
  const legLMesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.4, 0.45), pantsMat);
  legLMesh.position.y = -0.7; legLMesh.castShadow = true; legL.add(legLMesh);
  const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.18, 0.62), shoeMat);
  shoeL.position.set(0, -1.5, 0.08); legL.add(shoeL);
  g.add(legL);

  const legR = legL.clone(); legR.position.x = 0.25; g.add(legR);

  return { group: g, armL, armR, legL, legR, racket };
}

// ── Game state ────────────────────────────────────────
let gMode = 'ai_1v1';
let gPhase = 'lobby';
let cdVal=3, cdTimer=0, ptTimer=0;
let activePL=[0,1], humanPL=[0], aiPL=[1];
let srvMeter=0, srvDir=1, srvPower=0, tossHit=false;
let aiCDs=[0,0,0,0];
const KEYS = {};
let mX = innerWidth/2;

// ── Difficulty ────────────────────────────────────────
const DIFF = {
  easy:   { spdMult:0.55, range:4.0, reactCD:38, missChance:0.22, aimNoise:2.4, power:0.72, srvBaseCD:90 },
  medium: { spdMult:1.00, range:5.5, reactCD:22, missChance:0.06, aimNoise:1.2, power:1.00, srvBaseCD:65 },
  hard:   { spdMult:1.40, range:6.5, reactCD: 8, missChance:0.00, aimNoise:0.5, power:1.30, srvBaseCD:38 },
};
let DIFF_CUR = DIFF.medium;

// ── Online ────────────────────────────────────────────
let peerConn=null, isHost=false;

// ── Character presets ─────────────────────────────────
const CHARS = [
  { name:'BLAZE',   col:'#ff5050', hair:'spike',  hairCol:'#220a05', skin:'#d4956a', tag:'AGGRESSIVE' },
  { name:'AZURE',   col:'#00b4ff', hair:'short',  hairCol:'#1a1428', skin:'#f0c090', tag:'BALANCED'   },
  { name:'NEON',    col:'#b2ff14', hair:'cap',    hairCol:'#003040', skin:'#a07050', tag:'POWERFUL'   },
  { name:'STORM',   col:'#a050ff', hair:'long',   hairCol:'#1a0828', skin:'#d4956a', tag:'TRICKY'     },
  { name:'FROST',   col:'#80fff0', hair:'short',  hairCol:'#102030', skin:'#f8d8b0', tag:'PRECISE'    },
  { name:'EMBER',   col:'#ff9632', hair:'spike',  hairCol:'#3a1a05', skin:'#b08060', tag:'EXPLOSIVE'  },
  { name:'VOLT',    col:'#ffe800', hair:'spike',  hairCol:'#0a0a14', skin:'#d4956a', tag:'SPEEDY'     },
  { name:'JADE',    col:'#22dd66', hair:'long',   hairCol:'#1a1010', skin:'#a07050', tag:'STAMINA'    },
  { name:'ROGUE',   col:'#ff2080', hair:'cap',    hairCol:'#0a0814', skin:'#f0c090', tag:'CHAOTIC'    },
  { name:'OBSIDIAN',col:'#5a30c0', hair:'short',  hairCol:'#000000', skin:'#a07050', tag:'CONTROLLED' },
  { name:'CORAL',   col:'#ff8090', hair:'long',   hairCol:'#3a1a14', skin:'#f8d8b0', tag:'AGILE'      },
  { name:'TITAN',   col:'#666688', hair:'cap',    hairCol:'#101018', skin:'#b08060', tag:'DEFENSIVE'  },
];
let pCharIdx = [1, 0, 2, 5]; // default characters per player slot

// ── Players ───────────────────────────────────────────
const P = [
  { x: 0,  z: 9,  side:'near', speed:5, sprintSpd:7, swingT:0, hitCD:0, jumpH:0, jumpVel:0, walkT:0, serving:false },
  { x: 0,  z:-9,  side:'far',  speed:5, sprintSpd:7, swingT:0, hitCD:0, jumpH:0, jumpVel:0, walkT:0, serving:false },
  { x: 2,  z: 9,  side:'near', speed:5, sprintSpd:7, swingT:0, hitCD:0, jumpH:0, jumpVel:0, walkT:0, serving:false },
  { x:-2,  z:-9,  side:'far',  speed:5, sprintSpd:7, swingT:0, hitCD:0, jumpH:0, jumpVel:0, walkT:0, serving:false },
];

// Build character meshes
const chars = P.map((_, i) => buildChar(CHARS[pCharIdx[i] % CHARS.length]));
chars.forEach(c => scene.add(c.group));

function rebuildChar(pi){
  scene.remove(chars[pi].group);
  chars[pi] = buildChar(CHARS[pCharIdx[pi] % CHARS.length]);
  scene.add(chars[pi].group);
  if (typeof Nametags !== 'undefined' && Nametags.rebuild) Nametags.rebuild(pi);
}

// ── Ball ──────────────────────────────────────────────
const ballGeo = new THREE.SphereGeometry(0.18, 18, 18);
const ballMat = new THREE.MeshStandardMaterial({ color:0xb2ff14, emissive:0x6a9900, emissiveIntensity:0.95, roughness:0.25 });
const ballMesh = new THREE.Mesh(ballGeo, ballMat);
ballMesh.castShadow = true;
scene.add(ballMesh);
const tossMesh = ballMesh.clone();
tossMesh.visible = false;
scene.add(tossMesh);

// Trail
const TRAIL_LEN = 14;
const trailMeshes = [];
for (let i=0; i<TRAIL_LEN; i++){
  const r = 0.18 * (1 - i/TRAIL_LEN) * 0.85;
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(Math.max(0.02, r), 8, 8),
    new THREE.MeshStandardMaterial({ color:0xb2ff14, emissive:0x446600, emissiveIntensity:0.5*(1-i/TRAIL_LEN), transparent:true, opacity:0.65*(1-i/TRAIL_LEN) })
  );
  m.visible = false;
  trailMeshes.push(m);
  scene.add(m);
}

const B = {
  pos: new THREE.Vector3(0, 0.18, 9),
  vel: new THREE.Vector3(),
  active:false, lastHitter:0, bounces:0, trail:[],
  GRAV:16, BOUNCE:0.58,
  reset(side){
    this.pos.set(0, 0.18, side===0?9:-9);
    this.vel.set(0,0,0);
    this.active=false; this.bounces=0; this.trail=[];
    ballMesh.position.copy(this.pos);
    trailMeshes.forEach(m => m.visible=false);
  },
  launch(fromPi, tx, tz, speed, arcH, fromY){
    const cg = chars[fromPi].group;
    const y0 = fromY != null ? fromY : 1.2;
    this.pos.set(cg.position.x, y0, cg.position.z + (fromPi<2?-0.4:0.4));
    this.bounces=0; this.lastHitter=fromPi; this.active=true; this.trail=[];
    const dx = tx-this.pos.x, dz = tz-this.pos.z;
    const dist = Math.sqrt(dx*dx + dz*dz) || 1;
    const t = dist/speed;
    this.vel.set(dx/t, this.GRAV*t*0.5 + (arcH-this.pos.y)/t, dz/t);
  },
  update(dt){
    if (!this.active) return;
    this.trail.unshift(this.pos.clone());
    if (this.trail.length > TRAIL_LEN) this.trail.pop();
    this.vel.y -= this.GRAV*dt;
    this.pos.addScaledVector(this.vel, dt);
    if (this.pos.y <= 0.18){
      this.pos.y = 0.18;
      if (Math.abs(this.vel.y) > 0.4){
        this.vel.y = Math.abs(this.vel.y)*this.BOUNCE;
        this.vel.x *= 0.84; this.vel.z *= 0.84;
        this.bounces++;
        onBounce();
      } else this.vel.y = 0;
    }
    if (this.pos.y < NET_H+0.1){
      const prevZ = this.pos.z - this.vel.z*dt;
      if ((prevZ > 0.15 && this.pos.z <= 0.15) || (prevZ < -0.15 && this.pos.z >= -0.15)){
        if (Math.abs(this.pos.x) < CHW) onNet();
      }
    }
    ballMesh.position.copy(this.pos);
    ballLight.position.copy(this.pos);
    this.trail.forEach((p, i) => { trailMeshes[i].visible=true; trailMeshes[i].position.copy(p); });
    for (let i=this.trail.length; i<TRAIL_LEN; i++) trailMeshes[i].visible=false;
  }
};

// ── Toss ─────────────────────────────────────────────
const TOSS = {
  x:0, z:0, y:0, t:0, dur:95, peak:3.4, active:false,
  start(x,z){ this.x=x; this.z=z; this.y=0; this.t=0; this.active=true; tossMesh.visible=true; },
  update(){
    if (!this.active) return;
    this.t++;
    const tn = this.t/this.dur;
    this.y = this.peak*4*tn*(1-tn);
    tossMesh.position.set(this.x, this.y+0.18, this.z);
    if (this.t>=this.dur){ this.active=false; tossMesh.visible=false; }
  },
  stop(){ this.active=false; tossMesh.visible=false; }
};

// ── Hit ring ─────────────────────────────────────────
const ringGeo = new THREE.RingGeometry(0.45, 0.55, 32);
const ringMat = new THREE.MeshBasicMaterial({ color:0xffdd33, side:THREE.DoubleSide, transparent:true, opacity:0.92 });
const ring3d = new THREE.Mesh(ringGeo, ringMat);
ring3d.visible = false;
scene.add(ring3d);
let ringR=0.7, ringActive=false;
function ringQuality(){ return ringR<0.22 ? 1 : ringR<0.38 ? 0.62 : 0.35; }
function updateRing3d(){
  if (!ringActive){ ring3d.visible=false; return; }
  ringR = Math.max(0.08, ringR - 0.012);
  if (ringR <= 0.09){ ringActive=false; ring3d.visible=false; return; }
  ring3d.visible = true;
  ring3d.position.copy(B.pos); ring3d.position.y += 0.06;
  ring3d.lookAt(camera.position);
  const q = ringR<0.22?1:ringR<0.38?0.6:0.3;
  ringMat.color.setHex(q>0.85?0x60ff80:q>0.5?0xffdd33:0xff5050);
  ring3d.scale.setScalar(ringR/0.7 * 1.4);
}

// ── Audio system (Web Audio API — fully synthesized, no asset loading) ──
const AudioSys = (function(){
  let ac = null;
  let masterGain = null;
  let crowdGain = null;
  let muted = false;
  let initialized = false;
  let crowdNoiseSrc = null;

  function init(){
    if (initialized) return;
    initialized = true;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      ac = new Ctx();
      masterGain = ac.createGain();
      masterGain.gain.value = 0.6;
      masterGain.connect(ac.destination);
      crowdGain = ac.createGain();
      crowdGain.gain.value = 0.0;
      crowdGain.connect(masterGain);
      startCrowdNoise();
    } catch(e){
      ac = null;
    }
  }

  function ensureRunning(){
    if (!ac) init();
    if (ac && ac.state === 'suspended'){
      try { ac.resume(); } catch(_){}
    }
  }

  // White noise filtered to sound like crowd murmur
  function startCrowdNoise(){
    if (!ac) return;
    const bufSize = 2 * ac.sampleRate;
    const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i=0; i<bufSize; i++) data[i] = (Math.random()*2 - 1) * 0.5;
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    src.connect(filter);
    filter.connect(crowdGain);
    src.start();
    crowdNoiseSrc = src;
  }

  function setCrowdVolume(v){
    if (!crowdGain) return;
    crowdGain.gain.cancelScheduledValues(ac.currentTime);
    crowdGain.gain.linearRampToValueAtTime(v, ac.currentTime + 0.4);
  }

  function setMuted(m){
    muted = !!m;
    if (masterGain) masterGain.gain.value = muted ? 0 : 0.6;
  }

  // Generic synthesized "hit" pop with band-passed noise burst
  function hitSound(power){
    if (!ac || muted) return;
    ensureRunning();
    power = power || 0.7;
    const t = ac.currentTime;
    // Noise burst
    const bufSize = Math.floor(ac.sampleRate * 0.10);
    const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i=0; i<bufSize; i++){
      data[i] = (Math.random()*2 - 1) * Math.pow(1 - i/bufSize, 2);
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    const flt = ac.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.value = 800 + power*1400;
    flt.Q.value = 5;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.0, t);
    gain.gain.linearRampToValueAtTime(0.5 * power, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.10);
    src.connect(flt); flt.connect(gain); gain.connect(masterGain);
    src.start(t); src.stop(t + 0.12);

    // Pitched body — short FM-ish tone
    const osc = ac.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(280 + power*180, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.07);
    const og = ac.createGain();
    og.gain.setValueAtTime(0.0, t);
    og.gain.linearRampToValueAtTime(0.20 * power, t + 0.005);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.10);
    osc.connect(og); og.connect(masterGain);
    osc.start(t); osc.stop(t + 0.11);
  }

  // Dull thud for ball hitting court
  function bounceSound(intensity){
    if (!ac || muted) return;
    ensureRunning();
    intensity = Math.max(0.2, Math.min(1, intensity || 0.6));
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.10);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.18 * intensity, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(g); g.connect(masterGain);
    osc.start(t); osc.stop(t + 0.13);
  }

  // Big SMASH sound — louder noise burst + low end
  function smashSound(){
    if (!ac || muted) return;
    ensureRunning();
    hitSound(1.4);
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.18);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.30, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.20);
    osc.connect(g); g.connect(masterGain);
    osc.start(t); osc.stop(t + 0.22);
  }

  // Net touch
  function netSound(){
    if (!ac || muted) return;
    ensureRunning();
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(420, t);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.10);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.15, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(g); g.connect(masterGain);
    osc.start(t); osc.stop(t + 0.13);
  }

  // Crowd cheer / applause (filtered noise envelope)
  function cheerSound(big){
    if (!ac || muted) return;
    ensureRunning();
    const t = ac.currentTime;
    const dur = big ? 1.6 : 0.9;
    const bufSize = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i=0; i<bufSize; i++){
      const env = i < bufSize*0.15 ? (i/(bufSize*0.15)) : Math.max(0, 1 - (i - bufSize*0.15)/(bufSize*0.85));
      data[i] = (Math.random()*2 - 1) * env;
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    const flt = ac.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.value = 1500;
    flt.Q.value = 1.2;
    const g = ac.createGain();
    g.gain.value = big ? 0.55 : 0.30;
    src.connect(flt); flt.connect(g); g.connect(masterGain);
    src.start(t);
  }

  // Score blip
  function scoreSound(){
    if (!ac || muted) return;
    ensureRunning();
    const t = ac.currentTime;
    [880, 1100, 1320].forEach((f, i) => {
      const osc = ac.createOscillator();
      osc.type = 'square';
      osc.frequency.value = f;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0, t + i*0.07);
      g.gain.linearRampToValueAtTime(0.10, t + i*0.07 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + i*0.07 + 0.10);
      osc.connect(g); g.connect(masterGain);
      osc.start(t + i*0.07); osc.stop(t + i*0.07 + 0.12);
    });
  }

  // Match win fanfare
  function fanfareSound(){
    if (!ac || muted) return;
    ensureRunning();
    const t = ac.currentTime;
    const notes = [523, 659, 784, 1047, 784, 1047];
    notes.forEach((f, i) => {
      const osc = ac.createOscillator();
      osc.type = 'square';
      osc.frequency.value = f;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0, t + i*0.18);
      g.gain.linearRampToValueAtTime(0.16, t + i*0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + i*0.18 + 0.20);
      osc.connect(g); g.connect(masterGain);
      osc.start(t + i*0.18); osc.stop(t + i*0.18 + 0.22);
    });
  }

  // Whoosh (jump / smash setup)
  function whooshSound(){
    if (!ac || muted) return;
    ensureRunning();
    const t = ac.currentTime;
    const bufSize = Math.floor(ac.sampleRate * 0.30);
    const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i=0; i<bufSize; i++){
      data[i] = (Math.random()*2 - 1) * (1 - i/bufSize);
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    const flt = ac.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.setValueAtTime(2000, t);
    flt.frequency.exponentialRampToValueAtTime(400, t + 0.30);
    flt.Q.value = 4;
    const g = ac.createGain();
    g.gain.value = 0.18;
    src.connect(flt); flt.connect(g); g.connect(masterGain);
    src.start(t);
  }

  // UI click
  function clickSound(){
    if (!ac || muted) return;
    ensureRunning();
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.exponentialRampToValueAtTime(1400, t + 0.04);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.07, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc.connect(g); g.connect(masterGain);
    osc.start(t); osc.stop(t + 0.06);
  }

  return {
    init: init, ensureRunning: ensureRunning,
    hit: hitSound, bounce: bounceSound, smash: smashSound,
    net: netSound, cheer: cheerSound, score: scoreSound,
    fanfare: fanfareSound, whoosh: whooshSound, click: clickSound,
    setCrowdVolume: setCrowdVolume, setMuted: setMuted,
    isMuted: function(){ return muted; }
  };
})();
// First user click anywhere primes the audio context (browser autoplay rules)
document.addEventListener('click',     function(){ AudioSys.init(); AudioSys.ensureRunning(); }, { once:false });
document.addEventListener('keydown',   function(){ AudioSys.init(); AudioSys.ensureRunning(); }, { once:false });
document.addEventListener('touchstart',function(){ AudioSys.init(); AudioSys.ensureRunning(); }, { once:false });

// ── Particle effects (instanced sphere meshes for impact dust/sparks) ──
const ParticleSys = (function(){
  const POOL = 80;
  const pool = [];
  const sharedGeo = new THREE.SphereGeometry(0.05, 6, 6);
  for (let i=0; i<POOL; i++){
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0
    });
    const m = new THREE.Mesh(sharedGeo, mat);
    m.visible = false;
    scene.add(m);
    pool.push({ mesh: m, vx:0, vy:0, vz:0, life:0, maxLife:1, baseScale:1 });
  }
  let nextIdx = 0;

  function spawn(x, y, z, opts){
    opts = opts || {};
    const count = opts.count || 8;
    const speed = opts.speed || 2.5;
    const color = opts.color != null ? opts.color : 0xddeeff;
    const size  = opts.size  || 1.0;
    const upBias = opts.upBias != null ? opts.upBias : 0.5;
    const lifeMin = opts.lifeMin || 0.35;
    const lifeMax = opts.lifeMax || 0.7;
    for (let i=0; i<count; i++){
      const p = pool[nextIdx];
      nextIdx = (nextIdx + 1) % POOL;
      const ang = Math.random() * Math.PI * 2;
      const vMag = speed * (0.5 + Math.random() * 0.8);
      p.vx = Math.cos(ang) * vMag * (Math.random()*0.7 + 0.3);
      p.vz = Math.sin(ang) * vMag * (Math.random()*0.7 + 0.3);
      p.vy = upBias * vMag + Math.random() * speed * 0.6;
      p.life = lifeMin + Math.random() * (lifeMax - lifeMin);
      p.maxLife = p.life;
      p.baseScale = size * (0.7 + Math.random() * 0.6);
      p.mesh.position.set(x, y, z);
      p.mesh.material.color.setHex(color);
      p.mesh.material.opacity = 0.95;
      p.mesh.scale.setScalar(p.baseScale);
      p.mesh.visible = true;
    }
  }

  function update(dt){
    for (let i=0; i<POOL; i++){
      const p = pool[i];
      if (!p.mesh.visible) continue;
      p.life -= dt;
      if (p.life <= 0){ p.mesh.visible = false; continue; }
      p.vy -= 9 * dt; // gravity
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      // Bounce on ground (subtle)
      if (p.mesh.position.y < 0.04){
        p.mesh.position.y = 0.04;
        p.vy = -p.vy * 0.35;
        p.vx *= 0.6; p.vz *= 0.6;
      }
      const t = p.life / p.maxLife;
      p.mesh.material.opacity = Math.max(0, t * 0.95);
      p.mesh.scale.setScalar(p.baseScale * (0.4 + t * 0.6));
    }
  }

  // Specific named effects
  function dustBurst(x, z){ spawn(x, 0.04, z, { count: 14, speed: 2.0, color: 0xddccaa, upBias: 0.6 }); }
  function sparkBurst(x, y, z){ spawn(x, y, z, { count: 20, speed: 5.0, color: 0xffee44, upBias: 0.0, lifeMin: 0.20, lifeMax: 0.45 }); }
  function smashBurst(x, z){
    spawn(x, 0.05, z, { count: 26, speed: 5.5, color: 0xff8844, upBias: 0.4, lifeMin: 0.4, lifeMax: 0.9 });
    spawn(x, 0.05, z, { count: 14, speed: 7.0, color: 0xffcc66, upBias: 0.7, lifeMin: 0.3, lifeMax: 0.6 });
  }
  function netHit(x){ spawn(x, NET_H*0.5, 0, { count: 12, speed: 2.2, color: 0xaaccff, upBias: 0.0 }); }
  function pickupBurst(x, y, z, color){
    spawn(x, y, z, { count: 18, speed: 4.0, color: color || 0x80ffaa, upBias: 0.5 });
  }

  return {
    spawn: spawn, update: update,
    dustBurst: dustBurst, sparkBurst: sparkBurst,
    smashBurst: smashBurst, netHit: netHit, pickupBurst: pickupBurst
  };
})();

// ── Stadium (procedural crowd in stands + light rigs + banners) ──
function buildStadium(){
  const crowd = new THREE.Group();
  scene.add(crowd);

  // Procedural crowd: rows of small boxes in the stands
  const colors = [0xff5050, 0x00b4ff, 0xb2ff14, 0xa050ff, 0xffdc32, 0x80fff0, 0xff9632, 0xff2080];
  function row(zStart, zEnd, xStart, xEnd, ySeat, count){
    for (let i=0; i<count; i++){
      const t = i / (count - 1 || 1);
      const x = xStart + (xEnd - xStart) * t + (Math.random() - 0.5) * 0.3;
      const z = zStart + (Math.random() - 0.5) * 0.3 + (zEnd - zStart) * Math.random();
      const c = colors[Math.floor(Math.random() * colors.length)];
      // Body
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.6, 0.45),
        new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 })
      );
      body.position.set(x, ySeat + 0.3, z);
      crowd.add(body);
      // Head
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.3, 0.3),
        new THREE.MeshStandardMaterial({ color: 0xd4956a, roughness: 0.9 })
      );
      head.position.set(x, ySeat + 0.78, z);
      crowd.add(head);
      // Random hair
      const hair = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.08, 0.32),
        new THREE.MeshStandardMaterial({ color: Math.random() < 0.5 ? 0x2a1810 : 0x111111 })
      );
      hair.position.set(x, ySeat + 0.95, z);
      crowd.add(hair);
    }
  }
  // 4 stands of 3 rows each
  for (let stand=0; stand<2; stand++){
    const zSign = stand === 0 ? 1 : -1;
    for (let r=0; r<3; r++){
      const zStart = zSign * (CHL + 2 + r*1.3);
      row(zStart, zStart + 1.0, -CW - 1, CW + 1, r*1.1, 18);
    }
  }
  for (let stand=0; stand<2; stand++){
    const xSign = stand === 0 ? 1 : -1;
    for (let r=0; r<3; r++){
      const xStart = xSign * (CHW + 2.5 + r*1.3);
      row(-CHL, CHL, xStart, xStart + 1.0, r*1.1, 14);
    }
  }

  // Light rigs (sphere "lamps" on tall posts at corners)
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xffffaa, emissive: 0xffffaa, emissiveIntensity: 1.0
  });
  const postMat = new THREE.MeshStandardMaterial({ color: 0x444455, metalness: 0.6 });
  function lampPost(x, z){
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 14, 10), postMat);
    post.position.set(x, 7, z);
    scene.add(post);
    for (let i=-1; i<=1; i++){
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8), lampMat);
      lamp.position.set(x + i*0.7, 14, z);
      scene.add(lamp);
    }
  }
  lampPost(-CHW - 8, -CHL - 4);
  lampPost( CHW + 8, -CHL - 4);
  lampPost(-CHW - 8,  CHL + 4);
  lampPost( CHW + 8,  CHL + 4);

  // Banners along the stands
  const bannerCols = [0xff5050, 0x00b4ff, 0xb2ff14, 0xa050ff];
  function banner(x, z, w, rotY, idx){
    const b = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.8, 0.05),
      new THREE.MeshStandardMaterial({ color: bannerCols[idx % bannerCols.length], emissive: bannerCols[idx % bannerCols.length], emissiveIntensity: 0.4 })
    );
    b.position.set(x, 4.0, z);
    b.rotation.y = rotY;
    scene.add(b);
  }
  banner(0,  CHL + 6, 12, 0,    0);
  banner(0, -CHL - 6, 12, 0,    1);
  banner( CHW + 8, 0, 14, Math.PI/2, 2);
  banner(-CHW - 8, 0, 14, Math.PI/2, 3);

  return crowd;
}
const stadiumCrowdGroup = buildStadium();

// Crowd "wave" animation when something exciting happens
let crowdWaveT = 0;
function triggerCrowdWave(){ crowdWaveT = 1.0; }
function updateCrowd(dt){
  if (crowdWaveT > 0){
    crowdWaveT = Math.max(0, crowdWaveT - dt * 1.2);
    const phase = (1 - crowdWaveT) * Math.PI * 2;
    stadiumCrowdGroup.children.forEach(function(child, i){
      // jiggle the body meshes (every 3rd starting at 0)
      if (i % 3 === 0){
        const off = Math.sin(phase + i * 0.07) * 0.15 * crowdWaveT;
        child.position.y = (child.userData._baseY != null ? child.userData._baseY : child.position.y);
        if (child.userData._baseY == null) child.userData._baseY = child.position.y;
        child.position.y = child.userData._baseY + Math.max(0, off);
      }
    });
  }
}

// ── Court themes (hard / clay / grass / night) ─────────
const COURT_THEMES = {
  hard:  { surface: 0x0a5ab4, surroundCol: 0x1e4228, neon: 0x00b4ff, friction: 0.84, bounce: 0.58, fog: 0x070b18, sky: 0x070b18 },
  clay:  { surface: 0xb04a30, surroundCol: 0x4a2818, neon: 0xffae40, friction: 0.74, bounce: 0.50, fog: 0x150a08, sky: 0x150a08 },
  grass: { surface: 0x1c8a2c, surroundCol: 0x0a4a18, neon: 0xa0ff60, friction: 0.92, bounce: 0.65, fog: 0x051010, sky: 0x051010 },
  night: { surface: 0x05122a, surroundCol: 0x080820, neon: 0xff40ff, friction: 0.84, bounce: 0.58, fog: 0x000004, sky: 0x000004 },
};
let activeTheme = 'hard';
function applyTheme(name){
  const t = COURT_THEMES[name] || COURT_THEMES.hard;
  activeTheme = name;
  scene.background = new THREE.Color(t.sky);
  scene.fog = new THREE.FogExp2(t.fog, name === 'night' ? 0.022 : 0.018);
  if (_surfaceMesh) _surfaceMesh.material.color.setHex(t.surface);
  if (_surroundMesh) _surroundMesh.material.color.setHex(t.surroundCol);
  for (let i=0; i<_neonMeshes.length; i++){
    _neonMeshes[i].material.color.setHex(t.neon);
    _neonMeshes[i].material.emissive.setHex(t.neon);
  }
  B.BOUNCE = t.bounce;
  B._friction = t.friction;
}

// ── Stats tracking ─────────────────────────────────────
const STATS = {
  aces: [0, 0],
  winners: [0, 0],
  errors: [0, 0],
  netCount: [0, 0],
  outCount: [0, 0],
  longestRally: 0,
  currentRallyHits: 0,
  fastestServeKmh: [0, 0],
  totalSmashes: [0, 0],
  reset: function(){
    this.aces = [0, 0]; this.winners = [0, 0]; this.errors = [0, 0];
    this.netCount = [0, 0]; this.outCount = [0, 0];
    this.longestRally = 0; this.currentRallyHits = 0;
    this.fastestServeKmh = [0, 0]; this.totalSmashes = [0, 0];
  },
  registerHit: function(pi, isSmash, isServe){
    this.currentRallyHits++;
    if (isSmash) this.totalSmashes[pi]++;
  },
  registerServeSpeed: function(pi, speedUnits){
    // Convert world units/s roughly to km/h (game world units to "feel" — not real)
    const kmh = speedUnits * 12;
    if (kmh > this.fastestServeKmh[pi]) this.fastestServeKmh[pi] = Math.round(kmh);
  },
  finalizePoint: function(winner, reason, lastHitter){
    if (this.currentRallyHits > this.longestRally) this.longestRally = this.currentRallyHits;
    if (reason === 'out')  this.outCount[lastHitter]++;
    if (reason === 'net')  this.netCount[lastHitter]++;
    if (reason === 'double_bounce' && this.currentRallyHits <= 2) this.aces[winner]++;
    else if (reason === 'double_bounce') this.winners[winner]++;
    else this.errors[lastHitter]++;
    this.currentRallyHits = 0;
  }
};

// ── Achievements ──────────────────────────────────────
const ACHIEVEMENTS = [
  { id:'first_blood',   name:'First Blood',     desc:'Win your first point',         test: function(){ return SC.pts[0] + SC.games[0]*4 + SC.sets[0]*24 >= 1; } },
  { id:'service_star',  name:'Service Star',    desc:'Hit a perfect-zone serve',     test: function(s){ return s && s.event === 'perfect_serve'; } },
  { id:'smasher',       name:'Smasher',         desc:'Land a smash for a winner',    test: function(s){ return s && s.event === 'smash_winner'; } },
  { id:'rally_king',    name:'Rally King',      desc:'Reach a 10-shot rally',        test: function(){ return STATS.longestRally >= 10; } },
  { id:'ace',           name:'Ace!',            desc:'Score an ace serve',           test: function(){ return STATS.aces[0] >= 1; } },
  { id:'set_winner',    name:'Set Winner',      desc:'Win a set',                    test: function(){ return SC.sets[0] >= 1; } },
  { id:'champion',      name:'Champion',        desc:'Win a match',                  test: function(){ return SC.matchOver && SC.winner === 0; } },
  { id:'sound_barrier', name:'Sound Barrier',   desc:'Hit a serve over 200 km/h',    test: function(){ return STATS.fastestServeKmh[0] >= 200; } },
  { id:'comeback',      name:'Comeback Kid',    desc:'Win a game from 0-40 down',    test: function(s){ return s && s.event === 'comeback'; } },
  { id:'shutout',       name:'Bagel',           desc:'Win a set 6-0',                test: function(){ return SC.sets[0] >= 1 && SC.games[1] === 0 && SC.games[0] === 0 && SC.sets[0] >= 1; } },
];
const earnedAch = {};
function checkAchievements(eventTag){
  for (let i=0; i<ACHIEVEMENTS.length; i++){
    const a = ACHIEVEMENTS[i];
    if (earnedAch[a.id]) continue;
    try {
      if (a.test(eventTag)){
        earnedAch[a.id] = true;
        showAchievementToast(a);
      }
    } catch(_){}
  }
}
function showAchievementToast(a){
  const t = document.getElementById('ach-toast');
  if (!t) return;
  document.getElementById('ach-name').textContent = a.name;
  document.getElementById('ach-desc').textContent = a.desc;
  t.style.display = 'flex';
  t.style.opacity = '0';
  setTimeout(function(){ t.style.opacity = '1'; t.style.transform = 'translateX(-50%) translateY(0)'; }, 10);
  setTimeout(function(){
    t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(-20px)';
    setTimeout(function(){ t.style.display = 'none'; }, 400);
  }, 3200);
  AudioSys.score();
}

// ── Settings (mute, theme, graphics) ──────────────────
const SETTINGS = {
  muted: false,
  crowdLevel: 0.18,
  theme: 'hard',
  shadows: true,
  bloom: false,
  load: function(){
    try {
      const raw = localStorage.getItem('spike_tennis_settings');
      if (raw){
        const s = JSON.parse(raw);
        if (s.muted != null) this.muted = !!s.muted;
        if (s.crowdLevel != null) this.crowdLevel = +s.crowdLevel;
        if (s.theme) this.theme = s.theme;
        if (s.shadows != null) this.shadows = !!s.shadows;
      }
    } catch(_){}
  },
  save: function(){
    try {
      localStorage.setItem('spike_tennis_settings', JSON.stringify({
        muted: this.muted, crowdLevel: this.crowdLevel, theme: this.theme, shadows: this.shadows
      }));
    } catch(_){}
  },
  apply: function(){
    AudioSys.setMuted(this.muted);
    AudioSys.setCrowdVolume(this.muted ? 0 : this.crowdLevel);
    if (renderer) renderer.shadowMap.enabled = this.shadows;
  }
};
SETTINGS.load();

// ── Replay system (rolling buffer of ball + player positions) ──
const ReplaySys = (function(){
  const MAX_FRAMES = 360; // ~6 seconds @ 60fps
  const buffer = [];
  let recording = true;
  let playing = false;
  let playIdx = 0;

  function record(){
    if (!recording || playing) return;
    if (!B.active && !TOSS.active) return;
    const frame = {
      bx: B.pos.x, by: B.pos.y, bz: B.pos.z,
      bvx: B.vel.x, bvy: B.vel.y, bvz: B.vel.z,
      bact: B.active, btact: TOSS.active,
      ttx: TOSS.x, ttz: TOSS.z, tty: TOSS.y,
      players: P.map(function(p){ return { x:p.x, z:p.z, jh:p.jumpH||0, sw:p.swingT||0 }; })
    };
    buffer.push(frame);
    if (buffer.length > MAX_FRAMES) buffer.shift();
  }

  function startPlayback(){
    if (buffer.length < 5) return false;
    playing = true; recording = false; playIdx = 0;
    return true;
  }

  function stopPlayback(){
    playing = false; recording = true; playIdx = 0;
  }

  function tick(){
    if (!playing) return;
    if (playIdx >= buffer.length){ stopPlayback(); return; }
    const f = buffer[playIdx++];
    B.pos.set(f.bx, f.by, f.bz);
    B.vel.set(f.bvx, f.bvy, f.bvz);
    B.active = f.bact;
    ballMesh.position.copy(B.pos);
    ballLight.position.copy(B.pos);
    if (f.btact){
      tossMesh.visible = true;
      tossMesh.position.set(f.ttx, f.tty + 0.18, f.ttz);
    } else {
      tossMesh.visible = false;
    }
    for (let i=0; i<f.players.length && i<P.length; i++){
      P[i].x = f.players[i].x;
      P[i].z = f.players[i].z;
      P[i].jumpH = f.players[i].jh;
    }
  }

  function isPlaying(){ return playing; }
  function clear(){ buffer.length = 0; }

  return {
    record: record, startPlayback: startPlayback, stopPlayback: stopPlayback,
    tick: tick, isPlaying: isPlaying, clear: clear,
    bufferSize: function(){ return buffer.length; }
  };
})();

// ── Power-up pickups (small spinning boxes on court) ──
const PowerUps = (function(){
  const TYPES = [
    { id:'speed',  color: 0x00ff80, label:'⚡ SPEED',     msg:'⚡ SPEED BOOST!',   apply: function(p){ p._buffSpeed = 4; } },
    { id:'power',  color: 0xff5060, label:'💪 POWER',     msg:'💪 POWER UP!',      apply: function(p){ p._buffPower = 4; } },
    { id:'jump',   color: 0xffe040, label:'⬆ HIGH JUMP', msg:'⬆ MEGA JUMP!',     apply: function(p){ p._buffJump = 5; } },
    { id:'aim',    color: 0xa050ff, label:'🎯 AIM',       msg:'🎯 LASER AIM!',     apply: function(p){ p._buffAim = 5; } },
    { id:'time',   color: 0x00b4ff, label:'⏱ SLOW TIME', msg:'⏱ SLO-MO!',         apply: function(p){ if (typeof window !== 'undefined'){ window._timeFactor = 0.5; setTimeout(function(){ window._timeFactor = 1; }, 2200); } } },
  ];
  const active = []; // { mesh, type, x, z, age }
  const SPAWN_INTERVAL = 12;  // seconds between spawns
  let spawnTimer = SPAWN_INTERVAL;
  let enabled = false;

  function spawnOne(){
    const t = TYPES[Math.floor(Math.random() * TYPES.length)];
    const x = (Math.random() - 0.5) * (CW - 2);
    const side = Math.random() < 0.5 ? 1 : -1;
    const z = side * (1 + Math.random() * (CHL - 4));
    const m = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.42, 0),
      new THREE.MeshStandardMaterial({ color: t.color, emissive: t.color, emissiveIntensity: 1.4, roughness: 0.3 })
    );
    m.position.set(x, 0.6, z);
    m.castShadow = true;
    scene.add(m);
    active.push({ mesh: m, type: t, x: x, z: z, age: 0 });
  }

  function clearAll(){
    for (let i=0; i<active.length; i++) scene.remove(active[i].mesh);
    active.length = 0;
  }

  function setEnabled(on){
    enabled = !!on;
    if (!enabled) clearAll();
    spawnTimer = SPAWN_INTERVAL;
  }

  function update(dt){
    if (!enabled) return;
    spawnTimer -= dt;
    if (spawnTimer <= 0 && active.length < 3){ spawnOne(); spawnTimer = SPAWN_INTERVAL; }
    for (let i=active.length-1; i>=0; i--){
      const pu = active[i];
      pu.age += dt;
      pu.mesh.rotation.y += dt * 2.0;
      pu.mesh.rotation.x += dt * 1.4;
      pu.mesh.position.y = 0.6 + Math.sin(pu.age * 3) * 0.08;
      // Despawn after 18 seconds
      if (pu.age > 18){ scene.remove(pu.mesh); active.splice(i, 1); continue; }
      // Pickup test (P[0] only for simplicity)
      const dx = P[0].x - pu.x, dz = P[0].z - pu.z;
      if (dx*dx + dz*dz < 1.0){
        try { pu.type.apply(P[0]); } catch(_){}
        showMsg(pu.type.msg, 1100);
        AudioSys.score();
        ParticleSys.pickupBurst(pu.x, 0.6, pu.z, pu.type.color);
        scene.remove(pu.mesh); active.splice(i, 1);
      }
    }
    // Decay buffs
    for (let i=0; i<P.length; i++){
      const p = P[i];
      ['_buffSpeed','_buffPower','_buffJump','_buffAim'].forEach(function(k){
        if (p[k]){ p[k] -= dt; if (p[k] <= 0) delete p[k]; }
      });
    }
  }

  return { update: update, setEnabled: setEnabled, clearAll: clearAll };
})();

// ── Day/night cycle (slowly rotates the sun + tints ambient) ──
const DayNight = (function(){
  let t = 0;
  let enabled = false;
  function setEnabled(on){ enabled = !!on; if (!on) reset(); }
  function reset(){
    t = 0;
    sun.position.set(8, 22, 10);
    sun.intensity = 1.2;
  }
  function update(dt){
    if (!enabled) return;
    t += dt * 0.05;
    const angle = t;
    sun.position.set(Math.cos(angle) * 22, Math.max(2, Math.sin(angle) * 22), 10);
    const dayness = (Math.sin(angle) + 1) / 2;
    sun.intensity = 0.4 + dayness * 1.2;
  }
  return { update: update, setEnabled: setEnabled, reset: reset };
})();

// ── Floor decals (ball mark trail where the ball bounces) ──
const FloorMarks = (function(){
  const POOL = 14;
  const pool = [];
  const geo = new THREE.CircleGeometry(0.18, 14);
  for (let i=0; i<POOL; i++){
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: 0x000000, transparent: true, opacity: 0
    }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.012;
    m.visible = false;
    scene.add(m);
    pool.push({ mesh: m, life: 0 });
  }
  let nextIdx = 0;

  function add(x, z){
    const p = pool[nextIdx];
    nextIdx = (nextIdx + 1) % POOL;
    p.mesh.position.set(x, 0.012, z);
    p.mesh.visible = true;
    p.mesh.material.opacity = 0.45;
    p.life = 5.0;
  }
  function update(dt){
    for (let i=0; i<POOL; i++){
      const p = pool[i];
      if (!p.mesh.visible) continue;
      p.life -= dt;
      if (p.life <= 0){ p.mesh.visible = false; continue; }
      p.mesh.material.opacity = 0.45 * (p.life / 5.0);
    }
  }
  function clearAll(){
    for (let i=0; i<POOL; i++){ pool[i].mesh.visible = false; pool[i].life = 0; }
  }
  return { add: add, update: update, clearAll: clearAll };
})();

// ── Footstep dust (when the human player runs) ──
const Footsteps = (function(){
  let stepTimer = 0;
  function update(dt, p, isMoving){
    if (!isMoving) { stepTimer = 0; return; }
    stepTimer -= dt;
    if (stepTimer <= 0){
      stepTimer = 0.18;
      ParticleSys.spawn(p.x + (Math.random()-0.5)*0.3, 0.05, p.z + (Math.random()-0.5)*0.3, {
        count: 3, speed: 1.0, color: 0xccddee, upBias: 0.3, lifeMin: 0.18, lifeMax: 0.32
      });
    }
  }
  return { update: update };
})();

// ── Floating nametags (canvas texture sprites above each character) ──
const Nametags = (function(){
  const sprites = [];

  function makeTextSprite(text, color){
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 80;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, 256, 80);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 252, 76);
    ctx.fillStyle = color;
    ctx.font = 'bold 36px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.fillText(text, 128, 40);
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2.4, 0.75, 1);
    return { sprite: sprite, tex: tex, canvas: canvas, ctx: ctx };
  }

  function setup(){
    for (let i=0; i<P.length; i++){
      const c = CHARS[pCharIdx[i] % CHARS.length];
      const ns = makeTextSprite(c.name, c.col);
      ns.sprite.visible = false;
      scene.add(ns.sprite);
      sprites.push(ns);
    }
  }

  function update(){
    for (let i=0; i<sprites.length; i++){
      const ns = sprites[i];
      const visible = chars[i] && chars[i].group && chars[i].group.visible;
      ns.sprite.visible = !!visible;
      if (!visible) continue;
      const cg = chars[i].group;
      ns.sprite.position.set(cg.position.x, (cg.position.y || 0) + 3.5, cg.position.z);
    }
  }

  function rebuild(idx){
    if (!sprites[idx]) return;
    scene.remove(sprites[idx].sprite);
    const c = CHARS[pCharIdx[idx] % CHARS.length];
    const ns = makeTextSprite(c.name, c.col);
    ns.sprite.visible = false;
    scene.add(ns.sprite);
    sprites[idx] = ns;
  }

  return { setup: setup, update: update, rebuild: rebuild };
})();

// ── Mini-map radar (small canvas overlay showing player + ball positions) ──
const Radar = (function(){
  let canvas = null, ctx = null;

  function init(){
    canvas = document.createElement('canvas');
    canvas.width = 140; canvas.height = 280;
    canvas.style.cssText = 'position:fixed;bottom:80px;right:14px;z-index:50;' +
      'border:1px solid rgba(0,180,255,.35);border-radius:8px;background:rgba(5,8,15,.78);' +
      'pointer-events:none;display:none';
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
  }

  function setVisible(v){
    if (!canvas) init();
    canvas.style.display = v ? 'block' : 'none';
  }

  function draw(){
    if (!canvas || !ctx) return;
    if (canvas.style.display === 'none') return;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    // Map: world x in [-CHW, CHW] -> canvas X in [10, W-10]
    //      world z in [-CHL, CHL] -> canvas Y in [10, H-10] (z=+CHL near top per Roblox convention; flip so far court at top)
    function mapX(x){ return W*0.5 + (x / CHW) * (W*0.5 - 12); }
    function mapY(z){ return H*0.5 - (z / CHL) * (H*0.5 - 12); }

    // Court outline
    ctx.strokeStyle = '#00b4ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(mapX(-CHW), mapY(CHL), mapX(CHW)-mapX(-CHW), mapY(-CHL)-mapY(CHL));
    // Net (horizontal middle)
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(mapX(-CHW), mapY(0));
    ctx.lineTo(mapX(CHW), mapY(0));
    ctx.stroke();

    // Players
    for (let i=0; i<activePL.length; i++){
      const pi = activePL[i];
      const c = CHARS[pCharIdx[pi] % CHARS.length];
      ctx.fillStyle = c.col;
      ctx.beginPath();
      ctx.arc(mapX(P[pi].x), mapY(P[pi].z), 5, 0, Math.PI*2);
      ctx.fill();
    }

    // Ball
    if (B.active){
      ctx.fillStyle = '#b2ff14';
      ctx.shadowColor = '#b2ff14';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(mapX(B.pos.x), mapY(B.pos.z), 3, 0, Math.PI*2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Score in corner
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 11px Orbitron, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(SC.str(), 10, H - 8);
  }

  return { init: init, setVisible: setVisible, draw: draw };
})();
Radar.init();

// ── End-of-match summary screen ────────────────────────
const MatchSummary = (function(){
  let panel = null;

  function build(){
    panel = document.createElement('div');
    panel.id = 'match-summary';
    panel.style.cssText =
      'position:fixed;inset:0;display:none;align-items:center;justify-content:center;' +
      'z-index:130;background:rgba(5,8,15,.94);backdrop-filter:blur(6px);font-family:Orbitron,sans-serif;color:#fff';
    panel.innerHTML =
      '<div style="background:rgba(12,18,32,.97);border:1.5px solid rgba(178,255,20,.4);border-radius:18px;' +
      'padding:2rem 1.8rem;width:min(540px,92vw);display:flex;flex-direction:column;gap:1.1rem">' +
        '<h2 id="ms-title" style="text-align:center;font-size:1.4rem;letter-spacing:.06em;color:#b2ff14">MATCH SUMMARY</h2>' +
        '<div id="ms-winner" style="text-align:center;font-size:.85rem;letter-spacing:.1em;color:#aabbcc">Winner: P1</div>' +
        '<div id="ms-stats" style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem 1.4rem;font-size:.74rem"></div>' +
        '<div style="display:flex;gap:.6rem">' +
          '<button id="ms-replay" class="abtn" style="flex:1">▶ REPLAY POINT</button>' +
          '<button id="ms-lobby"  class="abtn" style="flex:1;background:#b2ff14;color:#000">🏠 LOBBY</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(panel);
    panel.querySelector('#ms-replay').onclick = function(){
      AudioSys.click();
      hide();
      ReplaySys.startPlayback();
    };
    panel.querySelector('#ms-lobby').onclick = function(){
      AudioSys.click();
      hide();
      goLobby();
    };
  }

  function show(){
    if (!panel) build();
    const winner = SC.winner;
    panel.querySelector('#ms-title').textContent = winner === 0 ? '🏆 VICTORY!' : '💀 DEFEAT';
    panel.querySelector('#ms-winner').textContent =
      'P' + (winner+1) + ' wins ' + SC.sets[winner] + '–' + SC.sets[1-winner];
    const grid = panel.querySelector('#ms-stats');
    grid.innerHTML = '';
    function row(label, v0, v1){
      const div = document.createElement('div');
      div.style.cssText = 'display:contents';
      div.innerHTML = '<div style="color:#7a8ba0">' + label + '</div>' +
        '<div style="text-align:right"><span style="color:#00c8ff">' + v0 + '</span> · <span style="color:#ff6050">' + v1 + '</span></div>';
      grid.appendChild(div);
    }
    row('Aces',          STATS.aces[0],          STATS.aces[1]);
    row('Winners',       STATS.winners[0],       STATS.winners[1]);
    row('Errors',        STATS.errors[0],        STATS.errors[1]);
    row('Smashes',       STATS.totalSmashes[0],  STATS.totalSmashes[1]);
    row('Top Serve',     STATS.fastestServeKmh[0]+' km/h', STATS.fastestServeKmh[1]+' km/h');
    row('Longest Rally', STATS.longestRally + ' shots', '—');
    panel.style.display = 'flex';
  }

  function hide(){ if (panel) panel.style.display = 'none'; }

  return { show: show, hide: hide };
})();

// ── Practice mode: target shooting + ball machine ─────
const Practice = (function(){
  let active = false;
  const targets = [];        // moving glowing rings on the far court
  const TARGET_COUNT = 3;
  let machineTimer = 0;
  let score = 0;
  let timeLeft = 60;
  let bestScore = 0;
  try {
    const stored = localStorage.getItem('spike_tennis_practice_best');
    if (stored) bestScore = parseInt(stored, 10) || 0;
  } catch(_){}

  function spawnTargets(){
    clearTargets();
    for (let i=0; i<TARGET_COUNT; i++){
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.85, 24),
        new THREE.MeshBasicMaterial({ color: 0xffdd44, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
      );
      ring.position.set((Math.random()-0.5)*7, 0.05, -(3 + Math.random()*7));
      ring.rotation.x = -Math.PI / 2;
      scene.add(ring);
      targets.push({ mesh: ring, age: 0, hit: false, vx: (Math.random()-0.5)*1.4 });
    }
  }
  function clearTargets(){
    for (let i=0; i<targets.length; i++) scene.remove(targets[i].mesh);
    targets.length = 0;
  }

  function start(){
    active = true;
    score = 0; timeLeft = 60;
    spawnTargets();
    showMsg('PRACTICE — HIT THE RINGS!', 1500);
    machineTimer = 1.4;
    P[0].x = 0; P[0].z = 9;
    chars[0].group.visible = true;
    chars[1].group.visible = false;
    chars[2].group.visible = false;
    chars[3].group.visible = false;
    showHUD(true);
    document.getElementById('lobby').style.display = 'none';
    gPhase = 'practice';
    refreshHUD();
  }
  function stop(){
    active = false;
    clearTargets();
    if (score > bestScore){
      bestScore = score;
      try { localStorage.setItem('spike_tennis_practice_best', String(score)); } catch(_){}
    }
    showMsg('TIME!  SCORE: ' + score + ' (BEST: ' + bestScore + ')', 4000);
    AudioSys.fanfare();
    setTimeout(function(){ goLobby(); }, 4200);
  }

  function refreshHUD(){
    const pts = document.getElementById('pts');
    const gms = document.getElementById('gms');
    if (pts) pts.textContent = 'SCORE  ' + score;
    if (gms) gms.textContent = Math.ceil(timeLeft) + 's left  ·  Best ' + bestScore;
  }

  function ballMachineFire(){
    // Ball machine on the far baseline lobs balls toward P1
    B.pos.set((Math.random()-0.5)*4, 1.4, -CHL + 0.5);
    B.vel.set((P[0].x - B.pos.x) * 0.45 + (Math.random()-0.5)*1.5, 5.5, 9 + Math.random()*2);
    B.bounces = 0; B.lastHitter = 1; B.active = true;
    B.trail = [];
    AudioSys.hit(0.5);
    ParticleSys.sparkBurst(B.pos.x, B.pos.y, B.pos.z);
  }

  function update(dt){
    if (!active) return;
    timeLeft -= dt;
    refreshHUD();
    if (timeLeft <= 0){ stop(); return; }
    machineTimer -= dt;
    if (machineTimer <= 0 && (!B.active || B.pos.z < -8)){
      ballMachineFire();
      machineTimer = 2.4;
    }
    // Move targets
    for (let i=0; i<targets.length; i++){
      const t = targets[i];
      t.age += dt;
      t.mesh.position.x += t.vx * dt;
      if (Math.abs(t.mesh.position.x) > 4){ t.vx *= -1; }
      t.mesh.material.opacity = 0.65 + Math.sin(t.age*4)*0.20;
      if (t.hit) continue;
      // Hit detection
      const dx = B.pos.x - t.mesh.position.x;
      const dz = B.pos.z - t.mesh.position.z;
      if (B.pos.y < 0.4 && dx*dx + dz*dz < 0.85*0.85){
        t.hit = true;
        score += 50;
        showMsg('+50!', 700);
        AudioSys.cheer(false);
        AudioSys.score();
        ParticleSys.smashBurst(t.mesh.position.x, t.mesh.position.z);
        scene.remove(t.mesh);
        // Spawn replacement after delay
        setTimeout(function(){
          if (!active) return;
          const r = new THREE.Mesh(
            new THREE.RingGeometry(0.55, 0.85, 24),
            new THREE.MeshBasicMaterial({ color: 0xffdd44, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
          );
          r.position.set((Math.random()-0.5)*7, 0.05, -(3 + Math.random()*7));
          r.rotation.x = -Math.PI/2;
          scene.add(r);
          targets[i] = { mesh: r, age: 0, hit: false, vx: (Math.random()-0.5)*1.4 };
        }, 1200);
      }
    }
  }

  function isActive(){ return active; }
  function getScore(){ return score; }
  function getBest(){ return bestScore; }

  return {
    start: start, stop: stop, update: update,
    isActive: isActive, getScore: getScore, getBest: getBest
  };
})();

// ── Tournament mode (best-of-3 best-of-3, escalating difficulty) ──
const Tournament = (function(){
  let bracket = [];
  let stage = 0;
  let active = false;
  function start(){
    bracket = ['easy', 'easy', 'medium', 'medium', 'hard'];
    stage = 0;
    active = true;
    advance();
  }
  function advance(){
    if (!active) return;
    if (stage >= bracket.length){
      showMsg('🏆 TOURNAMENT WON! 🏆', 4500);
      AudioSys.fanfare();
      active = false;
      try { localStorage.setItem('spike_tennis_tournament_won','1'); } catch(_){}
      setTimeout(goLobby, 5000);
      return;
    }
    const diff = bracket[stage++];
    showMsg('ROUND ' + stage + '/' + bracket.length + ' — ' + diff.toUpperCase(), 1800);
    setTimeout(function(){ startMode('ai_1v1', undefined, undefined, diff); }, 1900);
  }
  function onMatchOver(){
    if (!active) return;
    if (SC.winner === 0){
      setTimeout(advance, 3000);
    } else {
      showMsg('TOURNAMENT OVER — Made it to Round '+stage+'/'+bracket.length, 3500);
      active = false;
      setTimeout(goLobby, 3700);
    }
  }
  function isActive(){ return active; }
  function reset(){ active = false; stage = 0; bracket = []; }
  return { start: start, advance: advance, onMatchOver: onMatchOver, isActive: isActive, reset: reset };
})();

// ── Camera (Roblox 3rd-person: directly behind the character) ──
const CAM = { yaw:0, pitch:0.22, dist:5.2, tx:0, ty:1.6, tz:9 };
function updateCamera(){
  const p0 = P[0];
  // Target = the character itself (chest height)
  CAM.tx += (p0.x                       - CAM.tx) * 0.18;
  CAM.ty += (1.5 + (p0.jumpH||0)*0.5    - CAM.ty) * 0.12;
  CAM.tz += (p0.z                       - CAM.tz) * 0.18;
  const sy = Math.sin(CAM.yaw),  cy = Math.cos(CAM.yaw);
  const sp = Math.sin(CAM.pitch), cp = Math.cos(CAM.pitch);
  // yaw=0, P1 at +z → camera sits at target.z + dist (further +z = directly behind P1)
  camera.position.set(
    CAM.tx + CAM.dist*cp*sy,
    CAM.ty + CAM.dist*sp,
    CAM.tz + CAM.dist*cp*cy
  );
  camera.lookAt(CAM.tx, CAM.ty, CAM.tz);
}
function initCamera(){
  CAM.tx = 0; CAM.ty = 1.5; CAM.tz = 9;
  const sy = Math.sin(CAM.yaw), cy = Math.cos(CAM.yaw);
  const sp = Math.sin(CAM.pitch), cp = Math.cos(CAM.pitch);
  camera.position.set(CAM.tx + CAM.dist*cp*sy, CAM.ty + CAM.dist*sp, CAM.tz + CAM.dist*cp*cy);
  camera.lookAt(CAM.tx, CAM.ty, CAM.tz);
}
initCamera();

// Camera-relative forward/right (for WASD movement)
function camForwardRight(){
  const fx = CAM.tx - camera.position.x;
  const fz = CAM.tz - camera.position.z;
  const fl = Math.hypot(fx, fz) || 1;
  const Fx = fx/fl, Fz = fz/fl;
  // Right = F × up = (Fz, 0, -Fx)
  // Right = F × up = (-Fz, 0, Fx) — was reversed before
  return { Fx:Fx, Fz:Fz, Rx:-Fz, Rz:Fx };
}

// ── UI helpers ───────────────────────────────────────
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
  const col = SC.server===0?'#00c8ff':'#ff6050';
  $srv.style.background = col; $srv.style.boxShadow = '0 0 8px '+col;
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
function updateServeMeter(v){
  document.getElementById('meter-needle').style.left = (v*100)+'%';
  // Best zone is the LEFT (low %) — click early to nail a perfect serve
  const zone = v < 0.18 ? 'PERFECT!' : v < 0.45 ? 'GOOD' : 'WEAK';
  const col  = v < 0.18 ? '#60ff80' : v < 0.45 ? '#ffdc32' : '#ff5050';
  const pct  = Math.floor(v*100);
  const pctEl = document.getElementById('meter-pct');
  const zlbl  = document.getElementById('meter-zonelbl');
  if (pctEl) pctEl.textContent = pct + '%';
  if (zlbl)  zlbl.textContent = zone;
  document.getElementById('meter-zone').style.color = col;
  document.getElementById('meter-needle').style.background = col;
  document.getElementById('meter-needle').style.boxShadow = '0 0 14px '+col;
}
function showTossUI(on, tn){
  const el = document.getElementById('toss-ui');
  el.style.display = on?'flex':'none';
  if (on){
    tn = tn || 0;
    const lbl = document.getElementById('toss-label');
    const col = tn>0.4&&tn<0.6?'#60ff80':tn>0.2&&tn<0.8?'#ffdc32':'#ff5050';
    lbl.textContent = tn>0.4&&tn<0.6?'🎾 HIT NOW!':tn<0.4?'WAIT…':'TOO LATE…';
    lbl.style.color = col; lbl.style.textShadow = '0 0 16px '+col;
  }
}
function setCtrlHint(){
  const hints = gMode==='local_1v1'
    ? ['P1: WASD move · SPACE hit · LSHIFT/V jump', 'P2: Arrows move · ENTER hit · RSHIFT jump', 'Right-click drag: orbit camera · Wheel: zoom']
    : ['WASD move · LSHIFT or V to JUMP', 'CLICK or SPACE: hit / serve', 'Right-click drag: orbit camera · Wheel: zoom'];
  document.getElementById('ctrl-hint').innerHTML = hints.join('<br>');
}

// ── Scoring ──────────────────────────────────────────
const SC = {
  pts:[0,0],games:[0,0],sets:[0,0],server:0,deuce:false,adv:-1,matchOver:false,winner:-1,
  D:['0','15','30','40'],
  reset(){ Object.assign(this,{pts:[0,0],games:[0,0],sets:[0,0],server:0,deuce:false,adv:-1,matchOver:false,winner:-1}); },
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
    const g0=this.games[0],g1=this.games[1];
    if(g0===7||g1===7||(Math.max(g0,g1)>=6&&Math.abs(g0-g1)>=2))return this._s(i);
    return{msg:'GAME  P'+(i+1)+'   '+g0+' – '+g1};
  },
  _s(i){
    this.sets[i]++;this.games=[0,0];
    if(this.sets[i]>=2){this.matchOver=true;this.winner=i;return{msg:'P'+(i+1)+' WINS THE MATCH!'};}
    return{msg:'SET  P'+(i+1)+'   '+this.sets[0]+' – '+this.sets[1]};
  },
  str(){ if(this.deuce)return this.adv<0?'DEUCE':'ADV  P'+(this.adv+1); return this.D[this.pts[0]]+' – '+this.D[this.pts[1]]; }
};

// ── Input ────────────────────────────────────────────
function doJump(pi){
  if (humanPL.indexOf(pi) < 0) return;
  const p = P[pi];
  if ((p.jumpH||0) > 0.05 || (p.jumpVel||0) > 0.01) return;
  p.jumpVel = (p._buffJump ? 8.6 : 5.4);
  AudioSys.whoosh();
}
document.addEventListener('keydown', e=>{
  if (gPhase==='lobby') return;
  KEYS[e.code] = true;
  if (e.code==='Space')      { e.preventDefault(); onAction(0); }
  else if (e.code==='Enter' || e.code==='NumpadEnter'){ e.preventDefault(); onAction(1); }
  else if (e.code==='ShiftLeft'){ e.preventDefault(); doJump(0); }
  else if (e.code==='ShiftRight'){ e.preventDefault(); doJump(gMode==='local_1v1'?1:0); }
  else if (e.code==='KeyV'){ e.preventDefault(); doJump(0); }
  else if (e.code==='KeyF'){ e.preventDefault(); onAction(0); }
});
document.addEventListener('keyup', e=>{ delete KEYS[e.code]; });
cv.addEventListener('mousemove', e=>{ mX = e.clientX; });
cv.addEventListener('click', e=>{
  if (e.button !== 0) return;
  mX = e.clientX;
  if (gPhase==='match_over'){ goLobby(); return; }
  onAction(0);
});
cv.addEventListener('contextmenu', e=>e.preventDefault());
let dragOn=false, lastX=0, lastY=0;
cv.addEventListener('mousedown', e=>{
  if (e.button === 2){ dragOn=true; lastX=e.clientX; lastY=e.clientY; e.preventDefault(); }
});
window.addEventListener('mouseup', e=>{ if(e.button===2) dragOn=false; });
window.addEventListener('mousemove', e=>{
  if (!dragOn) return;
  const dx=e.clientX-lastX, dy=e.clientY-lastY;
  CAM.yaw   -= dx*0.005;
  CAM.pitch  = Math.max(0.05, Math.min(1.30, CAM.pitch - dy*0.005));
  lastX=e.clientX; lastY=e.clientY;
});
cv.addEventListener('wheel', e=>{
  if (gPhase==='lobby') return;
  e.preventDefault();
  CAM.dist = Math.max(3.5, Math.min(14, CAM.dist + e.deltaY*0.008));
}, { passive:false });

// Touch: 1-finger drag = orbit, 2-finger = zoom
let pinchD = 0;
cv.addEventListener('touchstart', e=>{
  if (gPhase==='lobby') return;
  if (e.touches.length===1){ dragOn=true; lastX=e.touches[0].clientX; lastY=e.touches[0].clientY; }
  else if (e.touches.length===2){
    const dx = e.touches[1].clientX - e.touches[0].clientX;
    const dy = e.touches[1].clientY - e.touches[0].clientY;
    pinchD = Math.hypot(dx, dy);
  }
});
cv.addEventListener('touchmove', e=>{
  if (e.touches.length===1 && dragOn){
    const dx=e.touches[0].clientX-lastX, dy=e.touches[0].clientY-lastY;
    CAM.yaw -= dx*0.005;
    CAM.pitch = Math.max(0.05, Math.min(1.30, CAM.pitch - dy*0.005));
    lastX=e.touches[0].clientX; lastY=e.touches[0].clientY;
  } else if (e.touches.length===2){
    const dx = e.touches[1].clientX - e.touches[0].clientX;
    const dy = e.touches[1].clientY - e.touches[0].clientY;
    const d = Math.hypot(dx, dy);
    if (pinchD>0) CAM.dist = Math.max(3.5, Math.min(14, CAM.dist + (pinchD - d)*0.02));
    pinchD = d;
  }
});
cv.addEventListener('touchend', ()=>{ dragOn=false; pinchD=0; });

function onAction(who){
  const srvPi = SC.server===0?0:1;
  if (gPhase==='serve_meter' && humanPL.indexOf(srvPi)>=0 && who===(srvPi===0?0:1)) lockPower(srvPi);
  else if (gPhase==='serve_toss' && humanPL.indexOf(srvPi)>=0 && who===(srvPi===0?0:1)) doServeHit(srvPi);
  else if (gPhase==='rally') doHit(who===0?0:1);
}

function lockPower(pi){
  srvPower = srvMeter;
  TOSS.start(P[pi].x, P[pi].z + (P[pi].side==='near'?-0.3:0.3));
  gPhase='serve_toss'; tossHit=false;
  showServeUI(false); showTossUI(true, 0);
  // Pre-jump for the serve so the character is already in the air at hit time
  P[pi].jumpVel = 5.8;
}
function doServeHit(pi){
  if (tossHit) return;
  const tn = TOSS.t/TOSS.dur, dev = Math.abs(tn-0.5);
  const timing = Math.max(0, 1 - dev*3.0);
  // Power quality: LEFT side of meter = best
  // <0.18 = perfect (1.0), <0.45 = good (0.65), else weak (0.30)
  const powerQ = srvPower < 0.18 ? 1.0 : srvPower < 0.45 ? 0.65 : 0.30;
  const quality = powerQ*0.55 + timing*0.45;
  tossHit=true; TOSS.stop();
  P[pi].swingT=24;
  // Top-up jump if we're already in the air (already launched in lockPower)
  if ((P[pi].jumpH||0) < 0.3) P[pi].jumpVel = 6.5;
  showTossUI(false);
  const txR = (mX/innerWidth)*2 - 1;
  const tx = txR * 3.5;
  const tz = P[pi].side==='near' ? -SVC_Z*0.65 : SVC_Z*0.65;
  // Launch from elevated position (jump serve) — racket meets ball above the head
  const fromY = 2.2 + (P[pi].jumpH||0) * 1.4;
  const srvSpeed = 6 + quality*8;
  B.launch(pi, tx, tz, srvSpeed, 0.4, fromY);
  AudioSys.hit(0.9 + quality*0.4);
  ParticleSys.sparkBurst(P[pi].x, fromY, P[pi].z + (P[pi].side==='near'?-0.3:0.3));
  STATS.registerHit(pi, false, true);
  STATS.registerServeSpeed(pi, srvSpeed);
  if (powerQ >= 1) checkAchievements({ event: 'perfect_serve' });
  gPhase='rally'; P[pi].serving=false;
}

function doHit(who){
  if (gPhase!=='rally') return;
  const pi = who===0?0:1;
  if (humanPL.indexOf(pi)<0) return;
  const p = P[pi];
  // Block spam: must be off cooldown AND not mid-swing
  if (p.hitCD>0 || p.swingT>0) return;
  const onMySide = p.side==='near' ? B.pos.z>0 : B.pos.z<0;
  if (!onMySide) return;
  // Must be near the ball — REAL distance, not just a cap
  const dx=p.x-B.pos.x, dz=p.z-B.pos.z;
  const dist = Math.sqrt(dx*dx+dz*dz);
  if (dist > 4.0) return;          // tighter range so you actually have to move
  if (B.pos.y > 3.5) return;       // ball too high to reach
  const q = ringActive?ringQuality():0.38;
  ringActive=false;
  p.swingT=22; p.hitCD=42;          // longer cooldown — no F spamming
  const txR = (mX/innerWidth)*2-1;
  const tx = Math.max(-CHW+0.5, Math.min(CHW-0.5, txR*3.8));
  const tz = p.side==='near' ? -(3+Math.random()*5) : (3+Math.random()*5);
  // Auto-smash when jumping AND ball is high
  const isSmash = (p.jumpH > 0.25) && (B.pos.y > 1.6);
  let arcH=1.6, spd=5.5, fromY=null;
  if (isSmash){
    // REAL SMASH: launch from up high, slam ball down deep into opponent's court
    arcH = -1.8;                                  // strongly downward arc
    spd  = 17;                                    // very fast
    fromY = 1.9 + (p.jumpH || 0) * 1.6;            // start ABOVE the player (jump + reach)
    // Override target to be deep in opponent's court (slam it past the service line)
    const aimX = Math.max(-CHW+0.6, Math.min(CHW-0.6, txR*4.2));
    const aimZ = p.side==='near' ? -(7 + Math.random()*3) : (7 + Math.random()*3);
    p.swingT = 28;                                // longer swing animation
    showMsg('🔥 SMASH!', 800);
    AudioSys.smash();
    AudioSys.whoosh();
    ParticleSys.sparkBurst(p.x, fromY, p.z);
    B.launch(pi, aimX, aimZ, spd, arcH, fromY);
    STATS.registerHit(pi, true, false);
    triggerCrowdWave();
    if (peerConn && isHost){ try{ peerConn.send({type:'hit', pi:pi, tx:aimX, tz:aimZ, spd:spd, arcH:arcH, y0:fromY}); }catch(_){} }
    return;
  }
  if (KEYS.KeyQ){ arcH=2.2; spd=4.5; }
  else if (KEYS.KeyE){ arcH=1.0; spd=4.5; }
  else if (KEYS.KeyR){ arcH=5.0; spd=3.5; }
  else if (KEYS.KeyG){ arcH=0.7; spd=8.0; }
  spd *= 0.7 + q*0.58;
  B.launch(pi, tx, tz, spd, arcH);
  AudioSys.hit(0.5 + q * 0.6);
  ParticleSys.sparkBurst(p.x, B.pos.y, p.z);
  STATS.registerHit(pi, false, false);
  if (peerConn && isHost){ try{ peerConn.send({type:'hit', pi:pi, tx:tx, tz:tz, spd:spd, arcH:arcH}); }catch(_){} }
}

function updateAI(dt){
  const D = DIFF_CUR;
  for (let k=0; k<aiPL.length; k++){
    const pi = aiPL[k]; const p = P[pi];
    const srv = SC.server===0?0:1;
    if (gPhase==='serve_meter' && pi===srv){
      aiCDs[pi] -= dt*60;
      if (aiCDs[pi]<=0){
        // AI clicks the meter at low values (left side = perfect now)
        srvPower = D.power<1 ? 0.30 + Math.random()*0.18    // easy: often misses zone
                  : D.power>1.1 ? 0.05 + Math.random()*0.10  // hard: nails perfect
                  : 0.10 + Math.random()*0.18;               // medium: usually good/perfect
        TOSS.start(p.x, p.z + (p.side==='near'?-0.3:0.3));
        gPhase='serve_toss'; tossHit=false; showServeUI(false);
        aiCDs[pi] = D.srvBaseCD;
      }
      continue;
    }
    if (gPhase==='serve_toss' && pi===srv){
      if (TOSS.t > TOSS.dur*0.46 && !tossHit){
        tossHit=true; TOSS.stop(); P[pi].swingT=18; P[pi].jumpVel=4;
        const tx = (Math.random()-0.5)*5;
        const tz = p.side==='near' ? -SVC_Z*0.7 : SVC_Z*0.7;
        const srvSpd = (4 + Math.random()*2) * D.power;
        B.launch(pi, tx, tz, srvSpd, 1.4);
        AudioSys.hit(0.85);
        ParticleSys.sparkBurst(p.x, 1.5, p.z);
        STATS.registerHit(pi, false, true);
        STATS.registerServeSpeed(pi, srvSpd);
        gPhase='rally'; P[pi].serving=false;
        showTossUI(false);
      }
      continue;
    }
    if (gPhase!=='rally' || !B.active) continue;
    const onMySide = p.side==='near' ? B.pos.z>0 : B.pos.z<0;
    const dx = B.pos.x - p.x;
    const baseSpd = Math.abs(dx)>1.5 ? p.sprintSpd : p.speed;
    const spd2 = baseSpd * D.spdMult;
    if (Math.abs(dx)>0.08) p.x += (dx>0?1:-1) * Math.min(Math.abs(dx), spd2*dt);
    p.x = Math.max(-CHW+0.4, Math.min(CHW-0.4, p.x));
    if (aiCDs[pi]>0) aiCDs[pi] -= dt*60;
    if (onMySide && aiCDs[pi]<=0 && B.pos.y<2.2 && p.hitCD<=0){
      const ddx=p.x-B.pos.x, ddz=p.z-B.pos.z;
      const dist = Math.sqrt(ddx*ddx+ddz*ddz);
      if (dist < D.range){
        if (Math.random() < D.missChance){ aiCDs[pi] = D.reactCD*0.6; continue; }
        p.swingT=16; p.hitCD=28;
        const tx = (Math.random()-0.5)*(3+D.aimNoise*2);
        const tz = p.side==='near' ? -(3+Math.random()*5) : (3+Math.random()*5);
        const spd = (4.5+Math.random()*2)*D.power;
        const arcH = 1.4+Math.random()*0.8;
        B.launch(pi, tx, tz, spd, arcH);
        AudioSys.hit(0.6);
        ParticleSys.sparkBurst(p.x, B.pos.y, p.z);
        STATS.registerHit(pi, false, false);
        aiCDs[pi] = D.reactCD;
      }
    }
    if (p.hitCD>0) p.hitCD -= dt*60;
    if (p.swingT>0) p.swingT -= dt*60;
  }
}

function updatePhysics(dt){
  // Jump physics for all active players
  for (let i=0; i<activePL.length; i++){
    const p = P[activePL[i]];
    if (p.jumpVel || p.jumpH > 0){
      p.jumpVel -= 14 * dt;
      p.jumpH += p.jumpVel * dt;
      if (p.jumpH <= 0){ p.jumpH = 0; p.jumpVel = 0; }
    }
  }
}

function updateHumans(dt){
  const p0 = P[0];
  const moving = !!(KEYS.KeyA||KEYS.KeyD||KEYS.KeyW||KEYS.KeyS);
  // Camera-relative movement
  if (moving){
    const cf = camForwardRight();
    const speedMult = p0._buffSpeed ? 1.55 : 1.0;
    const spd = ((KEYS.ShiftLeft||KEYS.ShiftRight) ? p0.sprintSpd : p0.speed) * speedMult;
    let mx=0, mz=0;
    if (KEYS.KeyW){ mx += cf.Fx; mz += cf.Fz; }
    if (KEYS.KeyS){ mx -= cf.Fx; mz -= cf.Fz; }
    if (KEYS.KeyD){ mx += cf.Rx; mz += cf.Rz; }
    if (KEYS.KeyA){ mx -= cf.Rx; mz -= cf.Rz; }
    const ml = Math.hypot(mx, mz);
    if (ml > 0.001){
      mx /= ml; mz /= ml;
      p0.x += mx * spd * dt;
      p0.z += mz * spd * dt;
    }
    p0.walkT += dt * (KEYS.ShiftLeft||KEYS.ShiftRight ? 12 : 8);
  }
  p0.x = Math.max(-CHW+0.4, Math.min(CHW-0.4, p0.x));
  p0.z = Math.max(0.5, Math.min(CHL-0.5, p0.z));
  if (p0.hitCD>0) p0.hitCD -= dt*60;
  if (p0.swingT>0) p0.swingT -= dt*60;
  Footsteps.update(dt, p0, moving);

  if (gMode==='local_1v1'){
    const p1 = P[1];
    const m2 = !!(KEYS.ArrowLeft||KEYS.ArrowRight||KEYS.ArrowUp||KEYS.ArrowDown);
    if (KEYS.ArrowLeft)  p1.x -= p1.speed*dt;
    if (KEYS.ArrowRight) p1.x += p1.speed*dt;
    if (KEYS.ArrowUp)    p1.z += p1.speed*dt*0.7;
    if (KEYS.ArrowDown)  p1.z -= p1.speed*dt*0.7;
    if (m2) p1.walkT += dt*8;
    p1.x = Math.max(-CHW+0.4, Math.min(CHW-0.4, p1.x));
    p1.z = Math.max(-CHL+0.5, Math.min(-0.5, p1.z));
    if (p1.hitCD>0) p1.hitCD -= dt*60;
    if (p1.swingT>0) p1.swingT -= dt*60;
  }

  // Hit ring
  if (gPhase==='rally'){
    const onNear = B.pos.z>0;
    if (humanPL.indexOf(0)>=0){
      const dx=p0.x-B.pos.x, dz=p0.z-B.pos.z;
      const d = Math.sqrt(dx*dx+dz*dz);
      if (onNear && d<5 && B.pos.y<2.2){ if (!ringActive){ ringActive=true; ringR=0.7; } }
      else if (d>6) ringActive=false;
    }
    if (gMode==='local_1v1' && humanPL.indexOf(1)>=0){
      const p1=P[1];
      const dx=p1.x-B.pos.x, dz=p1.z-B.pos.z;
      const d = Math.sqrt(dx*dx+dz*dz);
      if (!onNear && d<5 && B.pos.y<2.2){ if (!ringActive){ ringActive=true; ringR=0.7; } }
    }
  }
}

function syncCharVisuals(){
  for (let i=0; i<activePL.length; i++){
    const pi = activePL[i];
    const p = P[pi];
    const c = chars[pi];
    if (!c) continue;
    c.group.position.set(p.x, p.jumpH || 0, p.z);
    // Face the right way (near players face -z, far face +z)
    c.group.rotation.y = p.side==='near' ? Math.PI : 0;
    // Walking animation (legs swing)
    const walking = (p === P[0] && (KEYS.KeyA||KEYS.KeyD||KEYS.KeyW||KEYS.KeyS)) ||
                    (gMode==='local_1v1' && p === P[1] && (KEYS.ArrowLeft||KEYS.ArrowRight||KEYS.ArrowUp||KEYS.ArrowDown));
    const swing = walking ? Math.sin(p.walkT) * 0.5 : 0;
    const inAir = (p.jumpH || 0) > 0.05;
    if (c.legL){
      if (inAir){ c.legL.rotation.x = -0.4; c.legR.rotation.x = -0.4; }
      else { c.legL.rotation.x =  swing; c.legR.rotation.x = -swing; }
    }
    if (c.armL){ c.armL.rotation.x = inAir ? -0.3 : -swing*0.6; }
    // Right arm swing on hit
    if (c.armR){
      const sw = p.swingT > 0 ? Math.sin((p.swingT/18)*Math.PI) : 0;
      c.armR.rotation.x = -1.2 - sw*1.6;
      c.armR.rotation.z = -0.3 + sw*0.6;
    }
  }
}

// ── Bounce / Net / Endpoint ──────────────────────────
function onBounce(){
  // Audio + particles every bounce, even outside the rally
  const speed = Math.hypot(B.vel.x, B.vel.y, B.vel.z);
  const intensity = Math.min(1, speed / 14);
  AudioSys.bounce(intensity);
  ParticleSys.dustBurst(B.pos.x, B.pos.z);
  FloorMarks.add(B.pos.x, B.pos.z);
  if (gPhase!=='rally') return;
  const onNear = B.pos.z>0;
  const inX = Math.abs(B.pos.x) <= CHW;
  const inZ = Math.abs(B.pos.z) <= CHL;
  if (!inX || !inZ){ endPoint(B.lastHitter<2?1:0, 'out'); return; }
  if (B.bounces>=2) endPoint(onNear?1:0, 'double_bounce');
}
function onNet(){
  AudioSys.net();
  ParticleSys.netHit(B.pos.x);
  if (gPhase!=='rally' && gPhase!=='serve_toss') return;
  endPoint(B.lastHitter<2?1:0, 'net');
}
function endPoint(winner, reason){
  gPhase='point_end'; B.active=false; TOSS.stop(); ringActive=false;
  showServeUI(false); showTossUI(false);
  const msgs = { out:'OUT  ·  P'+(winner+1)+' POINT', net:'NET  ·  P'+(winner+1)+' POINT', double_bounce:'P'+(winner+1)+' POINT' };
  showMsg(msgs[reason] || ('P'+(winner+1)+' POINT'), 1400);
  // Stats tracking
  STATS.finalizePoint(winner, reason, B.lastHitter);
  if (winner === 0) AudioSys.cheer(false);
  AudioSys.score();
  triggerCrowdWave();
  const result = SC.award(winner);
  updateScoreHUD();
  ptTimer=2400;
  if (result && result.msg){
    setTimeout(function(){ showMsg(result.msg, 2000); }, 1000);
    // Big cheer for game/set/match
    if (/GAME|SET|MATCH|WINS/i.test(result.msg)){
      setTimeout(function(){ AudioSys.cheer(true); triggerCrowdWave(); }, 1100);
    }
  }
  checkAchievements({ event: 'point_end', winner: winner, reason: reason });
  if (SC.matchOver){
    setTimeout(function(){
      gPhase='match_over';
      AudioSys.fanfare();
      if (Tournament.isActive()) Tournament.onMatchOver();
      else setTimeout(function(){ MatchSummary.show(); }, 2200);
    }, 2700);
  }
}
function startPoint(){
  const srv = SC.server;
  P[0].x=0; P[0].z=9; P[1].x=0; P[1].z=-9;
  B.reset(srv===0?0:1);
  ringActive=false;
  TOSS.stop(); srvMeter=0; srvDir=1; srvPower=0; tossHit=false;
  gPhase='serve_meter';
  const srvPi = srv===0?0:1;
  P[srvPi].serving=true; P[1-srvPi].serving=false;
  aiCDs[srvPi] = 65;
  showMsg('P'+(srv+1)+' TO SERVE  ·  SET POWER!', 1600);
  if (humanPL.indexOf(srvPi)>=0) showServeUI(true);
  updateScoreHUD();
}
function updateCountdown(dt){
  cdTimer += dt;
  if (cdTimer>=1){ cdTimer=0; cdVal--; if (cdVal<=0) startPoint(); else showMsg(String(cdVal), 900); }
}

// ── Mode setup ────────────────────────────────────────
function setupMode(mode){
  gMode = mode;
  if (mode==='ai_2v2') activePL=[0,1,2,3]; else activePL=[0,1];
  if (mode==='local_1v1') humanPL=[0,1];
  else if (mode==='ai_1v1') humanPL=[0];
  else if (mode==='ai_2v2') humanPL=[0];
  else if (mode==='online') humanPL=[0];
  else humanPL=[0];
  aiPL = activePL.filter(i => humanPL.indexOf(i)<0);
  if (mode==='online') aiPL = [];
  // Show/hide character meshes
  for (let i=0; i<chars.length; i++) chars[i].group.visible = activePL.indexOf(i)>=0;
  setCtrlHint();
}

// ── Public API ────────────────────────────────────────
function startMode(mode, conn, host, diff){
  peerConn = conn || null;
  isHost = !!host;
  DIFF_CUR = (diff && DIFF[diff]) ? DIFF[diff] : DIFF.medium;
  setupMode(mode);
  SC.reset();
  STATS.reset();
  AudioSys.init();
  AudioSys.ensureRunning();
  AudioSys.setCrowdVolume(SETTINGS.muted ? 0 : SETTINGS.crowdLevel);
  applyTheme(SETTINGS.theme);
  document.getElementById('lobby').style.display='none';
  document.getElementById('diff-panel').style.display='none';
  document.getElementById('online-panel').style.display='none';
  const cp = document.getElementById('char-panel'); if (cp) cp.style.display='none';
  const sp = document.getElementById('settings-panel'); if (sp) sp.style.display='none';
  showHUD(true);
  Radar.setVisible(true);
  gPhase='countdown'; cdVal=3; cdTimer=0;
  showMsg('3', 900);
}
function goLobby(){
  gPhase='lobby';
  B.active=false; TOSS.stop();
  showHUD(false); showServeUI(false); showTossUI(false);
  $bigmsg.style.display='none';
  Radar.setVisible(false);
  MatchSummary.hide();
  document.getElementById('diff-panel').style.display='none';
  document.getElementById('online-panel').style.display='none';
  const cp = document.getElementById('char-panel'); if (cp) cp.style.display='none';
  document.getElementById('lobby').style.display='flex';
  FloorMarks.clearAll();
  PowerUps.clearAll();
  ReplaySys.clear();
  Tournament.reset();
}
function onPeerData(d){
  if (d.type==='state'){
    B.pos.set(d.bx, d.by, d.bz); B.vel.set(d.vx, d.vy, d.vz); B.active = d.act;
    P[1].x = d.p2x; P[1].z = d.p2z;
  }
  if (d.type==='hit' && !isHost) B.launch(d.pi, d.tx, d.tz, d.spd, d.arcH);
  if (d.type==='char') { pCharIdx[1] = d.idx; rebuildChar(1); }
}
window.game = { startMode: startMode, goLobby: goLobby, onPeerData: onPeerData };
if (window._pendingMode){
  startMode(window._pendingMode, undefined, undefined, window._pendingDiff);
  window._pendingMode = null; window._pendingDiff = null;
}

// ── Main loop ────────────────────────────────────────
const clock = new THREE.Clock();
let frameN = 0;
function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  frameN++;

  if (gPhase==='lobby'){ updateCamera(); ParticleSys.update(dt); updateCrowd(dt); FloorMarks.update(dt); DayNight.update(dt); renderer.render(scene, camera); return; }

  if (gPhase==='countdown') updateCountdown(dt);

  if (gPhase==='serve_meter'){
    // One-way fill, faster, loops 0→100→0
    srvMeter += 0.022 * (dt*60);
    if (srvMeter >= 1) srvMeter = 0;
    updateServeMeter(srvMeter);
    updateAI(dt);
  }

  if (gPhase==='serve_toss'){
    TOSS.update();
    const tn = TOSS.t/TOSS.dur;
    showTossUI(true, tn);
    updateAI(dt);
  }

  if (gPhase==='rally'){
    updateHumans(dt);
    updateAI(dt);
    B.update(dt);
    updateRing3d();
    if (peerConn && isHost && frameN%3===0){
      try { peerConn.send({type:'state', bx:B.pos.x, by:B.pos.y, bz:B.pos.z, vx:B.vel.x, vy:B.vel.y, vz:B.vel.z, act:B.active, p2x:P[1].x, p2z:P[1].z}); } catch(_){}
    }
  }

  if (gPhase==='point_end'){
    ptTimer -= dt*1000;
    if (ptTimer<=0){ if (SC.matchOver) gPhase='match_over'; else startPoint(); }
  }

  updatePhysics(dt);
  updateCamera();
  syncCharVisuals();
  ParticleSys.update(dt);
  updateCrowd(dt);
  FloorMarks.update(dt);
  DayNight.update(dt);
  PowerUps.update(dt);
  ReplaySys.record();
  ReplaySys.tick();
  if (gPhase === 'practice'){ Practice.update(dt); B.update(dt); }
  refreshReplayBtn();
  Nametags.update();
  Radar.draw();

  if (gPhase==='match_over'){
    showMsg('P'+(SC.winner+1)+' WINS THE MATCH!\n\nClick to return', 99999);
  }

  renderer.render(scene, camera);
}
animate();

// ── UI: lobby + diff + char select + online ──────────
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
  // Open character selection before starting
  openCharSelect(pendingAIMode, d);
}

// Character selection
function openCharSelect(mode, diff){
  const cp = document.getElementById('char-panel');
  if (!cp){ // panel doesn't exist, just start
    selectMode(mode, diff);
    return;
  }
  cp._mode = mode; cp._diff = diff;
  cp.style.display = 'flex';
  // Build cards
  const grid = document.getElementById('char-grid');
  grid.innerHTML = '';
  CHARS.forEach((c, i) => {
    const card = document.createElement('div');
    card.className = 'char-card' + (pCharIdx[0]===i ? ' selected' : '');
    card.style.borderColor = c.col;
    card.innerHTML =
      '<div class="char-prev" style="background:'+c.col+';box-shadow:0 0 30px '+c.col+'66"></div>'+
      '<div class="char-name" style="color:'+c.col+'">'+c.name+'</div>'+
      '<div class="char-info">'+c.hair.toUpperCase()+'</div>';
    card.onclick = () => {
      pCharIdx[0] = i;
      rebuildChar(0);
      [...grid.children].forEach(el => el.classList.remove('selected'));
      card.classList.add('selected');
    };
    grid.appendChild(card);
  });
}
function startFromCharSelect(){
  const cp = document.getElementById('char-panel');
  cp.style.display = 'none';
  selectMode(cp._mode, cp._diff);
}
function backFromCharSelect(){
  document.getElementById('char-panel').style.display = 'none';
  if (pendingAIMode) document.getElementById('diff-panel').style.display = 'flex';
  else document.getElementById('lobby').style.display = 'flex';
}

document.getElementById('m-ai').onclick     = function(){ openDiff('ai_1v1','1V1 VS AI'); };
document.getElementById('m-local').onclick  = function(){ openCharSelect('local_1v1', undefined); };
document.getElementById('m-2v2').onclick    = function(){ openDiff('ai_2v2','2V2 VS AI'); };
document.getElementById('m-online').onclick = function(){ openOnline(); };
document.getElementById('d-easy').onclick   = function(){ pickDiff('easy'); };
document.getElementById('d-med').onclick    = function(){ pickDiff('medium'); };
document.getElementById('d-hard').onclick   = function(){ pickDiff('hard'); };
document.getElementById('d-back').onclick   = function(){ closeDiff(); };
document.getElementById('back-btn').onclick = function(){ goLobby(); };
const _mPractice = document.getElementById('m-practice');
if (_mPractice) _mPractice.onclick = function(){ AudioSys.click(); Practice.start(); };
const _mTournament = document.getElementById('m-tournament');
if (_mTournament) _mTournament.onclick = function(){ AudioSys.click(); Tournament.start(); };

// Replay button (shown after a point ends, hidden during play)
const _replayBtn = document.getElementById('replay-btn');
if (_replayBtn){
  _replayBtn.onclick = function(){
    AudioSys.click();
    if (ReplaySys.isPlaying()) return;
    if (ReplaySys.bufferSize() < 5){ showMsg('Nothing to replay yet', 1000); return; }
    showMsg('▶ REPLAY', 800);
    ReplaySys.startPlayback();
  };
}
function refreshReplayBtn(){
  if (!_replayBtn) return;
  _replayBtn.style.display = (gPhase === 'point_end' || gPhase === 'match_over') ? 'block' : 'none';
}

// ── Settings panel wireup ────────────────────────────
function setToggle(id, on){
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('on', !!on);
}
function openSettings(){
  AudioSys.click();
  document.getElementById('settings-panel').style.display = 'flex';
  // Reflect current state
  setToggle('s-sound',   !SETTINGS.muted);
  setToggle('s-shadows', SETTINGS.shadows);
  document.getElementById('s-crowd').value = Math.round(SETTINGS.crowdLevel * 100);
  document.querySelectorAll('#s-themes .theme-card').forEach(function(c){
    c.classList.toggle('selected', c.getAttribute('data-th') === SETTINGS.theme);
  });
}
function closeSettings(){
  AudioSys.click();
  document.getElementById('settings-panel').style.display = 'none';
}
document.getElementById('t-settings').onclick = openSettings;
document.getElementById('s-close').onclick    = closeSettings;
document.getElementById('s-sound').onclick    = function(){
  SETTINGS.muted = !SETTINGS.muted;
  setToggle('s-sound', !SETTINGS.muted);
  SETTINGS.apply(); SETTINGS.save();
  if (!SETTINGS.muted) AudioSys.click();
};
document.getElementById('s-shadows').onclick  = function(){
  SETTINGS.shadows = !SETTINGS.shadows;
  setToggle('s-shadows', SETTINGS.shadows);
  SETTINGS.apply(); SETTINGS.save();
  AudioSys.click();
};
document.getElementById('s-crowd').oninput = function(e){
  SETTINGS.crowdLevel = (+e.target.value) / 100;
  SETTINGS.apply(); SETTINGS.save();
};
document.querySelectorAll('#s-themes .theme-card').forEach(function(c){
  c.onclick = function(){
    AudioSys.click();
    SETTINGS.theme = c.getAttribute('data-th');
    document.querySelectorAll('#s-themes .theme-card').forEach(function(o){ o.classList.remove('selected'); });
    c.classList.add('selected');
    applyTheme(SETTINGS.theme);
    SETTINGS.save();
  };
});

// ── Stats panel wireup ───────────────────────────────
function refreshStatsHUD(){
  function set(id, v){ const e = document.getElementById(id); if (e) e.textContent = v; }
  set('st-aces-0',  STATS.aces[0]);
  set('st-aces-1',  STATS.aces[1]);
  set('st-win-0',   STATS.winners[0]);
  set('st-win-1',   STATS.winners[1]);
  set('st-err-0',   STATS.errors[0]);
  set('st-err-1',   STATS.errors[1]);
  set('st-smash-0', STATS.totalSmashes[0]);
  set('st-smash-1', STATS.totalSmashes[1]);
  set('st-spd-0',   STATS.fastestServeKmh[0] + ' km/h');
  set('st-spd-1',   STATS.fastestServeKmh[1] + ' km/h');
  set('st-rally',   STATS.longestRally + ' shots');
}
document.getElementById('t-stats').onclick = function(){
  AudioSys.click();
  refreshStatsHUD();
  document.getElementById('stats-panel').style.display = 'flex';
};
document.getElementById('st-close').onclick = function(){
  AudioSys.click();
  document.getElementById('stats-panel').style.display = 'none';
};

// ── Tutorial toggle ──────────────────────────────────
let tutOn = false;
document.getElementById('t-tutorial').onclick = function(){
  AudioSys.click();
  tutOn = !tutOn;
  document.getElementById('tutorial').style.display = tutOn ? 'block' : 'none';
};

// Apply settings at startup
SETTINGS.apply();
applyTheme(SETTINGS.theme);
Nametags.setup();

// Hide corner tools while on game-over screen so they don't overlap the message
function setCornerToolsVisible(v){
  document.getElementById('corner-tools').style.display = v ? 'flex' : 'none';
}
setCornerToolsVisible(true);

// Sound on lobby card hovers
document.querySelectorAll('#lobby .card, .dcard, .char-card').forEach(function(el){
  el.addEventListener('mouseenter', function(){ AudioSys.click(); });
});

const cgo = document.getElementById('c-go');
const cback = document.getElementById('c-back');
if (cgo) cgo.onclick = startFromCharSelect;
if (cback) cback.onclick = backFromCharSelect;

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
  if (myPeer && !pConn){ try{myPeer.destroy();}catch(_){} myPeer=null; }
}
function swTab(t){
  document.getElementById('hv').style.display = t==='h'?'flex':'none';
  document.getElementById('jv').style.display = t==='j'?'flex':'none';
  document.getElementById('t-h').className = 'tab' + (t==='h'?' on':'');
  document.getElementById('t-j').className = 'tab' + (t==='j'?' on':'');
  if (t==='j' && myPeer){ try{myPeer.destroy();}catch(_){} myPeer=null; pConn=null; }
  if (t==='h') initHost();
}
function setSt(id, msg, cls){
  const e = document.getElementById(id);
  e.textContent = msg; e.className='st'+(cls?' '+cls:'');
}
function genCode(){
  const chars='ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s='spk-';
  for (let i=0; i<6; i++) s+=chars[Math.floor(Math.random()*chars.length)];
  return s;
}
function initHost(){
  document.getElementById('rcode').textContent='– – – –';
  setSt('hst','Connecting…','');
  if (myPeer){ try{myPeer.destroy();}catch(_){} myPeer=null; pConn=null; }
  let attempts=0;
  function tryCreate(){
    if (typeof Peer==='undefined'){ setTimeout(tryCreate,300); return; }
    if (attempts++>5){ setSt('hst','Could not get a code. Refresh.','err'); return; }
    const code=genCode();
    myPeer=new Peer(code);
    myPeer.on('open', function(id){
      document.getElementById('rcode').textContent = id.replace('spk-','').toUpperCase();
      setSt('hst','Waiting for opponent…','');
    });
    myPeer.on('connection', function(conn){
      pConn=conn;
      setSt('hst','Opponent connected! Starting…','ok');
      conn.on('open', function(){
        conn.on('data', function(d){ if(window.game) window.game.onPeerData(d); });
        try { conn.send({type:'char', idx:pCharIdx[0]}); } catch(_){}
      });
      setTimeout(function(){
        document.getElementById('online-panel').style.display='none';
        startMode('online', conn, true);
      }, 1200);
    });
    myPeer.on('error', function(e){
      if (e.type==='unavailable-id'){ try{myPeer.destroy();}catch(_){} tryCreate(); return; }
      setSt('hst','Connection error ('+e.type+'). Try refreshing.','err');
    });
  }
  tryCreate();
}
function joinRoom(){
  const inp = document.getElementById('jin');
  const raw = (inp.value||'').trim().toUpperCase();
  if (raw.length<4){ setSt('jst','Enter a valid code','err'); return; }
  const code = 'spk-'+raw;
  setSt('jst','Connecting…','');
  if (myPeer){ try{myPeer.destroy();}catch(_){} myPeer=null; }
  function tryJoin(){
    if (typeof Peer==='undefined'){ setTimeout(tryJoin,300); return; }
    myPeer = new Peer();
    myPeer.on('open', function(){
      pConn = myPeer.connect(code, {reliable:true});
      pConn.on('open', function(){
        setSt('jst','Connected! Starting…','ok');
        pConn.on('data', function(d){ if(window.game) window.game.onPeerData(d); });
        try { pConn.send({type:'char', idx:pCharIdx[0]}); } catch(_){}
        setTimeout(function(){
          document.getElementById('online-panel').style.display='none';
          startMode('online', pConn, false);
        }, 1200);
      });
      pConn.on('error', function(){ setSt('jst','Could not connect. Check the code.','err'); });
    });
    myPeer.on('error', function(e){
      if (e.type==='peer-unavailable'){ setSt('jst','Room not found. Check the code.','err'); return; }
      setSt('jst','Error: '+e.type+'. Try again.','err');
    });
  }
  tryJoin();
}

document.getElementById('t-h').onclick = function(){ swTab('h'); };
document.getElementById('t-j').onclick = function(){ swTab('j'); };
document.getElementById('o-cancel-h').onclick = function(){ closeOnline(true); };
document.getElementById('o-cancel-j').onclick = function(){ closeOnline(true); };
document.getElementById('o-join').onclick = function(){ joinRoom(); };
document.getElementById('jin').addEventListener('input', function(e){
  e.target.value = e.target.value.toUpperCase();
});

// Initial visibility
chars[2].group.visible = false;
chars[3].group.visible = false;

// Show lobby (game.js loaded successfully)
document.getElementById('lobby').style.display = 'flex';

})();
