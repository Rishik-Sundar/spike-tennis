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

  // Court surface (blue hard court)
  const surf = new THREE.Mesh(
    new THREE.PlaneGeometry(CW, CL),
    new THREE.MeshStandardMaterial({ color: 0x0a5ab4, roughness: 0.7, metalness: 0.05 })
  );
  surf.rotation.x = -Math.PI/2;
  surf.receiveShadow = true;
  scene.add(surf);

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
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.07, len), neonMat);
    m.position.set((x1+x2)/2, 0.035, (z1+z2)/2);
    m.rotation.y = Math.atan2(x2-x1, z2-z1);
    scene.add(m);
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
  { name:'BLAZE', col:'#ff5050', hair:'spike', hairCol:'#220a05', skin:'#d4956a' },
  { name:'AZURE', col:'#00b4ff', hair:'short', hairCol:'#1a1428', skin:'#f0c090' },
  { name:'NEON',  col:'#b2ff14', hair:'cap',   hairCol:'#003040', skin:'#a07050' },
  { name:'STORM', col:'#a050ff', hair:'long',  hairCol:'#1a0828', skin:'#d4956a' },
  { name:'FROST', col:'#80fff0', hair:'short', hairCol:'#102030', skin:'#f8d8b0' },
  { name:'EMBER', col:'#ff9632', hair:'spike', hairCol:'#3a1a05', skin:'#b08060' },
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
  launch(fromPi, tx, tz, speed, arcH){
    const cg = chars[fromPi].group;
    this.pos.set(cg.position.x, 1.2, cg.position.z + (fromPi<2?-0.4:0.4));
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

// ── Camera (Roblox-style orbit) ───────────────────────
// Target is a point ~3 units in front of P1 toward the net,
// so when yaw=0 the camera sits behind P1 and shows the court ahead.
const CAM = { yaw:0, pitch:0.42, dist:9.0, tx:0, ty:1.4, tz:6 };
function updateCamera(){
  const p0 = P[0];
  // Target = midway between P1 and the net (P1 always has z>=0.5)
  const tgtX = p0.x * 0.6;
  const tgtY = 1.3 + (p0.jumpH||0)*0.3;
  const tgtZ = Math.max(0, p0.z - 3);  // 3 units in front of P1 toward net (clamped)
  CAM.tx += (tgtX - CAM.tx) * 0.12;
  CAM.ty += (tgtY - CAM.ty) * 0.08;
  CAM.tz += (tgtZ - CAM.tz) * 0.12;
  const sy = Math.sin(CAM.yaw),  cy = Math.cos(CAM.yaw);
  const sp = Math.sin(CAM.pitch), cp = Math.cos(CAM.pitch);
  camera.position.set(
    CAM.tx + CAM.dist*cp*sy,
    CAM.ty + CAM.dist*sp,
    CAM.tz + CAM.dist*cp*cy   // yaw=0 → camera at +z (behind P1, since P1 is at +z)
  );
  camera.lookAt(CAM.tx, CAM.ty, CAM.tz);
}
function initCamera(){
  CAM.tx = 0; CAM.ty = 1.4; CAM.tz = 6;
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
  return { Fx:Fx, Fz:Fz, Rx:Fz, Rz:-Fx };
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
  const zone = v>0.4&&v<0.6?'PERFECT!':v>0.25&&v<0.75?'GOOD':'WEAK';
  const col  = v>0.4&&v<0.6?'#60ff80':v>0.25&&v<0.75?'#ffdc32':'#ff5050';
  document.getElementById('meter-zone').textContent = zone;
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
  p.jumpVel = 5.4;
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
}
function doServeHit(pi){
  if (tossHit) return;
  const tn = TOSS.t/TOSS.dur, dev = Math.abs(tn-0.5);
  const timing = Math.max(0, 1 - dev*3.0);
  const quality = srvPower*0.5 + timing*0.5;
  tossHit=true; TOSS.stop();
  P[pi].swingT=22; P[pi].jumpVel = 4.5;
  showTossUI(false);
  const txR = (mX/innerWidth)*2 - 1;
  const tx = txR * 3.5;
  const tz = P[pi].side==='near' ? -SVC_Z*0.65 : SVC_Z*0.65;
  B.launch(pi, tx, tz, 5+quality*6, 1.5);
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
  // Auto-smash when jumping AND ball is high — natural smash mechanic
  const isSmash = (p.jumpH > 0.25) && (B.pos.y > 1.7);
  let arcH=1.6, spd=5.5;
  if (isSmash){ arcH=0.4; spd=10.5; }
  else if (KEYS.KeyQ){ arcH=2.2; spd=4.5; }
  else if (KEYS.KeyE){ arcH=1.0; spd=4.5; }
  else if (KEYS.KeyR){ arcH=5.0; spd=3.5; }
  else if (KEYS.KeyG){ arcH=0.7; spd=8.0; }
  spd *= 0.7 + q*0.58;
  B.launch(pi, tx, tz, spd, arcH);
  if (isSmash) showMsg('🔥 SMASH!', 700);
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
        srvPower = (D.power<1?0.40:D.power>1.1?0.85:0.65) + Math.random()*0.18;
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
    const spd = (KEYS.ShiftLeft||KEYS.ShiftRight) ? p0.sprintSpd : p0.speed;
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
  if (gPhase!=='rally') return;
  const onNear = B.pos.z>0;
  const inX = Math.abs(B.pos.x) <= CHW;
  const inZ = Math.abs(B.pos.z) <= CHL;
  if (!inX || !inZ){ endPoint(B.lastHitter<2?1:0, 'out'); return; }
  if (B.bounces>=2) endPoint(onNear?1:0, 'double_bounce');
}
function onNet(){
  if (gPhase!=='rally' && gPhase!=='serve_toss') return;
  endPoint(B.lastHitter<2?1:0, 'net');
}
function endPoint(winner, reason){
  gPhase='point_end'; B.active=false; TOSS.stop(); ringActive=false;
  showServeUI(false); showTossUI(false);
  const msgs = { out:'OUT  ·  P'+(winner+1)+' POINT', net:'NET  ·  P'+(winner+1)+' POINT', double_bounce:'P'+(winner+1)+' POINT' };
  showMsg(msgs[reason] || ('P'+(winner+1)+' POINT'), 1400);
  const result = SC.award(winner);
  updateScoreHUD();
  ptTimer=2400;
  if (result && result.msg) setTimeout(()=>showMsg(result.msg, 2000), 1000);
  if (SC.matchOver) setTimeout(()=>{ gPhase='match_over'; }, 2700);
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
  document.getElementById('lobby').style.display='none';
  document.getElementById('diff-panel').style.display='none';
  document.getElementById('online-panel').style.display='none';
  const cp = document.getElementById('char-panel'); if (cp) cp.style.display='none';
  showHUD(true);
  gPhase='countdown'; cdVal=3; cdTimer=0;
  showMsg('3', 900);
}
function goLobby(){
  gPhase='lobby';
  B.active=false; TOSS.stop();
  showHUD(false); showServeUI(false); showTossUI(false);
  $bigmsg.style.display='none';
  document.getElementById('diff-panel').style.display='none';
  document.getElementById('online-panel').style.display='none';
  const cp = document.getElementById('char-panel'); if (cp) cp.style.display='none';
  document.getElementById('lobby').style.display='flex';
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

  if (gPhase==='lobby'){ updateCamera(); renderer.render(scene, camera); return; }

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
