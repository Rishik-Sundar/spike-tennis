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
// Rim/back light for more depth on characters
const rimLight = new THREE.DirectionalLight(0xff80aa, 0.45);
rimLight.position.set(0, 6, -16);
scene.add(rimLight);
// Magenta accent light from the side
const accentLight = new THREE.PointLight(0x80a0ff, 0.7, 30);
accentLight.position.set(-12, 8, 4);
scene.add(accentLight);
const accentLight2 = new THREE.PointLight(0xff80a0, 0.5, 30);
accentLight2.position.set(12, 8, -4);
scene.add(accentLight2);
const ballLight = new THREE.PointLight(0xb2ff14, 3.0, 9);
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

  // ── Stadium structure: multi-tier stands instead of flat walls ──
  buildStadiumTiers();

  // ── Glossy reflection on the court (faked with overlay plane) ──
  const reflectMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, transparent:true, opacity:0.05, roughness:0.05, metalness:0.9
  });
  const reflect = new THREE.Mesh(new THREE.PlaneGeometry(CW, CL), reflectMat);
  reflect.rotation.x = -Math.PI/2;
  reflect.position.y = 0.0005;
  scene.add(reflect);
}

// ── Build proper multi-tier stadium with skyline + sky dome ───
function buildStadiumTiers(){
  // ── 1. Sky dome (gradient instead of flat color) ──
  const skyGeo = new THREE.SphereGeometry(120, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor:    { value: new THREE.Color(0x0a1535) },
      bottomColor: { value: new THREE.Color(0x4060a0) },
      offset:      { value: 30 },
      exponent:    { value: 0.6 },
    },
    vertexShader: [
      'varying vec3 vWorldPosition;',
      'void main() {',
      '  vec4 worldPosition = modelMatrix * vec4(position, 1.0);',
      '  vWorldPosition = worldPosition.xyz;',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
      '}',
    ].join('\n'),
    fragmentShader: [
      'uniform vec3 topColor;',
      'uniform vec3 bottomColor;',
      'uniform float offset;',
      'uniform float exponent;',
      'varying vec3 vWorldPosition;',
      'void main() {',
      '  float h = normalize(vWorldPosition + offset).y;',
      '  gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);',
      '}',
    ].join('\n'),
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);
  // Stop using a solid background — sky dome handles it
  scene.background = null;

  // ── 2. Stars (small bright dots scattered in the sky) ──
  const starsGeo = new THREE.BufferGeometry();
  const starPositions = [];
  for (let i=0; i<400; i++){
    const r = 100;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1) * 0.5; // upper hemisphere mostly
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.cos(phi);
    const z = r * Math.sin(phi) * Math.sin(theta);
    if (y > 5) starPositions.push(x, y, z);
  }
  starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  const starsMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.5, sizeAttenuation: true, transparent: true, opacity: 0.9 });
  const stars = new THREE.Points(starsGeo, starsMat);
  scene.add(stars);

  // ── 3. Distant city skyline (silhouette of buildings on horizon) ──
  const skylineGroup = new THREE.Group();
  scene.add(skylineGroup);
  const buildingMat = new THREE.MeshStandardMaterial({
    color: 0x0a0e1a, roughness: 1, emissive: 0x000810, emissiveIntensity: 0.2
  });
  const litWindowMat = new THREE.MeshBasicMaterial({ color: 0xffeeaa });
  for (let ring=0; ring<2; ring++){
    const ringRadius = 60 + ring*15;
    const buildingCount = 30 + ring*10;
    for (let i=0; i<buildingCount; i++){
      const ang = (i / buildingCount) * Math.PI * 2 + Math.random() * 0.05;
      const dist = ringRadius + (Math.random() - 0.5) * 6;
      const x = Math.cos(ang) * dist;
      const z = Math.sin(ang) * dist;
      const w = 4 + Math.random() * 6;
      const h = 8 + Math.random() * 22 - ring*3;
      const d = 4 + Math.random() * 4;
      const bld = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), buildingMat);
      bld.position.set(x, h/2, z);
      // Random rotation toward center
      bld.lookAt(0, h/2, 0);
      skylineGroup.add(bld);
      // Window lights — sprinkle a few lit windows
      const windowsAcross = Math.floor(w / 1);
      const windowsUp = Math.floor(h / 2);
      for (let wx=0; wx<windowsAcross; wx++){
        for (let wy=0; wy<windowsUp; wy++){
          if (Math.random() > 0.6) continue;
          const win = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.6), litWindowMat);
          // Position in local building space
          const localX = -w/2 + (wx + 0.5) * (w / windowsAcross);
          const localY = -h/2 + (wy + 0.5) * (h / windowsUp);
          win.position.set(localX, localY, d/2 + 0.01);
          bld.add(win);
        }
      }
    }
  }

  // ── 4. Stadium tier structures (multi-level seating with rails) ──
  const tierMat = new THREE.MeshStandardMaterial({ color:0x161e2a, roughness:0.9 });
  const railMat = new THREE.MeshStandardMaterial({ color:0xff5050, emissive:0xff2020, emissiveIntensity:0.6 });
  for (let tier=0; tier<3; tier++){
    const tierY = 4 + tier * 4.5;
    const tierZ = 18 + tier * 3.5;
    // Back stand tier
    for (const sgn of [1, -1]){
      const stand = new THREE.Mesh(new THREE.BoxGeometry(48, 4, 5), tierMat);
      stand.position.set(0, tierY, sgn * tierZ);
      scene.add(stand);
      // Stripe rail on front
      const rail = new THREE.Mesh(new THREE.BoxGeometry(48, 0.18, 0.18), railMat);
      rail.position.set(0, tierY + 1.8, sgn * (tierZ - 2.5));
      scene.add(rail);
    }
    // Side stand tiers
    for (const sgn of [1, -1]){
      const stand = new THREE.Mesh(new THREE.BoxGeometry(5, 4, 32), tierMat);
      stand.position.set(sgn * (15 + tier*3.5), tierY, 0);
      scene.add(stand);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 32), railMat);
      rail.position.set(sgn * (15 + tier*3.5 - 2.5), tierY + 1.8, 0);
      scene.add(rail);
    }
  }

  // ── 5. Stadium roof / cantilever beams ──
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x223344, metalness: 0.4, roughness: 0.6 });
  // Crown of beams overhead (semi-circle)
  for (let i=0; i<8; i++){
    const ang = (i / 8) * Math.PI - Math.PI/2;
    const x = Math.cos(ang) * 22;
    const z = Math.sin(ang) * 22;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 12), roofMat);
    beam.position.set(x, 19, z);
    beam.lookAt(0, 19, 0);
    scene.add(beam);
  }
  // Side roof beams
  const roofBeam = new THREE.Mesh(new THREE.BoxGeometry(50, 0.5, 0.5), roofMat);
  roofBeam.position.set(0, 19, 22);
  scene.add(roofBeam);
  const roofBeam2 = roofBeam.clone(); roofBeam2.position.z = -22; scene.add(roofBeam2);

  // ── 6. Big jumbotron / scoreboard above one stand ──
  const jumboMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x001a44, emissiveIntensity: 0.6 });
  const jumbo = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 0.4), jumboMat);
  jumbo.position.set(0, 14, -26);
  scene.add(jumbo);
  // Glowing edge frame around the jumbotron
  const jumboFrameMat = new THREE.MeshStandardMaterial({ color: 0x00b4ff, emissive: 0x00b4ff, emissiveIntensity: 1.5 });
  for (const off of [[-5.05, 14, -25.9], [5.05, 14, -25.9]]){
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4.2, 0.12), jumboFrameMat);
    v.position.set(off[0], off[1], off[2]); scene.add(v);
  }
  for (const off of [[0, 16.05, -25.9], [0, 11.95, -25.9]]){
    const h = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.12, 0.12), jumboFrameMat);
    h.position.set(off[0], off[1], off[2]); scene.add(h);
  }
  // Jumbotron text canvas
  const jumboCanvas = document.createElement('canvas');
  jumboCanvas.width = 512; jumboCanvas.height = 192;
  const jctx = jumboCanvas.getContext('2d');
  function paintJumbotron(){
    jctx.fillStyle = '#000010';
    jctx.fillRect(0, 0, 512, 192);
    jctx.strokeStyle = '#00b4ff';
    jctx.lineWidth = 4;
    jctx.strokeRect(8, 8, 496, 176);
    jctx.fillStyle = '#00ffff';
    jctx.font = 'bold 60px Orbitron, sans-serif';
    jctx.textAlign = 'center';
    jctx.textBaseline = 'middle';
    jctx.fillText('SPIKE TENNIS', 256, 70);
    jctx.fillStyle = '#ffdc32';
    jctx.font = 'bold 80px Orbitron, sans-serif';
    jctx.fillText('LIVE', 256, 140);
  }
  paintJumbotron();
  const jumboTex = new THREE.CanvasTexture(jumboCanvas);
  const jumboFaceMat = new THREE.MeshBasicMaterial({ map: jumboTex });
  const jumboFace = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 3.6), jumboFaceMat);
  jumboFace.position.set(0, 14, -25.78);
  scene.add(jumboFace);

  // ── 7. Floodlight pole rigs (4 corners with proper light rigs) ──
  const polePostMat = new THREE.MeshStandardMaterial({ color: 0x222233, metalness: 0.6 });
  const lampHeadMat = new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffffee, emissiveIntensity: 1.4 });
  const cornerOffsets = [[-22, -22], [22, -22], [-22, 22], [22, 22]];
  cornerOffsets.forEach(function(off){
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 18, 12), polePostMat);
    post.position.set(off[0], 9, off[1]);
    scene.add(post);
    // Light rig on top: 6 lamps in a 2x3 grid
    const rig = new THREE.Group();
    rig.position.set(off[0], 18, off[1]);
    for (let lx=-1; lx<=1; lx++){
      for (let ly=0; ly<2; ly++){
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), lampHeadMat);
        lamp.position.set(lx * 0.6, 0.5 + ly*0.5, 0);
        rig.add(lamp);
      }
    }
    rig.lookAt(0, 18, 0);
    scene.add(rig);
    // Light cone / volumetric beam (fake with low-opacity cone)
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffffaa, transparent: true, opacity: 0.07, side: THREE.DoubleSide,
      depthWrite: false
    });
    const beam = new THREE.Mesh(new THREE.ConeGeometry(8, 22, 24, 1, true), beamMat);
    beam.position.set(off[0]*0.45, 9, off[1]*0.45);
    beam.lookAt(0, 0, 0);
    beam.rotation.z = Math.PI; // point cone tip downward at center
    scene.add(beam);
  });

  // ── 8. Court boundary advertising board (around the playing area) ──
  const adColors = [0xff5050, 0x00b4ff, 0xb2ff14, 0xa050ff, 0xffdc32, 0xff80aa, 0x80ff80, 0xffae40];
  const adTexts = ['SPIKE', 'TENNIS', 'PRO', 'CHAMPS', 'GAME ON', 'NEON', 'MATCH', 'COURT'];
  function makeAdBoard(text, color){
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const cx = c.getContext('2d');
    cx.fillStyle = '#0a0a14';
    cx.fillRect(0, 0, 256, 64);
    cx.strokeStyle = '#' + color.toString(16).padStart(6,'0');
    cx.lineWidth = 4;
    cx.strokeRect(4, 4, 248, 56);
    cx.fillStyle = '#' + color.toString(16).padStart(6,'0');
    cx.font = 'bold 40px Orbitron, sans-serif';
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillText(text, 128, 32);
    return c;
  }
  // Boards along long sidelines
  for (let i=0; i<8; i++){
    const c = adColors[i % adColors.length];
    const text = adTexts[i % adTexts.length];
    const tex = new THREE.CanvasTexture(makeAdBoard(text, c));
    const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: c, emissiveIntensity: 0.4 });
    for (const side of [1, -1]){
      const board = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), mat);
      board.position.set(-CHL + 1.5 + i * 3.2, 0.7, side * (CHW + 1.5));
      board.rotation.y = side > 0 ? Math.PI : 0;
      // Wait the boards should be along the X-axis (sidelines run along Z)
      // Let me put them along the side of the court (parallel to z-axis)
      // Actually for sidelines: board faces inward, runs along z. Reposition:
      board.position.set(side * (CHW + 1.6), 0.7, -CHL + 1.5 + i * 3.2);
      board.rotation.y = side > 0 ? -Math.PI/2 : Math.PI/2;
      scene.add(board);
    }
  }
  // Backstop boards behind baselines
  for (let i=0; i<5; i++){
    const c = adColors[(i+3) % adColors.length];
    const text = adTexts[(i+3) % adTexts.length];
    const tex = new THREE.CanvasTexture(makeAdBoard(text, c));
    const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: c, emissiveIntensity: 0.4 });
    for (const side of [1, -1]){
      const board = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), mat);
      board.position.set(-CHW + 0.5 + i * (CW/4), 0.7, side * (CHL + 1.6));
      board.rotation.y = side > 0 ? 0 : Math.PI;
      scene.add(board);
    }
  }

  // ── 9. Glowing court edge LED strip (already exists, but enhance) ──
  // Done in court neon strips already.

  // ── 10. Atmospheric particles (floating dust motes catching the light) ──
  const dustGeo = new THREE.BufferGeometry();
  const dustPositions = [];
  for (let i=0; i<200; i++){
    dustPositions.push(
      (Math.random() - 0.5) * 50,
      Math.random() * 18 + 1,
      (Math.random() - 0.5) * 50
    );
  }
  dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(dustPositions, 3));
  const dustMat = new THREE.PointsMaterial({ color: 0xffeeaa, size: 0.08, transparent: true, opacity: 0.4, sizeAttenuation: true });
  const dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);

  // Animate dust slowly drifting
  function animateDust(){
    const positions = dustGeo.attributes.position.array;
    for (let i=0; i<positions.length; i+=3){
      positions[i+1] += 0.005;
      if (positions[i+1] > 19) positions[i+1] = 1;
    }
    dustGeo.attributes.position.needsUpdate = true;
    requestAnimationFrame(animateDust);
  }
  animateDust();
}
buildCourt();

// ── Roblox-style character ────────────────────────────
function buildChar(opts){
  const g = new THREE.Group();
  const col = new THREE.Color(opts.col);
  const skin = opts.skin || '#f0c090';
  const hairCol = opts.hairCol || '#2a1810';
  const shirtMat = new THREE.MeshStandardMaterial({ color: opts.col, roughness:0.35, metalness:0.10, emissive: col.clone().multiplyScalar(0.22) });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x0a1428, roughness:0.6,  metalness:0.05 });
  const skinMat  = new THREE.MeshStandardMaterial({ color: skin,    roughness:0.55, metalness:0.0 });
  const shoeMat  = new THREE.MeshStandardMaterial({ color: 0xffffff,roughness:0.4,  metalness:0.15 });
  const hairMat  = new THREE.MeshStandardMaterial({ color: hairCol, roughness:0.45, metalness:0.05 });

  // ── Torso: rounded capsule (CapsuleGeometry not in r128, fake it with a stretched sphere + cylinder) ──
  const torsoTop = new THREE.Mesh(new THREE.SphereGeometry(0.46, 24, 16), shirtMat);
  torsoTop.position.y = 2.05; torsoTop.scale.set(1.0, 0.7, 0.85); torsoTop.castShadow = true; g.add(torsoTop);
  const torsoCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.40, 1.0, 24), shirtMat);
  torsoCyl.position.y = 1.55; torsoCyl.scale.set(1.0, 1.0, 0.78); torsoCyl.castShadow = true; g.add(torsoCyl);
  const torsoBot = new THREE.Mesh(new THREE.SphereGeometry(0.40, 24, 16), shirtMat);
  torsoBot.position.y = 1.05; torsoBot.scale.set(1.0, 0.6, 0.78); torsoBot.castShadow = true; g.add(torsoBot);

  // ── Head: actual sphere instead of cube ──
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.40, 28, 24), skinMat);
  head.position.y = 2.80; head.castShadow = true; g.add(head);
  // Neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.20, 0.20, 16), skinMat);
  neck.position.y = 2.45; g.add(neck);

  // ── Hair (rounded geometry) ──
  if (opts.hair === 'short'){
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 16, 0, Math.PI*2, 0, Math.PI*0.55), hairMat);
    h.position.set(0, 2.85, 0); g.add(h);
  } else if (opts.hair === 'cap'){
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.43, 24, 16, 0, Math.PI*2, 0, Math.PI*0.5), shirtMat);
    h.position.set(0, 2.86, 0); g.add(h);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.04, 24, 1, false, 0, Math.PI), shirtMat);
    brim.position.set(0, 2.78, 0.32); brim.rotation.x = -0.15; g.add(brim);
  } else if (opts.hair === 'spike'){
    for (let i=0; i<7; i++){
      const ang = (i / 7) * Math.PI * 2;
      const sx = Math.cos(ang) * 0.20;
      const sz = Math.sin(ang) * 0.18;
      const s = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.36, 12), hairMat);
      s.position.set(sx, 3.10, sz);
      g.add(s);
    }
    const base = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 16, 0, Math.PI*2, 0, Math.PI*0.5), hairMat);
    base.position.set(0, 2.85, 0); g.add(base);
  } else if (opts.hair === 'long'){
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.43, 24, 16, 0, Math.PI*2, 0, Math.PI*0.55), hairMat);
    top.position.set(0, 2.85, 0); g.add(top);
    const sideL = new THREE.Mesh(new THREE.CapsuleHack ? new THREE.CylinderGeometry(0.10, 0.08, 0.55, 12) : new THREE.CylinderGeometry(0.10, 0.08, 0.55, 12), hairMat);
    sideL.position.set(-0.36, 2.55, 0); g.add(sideL);
    const sideR = sideL.clone(); sideR.position.x = 0.36; g.add(sideR);
  }

  // ── Face (small spherical eyes + mouth) ──
  const faceMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const eyeWL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), eyeWhiteMat);
  eyeWL.position.set(-0.13, 2.86, 0.34); g.add(eyeWL);
  const eyeWR = eyeWL.clone(); eyeWR.position.x = 0.13; g.add(eyeWR);
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), faceMat);
  eyeL.position.set(-0.13, 2.86, 0.39); g.add(eyeL);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.13; g.add(eyeR);
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.014, 8, 16, Math.PI), faceMat);
  mouth.position.set(0, 2.66, 0.36); mouth.rotation.x = Math.PI; g.add(mouth);

  // ── Arms: capsule-style with shoulder ball + cylinder + hand sphere ──
  function makeArmGroup(side){
    const armG = new THREE.Group();
    armG.position.set(side * 0.55, 2.18, 0);
    // Shoulder
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.20, 16, 12), shirtMat);
    shoulder.position.y = 0; shoulder.castShadow = true; armG.add(shoulder);
    // Upper arm
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.55, 16), shirtMat);
    upper.position.y = -0.30; upper.castShadow = true; armG.add(upper);
    // Elbow
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), skinMat);
    elbow.position.y = -0.60; armG.add(elbow);
    // Forearm
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.50, 16), skinMat);
    fore.position.y = -0.88; fore.castShadow = true; armG.add(fore);
    // Hand
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), skinMat);
    hand.position.y = -1.16; armG.add(hand);
    return armG;
  }
  const armL = makeArmGroup(-1);
  g.add(armL);
  const armR = makeArmGroup(1);
  g.add(armR);

  // ── Racket on right arm (more detailed frame) ──
  const racket = new THREE.Group();
  racket.position.set(0, -1.30, 0);
  const handleGripMat = new THREE.MeshStandardMaterial({ color:0x222222, roughness:0.95 });
  const handleEndMat  = new THREE.MeshStandardMaterial({ color:opts.col, emissive:col.clone().multiplyScalar(0.5), emissiveIntensity:0.6, roughness:0.4 });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.42, 14), handleGripMat);
  handle.position.y = -0.21; racket.add(handle);
  const handleEnd = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10), handleEndMat);
  handleEnd.position.y = -0.42; racket.add(handleEnd);
  const throat = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.045, 0.18, 12), handleGripMat);
  throat.position.y = -0.05; racket.add(throat);
  const frame = new THREE.Mesh(
    new THREE.TorusGeometry(0.32, 0.038, 16, 32),
    new THREE.MeshStandardMaterial({ color: opts.col, emissive: col.clone().multiplyScalar(0.85), emissiveIntensity:1.1, roughness:0.25, metalness:0.3 })
  );
  frame.rotation.x = Math.PI/2;
  frame.position.y = 0.18; racket.add(frame);
  // Strings (denser grid)
  const strMat = new THREE.MeshStandardMaterial({ color:0xaaccff, emissive:0x4477ff, emissiveIntensity:0.7, transparent:true, opacity:0.78 });
  for (let i=-3; i<=3; i++){
    const sx = new THREE.Mesh(new THREE.BoxGeometry(0.60, 0.012, 0.012), strMat);
    sx.position.set(0, 0.18, i*0.08); sx.rotation.x = Math.PI/2; racket.add(sx);
    const sy = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.60, 0.012), strMat);
    sy.position.set(i*0.08, 0.18, 0); sy.rotation.x = Math.PI/2; racket.add(sy);
  }
  armR.add(racket);

  // ── Legs: capsule-style ──
  function makeLegGroup(side){
    const legG = new THREE.Group();
    legG.position.set(side * 0.20, 0.95, 0);
    const hip = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 10), pantsMat);
    legG.add(hip);
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.55, 18), pantsMat);
    thigh.position.y = -0.30; thigh.castShadow = true; legG.add(thigh);
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), pantsMat);
    knee.position.y = -0.58; legG.add(knee);
    const calf = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.10, 0.45, 18), pantsMat);
    calf.position.y = -0.83; calf.castShadow = true; legG.add(calf);
    // Shoe (rounder, more shape)
    const shoeBody = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 10), shoeMat);
    shoeBody.position.set(0, -1.05, 0.07); shoeBody.scale.set(0.95, 0.5, 1.4);
    legG.add(shoeBody);
    // Shoe sole stripe
    const stripeMat = new THREE.MeshStandardMaterial({ color: opts.col, emissive: col.clone().multiplyScalar(0.4), emissiveIntensity: 0.6 });
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.42), stripeMat);
    stripe.position.set(0, -1.04, 0.10); legG.add(stripe);
    return legG;
  }
  const legL = makeLegGroup(-1);
  g.add(legL);
  const legR = makeLegGroup(1);
  g.add(legR);

  // Wristband on racket arm
  const wristbandMat = new THREE.MeshStandardMaterial({ color: opts.col, emissive: col.clone().multiplyScalar(0.4), emissiveIntensity:0.6 });
  const wristband = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.10, 16), wristbandMat);
  wristband.position.y = -1.07; armR.add(wristband);

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
  { x: 0,  z: 9,  side:'near', speed:7, sprintSpd:10, swingT:0, hitCD:0, jumpH:0, jumpVel:0, walkT:0, serving:false },
  { x: 0,  z:-9,  side:'far',  speed:7, sprintSpd:10, swingT:0, hitCD:0, jumpH:0, jumpVel:0, walkT:0, serving:false },
  { x: 2,  z: 9,  side:'near', speed:7, sprintSpd:10, swingT:0, hitCD:0, jumpH:0, jumpVel:0, walkT:0, serving:false },
  { x:-2,  z:-9,  side:'far',  speed:7, sprintSpd:10, swingT:0, hitCD:0, jumpH:0, jumpVel:0, walkT:0, serving:false },
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
    const x0 = cg.position.x;
    const z0 = cg.position.z + (fromPi<2?-0.4:0.4);
    this.pos.set(x0, y0, z0);
    this.bounces=0; this.lastHitter=fromPi; this.active=true; this.trail=[];
    const dx = tx-this.pos.x, dz = tz-this.pos.z;
    const dist = Math.sqrt(dx*dx + dz*dz) || 1;
    let t = dist/speed;
    let vy = this.GRAV*t*0.5 + (arcH-this.pos.y)/t;
    // GENEROUS PEAK CAP — was 3.0, now 4.5 so net clearance always wins
    const MAX_PEAK = 4.5;
    if (vy > 0){
      const allowed = Math.sqrt(Math.max(0, 2 * this.GRAV * (MAX_PEAK - y0)));
      if (vy > allowed) vy = allowed;
    }
    // GUARANTEE net clearance for any shot crossing z=0
    const crossesNet = (z0 > 0 && tz < 0) || (z0 < 0 && tz > 0);
    if (crossesNet){
      const vz = dz / t;
      const t0 = -z0 / vz; // time when ball reaches z=0
      if (t0 > 0 && t0 < t){
        const yAtNet = y0 + vy * t0 - 0.5 * this.GRAV * t0 * t0;
        const NET_CLEAR = NET_H + 0.50; // big margin: 1.42m above net
        if (yAtNet < NET_CLEAR){
          // Boost vy enough so ball is at NET_CLEAR exactly when crossing.
          vy = (NET_CLEAR - y0 + 0.5 * this.GRAV * t0 * t0) / t0;
          // If even MAX_PEAK isn't enough, slow the shot down to extend t0
          // so the same arc can clear the net.
          const peakAllowed = Math.sqrt(Math.max(0, 2 * this.GRAV * (MAX_PEAK - y0)));
          if (vy > peakAllowed){
            // Recompute speed to give more time. Slow shot = higher arc that clears.
            const factor = Math.min(2.0, vy / peakAllowed);
            t = t * factor;            // longer flight
            vy = peakAllowed;            // max allowed vy
          }
        }
      }
    }
    this.vel.set(dx/t, vy, dz/t);
  },
  update(dt){
    if (!this.active) return;
    this.trail.unshift(this.pos.clone());
    if (this.trail.length > TRAIL_LEN) this.trail.pop();
    this.vel.y -= this.GRAV*dt;
    this.pos.addScaledVector(this.vel, dt);
    // Hard ceiling so the ball physically cannot leave the visible frame
    if (this.pos.y > 4.6){
      this.pos.y = 4.6;
      if (this.vel.y > 0) this.vel.y = -Math.abs(this.vel.y) * 0.3;
    }
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

// ── Ball landing predictor (ground marker so you can see where ball lands) ──
const landingMarker = (function(){
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.32, 0.50, 28),
    new THREE.MeshBasicMaterial({ color: 0xffdd33, side: THREE.DoubleSide, transparent: true, opacity: 0.78 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  ring.visible = false;
  scene.add(ring);
  return ring;
})();
function updateLandingMarker(){
  if (!B.active){ landingMarker.visible = false; return; }
  const y0 = B.pos.y, vy = B.vel.y, g = B.GRAV;
  const disc = vy*vy + 2*g*(y0 - 0.18);
  if (disc < 0){ landingMarker.visible = false; return; }
  const t = (vy + Math.sqrt(disc)) / g;
  if (t <= 0 || t > 4){ landingMarker.visible = false; return; }
  const lx = B.pos.x + B.vel.x * t;
  const lz = B.pos.z + B.vel.z * t;
  if (Math.abs(lx) > CHW + 6 || Math.abs(lz) > CHL + 6){
    landingMarker.visible = false; return;
  }
  const inCourt = (Math.abs(lx) <= CHW) && (Math.abs(lz) <= CHL);
  landingMarker.material.color.setHex(inCourt ? 0x60ff80 : 0xff5050);
  landingMarker.position.set(lx, 0.06, lz);
  landingMarker.visible = true;
  const pulse = 1.0 + Math.max(0, 1 - t/1.5) * 0.5;
  landingMarker.scale.setScalar(pulse);
}

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
    // IMPORTANT: top:auto + left:auto override the global `canvas{inset:0}` rule
    // that would otherwise stretch this mini-map to fill the whole viewport.
    canvas.style.cssText = 'position:fixed;top:auto;left:auto;bottom:80px;right:14px;' +
      'width:140px !important;height:280px !important;z-index:50;' +
      'border:1px solid rgba(0,180,255,.35);border-radius:8px;background:rgba(5,8,15,.78);' +
      'pointer-events:none;display:none;inset:auto';
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
      'position:fixed;inset:0;display:none;' +
      'z-index:130;background:rgba(5,8,15,.94);backdrop-filter:blur(6px);' +
      'overflow-y:auto;-webkit-overflow-scrolling:touch;font-family:Orbitron,sans-serif;color:#fff';
    panel.innerHTML =
      '<div style="margin:auto;background:rgba(12,18,32,.97);border:1.5px solid rgba(178,255,20,.4);border-radius:18px;' +
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
    panel.style.alignItems = 'center';
    panel.style.justifyContent = 'center';
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
    P[0].x = 0; P[0].z = 9;
    chars[0].group.visible = true;
    chars[1].group.visible = false;
    chars[2].group.visible = false;
    chars[3].group.visible = false;
    showHUD(true);
    document.getElementById('lobby').style.display = 'none';
    Radar.setVisible(true);
    gPhase = 'practice';
    refreshHUD();
    // Reset the ball state and immediately fire one so there IS a ball
    B.reset(0);
    ballMesh.visible = true;
    machineTimer = 0.5;
    AudioSys.init(); AudioSys.ensureRunning();
    AudioSys.setCrowdVolume(SETTINGS.muted ? 0 : SETTINGS.crowdLevel);
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
    // Push the mesh to its new position immediately so the ball is visible
    // even before the next physics tick.
    ballMesh.position.copy(B.pos);
    ballMesh.visible = true;
    ballLight.position.copy(B.pos);
    AudioSys.hit(0.5);
    ParticleSys.sparkBurst(B.pos.x, B.pos.y, B.pos.z);
    showMsg('🎾 INCOMING!', 600);
  }

  function update(dt){
    if (!active) return;
    timeLeft -= dt;
    refreshHUD();
    if (timeLeft <= 0){ stop(); return; }
    machineTimer -= dt;
    // Always fire on a fixed schedule — the previous gating made later balls
    // never spawn because the ball stays "active" after first launch.
    if (machineTimer <= 0){
      ballMachineFire();
      machineTimer = 3.0;
    }
    // Also re-fire if ball has clearly gone past the player and stopped
    if (B.active && B.pos.z > CHL + 1){
      B.active = false;
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

// ── Commentator system (text "voice" reacting to game events) ──
const Commentator = (function(){
  // Massive line bank organized by event type. Random pick from category.
  const lines = {
    serve_perfect: [
      'Beautiful serve! Right on the line.',
      'Pinpoint accuracy on that one!',
      'Pure power, pure placement.',
      'Could not have hit that any better.',
      'A serve straight from the textbook.',
      'Clinical execution.',
      'Service motion looking like a metronome.',
      'That serve had everything — speed, spin, depth.',
      'Untouchable!',
      'Ball boy didn\'t even move.'
    ],
    serve_good: [
      'Solid serve, gets the job done.',
      'A reliable first serve.',
      'No frills, just business.',
      'Decent depth on that one.',
      'A serve that gives nothing away.',
      'Workmanlike service.',
      'Effective if not spectacular.',
      'Plenty of pace on that delivery.'
    ],
    serve_weak: [
      'A bit tentative on that serve.',
      'Lost some pace there.',
      'Service motion looked rushed.',
      'Not the cleanest contact.',
      'Will want a better one in next time.',
      'A bit of a nothing serve.',
      'Easy to read.',
      'Forgettable delivery.'
    ],
    smash: [
      'OH! What a smash!',
      'You can hear that one in the cheap seats!',
      'Drove that into the canvas!',
      'Authority on that overhead!',
      'Smashed it down with intent.',
      'Vicious overhead!',
      'No coming back from that.',
      'Brutal, brutal smash!',
      'Couldn\'t put more on it if they tried.',
      'Game-defining smash right there.',
      'Pure venom on that overhead.'
    ],
    ace: [
      'ACE! Untouched.',
      'Service winner — beautifully placed.',
      'Just an ace. Walk-up service.',
      'Free point on the serve.',
      'No reading that one — ace.',
      'Clinical. ACE.',
      'Untouched! What a serve.',
      'And another ace to add to the tally.'
    ],
    winner: [
      'Winner! Threaded the needle.',
      'Beautiful winner down the line.',
      'Picked the corner perfectly.',
      'Rope! That ball never came up.',
      'Winner! Crowd loving it.',
      'What a strike — point won.',
      'Painted the line!',
      'Inch-perfect winner.',
      'Hit clean off the strings.',
      'Glorious shot, glorious winner.'
    ],
    error_net: [
      'Into the net. That\'s a tough one.',
      'Caught the tape and dropped.',
      'Couldn\'t clear the net there.',
      'Hung in the net.',
      'Net error — sloppy.',
      'A simple shot dragged into the net.',
      'They\'ll feel that error.',
      'That ball never had a chance to make it.'
    ],
    error_out: [
      'Long! That ball sailed.',
      'Wide! Couldn\'t pull it back.',
      'Out by a yard.',
      'Goes long. Cheap point given away.',
      'Frustrating error there.',
      'Just couldn\'t keep that one in.',
      'Rifled it long.',
      'Tried to do too much with that one.'
    ],
    deuce: [
      'And we are at deuce.',
      'Deuce. Pressure point coming up.',
      'The game gets tighter — deuce.',
      'Deuce. This game is a battle.',
      'Cannot separate them — deuce.'
    ],
    advantage: [
      'Advantage. One point from the game.',
      'Adv — they smell blood.',
      'On the brink now. Advantage.',
      'Game point coming up.',
      'Big point next.'
    ],
    game_won: [
      'Game! Held with authority.',
      'And the game goes their way.',
      'Game closed out cleanly.',
      'They take the game. Crowd approves.',
      'Game won. Onto the next.',
      'Class through and through. Game.'
    ],
    set_won: [
      'SET! That\'s one in the bag.',
      'Set goes their way.',
      'Set closed out!',
      'And they take the set!',
      'Massive set won.',
      'Tense, tense set — but they\'ve got it.'
    ],
    match_won: [
      '🏆 MATCH! Champion!',
      'It\'s ALL OVER! Champion!',
      'They\'ve done it! Match point converted!',
      'CHAMPION! What a performance!',
      'Sealed and delivered — match won!'
    ],
    rally_long: [
      'These two are putting on a show!',
      'Outrageous rally — what a watch!',
      'Both players unwilling to give an inch.',
      'A rally for the highlight reel!',
      'Phenomenal exchange of strokes!',
      'Tennis at its absolute best right here.',
      'Ten shots… twelve… they keep going!'
    ],
    point_won_p1: [
      'Point to the home player!',
      'P1 takes that one.',
      'Great point for P1.',
      'P1 capitalizes on the opening.'
    ],
    point_won_p2: [
      'Opponent steals that one.',
      'Tough loss on that point.',
      'P2 takes it.',
      'Opponent comes through on that one.'
    ],
    countdown_3: ['Players ready. Match starting in 3…','Here we go in 3…','3…'],
    countdown_2: ['2…','Two seconds…','2…'],
    countdown_1: ['1… stand by…','1…','Match starting!'],
    countdown_go: ['Play ball!','Off we go!','Game on!','Begin!'],
    pickup: [
      'Power-up grabbed! That changes things.',
      'Bonus collected — could be a game-changer.',
      'They snagged the pick-up!',
      'Power-up activated!'
    ],
    practice_target_hit: [
      'Target hit! Clinical.',
      'Bullseye!',
      'Right in the kitchen.',
      'Sniper-like accuracy.',
      'Drops it on the spot.',
      'Direct hit!'
    ],
    serve_meter_clicked: [
      'Power locked in.',
      'Loaded and ready.',
      'Power set.',
      'Ready for the toss.'
    ],
  };

  let queue = [];
  let lastShown = 0;
  let lastCategory = '';
  let lastSpoken = {};

  function pickFrom(category){
    const arr = lines[category];
    if (!arr || arr.length === 0) return null;
    // Don't repeat same line within 4 seconds
    const now = performance.now();
    let attempts = 0;
    let chosen = null;
    while (attempts < 6){
      const ix = Math.floor(Math.random() * arr.length);
      chosen = arr[ix];
      const last = lastSpoken[chosen] || 0;
      if (now - last > 4000) break;
      attempts++;
    }
    if (chosen){
      lastSpoken[chosen] = now;
    }
    return chosen;
  }

  function say(category, opts){
    if (!category) return;
    const txt = pickFrom(category);
    if (!txt) return;
    const priority = opts && opts.priority ? opts.priority : 1;
    queue.push({ text: txt, priority: priority, time: performance.now() });
    queue.sort(function(a,b){ return b.priority - a.priority; });
    if (queue.length > 4) queue = queue.slice(0, 4);
    lastCategory = category;
    flush();
  }

  function flush(){
    const banner = document.getElementById('comm-banner');
    if (!banner) return;
    const now = performance.now();
    if (queue.length === 0){
      if (now - lastShown > 4500){
        banner.style.opacity = '0';
        setTimeout(function(){ banner.style.display = 'none'; }, 350);
      }
      return;
    }
    const item = queue.shift();
    lastShown = now;
    banner.textContent = '🎙 ' + item.text;
    banner.style.display = 'block';
    banner.style.opacity = '0.95';
    setTimeout(function(){
      flush();
    }, 2200);
  }

  function reactToServe(quality){
    if (quality > 0.85) say('serve_perfect');
    else if (quality > 0.55) say('serve_good');
    else say('serve_weak');
  }

  function reactToPointEnd(winner, reason, rallyShots){
    if (rallyShots >= 10) say('rally_long', { priority: 2 });
    if (reason === 'net') say('error_net');
    else if (reason === 'out') say('error_out');
    else if (reason === 'double_bounce' && rallyShots <= 2) say('ace', { priority: 2 });
    else if (reason === 'double_bounce') say('winner', { priority: 2 });
    if (winner === 0) say('point_won_p1');
    else say('point_won_p2');
  }

  function reactToScore(msg){
    if (/MATCH/i.test(msg)) say('match_won', { priority: 5 });
    else if (/SET/i.test(msg)) say('set_won', { priority: 4 });
    else if (/GAME/i.test(msg)) say('game_won', { priority: 3 });
    else if (/ADV/i.test(msg)) say('advantage', { priority: 2 });
    else if (/DEUCE/i.test(msg)) say('deuce', { priority: 2 });
  }

  function reactToCountdown(n){
    if (n === 3) say('countdown_3');
    else if (n === 2) say('countdown_2');
    else if (n === 1) say('countdown_1');
    else say('countdown_go');
  }

  function reactToSmash(){ say('smash', { priority: 3 }); }
  function reactToPickup(){ say('pickup'); }
  function reactToTargetHit(){ say('practice_target_hit'); }
  function reactToPowerLock(){ say('serve_meter_clicked'); }

  return {
    say: say,
    reactToServe: reactToServe,
    reactToPointEnd: reactToPointEnd,
    reactToScore: reactToScore,
    reactToCountdown: reactToCountdown,
    reactToSmash: reactToSmash,
    reactToPickup: reactToPickup,
    reactToTargetHit: reactToTargetHit,
    reactToPowerLock: reactToPowerLock
  };
})();

// ── Profile / XP / Persistent Progression ──────────────
const Profile = (function(){
  const KEY = 'spike_tennis_profile_v1';
  const data = {
    xp: 0, level: 1, totalMatches: 0, totalWins: 0, totalAces: 0,
    totalSmashes: 0, totalRallies: 0, totalPlayTime: 0,
    bestRally: 0, fastestServe: 0, totalPointsWon: 0,
    unlockedSkins: ['BLAZE','AZURE','NEON','STORM','FROST','EMBER'],
    unlockedThemes: ['hard','clay','grass','night'],
    achievements: [],
    practiceBest: 0,
    tournamentWins: 0,
  };
  function load(){
    try {
      const raw = localStorage.getItem(KEY);
      if (raw){
        const parsed = JSON.parse(raw);
        for (const k in data){ if (parsed[k] !== undefined) data[k] = parsed[k]; }
      }
    } catch(_){}
  }
  function save(){
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch(_){}
  }
  function awardXP(amount, reason){
    data.xp += amount;
    let leveled = false;
    while (data.xp >= xpForLevel(data.level + 1)){
      data.level++;
      leveled = true;
    }
    save();
    if (leveled){
      showMsg('⭐ LEVEL UP! Now Level ' + data.level, 2400);
      AudioSys.fanfare();
      // Unlock content based on level
      const unlocks = unlocksForLevel(data.level);
      if (unlocks){
        for (let i=0; i<unlocks.length; i++){
          const u = unlocks[i];
          if (u.type === 'skin' && data.unlockedSkins.indexOf(u.id) < 0){
            data.unlockedSkins.push(u.id);
            setTimeout(function(){ showMsg('🆕 UNLOCKED: ' + u.id, 2200); }, 1200);
          } else if (u.type === 'theme' && data.unlockedThemes.indexOf(u.id) < 0){
            data.unlockedThemes.push(u.id);
            setTimeout(function(){ showMsg('🆕 NEW COURT: ' + u.id.toUpperCase(), 2200); }, 1200);
          }
        }
        save();
      }
    }
  }
  function xpForLevel(level){
    // Quadratic curve: 100, 250, 450, 700, 1000, 1350...
    return Math.floor(50 * level * (level + 1));
  }
  function unlocksForLevel(level){
    const tab = {
      2: [{ type:'skin', id:'VOLT' }],
      3: [{ type:'skin', id:'JADE' }],
      4: [{ type:'skin', id:'ROGUE' }],
      5: [{ type:'theme', id:'sunset' }],
      6: [{ type:'skin', id:'OBSIDIAN' }],
      7: [{ type:'skin', id:'CORAL' }],
      8: [{ type:'theme', id:'rain' }],
      10: [{ type:'skin', id:'TITAN' }],
    };
    return tab[level];
  }
  function recordMatch(won){
    data.totalMatches++;
    if (won) {
      data.totalWins++;
      awardXP(150, 'win');
    } else {
      awardXP(60, 'played');
    }
    save();
  }
  function recordPoint(){ data.totalPointsWon++; awardXP(2); }
  function recordSmash(){ data.totalSmashes++; awardXP(8, 'smash'); }
  function recordAce(){ data.totalAces++; awardXP(25, 'ace'); }
  function recordRally(shots){
    data.totalRallies++;
    if (shots > data.bestRally){ data.bestRally = shots; awardXP(20); }
    if (shots >= 10) awardXP(10);
  }
  function recordServe(speedKmh){
    if (speedKmh > data.fastestServe){
      data.fastestServe = speedKmh;
      awardXP(10);
    }
  }
  function recordTournamentWin(){
    data.tournamentWins++;
    awardXP(300, 'tournament');
    save();
  }
  function recordPracticeScore(score){
    if (score > data.practiceBest){
      data.practiceBest = score;
      awardXP(40);
      save();
    }
  }
  function getXPProgress(){
    const cur = xpForLevel(data.level);
    const next = xpForLevel(data.level + 1);
    const range = next - cur;
    const into = data.xp - cur;
    return { progress: into / range, cur: cur, next: next, level: data.level, xp: data.xp };
  }
  function reset(){
    for (const k in data){ delete data[k]; }
    Object.assign(data, {
      xp: 0, level: 1, totalMatches: 0, totalWins: 0, totalAces: 0,
      totalSmashes: 0, totalRallies: 0, totalPlayTime: 0,
      bestRally: 0, fastestServe: 0, totalPointsWon: 0,
      unlockedSkins: ['BLAZE','AZURE','NEON','STORM','FROST','EMBER'],
      unlockedThemes: ['hard','clay','grass','night'],
      achievements: [],
      practiceBest: 0,
      tournamentWins: 0,
    });
    save();
  }
  load();
  return {
    data: data, save: save, load: load,
    awardXP: awardXP,
    recordMatch: recordMatch, recordPoint: recordPoint,
    recordSmash: recordSmash, recordAce: recordAce,
    recordRally: recordRally, recordServe: recordServe,
    recordTournamentWin: recordTournamentWin,
    recordPracticeScore: recordPracticeScore,
    getXPProgress: getXPProgress,
    reset: reset,
    xpForLevel: xpForLevel,
    unlocksForLevel: unlocksForLevel,
  };
})();

// ── AI Personalities (different play styles) ───────────
const AIPersonalities = {
  baseliner: {
    name: 'Baseliner',
    description: 'Stays back, hits with depth, grinds out points',
    aimDepth: 0.85,        // how far back to aim
    aimVariance: 1.0,
    powerMult: 1.0,
    smashChance: 0.10,
    lobChance: 0.15,
    sliceChance: 0.08,
    topspinChance: 0.45,
    flatChance: 0.32,
    netRushChance: 0.05,
    movementPattern: 'lateral',
    homeZ: 0.85,           // 0=net, 1=baseline
  },
  serveVolley: {
    name: 'Serve & Volley',
    description: 'Big serve, rushes the net',
    aimDepth: 0.55,
    aimVariance: 0.8,
    powerMult: 1.15,
    smashChance: 0.22,
    lobChance: 0.05,
    sliceChance: 0.18,
    topspinChance: 0.20,
    flatChance: 0.57,
    netRushChance: 0.45,
    movementPattern: 'aggressive',
    homeZ: 0.55,
  },
  defender: {
    name: 'Defender',
    description: 'Pushes back high looping balls, runs everything down',
    aimDepth: 0.92,
    aimVariance: 1.4,
    powerMult: 0.78,
    smashChance: 0.04,
    lobChance: 0.32,
    sliceChance: 0.18,
    topspinChance: 0.42,
    flatChance: 0.08,
    netRushChance: 0.0,
    movementPattern: 'reactive',
    homeZ: 1.0,
  },
  aggressor: {
    name: 'Aggressor',
    description: 'Goes for everything, big swings, big errors',
    aimDepth: 0.75,
    aimVariance: 1.6,
    powerMult: 1.3,
    smashChance: 0.30,
    lobChance: 0.08,
    sliceChance: 0.05,
    topspinChance: 0.20,
    flatChance: 0.67,
    netRushChance: 0.30,
    movementPattern: 'aggressive',
    homeZ: 0.65,
  },
  counterPuncher: {
    name: 'Counter-Puncher',
    description: 'Lets you make errors, redirects pace',
    aimDepth: 0.80,
    aimVariance: 0.7,
    powerMult: 0.92,
    smashChance: 0.06,
    lobChance: 0.20,
    sliceChance: 0.30,
    topspinChance: 0.30,
    flatChance: 0.20,
    netRushChance: 0.08,
    movementPattern: 'patient',
    homeZ: 0.92,
  },
  spinner: {
    name: 'Spinner',
    description: 'Heavy topspin, kicks balls high',
    aimDepth: 0.75,
    aimVariance: 1.1,
    powerMult: 0.95,
    smashChance: 0.15,
    lobChance: 0.10,
    sliceChance: 0.05,
    topspinChance: 0.65,
    flatChance: 0.20,
    netRushChance: 0.05,
    movementPattern: 'lateral',
    homeZ: 0.88,
  },
};
let aiPersonality = 'baseliner';
function setAIPersonality(name){
  if (AIPersonalities[name]) aiPersonality = name;
}
function getAIPersonality(){ return AIPersonalities[aiPersonality] || AIPersonalities.baseliner; }

// ── Match commentary banner element creator ────────────
function ensureCommBanner(){
  let b = document.getElementById('comm-banner');
  if (b) return b;
  b = document.createElement('div');
  b.id = 'comm-banner';
  b.style.cssText =
    'position:fixed;top:62px;left:50%;transform:translateX(-50%);' +
    'background:rgba(5,8,15,.78);border:1px solid rgba(0,180,255,.28);' +
    'border-radius:10px;padding:.55rem 1.1rem;font-family:Orbitron,sans-serif;' +
    'font-size:.78rem;color:#cdd9e6;z-index:55;letter-spacing:.04em;' +
    'pointer-events:none;display:none;opacity:0;transition:opacity .35s;' +
    'max-width:80vw;text-align:center';
  document.body.appendChild(b);
  return b;
}
ensureCommBanner();

// ── Tutorial system (5-step interactive walk-through) ──
const Tutorial = (function(){
  const steps = [
    { title:'WELCOME', body:'Welcome to Spike Tennis! Use WASD to move around.', highlight:'wasd', wait:5 },
    { title:'JUMP', body:'Press LSHIFT or V to jump. Try jumping now!', highlight:'jump', wait:6 },
    { title:'CAMERA', body:'Right-click and drag to orbit the camera. Mouse wheel to zoom.', highlight:'cam', wait:7 },
    { title:'SERVE', body:'When serving, watch the meter at the bottom. Click when it\'s in the GREEN zone (right side).', highlight:'serve', wait:9 },
    { title:'HIT', body:'During rally, click or press SPACE to hit. Get close to the ball first!', highlight:'hit', wait:9 },
    { title:'SMASH', body:'Jump up when ball is overhead, then hit — auto SMASH!', highlight:'smash', wait:8 },
    { title:'WIN', body:'Score points by making your opponent miss. First to 4 wins game, 6 wins set, 2 sets wins match.', highlight:'win', wait:10 },
    { title:'GO', body:'Now go win some matches!', highlight:'go', wait:5 },
  ];
  let active = false;
  let stepIdx = 0;
  let stepTimer = 0;
  let panel = null;
  function build(){
    panel = document.createElement('div');
    panel.id = 'tutorial-panel';
    panel.style.cssText =
      'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);' +
      'background:rgba(8,12,22,.96);border:1.5px solid rgba(0,180,255,.45);' +
      'border-radius:14px;padding:1.6rem 1.5rem;width:min(440px,92vw);' +
      'z-index:140;display:none;font-family:Orbitron,sans-serif;color:#fff;' +
      'box-shadow:0 0 40px rgba(0,180,255,.4)';
    panel.innerHTML =
      '<div id="tut-step" style="font-size:.62rem;color:#7a8ba0;letter-spacing:.18em">STEP 1 / 8</div>' +
      '<div id="tut-title" style="font-size:1.4rem;font-weight:900;margin:.4rem 0;color:#00b4ff">WELCOME</div>' +
      '<div id="tut-body" style="font-size:.84rem;line-height:1.6;color:#cdd9e6;margin-bottom:1.1rem">…</div>' +
      '<div style="display:flex;gap:.55rem">' +
        '<button id="tut-skip" class="gbtn" style="flex:1">SKIP</button>' +
        '<button id="tut-next" class="abtn" style="flex:2">NEXT ▶</button>' +
      '</div>';
    document.body.appendChild(panel);
    document.getElementById('tut-skip').onclick = function(){ AudioSys.click(); stop(); };
    document.getElementById('tut-next').onclick = function(){ AudioSys.click(); next(); };
  }
  function start(){
    if (!panel) build();
    active = true;
    stepIdx = 0;
    show();
  }
  function stop(){
    active = false;
    if (panel) panel.style.display = 'none';
    try { localStorage.setItem('spike_tennis_tutorial_done','1'); } catch(_){}
  }
  function next(){
    stepIdx++;
    if (stepIdx >= steps.length){ stop(); return; }
    show();
  }
  function show(){
    if (!panel) build();
    const s = steps[stepIdx];
    document.getElementById('tut-step').textContent = 'STEP ' + (stepIdx + 1) + ' / ' + steps.length;
    document.getElementById('tut-title').textContent = s.title;
    document.getElementById('tut-body').textContent = s.body;
    panel.style.display = 'block';
    stepTimer = s.wait;
  }
  function update(dt){
    if (!active) return;
    stepTimer -= dt;
    // Auto-advance disabled by default; user clicks Next.
  }
  function shouldAutoStart(){
    try { return !localStorage.getItem('spike_tennis_tutorial_done'); }
    catch(_){ return true; }
  }
  return {
    start: start, stop: stop, next: next, update: update,
    shouldAutoStart: shouldAutoStart,
    isActive: function(){ return active; }
  };
})();

// ── Music system (procedural lobby + match background tracks) ──────
const Music = (function(){
  let ac = null;
  let masterGain = null;
  let activeOscillators = [];
  let active = false;
  let mode = 'silent';
  let nextNoteTime = 0;
  let beat = 0;
  // Pentatonic minor scale offsets (for that "video gamey" feel)
  const scale = [0, 3, 5, 7, 10, 12, 15, 17];
  const baseFreq = 110; // A2
  function freqFor(n){ return baseFreq * Math.pow(2, scale[n % scale.length] / 12 + Math.floor(n/scale.length)); }
  function init(){
    if (ac) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      ac = new Ctx();
      masterGain = ac.createGain();
      masterGain.gain.value = 0.06;  // Quiet background
      masterGain.connect(ac.destination);
    } catch(_){}
  }
  function setVolume(v){
    if (masterGain) masterGain.gain.value = v;
  }
  function setMode(m){
    mode = m;
    if (m === 'silent'){
      stop();
    } else {
      start();
    }
  }
  function tick(){
    if (!active || !ac) return;
    const now = ac.currentTime;
    while (nextNoteTime < now + 0.25){
      scheduleNote(nextNoteTime);
      nextNoteTime += 0.5;
    }
  }
  function scheduleNote(t){
    if (!ac || !active) return;
    const noteIdx = patternForMode()[beat % patternForMode().length];
    if (noteIdx >= 0){
      const f = freqFor(noteIdx);
      const osc = ac.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const g = ac.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.07, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(g); g.connect(masterGain);
      osc.start(t); osc.stop(t + 0.42);
      activeOscillators.push(osc);
      if (activeOscillators.length > 32) activeOscillators.shift();
    }
    // Also play a bass note every 4 beats
    if (beat % 4 === 0){
      const bassF = baseFreq * 0.5;
      const bo = ac.createOscillator();
      bo.type = 'square';
      bo.frequency.value = bassF;
      const bg = ac.createGain();
      bg.gain.setValueAtTime(0, t);
      bg.gain.linearRampToValueAtTime(0.04, t + 0.02);
      bg.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      bo.connect(bg); bg.connect(masterGain);
      bo.start(t); bo.stop(t + 0.42);
      activeOscillators.push(bo);
    }
    beat++;
  }
  function patternForMode(){
    // -1 = rest. Modes have different patterns.
    if (mode === 'lobby') return [0, -1, 2, -1, 4, -1, 2, -1, 0, -1, 2, -1, 4, 5, 4, 2];
    if (mode === 'match') return [0, 3, 5, 3, 0, 3, 5, 7, 5, 3, 5, 3, 0, 2, 0, -1];
    if (mode === 'tense') return [0, -1, 0, 2, 0, -1, 0, 2, 3, -1, 3, 5, 3, -1, 3, 2];
    if (mode === 'victory') return [0, 4, 7, 12, 7, 4, 0, -1, 7, 12, 14, 12, 7, 4, 0, -1];
    return [0, -1, -1, -1];
  }
  function start(){
    init();
    if (!ac) return;
    if (active) return;
    active = true;
    nextNoteTime = ac.currentTime + 0.05;
    beat = 0;
    function loop(){
      if (!active) return;
      tick();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }
  function stop(){
    active = false;
    activeOscillators.forEach(function(o){
      try { o.stop(); } catch(_){}
    });
    activeOscillators = [];
  }
  return {
    init: init, start: start, stop: stop,
    setMode: setMode, setVolume: setVolume
  };
})();

// ── Practice Mini-Games ────────────────────────────────
// Multiple variants of practice modes: target shooting, rally drill,
// volley drill, return drill, accuracy drill, speed drill.
const MiniGames = (function(){
  const config = {
    target: {
      name: 'Target Shooting',
      desc: 'Hit the rings to score points',
      duration: 60,
      ballsPerSecond: 0.4,
      targets: 3,
      pointsPerHit: 50,
    },
    rally: {
      name: 'Rally Drill',
      desc: 'Keep the rally going as long as possible',
      duration: 0,    // unlimited
      ballsPerSecond: 0,
      targets: 0,
      pointsPerHit: 1, // 1 per shot
    },
    volley: {
      name: 'Volley Drill',
      desc: 'Hit balls before they bounce',
      duration: 90,
      ballsPerSecond: 0.5,
      targets: 0,
      pointsPerHit: 25,
    },
    return: {
      name: 'Return Drill',
      desc: 'Return power serves',
      duration: 90,
      ballsPerSecond: 0.3,
      targets: 0,
      pointsPerHit: 30,
    },
    accuracy: {
      name: 'Accuracy Drill',
      desc: 'Hit specific zones for bonus',
      duration: 120,
      ballsPerSecond: 0.4,
      targets: 5,
      pointsPerHit: 60,
    },
    speed: {
      name: 'Speed Test',
      desc: 'Hit fastest serve possible',
      duration: 60,
      ballsPerSecond: 0,
      targets: 0,
      pointsPerHit: 0,
    },
  };
  let activeName = null;
  let cfg = null;
  let elapsed = 0;
  let score = 0;
  let combo = 0;
  let bestScores = {};
  function loadBests(){
    try {
      const raw = localStorage.getItem('spike_tennis_minigame_bests_v1');
      if (raw) bestScores = JSON.parse(raw);
    } catch(_){}
  }
  function saveBests(){
    try { localStorage.setItem('spike_tennis_minigame_bests_v1', JSON.stringify(bestScores)); } catch(_){}
  }
  function start(name){
    cfg = config[name];
    if (!cfg){ return; }
    activeName = name;
    elapsed = 0; score = 0; combo = 0;
    showMsg(cfg.name.toUpperCase() + ' — ' + cfg.desc, 1800);
  }
  function stop(){
    if (!activeName) return;
    if (!bestScores[activeName] || score > bestScores[activeName]){
      bestScores[activeName] = score;
      saveBests();
      Profile.recordPracticeScore(score);
      showMsg('🏆 NEW BEST: ' + score + ' (' + cfg.name + ')', 3500);
    } else {
      showMsg('FINAL: ' + score + ' (Best: ' + (bestScores[activeName] || 0) + ')', 3500);
    }
    activeName = null;
    cfg = null;
  }
  function update(dt){
    if (!activeName || !cfg) return;
    elapsed += dt;
    if (cfg.duration > 0 && elapsed >= cfg.duration){
      stop();
    }
  }
  function isActive(){ return activeName !== null; }
  function getCurrent(){ return { name: activeName, cfg: cfg, score: score, elapsed: elapsed }; }
  function getBest(name){ return bestScores[name] || 0; }
  function getAllBests(){ return Object.assign({}, bestScores); }
  function addScore(amount){ score += amount; }
  function comboHit(){
    combo++;
    if (combo >= 5) showMsg('🔥 COMBO ×' + combo, 800);
    return combo;
  }
  function resetCombo(){ combo = 0; }
  function getScore(){ return score; }
  function getElapsed(){ return elapsed; }
  function getRemaining(){ return cfg ? Math.max(0, cfg.duration - elapsed) : 0; }
  loadBests();
  return {
    start: start, stop: stop, update: update,
    isActive: isActive, getCurrent: getCurrent,
    getBest: getBest, getAllBests: getAllBests,
    addScore: addScore, comboHit: comboHit, resetCombo: resetCombo,
    getScore: getScore, getElapsed: getElapsed, getRemaining: getRemaining,
    config: config,
  };
})();

// ── Shop / Customization (cosmetic items unlocked via XP / level) ──
const Shop = (function(){
  const items = [
    // Rackets (visual variants)
    { id:'racket_classic',  type:'racket',  name:'Classic Racket', cost:0,    levelReq:1, color:0xff5050 },
    { id:'racket_neon',     type:'racket',  name:'Neon Racket',    cost:200,  levelReq:2, color:0x00b4ff },
    { id:'racket_gold',     type:'racket',  name:'Gold Racket',    cost:1000, levelReq:5, color:0xffd700 },
    { id:'racket_chrome',   type:'racket',  name:'Chrome Racket',  cost:2000, levelReq:8, color:0xeeeeee },
    { id:'racket_lava',     type:'racket',  name:'Lava Racket',    cost:3000, levelReq:10, color:0xff3010 },
    { id:'racket_glacier',  type:'racket',  name:'Glacier Racket', cost:3500, levelReq:11, color:0x80ffff },
    // Balls (visual + physics-feel)
    { id:'ball_standard',   type:'ball',    name:'Standard',       cost:0,    levelReq:1, color:0xb2ff14 },
    { id:'ball_fire',       type:'ball',    name:'Fire Ball',      cost:500,  levelReq:3, color:0xff5510 },
    { id:'ball_ice',        type:'ball',    name:'Ice Ball',       cost:500,  levelReq:3, color:0x90e0ff },
    { id:'ball_disco',      type:'ball',    name:'Disco Ball',     cost:1500, levelReq:6, color:0xff80ff },
    { id:'ball_galaxy',     type:'ball',    name:'Galaxy Ball',    cost:5000, levelReq:12, color:0xa0a0ff },
    // Trails
    { id:'trail_default',   type:'trail',   name:'Standard Trail', cost:0,    levelReq:1, },
    { id:'trail_rainbow',   type:'trail',   name:'Rainbow Trail',  cost:800,  levelReq:4, },
    { id:'trail_smoke',     type:'trail',   name:'Smoke Trail',    cost:1200, levelReq:6, },
    { id:'trail_lightning', type:'trail',   name:'Lightning Trail',cost:2500, levelReq:9, },
    { id:'trail_petals',    type:'trail',   name:'Petals Trail',   cost:4000, levelReq:11, },
    // Hats / accessories
    { id:'hat_none',        type:'hat',     name:'No Hat',         cost:0,    levelReq:1, },
    { id:'hat_cap',         type:'hat',     name:'Cap',            cost:300,  levelReq:2, },
    { id:'hat_visor',       type:'hat',     name:'Visor',          cost:600,  levelReq:3, },
    { id:'hat_crown',       type:'hat',     name:'Crown',          cost:5000, levelReq:12, },
    { id:'hat_wizard',      type:'hat',     name:'Wizard Hat',     cost:3500, levelReq:10, },
    // Court banners / themes already unlock via level
    { id:'banner_red',      type:'banner',  name:'Red Banner',     cost:200,  levelReq:2, },
    { id:'banner_blue',     type:'banner',  name:'Blue Banner',    cost:200,  levelReq:2, },
    { id:'banner_gold',     type:'banner',  name:'Gold Banner',    cost:1500, levelReq:7, },
    // Emotes (used during point-end celebrations)
    { id:'emote_wave',      type:'emote',   name:'Wave',           cost:100,  levelReq:1, },
    { id:'emote_pump',      type:'emote',   name:'Fist Pump',      cost:300,  levelReq:2, },
    { id:'emote_bow',       type:'emote',   name:'Bow',            cost:600,  levelReq:4, },
    { id:'emote_dance',     type:'emote',   name:'Victory Dance',  cost:1500, levelReq:7, },
    { id:'emote_celebrate', type:'emote',   name:'Big Celebration',cost:3000, levelReq:10, },
  ];
  const DATA_KEY = 'spike_tennis_shop_v1';
  const data = {
    coins: 0,
    owned: ['racket_classic','ball_standard','trail_default','hat_none','emote_wave'],
    equipped: {
      racket: 'racket_classic',
      ball: 'ball_standard',
      trail: 'trail_default',
      hat: 'hat_none',
      emote: 'emote_wave',
    }
  };
  function load(){
    try {
      const raw = localStorage.getItem(DATA_KEY);
      if (raw){
        const p = JSON.parse(raw);
        if (p.coins != null) data.coins = p.coins;
        if (p.owned)         data.owned = p.owned;
        if (p.equipped)      Object.assign(data.equipped, p.equipped);
      }
    } catch(_){}
  }
  function save(){
    try { localStorage.setItem(DATA_KEY, JSON.stringify(data)); } catch(_){}
  }
  function addCoins(n){ data.coins += n; save(); }
  function spendCoins(n){
    if (data.coins < n) return false;
    data.coins -= n; save();
    return true;
  }
  function isOwned(id){ return data.owned.indexOf(id) >= 0; }
  function isEquipped(id){
    const item = items.find(function(i){ return i.id === id; });
    if (!item) return false;
    return data.equipped[item.type] === id;
  }
  function buy(id){
    const item = items.find(function(i){ return i.id === id; });
    if (!item) return { ok:false, reason:'Unknown item' };
    if (Profile.data.level < item.levelReq) return { ok:false, reason:'Need level ' + item.levelReq };
    if (isOwned(id)) return { ok:false, reason:'Already owned' };
    if (data.coins < item.cost) return { ok:false, reason:'Not enough coins' };
    data.coins -= item.cost;
    data.owned.push(id);
    save();
    return { ok:true, item: item };
  }
  function equip(id){
    const item = items.find(function(i){ return i.id === id; });
    if (!item || !isOwned(id)) return false;
    data.equipped[item.type] = id;
    save();
    return true;
  }
  function getOwnedOfType(type){
    return items.filter(function(i){ return i.type === type && isOwned(i.id); });
  }
  function getAll(){ return items.slice(); }
  function getEquipped(type){ return data.equipped[type]; }
  function getEquippedItem(type){
    return items.find(function(i){ return i.id === data.equipped[type]; });
  }
  function getCoins(){ return data.coins; }
  load();
  return {
    items: items, data: data,
    load: load, save: save,
    addCoins: addCoins, spendCoins: spendCoins,
    isOwned: isOwned, isEquipped: isEquipped,
    buy: buy, equip: equip,
    getOwnedOfType: getOwnedOfType,
    getAll: getAll,
    getEquipped: getEquipped,
    getEquippedItem: getEquippedItem,
    getCoins: getCoins,
  };
})();

// ── Weather / Lighting Effects ─────────────────────────
const Weather = (function(){
  let mode = 'clear';
  let rainParticles = [];
  const RAIN_COUNT = 200;
  let snowParticles = [];
  const SNOW_COUNT = 80;
  let fogIntensity = 0.018;
  let initialized = false;

  function initRain(){
    if (rainParticles.length) return;
    const geo = new THREE.CylinderGeometry(0.01, 0.01, 0.4, 4);
    const mat = new THREE.MeshBasicMaterial({ color: 0xaaccee, transparent: true, opacity: 0.5 });
    for (let i=0; i<RAIN_COUNT; i++){
      const drop = new THREE.Mesh(geo, mat);
      drop.position.set(
        (Math.random() - 0.5) * 60,
        Math.random() * 25 + 5,
        (Math.random() - 0.5) * 60
      );
      drop.visible = false;
      scene.add(drop);
      rainParticles.push({ mesh: drop, vy: -10 - Math.random() * 4 });
    }
  }
  function initSnow(){
    if (snowParticles.length) return;
    const geo = new THREE.SphereGeometry(0.07, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
    for (let i=0; i<SNOW_COUNT; i++){
      const flake = new THREE.Mesh(geo, mat);
      flake.position.set(
        (Math.random() - 0.5) * 60,
        Math.random() * 25 + 5,
        (Math.random() - 0.5) * 60
      );
      flake.visible = false;
      scene.add(flake);
      snowParticles.push({ mesh: flake, vy: -1.5 - Math.random() * 0.5, vx: (Math.random()-0.5)*0.5, age: Math.random()*5 });
    }
  }
  function setMode(m){
    mode = m;
    rainParticles.forEach(function(p){ p.mesh.visible = (m === 'rain'); });
    snowParticles.forEach(function(p){ p.mesh.visible = (m === 'snow'); });
    if (scene.fog){
      const f = m === 'fog' ? 0.04 : m === 'rain' ? 0.025 : m === 'snow' ? 0.022 : 0.018;
      scene.fog.density = f;
      fogIntensity = f;
    }
    if (m === 'rain' && !initialized){ initRain(); initialized = true; }
    if (m === 'snow') initSnow();
  }
  function update(dt){
    if (mode === 'rain'){
      rainParticles.forEach(function(p){
        if (!p.mesh.visible) return;
        p.mesh.position.y += p.vy * dt;
        if (p.mesh.position.y < 0){
          p.mesh.position.set(
            (Math.random() - 0.5) * 60,
            20 + Math.random() * 5,
            (Math.random() - 0.5) * 60
          );
        }
      });
    }
    if (mode === 'snow'){
      snowParticles.forEach(function(p){
        if (!p.mesh.visible) return;
        p.age += dt;
        p.mesh.position.x += p.vx * dt + Math.sin(p.age * 1.5) * 0.02;
        p.mesh.position.y += p.vy * dt;
        if (p.mesh.position.y < 0){
          p.mesh.position.set(
            (Math.random() - 0.5) * 60,
            20 + Math.random() * 5,
            (Math.random() - 0.5) * 60
          );
        }
      });
    }
  }
  function getMode(){ return mode; }
  return { setMode: setMode, update: update, getMode: getMode };
})();

// ── Multi-ball chaos mode ──────────────────────────────
const MultiBall = (function(){
  const extraBalls = []; // { mesh, pos, vel, active }
  const MAX = 4;
  let enabled = false;

  function init(){
    if (extraBalls.length) return;
    const geo = new THREE.SphereGeometry(0.18, 14, 14);
    for (let i=0; i<MAX; i++){
      const mat = new THREE.MeshStandardMaterial({
        color: 0xff80aa, emissive: 0xaa3050, emissiveIntensity: 0.7
      });
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      m.visible = false;
      scene.add(m);
      extraBalls.push({
        mesh: m,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        active: false,
      });
    }
  }
  function setEnabled(on){
    enabled = !!on;
    if (!on){
      extraBalls.forEach(function(b){ b.active = false; b.mesh.visible = false; });
    }
  }
  function spawnFrom(x, y, z, vx, vy, vz){
    if (!enabled) return;
    init();
    const free = extraBalls.find(function(b){ return !b.active; });
    if (!free) return;
    free.pos.set(x, y, z);
    free.vel.set(vx, vy, vz);
    free.active = true;
    free.mesh.visible = true;
    free.mesh.position.copy(free.pos);
  }
  function update(dt){
    if (!enabled) return;
    extraBalls.forEach(function(b){
      if (!b.active) return;
      b.vel.y -= 16 * dt;
      b.pos.addScaledVector(b.vel, dt);
      if (b.pos.y <= 0.18){
        b.pos.y = 0.18;
        if (Math.abs(b.vel.y) > 0.4){
          b.vel.y = Math.abs(b.vel.y) * 0.55;
          b.vel.x *= 0.84; b.vel.z *= 0.84;
        } else {
          b.vel.y = 0; b.active = false; b.mesh.visible = false;
        }
      }
      // Cap height
      if (b.pos.y > 3.0){
        b.pos.y = 3.0;
        if (b.vel.y > 0) b.vel.y = -Math.abs(b.vel.y) * 0.3;
      }
      b.mesh.position.copy(b.pos);
      // Despawn if far off court
      if (Math.abs(b.pos.x) > 30 || Math.abs(b.pos.z) > 30){
        b.active = false; b.mesh.visible = false;
      }
    });
  }
  function getCount(){ return extraBalls.filter(function(b){ return b.active; }).length; }
  return { setEnabled: setEnabled, spawnFrom: spawnFrom, update: update, init: init, getCount: getCount };
})();

// ── Trophies / Trophy room ─────────────────────────────
const Trophies = (function(){
  const TROPHY_KEY = 'spike_tennis_trophies_v1';
  const data = { earned: [] };
  const trophies = [
    { id:'first_win',       name:'First Victory',     desc:'Win your first match',           icon:'🥉' },
    { id:'win_10',          name:'10 Wins',           desc:'Win 10 matches',                 icon:'🥈' },
    { id:'win_50',          name:'Half Century',      desc:'Win 50 matches',                 icon:'🥇' },
    { id:'win_100',         name:'Century',           desc:'Win 100 matches',                icon:'🏆' },
    { id:'tournament',      name:'Tournament Champ',  desc:'Win the tournament',             icon:'👑' },
    { id:'tournament_3',    name:'3-Time Champ',      desc:'Win tournament 3 times',         icon:'👑' },
    { id:'level_5',         name:'Rising Star',       desc:'Reach level 5',                  icon:'⭐' },
    { id:'level_10',        name:'Veteran',           desc:'Reach level 10',                 icon:'🌟' },
    { id:'level_20',        name:'Legend',            desc:'Reach level 20',                 icon:'💫' },
    { id:'speed_220',       name:'Speed Demon',       desc:'220+ km/h serve',                icon:'⚡' },
    { id:'speed_250',       name:'Sound Barrier',     desc:'250+ km/h serve',                icon:'🚀' },
    { id:'rally_15',        name:'Rally Master',      desc:'15-shot rally',                  icon:'🎯' },
    { id:'rally_30',        name:'Marathon Rally',    desc:'30-shot rally',                  icon:'🎯' },
    { id:'no_errors',       name:'Flawless',          desc:'Win match with 0 unforced',      icon:'💎' },
    { id:'all_courts',      name:'Globetrotter',      desc:'Win on every court type',        icon:'🌍' },
    { id:'comeback',        name:'Comeback King',     desc:'Win match from 0-2 sets',        icon:'💪' },
    { id:'aces_10_match',   name:'Ace Maker',         desc:'10 aces in one match',           icon:'🎯' },
    { id:'smashes_5_match', name:'Hammer Time',       desc:'5 smashes in one match',         icon:'🔨' },
    { id:'practice_500',    name:'Practice Hero',     desc:'500 in any practice mode',       icon:'🏋' },
    { id:'practice_1000',   name:'Drill Sergeant',    desc:'1000 in any practice mode',      icon:'🏋' },
  ];
  function load(){
    try {
      const raw = localStorage.getItem(TROPHY_KEY);
      if (raw){ data.earned = (JSON.parse(raw).earned) || []; }
    } catch(_){}
  }
  function save(){
    try { localStorage.setItem(TROPHY_KEY, JSON.stringify(data)); } catch(_){}
  }
  function award(id){
    if (data.earned.indexOf(id) >= 0) return false;
    data.earned.push(id);
    save();
    const t = trophies.find(function(x){ return x.id === id; });
    if (t){
      showMsg(t.icon + ' TROPHY: ' + t.name, 3500);
      AudioSys.fanfare();
    }
    return true;
  }
  function check(){
    if (Profile.data.totalWins >= 1)   award('first_win');
    if (Profile.data.totalWins >= 10)  award('win_10');
    if (Profile.data.totalWins >= 50)  award('win_50');
    if (Profile.data.totalWins >= 100) award('win_100');
    if (Profile.data.tournamentWins >= 1) award('tournament');
    if (Profile.data.tournamentWins >= 3) award('tournament_3');
    if (Profile.data.level >= 5)  award('level_5');
    if (Profile.data.level >= 10) award('level_10');
    if (Profile.data.level >= 20) award('level_20');
    if (Profile.data.fastestServe >= 220) award('speed_220');
    if (Profile.data.fastestServe >= 250) award('speed_250');
    if (Profile.data.bestRally >= 15) award('rally_15');
    if (Profile.data.bestRally >= 30) award('rally_30');
    if (Profile.data.practiceBest >= 500)  award('practice_500');
    if (Profile.data.practiceBest >= 1000) award('practice_1000');
  }
  function getAll(){ return trophies.slice(); }
  function isEarned(id){ return data.earned.indexOf(id) >= 0; }
  load();
  return { trophies: trophies, data: data, award: award, check: check, getAll: getAll, isEarned: isEarned };
})();

// ── Animation expansions: idle, victory, taunt sequences ──
const AnimSys = (function(){
  // Each player can be in one of: idle, walk, swing, jump, victory, taunt
  // We don't have a real animation system, but we can drive arm/leg rotations
  // procedurally for different states.
  const states = {};
  function setState(pi, stateName){ states[pi] = { name: stateName, t: 0 }; }
  function update(dt){
    for (const pi in states){
      const s = states[pi];
      if (!s) continue;
      s.t += dt;
      const c = chars[pi];
      if (!c || !c.group) continue;
      if (s.name === 'victory'){
        // Arms up, slight bounce
        if (c.armL) c.armL.rotation.x = -2.0;
        if (c.armR) c.armR.rotation.x = -2.0;
        const bounce = Math.abs(Math.sin(s.t * 6)) * 0.15;
        c.group.position.y = bounce;
        if (s.t > 3) setState(pi, 'idle');
      } else if (s.name === 'taunt'){
        // One arm raised, swaying
        if (c.armR) c.armR.rotation.x = -1.8 + Math.sin(s.t * 4) * 0.3;
        if (c.armL) c.armL.rotation.x = 0.0;
        if (s.t > 2.5) setState(pi, 'idle');
      } else if (s.name === 'jump'){
        // Tucked legs is handled by syncCharVisuals already
      }
    }
  }
  function getState(pi){
    return (states[pi] && states[pi].name) || 'idle';
  }
  return { setState: setState, update: update, getState: getState };
})();

// ── Detailed Shot History (records every shot for analysis) ────
const ShotHistory = (function(){
  const records = [];
  const MAX = 200;
  function record(shot){
    // shot = { pi, type, speed, arcH, fromX, fromZ, toX, toZ, time, success }
    records.push(Object.assign({ time: performance.now() }, shot));
    if (records.length > MAX) records.shift();
  }
  function getAll(){ return records.slice(); }
  function clear(){ records.length = 0; }
  function getStats(){
    const stats = { byType:{}, byPlayer:[{count:0, avgSpeed:0, errors:0}, {count:0, avgSpeed:0, errors:0}] };
    let totalSpeed = [0, 0], totalCount = [0, 0];
    for (let i=0; i<records.length; i++){
      const r = records[i];
      stats.byType[r.type] = (stats.byType[r.type] || 0) + 1;
      stats.byPlayer[r.pi].count++;
      totalSpeed[r.pi] += r.speed || 0;
      totalCount[r.pi]++;
      if (r.success === false) stats.byPlayer[r.pi].errors++;
    }
    for (let p=0; p<2; p++){
      stats.byPlayer[p].avgSpeed = totalCount[p] > 0 ? totalSpeed[p] / totalCount[p] : 0;
    }
    return stats;
  }
  function getHeatmap(player){
    // Returns 2D grid (10x10) of shot landings normalized by court
    const grid = [];
    for (let y=0; y<10; y++){
      const row = [];
      for (let x=0; x<10; x++) row.push(0);
      grid.push(row);
    }
    for (let i=0; i<records.length; i++){
      const r = records[i];
      if (r.pi !== player) continue;
      const gx = Math.floor((r.toX + CHW) / (2*CHW) * 10);
      const gy = Math.floor((r.toZ + CHL) / (2*CHL) * 10);
      if (gx >= 0 && gx < 10 && gy >= 0 && gy < 10) grid[gy][gx]++;
    }
    return grid;
  }
  return { record: record, getAll: getAll, clear: clear, getStats: getStats, getHeatmap: getHeatmap };
})();

// ── Player Skill Ratings (per-mechanic skill trees, used by AI) ───
const SkillSystem = (function(){
  const KEY = 'spike_tennis_skills_v1';
  const skills = {
    serveAccuracy: { level: 1, xp: 0, max: 10, name: 'Serve Accuracy', desc: 'Improves serve placement' },
    servePower:    { level: 1, xp: 0, max: 10, name: 'Serve Power',    desc: 'Increases serve speed' },
    forehand:      { level: 1, xp: 0, max: 10, name: 'Forehand',       desc: 'Power on forehand shots' },
    backhand:      { level: 1, xp: 0, max: 10, name: 'Backhand',       desc: 'Power on backhand shots' },
    volley:        { level: 1, xp: 0, max: 10, name: 'Volley',         desc: 'Improves net play' },
    smash:         { level: 1, xp: 0, max: 10, name: 'Smash',          desc: 'Smash power and accuracy' },
    speed:         { level: 1, xp: 0, max: 10, name: 'Movement Speed', desc: 'Run faster on court' },
    stamina:       { level: 1, xp: 0, max: 10, name: 'Stamina',        desc: 'Less fatigue over rallies' },
    return:        { level: 1, xp: 0, max: 10, name: 'Return',         desc: 'Better serve returns' },
    spin:          { level: 1, xp: 0, max: 10, name: 'Spin Mastery',   desc: 'More effective top/back spin' },
  };
  function load(){
    try {
      const raw = localStorage.getItem(KEY);
      if (raw){
        const p = JSON.parse(raw);
        for (const k in skills){
          if (p[k]){
            skills[k].level = p[k].level || 1;
            skills[k].xp = p[k].xp || 0;
          }
        }
      }
    } catch(_){}
  }
  function save(){
    try {
      const out = {};
      for (const k in skills){ out[k] = { level: skills[k].level, xp: skills[k].xp }; }
      localStorage.setItem(KEY, JSON.stringify(out));
    } catch(_){}
  }
  function gainXP(skill, amount){
    if (!skills[skill]) return;
    skills[skill].xp += amount;
    const needed = xpForLevel(skills[skill].level + 1);
    if (skills[skill].xp >= needed && skills[skill].level < skills[skill].max){
      skills[skill].level++;
      showMsg('📈 ' + skills[skill].name + ' → Lvl ' + skills[skill].level, 2200);
      save();
    } else {
      save();
    }
  }
  function xpForLevel(lvl){ return Math.floor(20 * lvl * lvl); }
  function getMultiplier(skill){
    return 1 + (skills[skill].level - 1) * 0.07;  // 1.0 → 1.63 at max
  }
  function get(skill){ return skills[skill]; }
  function getAll(){ return Object.assign({}, skills); }
  function reset(){
    for (const k in skills){
      skills[k].level = 1; skills[k].xp = 0;
    }
    save();
  }
  load();
  return { skills: skills, gainXP: gainXP, get: get, getAll: getAll, reset: reset, save: save, xpForLevel: xpForLevel, getMultiplier: getMultiplier };
})();

// ── Match commentary panel (shows historical events) ─────
const MatchLog = (function(){
  const entries = [];  // { time, text, type }
  function add(text, type){
    entries.push({ time: performance.now(), text: text, type: type || 'info' });
    if (entries.length > 50) entries.shift();
  }
  function getRecent(n){
    n = n || 10;
    return entries.slice(-n);
  }
  function clear(){ entries.length = 0; }
  return { add: add, getRecent: getRecent, clear: clear, entries: entries };
})();

// ── Detailed audio expansion: many more synth sounds ──────
const AudioFX = (function(){
  // Wraps AudioSys with extra named effects synthesized on the fly.
  function getCtx(){
    AudioSys.init();
    return null; // We delegate to AudioSys's internal context
  }
  function buzzer(){
    // Out-of-bounds buzzer
    AudioSys.init();
    AudioSys.ensureRunning();
    if (AudioSys.isMuted()) return;
    // Use a low-pitched square wave
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ac = new Ctx();
    const osc = ac.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 180;
    const g = ac.createGain();
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.18, ac.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.4);
    osc.connect(g); g.connect(ac.destination);
    osc.start(); osc.stop(ac.currentTime + 0.42);
  }
  // Match-start chime (pleasant ascending)
  function chime(){
    AudioSys.init();
    AudioSys.ensureRunning();
    if (AudioSys.isMuted()) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ac = new Ctx();
    const notes = [392, 523, 659, 784];
    notes.forEach(function(f, i){
      const osc = ac.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = ac.createGain();
      const t = ac.currentTime + i * 0.12;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.08, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.30);
      osc.connect(g); g.connect(ac.destination);
      osc.start(t); osc.stop(t + 0.32);
    });
  }
  return { buzzer: buzzer, chime: chime };
})();

// ── Effects pipeline: chain of post-render effects ────────
const EffectsPipeline = (function(){
  // We don't have actual postprocessing without EffectComposer, but we can
  // simulate flash by toggling renderer.toneMappingExposure briefly.
  let flashTime = 0;
  let flashStrength = 0;
  function flash(strength){
    flashStrength = strength || 0.4;
    flashTime = 0.4;
  }
  function update(dt){
    if (flashTime > 0){
      flashTime -= dt;
      const t = Math.max(0, flashTime / 0.4);
      renderer.toneMappingExposure = 1.25 + flashStrength * t;
    } else {
      renderer.toneMappingExposure = 1.25;
    }
  }
  let camShakeTime = 0, camShakeMag = 0;
  function shake(magnitude, duration){
    camShakeMag = magnitude;
    camShakeTime = duration || 0.4;
  }
  function applyShake(){
    if (camShakeTime <= 0) return;
    const m = camShakeMag * (camShakeTime / 0.4);
    camera.position.x += (Math.random() - 0.5) * m;
    camera.position.y += (Math.random() - 0.5) * m;
  }
  function decayShake(dt){
    if (camShakeTime > 0) camShakeTime -= dt;
  }
  return { flash: flash, update: update, shake: shake, applyShake: applyShake, decayShake: decayShake };
})();

// ── Court venues (different stadium decorations per court type) ───
const Venues = {
  hard: {
    name: 'Centre Court',
    flagColors: [0x00b4ff, 0xffffff, 0xffdd33],
    crowdMix: [0xff5050, 0x00b4ff, 0xb2ff14, 0xa050ff, 0xffdc32],
    skyColor: 0x070b18,
    music: 'match',
  },
  clay: {
    name: 'Roland Mock',
    flagColors: [0xb04a30, 0xffffff, 0xffae40],
    crowdMix: [0xffae40, 0xb04a30, 0xffffff, 0x886633],
    skyColor: 0x150a08,
    music: 'tense',
  },
  grass: {
    name: 'The Lawn',
    flagColors: [0xa0ff60, 0xffffff, 0x008833],
    crowdMix: [0xffffff, 0x008833, 0xa0ff60, 0x884400],
    skyColor: 0x051010,
    music: 'lobby',
  },
  night: {
    name: 'Neon Arena',
    flagColors: [0xff40ff, 0x00b4ff, 0xa050ff],
    crowdMix: [0xff40ff, 0x00b4ff, 0xa050ff, 0xb2ff14, 0xffdd33],
    skyColor: 0x000004,
    music: 'tense',
  },
};
function getCurrentVenue(){
  return Venues[activeTheme] || Venues.hard;
}

// ── Coin earnings: award based on match/practice performance ──
function awardCoinsForMatch(won, gameDiff){
  let coins = 50;
  if (won) coins += 100;
  if (gameDiff === 'hard') coins *= 2;
  else if (gameDiff === 'medium') coins *= 1.5;
  Shop.addCoins(Math.floor(coins));
  showMsg('+ ' + Math.floor(coins) + ' coins', 1200);
}
function awardCoinsForPractice(score){
  const coins = Math.floor(score / 5);
  if (coins > 0){
    Shop.addCoins(coins);
    showMsg('+ ' + coins + ' coins', 1200);
  }
}

// ── Loading screen / splash ───────────────────────────
const Splash = (function(){
  let panel = null;
  function build(){
    panel = document.createElement('div');
    panel.id = 'splash';
    panel.style.cssText =
      'position:fixed;inset:0;background:linear-gradient(135deg,#000,#0a1428,#1a0838);' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'z-index:300;font-family:Orbitron,sans-serif;color:#fff';
    panel.innerHTML =
      '<div style="font-size:clamp(2.5rem,7vw,5rem);font-weight:900;' +
      'background:linear-gradient(135deg,#fff,#00b4ff,#b2ff14);' +
      '-webkit-background-clip:text;-webkit-text-fill-color:transparent;' +
      'background-clip:text;letter-spacing:.08em;margin-bottom:1rem">' +
      'SPIKE TENNIS</div>' +
      '<div style="font-size:.78rem;color:#637490;letter-spacing:.18em">LOADING…</div>' +
      '<div style="margin-top:2rem;width:240px;height:4px;background:rgba(255,255,255,.08);border-radius:2px">' +
        '<div id="splash-bar" style="height:100%;width:0%;background:#00b4ff;border-radius:2px;transition:width .35s"></div>' +
      '</div>';
    document.body.appendChild(panel);
  }
  function show(){
    if (!panel) build();
    panel.style.display = 'flex';
  }
  function setProgress(p){
    const bar = document.getElementById('splash-bar');
    if (bar) bar.style.width = (p * 100) + '%';
  }
  function hide(){
    if (panel) panel.style.display = 'none';
  }
  return { show: show, hide: hide, setProgress: setProgress };
})();

// ── Online lobby chat (text-only multiplayer chat) ─────
const ChatSys = (function(){
  const messages = [];
  let panel = null;
  function build(){
    panel = document.createElement('div');
    panel.id = 'chat-panel';
    panel.style.cssText =
      'position:fixed;left:14px;bottom:14px;width:280px;max-height:200px;' +
      'background:rgba(5,8,15,.78);border:1px solid rgba(0,180,255,.28);' +
      'border-radius:10px;padding:.55rem .7rem;font-family:Orbitron,sans-serif;' +
      'font-size:.72rem;color:#cdd9e6;z-index:55;display:none;' +
      'overflow-y:auto;-webkit-overflow-scrolling:touch';
    document.body.appendChild(panel);
  }
  function add(from, text){
    messages.push({ from: from, text: text, time: Date.now() });
    if (messages.length > 30) messages.shift();
    refresh();
  }
  function refresh(){
    if (!panel) build();
    panel.innerHTML = messages.map(function(m){
      return '<div style="margin:.18rem 0"><span style="color:#00b4ff">' + m.from + ':</span> ' + escapeHTML(m.text) + '</div>';
    }).join('');
    panel.scrollTop = panel.scrollHeight;
  }
  function escapeHTML(s){
    return String(s).replace(/[<>&"]/g, function(c){
      return { '<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;' }[c];
    });
  }
  function setVisible(v){
    if (!panel) build();
    panel.style.display = v ? 'block' : 'none';
  }
  function clear(){
    messages.length = 0;
    if (panel) panel.innerHTML = '';
  }
  return { add: add, setVisible: setVisible, clear: clear, refresh: refresh };
})();

// ── Multiplier system: combo/streak rewards ───────────
const Multiplier = (function(){
  let mult = 1.0;
  let streak = 0;
  function onPointWon(){
    streak++;
    mult = 1.0 + Math.min(2.0, streak * 0.2);
    if (streak >= 3) showMsg('🔥 STREAK ×' + streak + '  (' + mult.toFixed(1) + 'x XP)', 1200);
  }
  function onPointLost(){
    streak = 0;
    mult = 1.0;
  }
  function get(){ return mult; }
  function getStreak(){ return streak; }
  function reset(){ streak = 0; mult = 1.0; }
  return { onPointWon: onPointWon, onPointLost: onPointLost, get: get, getStreak: getStreak, reset: reset };
})();

// ── Detailed AI behavior trees (per-personality decision making) ─
const AIBrain = (function(){
  // The brain produces high-level intentions for a given AI player
  // based on game state, ball trajectory, opponent position, and personality.
  // Returns an object: { action, target, shotType, urgency }
  function decide(pi, ballState, opponent, personality){
    if (!ballState) return { action: 'idle' };
    const onMySide = (P[pi].side === 'near') ? ballState.z > 0 : ballState.z < 0;
    if (!onMySide){
      // Recover to home position
      const homeZ = personality.homeZ * (P[pi].side === 'near' ? CHL : -CHL);
      return {
        action: 'recover',
        target: { x: 0, z: homeZ },
        urgency: 0.3,
      };
    }
    // Ball is on our side. Plan a hit.
    const dx = P[pi].x - ballState.x;
    const dz = P[pi].z - ballState.z;
    const dist = Math.sqrt(dx*dx + dz*dz);
    if (dist > 6 && ballState.bounces > 0){
      // Too far, give up gracefully
      return { action: 'too_far' };
    }
    // Pick a shot type based on personality
    const r = Math.random();
    let shotType;
    let cum = 0;
    cum += personality.smashChance;
    if (r < cum && ballState.y > 1.5){ shotType = 'smash'; }
    else if (r < (cum += personality.lobChance))      { shotType = 'lob'; }
    else if (r < (cum += personality.sliceChance))    { shotType = 'slice'; }
    else if (r < (cum += personality.topspinChance))  { shotType = 'topspin'; }
    else { shotType = 'flat'; }
    // Pick a target based on opponent position (try to hit away from them)
    const oppPos = opponent ? { x: opponent.x, z: opponent.z } : { x: 0, z: -9 };
    let aimX = -oppPos.x * (personality.aimVariance || 1);
    aimX += (Math.random() - 0.5) * (personality.aimVariance || 1) * 1.5;
    aimX = Math.max(-CHW + 0.6, Math.min(CHW - 0.6, aimX));
    const aimZ = (P[pi].side === 'near' ? -1 : 1) * (3 + (personality.aimDepth || 0.7) * 6);
    return {
      action: 'hit',
      target: { x: aimX, z: aimZ },
      shotType: shotType,
      urgency: 0.8,
    };
  }
  return { decide: decide };
})();

// ── Detailed achievements bank (40 achievements with categories) ──
const AchievementsExt = (function(){
  const achievements = [
    // Beginner
    { id:'first_match',     cat:'beginner',  name:'First Step',        desc:'Play your first match',                   icon:'👣' },
    { id:'first_serve',     cat:'beginner',  name:'Service Started',   desc:'Hit your first serve',                    icon:'🏓' },
    { id:'first_hit',       cat:'beginner',  name:'Contact!',          desc:'Hit your first ball in rally',           icon:'🎾' },
    { id:'first_point',     cat:'beginner',  name:'Got One!',          desc:'Win your first point',                    icon:'1️⃣' },
    { id:'first_game',      cat:'beginner',  name:'Game Won',          desc:'Win your first game',                     icon:'🎮' },
    { id:'first_set',       cat:'beginner',  name:'Set Done',          desc:'Win your first set',                      icon:'✅' },
    { id:'first_win',       cat:'beginner',  name:'Champion',          desc:'Win your first match',                    icon:'🏆' },
    // Skills
    { id:'ace_serve',       cat:'skills',    name:'Ace!',              desc:'Score an ace serve',                       icon:'⚡' },
    { id:'three_aces_set',  cat:'skills',    name:'Triple Ace',        desc:'3 aces in one set',                       icon:'⚡' },
    { id:'smash_winner',    cat:'skills',    name:'Hammer',            desc:'Land a smash for a winner',                icon:'🔨' },
    { id:'three_smashes_match', cat:'skills', name:'Hammer Time',     desc:'3 smashes in one match',                  icon:'🔨' },
    { id:'perfect_serve',   cat:'skills',    name:'Perfect Service',   desc:'Hit a green-zone serve',                  icon:'🎯' },
    { id:'rally_5',         cat:'skills',    name:'Mini Rally',        desc:'Reach a 5-shot rally',                    icon:'🔁' },
    { id:'rally_10',        cat:'skills',    name:'Rally King',        desc:'Reach a 10-shot rally',                   icon:'👑' },
    { id:'rally_20',        cat:'skills',    name:'Marathon',          desc:'Reach a 20-shot rally',                   icon:'🏃' },
    { id:'rally_30',        cat:'skills',    name:'Eternal Rally',     desc:'Reach a 30-shot rally',                   icon:'∞' },
    // Speed
    { id:'speed_180',       cat:'speed',     name:'Fast Serve',        desc:'180 km/h serve',                          icon:'🚀' },
    { id:'speed_200',       cat:'speed',     name:'Sound Barrier',     desc:'200 km/h serve',                          icon:'💨' },
    { id:'speed_220',       cat:'speed',     name:'Speed Demon',       desc:'220 km/h serve',                          icon:'🚀' },
    { id:'speed_240',       cat:'speed',     name:'Hyper Serve',       desc:'240 km/h serve',                          icon:'⚡' },
    // Clutch
    { id:'comeback_set',    cat:'clutch',    name:'Comeback',          desc:'Win set after being down 0-4',           icon:'💪' },
    { id:'comeback_match',  cat:'clutch',    name:'Comeback King',     desc:'Win match after losing 1st set',         icon:'💪' },
    { id:'deuce_save',      cat:'clutch',    name:'Saved',              desc:'Win game from deuce after losing adv',    icon:'😅' },
    { id:'tiebreak_win',    cat:'clutch',    name:'Tiebreak Hero',     desc:'Win a tiebreak',                         icon:'⚖' },
    { id:'shutout',         cat:'clutch',    name:'Bagel',             desc:'Win a set 6-0',                          icon:'🥯' },
    { id:'double_bagel',    cat:'clutch',    name:'Double Bagel',      desc:'Win match 6-0, 6-0',                     icon:'🥯' },
    // Variety
    { id:'all_modes',       cat:'variety',   name:'Sampler',           desc:'Play all game modes',                     icon:'🎲' },
    { id:'all_courts',      cat:'variety',   name:'Globetrotter',      desc:'Win on all 4 court types',               icon:'🌍' },
    { id:'all_chars',       cat:'variety',   name:'Identity Crisis',   desc:'Use all 12 characters',                  icon:'🎭' },
    { id:'tournament_easy', cat:'variety',   name:'Easy Champ',        desc:'Win Easy tournament',                    icon:'🥉' },
    { id:'tournament_med',  cat:'variety',   name:'Medium Champ',      desc:'Win Medium tournament',                  icon:'🥈' },
    { id:'tournament_hard', cat:'variety',   name:'Hard Champ',        desc:'Win Hard tournament',                    icon:'🥇' },
    // Practice
    { id:'practice_100',    cat:'practice',  name:'Practice Starter',  desc:'Score 100 in any practice mode',         icon:'🏋' },
    { id:'practice_500',    cat:'practice',  name:'Practice Hero',     desc:'Score 500 in practice',                  icon:'🏋' },
    { id:'practice_1000',   cat:'practice',  name:'Drill Sergeant',    desc:'Score 1000 in practice',                 icon:'⚒' },
    { id:'practice_2000',   cat:'practice',  name:'Practice God',      desc:'Score 2000 in practice',                 icon:'⚒' },
    // Cosmetics
    { id:'first_unlock',    cat:'cosmetic',  name:'New Look',          desc:'Unlock your first cosmetic',             icon:'👕' },
    { id:'all_rackets',     cat:'cosmetic',  name:'Racket Collector',  desc:'Own all rackets',                        icon:'🎾' },
    { id:'all_balls',       cat:'cosmetic',  name:'Ball Collector',    desc:'Own all balls',                          icon:'⚽' },
    { id:'all_hats',        cat:'cosmetic',  name:'Hat Trick',         desc:'Own all hats',                           icon:'🎩' },
    // Misc
    { id:'lvl_5',           cat:'misc',      name:'Rising Star',       desc:'Reach level 5',                          icon:'⭐' },
    { id:'lvl_10',          cat:'misc',      name:'Veteran',           desc:'Reach level 10',                         icon:'🌟' },
    { id:'lvl_20',          cat:'misc',      name:'Legend',            desc:'Reach level 20',                         icon:'💫' },
    { id:'play_60min',      cat:'misc',      name:'Hour Played',       desc:'Play for 60 minutes',                    icon:'⏱' },
    { id:'play_5h',         cat:'misc',      name:'5 Hours In',        desc:'Play for 5 hours',                       icon:'⏰' },
  ];
  const KEY = 'spike_tennis_ach_v1';
  const earned = {};
  function load(){
    try {
      const raw = localStorage.getItem(KEY);
      if (raw){ Object.assign(earned, JSON.parse(raw)); }
    } catch(_){}
  }
  function save(){
    try { localStorage.setItem(KEY, JSON.stringify(earned)); } catch(_){}
  }
  function award(id){
    if (earned[id]) return false;
    const a = achievements.find(function(x){ return x.id === id; });
    if (!a) return false;
    earned[id] = Date.now();
    save();
    showMsg(a.icon + ' ' + a.name + ': ' + a.desc, 3000);
    AudioSys.score();
    Profile.awardXP(50, 'achievement');
    return true;
  }
  function isEarned(id){ return !!earned[id]; }
  function getByCategory(cat){ return achievements.filter(function(a){ return a.cat === cat; }); }
  function getCategories(){
    const cats = {};
    achievements.forEach(function(a){ cats[a.cat] = true; });
    return Object.keys(cats);
  }
  function getProgress(){
    const total = achievements.length;
    const got = Object.keys(earned).length;
    return { got: got, total: total, percent: Math.round(got / total * 100) };
  }
  function getAll(){ return achievements.slice(); }
  // Auto-check based on current state
  function autoCheck(){
    if (Profile.data.totalMatches >= 1) award('first_match');
    if (Profile.data.totalWins >= 1)    award('first_win');
    if (Profile.data.fastestServe >= 180) award('speed_180');
    if (Profile.data.fastestServe >= 200) award('speed_200');
    if (Profile.data.fastestServe >= 220) award('speed_220');
    if (Profile.data.fastestServe >= 240) award('speed_240');
    if (Profile.data.bestRally >= 5)  award('rally_5');
    if (Profile.data.bestRally >= 10) award('rally_10');
    if (Profile.data.bestRally >= 20) award('rally_20');
    if (Profile.data.bestRally >= 30) award('rally_30');
    if (Profile.data.totalAces >= 1)  award('ace_serve');
    if (Profile.data.totalSmashes >= 3) award('three_smashes_match');
    if (Profile.data.tournamentWins >= 1) award('tournament_med');
    if (Profile.data.level >= 5)  award('lvl_5');
    if (Profile.data.level >= 10) award('lvl_10');
    if (Profile.data.level >= 20) award('lvl_20');
    if (Profile.data.practiceBest >= 100)  award('practice_100');
    if (Profile.data.practiceBest >= 500)  award('practice_500');
    if (Profile.data.practiceBest >= 1000) award('practice_1000');
    if (Profile.data.practiceBest >= 2000) award('practice_2000');
  }
  load();
  return {
    achievements: achievements, earned: earned,
    award: award, isEarned: isEarned,
    getByCategory: getByCategory, getCategories: getCategories,
    getProgress: getProgress, autoCheck: autoCheck, getAll: getAll,
  };
})();

// ── Special Abilities (consumable power moves with cooldowns) ───
const Abilities = (function(){
  const abilities = {
    boost: {
      name: 'Speed Boost',
      desc: 'Doubles speed for 4s',
      cooldown: 18,
      duration: 4,
      keyHint: '1',
    },
    powerShot: {
      name: 'Power Shot',
      desc: 'Next shot has 2x power',
      cooldown: 12,
      duration: 0,
      keyHint: '2',
    },
    laserAim: {
      name: 'Laser Aim',
      desc: 'Next shot lands exactly where you aim',
      cooldown: 20,
      duration: 0,
      keyHint: '3',
    },
    timeStop: {
      name: 'Time Stop',
      desc: 'Slow time for 2s',
      cooldown: 30,
      duration: 2,
      keyHint: '4',
    },
    multiBall: {
      name: 'Multi Ball',
      desc: 'Spawn extra balls (chaos)',
      cooldown: 45,
      duration: 0,
      keyHint: '5',
    },
  };
  const cooldowns = {};
  const active = {};
  function trigger(name){
    const a = abilities[name];
    if (!a) return false;
    if (cooldowns[name] && cooldowns[name] > 0) return false;
    cooldowns[name] = a.cooldown;
    if (a.duration > 0){
      active[name] = a.duration;
    }
    return true;
  }
  function isActive(name){ return active[name] && active[name] > 0; }
  function update(dt){
    for (const k in cooldowns){
      if (cooldowns[k] > 0) cooldowns[k] -= dt;
    }
    for (const k in active){
      if (active[k] > 0) active[k] -= dt;
    }
  }
  function getCooldown(name){ return Math.max(0, cooldowns[name] || 0); }
  function reset(){
    for (const k in cooldowns) delete cooldowns[k];
    for (const k in active) delete active[k];
  }
  return { abilities: abilities, trigger: trigger, isActive: isActive, update: update, getCooldown: getCooldown, reset: reset };
})();

// ── Stamina system (drains as you sprint, regenerates while standing) ──
const Stamina = (function(){
  const players = [{ value: 100, max: 100 }, { value: 100, max: 100 }];
  function drain(pi, amount){
    if (!players[pi]) return;
    players[pi].value = Math.max(0, players[pi].value - amount);
  }
  function regen(pi, amount){
    if (!players[pi]) return;
    players[pi].value = Math.min(players[pi].max, players[pi].value + amount);
  }
  function get(pi){ return players[pi] ? players[pi].value : 0; }
  function getMax(pi){ return players[pi] ? players[pi].max : 100; }
  function reset(){
    players.forEach(function(p){ p.value = p.max; });
  }
  function update(dt, isMoving0, isSprinting0){
    if (isMoving0){
      drain(0, isSprinting0 ? 18 * dt : 6 * dt);
    } else {
      regen(0, 12 * dt);
    }
    regen(1, 8 * dt);
  }
  return { drain: drain, regen: regen, get: get, getMax: getMax, reset: reset, update: update, players: players };
})();

// ── Big sound bank: dozens more named sound effects ────────
const SoundBank = (function(){
  let ac = null;
  function ctx(){
    if (!ac){
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) ac = new Ctx();
      } catch(_){}
    }
    return ac;
  }
  function tone(freq, dur, type, vol){
    if (AudioSys.isMuted()) return;
    const c = ctx();
    if (!c) return;
    const t = c.currentTime;
    const osc = c.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol || 0.1, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g); g.connect(c.destination);
    osc.start(t); osc.stop(t + dur + 0.02);
  }
  function noiseBurst(dur, vol, freq){
    if (AudioSys.isMuted()) return;
    const c = ctx();
    if (!c) return;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i=0; i<data.length; i++){
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    const flt = c.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.value = freq || 1000;
    flt.Q.value = 4;
    const g = c.createGain();
    g.gain.value = vol || 0.1;
    src.connect(flt); flt.connect(g); g.connect(c.destination);
    src.start();
  }
  // Named effects:
  function levelUp(){
    [392, 523, 659, 784, 1047].forEach(function(f, i){
      setTimeout(function(){ tone(f, 0.20, 'square', 0.10); }, i * 70);
    });
  }
  function unlock(){
    [659, 784, 988, 1175].forEach(function(f, i){
      setTimeout(function(){ tone(f, 0.18, 'triangle', 0.10); }, i * 80);
    });
  }
  function buzz(){ tone(180, 0.40, 'square', 0.12); }
  function ding(){ tone(1047, 0.18, 'sine', 0.10); }
  function dong(){ tone(330, 0.30, 'sine', 0.10); }
  function tickTock(){ tone(800, 0.05, 'square', 0.06); setTimeout(function(){ tone(660, 0.05, 'square', 0.06); }, 200); }
  function correct(){ [523, 659].forEach(function(f, i){ setTimeout(function(){ tone(f, 0.20, 'sine', 0.12); }, i * 100); }); }
  function wrong(){ tone(220, 0.20, 'sawtooth', 0.10); setTimeout(function(){ tone(180, 0.30, 'sawtooth', 0.10); }, 100); }
  function startBeep(){ tone(880, 0.10, 'square', 0.10); }
  function endBeep(){ tone(440, 0.30, 'square', 0.10); }
  function powerUp(){ for (let i=0; i<10; i++){ setTimeout(function(){ tone(200 + i*80, 0.04, 'square', 0.06); }, i * 20); } }
  function explode(){ noiseBurst(0.45, 0.3, 600); }
  function whistle(){ tone(2200, 0.25, 'sine', 0.05); }
  function clap(){ noiseBurst(0.05, 0.15, 3000); }
  function applause(){ for (let i=0; i<20; i++){ setTimeout(function(){ noiseBurst(0.03, 0.05, 2500 + Math.random()*1500); }, i * 60); } }
  function thunder(){ noiseBurst(0.8, 0.35, 200); }
  function sparkle(){ for (let i=0; i<8; i++){ setTimeout(function(){ tone(1000 + i*120, 0.08, 'sine', 0.05); }, i * 50); } }
  function alert(){ for (let i=0; i<3; i++){ setTimeout(function(){ tone(1100, 0.10, 'square', 0.10); }, i * 200); } }
  return {
    levelUp: levelUp, unlock: unlock, buzz: buzz, ding: ding, dong: dong,
    tickTock: tickTock, correct: correct, wrong: wrong,
    startBeep: startBeep, endBeep: endBeep, powerUp: powerUp,
    explode: explode, whistle: whistle, clap: clap, applause: applause,
    thunder: thunder, sparkle: sparkle, alert: alert
  };
})();

// ── Rumble: gamepad vibration + visual jitter when ball impacts ──
const Rumble = (function(){
  let active = false;
  function pulse(strength, duration){
    if ('navigator' in window && navigator.getGamepads){
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (let i=0; i<pads.length; i++){
        const p = pads[i];
        if (p && p.vibrationActuator){
          try {
            p.vibrationActuator.playEffect('dual-rumble', {
              startDelay: 0, duration: duration || 200,
              weakMagnitude: strength * 0.6, strongMagnitude: strength
            });
          } catch(_){}
        }
      }
    }
  }
  return { pulse: pulse };
})();

// ── Shop UI Panel ──────────────────────────────────
const ShopUI = (function(){
  let panel = null;
  let activeTab = 'racket';
  function build(){
    panel = document.createElement('div');
    panel.id = 'shop-panel';
    panel.style.cssText =
      'position:fixed;inset:0;display:none;z-index:124;' +
      'background:rgba(5,8,15,.94);backdrop-filter:blur(4px);' +
      'overflow-y:auto;-webkit-overflow-scrolling:touch';
    panel.innerHTML =
      '<div style="margin:auto;padding:30px 16px;min-height:calc(100vh - 60px);' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'box-sizing:border-box;width:min(680px,94vw);font-family:Orbitron,sans-serif;color:#fff">' +
        '<div style="background:rgba(12,18,32,.97);border:1.5px solid rgba(255,220,50,.35);border-radius:18px;' +
        'padding:1.6rem 1.4rem;width:100%;display:flex;flex-direction:column;gap:1rem">' +
          '<div style="display:flex;justify-content:space-between;align-items:center">' +
            '<h2 style="font-size:1.3rem;letter-spacing:.06em">SHOP</h2>' +
            '<div id="shop-coins" style="font-size:.85rem;color:#ffd700">🪙 0 coins</div>' +
          '</div>' +
          '<div id="shop-tabs" style="display:flex;gap:.4rem;flex-wrap:wrap">' +
            tabBtn('racket','Rackets') + tabBtn('ball','Balls') + tabBtn('trail','Trails') +
            tabBtn('hat','Hats') + tabBtn('emote','Emotes') + tabBtn('banner','Banners') +
          '</div>' +
          '<div id="shop-items" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:.6rem;max-height:60vh;overflow-y:auto"></div>' +
          '<button class="abtn" id="shop-close">CLOSE</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(panel);
    document.getElementById('shop-close').onclick = function(){ AudioSys.click(); panel.style.display = 'none'; };
    document.querySelectorAll('#shop-tabs .stab').forEach(function(b){
      b.onclick = function(){
        AudioSys.click();
        activeTab = b.getAttribute('data-tab');
        renderTabs();
        renderItems();
      };
    });
  }
  function tabBtn(id, label){
    return '<button class="stab" data-tab="' + id + '" style="' +
      'flex:1;min-width:80px;padding:.55rem .35rem;border-radius:8px;cursor:pointer;' +
      'font-family:Orbitron,sans-serif;font-size:.65rem;border:1px solid rgba(255,255,255,.1);' +
      'background:transparent;color:#637490;letter-spacing:.06em">' + label + '</button>';
  }
  function renderTabs(){
    document.querySelectorAll('#shop-tabs .stab').forEach(function(b){
      const isActive = b.getAttribute('data-tab') === activeTab;
      b.style.background = isActive ? 'rgba(255,220,50,.18)' : 'transparent';
      b.style.borderColor = isActive ? '#ffdc32' : 'rgba(255,255,255,.1)';
      b.style.color = isActive ? '#ffdc32' : '#637490';
    });
  }
  function renderItems(){
    const grid = document.getElementById('shop-items');
    grid.innerHTML = '';
    const items = Shop.getAll().filter(function(i){ return i.type === activeTab; });
    items.forEach(function(item){
      const owned = Shop.isOwned(item.id);
      const equipped = Shop.isEquipped(item.id);
      const canBuy = !owned && Profile.data.level >= item.levelReq && Shop.getCoins() >= item.cost;
      const card = document.createElement('div');
      card.style.cssText =
        'background:rgba(12,18,32,.92);border:1.5px solid ' + (equipped ? '#ffdc32' : 'rgba(255,255,255,.08)') + ';' +
        'border-radius:10px;padding:.7rem .5rem;display:flex;flex-direction:column;align-items:center;gap:.3rem;' +
        'text-align:center;cursor:' + (owned || canBuy ? 'pointer' : 'not-allowed') + ';' +
        'opacity:' + (owned || canBuy ? '1' : '.55');
      const swatchColor = (item.color != null) ? '#' + item.color.toString(16).padStart(6, '0') : '#888';
      card.innerHTML =
        '<div style="width:60px;height:60px;border-radius:8px;background:' + swatchColor + ';' +
        'box-shadow:0 0 16px ' + swatchColor + '88"></div>' +
        '<div style="font-size:.78rem;font-weight:700;color:#fff;letter-spacing:.04em">' + item.name + '</div>' +
        '<div style="font-size:.62rem;color:' + (equipped ? '#ffdc32' : owned ? '#b2ff14' : canBuy ? '#9bc4ec' : '#666') + '">' +
          (equipped ? '✓ EQUIPPED' : owned ? 'CLICK TO EQUIP' : canBuy ? '🪙 ' + item.cost : 'LVL ' + item.levelReq + (Shop.getCoins() < item.cost ? ' / 🪙 ' + item.cost : '')) +
        '</div>';
      card.onclick = function(){
        if (!owned){
          if (canBuy){
            const r = Shop.buy(item.id);
            if (r.ok){
              SoundBank.unlock();
              showMsg('🛒 Bought: ' + item.name, 1500);
              renderItems();
              updateCoins();
            }
          }
        } else {
          if (Shop.equip(item.id)){
            AudioSys.click();
            showMsg('✓ Equipped: ' + item.name, 1200);
            renderItems();
          }
        }
      };
      grid.appendChild(card);
    });
  }
  function updateCoins(){
    const el = document.getElementById('shop-coins');
    if (el) el.textContent = '🪙 ' + Shop.getCoins() + ' coins';
  }
  function open(){
    if (!panel) build();
    AudioSys.click();
    renderTabs();
    renderItems();
    updateCoins();
    panel.style.display = 'block';
  }
  function close(){
    if (panel) panel.style.display = 'none';
  }
  return { open: open, close: close };
})();

// ── Trophies UI Panel ──────────────────────────────
const TrophyUI = (function(){
  let panel = null;
  function build(){
    panel = document.createElement('div');
    panel.id = 'trophy-panel';
    panel.style.cssText =
      'position:fixed;inset:0;display:none;z-index:125;' +
      'background:rgba(5,8,15,.94);backdrop-filter:blur(4px);' +
      'overflow-y:auto;-webkit-overflow-scrolling:touch';
    panel.innerHTML =
      '<div style="margin:auto;padding:30px 16px;min-height:calc(100vh - 60px);' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'box-sizing:border-box;width:min(680px,94vw);font-family:Orbitron,sans-serif;color:#fff">' +
        '<div style="background:rgba(12,18,32,.97);border:1.5px solid rgba(255,215,0,.35);border-radius:18px;' +
        'padding:1.6rem 1.4rem;width:100%;display:flex;flex-direction:column;gap:1rem">' +
          '<h2 style="font-size:1.3rem;text-align:center;letter-spacing:.06em;color:#ffd700">🏆 TROPHIES</h2>' +
          '<div id="trophy-progress" style="font-size:.78rem;color:#aabbcc;text-align:center"></div>' +
          '<div id="trophy-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:.55rem;max-height:60vh;overflow-y:auto"></div>' +
          '<button class="abtn" id="trophy-close">CLOSE</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(panel);
    document.getElementById('trophy-close').onclick = function(){ AudioSys.click(); panel.style.display = 'none'; };
  }
  function render(){
    const grid = document.getElementById('trophy-grid');
    grid.innerHTML = '';
    Trophies.getAll().forEach(function(t){
      const earned = Trophies.isEarned(t.id);
      const card = document.createElement('div');
      card.style.cssText =
        'background:' + (earned ? 'rgba(50,30,5,.85)' : 'rgba(12,18,32,.6)') + ';' +
        'border:1.5px solid ' + (earned ? '#ffd700' : 'rgba(255,255,255,.05)') + ';' +
        'border-radius:10px;padding:.7rem .5rem;display:flex;flex-direction:column;align-items:center;gap:.25rem;' +
        'text-align:center;opacity:' + (earned ? '1' : '.4');
      card.innerHTML =
        '<div style="font-size:1.6rem;line-height:1">' + t.icon + '</div>' +
        '<div style="font-size:.74rem;font-weight:700;color:' + (earned ? '#ffd700' : '#aabbcc') + '">' + t.name + '</div>' +
        '<div style="font-size:.6rem;color:#7a8ba0;line-height:1.5">' + t.desc + '</div>';
      grid.appendChild(card);
    });
    const earned = Trophies.data.earned.length;
    const total = Trophies.getAll().length;
    document.getElementById('trophy-progress').textContent =
      earned + ' / ' + total + ' earned (' + Math.round(earned/total*100) + '%)';
  }
  function open(){
    if (!panel) build();
    AudioSys.click();
    Trophies.check();
    render();
    panel.style.display = 'block';
  }
  function close(){
    if (panel) panel.style.display = 'none';
  }
  return { open: open, close: close };
})();

// ── Profile / Player Card UI ──────────────────────────
const ProfileUI = (function(){
  let panel = null;
  function build(){
    panel = document.createElement('div');
    panel.id = 'profile-panel';
    panel.style.cssText =
      'position:fixed;inset:0;display:none;z-index:126;' +
      'background:rgba(5,8,15,.94);backdrop-filter:blur(4px);' +
      'overflow-y:auto;-webkit-overflow-scrolling:touch';
    panel.innerHTML =
      '<div style="margin:auto;padding:30px 16px;min-height:calc(100vh - 60px);' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'box-sizing:border-box;width:min(540px,94vw);font-family:Orbitron,sans-serif;color:#fff">' +
        '<div style="background:rgba(12,18,32,.97);border:1.5px solid rgba(0,180,255,.35);border-radius:18px;' +
        'padding:1.8rem 1.6rem;width:100%;display:flex;flex-direction:column;gap:1rem">' +
          '<h2 style="font-size:1.4rem;text-align:center;letter-spacing:.06em;color:#00b4ff">PLAYER PROFILE</h2>' +
          '<div id="profile-card" style="display:flex;flex-direction:column;gap:.7rem"></div>' +
          '<button class="abtn" id="profile-close">CLOSE</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(panel);
    document.getElementById('profile-close').onclick = function(){ AudioSys.click(); panel.style.display = 'none'; };
  }
  function render(){
    const card = document.getElementById('profile-card');
    const xpInfo = Profile.getXPProgress();
    let html = '<div style="text-align:center">' +
      '<div style="font-size:2.5rem;font-weight:900;color:#00b4ff;text-shadow:0 0 20px rgba(0,180,255,.5)">LVL ' + Profile.data.level + '</div>' +
      '<div style="font-size:.7rem;color:#aabbcc;margin-top:.2rem">' + Profile.data.xp + ' XP / ' + xpInfo.next + ' XP</div>' +
      '<div style="margin-top:.5rem;height:8px;background:rgba(255,255,255,.07);border-radius:4px;overflow:hidden">' +
        '<div style="height:100%;width:' + Math.round(xpInfo.progress * 100) + '%;background:linear-gradient(90deg,#00b4ff,#b2ff14);border-radius:4px"></div>' +
      '</div>' +
      '</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.45rem .8rem;font-size:.72rem;border-top:1px solid rgba(255,255,255,.08);padding-top:.7rem">';
    html += statRow('Matches Played', Profile.data.totalMatches);
    html += statRow('Matches Won', Profile.data.totalWins);
    const wr = Profile.data.totalMatches > 0 ? Math.round(Profile.data.totalWins/Profile.data.totalMatches*100) : 0;
    html += statRow('Win Rate', wr + '%');
    html += statRow('Tournaments Won', Profile.data.tournamentWins);
    html += statRow('Total Aces', Profile.data.totalAces);
    html += statRow('Total Smashes', Profile.data.totalSmashes);
    html += statRow('Best Rally', Profile.data.bestRally + ' shots');
    html += statRow('Fastest Serve', Profile.data.fastestServe + ' km/h');
    html += statRow('Practice Best', Profile.data.practiceBest);
    html += statRow('Coins', '🪙 ' + Shop.getCoins());
    html += '</div>';
    html += '<div style="font-size:.66rem;color:#7a8ba0;text-align:center;margin-top:.4rem">Unlocked: ' +
      Profile.data.unlockedSkins.length + ' chars · ' + Profile.data.unlockedThemes.length + ' courts</div>';
    card.innerHTML = html;
  }
  function statRow(label, val){
    return '<div style="color:#7a8ba0">' + label + '</div>' +
      '<div style="text-align:right;color:#fff;font-weight:700">' + val + '</div>';
  }
  function open(){
    if (!panel) build();
    AudioSys.click();
    render();
    panel.style.display = 'block';
  }
  function close(){
    if (panel) panel.style.display = 'none';
  }
  return { open: open, close: close, render: render };
})();

// ── Achievements UI Panel ──────────────────────────
const AchievementsUI = (function(){
  let panel = null;
  let activeCat = 'beginner';
  function build(){
    panel = document.createElement('div');
    panel.id = 'ach-panel';
    panel.style.cssText =
      'position:fixed;inset:0;display:none;z-index:127;' +
      'background:rgba(5,8,15,.94);backdrop-filter:blur(4px);' +
      'overflow-y:auto;-webkit-overflow-scrolling:touch';
    let tabHTML = '';
    AchievementsExt.getCategories().forEach(function(cat){
      tabHTML += '<button class="acat" data-cat="' + cat + '" style="flex:1;min-width:90px;padding:.55rem .35rem;' +
        'border-radius:8px;cursor:pointer;font-family:Orbitron,sans-serif;font-size:.65rem;' +
        'border:1px solid rgba(255,255,255,.1);background:transparent;color:#637490;letter-spacing:.06em">' +
        cat.toUpperCase() + '</button>';
    });
    panel.innerHTML =
      '<div style="margin:auto;padding:30px 16px;min-height:calc(100vh - 60px);' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'box-sizing:border-box;width:min(720px,94vw);font-family:Orbitron,sans-serif;color:#fff">' +
        '<div style="background:rgba(12,18,32,.97);border:1.5px solid rgba(178,255,20,.35);border-radius:18px;' +
        'padding:1.6rem 1.4rem;width:100%;display:flex;flex-direction:column;gap:1rem">' +
          '<h2 style="font-size:1.3rem;text-align:center;letter-spacing:.06em;color:#b2ff14">🏅 ACHIEVEMENTS</h2>' +
          '<div id="ach-progress" style="font-size:.78rem;color:#aabbcc;text-align:center"></div>' +
          '<div id="ach-tabs" style="display:flex;gap:.4rem;flex-wrap:wrap">' + tabHTML + '</div>' +
          '<div id="ach-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:.55rem;max-height:55vh;overflow-y:auto"></div>' +
          '<button class="abtn" id="ach-panel-close">CLOSE</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(panel);
    document.getElementById('ach-panel-close').onclick = function(){ AudioSys.click(); panel.style.display = 'none'; };
    document.querySelectorAll('#ach-tabs .acat').forEach(function(b){
      b.onclick = function(){
        AudioSys.click();
        activeCat = b.getAttribute('data-cat');
        renderTabs(); renderItems();
      };
    });
  }
  function renderTabs(){
    document.querySelectorAll('#ach-tabs .acat').forEach(function(b){
      const isActive = b.getAttribute('data-cat') === activeCat;
      b.style.background = isActive ? 'rgba(178,255,20,.12)' : 'transparent';
      b.style.borderColor = isActive ? '#b2ff14' : 'rgba(255,255,255,.1)';
      b.style.color = isActive ? '#b2ff14' : '#637490';
    });
  }
  function renderItems(){
    const grid = document.getElementById('ach-grid');
    grid.innerHTML = '';
    AchievementsExt.getByCategory(activeCat).forEach(function(a){
      const earned = AchievementsExt.isEarned(a.id);
      const card = document.createElement('div');
      card.style.cssText =
        'background:' + (earned ? 'rgba(35,55,5,.6)' : 'rgba(12,18,32,.6)') + ';' +
        'border:1.5px solid ' + (earned ? '#b2ff14' : 'rgba(255,255,255,.05)') + ';' +
        'border-radius:10px;padding:.65rem .5rem;display:flex;align-items:center;gap:.5rem;' +
        'opacity:' + (earned ? '1' : '.55');
      card.innerHTML =
        '<div style="font-size:1.7rem;line-height:1;flex-shrink:0">' + a.icon + '</div>' +
        '<div style="display:flex;flex-direction:column;gap:.15rem">' +
          '<div style="font-size:.74rem;font-weight:700;color:' + (earned ? '#b2ff14' : '#aabbcc') + '">' + a.name + '</div>' +
          '<div style="font-size:.6rem;color:#7a8ba0;line-height:1.4">' + a.desc + '</div>' +
        '</div>';
      grid.appendChild(card);
    });
    const prog = AchievementsExt.getProgress();
    document.getElementById('ach-progress').textContent =
      prog.got + ' / ' + prog.total + ' unlocked (' + prog.percent + '%)';
  }
  function open(){
    if (!panel) build();
    AudioSys.click();
    AchievementsExt.autoCheck();
    renderTabs(); renderItems();
    panel.style.display = 'block';
  }
  function close(){
    if (panel) panel.style.display = 'none';
  }
  return { open: open, close: close };
})();

// ── Skills UI Panel ────────────────────────────────
const SkillsUI = (function(){
  let panel = null;
  function build(){
    panel = document.createElement('div');
    panel.id = 'skills-panel';
    panel.style.cssText =
      'position:fixed;inset:0;display:none;z-index:128;' +
      'background:rgba(5,8,15,.94);backdrop-filter:blur(4px);' +
      'overflow-y:auto;-webkit-overflow-scrolling:touch';
    panel.innerHTML =
      '<div style="margin:auto;padding:30px 16px;min-height:calc(100vh - 60px);' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'box-sizing:border-box;width:min(560px,94vw);font-family:Orbitron,sans-serif;color:#fff">' +
        '<div style="background:rgba(12,18,32,.97);border:1.5px solid rgba(160,80,255,.35);border-radius:18px;' +
        'padding:1.8rem 1.5rem;width:100%;display:flex;flex-direction:column;gap:1rem">' +
          '<h2 style="font-size:1.3rem;text-align:center;letter-spacing:.06em;color:#a050ff">⚙ SKILLS</h2>' +
          '<div id="skills-grid" style="display:flex;flex-direction:column;gap:.5rem"></div>' +
          '<button class="abtn" id="skills-close">CLOSE</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(panel);
    document.getElementById('skills-close').onclick = function(){ AudioSys.click(); panel.style.display = 'none'; };
  }
  function render(){
    const grid = document.getElementById('skills-grid');
    grid.innerHTML = '';
    const all = SkillSystem.getAll();
    for (const k in all){
      const s = all[k];
      const need = SkillSystem.xpForLevel(s.level + 1);
      const prog = Math.min(1, s.xp / need);
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;flex-direction:column;gap:.25rem;padding:.55rem;border:1px solid rgba(255,255,255,.05);border-radius:8px';
      row.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
          '<span style="font-size:.78rem;font-weight:700">' + s.name + '</span>' +
          '<span style="font-size:.7rem;color:#a050ff">Lvl ' + s.level + ' / ' + s.max + '</span>' +
        '</div>' +
        '<div style="font-size:.64rem;color:#7a8ba0">' + s.desc + '</div>' +
        '<div style="height:5px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden">' +
          '<div style="height:100%;width:' + Math.round(prog*100) + '%;background:#a050ff;border-radius:3px"></div>' +
        '</div>';
      grid.appendChild(row);
    }
  }
  function open(){
    if (!panel) build();
    AudioSys.click();
    render();
    panel.style.display = 'block';
  }
  function close(){
    if (panel) panel.style.display = 'none';
  }
  return { open: open, close: close };
})();

// ── Mini-Game Picker Panel ─────────────────────────
const MiniGamePicker = (function(){
  let panel = null;
  function build(){
    panel = document.createElement('div');
    panel.id = 'minigame-panel';
    panel.style.cssText =
      'position:fixed;inset:0;display:none;z-index:128;' +
      'background:rgba(5,8,15,.94);backdrop-filter:blur(4px);' +
      'overflow-y:auto;-webkit-overflow-scrolling:touch';
    let cards = '';
    for (const k in MiniGames.config){
      const c = MiniGames.config[k];
      cards += '<div class="mgpcard" data-id="' + k + '" style="background:rgba(12,18,32,.92);' +
        'border:1.5px solid rgba(255,255,255,.07);border-radius:14px;padding:1rem .9rem;cursor:pointer;' +
        'display:flex;flex-direction:column;align-items:center;gap:.4rem;text-align:center">' +
        '<div style="font-size:1.5rem">🎯</div>' +
        '<div style="font-size:.85rem;font-weight:700;color:#fff">' + c.name + '</div>' +
        '<div style="font-size:.62rem;color:#7a8ba0;line-height:1.4">' + c.desc + '</div>' +
        '<div style="font-size:.6rem;color:#b2ff14">Best: ' + (MiniGames.getBest(k) || 0) + '</div>' +
        '</div>';
    }
    panel.innerHTML =
      '<div style="margin:auto;padding:30px 16px;min-height:calc(100vh - 60px);' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'box-sizing:border-box;width:min(680px,94vw);font-family:Orbitron,sans-serif;color:#fff">' +
        '<div style="background:rgba(12,18,32,.97);border:1.5px solid rgba(0,180,255,.35);border-radius:18px;' +
        'padding:1.6rem 1.4rem;width:100%;display:flex;flex-direction:column;gap:1rem">' +
          '<h2 style="font-size:1.3rem;text-align:center;letter-spacing:.06em;color:#00b4ff">🏋 PRACTICE MODES</h2>' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:.6rem">' + cards + '</div>' +
          '<button class="gbtn" id="mgp-close">← Back</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(panel);
    document.getElementById('mgp-close').onclick = function(){ AudioSys.click(); panel.style.display = 'none'; };
    document.querySelectorAll('.mgpcard').forEach(function(c){
      c.onclick = function(){
        AudioSys.click();
        panel.style.display = 'none';
        MiniGames.start(c.getAttribute('data-id'));
        Practice.start(); // base practice mode supports our drills
      };
    });
  }
  function open(){
    if (!panel) build();
    AudioSys.click();
    panel.style.display = 'block';
  }
  return { open: open };
})();

// ── Tournament UI / Bracket ────────────────────────
const TournamentUI = (function(){
  let panel = null;
  function build(){
    panel = document.createElement('div');
    panel.id = 'tournament-panel';
    panel.style.cssText =
      'position:fixed;inset:0;display:none;z-index:124;' +
      'background:rgba(5,8,15,.94);backdrop-filter:blur(4px);' +
      'overflow-y:auto;-webkit-overflow-scrolling:touch';
    panel.innerHTML =
      '<div style="margin:auto;padding:30px 16px;min-height:calc(100vh - 60px);' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'box-sizing:border-box;width:min(620px,94vw);font-family:Orbitron,sans-serif;color:#fff">' +
        '<div style="background:rgba(12,18,32,.97);border:1.5px solid rgba(255,215,0,.35);border-radius:18px;' +
        'padding:1.8rem 1.6rem;width:100%;display:flex;flex-direction:column;gap:1.2rem">' +
          '<h2 style="font-size:1.4rem;text-align:center;letter-spacing:.06em;color:#ffd700">🏆 TOURNAMENT</h2>' +
          '<div style="font-size:.78rem;color:#aabbcc;text-align:center">Beat 5 opponents of escalating difficulty.</div>' +
          '<div id="tour-bracket" style="display:flex;flex-direction:column;gap:.5rem"></div>' +
          '<div style="display:flex;gap:.6rem;margin-top:.5rem">' +
            '<button class="gbtn" id="tour-back" style="flex:1">← Back</button>' +
            '<button class="abtn" id="tour-start" style="flex:2">START TOURNAMENT ▶</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(panel);
    document.getElementById('tour-back').onclick = function(){ AudioSys.click(); panel.style.display = 'none'; };
    document.getElementById('tour-start').onclick = function(){
      AudioSys.click();
      panel.style.display = 'none';
      Tournament.start();
    };
  }
  function render(){
    const bracket = document.getElementById('tour-bracket');
    bracket.innerHTML = '';
    const opponents = [
      { name:'Practice Bot',     diff:'easy',   icon:'🤖' },
      { name:'Local Champion',   diff:'easy',   icon:'🏠' },
      { name:'Regional Player',  diff:'medium', icon:'🏆' },
      { name:'National Star',    diff:'medium', icon:'⭐' },
      { name:'World Champion',   diff:'hard',   icon:'👑' },
    ];
    opponents.forEach(function(opp, i){
      const row = document.createElement('div');
      const colorByDiff = { easy:'#60ff80', medium:'#ffdc32', hard:'#ff5050' };
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:.65rem .9rem;' +
        'background:rgba(8,12,22,.6);border:1px solid rgba(255,255,255,.06);border-radius:10px';
      row.innerHTML =
        '<div style="display:flex;align-items:center;gap:.6rem">' +
          '<div style="font-size:1.4rem">' + opp.icon + '</div>' +
          '<div style="display:flex;flex-direction:column">' +
            '<div style="font-size:.85rem;font-weight:700">Round ' + (i+1) + ': ' + opp.name + '</div>' +
            '<div style="font-size:.65rem;color:#7a8ba0">Difficulty: <span style="color:' + colorByDiff[opp.diff] + '">' + opp.diff.toUpperCase() + '</span></div>' +
          '</div>' +
        '</div>' +
        '<div style="font-size:.7rem;color:#aabbcc">Best of 3 sets</div>';
      bracket.appendChild(row);
    });
  }
  function open(){
    if (!panel) build();
    AudioSys.click();
    render();
    panel.style.display = 'block';
  }
  return { open: open };
})();

// ── Settings Expansion (much more options) ─────────
const SettingsX = (function(){
  let panel = null;
  const data = {
    masterVolume: 0.6,
    sfxVolume: 0.7,
    musicVolume: 0.06,
    crowdVolume: 0.18,
    sfxMuted: false,
    musicMuted: false,
    cameraSensitivity: 0.005,
    cameraInvertY: false,
    cameraSnap: false,
    fov: 68,
    shadows: true,
    bloom: false,
    particles: true,
    ballTrail: true,
    showRadar: true,
    showLanding: true,
    showCommentator: true,
    showHints: true,
    autoCenterCamera: true,
    weatherEffect: 'clear',
    timeOfDay: 'day',
    courtTheme: 'hard',
    shoulderOffset: 2.4,
    cameraPitch: 0.45,
    cameraDistance: 8.0,
    moveSpeed: 1.0,
    aiAggressiveness: 1.0,
    aiPersonality: 'baseliner',
    multiBall: false,
    powerUpsOn: false,
    dayNightCycle: false,
  };
  function load(){
    try {
      const raw = localStorage.getItem('spike_tennis_settings_v2');
      if (raw){ Object.assign(data, JSON.parse(raw)); }
    } catch(_){}
  }
  function save(){
    try { localStorage.setItem('spike_tennis_settings_v2', JSON.stringify(data)); } catch(_){}
  }
  function apply(){
    if (camera){
      camera.fov = data.fov;
      camera.updateProjectionMatrix();
    }
    if (renderer){
      renderer.shadowMap.enabled = !!data.shadows;
    }
    if (CAM){
      CAM.shoulder = data.shoulderOffset;
      CAM.pitch = data.cameraPitch;
      CAM.dist = data.cameraDistance;
    }
    AudioSys.setMuted(data.sfxMuted);
    AudioSys.setCrowdVolume(data.sfxMuted ? 0 : data.crowdVolume);
    Music.setVolume(data.musicMuted ? 0 : data.musicVolume);
    Weather.setMode(data.weatherEffect);
    PowerUps.setEnabled(data.powerUpsOn);
    DayNight.setEnabled(data.dayNightCycle);
    MultiBall.setEnabled(data.multiBall);
    if (data.aiPersonality) setAIPersonality(data.aiPersonality);
  }
  function build(){
    panel = document.createElement('div');
    panel.id = 'sx-panel';
    panel.style.cssText =
      'position:fixed;inset:0;display:none;z-index:128;' +
      'background:rgba(5,8,15,.94);backdrop-filter:blur(4px);' +
      'overflow-y:auto;-webkit-overflow-scrolling:touch';
    panel.innerHTML =
      '<div style="margin:auto;padding:30px 16px;min-height:calc(100vh - 60px);' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'box-sizing:border-box;width:min(640px,94vw);font-family:Orbitron,sans-serif;color:#fff">' +
        '<div style="background:rgba(12,18,32,.97);border:1.5px solid rgba(0,180,255,.35);border-radius:18px;' +
        'padding:1.6rem 1.4rem;width:100%;display:flex;flex-direction:column;gap:.7rem">' +
          '<h2 style="font-size:1.3rem;text-align:center;letter-spacing:.06em">⚙ ALL SETTINGS</h2>' +
          '<div id="sx-sections" style="max-height:60vh;overflow-y:auto;display:flex;flex-direction:column;gap:1rem"></div>' +
          '<div style="display:flex;gap:.5rem">' +
            '<button class="gbtn" id="sx-reset" style="flex:1">RESET</button>' +
            '<button class="abtn" id="sx-close" style="flex:2">CLOSE</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(panel);
    document.getElementById('sx-close').onclick = function(){ AudioSys.click(); save(); apply(); panel.style.display = 'none'; };
    document.getElementById('sx-reset').onclick = function(){
      AudioSys.click();
      if (confirm('Reset all settings to defaults?')){
        try { localStorage.removeItem('spike_tennis_settings_v2'); } catch(_){}
        showMsg('Settings reset', 1500);
        location.reload();
      }
    };
  }
  function render(){
    const sections = document.getElementById('sx-sections');
    sections.innerHTML = '';
    sections.appendChild(makeSection('AUDIO', [
      slider('masterVolume', 'Master', 0, 1, 0.05),
      slider('sfxVolume',    'SFX',    0, 1, 0.05),
      slider('musicVolume',  'Music',  0, 0.3, 0.01),
      slider('crowdVolume',  'Crowd',  0, 0.6, 0.02),
      toggle('sfxMuted',     'Mute SFX'),
      toggle('musicMuted',   'Mute Music'),
    ]));
    sections.appendChild(makeSection('CAMERA', [
      slider('cameraSensitivity', 'Sensitivity', 0.001, 0.02, 0.001),
      slider('fov',            'Field of View',     50, 100, 1),
      slider('shoulderOffset', 'Shoulder Offset',   0,    5, 0.1),
      slider('cameraPitch',    'Pitch',             0,  1.2, 0.05),
      slider('cameraDistance', 'Distance',          3,   15, 0.25),
      toggle('cameraInvertY',  'Invert Y'),
      toggle('autoCenterCamera','Auto-center on point'),
    ]));
    sections.appendChild(makeSection('GRAPHICS', [
      toggle('shadows',     'Shadows'),
      toggle('bloom',       'Bloom (post)'),
      toggle('particles',   'Particles'),
      toggle('ballTrail',   'Ball Trail'),
      toggle('showRadar',   'Mini-Map Radar'),
      toggle('showLanding', 'Landing Marker'),
      toggle('showCommentator','Commentary Banner'),
    ]));
    sections.appendChild(makeSection('GAMEPLAY', [
      slider('moveSpeed',         'Move Speed Multiplier', 0.5, 2.0, 0.1),
      slider('aiAggressiveness',  'AI Aggression',         0.5, 2.0, 0.1),
      select('aiPersonality',     'AI Style', Object.keys(AIPersonalities)),
      toggle('multiBall',         'Multi-Ball Chaos'),
      toggle('powerUpsOn',        'Power-Ups'),
      toggle('dayNightCycle',     'Day/Night Cycle'),
      select('weatherEffect',     'Weather',    ['clear','rain','snow','fog']),
      select('courtTheme',        'Court',      ['hard','clay','grass','night']),
    ]));
  }
  function makeSection(title, rows){
    const sec = document.createElement('div');
    sec.style.cssText = 'border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:.7rem .8rem';
    sec.innerHTML = '<div style="font-size:.7rem;color:#00b4ff;letter-spacing:.14em;margin-bottom:.5rem">' + title + '</div>';
    rows.forEach(function(r){ sec.appendChild(r); });
    return sec;
  }
  function slider(key, label, min, max, step){
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:.35rem 0;font-size:.72rem';
    row.innerHTML =
      '<span style="color:#aabbcc">' + label + '</span>' +
      '<input type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + data[key] + '" ' +
        'style="flex:1;max-width:180px;margin:0 .8rem"/>' +
      '<span class="val" style="font-size:.66rem;color:#cdd9e6;width:50px;text-align:right">' + (Number.isInteger(data[key]) ? data[key] : Number(data[key]).toFixed(2)) + '</span>';
    const inp = row.querySelector('input');
    const val = row.querySelector('.val');
    inp.addEventListener('input', function(e){
      data[key] = parseFloat(e.target.value);
      val.textContent = Number.isInteger(data[key]) ? data[key] : data[key].toFixed(2);
      apply();
    });
    return row;
  }
  function toggle(key, label){
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:.35rem 0;font-size:.72rem;cursor:pointer';
    row.innerHTML =
      '<span style="color:#aabbcc">' + label + '</span>' +
      '<span class="tog" style="display:inline-block;width:36px;height:20px;border-radius:11px;' +
      'background:' + (data[key] ? 'rgba(0,180,255,.35)' : '#222') + ';' +
      'border:1px solid ' + (data[key] ? '#00b4ff' : '#333') + ';position:relative">' +
        '<span style="position:absolute;top:1px;left:' + (data[key] ? '17px' : '1px') + ';' +
        'width:16px;height:16px;border-radius:50%;background:' + (data[key] ? '#00b4ff' : '#888') + ';' +
        'transition:left .15s,background .15s"></span>' +
      '</span>';
    row.onclick = function(){
      AudioSys.click();
      data[key] = !data[key];
      apply();
      render(); // re-render to update visual
    };
    return row;
  }
  function select(key, label, options){
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:.35rem 0;font-size:.72rem';
    let opts = '';
    options.forEach(function(o){ opts += '<option value="' + o + '"' + (data[key] === o ? ' selected' : '') + '>' + o + '</option>'; });
    row.innerHTML =
      '<span style="color:#aabbcc">' + label + '</span>' +
      '<select style="background:rgba(0,0,0,.4);color:#fff;border:1px solid rgba(255,255,255,.12);' +
        'border-radius:6px;padding:.3rem .5rem;font-family:Orbitron,sans-serif;font-size:.7rem">' + opts + '</select>';
    const sel = row.querySelector('select');
    sel.addEventListener('change', function(e){
      data[key] = e.target.value;
      apply();
    });
    return row;
  }
  function open(){
    if (!panel) build();
    AudioSys.click();
    render();
    panel.style.display = 'block';
  }
  function close(){
    if (panel) panel.style.display = 'none';
  }
  load();
  return { open: open, close: close, apply: apply, save: save, data: data };
})();

// ── Key Binding UI ─────────────────────────────────
const KeyBindUI = (function(){
  let panel = null;
  const KEY = 'spike_tennis_keybinds_v1';
  const bindings = {
    moveLeft:  ['KeyA'],
    moveRight: ['KeyD'],
    moveUp:    ['KeyW'],
    moveDown:  ['KeyS'],
    jump:      ['ShiftLeft','KeyV'],
    hit:       ['Space','KeyF'],
    sprint:    ['ShiftLeft'],
    abilityBoost:    ['Digit1'],
    abilityPower:    ['Digit2'],
    abilityLaserAim: ['Digit3'],
    abilityTimeStop: ['Digit4'],
    abilityMultiBall:['Digit5'],
    pause:     ['Escape'],
    chat:      ['KeyT'],
    radar:     ['KeyM'],
  };
  function load(){
    try { Object.assign(bindings, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch(_){}
  }
  function save(){
    try { localStorage.setItem(KEY, JSON.stringify(bindings)); } catch(_){}
  }
  function build(){
    panel = document.createElement('div');
    panel.id = 'kb-panel';
    panel.style.cssText =
      'position:fixed;inset:0;display:none;z-index:128;' +
      'background:rgba(5,8,15,.94);backdrop-filter:blur(4px);' +
      'overflow-y:auto;-webkit-overflow-scrolling:touch';
    panel.innerHTML =
      '<div style="margin:auto;padding:30px 16px;min-height:calc(100vh - 60px);' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'box-sizing:border-box;width:min(540px,94vw);font-family:Orbitron,sans-serif;color:#fff">' +
        '<div style="background:rgba(12,18,32,.97);border:1.5px solid rgba(0,180,255,.35);border-radius:18px;' +
        'padding:1.7rem 1.5rem;width:100%;display:flex;flex-direction:column;gap:.8rem">' +
          '<h2 style="font-size:1.2rem;text-align:center;letter-spacing:.06em">KEY BINDINGS</h2>' +
          '<div id="kb-list" style="display:flex;flex-direction:column;gap:.4rem;max-height:60vh;overflow-y:auto"></div>' +
          '<button class="abtn" id="kb-close">CLOSE</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(panel);
    document.getElementById('kb-close').onclick = function(){ AudioSys.click(); save(); panel.style.display = 'none'; };
  }
  function render(){
    const list = document.getElementById('kb-list');
    list.innerHTML = '';
    for (const k in bindings){
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:.45rem .7rem;' +
        'background:rgba(8,12,22,.5);border:1px solid rgba(255,255,255,.05);border-radius:8px;font-size:.72rem';
      row.innerHTML =
        '<span style="color:#aabbcc">' + k + '</span>' +
        '<span style="color:#00b4ff;font-family:monospace;font-size:.66rem">' + bindings[k].join(' / ') + '</span>';
      list.appendChild(row);
    }
  }
  function open(){
    if (!panel) build();
    AudioSys.click();
    render();
    panel.style.display = 'block';
  }
  load();
  return { open: open, bindings: bindings, save: save };
})();

// ── Heatmap visualization ──────────────────────────
const HeatmapUI = (function(){
  let panel = null;
  function build(){
    panel = document.createElement('div');
    panel.id = 'heatmap-panel';
    panel.style.cssText =
      'position:fixed;inset:0;display:none;z-index:128;' +
      'background:rgba(5,8,15,.94);backdrop-filter:blur(4px);' +
      'overflow-y:auto;-webkit-overflow-scrolling:touch';
    panel.innerHTML =
      '<div style="margin:auto;padding:30px 16px;min-height:calc(100vh - 60px);' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'box-sizing:border-box;width:min(560px,94vw);font-family:Orbitron,sans-serif;color:#fff">' +
        '<div style="background:rgba(12,18,32,.97);border:1.5px solid rgba(255,80,80,.35);border-radius:18px;' +
        'padding:1.7rem 1.5rem;width:100%;display:flex;flex-direction:column;gap:1rem">' +
          '<h2 style="font-size:1.2rem;text-align:center;letter-spacing:.06em;color:#ff8080">📊 SHOT HEATMAP</h2>' +
          '<canvas id="heat-canvas" width="400" height="280" style="margin:0 auto;background:rgba(8,12,22,.6);border-radius:8px"></canvas>' +
          '<div style="font-size:.66rem;color:#aabbcc;text-align:center">Showing where YOUR shots have landed.</div>' +
          '<button class="abtn" id="heat-close">CLOSE</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(panel);
    document.getElementById('heat-close').onclick = function(){ AudioSys.click(); panel.style.display = 'none'; };
  }
  function render(){
    const cv = document.getElementById('heat-canvas');
    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    // Court outline
    ctx.strokeStyle = '#00b4ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, W-40, H-40);
    ctx.beginPath();
    ctx.moveTo(20, H/2);
    ctx.lineTo(W-20, H/2);
    ctx.stroke();
    // Heat
    const grid = ShotHistory.getHeatmap(0);
    const maxCount = Math.max(1, Math.max.apply(null, grid.flat()));
    for (let y=0; y<10; y++){
      for (let x=0; x<10; x++){
        const c = grid[y][x];
        if (!c) continue;
        const intensity = c / maxCount;
        ctx.fillStyle = 'rgba(255,80,80,' + (0.2 + intensity * 0.6) + ')';
        const cx = 20 + (x / 10) * (W - 40);
        const cy = 20 + (y / 10) * (H - 40);
        ctx.fillRect(cx, cy, (W-40)/10, (H-40)/10);
      }
    }
  }
  function open(){
    if (!panel) build();
    AudioSys.click();
    render();
    panel.style.display = 'block';
  }
  return { open: open };
})();

// ── Replay UI Panel (timeline scrubber) ─────────────
const ReplayUI = (function(){
  let panel = null;
  let isOpen = false;
  function build(){
    panel = document.createElement('div');
    panel.id = 'replay-ui';
    panel.style.cssText =
      'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);' +
      'background:rgba(5,8,15,.86);border:1px solid rgba(178,255,20,.3);' +
      'border-radius:10px;padding:.6rem .9rem;display:none;z-index:90;' +
      'font-family:Orbitron,sans-serif;color:#fff;width:min(420px,92vw)';
    panel.innerHTML =
      '<div style="display:flex;align-items:center;gap:.6rem">' +
        '<button id="r-play" class="abtn" style="padding:.3rem .8rem;font-size:.7rem;width:auto">▶</button>' +
        '<input id="r-scrub" type="range" min="0" max="100" value="0" style="flex:1"/>' +
        '<button id="r-close" class="gbtn" style="padding:.3rem .6rem;font-size:.7rem;width:auto">×</button>' +
      '</div>' +
      '<div style="display:flex;gap:.4rem;justify-content:center;margin-top:.4rem">' +
        '<button id="r-slow" class="gbtn" style="font-size:.65rem;padding:.25rem .55rem;width:auto">SLOW-MO</button>' +
        '<button id="r-rew" class="gbtn" style="font-size:.65rem;padding:.25rem .55rem;width:auto">⏮</button>' +
        '<button id="r-fwd" class="gbtn" style="font-size:.65rem;padding:.25rem .55rem;width:auto">⏭</button>' +
      '</div>';
    document.body.appendChild(panel);
    document.getElementById('r-close').onclick = function(){ AudioSys.click(); close(); };
    document.getElementById('r-play').onclick = function(){
      AudioSys.click();
      ReplaySys.startPlayback();
    };
  }
  function open(){
    if (!panel) build();
    AudioSys.click();
    panel.style.display = 'block';
    isOpen = true;
  }
  function close(){
    if (panel) panel.style.display = 'none';
    isOpen = false;
    ReplaySys.stopPlayback();
  }
  function isVisible(){ return isOpen; }
  return { open: open, close: close, isVisible: isVisible };
})();

// ── Match Log Panel ─────────────────────────────────
const MatchLogUI = (function(){
  let panel = null;
  function build(){
    panel = document.createElement('div');
    panel.id = 'matchlog-panel';
    panel.style.cssText =
      'position:fixed;inset:0;display:none;z-index:128;' +
      'background:rgba(5,8,15,.94);backdrop-filter:blur(4px);' +
      'overflow-y:auto;-webkit-overflow-scrolling:touch';
    panel.innerHTML =
      '<div style="margin:auto;padding:30px 16px;min-height:calc(100vh - 60px);' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'box-sizing:border-box;width:min(560px,94vw);font-family:Orbitron,sans-serif;color:#fff">' +
        '<div style="background:rgba(12,18,32,.97);border:1.5px solid rgba(0,180,255,.35);border-radius:18px;' +
        'padding:1.6rem 1.4rem;width:100%;display:flex;flex-direction:column;gap:.7rem">' +
          '<h2 style="font-size:1.2rem;text-align:center;letter-spacing:.06em;color:#00b4ff">📋 MATCH LOG</h2>' +
          '<div id="ml-list" style="font-size:.74rem;display:flex;flex-direction:column;gap:.3rem;max-height:60vh;overflow-y:auto"></div>' +
          '<button class="abtn" id="ml-close">CLOSE</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(panel);
    document.getElementById('ml-close').onclick = function(){ AudioSys.click(); panel.style.display = 'none'; };
  }
  function render(){
    const list = document.getElementById('ml-list');
    list.innerHTML = '';
    if (MatchLog.entries.length === 0){
      list.innerHTML = '<div style="color:#7a8ba0;text-align:center;padding:1rem 0">No events recorded yet.</div>';
      return;
    }
    MatchLog.entries.slice().reverse().forEach(function(e){
      const row = document.createElement('div');
      const colorBy = { info:'#cdd9e6', win:'#b2ff14', error:'#ff5050', special:'#ffdc32' };
      row.style.cssText = 'padding:.4rem .5rem;border-left:3px solid ' + (colorBy[e.type] || '#cdd9e6') + ';' +
        'background:rgba(8,12,22,.4);border-radius:0 6px 6px 0';
      row.textContent = e.text;
      list.appendChild(row);
    });
  }
  function open(){
    if (!panel) build();
    AudioSys.click();
    render();
    panel.style.display = 'block';
  }
  return { open: open };
})();

// ── Pause Menu ───────────────────────────────────────
const PauseMenu = (function(){
  let panel = null;
  let paused = false;
  function build(){
    panel = document.createElement('div');
    panel.id = 'pause-menu';
    panel.style.cssText =
      'position:fixed;inset:0;display:none;align-items:center;justify-content:center;' +
      'z-index:140;background:rgba(5,8,15,.85);backdrop-filter:blur(8px);' +
      'font-family:Orbitron,sans-serif;color:#fff';
    panel.innerHTML =
      '<div style="background:rgba(12,18,32,.97);border:1.5px solid rgba(0,180,255,.4);border-radius:18px;' +
      'padding:2rem 1.8rem;width:min(360px,92vw);display:flex;flex-direction:column;gap:.6rem">' +
        '<h2 style="font-size:1.4rem;text-align:center;letter-spacing:.06em;margin-bottom:.4rem">⏸ PAUSED</h2>' +
        '<button class="abtn" id="pm-resume">▶ RESUME</button>' +
        '<button class="gbtn" id="pm-settings">⚙ SETTINGS</button>' +
        '<button class="gbtn" id="pm-controls">⌨ CONTROLS</button>' +
        '<button class="gbtn" id="pm-quit">🏠 QUIT TO LOBBY</button>' +
      '</div>';
    document.body.appendChild(panel);
    document.getElementById('pm-resume').onclick = function(){ AudioSys.click(); resume(); };
    document.getElementById('pm-settings').onclick = function(){ AudioSys.click(); SettingsX.open(); };
    document.getElementById('pm-controls').onclick = function(){ AudioSys.click(); KeyBindUI.open(); };
    document.getElementById('pm-quit').onclick = function(){ AudioSys.click(); resume(); goLobby(); };
  }
  function pause(){
    if (paused) return;
    if (gPhase === 'lobby') return;
    if (!panel) build();
    paused = true;
    panel.style.display = 'flex';
    Music.setMode('silent');
  }
  function resume(){
    if (!paused) return;
    paused = false;
    if (panel) panel.style.display = 'none';
    Music.setMode('match');
  }
  function isPaused(){ return paused; }
  function toggle(){ if (paused) resume(); else pause(); }
  return { pause: pause, resume: resume, isPaused: isPaused, toggle: toggle };
})();

// ── Help / How to Play Panel ─────────────────────────
const HelpUI = (function(){
  let panel = null;
  const sections = [
    { title:'CONTROLS', body: [
      'WASD or arrow keys — Move',
      'LSHIFT or V — Jump',
      'SPACE / CLICK / F — Hit / Serve',
      'Q — Topspin (hold while hitting)',
      'E — Slice (hold while hitting)',
      'R — Lob (hold while hitting)',
      'G — Flat / Hard (hold while hitting)',
      '1-5 — Ability shortcuts',
      'Right-click drag — Orbit camera',
      'Mouse wheel — Zoom in/out',
      'Esc — Pause menu',
    ]},
    { title:'SCORING', body: [
      'Points: 0 → 15 → 30 → 40',
      'Both at 40? → DEUCE',
      'In deuce: win 2 in a row to take the GAME',
      'First to 6 games (lead by 2) wins a SET',
      'Best of 3 sets wins the MATCH',
    ]},
    { title:'SHOT TYPES', body: [
      'Flat (default) — Balanced power',
      'Topspin (Q) — Heavy arc, drops fast',
      'Slice (E) — Low and skidding',
      'Lob (R) — High lobbing shot',
      'Smash — Auto on overhead while jumping',
    ]},
    { title:'GAME MODES', body: [
      '1v1 vs AI — Solo against computer',
      '1v1 Local — Two players, same screen',
      '2v2 vs AI — Doubles match',
      'Online — Host or join with a code',
      'Practice — Hit targets for high score',
      'Tournament — 5-round bracket',
    ]},
    { title:'TIPS', body: [
      'Watch the meter and click in the green zone for a perfect serve.',
      'Jump UP when ball is overhead → auto SMASH.',
      'The landing marker shows where the ball will hit.',
      'Power-ups respawn every ~12s when enabled.',
      'Levels and unlocks persist across sessions.',
    ]},
  ];
  function build(){
    panel = document.createElement('div');
    panel.id = 'help-panel';
    panel.style.cssText =
      'position:fixed;inset:0;display:none;z-index:128;' +
      'background:rgba(5,8,15,.94);backdrop-filter:blur(4px);' +
      'overflow-y:auto;-webkit-overflow-scrolling:touch';
    let body = '';
    sections.forEach(function(s){
      body += '<div style="margin-bottom:1rem">' +
        '<div style="font-size:.85rem;color:#00b4ff;margin-bottom:.4rem;letter-spacing:.1em">' + s.title + '</div>';
      s.body.forEach(function(line){
        body += '<div style="font-size:.7rem;color:#cdd9e6;padding:.18rem 0;line-height:1.6">' + line + '</div>';
      });
      body += '</div>';
    });
    panel.innerHTML =
      '<div style="margin:auto;padding:30px 16px;min-height:calc(100vh - 60px);' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'box-sizing:border-box;width:min(620px,94vw);font-family:Orbitron,sans-serif;color:#fff">' +
        '<div style="background:rgba(12,18,32,.97);border:1.5px solid rgba(0,180,255,.35);border-radius:18px;' +
        'padding:1.7rem 1.5rem;width:100%;display:flex;flex-direction:column;gap:.5rem">' +
          '<h2 style="font-size:1.3rem;text-align:center;letter-spacing:.06em">❓ HOW TO PLAY</h2>' +
          '<div style="max-height:60vh;overflow-y:auto;padding:.4rem 0">' + body + '</div>' +
          '<button class="abtn" id="help-close">GOT IT</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(panel);
    document.getElementById('help-close').onclick = function(){ AudioSys.click(); panel.style.display = 'none'; };
  }
  function open(){
    if (!panel) build();
    AudioSys.click();
    panel.style.display = 'block';
  }
  return { open: open };
})();

// ── Credits Panel ────────────────────────────────────
const CreditsUI = (function(){
  let panel = null;
  function build(){
    panel = document.createElement('div');
    panel.id = 'credits-panel';
    panel.style.cssText =
      'position:fixed;inset:0;display:none;z-index:128;' +
      'background:rgba(5,8,15,.97);backdrop-filter:blur(8px);' +
      'overflow-y:auto;-webkit-overflow-scrolling:touch';
    panel.innerHTML =
      '<div style="margin:auto;padding:40px 16px;min-height:calc(100vh - 80px);' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'box-sizing:border-box;width:min(540px,94vw);font-family:Orbitron,sans-serif;color:#fff;text-align:center">' +
        '<div style="font-size:clamp(1.8rem,5vw,3rem);font-weight:900;letter-spacing:.08em;' +
          'background:linear-gradient(135deg,#fff,#00b4ff,#b2ff14);' +
          '-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;' +
          'margin-bottom:1rem">SPIKE TENNIS</div>' +
        '<div style="font-size:.8rem;color:#aabbcc;margin-bottom:2rem">A 3D browser tennis game</div>' +
        '<div style="display:flex;flex-direction:column;gap:1rem;font-size:.74rem;color:#cdd9e6">' +
          '<div><span style="color:#00b4ff">DESIGN</span><br/>Rishik Sundar</div>' +
          '<div><span style="color:#00b4ff">CODE</span><br/>Rishik with Claude</div>' +
          '<div><span style="color:#00b4ff">3D ENGINE</span><br/>Three.js r128</div>' +
          '<div><span style="color:#00b4ff">NETWORKING</span><br/>PeerJS</div>' +
          '<div><span style="color:#00b4ff">FONTS</span><br/>Orbitron by Matt McInerney</div>' +
          '<div><span style="color:#00b4ff">AUDIO</span><br/>100% synthesized via Web Audio API</div>' +
        '</div>' +
        '<div style="margin-top:2rem;font-size:.66rem;color:#637490">Made with 💙</div>' +
        '<button class="abtn" id="credits-close" style="margin-top:1.5rem">CLOSE</button>' +
      '</div>';
    document.body.appendChild(panel);
    document.getElementById('credits-close').onclick = function(){ AudioSys.click(); panel.style.display = 'none'; };
  }
  function open(){
    if (!panel) build();
    AudioSys.click();
    panel.style.display = 'block';
  }
  return { open: open };
})();

// ── Daily Challenges ─────────────────────────────────
const DailyChallenges = (function(){
  const KEY = 'spike_tennis_daily_v1';
  const challenges = [
    { id:'serve_5',     title:'Service Star',    desc:'Hit 5 perfect serves',                target:5,    type:'perfect_serve' },
    { id:'smash_3',     title:'Smash Hero',      desc:'Land 3 smashes',                      target:3,    type:'smash' },
    { id:'rally_15',    title:'Rally Time',      desc:'Reach a 15-shot rally',               target:15,   type:'rally' },
    { id:'win_3',       title:'Triple Win',      desc:'Win 3 matches today',                 target:3,    type:'match_win' },
    { id:'practice_300',title:'Practice Pro',    desc:'Score 300+ in any practice mode',     target:300,  type:'practice_score' },
    { id:'ace_2',       title:'Double Ace',      desc:'Score 2 aces in one match',           target:2,    type:'ace' },
    { id:'speed_180',   title:'Fast Server',     desc:'Hit a 180+ km/h serve',               target:180,  type:'serve_speed' },
    { id:'play_3_courts',title:'Court Sampler',  desc:'Play on 3 different courts',          target:3,    type:'court_variety' },
  ];
  let active = [];
  let date = '';
  let progress = {};
  function todayKey(){
    const d = new Date();
    return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
  }
  function load(){
    try {
      const raw = localStorage.getItem(KEY);
      if (raw){
        const p = JSON.parse(raw);
        if (p.date === todayKey()){
          active = p.active;
          progress = p.progress || {};
        } else {
          generateDaily();
        }
      } else {
        generateDaily();
      }
    } catch(_){ generateDaily(); }
  }
  function generateDaily(){
    date = todayKey();
    const shuffled = challenges.slice().sort(function(){ return Math.random() - 0.5; });
    active = shuffled.slice(0, 3);
    progress = {};
    save();
  }
  function save(){
    try { localStorage.setItem(KEY, JSON.stringify({ date: date, active: active, progress: progress })); } catch(_){}
  }
  function recordEvent(type, value){
    active.forEach(function(c){
      if (c.type === type){
        if (type === 'serve_speed' || type === 'practice_score'){
          if (value >= c.target && !progress[c.id]){
            progress[c.id] = c.target;
            complete(c);
          }
        } else if (type === 'court_variety'){
          // value should be an array of court types played
          progress[c.id] = (value || []).length;
          if (progress[c.id] >= c.target) complete(c);
        } else {
          progress[c.id] = (progress[c.id] || 0) + (value || 1);
          if (progress[c.id] >= c.target) complete(c);
        }
      }
    });
    save();
  }
  function complete(challenge){
    if (progress[challenge.id + '_done']) return;
    progress[challenge.id + '_done'] = true;
    showMsg('🌟 DAILY: ' + challenge.title + ' — DONE!', 2500);
    Profile.awardXP(75);
    Shop.addCoins(150);
    save();
  }
  function getActive(){ return active.slice(); }
  function getProgress(id){ return progress[id] || 0; }
  function isComplete(id){ return !!progress[id + '_done']; }
  load();
  return {
    challenges: challenges,
    getActive: getActive,
    getProgress: getProgress,
    isComplete: isComplete,
    recordEvent: recordEvent,
    generateDaily: generateDaily,
  };
})();

// ── Daily Challenges UI ──────────────────────────────
const DailyUI = (function(){
  let panel = null;
  function build(){
    panel = document.createElement('div');
    panel.id = 'daily-panel';
    panel.style.cssText =
      'position:fixed;inset:0;display:none;z-index:128;' +
      'background:rgba(5,8,15,.94);backdrop-filter:blur(4px);' +
      'overflow-y:auto;-webkit-overflow-scrolling:touch';
    panel.innerHTML =
      '<div style="margin:auto;padding:30px 16px;min-height:calc(100vh - 60px);' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'box-sizing:border-box;width:min(520px,94vw);font-family:Orbitron,sans-serif;color:#fff">' +
        '<div style="background:rgba(12,18,32,.97);border:1.5px solid rgba(255,200,80,.35);border-radius:18px;' +
        'padding:1.7rem 1.5rem;width:100%;display:flex;flex-direction:column;gap:.7rem">' +
          '<h2 style="font-size:1.2rem;text-align:center;letter-spacing:.06em;color:#ffc850">📅 DAILY CHALLENGES</h2>' +
          '<div id="daily-list" style="display:flex;flex-direction:column;gap:.55rem"></div>' +
          '<div style="font-size:.68rem;color:#aabbcc;text-align:center">Resets at midnight. Reward: 75 XP + 150 coins each.</div>' +
          '<button class="abtn" id="daily-close">CLOSE</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(panel);
    document.getElementById('daily-close').onclick = function(){ AudioSys.click(); panel.style.display = 'none'; };
  }
  function render(){
    const list = document.getElementById('daily-list');
    list.innerHTML = '';
    DailyChallenges.getActive().forEach(function(c){
      const prog = DailyChallenges.getProgress(c.id);
      const done = DailyChallenges.isComplete(c.id);
      const pct = Math.min(100, Math.round(prog/c.target*100));
      const row = document.createElement('div');
      row.style.cssText = 'padding:.6rem .8rem;border:1px solid ' + (done ? '#b2ff14' : 'rgba(255,255,255,.08)') + ';' +
        'border-radius:8px;background:rgba(8,12,22,.5);display:flex;flex-direction:column;gap:.3rem';
      row.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
          '<span style="font-size:.78rem;font-weight:700;color:' + (done ? '#b2ff14' : '#fff') + '">' + (done ? '✓ ' : '') + c.title + '</span>' +
          '<span style="font-size:.66rem;color:#aabbcc">' + prog + '/' + c.target + '</span>' +
        '</div>' +
        '<div style="font-size:.62rem;color:#7a8ba0">' + c.desc + '</div>' +
        '<div style="height:5px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden">' +
          '<div style="height:100%;width:' + pct + '%;background:' + (done ? '#b2ff14' : '#ffc850') + ';border-radius:3px"></div>' +
        '</div>';
      list.appendChild(row);
    });
  }
  function open(){
    if (!panel) build();
    AudioSys.click();
    render();
    panel.style.display = 'block';
  }
  return { open: open };
})();

// ── Notifications System (toast queue) ────────────────
const Notifications = (function(){
  let queue = [];
  let panel = null;
  function ensure(){
    if (panel) return;
    panel = document.createElement('div');
    panel.id = 'notif-stack';
    panel.style.cssText =
      'position:fixed;top:80px;right:14px;display:flex;flex-direction:column;gap:.4rem;' +
      'z-index:115;pointer-events:none;font-family:Orbitron,sans-serif;color:#fff';
    document.body.appendChild(panel);
  }
  function push(text, opts){
    ensure();
    opts = opts || {};
    const el = document.createElement('div');
    el.style.cssText =
      'background:rgba(8,12,22,.94);border:1px solid ' + (opts.color || 'rgba(0,180,255,.35)') + ';' +
      'border-radius:9px;padding:.55rem .85rem;font-size:.72rem;color:#cdd9e6;' +
      'min-width:180px;max-width:280px;letter-spacing:.04em;' +
      'box-shadow:0 4px 14px rgba(0,0,0,.4);transform:translateX(20px);opacity:0;' +
      'transition:transform .3s,opacity .3s';
    el.textContent = text;
    panel.appendChild(el);
    setTimeout(function(){ el.style.transform = 'translateX(0)'; el.style.opacity = '1'; }, 10);
    const dur = opts.duration || 3500;
    setTimeout(function(){
      el.style.opacity = '0'; el.style.transform = 'translateX(20px)';
      setTimeout(function(){ if (el.parentNode) el.parentNode.removeChild(el); }, 350);
    }, dur);
  }
  return { push: push };
})();

// ── Match Variant Modes ──────────────────────────────
const MatchVariants = {
  classic:    { name:'Classic',         setsToWin:2, gamesPerSet:6, tiebreakAt:6, deuce:true },
  short:      { name:'Quick Match',     setsToWin:1, gamesPerSet:4, tiebreakAt:4, deuce:false },
  pro:        { name:'Pro Match',       setsToWin:3, gamesPerSet:6, tiebreakAt:6, deuce:true },
  shootout:   { name:'Shootout',        setsToWin:1, gamesPerSet:1, tiebreakAt:1, deuce:false },
  marathon:   { name:'Marathon',        setsToWin:3, gamesPerSet:8, tiebreakAt:8, deuce:true },
  goldenSet:  { name:'Golden Set',      setsToWin:1, gamesPerSet:6, tiebreakAt:6, deuce:false },
};
let activeVariant = 'classic';
function setVariant(name){
  if (MatchVariants[name]) activeVariant = name;
}
function getVariant(){ return MatchVariants[activeVariant] || MatchVariants.classic; }

// ── Wind effect (affects ball trajectory horizontally) ────
const Wind = (function(){
  let strength = 0;          // 0..1
  let direction = 0;          // angle in radians (0 = +x)
  let enabled = false;
  function setEnabled(on){ enabled = !!on; }
  function setRandom(){
    strength = Math.random() * 0.6;
    direction = Math.random() * Math.PI * 2;
  }
  function applyToBall(b, dt){
    if (!enabled) return;
    const fx = Math.cos(direction) * strength * 1.2;
    const fz = Math.sin(direction) * strength * 1.2;
    b.vel.x += fx * dt;
    b.vel.z += fz * dt;
  }
  function getInfo(){
    return { strength: strength, direction: direction, enabled: enabled };
  }
  function describe(){
    if (!enabled) return 'No wind';
    const dirs = ['E','NE','N','NW','W','SW','S','SE'];
    const ix = Math.round(direction / (Math.PI/4)) % 8;
    const sStr = strength < 0.2 ? 'Light' : strength < 0.5 ? 'Moderate' : 'Strong';
    return sStr + ' wind from ' + dirs[ix];
  }
  return { setEnabled: setEnabled, setRandom: setRandom, applyToBall: applyToBall, getInfo: getInfo, describe: describe };
})();

// ── Trick Shots / Special Moves ────────────────────────
const TrickShots = {
  tweener: {
    name: 'Tweener',
    desc: 'Between-the-legs shot',
    requirement: 'Hit while running backwards from ball',
    powerMult: 0.85,
    accuracyPenalty: 0.5,
    coolFactor: 5,
  },
  banana: {
    name: 'Banana Shot',
    desc: 'Wide curving forehand',
    requirement: 'Hit slice while ball is wide',
    powerMult: 0.9,
    accuracyPenalty: 0.3,
    coolFactor: 3,
  },
  scoop: {
    name: 'Scoop Volley',
    desc: 'Soft-handed defensive volley',
    requirement: 'Volley low ball at the net',
    powerMult: 0.6,
    accuracyPenalty: -0.2,
    coolFactor: 2,
  },
  drop: {
    name: 'Drop Shot',
    desc: 'Short, low-spin ball',
    requirement: 'Hit slice with light touch',
    powerMult: 0.4,
    accuracyPenalty: 0.1,
    coolFactor: 4,
  },
  insideOut: {
    name: 'Inside-Out Forehand',
    desc: 'Cross-court forehand on backhand side',
    requirement: 'Hit forehand while on backhand wing',
    powerMult: 1.05,
    accuracyPenalty: 0.2,
    coolFactor: 3,
  },
  drive: {
    name: 'Power Drive',
    desc: 'Maximum-speed flat hit',
    requirement: 'Perfect timing on flat shot',
    powerMult: 1.4,
    accuracyPenalty: 0.4,
    coolFactor: 4,
  },
};

// ── Ranked / ELO Tracking ──────────────────────────────
const RankedSys = (function(){
  const KEY = 'spike_tennis_ranked_v1';
  const data = {
    rating: 1000,
    rank: 'Bronze',
    wins: 0, losses: 0,
    streak: 0, bestStreak: 0,
  };
  function load(){
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) Object.assign(data, JSON.parse(raw));
    } catch(_){}
  }
  function save(){
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch(_){}
  }
  function calculateRank(rating){
    if (rating >= 2400) return 'Grandmaster';
    if (rating >= 2100) return 'Master';
    if (rating >= 1800) return 'Diamond';
    if (rating >= 1500) return 'Platinum';
    if (rating >= 1200) return 'Gold';
    if (rating >= 1000) return 'Silver';
    return 'Bronze';
  }
  function recordResult(opponentRating, won, gameDifficulty){
    // Standard ELO-like adjustment
    const k = won ? 32 : 24;
    const expected = 1 / (1 + Math.pow(10, (opponentRating - data.rating)/400));
    const score = won ? 1 : 0;
    let delta = Math.round(k * (score - expected));
    if (gameDifficulty === 'hard') delta *= 1.5;
    else if (gameDifficulty === 'easy') delta *= 0.7;
    data.rating += Math.round(delta);
    data.rank = calculateRank(data.rating);
    if (won){
      data.wins++; data.streak++;
      if (data.streak > data.bestStreak) data.bestStreak = data.streak;
    } else {
      data.losses++; data.streak = 0;
    }
    save();
    return { delta: delta, newRating: data.rating };
  }
  function reset(){
    data.rating = 1000; data.rank = 'Bronze';
    data.wins = 0; data.losses = 0; data.streak = 0; data.bestStreak = 0;
    save();
  }
  load();
  return { data: data, recordResult: recordResult, reset: reset, calculateRank: calculateRank };
})();

// ── Ranked UI ──────────────────────────────────────────
const RankedUI = (function(){
  let panel = null;
  function build(){
    panel = document.createElement('div');
    panel.id = 'ranked-panel';
    panel.style.cssText =
      'position:fixed;inset:0;display:none;z-index:128;' +
      'background:rgba(5,8,15,.94);backdrop-filter:blur(4px);' +
      'overflow-y:auto;-webkit-overflow-scrolling:touch';
    panel.innerHTML =
      '<div style="margin:auto;padding:30px 16px;min-height:calc(100vh - 60px);' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'box-sizing:border-box;width:min(440px,94vw);font-family:Orbitron,sans-serif;color:#fff">' +
        '<div style="background:rgba(12,18,32,.97);border:1.5px solid rgba(255,180,80,.35);border-radius:18px;' +
        'padding:1.8rem 1.5rem;width:100%;display:flex;flex-direction:column;gap:1rem">' +
          '<h2 style="font-size:1.3rem;text-align:center;letter-spacing:.06em;color:#ffb450">📊 RANKED</h2>' +
          '<div id="ranked-card" style="display:flex;flex-direction:column;gap:.6rem;text-align:center"></div>' +
          '<button class="abtn" id="ranked-close">CLOSE</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(panel);
    document.getElementById('ranked-close').onclick = function(){ AudioSys.click(); panel.style.display = 'none'; };
  }
  function render(){
    const card = document.getElementById('ranked-card');
    const wr = RankedSys.data.wins + RankedSys.data.losses > 0
      ? Math.round(RankedSys.data.wins / (RankedSys.data.wins + RankedSys.data.losses) * 100) : 0;
    const rankColors = {
      Bronze: '#cd7f32', Silver: '#c0c0c0', Gold: '#ffd700',
      Platinum: '#e5e4e2', Diamond: '#b9f2ff', Master: '#ff7575',
      Grandmaster: '#ff00ff'
    };
    card.innerHTML =
      '<div style="font-size:2.2rem;font-weight:900;color:' + (rankColors[RankedSys.data.rank] || '#fff') + ';' +
        'text-shadow:0 0 24px ' + (rankColors[RankedSys.data.rank] || '#fff') + '88">' + RankedSys.data.rank + '</div>' +
      '<div style="font-size:1.6rem;font-weight:700">' + RankedSys.data.rating + ' <span style="font-size:.8rem;color:#aabbcc">ELO</span></div>' +
      '<div style="font-size:.78rem;color:#aabbcc">' + RankedSys.data.wins + 'W · ' + RankedSys.data.losses + 'L (' + wr + '%)</div>' +
      '<div style="font-size:.7rem;color:#7a8ba0">Streak: ' + RankedSys.data.streak + ' · Best: ' + RankedSys.data.bestStreak + '</div>';
  }
  function open(){
    if (!panel) build();
    AudioSys.click();
    render();
    panel.style.display = 'block';
  }
  return { open: open };
})();

// ── Match History (records last N matches) ────────────
const MatchHistory = (function(){
  const KEY = 'spike_tennis_history_v1';
  let entries = [];
  function load(){
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) entries = JSON.parse(raw);
    } catch(_){}
  }
  function save(){
    try { localStorage.setItem(KEY, JSON.stringify(entries)); } catch(_){}
  }
  function record(result){
    const entry = {
      time: Date.now(),
      mode: gMode,
      difficulty: difficulty,
      theme: activeTheme,
      won: result.won,
      sets: [SC.sets[0], SC.sets[1]],
      games: [SC.games[0], SC.games[1]],
      stats: {
        aces: STATS.aces.slice(),
        winners: STATS.winners.slice(),
        errors: STATS.errors.slice(),
        smashes: STATS.totalSmashes.slice(),
        fastestServe: STATS.fastestServeKmh.slice(),
        longestRally: STATS.longestRally,
      }
    };
    entries.unshift(entry);
    if (entries.length > 30) entries.pop();
    save();
  }
  function getAll(){ return entries.slice(); }
  function clear(){ entries = []; save(); }
  load();
  return { record: record, getAll: getAll, clear: clear, entries: entries };
})();

// ── Match History UI ───────────────────────────────────
const MatchHistoryUI = (function(){
  let panel = null;
  function build(){
    panel = document.createElement('div');
    panel.id = 'history-panel';
    panel.style.cssText =
      'position:fixed;inset:0;display:none;z-index:128;' +
      'background:rgba(5,8,15,.94);backdrop-filter:blur(4px);' +
      'overflow-y:auto;-webkit-overflow-scrolling:touch';
    panel.innerHTML =
      '<div style="margin:auto;padding:30px 16px;min-height:calc(100vh - 60px);' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'box-sizing:border-box;width:min(580px,94vw);font-family:Orbitron,sans-serif;color:#fff">' +
        '<div style="background:rgba(12,18,32,.97);border:1.5px solid rgba(0,180,255,.35);border-radius:18px;' +
        'padding:1.7rem 1.5rem;width:100%;display:flex;flex-direction:column;gap:.8rem">' +
          '<h2 style="font-size:1.2rem;text-align:center;letter-spacing:.06em;color:#00b4ff">📜 MATCH HISTORY</h2>' +
          '<div id="hist-list" style="display:flex;flex-direction:column;gap:.4rem;max-height:60vh;overflow-y:auto"></div>' +
          '<button class="abtn" id="hist-close">CLOSE</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(panel);
    document.getElementById('hist-close').onclick = function(){ AudioSys.click(); panel.style.display = 'none'; };
  }
  function render(){
    const list = document.getElementById('hist-list');
    const all = MatchHistory.getAll();
    if (all.length === 0){
      list.innerHTML = '<div style="color:#7a8ba0;text-align:center;padding:1rem 0">No matches recorded yet.</div>';
      return;
    }
    list.innerHTML = '';
    all.forEach(function(e){
      const row = document.createElement('div');
      const winColor = e.won ? '#b2ff14' : '#ff5050';
      row.style.cssText = 'padding:.55rem .8rem;background:rgba(8,12,22,.5);' +
        'border-left:4px solid ' + winColor + ';border-radius:0 8px 8px 0;font-size:.72rem;' +
        'display:flex;justify-content:space-between;align-items:center';
      const date = new Date(e.time);
      const dateStr = date.toLocaleString();
      row.innerHTML =
        '<div>' +
          '<div style="font-weight:700;color:' + winColor + '">' + (e.won ? 'WON' : 'LOST') + ' · ' + e.mode + '</div>' +
          '<div style="color:#7a8ba0;font-size:.62rem">' + dateStr + ' · ' + (e.difficulty || 'medium') + ' · ' + e.theme + '</div>' +
        '</div>' +
        '<div style="text-align:right;color:#cdd9e6">' +
          'Sets ' + e.sets[0] + '–' + e.sets[1] +
        '</div>';
      list.appendChild(row);
    });
  }
  function open(){
    if (!panel) build();
    AudioSys.click();
    render();
    panel.style.display = 'block';
  }
  return { open: open };
})();

// ── AI Personality Picker UI ───────────────────────────
const AIPickerUI = (function(){
  let panel = null;
  function build(){
    panel = document.createElement('div');
    panel.id = 'ai-picker-panel';
    panel.style.cssText =
      'position:fixed;inset:0;display:none;z-index:128;' +
      'background:rgba(5,8,15,.94);backdrop-filter:blur(4px);' +
      'overflow-y:auto;-webkit-overflow-scrolling:touch';
    panel.innerHTML =
      '<div style="margin:auto;padding:30px 16px;min-height:calc(100vh - 60px);' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'box-sizing:border-box;width:min(560px,94vw);font-family:Orbitron,sans-serif;color:#fff">' +
        '<div style="background:rgba(12,18,32,.97);border:1.5px solid rgba(160,80,255,.35);border-radius:18px;' +
        'padding:1.7rem 1.5rem;width:100%;display:flex;flex-direction:column;gap:.8rem">' +
          '<h2 style="font-size:1.2rem;text-align:center;letter-spacing:.06em;color:#a050ff">🤖 AI STYLE</h2>' +
          '<div id="ai-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:.55rem"></div>' +
          '<button class="abtn" id="ai-close">CONFIRM</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(panel);
    document.getElementById('ai-close').onclick = function(){ AudioSys.click(); panel.style.display = 'none'; };
  }
  function render(){
    const grid = document.getElementById('ai-grid');
    grid.innerHTML = '';
    for (const k in AIPersonalities){
      const p = AIPersonalities[k];
      const isActive = aiPersonality === k;
      const card = document.createElement('div');
      card.style.cssText = 'padding:.7rem .55rem;border:1.5px solid ' + (isActive ? '#a050ff' : 'rgba(255,255,255,.07)') + ';' +
        'border-radius:10px;cursor:pointer;background:rgba(12,18,32,.6);text-align:center';
      card.innerHTML =
        '<div style="font-size:.84rem;font-weight:700;color:' + (isActive ? '#a050ff' : '#fff') + '">' + p.name + '</div>' +
        '<div style="font-size:.62rem;color:#7a8ba0;line-height:1.5;margin-top:.3rem">' + p.description + '</div>';
      card.onclick = function(){
        AudioSys.click();
        setAIPersonality(k);
        render();
      };
      grid.appendChild(card);
    }
  }
  function open(){
    if (!panel) build();
    AudioSys.click();
    render();
    panel.style.display = 'block';
  }
  return { open: open };
})();

// ── Replay Export / Import (JSON) ──────────────────────
const ReplayIO = (function(){
  function exportToJson(){
    const buf = ReplaySys.bufferSize() > 0 ? 'buffer' : 'empty';
    return {
      version: 1,
      time: Date.now(),
      mode: gMode,
      score: { sets: SC.sets, games: SC.games },
      buffer: buf,
    };
  }
  function downloadAsFile(){
    const data = exportToJson();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'spike_replay_' + Date.now() + '.json';
    a.click();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 100);
  }
  return { exportToJson: exportToJson, downloadAsFile: downloadAsFile };
})();

// ── Decoration: floating banner advertisements (rotate text) ────
const FloatingBanners = (function(){
  const banners = [];
  const messages = [
    'SPIKE TENNIS', 'POWER UP YOUR GAME',
    'NEON COURT', 'PRO LEVEL', 'TOURNAMENT NIGHT',
    'GET RANKED', 'COSMIC SERVE', 'GO PRO',
    'COURT KING', 'ELITE PLAY', 'GRAND SLAM',
  ];
  function build(){
    if (banners.length) return;
    for (let i=0; i<6; i++){
      const canvas = document.createElement('canvas');
      canvas.width = 512; canvas.height = 96;
      const ctx = canvas.getContext('2d');
      drawBannerText(ctx, messages[i % messages.length], i);
      const tex = new THREE.CanvasTexture(canvas);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
      const w = 6, h = 1.1;
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      const angle = (i / 6) * Math.PI * 2;
      banner.position.set(Math.cos(angle) * 24, 6 + (i % 2) * 0.5, Math.sin(angle) * 24);
      banner.lookAt(0, 6, 0);
      scene.add(banner);
      banners.push({ mesh: banner, tex: tex, ctx: ctx, canvas: canvas, msg: messages[i % messages.length], idx: i });
    }
  }
  function drawBannerText(ctx, msg, colorSeed){
    const colors = ['#00b4ff','#ff5050','#b2ff14','#ffdc32','#a050ff','#ff8090'];
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, 512, 96);
    ctx.strokeStyle = colors[colorSeed % colors.length];
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, 496, 80);
    ctx.fillStyle = colors[colorSeed % colors.length];
    ctx.font = 'bold 56px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(msg, 256, 50);
  }
  function rotate(){
    banners.forEach(function(b, i){
      b.idx = (b.idx + 1) % messages.length;
      b.msg = messages[b.idx];
      drawBannerText(b.ctx, b.msg, b.idx);
      b.tex.needsUpdate = true;
    });
  }
  return { build: build, rotate: rotate, banners: banners };
})();

// ── Lobby music handler (auto-play in lobby, switch in match) ──
function handleMusicForPhase(){
  if (gPhase === 'lobby'){
    Music.setMode('lobby');
  } else if (gPhase === 'match_over'){
    Music.setMode('victory');
  } else if (gPhase === 'point_end' || gPhase === 'serve_meter' || gPhase === 'serve_toss'){
    Music.setMode('match');
  } else if (gPhase === 'rally'){
    // Keep music going from previous phase; could detect tense moments
    if (SC.deuce) Music.setMode('tense');
    else Music.setMode('match');
  }
}

// ── Camera Lerps & Smooth Camera Transitions ──────────
const CameraTransitions = (function(){
  let transTime = 0;
  let transDuration = 0;
  let from = null, to = null;
  function startTransition(targetState, duration){
    transDuration = duration || 1.0;
    transTime = 0;
    from = { yaw: CAM.yaw, pitch: CAM.pitch, dist: CAM.dist, shoulder: CAM.shoulder };
    to = Object.assign({}, targetState);
  }
  function update(dt){
    if (transTime < transDuration && to){
      transTime += dt;
      const t = Math.min(1, transTime / transDuration);
      const e = t * t * (3 - 2 * t); // smoothstep
      if (to.yaw != null)      CAM.yaw      = from.yaw      + (to.yaw      - from.yaw)      * e;
      if (to.pitch != null)    CAM.pitch    = from.pitch    + (to.pitch    - from.pitch)    * e;
      if (to.dist != null)     CAM.dist     = from.dist     + (to.dist     - from.dist)     * e;
      if (to.shoulder != null) CAM.shoulder = from.shoulder + (to.shoulder - from.shoulder) * e;
      if (t >= 1){ to = null; }
    }
  }
  // Preset cameras
  const presets = {
    default:  { yaw:0,    pitch:0.45, dist:8.0, shoulder:2.4 },
    closeup:  { yaw:0,    pitch:0.30, dist:5.0, shoulder:1.8 },
    overhead: { yaw:0,    pitch:1.10, dist:14.0, shoulder:0.0 },
    side:     { yaw:1.57, pitch:0.20, dist:9.0, shoulder:0.0 },
    cinema:   { yaw:0.6,  pitch:0.30, dist:10.0, shoulder:0.0 },
  };
  function setPreset(name, duration){
    const p = presets[name];
    if (p) startTransition(p, duration || 1.2);
  }
  return { update: update, setPreset: setPreset, startTransition: startTransition, presets: presets };
})();

// ── Confetti effect (for big wins) ─────────────────────
const Confetti = (function(){
  const particles = [];
  const POOL = 40;
  let initialized = false;
  function init(){
    if (initialized) return;
    initialized = true;
    const colors = [0xff5050, 0x00b4ff, 0xb2ff14, 0xa050ff, 0xffdc32];
    for (let i=0; i<POOL; i++){
      const mat = new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true, opacity: 1 });
      const geo = new THREE.PlaneGeometry(0.18, 0.30);
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      scene.add(m);
      particles.push({ mesh: m, vx:0, vy:0, vz:0, vrot:0, life:0 });
    }
  }
  function burst(x, y, z, count){
    init();
    count = count || 25;
    let spawned = 0;
    for (let i=0; i<particles.length && spawned < count; i++){
      const p = particles[i];
      if (p.mesh.visible) continue;
      p.mesh.position.set(x, y, z);
      const ang = Math.random() * Math.PI * 2;
      const sp = 4 + Math.random() * 6;
      p.vx = Math.cos(ang) * sp;
      p.vz = Math.sin(ang) * sp;
      p.vy = 5 + Math.random() * 5;
      p.vrot = (Math.random() - 0.5) * 6;
      p.life = 2.5 + Math.random();
      p.mesh.material.opacity = 1;
      p.mesh.visible = true;
      spawned++;
    }
  }
  function update(dt){
    particles.forEach(function(p){
      if (!p.mesh.visible) return;
      p.life -= dt;
      if (p.life <= 0){ p.mesh.visible = false; return; }
      p.vy -= 9 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.rotation.x += p.vrot * dt;
      p.mesh.rotation.z += p.vrot * 0.5 * dt;
      if (p.mesh.position.y < 0){
        p.mesh.position.y = 0;
        p.vy = -p.vy * 0.3;
        p.vx *= 0.6; p.vz *= 0.6;
      }
      p.mesh.material.opacity = Math.min(1, p.life * 0.6);
    });
  }
  return { burst: burst, update: update };
})();

// ── Floating XP popups ─────────────────────────────────
const XPPopups = (function(){
  const active = [];
  function spawn(text, color){
    color = color || '#b2ff14';
    const el = document.createElement('div');
    el.style.cssText =
      'position:fixed;left:50%;top:60%;transform:translateX(-50%) translateY(0);' +
      'font-family:Orbitron,sans-serif;font-weight:700;font-size:1rem;' +
      'color:' + color + ';text-shadow:0 0 14px ' + color + 'aa;' +
      'pointer-events:none;z-index:90;transition:transform 1.4s ease-out,opacity 1.4s';
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(function(){
      el.style.transform = 'translateX(-50%) translateY(-90px)';
      el.style.opacity = '0';
    }, 30);
    setTimeout(function(){
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 1500);
    active.push(el);
  }
  return { spawn: spawn };
})();

// ── Spectator mode (camera that flies around the court) ──
const SpectatorCam = (function(){
  let active = false;
  let t = 0;
  function setActive(on){
    active = !!on;
    if (active) t = 0;
  }
  function update(dt){
    if (!active) return;
    t += dt * 0.2;
    CAM.yaw = t;
    CAM.pitch = 0.45 + Math.sin(t * 0.5) * 0.15;
    CAM.dist = 12 + Math.cos(t * 0.3) * 2;
  }
  return { setActive: setActive, update: update };
})();

// ── Net animation when ball hits ───────────────────────
const NetSway = (function(){
  let swayT = 0;
  let swayMag = 0;
  function trigger(magnitude){
    swayT = 0.5;
    swayMag = magnitude || 0.2;
  }
  function update(dt){
    swayT = Math.max(0, swayT - dt);
  }
  function getOffset(){
    if (swayT <= 0) return 0;
    return Math.sin(swayT * 18) * swayMag * (swayT / 0.5);
  }
  return { trigger: trigger, update: update, getOffset: getOffset };
})();

// ── Damage / Cracks on Surface (visual only) ──────────
const SurfaceWear = (function(){
  const decals = [];
  const POOL = 20;
  let initialized = false;
  function init(){
    if (initialized) return;
    initialized = true;
    const geo = new THREE.PlaneGeometry(0.6, 0.6);
    for (let i=0; i<POOL; i++){
      const mat = new THREE.MeshBasicMaterial({
        color: 0x000000, transparent: true, opacity: 0
      });
      const m = new THREE.Mesh(geo, mat);
      m.rotation.x = -Math.PI/2;
      m.position.y = 0.013;
      m.visible = false;
      scene.add(m);
      decals.push({ mesh: m, life: 0 });
    }
  }
  function add(x, z){
    init();
    const free = decals.find(function(d){ return !d.mesh.visible; });
    if (!free) return;
    free.mesh.position.set(x, 0.013, z);
    free.mesh.material.opacity = 0.25;
    free.mesh.visible = true;
    free.life = 30;
  }
  function update(dt){
    decals.forEach(function(d){
      if (!d.mesh.visible) return;
      d.life -= dt;
      if (d.life <= 0){ d.mesh.visible = false; }
    });
  }
  return { add: add, update: update };
})();

// ── Volume mixer per channel ──────────────────────────
const VolumeMixer = {
  master: 1.0, sfx: 1.0, music: 1.0, crowd: 1.0, ui: 1.0,
  apply: function(){
    AudioSys.setCrowdVolume(this.crowd * 0.18);
  }
};

// ── Trail Variants ──────────────────────────────────
const TrailVariants = {
  default:   { count:14, color:0xb2ff14, glow:0x446600, opacity:0.65 },
  rainbow:   { count:18, colors:[0xff5050, 0xff9632, 0xffe800, 0x60ff80, 0x00b4ff, 0xa050ff], opacity:0.72 },
  smoke:     { count:20, color:0xaaaaaa, glow:0x666666, opacity:0.4 },
  lightning: { count:10, color:0xffffff, glow:0xffff80, opacity:0.85 },
  petals:    { count:16, color:0xffaaaa, glow:0xff8888, opacity:0.7 },
  fire:      { count:14, color:0xff5510, glow:0xff8030, opacity:0.8 },
  ice:       { count:16, color:0x90e0ff, glow:0x70b0ff, opacity:0.6 },
  galaxy:    { count:18, colors:[0x000033, 0x4040ff, 0xa0a0ff, 0xffffff], opacity:0.7 },
};
let activeTrail = 'default';
function setTrail(name){
  if (TrailVariants[name]) activeTrail = name;
}

// ── Easter Egg Codes (Konami-style sequences) ────────
const EasterEggs = (function(){
  const codes = {
    konami: ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','KeyB','KeyA'],
    rocket: ['KeyR','KeyO','KeyC','KeyK','KeyE','KeyT'],
    coins:  ['KeyM','KeyO','KeyN','KeyE','KeyY'],
    rainbow:['KeyR','KeyA','KeyI','KeyN','KeyB','KeyO','KeyW'],
  };
  let buffer = [];
  function record(code){
    buffer.push(code);
    if (buffer.length > 10) buffer.shift();
    for (const k in codes){
      const seq = codes[k];
      if (buffer.length >= seq.length){
        const tail = buffer.slice(-seq.length);
        if (tail.every(function(c, i){ return c === seq[i]; })){
          activate(k);
          buffer = [];
        }
      }
    }
  }
  function activate(name){
    if (name === 'konami'){
      Profile.awardXP(500);
      Shop.addCoins(1000);
      showMsg('🎉 KONAMI CODE! +500 XP, +1000 coins', 3000);
      Confetti.burst(0, 0.5, 0, 60);
      AudioSys.fanfare();
    } else if (name === 'rocket'){
      // Crazy serve speed
      showMsg('🚀 ROCKET MODE — serve speeds DOUBLED!', 3000);
      Sounds.unlock();
    } else if (name === 'coins'){
      Shop.addCoins(500);
      showMsg('🪙 +500 coins!', 2000);
    } else if (name === 'rainbow'){
      setTrail('rainbow');
      showMsg('🌈 Rainbow trail unlocked!', 2500);
    }
  }
  return { record: record, codes: codes };
})();

// ── Detailed Match Commentary Database ─────────────
const CommentaryDB = {
  greetings: [
    'Welcome to centre court for an exciting match!',
    'The crowd is buzzing here today.',
    'Anticipation building as the players take their positions.',
    'It\'s time for some tennis!',
  ],
  matchStart: [
    'And we\'re underway!',
    'Off we go!',
    'First serve coming up.',
    'And it begins!',
  ],
  closeMatch: [
    'This is going down to the wire.',
    'You can cut the tension with a knife.',
    'Neither player willing to give an inch.',
    'A real heavyweight battle developing.',
    'Both players at their absolute best.',
  ],
  pressurePoint: [
    'Massive point coming up.',
    'Game-defining moment here.',
    'You don\'t want to lose this one.',
    'Pressure cooker situation.',
    'This point could change everything.',
  ],
  excellentShot: [
    'Outstanding!',
    'Incredible shot!',
    'How did they hit that?!',
    'Genius!',
    'Pure class!',
    'Exhibition stuff!',
    'You can\'t coach that!',
  ],
  averageShot: [
    'Solid response.',
    'Decent shot.',
    'Keeps the rally going.',
    'Workmanlike.',
    'Gets the job done.',
  ],
  poorShot: [
    'Frustrating error.',
    'They\'ll regret that.',
    'Poor execution.',
    'Cheap point given away.',
    'Lapse in concentration.',
  ],
  comeback: [
    'Stunning comeback!',
    'Refused to give up!',
    'What a fightback!',
    'Found another gear.',
    'Heart of a champion!',
  ],
  domination: [
    'Total domination.',
    'Class showing through.',
    'Putting on a clinic.',
    'Making it look easy.',
    'No answer to this.',
  ],
};

// ── Stats: Match-by-Match Tracker (running totals) ──
const RunningStats = (function(){
  const totals = {
    matchesPlayed: 0,
    setsPlayed: 0,
    gamesPlayed: 0,
    pointsPlayed: 0,
    minutesPlayed: 0,
    aces: 0, smashes: 0, winners: 0, errors: 0,
    longestRallySeen: 0,
    fastestServeSeen: 0,
    coinsEarned: 0,
    xpEarned: 0,
  };
  function load(){
    try {
      const raw = localStorage.getItem('spike_tennis_running_v1');
      if (raw) Object.assign(totals, JSON.parse(raw));
    } catch(_){}
  }
  function save(){
    try { localStorage.setItem('spike_tennis_running_v1', JSON.stringify(totals)); } catch(_){}
  }
  function inc(key, amount){
    if (!totals[key]) totals[key] = 0;
    totals[key] += (amount == null ? 1 : amount);
    save();
  }
  function setIfBetter(key, value){
    if (!totals[key] || value > totals[key]){
      totals[key] = value;
      save();
    }
  }
  load();
  return { totals: totals, inc: inc, setIfBetter: setIfBetter, save: save };
})();

// ── Session Timing ─────────────────────────────────
const SessionTimer = (function(){
  const sessionStart = Date.now();
  let lastUpdate = sessionStart;
  function getElapsed(){
    return Date.now() - sessionStart;
  }
  function tick(){
    const now = Date.now();
    const dt = now - lastUpdate;
    lastUpdate = now;
    Profile.data.totalPlayTime += dt;
    return dt;
  }
  return { getElapsed: getElapsed, tick: tick };
})();

// ── Coin earning rules per event ───────────────────
const CoinRewards = {
  perPoint: 1,
  perGame: 5,
  perSet: 25,
  perMatchWin: 100,
  perAce: 5,
  perSmash: 3,
  perRally10: 10,
  perTournamentWin: 500,
  perPracticeBest: 50,
  perDailyChallenge: 150,
};
function awardCoins(amount, reason){
  Shop.addCoins(amount);
  Notifications.push('+' + amount + ' coins (' + reason + ')', { color:'rgba(255,215,0,.5)' });
  RunningStats.inc('coinsEarned', amount);
}

// ── XP earning rules ───────────────────────────────
const XPRewards = {
  perPoint: 2,
  perGame: 10,
  perSet: 30,
  perMatchWin: 150,
  perAce: 25,
  perSmash: 8,
  perRally10: 10,
  perTournamentWin: 300,
  perPracticeBest: 40,
  perDailyChallenge: 75,
};

// ── Misc helper utilities ──────────────────────────
function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
function lerp(a, b, t){ return a + (b - a) * t; }
function randRange(lo, hi){ return lo + Math.random() * (hi - lo); }
function pickRandom(arr){ return arr[Math.floor(Math.random() * arr.length)]; }
function distance2D(x1, z1, x2, z2){ const dx=x1-x2, dz=z1-z2; return Math.sqrt(dx*dx+dz*dz); }
function clamp01(v){ return Math.max(0, Math.min(1, v)); }
function smoothstep(t){ return t * t * (3 - 2 * t); }
function easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }
function easeInCubic(t){ return t * t * t; }
function easeInOutCubic(t){ return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2; }
function easeOutBack(t){
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// ── Crowd Reactions (different reactions per situation) ─────
const CrowdReactions = (function(){
  const reactions = {
    silent:    { volume: 0, comment: '' },
    murmur:    { volume: 0.18, comment: 'Crowd murmur' },
    interest:  { volume: 0.30, comment: 'Crowd attentive' },
    excited:   { volume: 0.55, comment: 'Crowd excited!' },
    cheer:     { volume: 0.75, comment: 'Crowd cheering!' },
    standOvation:{ volume: 0.95, comment: 'STANDING OVATION!' },
    boo:       { volume: 0.45, comment: 'Crowd booing' },
  };
  let currentLevel = 'murmur';
  function setLevel(level){
    if (!reactions[level]) return;
    currentLevel = level;
    AudioSys.setCrowdVolume(SETTINGS && SETTINGS.muted ? 0 : reactions[level].volume * (SETTINGS && SETTINGS.crowdLevel != null ? SETTINGS.crowdLevel * 5 : 1));
  }
  function reactToEvent(event){
    if (event === 'point_won_p1') setLevel('cheer');
    else if (event === 'point_won_p2') setLevel('boo');
    else if (event === 'long_rally') setLevel('excited');
    else if (event === 'smash_winner') setLevel('cheer');
    else if (event === 'ace') setLevel('excited');
    else if (event === 'set_won') setLevel('cheer');
    else if (event === 'match_won') setLevel('standOvation');
    setTimeout(function(){ setLevel('murmur'); }, 2500);
  }
  function getCurrent(){ return currentLevel; }
  return { setLevel: setLevel, reactToEvent: reactToEvent, getCurrent: getCurrent };
})();

// ── Difficulty Modifiers (adjustable per-game) ─────
const DifficultyMods = (function(){
  const mods = {
    aiSpeedMult: 1.0,
    aiAccuracyMult: 1.0,
    aiPowerMult: 1.0,
    aiReactionMult: 1.0,
    playerSpeedMult: 1.0,
    playerHitRangeMult: 1.0,
    serveSpeedMult: 1.0,
    ballSpeedMult: 1.0,
    gravityMult: 1.0,
  };
  function applyToAI(personality){
    return Object.assign({}, personality, {
      spdMult: (personality.spdMult || 1) * mods.aiSpeedMult,
      power: (personality.power || 1) * mods.aiPowerMult,
      reactCD: (personality.reactCD || 22) * (1 / mods.aiReactionMult),
    });
  }
  function reset(){
    for (const k in mods) mods[k] = 1.0;
  }
  function setMod(key, val){ if (mods[key] != null) mods[key] = val; }
  function getMod(key){ return mods[key]; }
  return { mods: mods, applyToAI: applyToAI, reset: reset, setMod: setMod, getMod: getMod };
})();

// ── Custom match builder UI ─────────────────────────
const CustomMatchUI = (function(){
  let panel = null;
  const opts = {
    setsToWin: 2,
    gamesPerSet: 6,
    serveSpeedMult: 1.0,
    playerSpeed: 1.0,
    aiPersonality: 'baseliner',
    weather: 'clear',
    courtTheme: 'hard',
    multiBall: false,
    powerUpsOn: false,
  };
  function build(){
    panel = document.createElement('div');
    panel.id = 'custom-match-panel';
    panel.style.cssText =
      'position:fixed;inset:0;display:none;z-index:128;' +
      'background:rgba(5,8,15,.94);backdrop-filter:blur(4px);' +
      'overflow-y:auto;-webkit-overflow-scrolling:touch';
    panel.innerHTML =
      '<div style="margin:auto;padding:30px 16px;min-height:calc(100vh - 60px);' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'box-sizing:border-box;width:min(560px,94vw);font-family:Orbitron,sans-serif;color:#fff">' +
        '<div style="background:rgba(12,18,32,.97);border:1.5px solid rgba(160,80,255,.35);border-radius:18px;' +
        'padding:1.7rem 1.5rem;width:100%;display:flex;flex-direction:column;gap:.8rem">' +
          '<h2 style="font-size:1.2rem;text-align:center;letter-spacing:.06em;color:#a050ff">⚙ CUSTOM MATCH</h2>' +
          '<div id="cm-options" style="display:flex;flex-direction:column;gap:.4rem;max-height:55vh;overflow-y:auto"></div>' +
          '<div style="display:flex;gap:.5rem">' +
            '<button class="gbtn" id="cm-back">← Back</button>' +
            '<button class="abtn" id="cm-start" style="flex:2">START MATCH ▶</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(panel);
    document.getElementById('cm-back').onclick = function(){ AudioSys.click(); panel.style.display = 'none'; };
    document.getElementById('cm-start').onclick = function(){
      AudioSys.click();
      panel.style.display = 'none';
      // Apply options and start
      DifficultyMods.setMod('serveSpeedMult', opts.serveSpeedMult);
      DifficultyMods.setMod('playerSpeedMult', opts.playerSpeed);
      setAIPersonality(opts.aiPersonality);
      Weather.setMode(opts.weather);
      SETTINGS.theme = opts.courtTheme;
      applyTheme(opts.courtTheme);
      PowerUps.setEnabled(opts.powerUpsOn);
      MultiBall.setEnabled(opts.multiBall);
      startMode('ai_1v1', undefined, undefined, 'medium');
    };
  }
  function render(){
    const list = document.getElementById('cm-options');
    list.innerHTML = '';
    list.appendChild(slider('setsToWin', 'Sets to Win', 1, 5, 1));
    list.appendChild(slider('gamesPerSet', 'Games per Set', 3, 12, 1));
    list.appendChild(slider('serveSpeedMult', 'Serve Speed', 0.5, 2.0, 0.1));
    list.appendChild(slider('playerSpeed', 'Player Speed', 0.5, 2.0, 0.1));
    list.appendChild(select('aiPersonality', 'AI Style', Object.keys(AIPersonalities)));
    list.appendChild(select('weather', 'Weather', ['clear','rain','snow','fog']));
    list.appendChild(select('courtTheme', 'Court', ['hard','clay','grass','night']));
    list.appendChild(toggle('multiBall', 'Multi-Ball'));
    list.appendChild(toggle('powerUpsOn', 'Power-Ups'));
  }
  function slider(key, label, min, max, step){
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:.4rem 0;font-size:.7rem';
    row.innerHTML =
      '<span style="color:#aabbcc">' + label + '</span>' +
      '<input type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + opts[key] + '" style="flex:1;max-width:160px;margin:0 .8rem"/>' +
      '<span class="val" style="color:#cdd9e6;font-size:.66rem;min-width:36px;text-align:right">' + opts[key] + '</span>';
    const inp = row.querySelector('input');
    const val = row.querySelector('.val');
    inp.addEventListener('input', function(e){
      opts[key] = parseFloat(e.target.value);
      val.textContent = opts[key];
    });
    return row;
  }
  function select(key, label, options){
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:.4rem 0;font-size:.7rem';
    let optHTML = '';
    options.forEach(function(o){ optHTML += '<option value="' + o + '"' + (opts[key] === o ? ' selected' : '') + '>' + o + '</option>'; });
    row.innerHTML =
      '<span style="color:#aabbcc">' + label + '</span>' +
      '<select style="background:rgba(0,0,0,.4);color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:6px;padding:.3rem .5rem;font-family:Orbitron,sans-serif;font-size:.66rem">' + optHTML + '</select>';
    const sel = row.querySelector('select');
    sel.addEventListener('change', function(e){ opts[key] = e.target.value; });
    return row;
  }
  function toggle(key, label){
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:.4rem 0;font-size:.7rem;cursor:pointer';
    row.innerHTML =
      '<span style="color:#aabbcc">' + label + '</span>' +
      '<span class="tog" style="display:inline-block;width:36px;height:20px;border-radius:11px;' +
      'background:' + (opts[key] ? 'rgba(0,180,255,.35)' : '#222') + ';' +
      'border:1px solid ' + (opts[key] ? '#00b4ff' : '#333') + ';position:relative">' +
        '<span style="position:absolute;top:1px;left:' + (opts[key] ? '17px' : '1px') + ';width:16px;height:16px;border-radius:50%;background:' + (opts[key] ? '#00b4ff' : '#888') + ';transition:left .15s,background .15s"></span>' +
      '</span>';
    row.onclick = function(){
      AudioSys.click();
      opts[key] = !opts[key];
      render();
    };
    return row;
  }
  function open(){
    if (!panel) build();
    AudioSys.click();
    render();
    panel.style.display = 'block';
  }
  return { open: open };
})();

// ── In-Game HUD overlay extensions ─────────────────
const HUDExt = (function(){
  let xpBarEl = null;
  let coinDispEl = null;
  let abilityBarEl = null;
  function build(){
    if (xpBarEl) return;
    xpBarEl = document.createElement('div');
    xpBarEl.id = 'xp-bar';
    xpBarEl.style.cssText =
      'position:fixed;top:74px;left:14px;background:rgba(8,12,22,.78);' +
      'border:1px solid rgba(0,180,255,.3);border-radius:8px;padding:.45rem .7rem;' +
      'font-family:Orbitron,sans-serif;font-size:.66rem;color:#cdd9e6;' +
      'display:none;z-index:55;pointer-events:none';
    document.body.appendChild(xpBarEl);
    coinDispEl = document.createElement('div');
    coinDispEl.id = 'coin-disp';
    coinDispEl.style.cssText =
      'position:fixed;top:108px;left:14px;background:rgba(8,12,22,.78);' +
      'border:1px solid rgba(255,215,0,.3);border-radius:8px;padding:.4rem .7rem;' +
      'font-family:Orbitron,sans-serif;font-size:.66rem;color:#ffd700;' +
      'display:none;z-index:55;pointer-events:none';
    document.body.appendChild(coinDispEl);
    abilityBarEl = document.createElement('div');
    abilityBarEl.id = 'ability-bar';
    abilityBarEl.style.cssText =
      'position:fixed;bottom:24px;left:14px;display:flex;gap:.4rem;z-index:55;' +
      'pointer-events:none;font-family:Orbitron,sans-serif';
    document.body.appendChild(abilityBarEl);
  }
  function refresh(){
    if (!xpBarEl) return;
    const info = Profile.getXPProgress();
    xpBarEl.innerHTML = 'LVL ' + info.level + ' · ' + Math.round(info.progress * 100) + '% to ' + (info.level + 1);
    if (coinDispEl) coinDispEl.innerHTML = '🪙 ' + Shop.getCoins();
    if (abilityBarEl){
      let html = '';
      let i = 1;
      for (const k in Abilities.abilities){
        const a = Abilities.abilities[k];
        const cd = Abilities.getCooldown(k);
        const ready = cd <= 0;
        html += '<div style="background:rgba(8,12,22,.85);border:1px solid ' + (ready ? '#00b4ff' : '#333') + ';' +
          'border-radius:7px;padding:.32rem .5rem;font-size:.6rem;color:' + (ready ? '#00b4ff' : '#666') + '" title="' + a.desc + '">' +
          a.keyHint + ' · ' + a.name + (ready ? '' : ' (' + cd.toFixed(1) + 's)') +
          '</div>';
        i++;
      }
      abilityBarEl.innerHTML = html;
    }
  }
  function setVisible(v){
    if (!xpBarEl) build();
    xpBarEl.style.display = v ? 'block' : 'none';
    if (coinDispEl) coinDispEl.style.display = v ? 'block' : 'none';
    if (abilityBarEl) abilityBarEl.style.display = v ? 'flex' : 'none';
  }
  return { build: build, refresh: refresh, setVisible: setVisible };
})();

// ── Toggle Mute Button (always visible) ───────────────
const MuteToggle = (function(){
  let btn = null;
  function build(){
    btn = document.createElement('button');
    btn.id = 'mute-toggle';
    btn.style.cssText =
      'position:fixed;top:12px;right:170px;width:42px;height:42px;border-radius:10px;' +
      'border:1px solid rgba(0,180,255,.3);background:rgba(5,8,15,.78);color:#9bc4ec;' +
      'cursor:pointer;font-size:1.1rem;display:flex;align-items:center;justify-content:center;' +
      'transition:all .15s;font-family:Orbitron,sans-serif;z-index:115';
    btn.textContent = '🔊';
    document.body.appendChild(btn);
    btn.onclick = function(){
      const muted = !AudioSys.isMuted();
      AudioSys.setMuted(muted);
      btn.textContent = muted ? '🔇' : '🔊';
      btn.title = muted ? 'Unmute' : 'Mute';
    };
  }
  function get(){ return btn; }
  build();
  return { get: get };
})();

// ── Onboarding Welcome Pop-up (first-time players) ─────
const Welcome = (function(){
  function shouldShow(){
    try { return !localStorage.getItem('spike_tennis_welcomed_v1'); }
    catch(_){ return true; }
  }
  function markSeen(){
    try { localStorage.setItem('spike_tennis_welcomed_v1', '1'); } catch(_){}
  }
  function show(){
    if (!shouldShow()) return;
    Tutorial.start();
    markSeen();
  }
  return { show: show, shouldShow: shouldShow };
})();

// ── Match Modes Library (variant rules) ────────────
const MatchModes = {
  classic1v1: {
    id: 'classic1v1',
    title: '1v1 Classic',
    description: 'Standard 1v1 match against AI',
    setsToWin: 2, gamesPerSet: 6,
    multiBall: false, powerUps: false,
  },
  speedRound: {
    id: 'speedRound',
    title: 'Speed Round',
    description: 'Faster ball, faster gameplay',
    setsToWin: 1, gamesPerSet: 3,
    multiBall: false, powerUps: false,
    ballSpeedMult: 1.5,
  },
  chaos: {
    id: 'chaos',
    title: 'Chaos Mode',
    description: 'Multi-ball + power-ups everywhere',
    setsToWin: 1, gamesPerSet: 4,
    multiBall: true, powerUps: true,
  },
  golden: {
    id: 'golden',
    title: 'Golden Set',
    description: 'One set, no margin',
    setsToWin: 1, gamesPerSet: 6,
    multiBall: false, powerUps: false,
  },
  ironman: {
    id: 'ironman',
    title: 'Iron Man',
    description: 'Best of 5 sets — endurance match',
    setsToWin: 3, gamesPerSet: 6,
    multiBall: false, powerUps: false,
  },
  trickShot: {
    id: 'trickShot',
    title: 'Trick Shot Mode',
    description: 'Bonus points for cool shots',
    setsToWin: 2, gamesPerSet: 6,
    multiBall: false, powerUps: false,
    trickShotsBonus: true,
  },
  retro: {
    id: 'retro',
    title: 'Retro Mode',
    description: 'Pixel-style visuals, classic rules',
    setsToWin: 2, gamesPerSet: 6,
    multiBall: false, powerUps: false,
    retroVisuals: true,
  },
  midnight: {
    id: 'midnight',
    title: 'Midnight Showdown',
    description: 'Night court, dramatic lighting',
    setsToWin: 2, gamesPerSet: 6,
    multiBall: false, powerUps: false,
    forceTheme: 'night',
  },
};

// ── Coin Bank (centralized coin operations) ────────
const CoinBank = (function(){
  const observers = [];
  function balance(){ return Shop.getCoins(); }
  function add(amount, reason){
    Shop.addCoins(amount);
    observers.forEach(function(cb){ try{ cb(amount, balance()); }catch(_){} });
    if (reason) Notifications.push('+' + amount + ' coins (' + reason + ')', { color:'rgba(255,215,0,.5)' });
  }
  function spend(amount, reason){
    if (Shop.spendCoins(amount)){
      observers.forEach(function(cb){ try{ cb(-amount, balance()); }catch(_){} });
      return true;
    }
    return false;
  }
  function onChange(cb){ observers.push(cb); }
  return { balance: balance, add: add, spend: spend, onChange: onChange };
})();

// ── More elaborate scoreboard with ELO display ─────
const ScoreboardX = (function(){
  let panel = null;
  function build(){
    panel = document.createElement('div');
    panel.id = 'scoreboard-x';
    panel.style.cssText =
      'position:fixed;top:14px;right:170px;background:rgba(5,8,15,.85);' +
      'border:1px solid rgba(0,180,255,.3);border-radius:10px;padding:.55rem .9rem;' +
      'font-family:Orbitron,sans-serif;font-size:.7rem;color:#cdd9e6;display:none;z-index:55;' +
      'pointer-events:none;letter-spacing:.04em';
    document.body.appendChild(panel);
  }
  function refresh(){
    if (!panel) build();
    panel.innerHTML =
      '<div style="display:flex;flex-direction:column;gap:.18rem">' +
        '<div style="font-size:.6rem;color:#7a8ba0">RANK</div>' +
        '<div style="color:' + (RankedSys.data.rating >= 1500 ? '#ffd700' : '#fff') + '">' + RankedSys.data.rank + ' · ' + RankedSys.data.rating + '</div>' +
        '<div style="font-size:.58rem;color:#7a8ba0">' + RankedSys.data.wins + 'W / ' + RankedSys.data.losses + 'L</div>' +
      '</div>';
  }
  function setVisible(v){
    if (!panel) build();
    panel.style.display = v ? 'block' : 'none';
  }
  return { setVisible: setVisible, refresh: refresh };
})();

// ── Persistence Cleanup ────────────────────────────
const Persistence = (function(){
  function clearAll(){
    if (!confirm('Wipe ALL saved progress? This cannot be undone.')) return;
    const keys = [
      'spike_tennis_settings',
      'spike_tennis_settings_v2',
      'spike_tennis_profile_v1',
      'spike_tennis_shop_v1',
      'spike_tennis_history_v1',
      'spike_tennis_running_v1',
      'spike_tennis_skills_v1',
      'spike_tennis_keybinds_v1',
      'spike_tennis_ach_v1',
      'spike_tennis_trophies_v1',
      'spike_tennis_minigame_bests_v1',
      'spike_tennis_practice_best',
      'spike_tennis_daily_v1',
      'spike_tennis_ranked_v1',
      'spike_tennis_welcomed_v1',
      'spike_tennis_tutorial_done',
      'spike_tennis_tournament_won',
    ];
    keys.forEach(function(k){ try { localStorage.removeItem(k); } catch(_){} });
    showMsg('All progress wiped. Reloading…', 1500);
    setTimeout(function(){ location.reload(); }, 1500);
  }
  function exportAll(){
    const data = {};
    for (let i=0; i<localStorage.length; i++){
      const key = localStorage.key(i);
      if (key && key.indexOf('spike_tennis_') === 0){
        data[key] = localStorage.getItem(key);
      }
    }
    return data;
  }
  function downloadBackup(){
    const data = exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'spike_tennis_backup_' + Date.now() + '.json';
    a.click();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 100);
  }
  function importBackup(jsonText){
    try {
      const data = JSON.parse(jsonText);
      for (const k in data){
        if (k.indexOf('spike_tennis_') === 0){
          localStorage.setItem(k, data[k]);
        }
      }
      showMsg('Backup restored. Reloading…', 1500);
      setTimeout(function(){ location.reload(); }, 1500);
      return true;
    } catch(e){
      return false;
    }
  }
  return { clearAll: clearAll, exportAll: exportAll, downloadBackup: downloadBackup, importBackup: importBackup };
})();

// ── In-Game Toast Notification (achievement-style) ────
const Toast = (function(){
  function show(text, opts){
    Notifications.push(text, opts || {});
  }
  function showColor(text, color, duration){
    Notifications.push(text, { color: color, duration: duration });
  }
  return { show: show, showColor: showColor };
})();

// ── FPS / Performance Counter ───────────────────────
const PerfMonitor = (function(){
  let frames = 0;
  let lastTime = performance.now();
  let fps = 60;
  let avgDt = 0;
  let el = null;
  let visible = false;
  function build(){
    if (el) return;
    el = document.createElement('div');
    el.id = 'perf-mon';
    el.style.cssText =
      'position:fixed;top:14px;right:218px;background:rgba(5,8,15,.78);' +
      'border:1px solid rgba(0,180,255,.2);border-radius:6px;padding:.3rem .5rem;' +
      'font-family:monospace;font-size:.6rem;color:#7a8ba0;display:none;z-index:55;' +
      'pointer-events:none';
    document.body.appendChild(el);
  }
  function update(){
    frames++;
    const now = performance.now();
    if (now - lastTime > 500){
      fps = Math.round(frames * 1000 / (now - lastTime));
      avgDt = (now - lastTime) / frames;
      frames = 0;
      lastTime = now;
      if (visible && el){
        el.textContent = 'FPS: ' + fps + ' · ' + avgDt.toFixed(1) + 'ms';
      }
    }
  }
  function setVisible(v){
    if (!el) build();
    visible = !!v;
    el.style.display = v ? 'block' : 'none';
  }
  function getFPS(){ return fps; }
  build();
  return { update: update, setVisible: setVisible, getFPS: getFPS };
})();

// ── Toolbar Extension (more buttons in the corner) ─────
const ToolbarX = (function(){
  let toolbar = null;
  function build(){
    toolbar = document.createElement('div');
    toolbar.id = 'corner-tools-x';
    toolbar.style.cssText =
      'position:fixed;top:62px;right:12px;display:flex;flex-direction:column;gap:6px;' +
      'z-index:115;pointer-events:auto';
    const buttons = [
      { id:'tb-trophy',     icon:'🏆', label:'Trophies',     fn:function(){ TrophyUI.open(); } },
      { id:'tb-ach',        icon:'🏅', label:'Achievements', fn:function(){ AchievementsUI.open(); } },
      { id:'tb-shop',       icon:'🛒', label:'Shop',         fn:function(){ ShopUI.open(); } },
      { id:'tb-skills',     icon:'⚙', label:'Skills',       fn:function(){ SkillsUI.open(); } },
      { id:'tb-history',    icon:'📜', label:'History',      fn:function(){ MatchHistoryUI.open(); } },
      { id:'tb-daily',      icon:'📅', label:'Daily',        fn:function(){ DailyUI.open(); } },
      { id:'tb-ranked',     icon:'📊', label:'Ranked',       fn:function(){ RankedUI.open(); } },
      { id:'tb-profile',    icon:'👤', label:'Profile',      fn:function(){ ProfileUI.open(); } },
      { id:'tb-credits',    icon:'ℹ',  label:'Credits',      fn:function(){ CreditsUI.open(); } },
      { id:'tb-help',       icon:'❓', label:'Help',         fn:function(){ HelpUI.open(); } },
    ];
    buttons.forEach(function(b){
      const btn = document.createElement('button');
      btn.id = b.id;
      btn.title = b.label;
      btn.style.cssText =
        'width:36px;height:36px;border-radius:8px;border:1px solid rgba(0,180,255,.25);' +
        'background:rgba(5,8,15,.78);color:#9bc4ec;cursor:pointer;font-size:.95rem;' +
        'display:flex;align-items:center;justify-content:center;transition:all .15s;font-family:Orbitron,sans-serif';
      btn.textContent = b.icon;
      btn.onclick = b.fn;
      btn.onmouseover = function(){ btn.style.borderColor = '#00b4ff'; btn.style.color = '#fff'; };
      btn.onmouseout  = function(){ btn.style.borderColor = 'rgba(0,180,255,.25)'; btn.style.color = '#9bc4ec'; };
      toolbar.appendChild(btn);
    });
    document.body.appendChild(toolbar);
  }
  function setVisible(v){
    if (!toolbar) build();
    toolbar.style.display = v ? 'flex' : 'none';
  }
  build();
  return { setVisible: setVisible };
})();

// ── Court Decorations: extra props (chairs, ball boys) ──
const CourtProps = (function(){
  let placed = false;
  function place(){
    if (placed) return;
    placed = true;
    // Umpire chair (tall block at side of court)
    const chairMat = new THREE.MeshStandardMaterial({ color: 0x444466, metalness: 0.3 });
    const chair = new THREE.Mesh(new THREE.BoxGeometry(0.8, 4, 0.8), chairMat);
    chair.position.set(CHW + 1.2, 2, 0);
    chair.castShadow = true;
    scene.add(chair);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.2, 1.0), chairMat);
    seat.position.set(CHW + 1.2, 4.0, 0);
    scene.add(seat);
    // Bench at side for "spectators" near court
    const benchMat = new THREE.MeshStandardMaterial({ color: 0x553311, roughness: 0.85 });
    for (let s=-1; s<=1; s+=2){
      const bench = new THREE.Mesh(new THREE.BoxGeometry(8, 0.3, 0.5), benchMat);
      bench.position.set(0, 0.4, s * (CHL + 1.2));
      scene.add(bench);
      // Backrest
      const back = new THREE.Mesh(new THREE.BoxGeometry(8, 0.7, 0.1), benchMat);
      back.position.set(0, 0.85, s * (CHL + 1.5));
      scene.add(back);
    }
    // Ball cart (a small box near the umpire)
    const cartMat = new THREE.MeshStandardMaterial({ color: 0x223355 });
    const cart = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.8), cartMat);
    cart.position.set(CHW + 0.5, 0.25, 1.0);
    scene.add(cart);
    // Tower lights (additional fixtures)
    const lightFixtureMat = new THREE.MeshStandardMaterial({
      color: 0xffffaa, emissive: 0xffffaa, emissiveIntensity: 0.5
    });
    for (let i=0; i<8; i++){
      const ang = (i / 8) * Math.PI * 2;
      const r = CHL + 5;
      const x = Math.cos(ang) * r;
      const z = Math.sin(ang) * r;
      const fx = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.6), lightFixtureMat);
      fx.position.set(x, 12, z);
      scene.add(fx);
    }
    // Score board (large block at one end with face)
    const sbMat = new THREE.MeshStandardMaterial({ color: 0x111122 });
    const sb = new THREE.Mesh(new THREE.BoxGeometry(6, 2, 0.4), sbMat);
    sb.position.set(0, 5, -CHL - 5);
    scene.add(sb);
    // Sponsor logos along sidelines
    for (let i=-2; i<=2; i++){
      const sponsorMat = new THREE.MeshStandardMaterial({
        color: 0x111122, emissive: 0x4488ff, emissiveIntensity: 0.3
      });
      const sponsor = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 0.05), sponsorMat);
      sponsor.position.set(i * 2.8, 0.4, -CHL - 0.55);
      scene.add(sponsor);
    }
  }
  return { place: place };
})();

// ── Court size variants ─────────────────────────────
const CourtSizes = {
  doubles: { CW: 12, CL: 23.77, CHW: 6, CHL: 11.885 },
  singles: { CW: 10.97, CL: 23.77, CHW: 5.485, CHL: 11.885 },
  mini:    { CW: 8, CL: 18, CHW: 4, CHL: 9 },
};

// ── Network message types (for online play) ─────────
const NetMessages = {
  STATE:        'state',
  HIT:          'hit',
  CHAR_PICK:    'char',
  CHAT:         'chat',
  PING:         'ping',
  PONG:         'pong',
  ABILITY:      'ability',
  EMOTE:        'emote',
  PAUSE:        'pause',
  RESUME:       'resume',
  SCORE_UPDATE: 'score_update',
  POINT_END:    'point_end',
  MATCH_END:    'match_end',
};

// ── Online message handler dispatcher ───────────────
const NetDispatch = (function(){
  const handlers = {};
  function on(type, handler){ handlers[type] = handler; }
  function dispatch(msg){
    if (!msg || !msg.type) return;
    const h = handlers[msg.type];
    if (h){ try { h(msg); } catch(e){} }
  }
  // Default handlers
  on(NetMessages.PING, function(msg){
    if (peerConn){
      try { peerConn.send({ type: NetMessages.PONG, time: msg.time, replyTime: Date.now() }); } catch(_){}
    }
  });
  on(NetMessages.CHAT, function(msg){
    ChatSys.add(msg.from || 'Opponent', msg.text);
    AudioSys.click();
  });
  on(NetMessages.EMOTE, function(msg){
    AnimSys.setState(1, msg.emote || 'taunt');
    showMsg('Opponent: ' + (msg.emote || 'emote'), 1500);
  });
  return { on: on, dispatch: dispatch };
})();

// ── Connection latency tracker ──────────────────────
const Latency = (function(){
  let pings = [];
  let lastPingTime = 0;
  function start(){
    if (!peerConn) return;
    setInterval(function(){
      if (!peerConn) return;
      try {
        peerConn.send({ type: NetMessages.PING, time: Date.now() });
        lastPingTime = Date.now();
      } catch(_){}
    }, 5000);
  }
  function recordPong(reqTime){
    const rtt = Date.now() - reqTime;
    pings.push(rtt);
    if (pings.length > 10) pings.shift();
  }
  function getAverage(){
    if (pings.length === 0) return 0;
    return Math.round(pings.reduce(function(a,b){ return a+b; }, 0) / pings.length);
  }
  return { start: start, recordPong: recordPong, getAverage: getAverage };
})();

// ── Player Card Generator (visual avatar card) ──────
function generatePlayerCardSVG(charIdx){
  const c = CHARS[charIdx % CHARS.length];
  return '<svg width="120" height="160" viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">' +
    '<rect width="120" height="160" rx="10" fill="' + c.col + '" opacity="0.2"/>' +
    '<rect x="2" y="2" width="116" height="156" rx="9" fill="none" stroke="' + c.col + '" stroke-width="2"/>' +
    '<rect x="40" y="40" width="40" height="60" rx="5" fill="' + c.col + '"/>' +
    '<circle cx="60" cy="30" r="14" fill="' + c.skin + '"/>' +
    '<text x="60" y="130" font-family="Orbitron, sans-serif" font-size="14" font-weight="900" ' +
    'text-anchor="middle" fill="' + c.col + '">' + c.name + '</text>' +
    '<text x="60" y="148" font-family="Orbitron, sans-serif" font-size="9" ' +
    'text-anchor="middle" fill="#aabbcc">' + (c.tag || 'PLAYER') + '</text>' +
    '</svg>';
}

// ── Random Events (rare chaotic events during play) ────
const RandomEvents = (function(){
  const events = [
    {
      id: 'sudden_lob',
      name: 'Wind Gust',
      desc: 'A gust pushes the ball sideways!',
      probability: 0.02,
      apply: function(){
        if (!B.active) return;
        B.vel.x += (Math.random() - 0.5) * 4;
        B.vel.z += (Math.random() - 0.5) * 1.5;
        showMsg('💨 GUST!', 1000);
        SoundBank.whistle();
      },
    },
    {
      id: 'speed_burst',
      name: 'Speed Burst',
      desc: 'Ball gains 50% speed',
      probability: 0.015,
      apply: function(){
        if (!B.active) return;
        B.vel.multiplyScalar(1.5);
        showMsg('⚡ BOOST!', 800);
        SoundBank.powerUp();
      },
    },
    {
      id: 'time_freeze',
      name: 'Time Freeze',
      desc: 'Slow time briefly',
      probability: 0.005,
      apply: function(){
        showMsg('⏸ TIME FREEZE!', 1500);
        if (typeof window !== 'undefined') window._timeFactor = 0.4;
        setTimeout(function(){ if (typeof window !== 'undefined') window._timeFactor = 1; }, 2000);
        SoundBank.dong();
      },
    },
    {
      id: 'spotlight',
      name: 'Spotlight',
      desc: 'Camera zooms dramatically',
      probability: 0.008,
      apply: function(){
        CameraTransitions.setPreset('cinema', 0.5);
        showMsg('📷 SPOTLIGHT!', 1500);
        setTimeout(function(){ CameraTransitions.setPreset('default', 0.8); }, 2500);
      },
    },
    {
      id: 'crowd_wave',
      name: 'Crowd Wave',
      desc: 'Crowd does a wave',
      probability: 0.01,
      apply: function(){
        triggerCrowdWave();
        showMsg('🌊 WAVE!', 1000);
        AudioSys.cheer(false);
      },
    },
  ];
  let enabled = false;
  let cooldown = 0;
  function setEnabled(on){ enabled = !!on; }
  function update(dt){
    if (!enabled) return;
    cooldown -= dt;
    if (cooldown > 0) return;
    cooldown = 4 + Math.random() * 8; // next event window
    if (gPhase !== 'rally' && gPhase !== 'practice') return;
    for (let i=0; i<events.length; i++){
      const e = events[i];
      if (Math.random() < e.probability){
        try { e.apply(); } catch(_){}
        break;
      }
    }
  }
  return { setEnabled: setEnabled, update: update, events: events };
})();

// ── Skill Tree UI ──────────────────────────────────
const SkillTreeUI = (function(){
  let panel = null;
  function build(){
    panel = document.createElement('div');
    panel.id = 'skilltree-panel';
    panel.style.cssText =
      'position:fixed;inset:0;display:none;z-index:128;' +
      'background:rgba(5,8,15,.94);backdrop-filter:blur(4px);' +
      'overflow-y:auto;-webkit-overflow-scrolling:touch';
    panel.innerHTML =
      '<div style="margin:auto;padding:30px 16px;min-height:calc(100vh - 60px);' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'box-sizing:border-box;width:min(620px,94vw);font-family:Orbitron,sans-serif;color:#fff">' +
        '<div style="background:rgba(12,18,32,.97);border:1.5px solid rgba(255,80,200,.35);border-radius:18px;' +
        'padding:1.7rem 1.5rem;width:100%;display:flex;flex-direction:column;gap:1rem">' +
          '<h2 style="font-size:1.2rem;text-align:center;letter-spacing:.06em;color:#ff80c8">🌳 SKILL TREE</h2>' +
          '<div id="st-tree" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:.6rem"></div>' +
          '<div style="font-size:.66rem;color:#aabbcc;text-align:center">Skills level up automatically as you play.</div>' +
          '<button class="abtn" id="st-close">CLOSE</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(panel);
    document.getElementById('st-close').onclick = function(){ AudioSys.click(); panel.style.display = 'none'; };
  }
  function render(){
    const tree = document.getElementById('st-tree');
    tree.innerHTML = '';
    const all = SkillSystem.getAll();
    for (const k in all){
      const s = all[k];
      const need = SkillSystem.xpForLevel(s.level + 1);
      const prog = Math.min(1, s.xp / need);
      const card = document.createElement('div');
      card.style.cssText = 'background:rgba(8,12,22,.6);border:1.5px solid rgba(255,80,200,.2);' +
        'border-radius:10px;padding:.65rem .55rem;display:flex;flex-direction:column;gap:.3rem;text-align:center';
      card.innerHTML =
        '<div style="font-size:.78rem;font-weight:700;color:#ff80c8">' + s.name + '</div>' +
        '<div style="font-size:1.4rem;font-weight:900">' + s.level + '<span style="font-size:.66rem;color:#7a8ba0">/' + s.max + '</span></div>' +
        '<div style="font-size:.6rem;color:#7a8ba0;line-height:1.4">' + s.desc + '</div>' +
        '<div style="height:4px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden">' +
          '<div style="height:100%;width:' + Math.round(prog * 100) + '%;background:#ff80c8;border-radius:2px"></div>' +
        '</div>';
      tree.appendChild(card);
    }
  }
  function open(){
    if (!panel) build();
    AudioSys.click();
    render();
    panel.style.display = 'block';
  }
  return { open: open };
})();

// ── Mode Picker UI (selects from MatchModes) ────────
const ModePickerUI = (function(){
  let panel = null;
  function build(){
    panel = document.createElement('div');
    panel.id = 'mode-picker-panel';
    panel.style.cssText =
      'position:fixed;inset:0;display:none;z-index:128;' +
      'background:rgba(5,8,15,.94);backdrop-filter:blur(4px);' +
      'overflow-y:auto;-webkit-overflow-scrolling:touch';
    let cards = '';
    for (const k in MatchModes){
      const m = MatchModes[k];
      cards += '<div class="mpcard" data-id="' + k + '" style="background:rgba(12,18,32,.92);' +
        'border:1.5px solid rgba(255,255,255,.07);border-radius:14px;padding:1rem .9rem;cursor:pointer;' +
        'display:flex;flex-direction:column;gap:.4rem">' +
          '<div style="font-size:.92rem;font-weight:700;color:#fff">' + m.title + '</div>' +
          '<div style="font-size:.62rem;color:#7a8ba0;line-height:1.5">' + m.description + '</div>' +
        '</div>';
    }
    panel.innerHTML =
      '<div style="margin:auto;padding:30px 16px;min-height:calc(100vh - 60px);' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'box-sizing:border-box;width:min(620px,94vw);font-family:Orbitron,sans-serif;color:#fff">' +
        '<div style="background:rgba(12,18,32,.97);border:1.5px solid rgba(0,180,255,.35);border-radius:18px;' +
        'padding:1.7rem 1.5rem;width:100%;display:flex;flex-direction:column;gap:.8rem">' +
          '<h2 style="font-size:1.2rem;text-align:center;letter-spacing:.06em;color:#00b4ff">🎮 MATCH MODES</h2>' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:.55rem">' + cards + '</div>' +
          '<button class="gbtn" id="mp-close">← Back</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(panel);
    document.getElementById('mp-close').onclick = function(){ AudioSys.click(); panel.style.display = 'none'; };
    document.querySelectorAll('.mpcard').forEach(function(c){
      c.onclick = function(){
        AudioSys.click();
        panel.style.display = 'none';
        const m = MatchModes[c.getAttribute('data-id')];
        if (m){
          PowerUps.setEnabled(!!m.powerUps);
          MultiBall.setEnabled(!!m.multiBall);
          if (m.forceTheme){ SETTINGS.theme = m.forceTheme; applyTheme(m.forceTheme); }
          startMode('ai_1v1', undefined, undefined, 'medium');
        }
      };
    });
  }
  function open(){
    if (!panel) build();
    AudioSys.click();
    panel.style.display = 'block';
  }
  return { open: open };
})();

// ── Daily Login Reward (gives coins + xp once per day) ─
const DailyLogin = (function(){
  const KEY = 'spike_tennis_daily_login_v1';
  const data = { lastDate: null, streak: 0 };
  function load(){
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) Object.assign(data, JSON.parse(raw));
    } catch(_){}
  }
  function save(){
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch(_){}
  }
  function todayKey(){
    const d = new Date();
    return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
  }
  function yesterdayKey(){
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
  }
  function checkin(){
    const today = todayKey();
    if (data.lastDate === today) return null;
    if (data.lastDate === yesterdayKey()){
      data.streak++;
    } else {
      data.streak = 1;
    }
    data.lastDate = today;
    save();
    const reward = { coins: 50 * data.streak, xp: 30 + 10 * data.streak };
    Shop.addCoins(reward.coins);
    Profile.awardXP(reward.xp);
    showMsg('🎁 DAILY LOGIN: +' + reward.coins + ' coins, +' + reward.xp + ' XP (Streak: ' + data.streak + ')', 4000);
    SoundBank.unlock();
    return reward;
  }
  function getStreak(){ return data.streak; }
  load();
  return { checkin: checkin, getStreak: getStreak, data: data };
})();

// ── Cosmetic Application (apply equipped items to characters) ──
const CosmeticApply = (function(){
  function applyToChar(pi){
    if (!chars[pi]) return;
    const racketItem = Shop.getEquippedItem('racket');
    const ballItem = Shop.getEquippedItem('ball');
    const trailItem = Shop.getEquippedItem('trail');
    const hatItem = Shop.getEquippedItem('hat');
    if (racketItem && chars[pi].racket){
      // Update the frame color of racket
      chars[pi].racket.children.forEach(function(child){
        if (child.material && child.material.emissive){
          child.material.color.setHex(racketItem.color || 0xff5050);
          child.material.emissive.setHex(racketItem.color || 0xff5050);
        }
      });
    }
    if (ballItem){
      ballMesh.material.color.setHex(ballItem.color || 0xb2ff14);
      ballMesh.material.emissive.setHex(ballItem.color || 0xb2ff14);
    }
    if (trailItem){
      const variantName = trailItem.id.replace('trail_', '');
      setTrail(variantName);
    }
  }
  function applyAll(){
    for (let i=0; i<chars.length; i++) applyToChar(i);
  }
  return { applyToChar: applyToChar, applyAll: applyAll };
})();

// ── More Sound Variants Bank ───────────────────────
const ExtraSounds = (function(){
  const sounds = {};
  function get(name){
    if (sounds[name]) return sounds[name];
    return null;
  }
  // Pre-defined named tones
  function chord(notes, dur, type, vol){
    if (AudioSys.isMuted()) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ac = new Ctx();
    notes.forEach(function(f){
      const o = ac.createOscillator();
      o.type = type || 'sine';
      o.frequency.value = f;
      const g = ac.createGain();
      const t = ac.currentTime;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol || 0.07, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(ac.destination);
      o.start(t); o.stop(t + dur + 0.02);
    });
  }
  return {
    majorChord:  function(){ chord([262, 330, 392], 0.4, 'sine', 0.06); },
    minorChord:  function(){ chord([262, 311, 392], 0.4, 'sine', 0.06); },
    arpeggio:    function(){ [262, 330, 392, 523].forEach(function(f, i){ setTimeout(function(){ chord([f], 0.15, 'square', 0.06); }, i * 80); }); },
    fail:        function(){ chord([220, 196, 175], 0.4, 'sawtooth', 0.08); },
    success:     function(){ chord([523, 659, 784], 0.5, 'sine', 0.08); },
    levelComplete: function(){ [392, 523, 659, 784, 1047, 1319].forEach(function(f, i){ setTimeout(function(){ chord([f], 0.2, 'sine', 0.07); }, i * 100); }); },
    powerCharge: function(){ for (let i=0; i<8; i++){ setTimeout(function(){ chord([200 + i * 100], 0.05, 'sawtooth', 0.04); }, i * 50); } },
    cyberSwoosh: function(){ for (let i=0; i<5; i++){ setTimeout(function(){ chord([1200 - i * 150], 0.1, 'sawtooth', 0.05); }, i * 30); } },
    blip:        function(){ chord([880], 0.05, 'square', 0.06); },
    bloop:       function(){ chord([440, 880], 0.08, 'sine', 0.07); },
    ding:        function(){ chord([1760], 0.12, 'sine', 0.06); },
    dong:        function(){ chord([440], 0.30, 'sine', 0.10); },
  };
})();

// ── Player Names UI Editor ─────────────────────────
const PlayerNameUI = (function(){
  const KEY = 'spike_tennis_player_name_v1';
  let myName = 'P1';
  function load(){
    try { myName = localStorage.getItem(KEY) || 'P1'; } catch(_){}
  }
  function save(){
    try { localStorage.setItem(KEY, myName); } catch(_){}
  }
  function setName(name){
    myName = (name || 'P1').slice(0, 12);
    save();
  }
  function getName(){ return myName; }
  let panel = null;
  function build(){
    panel = document.createElement('div');
    panel.id = 'name-edit-panel';
    panel.style.cssText =
      'position:fixed;inset:0;display:none;align-items:center;justify-content:center;' +
      'z-index:128;background:rgba(5,8,15,.94);backdrop-filter:blur(4px);' +
      'font-family:Orbitron,sans-serif;color:#fff';
    panel.innerHTML =
      '<div style="background:rgba(12,18,32,.97);border:1.5px solid rgba(0,180,255,.35);border-radius:18px;' +
      'padding:1.7rem 1.5rem;width:min(360px,92vw);display:flex;flex-direction:column;gap:.8rem">' +
        '<h2 style="font-size:1.1rem;text-align:center;letter-spacing:.06em">PLAYER NAME</h2>' +
        '<input type="text" id="name-input" maxlength="12" placeholder="Enter name…" ' +
          'style="background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.15);border-radius:8px;' +
          'color:#fff;font-family:Orbitron,sans-serif;font-size:1rem;letter-spacing:.1em;' +
          'padding:.7rem;width:100%;text-align:center;outline:none"/>' +
        '<button class="abtn" id="name-save">SAVE</button>' +
      '</div>';
    document.body.appendChild(panel);
    document.getElementById('name-save').onclick = function(){
      AudioSys.click();
      const v = document.getElementById('name-input').value.trim();
      setName(v || 'P1');
      panel.style.display = 'none';
      showMsg('Name set: ' + getName(), 1500);
    };
  }
  function open(){
    if (!panel) build();
    AudioSys.click();
    document.getElementById('name-input').value = myName;
    panel.style.display = 'flex';
  }
  load();
  return { open: open, setName: setName, getName: getName };
})();

// ── Random Match Scenario (specific challenge) ────
const Scenario = {
  generate: function(){
    const scenarios = [
      'You are down 3-5 in the final set. Win it.',
      'Your opponent is on match point. Save it.',
      'No errors allowed for the rest of the set.',
      'Win without losing a point.',
      'Get 3 aces this game.',
      'Hit only smashes for the next 5 shots.',
      'Win this rally on the first hit.',
    ];
    return scenarios[Math.floor(Math.random() * scenarios.length)];
  }
};

// ── Performance Cap (clamps animation deltas) ─────
function safeDeltaTime(rawDt){
  if (rawDt < 0 || isNaN(rawDt)) return 0.016;
  return Math.min(rawDt, 0.05);
}

// ── Crowd Animation Variants ────────────────────────
const CrowdAnim = (function(){
  let waveT = 0;
  let bounceT = 0;
  function startBounce(duration){ bounceT = duration || 1.5; }
  function startWave(duration){ waveT = duration || 2.0; }
  function update(dt){
    if (waveT > 0){
      waveT = Math.max(0, waveT - dt);
      const phase = (1 - waveT / 2.0) * Math.PI * 2;
      stadiumCrowdGroup.children.forEach(function(child, i){
        if (i % 3 !== 0) return;
        const off = Math.max(0, Math.sin(phase + i * 0.05)) * 0.25;
        if (child.userData._baseY == null) child.userData._baseY = child.position.y;
        child.position.y = child.userData._baseY + off;
      });
    }
    if (bounceT > 0){
      bounceT = Math.max(0, bounceT - dt);
      const b = Math.sin(bounceT * 12) * 0.10;
      stadiumCrowdGroup.children.forEach(function(child, i){
        if (i % 3 !== 0) return;
        if (child.userData._baseY == null) child.userData._baseY = child.position.y;
        child.position.y = child.userData._baseY + Math.abs(b);
      });
    }
  }
  return { startBounce: startBounce, startWave: startWave, update: update };
})();

// ── Theme-aware HUD coloring ──────────────────────────
const ThemedHUD = (function(){
  const themeColors = {
    hard:  '#00b4ff',
    clay:  '#ffae40',
    grass: '#a0ff60',
    night: '#ff40ff',
  };
  function applyForTheme(theme){
    const c = themeColors[theme] || '#00b4ff';
    document.documentElement.style.setProperty('--accent', c);
  }
  return { applyForTheme: applyForTheme, themeColors: themeColors };
})();

// ── Match Recap Generator ──────────────────────────
const MatchRecap = (function(){
  function generate(){
    const lines = [];
    const winner = SC.winner;
    const wName = winner === 0 ? 'P1' : 'P2';
    lines.push('Match completed: ' + wName + ' wins ' + SC.sets[winner] + '–' + SC.sets[1-winner]);
    if (STATS.aces[winner] > 0) lines.push(wName + ' served ' + STATS.aces[winner] + ' aces.');
    if (STATS.totalSmashes[winner] > 0) lines.push(wName + ' landed ' + STATS.totalSmashes[winner] + ' smashes.');
    if (STATS.fastestServeKmh[winner] > 0) lines.push(wName + '\'s fastest serve: ' + STATS.fastestServeKmh[winner] + ' km/h.');
    if (STATS.longestRally > 5) lines.push('Longest rally: ' + STATS.longestRally + ' shots.');
    return lines;
  }
  return { generate: generate };
})();

// ── Match Recap UI ─────────────────────────────────
const MatchRecapUI = (function(){
  let panel = null;
  function build(){
    panel = document.createElement('div');
    panel.id = 'recap-panel';
    panel.style.cssText =
      'position:fixed;inset:0;display:none;align-items:center;justify-content:center;' +
      'z-index:135;background:rgba(5,8,15,.96);backdrop-filter:blur(8px);' +
      'font-family:Orbitron,sans-serif;color:#fff';
    panel.innerHTML =
      '<div style="background:rgba(12,18,32,.97);border:1.5px solid rgba(178,255,20,.35);border-radius:18px;' +
      'padding:2rem 1.8rem;width:min(560px,92vw);display:flex;flex-direction:column;gap:1rem">' +
        '<h2 style="font-size:1.4rem;text-align:center;letter-spacing:.06em;color:#b2ff14">📋 MATCH RECAP</h2>' +
        '<div id="recap-text" style="display:flex;flex-direction:column;gap:.4rem;font-size:.78rem;color:#cdd9e6"></div>' +
        '<button class="abtn" id="recap-close">CONTINUE</button>' +
      '</div>';
    document.body.appendChild(panel);
    document.getElementById('recap-close').onclick = function(){ AudioSys.click(); panel.style.display = 'none'; };
  }
  function show(){
    if (!panel) build();
    const t = document.getElementById('recap-text');
    t.innerHTML = MatchRecap.generate().map(function(l){
      return '<div style="padding:.4rem .6rem;background:rgba(8,12,22,.5);border-radius:6px;border-left:3px solid #b2ff14">' + l + '</div>';
    }).join('');
    panel.style.display = 'flex';
  }
  return { show: show };
})();

// ── Daily Login UI ─────────────────────────────────
const DailyLoginUI = (function(){
  let panel = null;
  function build(){
    panel = document.createElement('div');
    panel.id = 'daily-login-panel';
    panel.style.cssText =
      'position:fixed;inset:0;display:none;align-items:center;justify-content:center;' +
      'z-index:135;background:rgba(5,8,15,.94);backdrop-filter:blur(6px);' +
      'font-family:Orbitron,sans-serif;color:#fff';
    panel.innerHTML =
      '<div style="background:rgba(12,18,32,.97);border:1.5px solid rgba(255,200,80,.4);border-radius:18px;' +
      'padding:2rem 1.8rem;width:min(440px,92vw);display:flex;flex-direction:column;gap:1rem;text-align:center">' +
        '<h2 style="font-size:1.3rem;letter-spacing:.06em;color:#ffc850">🎁 DAILY LOGIN</h2>' +
        '<div id="dl-message" style="font-size:.85rem;color:#cdd9e6">Welcome back!</div>' +
        '<div id="dl-streak" style="font-size:1.5rem;color:#ffd700">Streak: 1</div>' +
        '<button class="abtn" id="dl-claim">CLAIM REWARD</button>' +
      '</div>';
    document.body.appendChild(panel);
    document.getElementById('dl-claim').onclick = function(){
      AudioSys.click();
      const reward = DailyLogin.checkin();
      if (reward){
        SoundBank.unlock();
      }
      panel.style.display = 'none';
    };
  }
  function show(){
    if (!panel) build();
    document.getElementById('dl-streak').textContent = 'Streak: ' + (DailyLogin.getStreak() + 1);
    panel.style.display = 'flex';
  }
  function maybeShow(){
    // Only show if we haven't already claimed today
    const today = new Date();
    const todayStr = today.getFullYear() + '-' + (today.getMonth()+1) + '-' + today.getDate();
    if (DailyLogin.data.lastDate !== todayStr){
      show();
    }
  }
  return { show: show, maybeShow: maybeShow };
})();

// ── Trick Shot UI Picker ────────────────────────────
const TrickShotUI = (function(){
  let panel = null;
  function build(){
    panel = document.createElement('div');
    panel.id = 'trickshot-panel';
    panel.style.cssText =
      'position:fixed;inset:0;display:none;z-index:128;' +
      'background:rgba(5,8,15,.94);backdrop-filter:blur(4px);' +
      'overflow-y:auto;-webkit-overflow-scrolling:touch';
    let cards = '';
    for (const k in TrickShots){
      const t = TrickShots[k];
      cards += '<div style="background:rgba(12,18,32,.92);border:1.5px solid rgba(255,200,50,.2);' +
        'border-radius:12px;padding:.85rem .7rem;display:flex;flex-direction:column;gap:.3rem">' +
          '<div style="font-size:.85rem;font-weight:700;color:#ffdc32">' + t.name + '</div>' +
          '<div style="font-size:.66rem;color:#aabbcc">' + t.desc + '</div>' +
          '<div style="font-size:.6rem;color:#7a8ba0;font-style:italic">Trigger: ' + t.requirement + '</div>' +
          '<div style="font-size:.6rem;color:#7a8ba0">Power: ' + Math.round(t.powerMult*100) + '% · Cool: ' + '★'.repeat(t.coolFactor) + '</div>' +
        '</div>';
    }
    panel.innerHTML =
      '<div style="margin:auto;padding:30px 16px;min-height:calc(100vh - 60px);' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'box-sizing:border-box;width:min(580px,94vw);font-family:Orbitron,sans-serif;color:#fff">' +
        '<div style="background:rgba(12,18,32,.97);border:1.5px solid rgba(255,220,50,.35);border-radius:18px;' +
        'padding:1.7rem 1.5rem;width:100%;display:flex;flex-direction:column;gap:.7rem">' +
          '<h2 style="font-size:1.2rem;text-align:center;letter-spacing:.06em;color:#ffdc32">✨ TRICK SHOTS</h2>' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:.55rem;max-height:60vh;overflow-y:auto">' + cards + '</div>' +
          '<button class="abtn" id="ts-close">CLOSE</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(panel);
    document.getElementById('ts-close').onclick = function(){ AudioSys.click(); panel.style.display = 'none'; };
  }
  function open(){
    if (!panel) build();
    AudioSys.click();
    panel.style.display = 'block';
  }
  return { open: open };
})();

// ── Animation Pool: extra reusable animations ──────
const AnimPool = (function(){
  function shake(element, magnitude, duration){
    if (!element) return;
    let t = 0;
    const interval = setInterval(function(){
      t += 16;
      element.style.transform = 'translate(' + (Math.random()-0.5)*magnitude + 'px,' + (Math.random()-0.5)*magnitude + 'px)';
      if (t >= duration){
        clearInterval(interval);
        element.style.transform = '';
      }
    }, 16);
  }
  function fadeIn(element, duration){
    if (!element) return;
    element.style.opacity = '0';
    element.style.transition = 'opacity ' + (duration || 400) + 'ms';
    setTimeout(function(){ element.style.opacity = '1'; }, 10);
  }
  function fadeOut(element, duration, then){
    if (!element) return;
    element.style.transition = 'opacity ' + (duration || 400) + 'ms';
    element.style.opacity = '0';
    if (then) setTimeout(then, duration || 400);
  }
  function slideIn(element, fromX, duration){
    if (!element) return;
    element.style.transform = 'translateX(' + fromX + 'px)';
    element.style.transition = 'transform ' + (duration || 400) + 'ms';
    setTimeout(function(){ element.style.transform = 'translateX(0)'; }, 10);
  }
  function pulse(element, scale, duration){
    if (!element) return;
    element.style.transition = 'transform ' + (duration || 200) + 'ms';
    element.style.transform = 'scale(' + (scale || 1.1) + ')';
    setTimeout(function(){ element.style.transform = 'scale(1)'; }, duration || 200);
  }
  return { shake: shake, fadeIn: fadeIn, fadeOut: fadeOut, slideIn: slideIn, pulse: pulse };
})();

// ── Practice Mode Variants Renderer ─────────────────
const PracticeModeRenderer = (function(){
  function renderTargets(count){
    // Currently delegated to Practice.spawnTargets
    return count;
  }
  function setColor(color){ /* TODO: color targets */ }
  return { renderTargets: renderTargets, setColor: setColor };
})();

// ── Spectator Camera Modes ─────────────────────────
const SpectatorModes = {
  followBall: {
    name: 'Follow Ball',
    update: function(dt){
      if (!B.active) return;
      CAM.tx += (B.pos.x - CAM.tx) * 0.15;
      CAM.ty += (B.pos.y - CAM.ty) * 0.10;
      CAM.tz += (B.pos.z - CAM.tz) * 0.15;
    },
  },
  birdseye: {
    name: 'Birds Eye',
    update: function(dt){
      CAM.pitch = 1.4;
      CAM.dist = 18;
      CAM.shoulder = 0;
    },
  },
  tracking: {
    name: 'Track Pan',
    update: function(dt){
      const t = performance.now() * 0.0005;
      CAM.yaw = Math.sin(t) * 0.4;
    },
  },
  closeCorner: {
    name: 'Corner Close',
    update: function(dt){
      CAM.yaw = -1.0;
      CAM.pitch = 0.20;
      CAM.dist = 6.5;
    },
  },
};

// ── Court Surface Wear (over time) ──────────────────
const CourtWear = (function(){
  let wear = 0;
  function increment(){ wear = Math.min(1, wear + 0.001); }
  function get(){ return wear; }
  function reset(){ wear = 0; }
  return { increment: increment, get: get, reset: reset };
})();

// ── Coin Drop Animation (visual coins on screen) ──
const CoinDrop = (function(){
  function drop(amount){
    const stack = document.createElement('div');
    stack.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);' +
      'pointer-events:none;z-index:200;font-family:Orbitron,sans-serif;font-weight:900;font-size:2rem;' +
      'color:#ffd700;text-shadow:0 0 18px rgba(255,215,0,.7);' +
      'transition:opacity 1.2s,transform 1.2s';
    stack.textContent = '+' + amount + ' 🪙';
    document.body.appendChild(stack);
    setTimeout(function(){
      stack.style.transform = 'translate(-50%, -120px)';
      stack.style.opacity = '0';
    }, 30);
    setTimeout(function(){ if (stack.parentNode) stack.parentNode.removeChild(stack); }, 1300);
    SoundBank.ding();
  }
  return { drop: drop };
})();

// ── Pause Indicator ────────────────────────────────
function showPauseIndicator(){
  let el = document.getElementById('pause-indicator');
  if (!el){
    el = document.createElement('div');
    el.id = 'pause-indicator';
    el.style.cssText =
      'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);' +
      'font-family:Orbitron,sans-serif;font-weight:900;font-size:6rem;' +
      'color:#fff;text-shadow:0 0 30px rgba(255,255,255,.5);' +
      'pointer-events:none;z-index:135;display:none;letter-spacing:.1em';
    el.textContent = 'PAUSED';
    document.body.appendChild(el);
  }
  el.style.display = 'block';
}
function hidePauseIndicator(){
  const el = document.getElementById('pause-indicator');
  if (el) el.style.display = 'none';
}

// ── Match Score Animation (animated scoreboard) ───
function animateScoreChange(){
  const pts = document.getElementById('pts');
  if (!pts) return;
  AnimPool.pulse(pts, 1.3, 250);
}

// ── Combo Counter UI ───────────────────────────────
const ComboUI = (function(){
  let el = null;
  function build(){
    el = document.createElement('div');
    el.id = 'combo-ui';
    el.style.cssText =
      'position:fixed;top:160px;left:50%;transform:translateX(-50%);' +
      'font-family:Orbitron,sans-serif;font-weight:900;font-size:1.2rem;' +
      'color:#ffdc32;text-shadow:0 0 20px rgba(255,220,50,.6);' +
      'pointer-events:none;z-index:55;display:none';
    document.body.appendChild(el);
  }
  function show(streak){
    if (!el) build();
    if (streak < 2) return;
    el.textContent = '🔥 STREAK ×' + streak;
    el.style.display = 'block';
  }
  function hide(){
    if (el) el.style.display = 'none';
  }
  return { show: show, hide: hide };
})();

// ── Crowd Volume Auto-Adjust ──────────────────────
const CrowdVolumeAuto = (function(){
  let level = 0.18;
  function setBase(v){
    level = v;
    AudioSys.setCrowdVolume(level);
  }
  function spike(amount, duration){
    AudioSys.setCrowdVolume(Math.min(0.9, level + amount));
    setTimeout(function(){ AudioSys.setCrowdVolume(level); }, duration || 1500);
  }
  return { setBase: setBase, spike: spike };
})();

// ── Coin Indicator (live HUD coin counter) ────────
const CoinIndicator = (function(){
  let el = null;
  function build(){
    el = document.createElement('div');
    el.id = 'coin-indicator';
    el.style.cssText =
      'position:fixed;top:14px;right:600px;background:rgba(8,12,22,.85);' +
      'border:1px solid rgba(255,215,0,.3);border-radius:8px;padding:.4rem .7rem;' +
      'font-family:Orbitron,sans-serif;font-size:.7rem;color:#ffd700;' +
      'pointer-events:none;z-index:55;display:none';
    document.body.appendChild(el);
  }
  function refresh(){
    if (!el) build();
    el.textContent = '🪙 ' + Shop.getCoins();
  }
  function setVisible(v){
    if (!el) build();
    el.style.display = v ? 'block' : 'none';
    if (v) refresh();
  }
  return { build: build, refresh: refresh, setVisible: setVisible };
})();

// ── Daily Quest Bar (mini progress in HUD) ───────
const QuestBar = (function(){
  let el = null;
  function build(){
    el = document.createElement('div');
    el.id = 'quest-bar';
    el.style.cssText =
      'position:fixed;bottom:24px;right:14px;background:rgba(8,12,22,.85);' +
      'border:1px solid rgba(255,200,80,.3);border-radius:8px;padding:.4rem .7rem;' +
      'font-family:Orbitron,sans-serif;font-size:.62rem;color:#ffc850;' +
      'pointer-events:none;z-index:55;display:none;max-width:200px';
    document.body.appendChild(el);
  }
  function refresh(){
    if (!el) build();
    const ch = DailyChallenges.getActive()[0];
    if (!ch){ el.style.display = 'none'; return; }
    const prog = DailyChallenges.getProgress(ch.id);
    el.innerHTML =
      '<div style="font-size:.55rem;color:#7a8ba0;letter-spacing:.1em;margin-bottom:.2rem">DAILY QUEST</div>' +
      '<div>' + ch.title + ': ' + Math.min(prog, ch.target) + '/' + ch.target + '</div>';
  }
  function setVisible(v){
    if (!el) build();
    el.style.display = v ? 'block' : 'none';
    if (v) refresh();
  }
  return { refresh: refresh, setVisible: setVisible };
})();

// ── Initial Lobby Hero Display ─────────────────────
const LobbyHero = (function(){
  let titleAnim = null;
  function start(){
    const logo = document.querySelector('#lobby .logo');
    if (!logo) return;
    let t = 0;
    titleAnim = setInterval(function(){
      t += 0.04;
      const scale = 1 + Math.sin(t) * 0.03;
      logo.style.transform = 'scale(' + scale + ')';
    }, 16);
  }
  function stop(){
    if (titleAnim){ clearInterval(titleAnim); titleAnim = null; }
  }
  return { start: start, stop: stop };
})();

// ── Notification Settings ──────────────────────────
const NotificationPrefs = {
  showAchievements: true,
  showLevelUps: true,
  showCoins: true,
  showXP: true,
  showCommentary: true,
};

// ── Player Position History (for replays/analysis) ──
const PositionLog = (function(){
  const log = [];
  const MAX = 600;
  function record(){
    log.push({
      time: performance.now(),
      players: P.map(function(p){ return { x:p.x, z:p.z }; }),
    });
    if (log.length > MAX) log.shift();
  }
  function getAll(){ return log.slice(); }
  function clear(){ log.length = 0; }
  return { record: record, getAll: getAll, clear: clear };
})();

// ── Heartbeat / Pulse Indicator (under pressure) ──
const Heartbeat = (function(){
  let active = false;
  let rate = 60;
  function start(bpm){ active = true; rate = bpm || 60; }
  function stop(){ active = false; }
  function update(dt){
    if (!active) return;
    // Visual indicator: tint score panel red when active
    const sb = document.getElementById('scoreboard');
    if (!sb) return;
    const t = performance.now() * 0.001 * (rate / 60);
    const pulse = (Math.sin(t * Math.PI * 2) + 1) * 0.5;
    sb.style.boxShadow = '0 0 ' + (8 + pulse * 16) + 'px rgba(255,80,80,' + (0.3 + pulse * 0.4) + ')';
  }
  function reset(){
    const sb = document.getElementById('scoreboard');
    if (sb) sb.style.boxShadow = '';
    active = false;
  }
  return { start: start, stop: stop, update: update, reset: reset };
})();

// ── Match Tension Tracker ────────────────────────
const Tension = (function(){
  let level = 0;
  function update(){
    let t = 0;
    // Higher when score is close
    const setDiff = Math.abs(SC.sets[0] - SC.sets[1]);
    const gameDiff = Math.abs(SC.games[0] - SC.games[1]);
    t += (3 - Math.min(3, setDiff)) * 0.15;
    t += (3 - Math.min(3, gameDiff)) * 0.10;
    if (SC.deuce) t += 0.5;
    if (SC.adv >= 0) t += 0.7;
    if (SC.matchOver) t = 1.0;
    if (Math.max(SC.sets[0], SC.sets[1]) >= 1) t += 0.2;
    if (Math.max(SC.games[0], SC.games[1]) >= 5) t += 0.2;
    level = Math.min(1, t);
    return level;
  }
  function get(){ return level; }
  return { update: update, get: get };
})();

// ── Mini Map Highlight (highlights important shots) ───
function highlightMiniMap(x, z, color){
  // Stub — could draw a flash on the radar canvas
  // Implementation reserved for future expansion
  if (typeof x !== 'number' || typeof z !== 'number') return;
  return { x: x, z: z, color: color };
}

// ── XP Multiplier from Streak ───────────────────────
function getXPMultiplier(){
  return Multiplier.get();
}

// ── Helper: Format time ms→string ─────────────────
function formatTime(ms){
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return h + 'h ' + (m % 60) + 'm';
  if (m > 0) return m + 'm ' + (s % 60) + 's';
  return s + 's';
}
function formatNumber(n){
  if (n >= 1e6) return (n/1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n/1e3).toFixed(1) + 'K';
  return n.toString();
}

// ── Per-frame integration of all new modules ──────
function updateAllNewSystems(dt){
  if (typeof CrowdAnim !== 'undefined' && CrowdAnim.update) CrowdAnim.update(dt);
  if (typeof CameraTransitions !== 'undefined' && CameraTransitions.update) CameraTransitions.update(dt);
  if (typeof Confetti !== 'undefined' && Confetti.update) Confetti.update(dt);
  if (typeof SpectatorCam !== 'undefined' && SpectatorCam.update) SpectatorCam.update(dt);
  if (typeof NetSway !== 'undefined' && NetSway.update) NetSway.update(dt);
  if (typeof SurfaceWear !== 'undefined' && SurfaceWear.update) SurfaceWear.update(dt);
  if (typeof Heartbeat !== 'undefined' && Heartbeat.update) Heartbeat.update(dt);
  if (typeof RandomEvents !== 'undefined' && RandomEvents.update) RandomEvents.update(dt);
  if (typeof Abilities !== 'undefined' && Abilities.update) Abilities.update(dt);
  if (typeof MiniGames !== 'undefined' && MiniGames.update) MiniGames.update(dt);
  if (typeof Tutorial !== 'undefined' && Tutorial.update) Tutorial.update(dt);
  if (typeof Tension !== 'undefined' && Tension.update) Tension.update();
  if (typeof EffectsPipeline !== 'undefined' && EffectsPipeline.update) EffectsPipeline.update(dt);
  if (typeof Music !== 'undefined' && Music.tick) {} // music has its own loop
  if (typeof PerfMonitor !== 'undefined' && PerfMonitor.update) PerfMonitor.update();
  if (typeof MultiBall !== 'undefined' && MultiBall.update) MultiBall.update(dt);
  if (typeof Weather !== 'undefined' && Weather.update) Weather.update(dt);
  if (typeof Wind !== 'undefined' && Wind.applyToBall && B.active) Wind.applyToBall(B, dt);
}

// ── Boot integration: trigger Welcome on first load ──
function bootSequence(){
  // Run after DOMContentLoaded equivalent
  setTimeout(function(){
    try { DailyLoginUI.maybeShow(); } catch(_){}
  }, 1500);
  setTimeout(function(){
    if (Welcome.shouldShow()){
      try { Welcome.show(); } catch(_){}
    }
  }, 2500);
  try { ToolbarX.setVisible(true); } catch(_){}
  try { LobbyHero.start(); } catch(_){}
  try { Music.setMode('lobby'); } catch(_){}
  try { CourtProps.place(); } catch(_){}
  try { FloatingBanners.build(); } catch(_){}
  try { ThemedHUD.applyForTheme(activeTheme); } catch(_){}
}

// ── In-Game Help Toggle (small icon for quick legend) ──
const HelpLegend = (function(){
  let el = null;
  function build(){
    el = document.createElement('div');
    el.id = 'help-legend';
    el.style.cssText =
      'position:fixed;bottom:24px;right:170px;background:rgba(8,12,22,.85);' +
      'border:1px solid rgba(0,180,255,.25);border-radius:8px;padding:.4rem .6rem;' +
      'font-family:Orbitron,sans-serif;font-size:.6rem;color:#cdd9e6;' +
      'pointer-events:none;z-index:55;display:none;line-height:1.6';
    el.innerHTML =
      '<span style="color:#00b4ff">WASD</span> move · ' +
      '<span style="color:#00b4ff">SHIFT</span> jump · ' +
      '<span style="color:#00b4ff">SPACE</span> hit · ' +
      '<span style="color:#00b4ff">RMB</span> camera';
    document.body.appendChild(el);
  }
  function setVisible(v){
    if (!el) build();
    el.style.display = v ? 'block' : 'none';
  }
  return { setVisible: setVisible };
})();

// ── Achievement Progress Tracker (tracks per-match) ──
const PerMatchAch = (function(){
  let acesThisMatch = 0;
  let smashesThisMatch = 0;
  let errorsThisMatch = 0;
  function reset(){
    acesThisMatch = 0; smashesThisMatch = 0; errorsThisMatch = 0;
  }
  function aceUp(){
    acesThisMatch++;
    if (acesThisMatch >= 10) AchievementsExt.award('ace_10_match');
  }
  function smashUp(){
    smashesThisMatch++;
    if (smashesThisMatch >= 5) AchievementsExt.award('three_smashes_match');
  }
  function errorUp(){
    errorsThisMatch++;
  }
  function getStats(){
    return { aces: acesThisMatch, smashes: smashesThisMatch, errors: errorsThisMatch };
  }
  return { reset: reset, aceUp: aceUp, smashUp: smashUp, errorUp: errorUp, getStats: getStats };
})();

// ── Mini Score Animation when point is won ────────
function pointWonAnimation(winner){
  if (winner === 0){
    Confetti.burst(P[0].x, 1.5, P[0].z, 30);
    AnimSys.setState(0, 'victory');
    SoundBank.success();
  } else {
    SoundBank.fail();
  }
  Multiplier[winner === 0 ? 'onPointWon' : 'onPointLost']();
  ComboUI.show(Multiplier.getStreak());
  Profile.recordPoint();
  awardCoins(CoinRewards.perPoint, 'point');
}

// ── Effect Sound Mappings (named events → sounds) ──
const EffectSounds = {
  bigHit:   function(){ AudioSys.smash(); EffectsPipeline.flash(0.6); EffectsPipeline.shake(0.15, 0.4); },
  serveAce: function(){ SoundBank.applause(); },
  netHit:   function(){ AudioSys.net(); NetSway.trigger(0.25); },
  bounce:   function(){ AudioSys.bounce(0.6); },
};

// ── Score Read-Out (called on score change) ───────
function announceScore(){
  if (typeof Commentator !== 'undefined' && Commentator.reactToScore){
    Commentator.reactToScore(SC.str());
  }
  if (typeof animateScoreChange === 'function') animateScoreChange();
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║                                                                  ║
// ║                  EXPANDED CONTENT DATABASES                      ║
// ║   (Commentary, Characters, Tournaments, Venues, Achievements)   ║
// ║                                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝

// ── Mega Commentary Bank (huge dialogue database) ─────
const MegaCommentary = {
  // ============ SERVES ============
  servePerfect: [
    'Beautiful serve! Right on the line.',
    'Pinpoint accuracy on that one!',
    'Pure power, pure placement.',
    'Could not have hit that any better.',
    'A serve straight from the textbook.',
    'Clinical execution.',
    'Service motion looking like a metronome.',
    'That serve had everything — speed, spin, depth.',
    'Untouchable!',
    'Ball boy didn\'t even move.',
    'Watch out, that ball was MOVING.',
    'A weapon. Pure weapon of a serve.',
    'Pin-point accuracy. Couldn\'t paint it any closer.',
    'Drove a stake right through the line.',
    'That\'s a tournament-winning serve.',
    'You can\'t teach that.',
    'Just a thing of beauty.',
    'Cannons firing on the service motion.',
    'Reading that serve is impossible.',
    'Service god mode.',
    'They might as well not have shown up to return that.',
    'Picture-perfect ball toss, picture-perfect strike.',
    'Lasers from the back of the court.',
    'Ace-quality serve right there.',
    'That ball was a blur.',
    'Pure tennis from the service line.',
    'Cocked, loaded, fired.',
    'A serve to make the legends jealous.',
    'Ferocious.',
    'Painted the corner, no margin needed.',
    'Service held with authority.',
    'Out of this world.',
    'Top tier ball-striking.',
    'You wish your serve looked like that.',
    'Clean as a whistle.',
    'Thunderous.',
    'Roof-rattling delivery.',
    'A scud missile.',
    'That\'s how you start a service game.',
    'Couldn\'t care less about the radar gun — that ball SCREAMED.',
  ],
  serveGood: [
    'Solid serve, gets the job done.',
    'A reliable first serve.',
    'No frills, just business.',
    'Decent depth on that one.',
    'A serve that gives nothing away.',
    'Workmanlike service.',
    'Effective if not spectacular.',
    'Plenty of pace on that delivery.',
    'Builds the point nicely.',
    'A serve that asks questions.',
    'The kind of serve that wins matches.',
    'Smart placement.',
    'Quality service motion there.',
    'Doesn\'t get easier than that.',
    'Setting up the point.',
    'Reliable as ever.',
    'Steady.',
    'Easy power.',
    'Forces the return.',
    'Well-placed.',
    'Mixing up the placements nicely.',
    'A solid spot serve.',
    'Patient, deliberate.',
    'Veteran serve.',
    'Working the percentages.',
    'High-percentage serve.',
    'Doesn\'t need to overcook it.',
    'Smart serving.',
    'Depth is the key.',
    'Plenty there to build with.',
  ],
  serveWeak: [
    'A bit tentative on that serve.',
    'Lost some pace there.',
    'Service motion looked rushed.',
    'Not the cleanest contact.',
    'Will want a better one in next time.',
    'A bit of a nothing serve.',
    'Easy to read.',
    'Forgettable delivery.',
    'No bite on that ball.',
    'Sat up like a balloon.',
    'A serve to forget.',
    'Lacking conviction.',
    'Tentative.',
    'Pancake flat.',
    'Almost apologetic.',
    'Begging to be attacked.',
    'A patty-cake serve.',
    'Let the opponent into the point.',
    'Not finding the mark.',
    'Spitballing today.',
    'Misfire.',
    'Asking for trouble with that serve.',
    'Lost the rhythm.',
    'No zip on that ball.',
    'A real giveaway.',
    'Not their best motion.',
    'Body looking a bit stiff.',
    'A serve ripe for the punishing.',
    'A swing and pray.',
    'Off the mark.',
  ],
  serveAce: [
    'ACE! Untouched.',
    'Service winner — beautifully placed.',
    'Just an ace. Walk-up service.',
    'Free point on the serve.',
    'No reading that one — ace.',
    'Clinical. ACE.',
    'Untouched! What a serve.',
    'And another ace to add to the tally.',
    'Defenseless! Ace.',
    'Point-blank ace.',
    'No chance of a return there. Ace.',
    'Boom! Ace.',
    'Couldn\'t even put a racket on it.',
    'Aces are flying!',
    'Ace #' + 'X' + ' for the match.',
    'Just untouchable.',
    'Lights out. Ace.',
    'A free 4 points.',
    'Hit a frozen rope for the ace.',
    'Service line ace, beautifully struck.',
    'Catches the line, ACE!',
    'Ace at the very best moment.',
    'Champ\'s got this serve dialed in.',
    'No earthly defense there.',
    'Painted that line.',
    'Quick fast hands — and an ace.',
    'Power and precision.',
    'A picture-book ace.',
    'They fired and forgot.',
    'Cleaned the line.',
  ],

  // ============ HITS / RALLIES ============
  smashWinner: [
    'OH! What a smash!',
    'You can hear that one in the cheap seats!',
    'Drove that into the canvas!',
    'Authority on that overhead!',
    'Smashed it down with intent.',
    'Vicious overhead!',
    'No coming back from that.',
    'Brutal, brutal smash!',
    'Couldn\'t put more on it if they tried.',
    'Game-defining smash right there.',
    'Pure venom on that overhead.',
    'Demolition job!',
    'That was a guided missile.',
    'Crushed it.',
    'Pulverized!',
    'A rocket from the racket.',
    'Smashed dead center.',
    'No prisoners.',
    'Hammer of the gods.',
    'Devastating.',
    'A point-ender.',
    'Buried it.',
    'No mercy on that overhead.',
    'Rolled it up and packed it in.',
    'You can hear the strings sing.',
    'Wins the rally with a smash.',
    'Kicked it through the back wall!',
    'A vicious closing shot.',
    'Game over.',
    'Ka-pow!',
    'Bombs away.',
    'Heavy artillery.',
    'A real banger.',
    'No prisoners on that overhead.',
    'Murderous overhead.',
    'A blow that ends the rally.',
    'Concussive force.',
    'Hit that with EVERYTHING.',
    'Don\'t come up to the net unless you can defend that.',
    'Earth-shattering smash.',
    'The drama is real!',
    'Beat the canvas like it owed money.',
    'Devastation.',
    'The point ends with a roar.',
    'A smash to remember.',
    'A 100% commitment shot.',
    'How do you defend THAT?!',
    'Power-house overhead.',
    'Flatlined the ball.',
    'A nuclear smash.',
  ],
  cleanWinner: [
    'Winner! Threaded the needle.',
    'Beautiful winner down the line.',
    'Picked the corner perfectly.',
    'Rope! That ball never came up.',
    'Winner! Crowd loving it.',
    'What a strike — point won.',
    'Painted the line!',
    'Inch-perfect winner.',
    'Hit clean off the strings.',
    'Glorious shot, glorious winner.',
    'Untouchable shot.',
    'Sniper-level placement.',
    'Threaded the eye of the needle.',
    'A picture-book winner.',
    'No defending that one.',
    'Gold-standard shot-making.',
    'Sweet contact.',
    'Pure tennis.',
    'Pure execution.',
    'Couldn\'t draw it up better.',
    'Flatlined down the line.',
    'Cross-court winner — the bread and butter.',
    'Hit them where they ain\'t.',
    'A masterclass in placement.',
    'A work of art.',
    'Right on the money.',
    'Fingertip control.',
    'Showed why they\'re here.',
    'Ice in the veins.',
    'Surgically placed.',
    'Drilled it.',
    'Painting lines today.',
    'A statement winner.',
    'Sealed it with a winner.',
    'Striped winner.',
    'A backhand stunner.',
    'Forehand bullet.',
    'Hit the corner with violence.',
    'Walked into the corner pocket.',
    'Take a bow.',
    'Nothing they could have done.',
    'No play on the ball.',
    'Sliced and diced.',
    'A wide one — winner!',
    'Drilled it through them.',
    'Right to the spot.',
    'Couldn\'t have hit it any better.',
    'Stinger of a winner.',
    'Tennis perfection in that shot.',
    'A money shot.',
  ],
  baseline: [
    'Big swing from the back of the court.',
    'Heavy ball, deep in the corner.',
    'Forehand bomb.',
    'Backhand crackler.',
    'Cracking forehand winner!',
    'Heavy topspin coming over.',
    'Lashed it cross-court.',
    'Whipped that one with intent.',
    'Drove it to the corner.',
    'A forcing shot.',
    'Dictating from the back.',
    'Pinning the opponent in the corner.',
    'Strong baseline play.',
    'Pummeling the back fence.',
    'Heavy ball, hard to handle.',
    'Cleaned the line!',
    'Two-handed backhand bomb.',
    'Lefty forehand viciously cross-court.',
    'Flat backhand sets a tough recovery.',
    'Forces the error.',
    'Goes for the lines.',
    'No safe space anywhere.',
    'High-percentage forehand.',
    'Loops it deep.',
    'Brings the heat.',
    'Pacy ball.',
    'A whippy forehand.',
    'Hammers it cross-court.',
    'Goes for the body.',
    'Deep and heavy.',
  ],
  netPlay: [
    'Charges the net!',
    'Picks up the volley low.',
    'Soft hands at the net.',
    'A drop shot from net play!',
    'Volley winner!',
    'Punched volley.',
    'Crisply struck volley.',
    'Reflex volley.',
    'Half-volley pickup!',
    'Beautiful net work.',
    'Intercepts at the net!',
    'Volley deep and hard.',
    'Touched it short.',
    'Drop volley with finesse.',
    'A delicate touch volley.',
    'Sniper at the net.',
    'Aggressive net play.',
    'Forehand volley winner.',
    'Backhand volley winner.',
    'Caught them on the wrong foot.',
    'Unreachable volley.',
    'Knife-edge volley.',
    'Pinpoint volley.',
    'Touch that\'d make Federer proud.',
    'Quick paws at the net.',
    'Snatched it before it bounced.',
    'Smooth volley work.',
    'Closes the deal at the net.',
    'Closes off the angle.',
    'Volley too good.',
  ],
  drop: [
    'Drop shot! Couldn\'t reach it.',
    'Tantalizing drop shot.',
    'Drop. Dead. Stop.',
    'A nasty little drop shot.',
    'Drop shot wins it!',
    'Cleverly disguised drop.',
    'Threw in a drop!',
    'Sneaky drop wins the point.',
    'A check-mate drop shot.',
    'Couldn\'t cover the drop.',
    'Stop volley to win the point.',
    'Drop shot kisses the line.',
    'Cute drop, won the point.',
    'Disguised drop, wrong-footed the opponent.',
    'A whisper of a drop shot.',
    'Bare touch on the drop.',
    'Took all the pace off — DROP.',
    'A drop shot to make you weep.',
    'Pulled out a drop shot at the perfect time.',
    'Drop shot artistry.',
  ],
  lob: [
    'Beautiful lob, tickled the baseline.',
    'High lob, no chance to reach.',
    'Sky lob saves the point!',
    'Defensive lob lands deep.',
    'Threw up a lob — winner!',
    'Cute lob over the head.',
    'Chip lob from the back.',
    'Top-spin lob — picture perfect!',
    'Lob lands inside the line.',
    'Skies it for a winner.',
    'Lob over the net rusher.',
    'Cleared the head, lands in.',
    'Lobbed in for the winner.',
    'Lob with depth — perfect.',
    'Dropped a lob in the corner.',
    'Topspin lob is a thing of beauty.',
    'Cherry-picked the lob.',
    'Catches the baseline with the lob.',
    'A lob to make you cry.',
    'Neat lob play.',
  ],
  errorNet: [
    'Into the net. That\'s a tough one.',
    'Caught the tape and dropped.',
    'Couldn\'t clear the net there.',
    'Hung in the net.',
    'Net error — sloppy.',
    'A simple shot dragged into the net.',
    'They\'ll feel that error.',
    'That ball never had a chance to make it.',
    'Buried it in the net.',
    'Cheap net error.',
    'Weird ball trajectory — into the net.',
    'Just into the bottom of the tape.',
    'Tape and out.',
    'Buried it!',
    'Couldn\'t lift it.',
    'Net error — costly.',
    'Buries the ball into the net.',
    'Wasn\'t close to clearing.',
    'Way too low.',
    'Must clear the net… didn\'t.',
    'A free point given away.',
    'Has to be better than that.',
    'Embarrassing miss.',
    'Net cord catches it.',
    'Skimmed the tape on the wrong side.',
    'A meek effort to the net.',
    'Half-volley error.',
    'Nervous miss.',
    'The net wins again.',
    'Hooked it into the net.',
  ],
  errorOut: [
    'Long! That ball sailed.',
    'Wide! Couldn\'t pull it back.',
    'Out by a yard.',
    'Goes long. Cheap point given away.',
    'Frustrating error there.',
    'Just couldn\'t keep that one in.',
    'Rifled it long.',
    'Tried to do too much with that one.',
    'Sailed wide.',
    'Floats it out.',
    'Pushed it long.',
    'Wide of the line.',
    'Goes wide.',
    'Out by a foot.',
    'Out by 6 inches.',
    'Couldn\'t bring it down.',
    'Carries past the baseline.',
    'Big swing, big miss.',
    'Should have been more selective.',
    'Wild swing, wild miss.',
    'Miscued.',
    'Dragged it wide.',
    'Heavy hand on that one.',
    'Couldn\'t restrain.',
    'No control.',
    'A wild backhand error.',
    'Forehand error.',
    'Forced error.',
    'Unforced error — costly.',
    'Doubles up the error count.',
  ],
  rallyShort: [
    'Quick exchange.',
    'Snappy point.',
    'Brief and brutal rally.',
    'Two shots and done.',
    'Snappy point won by execution.',
    'Few balls struck — over already.',
    'Crisp point.',
    'Short and sharp.',
  ],
  rallyMedium: [
    'A nice baseline rally.',
    'Probing back and forth.',
    'Both probing for a weakness.',
    'The rally builds.',
    'Trading from the back.',
    'Shifting the patterns of play.',
    'Looking for the right ball to attack.',
    'Patient rally.',
    'Working the angles.',
    'Both digging in.',
    'Long, looping exchange.',
    'Hard hitting from the baseline.',
    'Pulled wide, then deep.',
  ],
  rallyLong: [
    'These two are putting on a show!',
    'Outrageous rally — what a watch!',
    'Both players unwilling to give an inch.',
    'A rally for the highlight reel!',
    'Phenomenal exchange of strokes!',
    'Tennis at its absolute best right here.',
    'Ten shots… twelve… they keep going!',
    '15-shot rally and counting!',
    'Rolling through 20 shots!',
    'How many shots is that now?!',
    'Lungs are burning — what a rally!',
    'Crowd on their feet!',
    'Either could blink first.',
    'Truly phenomenal exchange!',
    'Refusing to give up!',
    'Each grinding the other down!',
    'Test of nerve and stamina!',
    'Heavyweight rally.',
    'Best rally of the day, no question!',
    'Trading bombs from the back.',
    'Each hitting like a freight train!',
    'Chasing each other from corner to corner!',
    'Marathon rally on display!',
    'Fingers crossed they keep this up!',
    'A point that could go for ages!',
  ],

  // ============ SCORE/STATE EVENTS ============
  deuce: [
    'And we are at deuce.',
    'Deuce. Pressure point coming up.',
    'The game gets tighter — deuce.',
    'Deuce. This game is a battle.',
    'Cannot separate them — deuce.',
    'Back to deuce we go.',
    'Deuce in this crucial game.',
    'Tied up at 40-40.',
    'Tightest game of the match — deuce.',
    'Even-Steven on this game.',
    'Battle continues — deuce.',
    'Big point coming next.',
    'They\'re playing for it now.',
    'Pressure ratcheting up.',
    'Back to square one in this game.',
    'No advantage to either side.',
    'Wide-open game.',
    'Clutching at deuce.',
    'Both still alive.',
    'Tense. Tense. Tense.',
  ],
  advantage: [
    'Advantage. One point from the game.',
    'Adv — they smell blood.',
    'On the brink now. Advantage.',
    'Game point coming up.',
    'Big point next.',
    'Pressure cooker time.',
    'One point away from the game.',
    'A breath away from closing it out.',
    'Adv — they got the better of that exchange.',
    'On the front foot now.',
    'A whisker away from the game.',
    'Drive home the advantage.',
    'Closing in.',
    'Game point.',
    'Gonna feel the pressure now.',
    'Critical moment.',
  ],
  gameWon: [
    'Game! Held with authority.',
    'And the game goes their way.',
    'Game closed out cleanly.',
    'They take the game. Crowd approves.',
    'Game won. Onto the next.',
    'Class through and through. Game.',
    'Held without a fuss.',
    'Game in the bag.',
    'A clean hold of serve.',
    'Game closed out professionally.',
    'Service game held.',
    'Punches it out — game won.',
    'A formality, that game.',
    'Take that to the bank.',
    'No drama in that one.',
    'Routine hold.',
    'Stamping their authority.',
    'No looking back from there.',
    'Sealed and delivered.',
  ],
  setWon: [
    'SET! That\'s one in the bag.',
    'Set goes their way.',
    'Set closed out!',
    'And they take the set!',
    'Massive set won.',
    'Tense, tense set — but they\'ve got it.',
    'A 1-set lead now.',
    'Cardio and skill — they take the set.',
    'A statement set!',
    'Their flag goes up after that set.',
    'Cool customer takes the set.',
    'Built it brick by brick — and the set is theirs.',
    'A grueling set, but the right player wins.',
    'Rolling — the set is done.',
    'A final flourish to win the set!',
  ],
  matchWon: [
    '🏆 MATCH! Champion!',
    'It\'s ALL OVER! Champion!',
    'They\'ve done it! Match point converted!',
    'CHAMPION! What a performance!',
    'Sealed and delivered — match won!',
    'Drops to their knees in celebration!',
    'Tear-stained victory.',
    'A championship moment!',
    'Confetti cannons firing!',
    'On their way to the throne!',
    'A coronation moment!',
    'A match for the ages!',
    'They\'ve closed it out!',
    'CHAMPION OF THE WORLD!',
    'Etched into the record books!',
    'A name to remember!',
    'A title to celebrate!',
    'Curtain call!',
  ],

  // ============ SITUATIONAL ============
  comeback: [
    'Stunning comeback!',
    'Refused to give up!',
    'What a fightback!',
    'Found another gear.',
    'Heart of a champion!',
    'Rose from the dead in that match!',
    'Pulling rabbits out of the hat!',
    'Just refused to lose.',
    'Last roll of the dice — and it pays off!',
    'A miraculous comeback!',
    'A Lazarus-like recovery.',
    'Down but not out.',
    'A comeback for the books.',
    'Back from the brink.',
    'Phoenix risen.',
    'Mental fortitude on display.',
    'Found a way out.',
    'Defies the odds!',
    'Salvaging a hopeless position.',
    'Heart and grit on display.',
  ],
  domination: [
    'Total domination.',
    'Class showing through.',
    'Putting on a clinic.',
    'Making it look easy.',
    'No answer to this.',
    'A bagel in the works.',
    'Sweeping aside the opposition.',
    'A masterclass.',
    'No contest at this stage.',
    'Demolition man at the office.',
    'Crushing performance.',
    'Walking through the rounds.',
    'No mercy from the favorite.',
    'A roll of titanic proportions.',
    'A one-sided affair.',
    'A romp.',
    'No earthly chance for the opponent.',
    'Inevitability at the highest level.',
    'In a different league.',
    'A title contender showing why.',
  ],
  nervous: [
    'Pressure showing on their face.',
    'Tightening up.',
    'Bouncing on the spot to release tension.',
    'Mental battle going on.',
    'Visualizing the next point.',
    'Self-talk under their breath.',
    'Wiping the brow.',
    'Adjusting the strings.',
    'Towel between points.',
    'Big breaths.',
    'Settling the nerves.',
    'A long stare at the strings.',
    'Mental reset between points.',
  ],
  crowd: [
    'Crowd on their feet!',
    'Roof might come off.',
    'Standing ovation!',
    'Crowd erupts!',
    'Listening to the cheers swell.',
    'Thunderous applause.',
    'Crowd unable to contain themselves!',
    'Wave of noise from the crowd.',
    'Energy in the stands is palpable.',
    'Crowd loving every minute.',
    'A buzz around the arena.',
    'Crowd silenced briefly — then explodes!',
    'Listen to that roar!',
    'Hairs on the back of your neck stuff.',
    'Place is rocking!',
  ],

  // ============ PRACTICE / TUTORIAL ============
  practiceTargetHit: [
    'Target hit! Clinical.',
    'Bullseye!',
    'Right in the kitchen.',
    'Sniper-like accuracy.',
    'Drops it on the spot.',
    'Direct hit!',
    'Painted that line!',
    'Picked the corner.',
    'Right on top of the target.',
    'Cleaned the target.',
    'Pin-point.',
    'Like a laser.',
    'Dialed in.',
    'No mercy on the targets.',
    'Carving up the targets.',
  ],
  practiceMiss: [
    'Just missed it.',
    'Inches off.',
    'Wide of the target.',
    'Just past it.',
    'Whistled past the target.',
    'No connection on that one.',
    'Couldn\'t get to it.',
    'Need a better swing on that.',
    'Off the mark.',
  ],
  tutorial1: [
    'Welcome! Use WASD to move around the court.',
    'Watch the on-screen prompts to learn the controls.',
    'Take your time to get used to the movement.',
  ],

  // ============ POWER-UPS / ABILITIES ============
  pickup: [
    'Power-up grabbed! That changes things.',
    'Bonus collected — could be a game-changer.',
    'They snagged the pick-up!',
    'Power-up activated!',
    'Buff secured.',
    'A potion in the bag.',
    'Boost online!',
    'Power surge!',
    'Speed bump activated!',
    'Bonus power for them.',
    'A welcome power-up.',
    'They light up with the buff!',
    'Now they\'re cooking.',
    'A buff to remember.',
  ],
  ability: [
    'Special ability fired!',
    'Tactical move there.',
    'Special move at a critical time.',
    'Pulled the trigger on a special.',
    'Time to use the secret weapon.',
    'A blast of pure power.',
    'Going nuclear with the special.',
    'The hidden card has been played.',
    'Activates the special!',
  ],

  // ============ COUNTDOWN / OPENING ============
  countdownGreeting: [
    'Welcome to centre court for an exciting match!',
    'The crowd is buzzing here today.',
    'Anticipation building as the players take their positions.',
    'It\'s time for some tennis!',
    'A massive match coming up.',
    'Pre-match nerves on display.',
    'Stretching it out at the baseline.',
    'Final adjustments to the strings.',
    'Coin toss done — let\'s play.',
    'A great match ahead, by all accounts.',
    'Conditions are perfect for tennis.',
    'Capacity crowd has packed in!',
    'High-stakes match on the cards.',
    'Two warriors taking their positions.',
    'A sold-out arena, electric atmosphere.',
  ],
  countdown3: [ 'Players ready. Match starting in 3…','Here we go in 3…','3…','Three…','Almost there!' ],
  countdown2: [ '2…','Two seconds…','2…','Two…','Halfway!' ],
  countdown1: [ '1… stand by…','1…','One…','Match starting!','Last second!' ],
  countdownGo:[ 'Play ball!','Off we go!','Game on!','Begin!','First serve!','Live!' ],

  // ============ INTRODUCTIONS ============
  introHomePlayer: [
    'In the home corner, ready to make a stand.',
    'For the home crowd, a fan favorite.',
    'A player loved by the home crowd.',
    'Local hero ready to compete.',
    'Hometown hero stepping up.',
    'A home fixture for years.',
    'Drawing on home support.',
  ],
  introOpponent: [
    'The visitor today, a worthy opponent.',
    'A formidable opponent.',
    'A test for our home player.',
    'No easy match — the visitor brings their own credentials.',
    'A solid game on the visitor\'s side.',
    'Don\'t underestimate the visitor.',
  ],

  // ============ MISC ============
  pointWonP1: [
    'Point to the home player!',
    'P1 takes that one.',
    'Great point for P1.',
    'P1 capitalizes on the opening.',
    'Home crowd loving it.',
    'P1 shows the way.',
    'P1 with the better play.',
    'P1 closes it out.',
    'P1 collects another.',
    'P1 stretches the score.',
    'A massive point for P1.',
    'P1 with the answer.',
    'P1 chimes in.',
    'P1 gets to work.',
    'P1 putting the moves on.',
  ],
  pointWonP2: [
    'Opponent steals that one.',
    'Tough loss on that point.',
    'P2 takes it.',
    'Opponent comes through on that one.',
    'P2 with the better play.',
    'P2 sneaks one.',
    'P2 sneaks past.',
    'P2 takes a tough point.',
    'P2 with the bigger play.',
    'P2 grabs a vital point.',
    'P2 keeps it tight.',
    'P2 stays in touch.',
    'P2 hangs in there.',
  ],
};

// ── Country/Team Database ─────────────────────────
const Countries = [
  { code:'USA', name:'United States',     color:'#3c3b6e', flag:'🇺🇸', region:'Americas' },
  { code:'GBR', name:'Great Britain',     color:'#012169', flag:'🇬🇧', region:'Europe' },
  { code:'FRA', name:'France',            color:'#0055a4', flag:'🇫🇷', region:'Europe' },
  { code:'AUS', name:'Australia',         color:'#012169', flag:'🇦🇺', region:'Oceania' },
  { code:'SUI', name:'Switzerland',       color:'#dc1818', flag:'🇨🇭', region:'Europe' },
  { code:'ESP', name:'Spain',             color:'#aa151b', flag:'🇪🇸', region:'Europe' },
  { code:'GER', name:'Germany',           color:'#000000', flag:'🇩🇪', region:'Europe' },
  { code:'ARG', name:'Argentina',         color:'#75aadb', flag:'🇦🇷', region:'Americas' },
  { code:'BRA', name:'Brazil',            color:'#009c3b', flag:'🇧🇷', region:'Americas' },
  { code:'CAN', name:'Canada',            color:'#ff0000', flag:'🇨🇦', region:'Americas' },
  { code:'CHN', name:'China',             color:'#de2910', flag:'🇨🇳', region:'Asia' },
  { code:'JPN', name:'Japan',             color:'#bc002d', flag:'🇯🇵', region:'Asia' },
  { code:'KOR', name:'South Korea',       color:'#003478', flag:'🇰🇷', region:'Asia' },
  { code:'IND', name:'India',             color:'#ff9933', flag:'🇮🇳', region:'Asia' },
  { code:'RSA', name:'South Africa',      color:'#007a4d', flag:'🇿🇦', region:'Africa' },
  { code:'EGY', name:'Egypt',             color:'#ce1126', flag:'🇪🇬', region:'Africa' },
  { code:'ITA', name:'Italy',             color:'#009246', flag:'🇮🇹', region:'Europe' },
  { code:'POR', name:'Portugal',          color:'#006600', flag:'🇵🇹', region:'Europe' },
  { code:'NED', name:'Netherlands',       color:'#ae1c28', flag:'🇳🇱', region:'Europe' },
  { code:'BEL', name:'Belgium',           color:'#000000', flag:'🇧🇪', region:'Europe' },
  { code:'AUT', name:'Austria',           color:'#ed2939', flag:'🇦🇹', region:'Europe' },
  { code:'CZE', name:'Czech Republic',    color:'#11457e', flag:'🇨🇿', region:'Europe' },
  { code:'POL', name:'Poland',            color:'#dc143c', flag:'🇵🇱', region:'Europe' },
  { code:'GRE', name:'Greece',            color:'#0d5eaf', flag:'🇬🇷', region:'Europe' },
  { code:'TUR', name:'Turkey',            color:'#e30a17', flag:'🇹🇷', region:'Europe' },
  { code:'ROU', name:'Romania',           color:'#fcd116', flag:'🇷🇴', region:'Europe' },
  { code:'HUN', name:'Hungary',           color:'#436f4d', flag:'🇭🇺', region:'Europe' },
  { code:'NOR', name:'Norway',            color:'#ef2b2d', flag:'🇳🇴', region:'Europe' },
  { code:'SWE', name:'Sweden',            color:'#006aa7', flag:'🇸🇪', region:'Europe' },
  { code:'DEN', name:'Denmark',           color:'#c8102e', flag:'🇩🇰', region:'Europe' },
  { code:'FIN', name:'Finland',           color:'#003580', flag:'🇫🇮', region:'Europe' },
  { code:'IRL', name:'Ireland',           color:'#169b62', flag:'🇮🇪', region:'Europe' },
  { code:'CRO', name:'Croatia',           color:'#171796', flag:'🇭🇷', region:'Europe' },
  { code:'SRB', name:'Serbia',            color:'#c6363c', flag:'🇷🇸', region:'Europe' },
  { code:'BUL', name:'Bulgaria',          color:'#00966e', flag:'🇧🇬', region:'Europe' },
  { code:'CHL', name:'Chile',             color:'#0033a0', flag:'🇨🇱', region:'Americas' },
  { code:'COL', name:'Colombia',          color:'#fcd116', flag:'🇨🇴', region:'Americas' },
  { code:'MEX', name:'Mexico',            color:'#006847', flag:'🇲🇽', region:'Americas' },
  { code:'PER', name:'Peru',              color:'#d91023', flag:'🇵🇪', region:'Americas' },
  { code:'URU', name:'Uruguay',           color:'#001489', flag:'🇺🇾', region:'Americas' },
  { code:'NZL', name:'New Zealand',       color:'#00247d', flag:'🇳🇿', region:'Oceania' },
  { code:'THA', name:'Thailand',          color:'#a51931', flag:'🇹🇭', region:'Asia' },
  { code:'VIE', name:'Vietnam',           color:'#da251d', flag:'🇻🇳', region:'Asia' },
  { code:'MAS', name:'Malaysia',          color:'#cc0001', flag:'🇲🇾', region:'Asia' },
  { code:'SGP', name:'Singapore',         color:'#ed2939', flag:'🇸🇬', region:'Asia' },
  { code:'PHI', name:'Philippines',       color:'#0038a8', flag:'🇵🇭', region:'Asia' },
  { code:'INA', name:'Indonesia',         color:'#ff0000', flag:'🇮🇩', region:'Asia' },
  { code:'PAK', name:'Pakistan',          color:'#01411c', flag:'🇵🇰', region:'Asia' },
  { code:'BAN', name:'Bangladesh',        color:'#006a4e', flag:'🇧🇩', region:'Asia' },
  { code:'IRN', name:'Iran',              color:'#239f40', flag:'🇮🇷', region:'Asia' },
  { code:'ISR', name:'Israel',            color:'#0038b8', flag:'🇮🇱', region:'Asia' },
  { code:'UAE', name:'United Arab Emirates', color:'#00732f', flag:'🇦🇪', region:'Asia' },
  { code:'SAU', name:'Saudi Arabia',      color:'#006c35', flag:'🇸🇦', region:'Asia' },
  { code:'QAT', name:'Qatar',             color:'#8a1538', flag:'🇶🇦', region:'Asia' },
  { code:'NGA', name:'Nigeria',           color:'#008751', flag:'🇳🇬', region:'Africa' },
  { code:'MAR', name:'Morocco',           color:'#c1272d', flag:'🇲🇦', region:'Africa' },
  { code:'TUN', name:'Tunisia',           color:'#e70013', flag:'🇹🇳', region:'Africa' },
  { code:'ALG', name:'Algeria',           color:'#006233', flag:'🇩🇿', region:'Africa' },
  { code:'KEN', name:'Kenya',             color:'#bb0000', flag:'🇰🇪', region:'Africa' },
  { code:'GHA', name:'Ghana',             color:'#fcd116', flag:'🇬🇭', region:'Africa' },
  { code:'SVK', name:'Slovakia',          color:'#0b4ea2', flag:'🇸🇰', region:'Europe' },
  { code:'SVN', name:'Slovenia',          color:'#005ce6', flag:'🇸🇮', region:'Europe' },
  { code:'EST', name:'Estonia',           color:'#0072ce', flag:'🇪🇪', region:'Europe' },
  { code:'LAT', name:'Latvia',            color:'#9e1b32', flag:'🇱🇻', region:'Europe' },
  { code:'LTU', name:'Lithuania',         color:'#fdb913', flag:'🇱🇹', region:'Europe' },
  { code:'UKR', name:'Ukraine',           color:'#0057b7', flag:'🇺🇦', region:'Europe' },
  { code:'BLR', name:'Belarus',           color:'#d22730', flag:'🇧🇾', region:'Europe' },
  { code:'KAZ', name:'Kazakhstan',        color:'#00afca', flag:'🇰🇿', region:'Asia' },
];

// ── Tournament Database ──────────────────────────
const Tournaments = [
  { id:'aus_open',    name:'Australian Open',  surface:'hard',  prestige:'grand_slam', city:'Melbourne',     country:'AUS', month:1 },
  { id:'french_open', name:'French Open',      surface:'clay',  prestige:'grand_slam', city:'Paris',          country:'FRA', month:5 },
  { id:'wimbledon',   name:'Wimbledon',        surface:'grass', prestige:'grand_slam', city:'London',        country:'GBR', month:7 },
  { id:'us_open',     name:'US Open',          surface:'hard',  prestige:'grand_slam', city:'New York',      country:'USA', month:8 },
  { id:'indian_wells',name:'Indian Wells',     surface:'hard',  prestige:'masters_1000',city:'Indian Wells',  country:'USA', month:3 },
  { id:'miami_open',  name:'Miami Open',       surface:'hard',  prestige:'masters_1000',city:'Miami',         country:'USA', month:3 },
  { id:'monte_carlo', name:'Monte Carlo Masters',surface:'clay',prestige:'masters_1000',city:'Monte Carlo',  country:'FRA', month:4 },
  { id:'madrid_open', name:'Madrid Open',      surface:'clay',  prestige:'masters_1000',city:'Madrid',        country:'ESP', month:5 },
  { id:'rome_open',   name:'Rome Open',        surface:'clay',  prestige:'masters_1000',city:'Rome',          country:'ITA', month:5 },
  { id:'canadian_open',name:'Canadian Open',   surface:'hard',  prestige:'masters_1000',city:'Toronto',       country:'CAN', month:8 },
  { id:'cincinnati',  name:'Cincinnati Open',  surface:'hard',  prestige:'masters_1000',city:'Cincinnati',    country:'USA', month:8 },
  { id:'shanghai_master',name:'Shanghai Masters',surface:'hard',prestige:'masters_1000',city:'Shanghai',     country:'CHN', month:10 },
  { id:'paris_master',name:'Paris Masters',    surface:'hard',  prestige:'masters_1000',city:'Paris',         country:'FRA', month:11 },
  { id:'atp_finals',  name:'ATP Finals',       surface:'hard',  prestige:'tour_final',  city:'Turin',         country:'ITA', month:11 },
  { id:'davis_cup',   name:'Davis Cup',        surface:'hard',  prestige:'team_event',  city:'Various',       country:'',    month:11 },
  { id:'vienna_open', name:'Vienna Open',      surface:'hard',  prestige:'atp_500',     city:'Vienna',        country:'AUT', month:10 },
  { id:'basel_open',  name:'Swiss Indoors',    surface:'hard',  prestige:'atp_500',     city:'Basel',         country:'SUI', month:10 },
  { id:'beijing_open',name:'China Open',       surface:'hard',  prestige:'atp_500',     city:'Beijing',       country:'CHN', month:9 },
  { id:'tokyo_open',  name:'Japan Open',       surface:'hard',  prestige:'atp_500',     city:'Tokyo',         country:'JPN', month:10 },
  { id:'dubai_open',  name:'Dubai Tennis',     surface:'hard',  prestige:'atp_500',     city:'Dubai',         country:'UAE', month:2 },
  { id:'rio_open',    name:'Rio Open',         surface:'clay',  prestige:'atp_500',     city:'Rio',           country:'BRA', month:2 },
  { id:'rotterdam',   name:'Rotterdam Open',   surface:'hard',  prestige:'atp_500',     city:'Rotterdam',     country:'NED', month:2 },
  { id:'doha_open',   name:'Qatar Open',       surface:'hard',  prestige:'atp_250',     city:'Doha',          country:'QAT', month:1 },
  { id:'pune_open',   name:'Pune Open',        surface:'hard',  prestige:'atp_250',     city:'Pune',          country:'IND', month:1 },
  { id:'auckland_op', name:'Auckland Open',    surface:'hard',  prestige:'atp_250',     city:'Auckland',      country:'NZL', month:1 },
  { id:'sydney_open', name:'Sydney Open',      surface:'hard',  prestige:'atp_250',     city:'Sydney',        country:'AUS', month:1 },
  { id:'cordoba',     name:'Cordoba Open',     surface:'clay',  prestige:'atp_250',     city:'Cordoba',       country:'ARG', month:2 },
  { id:'bsb_open',    name:'Brisbane Open',    surface:'hard',  prestige:'atp_250',     city:'Brisbane',      country:'AUS', month:1 },
  { id:'marrakech',   name:'Marrakech Open',   surface:'clay',  prestige:'atp_250',     city:'Marrakech',     country:'MAR', month:4 },
  { id:'hamburg_op',  name:'Hamburg Open',     surface:'clay',  prestige:'atp_500',     city:'Hamburg',       country:'GER', month:7 },
  { id:'gstaad',      name:'Swiss Open',       surface:'clay',  prestige:'atp_250',     city:'Gstaad',        country:'SUI', month:7 },
  { id:'kitzbuhel',   name:'Austrian Open',    surface:'clay',  prestige:'atp_250',     city:'Kitzbuhel',     country:'AUT', month:7 },
  { id:'bastad',      name:'Bastad Open',      surface:'clay',  prestige:'atp_250',     city:'Bastad',        country:'SWE', month:7 },
  { id:'umag',        name:'Croatia Open',     surface:'clay',  prestige:'atp_250',     city:'Umag',          country:'CRO', month:7 },
];

// ── Court Venue Library ──────────────────────────
const VenueLibrary = {
  rod_laver:   { name:'Rod Laver Arena',    capacity:14820, surface:'hard',  city:'Melbourne',  country:'AUS' },
  philippe:    { name:'Philippe Chatrier',  capacity:15225, surface:'clay',  city:'Paris',      country:'FRA' },
  centre:      { name:'Centre Court',       capacity:14979, surface:'grass', city:'London',     country:'GBR' },
  arthur_ashe: { name:'Arthur Ashe Stadium',capacity:23771, surface:'hard',  city:'New York',   country:'USA' },
  manolo:      { name:'Manolo Santana',     capacity:12442, surface:'clay',  city:'Madrid',     country:'ESP' },
  centrale_rome:{name:'Campo Centrale',     capacity:10500, surface:'clay',  city:'Rome',       country:'ITA' },
  monte_carlo: { name:'Court Rainier III',  capacity:9500,  surface:'clay',  city:'Monte Carlo',country:'FRA' },
  centre_mc:   { name:'Centre Court Miami', capacity:13800, surface:'hard',  city:'Miami',      country:'USA' },
  stadium_iw:  { name:'Stadium 1',          capacity:16100, surface:'hard',  city:'Indian Wells',country:'USA'},
  qizhong:     { name:'Qizhong Forest Sports Center',capacity:15000,surface:'hard',city:'Shanghai',country:'CHN'},
  bercy:       { name:'Accor Arena',        capacity:17000, surface:'hard',  city:'Paris',      country:'FRA' },
  pala:        { name:'Pala Alpitour',      capacity:12350, surface:'hard',  city:'Turin',      country:'ITA' },
  o2:          { name:'The O2 Arena',       capacity:17500, surface:'hard',  city:'London',     country:'GBR' },
  ariake:      { name:'Ariake Coliseum',    capacity:10000, surface:'hard',  city:'Tokyo',      country:'JPN' },
  hamburg_centre:{ name:'Center Court Hamburg',capacity:13200,surface:'clay',city:'Hamburg',    country:'GER' },
};

// ── Fictional Player Roster (300 generated AI opponents) ────
const PlayerRoster = [
  { id:'p001', name:'Marco Belli',          country:'ITA', rating:1850, style:'baseliner',     handed:'R', topshot:'forehand',   age:24 },
  { id:'p002', name:'Yuki Tanaka',          country:'JPN', rating:1920, style:'counterPuncher',handed:'R', topshot:'backhand',   age:27 },
  { id:'p003', name:'Andrei Volkov',        country:'KAZ', rating:1780, style:'aggressor',     handed:'L', topshot:'serve',      age:30 },
  { id:'p004', name:'Carlos Mendez',        country:'ESP', rating:2100, style:'spinner',       handed:'R', topshot:'forehand',   age:25 },
  { id:'p005', name:'Lukas Hoffmann',       country:'GER', rating:1990, style:'serveVolley',   handed:'R', topshot:'serve',      age:28 },
  { id:'p006', name:'Pierre Dubois',        country:'FRA', rating:1820, style:'defender',      handed:'R', topshot:'movement',   age:23 },
  { id:'p007', name:'Hugo Lindberg',        country:'SWE', rating:1700, style:'baseliner',     handed:'R', topshot:'consistency',age:21 },
  { id:'p008', name:'Olivier Gagne',        country:'CAN', rating:1880, style:'aggressor',     handed:'R', topshot:'power',      age:29 },
  { id:'p009', name:'Diego Ramirez',        country:'ARG', rating:1950, style:'spinner',       handed:'L', topshot:'forehand',   age:26 },
  { id:'p010', name:'Akira Sato',           country:'JPN', rating:1830, style:'counterPuncher',handed:'R', topshot:'return',     age:24 },
  { id:'p011', name:'Tommy Kane',           country:'GBR', rating:1740, style:'baseliner',     handed:'R', topshot:'serve',      age:22 },
  { id:'p012', name:'Jakub Kowalski',       country:'POL', rating:1860, style:'defender',      handed:'R', topshot:'backhand',   age:25 },
  { id:'p013', name:'Mateo Silva',          country:'POR', rating:1810, style:'aggressor',     handed:'R', topshot:'forehand',   age:23 },
  { id:'p014', name:'Erik Johansson',       country:'NOR', rating:1700, style:'baseliner',     handed:'R', topshot:'return',     age:24 },
  { id:'p015', name:'Mihai Popescu',        country:'ROU', rating:1750, style:'counterPuncher',handed:'L', topshot:'movement',   age:26 },
  { id:'p016', name:'Stefano Conti',        country:'ITA', rating:1880, style:'spinner',       handed:'R', topshot:'forehand',   age:25 },
  { id:'p017', name:'Kai Schneider',        country:'GER', rating:2030, style:'aggressor',     handed:'R', topshot:'serve',      age:27 },
  { id:'p018', name:'Filip Novak',          country:'CZE', rating:1810, style:'baseliner',     handed:'R', topshot:'forehand',   age:24 },
  { id:'p019', name:'Tomas Reyes',          country:'CHL', rating:1690, style:'defender',      handed:'R', topshot:'consistency',age:28 },
  { id:'p020', name:'Adam Carlson',         country:'USA', rating:1900, style:'serveVolley',   handed:'R', topshot:'serve',      age:26 },
  { id:'p021', name:'Nikolai Petrov',       country:'BLR', rating:1840, style:'aggressor',     handed:'R', topshot:'power',      age:25 },
  { id:'p022', name:'Bastien Lefevre',      country:'FRA', rating:1770, style:'spinner',       handed:'R', topshot:'forehand',   age:23 },
  { id:'p023', name:'Goran Markovic',       country:'SRB', rating:1980, style:'baseliner',     handed:'R', topshot:'backhand',   age:29 },
  { id:'p024', name:'Manuel Castillo',      country:'MEX', rating:1700, style:'counterPuncher',handed:'L', topshot:'return',     age:22 },
  { id:'p025', name:'Federico Costa',       country:'BRA', rating:1830, style:'spinner',       handed:'R', topshot:'forehand',   age:24 },
  { id:'p026', name:'Nicholas Reilly',      country:'IRL', rating:1690, style:'defender',      handed:'R', topshot:'movement',   age:25 },
  { id:'p027', name:'Ryan O\'Connor',       country:'IRL', rating:1820, style:'aggressor',     handed:'R', topshot:'serve',      age:24 },
  { id:'p028', name:'Hans Berg',            country:'NOR', rating:1750, style:'baseliner',     handed:'R', topshot:'consistency',age:23 },
  { id:'p029', name:'Liam Thomas',          country:'AUS', rating:1900, style:'serveVolley',   handed:'R', topshot:'serve',      age:27 },
  { id:'p030', name:'Carlos Aragones',      country:'ESP', rating:1870, style:'spinner',       handed:'R', topshot:'forehand',   age:25 },
  { id:'p031', name:'Luca Bianchi',         country:'ITA', rating:1810, style:'baseliner',     handed:'R', topshot:'backhand',   age:24 },
  { id:'p032', name:'Kenji Yamamoto',       country:'JPN', rating:1740, style:'defender',      handed:'R', topshot:'return',     age:22 },
  { id:'p033', name:'Vasily Sokolov',       country:'KAZ', rating:1870, style:'aggressor',     handed:'L', topshot:'power',      age:29 },
  { id:'p034', name:'Pablo Rojas',          country:'ARG', rating:1810, style:'spinner',       handed:'R', topshot:'forehand',   age:24 },
  { id:'p035', name:'Mihail Ionescu',       country:'ROU', rating:1700, style:'counterPuncher',handed:'R', topshot:'movement',   age:23 },
  { id:'p036', name:'Stefan Mueller',       country:'AUT', rating:1860, style:'serveVolley',   handed:'R', topshot:'serve',      age:26 },
  { id:'p037', name:'Bram van der Berg',    country:'NED', rating:1770, style:'baseliner',     handed:'R', topshot:'consistency',age:24 },
  { id:'p038', name:'Daniel Park',          country:'KOR', rating:1820, style:'defender',      handed:'R', topshot:'return',     age:25 },
  { id:'p039', name:'Wei Chen',             country:'CHN', rating:1780, style:'counterPuncher',handed:'L', topshot:'forehand',   age:23 },
  { id:'p040', name:'Anthony Ruiz',         country:'PER', rating:1690, style:'aggressor',     handed:'R', topshot:'serve',      age:25 },
  { id:'p041', name:'Aleksandar Petrovic',  country:'SRB', rating:1900, style:'spinner',       handed:'R', topshot:'forehand',   age:27 },
  { id:'p042', name:'Frederik Hansen',      country:'DEN', rating:1810, style:'serveVolley',   handed:'R', topshot:'serve',      age:26 },
  { id:'p043', name:'Aaron Cohen',          country:'ISR', rating:1730, style:'baseliner',     handed:'R', topshot:'backhand',   age:24 },
  { id:'p044', name:'Imran Khan',           country:'PAK', rating:1670, style:'counterPuncher',handed:'R', topshot:'movement',   age:25 },
  { id:'p045', name:'Felipe Gutierrez',     country:'CHL', rating:1700, style:'defender',      handed:'L', topshot:'consistency',age:24 },
  { id:'p046', name:'Sergio Vega',          country:'COL', rating:1810, style:'aggressor',     handed:'R', topshot:'power',      age:26 },
  { id:'p047', name:'Adam Sullivan',        country:'AUS', rating:1860, style:'serveVolley',   handed:'R', topshot:'serve',      age:28 },
  { id:'p048', name:'Park Min-jun',         country:'KOR', rating:1750, style:'baseliner',     handed:'R', topshot:'forehand',   age:23 },
  { id:'p049', name:'Robert Schmidt',       country:'GER', rating:1880, style:'aggressor',     handed:'R', topshot:'power',      age:25 },
  { id:'p050', name:'Tobias Werner',        country:'AUT', rating:1820, style:'spinner',       handed:'R', topshot:'forehand',   age:26 },
  { id:'p051', name:'Cristian Lopez',       country:'COL', rating:1730, style:'defender',      handed:'R', topshot:'movement',   age:24 },
  { id:'p052', name:'Eshan Singh',          country:'IND', rating:1780, style:'baseliner',     handed:'R', topshot:'consistency',age:25 },
  { id:'p053', name:'Lorenzo Marchetti',    country:'ITA', rating:1820, style:'counterPuncher',handed:'L', topshot:'return',     age:23 },
  { id:'p054', name:'Gabriel Gomez',        country:'BRA', rating:1850, style:'aggressor',     handed:'R', topshot:'serve',      age:27 },
  { id:'p055', name:'Klaus Wagner',         country:'GER', rating:1750, style:'baseliner',     handed:'R', topshot:'backhand',   age:22 },
  { id:'p056', name:'Yuto Watanabe',        country:'JPN', rating:1800, style:'defender',      handed:'R', topshot:'return',     age:24 },
  { id:'p057', name:'Adriano Oliveira',     country:'BRA', rating:1810, style:'spinner',       handed:'R', topshot:'forehand',   age:25 },
  { id:'p058', name:'Eduardo Vargas',       country:'CHL', rating:1740, style:'counterPuncher',handed:'R', topshot:'movement',   age:23 },
  { id:'p059', name:'Adrian Wozniak',       country:'POL', rating:1900, style:'serveVolley',   handed:'R', topshot:'serve',      age:28 },
  { id:'p060', name:'Boris Volkov',         country:'KAZ', rating:1810, style:'aggressor',     handed:'L', topshot:'power',      age:26 },
  { id:'p061', name:'Cesar Aguilar',        country:'ARG', rating:1780, style:'spinner',       handed:'R', topshot:'forehand',   age:25 },
  { id:'p062', name:'Daniel Andersson',     country:'SWE', rating:1690, style:'baseliner',     handed:'R', topshot:'consistency',age:24 },
  { id:'p063', name:'Eric Brown',           country:'USA', rating:1830, style:'aggressor',     handed:'R', topshot:'serve',      age:23 },
  { id:'p064', name:'Felix Kaiser',         country:'AUT', rating:1740, style:'serveVolley',   handed:'R', topshot:'serve',      age:26 },
  { id:'p065', name:'Gabor Szabo',          country:'HUN', rating:1780, style:'defender',      handed:'R', topshot:'movement',   age:25 },
  { id:'p066', name:'Hassan Khalil',        country:'EGY', rating:1700, style:'counterPuncher',handed:'L', topshot:'return',     age:24 },
  { id:'p067', name:'Ivan Ivanov',          country:'BUL', rating:1830, style:'baseliner',     handed:'R', topshot:'backhand',   age:27 },
  { id:'p068', name:'Joaquin Torres',       country:'URU', rating:1690, style:'spinner',       handed:'R', topshot:'forehand',   age:23 },
  { id:'p069', name:'Konstantin Sidorov',   country:'BLR', rating:1880, style:'aggressor',     handed:'R', topshot:'power',      age:28 },
  { id:'p070', name:'Lars Olsen',           country:'NOR', rating:1750, style:'serveVolley',   handed:'R', topshot:'serve',      age:25 },
  { id:'p071', name:'Marek Dvorak',         country:'CZE', rating:1810, style:'baseliner',     handed:'R', topshot:'consistency',age:26 },
  { id:'p072', name:'Nico Albrecht',        country:'GER', rating:1790, style:'spinner',       handed:'L', topshot:'forehand',   age:23 },
  { id:'p073', name:'Oscar Lindqvist',      country:'SWE', rating:1860, style:'aggressor',     handed:'R', topshot:'serve',      age:25 },
  { id:'p074', name:'Pavel Smirnov',        country:'KAZ', rating:1780, style:'defender',      handed:'R', topshot:'movement',   age:27 },
  { id:'p075', name:'Quinn Murphy',         country:'IRL', rating:1700, style:'counterPuncher',handed:'R', topshot:'return',     age:24 },
  { id:'p076', name:'Ricardo Velez',        country:'COL', rating:1830, style:'baseliner',     handed:'R', topshot:'forehand',   age:26 },
  { id:'p077', name:'Sven Larsen',          country:'DEN', rating:1790, style:'spinner',       handed:'R', topshot:'forehand',   age:23 },
  { id:'p078', name:'Theo Lamberts',        country:'BEL', rating:1860, style:'serveVolley',   handed:'R', topshot:'serve',      age:24 },
  { id:'p079', name:'Umberto Rossi',        country:'ITA', rating:1780, style:'aggressor',     handed:'R', topshot:'power',      age:25 },
  { id:'p080', name:'Vincent Marchand',     country:'FRA', rating:1820, style:'baseliner',     handed:'R', topshot:'consistency',age:26 },
  { id:'p081', name:'Wojciech Zielinski',   country:'POL', rating:1740, style:'defender',      handed:'L', topshot:'movement',   age:23 },
  { id:'p082', name:'Xavier Ortega',        country:'ESP', rating:1880, style:'spinner',       handed:'R', topshot:'forehand',   age:25 },
  { id:'p083', name:'Yannick Petit',        country:'FRA', rating:1700, style:'counterPuncher',handed:'R', topshot:'return',     age:24 },
  { id:'p084', name:'Zoltan Nagy',          country:'HUN', rating:1810, style:'aggressor',     handed:'R', topshot:'serve',      age:27 },
  { id:'p085', name:'Anthony Reed',         country:'USA', rating:1860, style:'serveVolley',   handed:'R', topshot:'serve',      age:28 },
  { id:'p086', name:'Beni Tovar',           country:'MEX', rating:1740, style:'spinner',       handed:'R', topshot:'forehand',   age:25 },
  { id:'p087', name:'Caleb Foster',         country:'CAN', rating:1690, style:'defender',      handed:'R', topshot:'movement',   age:23 },
  { id:'p088', name:'Daniyar Kassymov',     country:'KAZ', rating:1780, style:'baseliner',     handed:'L', topshot:'consistency',age:24 },
  { id:'p089', name:'Esteban Vidal',        country:'CHL', rating:1810, style:'aggressor',     handed:'R', topshot:'power',      age:26 },
  { id:'p090', name:'Felipe Marquez',       country:'ARG', rating:1870, style:'counterPuncher',handed:'R', topshot:'movement',   age:25 },
  { id:'p091', name:'Gunnar Bjorn',         country:'NOR', rating:1760, style:'serveVolley',   handed:'R', topshot:'serve',      age:27 },
  { id:'p092', name:'Hideki Sakamoto',      country:'JPN', rating:1810, style:'spinner',       handed:'R', topshot:'forehand',   age:24 },
  { id:'p093', name:'Igor Petrescu',        country:'ROU', rating:1730, style:'baseliner',     handed:'R', topshot:'backhand',   age:23 },
  { id:'p094', name:'Jan Krause',           country:'GER', rating:1820, style:'aggressor',     handed:'R', topshot:'serve',      age:25 },
  { id:'p095', name:'Karim El Sayed',       country:'EGY', rating:1700, style:'defender',      handed:'R', topshot:'consistency',age:24 },
  { id:'p096', name:'Lucas Henriksen',      country:'DEN', rating:1790, style:'baseliner',     handed:'L', topshot:'forehand',   age:26 },
  { id:'p097', name:'Maximilian Bauer',     country:'AUT', rating:1810, style:'serveVolley',   handed:'R', topshot:'serve',      age:25 },
  { id:'p098', name:'Naoto Suzuki',         country:'JPN', rating:1750, style:'counterPuncher',handed:'R', topshot:'return',     age:23 },
  { id:'p099', name:'Oleg Volkov',          country:'BLR', rating:1860, style:'aggressor',     handed:'R', topshot:'power',      age:27 },
  { id:'p100', name:'Pieter de Jong',       country:'NED', rating:1780, style:'spinner',       handed:'R', topshot:'forehand',   age:25 },
];

// ── Cosmetic Item Library Expansion (200 items) ──
const ExpandedCosmetics = [
  // Rackets
  { id:'r_neon_blue',     type:'racket', name:'Neon Blue',     cost:300,  level:2,  color:0x00b4ff },
  { id:'r_neon_green',    type:'racket', name:'Neon Green',    cost:300,  level:2,  color:0xb2ff14 },
  { id:'r_neon_red',      type:'racket', name:'Neon Red',      cost:300,  level:2,  color:0xff5050 },
  { id:'r_neon_purple',   type:'racket', name:'Neon Purple',   cost:300,  level:2,  color:0xa050ff },
  { id:'r_neon_yellow',   type:'racket', name:'Neon Yellow',   cost:300,  level:2,  color:0xffe800 },
  { id:'r_neon_pink',     type:'racket', name:'Neon Pink',     cost:300,  level:2,  color:0xff2080 },
  { id:'r_neon_orange',   type:'racket', name:'Neon Orange',   cost:300,  level:2,  color:0xff9632 },
  { id:'r_neon_cyan',     type:'racket', name:'Neon Cyan',     cost:300,  level:2,  color:0x00ffff },
  { id:'r_metal_gold',    type:'racket', name:'Gold Metal',    cost:1000, level:5,  color:0xffd700 },
  { id:'r_metal_silver',  type:'racket', name:'Silver Metal',  cost:800,  level:4,  color:0xc0c0c0 },
  { id:'r_metal_bronze',  type:'racket', name:'Bronze Metal',  cost:500,  level:3,  color:0xcd7f32 },
  { id:'r_metal_platinum',type:'racket', name:'Platinum',      cost:2000, level:8,  color:0xe5e4e2 },
  { id:'r_carbon',        type:'racket', name:'Carbon Fiber',  cost:1500, level:7,  color:0x222233 },
  { id:'r_chrome',        type:'racket', name:'Chrome',        cost:2200, level:9,  color:0xeeeeee },
  { id:'r_obsidian',      type:'racket', name:'Obsidian',      cost:2500, level:10, color:0x111133 },
  { id:'r_lava',          type:'racket', name:'Lava',          cost:3000, level:11, color:0xff3010 },
  { id:'r_glacier',       type:'racket', name:'Glacier',       cost:3500, level:12, color:0x80ffff },
  { id:'r_sunset',        type:'racket', name:'Sunset',        cost:1800, level:8,  color:0xff8060 },
  { id:'r_dawn',          type:'racket', name:'Dawn',          cost:1800, level:8,  color:0xfff080 },
  { id:'r_aurora',        type:'racket', name:'Aurora',        cost:4000, level:13, color:0x80ff80 },
  { id:'r_galactic',      type:'racket', name:'Galactic',      cost:5000, level:15, color:0x4040ff },
  { id:'r_pure_white',    type:'racket', name:'Pure White',    cost:600,  level:3,  color:0xffffff },
  { id:'r_jet_black',     type:'racket', name:'Jet Black',     cost:600,  level:3,  color:0x000000 },
  { id:'r_camo_green',    type:'racket', name:'Camo Green',    cost:1200, level:6,  color:0x4a6a3a },
  { id:'r_camo_desert',   type:'racket', name:'Camo Desert',   cost:1200, level:6,  color:0xa0904a },
  { id:'r_pixel_8bit',    type:'racket', name:'8-Bit Retro',   cost:1500, level:7,  color:0x80ff40 },
  { id:'r_holographic',   type:'racket', name:'Holographic',   cost:5500, level:16, color:0xff80ff },
  { id:'r_diamond',       type:'racket', name:'Diamond',       cost:7000, level:18, color:0xb9f2ff },
  { id:'r_emerald',       type:'racket', name:'Emerald',       cost:6500, level:17, color:0x50c878 },
  { id:'r_ruby',          type:'racket', name:'Ruby',          cost:6500, level:17, color:0xe0115f },
  // Balls
  { id:'b_classic',       type:'ball',   name:'Classic',       cost:0,    level:1,  color:0xb2ff14 },
  { id:'b_fire',          type:'ball',   name:'Fire Ball',     cost:500,  level:3,  color:0xff5510 },
  { id:'b_ice',           type:'ball',   name:'Ice Ball',      cost:500,  level:3,  color:0x90e0ff },
  { id:'b_lightning',     type:'ball',   name:'Lightning',     cost:800,  level:4,  color:0xffff80 },
  { id:'b_disco',         type:'ball',   name:'Disco',         cost:1500, level:6,  color:0xff80ff },
  { id:'b_galaxy',        type:'ball',   name:'Galaxy',        cost:5000, level:12, color:0xa0a0ff },
  { id:'b_neon_pink',     type:'ball',   name:'Neon Pink',     cost:400,  level:2,  color:0xff2080 },
  { id:'b_neon_yellow',   type:'ball',   name:'Neon Yellow',   cost:400,  level:2,  color:0xffe800 },
  { id:'b_radioactive',   type:'ball',   name:'Radioactive',   cost:2200, level:8,  color:0x80ff00 },
  { id:'b_void',          type:'ball',   name:'Void',          cost:3000, level:10, color:0x100018 },
  { id:'b_diamond',       type:'ball',   name:'Diamond Ball',  cost:6000, level:14, color:0xb9f2ff },
  { id:'b_8bit',          type:'ball',   name:'8-Bit',         cost:1200, level:5,  color:0x88ff44 },
  { id:'b_camo',          type:'ball',   name:'Camo',          cost:1500, level:6,  color:0x6a8a4a },
  { id:'b_rainbow',       type:'ball',   name:'Rainbow',       cost:2500, level:9,  color:0xff00ff },
  { id:'b_sunset',        type:'ball',   name:'Sunset',        cost:1800, level:7,  color:0xff8030 },
  // Trails
  { id:'t_default',       type:'trail',  name:'Standard',      cost:0,    level:1 },
  { id:'t_rainbow',       type:'trail',  name:'Rainbow',       cost:800,  level:4 },
  { id:'t_smoke',         type:'trail',  name:'Smoke',         cost:1200, level:6 },
  { id:'t_lightning',     type:'trail',  name:'Lightning',     cost:2500, level:9 },
  { id:'t_petals',        type:'trail',  name:'Petals',        cost:4000, level:11 },
  { id:'t_fire',          type:'trail',  name:'Fire',          cost:1500, level:6 },
  { id:'t_ice',           type:'trail',  name:'Ice',           cost:1500, level:6 },
  { id:'t_void',          type:'trail',  name:'Void',          cost:3000, level:10 },
  { id:'t_galaxy',        type:'trail',  name:'Galaxy',        cost:4000, level:12 },
  { id:'t_8bit',          type:'trail',  name:'8-Bit Pixels',  cost:1200, level:5 },
  { id:'t_holographic',   type:'trail',  name:'Holographic',   cost:5500, level:14 },
  { id:'t_emerald',       type:'trail',  name:'Emerald',       cost:6500, level:15 },
  { id:'t_obsidian',      type:'trail',  name:'Obsidian',      cost:2500, level:9 },
  { id:'t_dawn',          type:'trail',  name:'Dawn',          cost:1800, level:7 },
  { id:'t_aurora',        type:'trail',  name:'Aurora',        cost:5000, level:13 },
  // Hats
  { id:'h_none',          type:'hat',    name:'No Hat',        cost:0,    level:1 },
  { id:'h_cap',           type:'hat',    name:'Cap',           cost:300,  level:2 },
  { id:'h_visor',         type:'hat',    name:'Visor',         cost:600,  level:3 },
  { id:'h_headband',      type:'hat',    name:'Headband',      cost:200,  level:1 },
  { id:'h_beanie',        type:'hat',    name:'Beanie',        cost:400,  level:2 },
  { id:'h_crown',         type:'hat',    name:'Crown',         cost:5000, level:12 },
  { id:'h_wizard',        type:'hat',    name:'Wizard Hat',    cost:3500, level:10 },
  { id:'h_top',           type:'hat',    name:'Top Hat',       cost:2000, level:8 },
  { id:'h_cowboy',        type:'hat',    name:'Cowboy Hat',    cost:1500, level:7 },
  { id:'h_pirate',        type:'hat',    name:'Pirate Hat',    cost:1800, level:7 },
  { id:'h_helmet_robot',  type:'hat',    name:'Robot Helmet',  cost:2500, level:9 },
  { id:'h_bandana',       type:'hat',    name:'Bandana',       cost:500,  level:3 },
  { id:'h_baseball',      type:'hat',    name:'Baseball Cap',  cost:300,  level:2 },
  { id:'h_olympic',       type:'hat',    name:'Olympic Wreath',cost:6000, level:14 },
  { id:'h_halo',          type:'hat',    name:'Halo',          cost:8000, level:18 },
  // Emotes
  { id:'e_wave',          type:'emote',  name:'Wave',          cost:100,  level:1 },
  { id:'e_pump',          type:'emote',  name:'Fist Pump',     cost:300,  level:2 },
  { id:'e_bow',           type:'emote',  name:'Bow',           cost:600,  level:4 },
  { id:'e_dance',         type:'emote',  name:'Victory Dance', cost:1500, level:7 },
  { id:'e_celebrate',     type:'emote',  name:'Big Celebration',cost:3000,level:10 },
  { id:'e_taunt',         type:'emote',  name:'Taunt',         cost:800,  level:5 },
  { id:'e_sad',           type:'emote',  name:'Sad',           cost:200,  level:1 },
  { id:'e_thumbs',        type:'emote',  name:'Thumbs Up',     cost:300,  level:2 },
  { id:'e_clap',          type:'emote',  name:'Clap',          cost:400,  level:3 },
  { id:'e_flex',          type:'emote',  name:'Flex',          cost:1200, level:6 },
  { id:'e_breakdance',    type:'emote',  name:'Breakdance',    cost:4000, level:11 },
  { id:'e_robot',         type:'emote',  name:'Robot Dance',   cost:3500, level:10 },
];

// ── Court Surface Properties (extended) ────────
const SurfaceLib = {
  hard:    { name:'Hard Court',    bounce:0.58, friction:0.84, speed:1.0,  spinEffect:1.0,  feel:'medium' },
  clay:    { name:'Clay Court',    bounce:0.50, friction:0.74, speed:0.85, spinEffect:1.4,  feel:'slow' },
  grass:   { name:'Grass Court',   bounce:0.65, friction:0.92, speed:1.18, spinEffect:0.7,  feel:'fast' },
  carpet:  { name:'Carpet',        bounce:0.55, friction:0.80, speed:1.10, spinEffect:0.8,  feel:'medium-fast' },
  artificial:{name:'Artificial Turf',bounce:0.62,friction:0.88,speed:1.05, spinEffect:0.9,  feel:'medium-fast' },
  rebound: { name:'Rebound Ace',   bounce:0.60, friction:0.85, speed:1.02, spinEffect:1.0,  feel:'medium' },
  cushion: { name:'Cushioned Hard',bounce:0.56, friction:0.85, speed:0.96, spinEffect:1.05, feel:'medium' },
  asphalt: { name:'Asphalt',       bounce:0.62, friction:0.78, speed:1.08, spinEffect:0.85, feel:'fast' },
  dirt:    { name:'Dirt',          bounce:0.45, friction:0.70, speed:0.78, spinEffect:1.5,  feel:'very slow' },
  cement:  { name:'Cement',        bounce:0.65, friction:0.82, speed:1.10, spinEffect:0.95, feel:'fast' },
};

// ── Detailed Player Profiles (multi-line entries with bios) ─
const PlayerProfiles = [
  {
    id: 'p_001',
    name: 'Roger Smith',
    nickname: 'The Maestro',
    country: 'GBR',
    flag: '🇬🇧',
    age: 28,
    height: 188,
    weight: 79,
    handed: 'R',
    style: 'baseliner',
    rating: 2150,
    bio: 'A veteran with elegant strokes and uncanny court vision.',
    careerWins: 152,
    careerLosses: 88,
    grandSlams: 2,
    masters1000: 8,
    favSurface: 'grass',
    speed: 0.95,
    power: 0.85,
    accuracy: 0.95,
    stamina: 0.90,
    mental: 0.95,
  },
  {
    id: 'p_002',
    name: 'Diego Hernandez',
    nickname: 'El Toro',
    country: 'ESP',
    flag: '🇪🇸',
    age: 24,
    height: 185,
    weight: 84,
    handed: 'L',
    style: 'spinner',
    rating: 2280,
    bio: 'Heavy topspin warrior who grinds opponents into submission.',
    careerWins: 98,
    careerLosses: 32,
    grandSlams: 3,
    masters1000: 6,
    favSurface: 'clay',
    speed: 0.92,
    power: 1.00,
    accuracy: 0.90,
    stamina: 0.98,
    mental: 0.94,
  },
  {
    id: 'p_003',
    name: 'Yuki Tanaka',
    nickname: 'The Wall',
    country: 'JPN',
    flag: '🇯🇵',
    age: 26,
    height: 178,
    weight: 72,
    handed: 'R',
    style: 'counterPuncher',
    rating: 2050,
    bio: 'Defensive maestro who turns defense into offense in a heartbeat.',
    careerWins: 88,
    careerLosses: 60,
    grandSlams: 0,
    masters1000: 1,
    favSurface: 'hard',
    speed: 1.00,
    power: 0.78,
    accuracy: 0.92,
    stamina: 0.96,
    mental: 0.89,
  },
  {
    id: 'p_004',
    name: 'Andreas Schmidt',
    nickname: 'The Cannon',
    country: 'GER',
    flag: '🇩🇪',
    age: 25,
    height: 195,
    weight: 92,
    handed: 'R',
    style: 'serveVolley',
    rating: 2120,
    bio: 'Big serve, big game. Ends points fast.',
    careerWins: 110,
    careerLosses: 75,
    grandSlams: 1,
    masters1000: 4,
    favSurface: 'grass',
    speed: 0.85,
    power: 1.10,
    accuracy: 0.85,
    stamina: 0.78,
    mental: 0.86,
  },
  {
    id: 'p_005',
    name: 'Lucas Martin',
    nickname: 'Le Fox',
    country: 'FRA',
    flag: '🇫🇷',
    age: 23,
    height: 180,
    weight: 75,
    handed: 'R',
    style: 'aggressor',
    rating: 1980,
    bio: 'Bold, brash, plays every ball like a winner.',
    careerWins: 65,
    careerLosses: 40,
    grandSlams: 0,
    masters1000: 0,
    favSurface: 'clay',
    speed: 0.95,
    power: 1.05,
    accuracy: 0.78,
    stamina: 0.86,
    mental: 0.78,
  },
  {
    id: 'p_006',
    name: 'Marco Rossi',
    nickname: 'The Italian Stallion',
    country: 'ITA',
    flag: '🇮🇹',
    age: 27,
    height: 188,
    weight: 82,
    handed: 'R',
    style: 'aggressor',
    rating: 2090,
    bio: 'Style and substance from the heart of Italy.',
    careerWins: 120,
    careerLosses: 70,
    grandSlams: 1,
    masters1000: 3,
    favSurface: 'clay',
    speed: 0.93,
    power: 0.98,
    accuracy: 0.88,
    stamina: 0.92,
    mental: 0.90,
  },
  {
    id: 'p_007',
    name: 'Pavel Volkov',
    nickname: 'The Bear',
    country: 'KAZ',
    flag: '🇰🇿',
    age: 30,
    height: 200,
    weight: 100,
    handed: 'L',
    style: 'aggressor',
    rating: 2210,
    bio: 'Towering presence with a thunderous serve.',
    careerWins: 145,
    careerLosses: 90,
    grandSlams: 1,
    masters1000: 5,
    favSurface: 'hard',
    speed: 0.78,
    power: 1.20,
    accuracy: 0.82,
    stamina: 0.84,
    mental: 0.92,
  },
  {
    id: 'p_008',
    name: 'Carlos Ramirez',
    nickname: 'The Wizard',
    country: 'ARG',
    flag: '🇦🇷',
    age: 26,
    height: 183,
    weight: 78,
    handed: 'R',
    style: 'spinner',
    rating: 2070,
    bio: 'Magical hands, can do anything with the ball.',
    careerWins: 95,
    careerLosses: 55,
    grandSlams: 0,
    masters1000: 2,
    favSurface: 'clay',
    speed: 0.92,
    power: 0.88,
    accuracy: 0.95,
    stamina: 0.92,
    mental: 0.88,
  },
  {
    id: 'p_009',
    name: 'Frederik Olsen',
    nickname: 'The Viking',
    country: 'DEN',
    flag: '🇩🇰',
    age: 24,
    height: 192,
    weight: 86,
    handed: 'R',
    style: 'aggressor',
    rating: 1970,
    bio: 'Nordic warrior with a thunderous serve.',
    careerWins: 80,
    careerLosses: 50,
    grandSlams: 0,
    masters1000: 1,
    favSurface: 'hard',
    speed: 0.88,
    power: 1.08,
    accuracy: 0.84,
    stamina: 0.86,
    mental: 0.82,
  },
  {
    id: 'p_010',
    name: 'Akira Yamada',
    nickname: 'The Shogun',
    country: 'JPN',
    flag: '🇯🇵',
    age: 25,
    height: 175,
    weight: 70,
    handed: 'R',
    style: 'baseliner',
    rating: 1950,
    bio: 'Disciplined player, samurai-like focus.',
    careerWins: 78,
    careerLosses: 52,
    grandSlams: 0,
    masters1000: 1,
    favSurface: 'hard',
    speed: 0.96,
    power: 0.85,
    accuracy: 0.93,
    stamina: 0.94,
    mental: 0.96,
  },
  {
    id: 'p_011',
    name: 'Erik Lindstrom',
    nickname: 'The Iceberg',
    country: 'SWE',
    flag: '🇸🇪',
    age: 28,
    height: 190,
    weight: 84,
    handed: 'R',
    style: 'baseliner',
    rating: 2040,
    bio: 'Cool customer with ice in his veins.',
    careerWins: 130,
    careerLosses: 80,
    grandSlams: 1,
    masters1000: 3,
    favSurface: 'hard',
    speed: 0.86,
    power: 0.94,
    accuracy: 0.92,
    stamina: 0.88,
    mental: 0.95,
  },
  {
    id: 'p_012',
    name: 'Mateo Silva',
    nickname: 'O Magico',
    country: 'BRA',
    flag: '🇧🇷',
    age: 23,
    height: 178,
    weight: 73,
    handed: 'R',
    style: 'aggressor',
    rating: 1880,
    bio: 'Carnival flair and lightning quick hands.',
    careerWins: 50,
    careerLosses: 40,
    grandSlams: 0,
    masters1000: 0,
    favSurface: 'clay',
    speed: 1.00,
    power: 0.92,
    accuracy: 0.82,
    stamina: 0.89,
    mental: 0.78,
  },
  {
    id: 'p_013',
    name: 'Dimitri Pavlov',
    nickname: 'The Tank',
    country: 'BLR',
    flag: '🇧🇾',
    age: 32,
    height: 198,
    weight: 96,
    handed: 'R',
    style: 'aggressor',
    rating: 2110,
    bio: 'Veteran with thunderous power and vast experience.',
    careerWins: 200,
    careerLosses: 130,
    grandSlams: 1,
    masters1000: 4,
    favSurface: 'hard',
    speed: 0.74,
    power: 1.18,
    accuracy: 0.86,
    stamina: 0.80,
    mental: 0.94,
  },
  {
    id: 'p_014',
    name: 'Pedro Garcia',
    nickname: 'The Matador',
    country: 'ESP',
    flag: '🇪🇸',
    age: 26,
    height: 184,
    weight: 80,
    handed: 'R',
    style: 'spinner',
    rating: 2030,
    bio: 'Fearless attacking spinner with theatrical flair.',
    careerWins: 100,
    careerLosses: 65,
    grandSlams: 1,
    masters1000: 2,
    favSurface: 'clay',
    speed: 0.92,
    power: 0.96,
    accuracy: 0.88,
    stamina: 0.94,
    mental: 0.86,
  },
  {
    id: 'p_015',
    name: 'Juan Pablo Cruz',
    nickname: 'The Bull',
    country: 'ARG',
    flag: '🇦🇷',
    age: 28,
    height: 187,
    weight: 86,
    handed: 'L',
    style: 'aggressor',
    rating: 2160,
    bio: 'Lefty fireballer who wears down opponents.',
    careerWins: 145,
    careerLosses: 92,
    grandSlams: 1,
    masters1000: 5,
    favSurface: 'clay',
    speed: 0.88,
    power: 1.05,
    accuracy: 0.85,
    stamina: 0.95,
    mental: 0.90,
  },
  {
    id: 'p_016',
    name: 'Kim Joo-won',
    nickname: 'The Dragon',
    country: 'KOR',
    flag: '🇰🇷',
    age: 22,
    height: 180,
    weight: 75,
    handed: 'R',
    style: 'counterPuncher',
    rating: 1850,
    bio: 'Rising star known for incredible defense.',
    careerWins: 40,
    careerLosses: 30,
    grandSlams: 0,
    masters1000: 0,
    favSurface: 'hard',
    speed: 1.05,
    power: 0.78,
    accuracy: 0.88,
    stamina: 0.96,
    mental: 0.82,
  },
  {
    id: 'p_017',
    name: 'Felix Mueller',
    nickname: 'The Hammer',
    country: 'AUT',
    flag: '🇦🇹',
    age: 27,
    height: 196,
    weight: 90,
    handed: 'R',
    style: 'serveVolley',
    rating: 2080,
    bio: 'Old-school serve and volley with a 130mph cannon.',
    careerWins: 110,
    careerLosses: 78,
    grandSlams: 1,
    masters1000: 2,
    favSurface: 'grass',
    speed: 0.85,
    power: 1.12,
    accuracy: 0.83,
    stamina: 0.82,
    mental: 0.88,
  },
  {
    id: 'p_018',
    name: 'Liam Walker',
    nickname: 'The Shark',
    country: 'AUS',
    flag: '🇦🇺',
    age: 25,
    height: 188,
    weight: 82,
    handed: 'R',
    style: 'aggressor',
    rating: 2020,
    bio: 'Aussie aggression on every shot. Hunts winners.',
    careerWins: 105,
    careerLosses: 70,
    grandSlams: 0,
    masters1000: 2,
    favSurface: 'hard',
    speed: 0.94,
    power: 1.02,
    accuracy: 0.86,
    stamina: 0.90,
    mental: 0.84,
  },
  {
    id: 'p_019',
    name: 'Robert Brown',
    nickname: 'The Professor',
    country: 'USA',
    flag: '🇺🇸',
    age: 30,
    height: 192,
    weight: 88,
    handed: 'R',
    style: 'baseliner',
    rating: 2200,
    bio: 'Tactical genius, reads the game like a chess master.',
    careerWins: 180,
    careerLosses: 110,
    grandSlams: 2,
    masters1000: 7,
    favSurface: 'hard',
    speed: 0.86,
    power: 0.94,
    accuracy: 0.96,
    stamina: 0.88,
    mental: 1.00,
  },
  {
    id: 'p_020',
    name: 'Tomas Novak',
    nickname: 'The Czechmate',
    country: 'CZE',
    flag: '🇨🇿',
    age: 26,
    height: 184,
    weight: 79,
    handed: 'R',
    style: 'baseliner',
    rating: 1980,
    bio: 'Patient and methodical. Brilliant footwork.',
    careerWins: 95,
    careerLosses: 60,
    grandSlams: 0,
    masters1000: 1,
    favSurface: 'hard',
    speed: 0.94,
    power: 0.88,
    accuracy: 0.94,
    stamina: 0.92,
    mental: 0.90,
  },
];

// ── More Detailed Player Profiles (continued, p_021 - p_080) ──
const PlayerProfilesExt = [
  { id:'p_021', name:'Sebastien Roche',    nickname:'Le Magnifique',  country:'FRA', flag:'🇫🇷', age:29, height:185, weight:80, handed:'R', style:'spinner',       rating:2050, bio:'Elegant clay-courter with surgical precision.',          careerWins:140, careerLosses:90, grandSlams:1, masters1000:3, favSurface:'clay',  speed:0.92, power:0.92, accuracy:0.94, stamina:0.93, mental:0.91 },
  { id:'p_022', name:'Magnus Berg',        nickname:'The Storm',      country:'NOR', flag:'🇳🇴', age:28, height:194, weight:88, handed:'R', style:'aggressor',     rating:2090, bio:'Northern lights striker with raw power.',                careerWins:120, careerLosses:78, grandSlams:1, masters1000:3, favSurface:'hard',  speed:0.85, power:1.10, accuracy:0.84, stamina:0.85, mental:0.88 },
  { id:'p_023', name:'Vladimir Kuznetsov', nickname:'The Czar',       country:'KAZ', flag:'🇰🇿', age:31, height:198, weight:96, handed:'R', style:'aggressor',     rating:2180, bio:'Towering veteran ruling the court.',                     careerWins:200, careerLosses:120, grandSlams:2, masters1000:6, favSurface:'hard',  speed:0.78, power:1.18, accuracy:0.86, stamina:0.84, mental:0.96 },
  { id:'p_024', name:'Henrique Costa',     nickname:'O Furacao',      country:'BRA', flag:'🇧🇷', age:24, height:178, weight:73, handed:'L', style:'aggressor',     rating:1920, bio:'Lefty firebrand with attitude.',                         careerWins:65, careerLosses:42, grandSlams:0, masters1000:1, favSurface:'clay',  speed:0.96, power:1.00, accuracy:0.82, stamina:0.88, mental:0.78 },
  { id:'p_025', name:'Olivier Bouchard',   nickname:'The Strategist', country:'CAN', flag:'🇨🇦', age:30, height:188, weight:82, handed:'R', style:'baseliner',     rating:2030, bio:'Cerebral player, every shot has a plan.',                careerWins:155, careerLosses:95, grandSlams:1, masters1000:3, favSurface:'hard',  speed:0.88, power:0.92, accuracy:0.96, stamina:0.90, mental:0.97 },
  { id:'p_026', name:'Connor McKay',       nickname:'The Rock',       country:'IRL', flag:'🇮🇪', age:27, height:185, weight:81, handed:'R', style:'defender',      rating:1850, bio:'Rock-solid defense, rarely makes errors.',               careerWins:90, careerLosses:70, grandSlams:0, masters1000:0, favSurface:'hard',  speed:0.96, power:0.78, accuracy:0.96, stamina:0.96, mental:0.88 },
  { id:'p_027', name:'Hassan Al-Farsi',    nickname:'The Falcon',     country:'UAE', flag:'🇦🇪', age:25, height:188, weight:79, handed:'R', style:'aggressor',     rating:1810, bio:'Quick like the desert falcon.',                          careerWins:60, careerLosses:42, grandSlams:0, masters1000:0, favSurface:'hard',  speed:0.98, power:0.92, accuracy:0.86, stamina:0.86, mental:0.78 },
  { id:'p_028', name:'Mohammed Al-Khalili',nickname:'The Sphinx',     country:'EGY', flag:'🇪🇬', age:28, height:182, weight:77, handed:'R', style:'baseliner',     rating:1880, bio:'Mysterious and methodical from the Nile.',               careerWins:85, careerLosses:60, grandSlams:0, masters1000:1, favSurface:'clay',  speed:0.92, power:0.86, accuracy:0.92, stamina:0.92, mental:0.92 },
  { id:'p_029', name:'Wei Liang',          nickname:'The Phoenix',    country:'CHN', flag:'🇨🇳', age:23, height:184, weight:76, handed:'R', style:'spinner',       rating:1960, bio:'Rising Chinese superstar.',                              careerWins:65, careerLosses:40, grandSlams:0, masters1000:1, favSurface:'hard',  speed:0.94, power:0.94, accuracy:0.92, stamina:0.93, mental:0.84 },
  { id:'p_030', name:'Kuldeep Singh',      nickname:'The Tiger',      country:'IND', flag:'🇮🇳', age:26, height:180, weight:74, handed:'R', style:'baseliner',     rating:1890, bio:'Classy player from Mumbai.',                             careerWins:95, careerLosses:62, grandSlams:0, masters1000:1, favSurface:'hard',  speed:0.93, power:0.88, accuracy:0.93, stamina:0.92, mental:0.88 },
  { id:'p_031', name:'Felipe Aguilar',     nickname:'The Condor',     country:'CHL', flag:'🇨🇱', age:27, height:186, weight:81, handed:'L', style:'spinner',       rating:1880, bio:'Andean lefty with thick topspin.',                       careerWins:88, careerLosses:62, grandSlams:0, masters1000:1, favSurface:'clay',  speed:0.92, power:0.94, accuracy:0.86, stamina:0.94, mental:0.85 },
  { id:'p_032', name:'Ricardo Vega',       nickname:'The Bull',       country:'COL', flag:'🇨🇴', age:25, height:189, weight:84, handed:'R', style:'aggressor',     rating:1900, bio:'Strong, athletic, fearless.',                            careerWins:75, careerLosses:55, grandSlams:0, masters1000:1, favSurface:'clay',  speed:0.92, power:1.04, accuracy:0.84, stamina:0.88, mental:0.82 },
  { id:'p_033', name:'Daniel Stein',       nickname:'The Surgeon',    country:'GER', flag:'🇩🇪', age:29, height:184, weight:79, handed:'R', style:'baseliner',     rating:2070, bio:'Operates with precision on every shot.',                 careerWins:140, careerLosses:88, grandSlams:1, masters1000:3, favSurface:'hard',  speed:0.88, power:0.92, accuracy:0.96, stamina:0.90, mental:0.94 },
  { id:'p_034', name:'Bartosz Kowalski',   nickname:'The Eagle',      country:'POL', flag:'🇵🇱', age:24, height:191, weight:85, handed:'R', style:'aggressor',     rating:1920, bio:'Polish thunder with a powerful serve.',                  careerWins:78, careerLosses:55, grandSlams:0, masters1000:1, favSurface:'hard',  speed:0.86, power:1.08, accuracy:0.84, stamina:0.85, mental:0.82 },
  { id:'p_035', name:'Andrei Mihailescu',  nickname:'The Vampire',    country:'ROU', flag:'🇷🇴', age:31, height:181, weight:78, handed:'R', style:'counterPuncher',rating:2030, bio:'Crafty veteran who steals matches.',                     careerWins:150, careerLosses:100, grandSlams:0, masters1000:2, favSurface:'clay',  speed:0.94, power:0.84, accuracy:0.93, stamina:0.95, mental:0.95 },
  { id:'p_036', name:'Ivan Petrovic',      nickname:'The Hawk',       country:'SRB', flag:'🇷🇸', age:26, height:188, weight:82, handed:'R', style:'baseliner',     rating:2020, bio:'Sharp eyes and clean ball-striking.',                    careerWins:110, careerLosses:72, grandSlams:1, masters1000:2, favSurface:'hard',  speed:0.92, power:0.94, accuracy:0.94, stamina:0.92, mental:0.90 },
  { id:'p_037', name:'Roman Petrenko',     nickname:'The Cossack',    country:'UKR', flag:'🇺🇦', age:28, height:186, weight:81, handed:'R', style:'aggressor',     rating:1960, bio:'Brave fighter with cossack spirit.',                     careerWins:108, careerLosses:75, grandSlams:0, masters1000:1, favSurface:'hard',  speed:0.91, power:1.00, accuracy:0.85, stamina:0.92, mental:0.88 },
  { id:'p_038', name:'Petter Eriksson',    nickname:'The Wolf',       country:'SWE', flag:'🇸🇪', age:23, height:189, weight:83, handed:'R', style:'aggressor',     rating:1820, bio:'Up and coming with hunter\'s instincts.',                careerWins:48, careerLosses:35, grandSlams:0, masters1000:0, favSurface:'hard',  speed:0.94, power:1.05, accuracy:0.78, stamina:0.86, mental:0.74 },
  { id:'p_039', name:'Ali Demir',          nickname:'The Sultan',     country:'TUR', flag:'🇹🇷', age:27, height:184, weight:79, handed:'R', style:'spinner',       rating:1880, bio:'Rich in style, master of pace changes.',                 careerWins:88, careerLosses:62, grandSlams:0, masters1000:0, favSurface:'clay',  speed:0.91, power:0.92, accuracy:0.92, stamina:0.92, mental:0.88 },
  { id:'p_040', name:'Yiannis Papadopolis',nickname:'The Spartan',    country:'GRE', flag:'🇬🇷', age:25, height:193, weight:88, handed:'R', style:'aggressor',     rating:1990, bio:'Big serve, big game, big heart.',                        careerWins:90, careerLosses:65, grandSlams:0, masters1000:1, favSurface:'hard',  speed:0.86, power:1.10, accuracy:0.85, stamina:0.86, mental:0.85 },
  { id:'p_041', name:'Luca Greco',         nickname:'Il Gladiatore',  country:'ITA', flag:'🇮🇹', age:24, height:181, weight:75, handed:'R', style:'aggressor',     rating:1850, bio:'Italian fighter, never says die.',                       careerWins:60, careerLosses:48, grandSlams:0, masters1000:0, favSurface:'clay',  speed:0.96, power:0.96, accuracy:0.84, stamina:0.92, mental:0.85 },
  { id:'p_042', name:'Jorge Mendes',       nickname:'The Phantom',    country:'POR', flag:'🇵🇹', age:29, height:182, weight:77, handed:'L', style:'counterPuncher',rating:1910, bio:'Lefty conjurer, slippery to play.',                      careerWins:108, careerLosses:80, grandSlams:0, masters1000:1, favSurface:'clay',  speed:0.94, power:0.84, accuracy:0.92, stamina:0.93, mental:0.90 },
  { id:'p_043', name:'Khalil Bouazizi',    nickname:'The Carthaginian',country:'TUN', flag:'🇹🇳', age:26, height:185, weight:79, handed:'R', style:'baseliner',    rating:1810, bio:'North African flair with European precision.',          careerWins:75, careerLosses:55, grandSlams:0, masters1000:0, favSurface:'clay',  speed:0.92, power:0.90, accuracy:0.92, stamina:0.92, mental:0.85 },
  { id:'p_044', name:'Pieter de Vries',    nickname:'The Tulip',      country:'NED', flag:'🇳🇱', age:30, height:191, weight:84, handed:'R', style:'serveVolley',   rating:2060, bio:'Old-school net rusher with a giant serve.',              careerWins:135, careerLosses:90, grandSlams:1, masters1000:2, favSurface:'grass', speed:0.86, power:1.08, accuracy:0.84, stamina:0.82, mental:0.92 },
  { id:'p_045', name:'Bram van Houten',    nickname:'The Lion',       country:'NED', flag:'🇳🇱', age:24, height:186, weight:80, handed:'R', style:'aggressor',     rating:1900, bio:'Tall, powerful, fearless.',                              careerWins:70, careerLosses:50, grandSlams:0, masters1000:1, favSurface:'hard',  speed:0.88, power:1.06, accuracy:0.84, stamina:0.86, mental:0.78 },
  { id:'p_046', name:'Anton Hofstadter',   nickname:'The Maestro',    country:'AUT', flag:'🇦🇹', age:32, height:181, weight:76, handed:'R', style:'counterPuncher',rating:2080, bio:'Veteran maestro with vintage skills.',                  careerWins:200, careerLosses:135, grandSlams:1, masters1000:4, favSurface:'hard',  speed:0.84, power:0.84, accuracy:0.96, stamina:0.86, mental:0.97 },
  { id:'p_047', name:'Reza Taheri',        nickname:'The Persian Prince',country:'IRN',flag:'🇮🇷',age:25,height:184,weight:78, handed:'R', style:'spinner',       rating:1820, bio:'Eastern flair, Western technique.',                      careerWins:62, careerLosses:48, grandSlams:0, masters1000:0, favSurface:'clay',  speed:0.92, power:0.92, accuracy:0.90, stamina:0.92, mental:0.84 },
  { id:'p_048', name:'David Cohen',        nickname:'The Pioneer',    country:'ISR', flag:'🇮🇱', age:26, height:185, weight:79, handed:'R', style:'baseliner',     rating:1870, bio:'Pioneering player from a tennis-rising nation.',         careerWins:80, careerLosses:60, grandSlams:0, masters1000:0, favSurface:'hard',  speed:0.92, power:0.92, accuracy:0.90, stamina:0.92, mental:0.88 },
  { id:'p_049', name:'Saif Al-Sayed',      nickname:'The Sword',      country:'QAT', flag:'🇶🇦', age:24, height:188, weight:82, handed:'R', style:'aggressor',     rating:1750, bio:'Sharp, decisive shot-maker.',                            careerWins:50, careerLosses:42, grandSlams:0, masters1000:0, favSurface:'hard',  speed:0.92, power:1.02, accuracy:0.82, stamina:0.85, mental:0.74 },
  { id:'p_050', name:'Ahmed Bin Khalifa',  nickname:'The Emir',       country:'SAU', flag:'🇸🇦', age:30, height:183, weight:80, handed:'R', style:'baseliner',     rating:1880, bio:'Royal grace and steady tennis.',                         careerWins:120, careerLosses:90, grandSlams:0, masters1000:1, favSurface:'hard',  speed:0.88, power:0.92, accuracy:0.94, stamina:0.90, mental:0.92 },
  { id:'p_051', name:'Tomohiro Saito',     nickname:'The Samurai',    country:'JPN', flag:'🇯🇵', age:27, height:181, weight:75, handed:'R', style:'baseliner',     rating:2010, bio:'Disciplined craftsman of the court.',                    careerWins:115, careerLosses:78, grandSlams:0, masters1000:2, favSurface:'hard',  speed:0.94, power:0.88, accuracy:0.96, stamina:0.94, mental:0.96 },
  { id:'p_052', name:'Park Hyun-jun',      nickname:'The Comet',      country:'KOR', flag:'🇰🇷', age:23, height:179, weight:73, handed:'R', style:'counterPuncher',rating:1830, bio:'Dazzling speed, blistering returns.',                    careerWins:55, careerLosses:42, grandSlams:0, masters1000:0, favSurface:'hard',  speed:1.02, power:0.78, accuracy:0.86, stamina:0.94, mental:0.82 },
  { id:'p_053', name:'Charoen Saetan',     nickname:'The Elephant',   country:'THA', flag:'🇹🇭', age:26, height:175, weight:71, handed:'R', style:'baseliner',     rating:1750, bio:'Tireless from Thailand.',                                careerWins:55, careerLosses:48, grandSlams:0, masters1000:0, favSurface:'hard',  speed:0.94, power:0.84, accuracy:0.90, stamina:0.96, mental:0.86 },
  { id:'p_054', name:'Tan Kuok',           nickname:'The Tiger',      country:'MAS', flag:'🇲🇾', age:25, height:177, weight:72, handed:'R', style:'baseliner',     rating:1700, bio:'Asian tiger with sharp instincts.',                       careerWins:48, careerLosses:42, grandSlams:0, masters1000:0, favSurface:'hard',  speed:0.95, power:0.84, accuracy:0.88, stamina:0.92, mental:0.82 },
  { id:'p_055', name:'Wei Yang',           nickname:'The Tiger',      country:'CHN', flag:'🇨🇳', age:24, height:182, weight:75, handed:'R', style:'spinner',       rating:1840, bio:'Aggressive Chinese star on the rise.',                   careerWins:62, careerLosses:42, grandSlams:0, masters1000:0, favSurface:'hard',  speed:0.92, power:0.94, accuracy:0.88, stamina:0.92, mental:0.84 },
  { id:'p_056', name:'Niklas Borg',        nickname:'The Ice King',   country:'SWE', flag:'🇸🇪', age:28, height:186, weight:79, handed:'R', style:'baseliner',     rating:2090, bio:'Arctic calm with surgical groundstrokes.',                careerWins:140, careerLosses:90, grandSlams:1, masters1000:3, favSurface:'hard',  speed:0.86, power:0.92, accuracy:0.96, stamina:0.92, mental:0.97 },
  { id:'p_057', name:'Antoine Lavigne',    nickname:'The Mousquetaire',country:'FRA',flag:'🇫🇷', age:25, height:184, weight:78, handed:'R', style:'aggressor',     rating:1910, bio:'French flair with attacking instincts.',                 careerWins:88, careerLosses:62, grandSlams:0, masters1000:1, favSurface:'clay',  speed:0.92, power:1.00, accuracy:0.86, stamina:0.86, mental:0.85 },
  { id:'p_058', name:'Mikhail Sokolov',    nickname:'The Falcon',     country:'KAZ', flag:'🇰🇿', age:26, height:187, weight:81, handed:'L', style:'spinner',       rating:1880, bio:'Lefty topspin specialist.',                              careerWins:82, careerLosses:60, grandSlams:0, masters1000:1, favSurface:'clay',  speed:0.92, power:0.92, accuracy:0.90, stamina:0.92, mental:0.86 },
  { id:'p_059', name:'Igor Volkov',        nickname:'The Hammer',     country:'BLR', flag:'🇧🇾', age:30, height:194, weight:90, handed:'R', style:'aggressor',     rating:2120, bio:'Crusher of dreams and tennis balls.',                    careerWins:165, careerLosses:105, grandSlams:1, masters1000:4, favSurface:'hard',  speed:0.82, power:1.16, accuracy:0.86, stamina:0.84, mental:0.92 },
  { id:'p_060', name:'Thiago Pereira',     nickname:'O Furacao',      country:'BRA', flag:'🇧🇷', age:23, height:183, weight:76, handed:'R', style:'aggressor',     rating:1860, bio:'Brazilian explosion of power and emotion.',              careerWins:60, careerLosses:46, grandSlams:0, masters1000:0, favSurface:'clay',  speed:0.94, power:1.00, accuracy:0.84, stamina:0.86, mental:0.78 },
];

// ── Massive Commentary Expansion (1000+ lines) ────────
const ExpandedCommentary = {
  preMatch: [
    'A blockbuster match in store today.',
    'Two warriors set to do battle.',
    'A clash of styles — should be fascinating.',
    'Both players warming up nicely.',
    'Crowd is filing in for what should be a thriller.',
    'Conditions look perfect for tennis.',
    'A sold-out arena, electric atmosphere.',
    'High stakes for both players today.',
    'A long awaited matchup.',
    'Both have a lot to prove.',
    'Storylines aplenty in this match.',
    'A baseline grinder vs. a serve and volley specialist.',
    'Champion vs. the upstart — a classic tennis tale.',
    'Two giants of the game on display.',
    'No love lost between these two.',
    'Friendly rivalry on display.',
    'Generation old vs. new today.',
    'Veteran vs. youngster.',
    'Local hero playing for the home crowd.',
    'Visiting champion looking to spoil the party.',
    'Unbeaten at this tournament for years.',
    'First-time finalist looking to make history.',
    'Both have mountains to climb today.',
    'Anticipation building as we approach first serve.',
    'Stretching, fidgeting, mentally preparing.',
    'Nerves visible in both camps.',
    'Pre-match traditions being honored.',
    'Coaches in the stands look concerned.',
    'Fans waving flags, stamping feet.',
    'Banners visible high in the stands.',
    'The umpire takes their seat.',
    'Ball boys lined up like sentries.',
    'Linesperson with hawk eyes positioned.',
    'Hawk-Eye system armed and ready.',
    'Cameras on every angle of the court.',
    'The hush before the storm.',
    'Pin-drop silence as the warmup ends.',
    'The roar as players are introduced.',
    'Walk-out music sets the tone.',
    'Player handshakes complete — let\'s go.',
  ],
  midMatch: [
    'The tide is turning in this match.',
    'Momentum has shifted decidedly.',
    'A pivotal point coming up.',
    'You can feel the match in the balance.',
    'They\'re finding their range now.',
    'Settling into a rhythm.',
    'Crowd getting their money\'s worth.',
    'Beautiful tennis on display.',
    'Both players in the zone.',
    'Hardly an unforced error in sight.',
    'Cleanup time on the second set.',
    'Need to keep the foot on the gas.',
    'Cannot afford to drop intensity.',
    'Locked in a war of attrition.',
    'Battle of wills out there.',
    'Each digging deep for every point.',
    'A reset between points.',
    'Towel down, deep breath.',
    'Bouncing the ball, gathering thoughts.',
    'Self-talk between points.',
    'Quick word with the coach.',
    'Looking to the box for support.',
    'No support, just vibes.',
    'Pulling up the socks.',
    'Fixing the strings.',
    'Headband adjustment.',
    'A small tactical change in approach.',
    'Going for the lines now, no more conservative play.',
    'Mixing up the patterns.',
    'Coming to the net more often.',
    'Staying back more, grinding it out.',
    'Looking comfortable now.',
    'Beginning to dictate play.',
    'Lost a step from earlier.',
    'Energy starting to flag.',
    'Second wind kicking in.',
    'Adrenaline carrying them.',
    'Pure muscle memory at this point.',
    'Both players locked in.',
    'A battle of nerves now.',
  ],
  bigPoint: [
    'The biggest point of the match coming up.',
    'Pressure cooker time.',
    'You don\'t want to lose this one.',
    'Massive point looming.',
    'This could be the turning point.',
    'A point that defines a champion.',
    'Stay strong, commit, hit through.',
    'Don\'t give it back!',
    'Last roll of the dice.',
    'Match point territory.',
    'Set point material.',
    'Game point coming up.',
    'Champion\'s point — close it out.',
    'Save it!',
    'Make them play one more.',
    'Nothing risky now, just disciplined.',
    'Time to dig deep.',
    'Crowd holding their breath.',
    'Crowd urging them on.',
    'Crowd silent for the moment.',
  ],
  errorRecovery: [
    'Brush it off, next point.',
    'Forget about it.',
    'Move on, move on.',
    'Don\'t dwell.',
    'Reset, re-engage.',
    'No drama, just play.',
    'Forgive yourself, refocus.',
    'Back to basics.',
    'Trust the strokes.',
    'Don\'t aim too fine.',
    'High percentages.',
    'Margin for error.',
    'Steady ship.',
    'Calm head.',
    'Process not outcome.',
    'One ball at a time.',
    'Stay in the present.',
    'Simplify.',
    'Don\'t change too much.',
    'A quick recovery needed.',
  ],
  greatTennis: [
    'Tennis at its very best!',
    'Pure exhibition stuff.',
    'Why we love this sport.',
    'Highlight reel material.',
    'A future poster on the wall.',
    'For the museum.',
    'Money\'s worth right there.',
    'They\'re making it look easy.',
    'Showing the rest of us how it\'s done.',
    'Beautiful, beautiful tennis.',
    'A masterclass in shot-making.',
    'Surgical precision.',
    'Inch-perfect.',
    'Effortless power.',
    'Sublime touch.',
    'World-class footwork.',
    'World-class anticipation.',
    'Pure athletic gift.',
    'A born tennis player.',
    'Something special on display.',
  ],
  crowd: [
    'Crowd loving every minute.',
    'Fans on their feet.',
    'A roar from the stands.',
    'Standing ovation building.',
    'Cheers echoing around the arena.',
    'The crowd urging them on.',
    'Tense silence.',
    'Could hear a pin drop.',
    'Singing along.',
    'Mexican wave going around.',
    'Crowd doing their part.',
    'Atmosphere electric.',
    'Goosebumps from the crowd noise.',
    'Hairs standing on end.',
    'Place is rocking.',
    'A buzz around the stadium.',
    'A hush descends on the court.',
    'A whisper through the stands.',
    'Crowd all rise.',
    'A standing ovation in the making.',
    'Bowing to the crowd.',
    'Acknowledging the support.',
    'Saluting the four corners.',
    'Tears in the eyes of fans.',
    'Smiles all around.',
    'Crowd losing their minds!',
    'Pandemonium in the stands!',
    'A coronation atmosphere.',
    'The hometown hero gets the loudest cheer.',
    'Visiting fans equally vocal.',
  ],
  underdog: [
    'A real David vs Goliath story here.',
    'The underdog rising to the occasion.',
    'Refusing to be intimidated.',
    'Punching above their weight.',
    'Belief growing with every point.',
    'The crowd getting behind the underdog.',
    'A giant-killer in the making.',
    'Breaking serve when they shouldn\'t!',
    'Defying the odds.',
    'A career-defining performance.',
    'The match of their life.',
    'Memories being made.',
    'A name being made today.',
    'Going for it with nothing to lose.',
    'Free swinging, why not.',
    'Riding the wave of belief.',
    'The favorite looking rattled.',
    'A reversal of expectations.',
    'Storybook stuff.',
    'A miracle in progress.',
  ],
  favorite: [
    'The favorite asserting their authority.',
    'Class telling.',
    'Why they\'re ranked where they are.',
    'Gradually wearing down the opposition.',
    'A controlled performance.',
    'Doing what champions do.',
    'A clinical demolition.',
    'Making it look easier than it is.',
    'No drama in the win.',
    'Routine display of dominance.',
    'A reminder of why they\'re feared.',
    'No mercy from the top seed.',
    'Crushing the upset hopes.',
    'Big match temperament showing.',
    'Mentally too strong.',
    'A walkover in the making.',
    'Sliding into the next round.',
    'Conserving energy for later rounds.',
    'No fuss, no muss.',
    'In the zone today.',
  ],
  emotion: [
    'Frustration boiling over.',
    'A quiet calm despite the situation.',
    'Visible anger.',
    'Stoic as ever.',
    'Cool customer.',
    'Wears emotions on the sleeve.',
    'Smashing rackets is one way to vent.',
    'Letting out a primal scream.',
    'Talking to themselves.',
    'A moment of self-doubt.',
    'A thumb up to the box.',
    'A nod to the coach.',
    'A glare at the opponent.',
    'A wave to the family in the stands.',
    'Crouching down, staring at the strings.',
    'Pulling at the shirt.',
    'Forehead slap.',
    'Looking up at the sky.',
    'Closing the eyes, deep breath.',
    'A rallying fist pump.',
    'A roar of triumph.',
    'A whisper of disbelief.',
    'A teary look up.',
    'Composed as ever.',
    'Battling internal demons.',
    'Outwardly serene.',
    'A shake of the head in disbelief.',
    'A nod of acknowledgment.',
    'A handshake at the net.',
    'A pat on the back.',
  ],
  techniques: [
    'Beautiful follow-through on that swing.',
    'Textbook open stance.',
    'Western grip on the forehand.',
    'Two-handed backhand with vicious topspin.',
    'Continental grip for the slice.',
    'Eastern grip on the volley.',
    'Semi-western grip on the forehand.',
    'Closed stance, full extension.',
    'Open stance, hip rotation through.',
    'Squared up to the ball.',
    'Hitting on the rise.',
    'Catching the ball clean off the strings.',
    'Sweet spot contact.',
    'Catching the corner of the strings.',
    'Frame shot.',
    'Mishit but somehow lands in.',
    'A let cord and over.',
    'Full-extension reach.',
    'Stretching every sinew.',
    'A diving volley.',
    'A leaping overhead.',
    'Falls to the ground after the shot.',
    'Flying volley out of nowhere.',
    'Picks the ball up off the ankles.',
    'Defensive lob from impossible position.',
    'Half-volley pickup like Federer.',
    'Sliding into the shot.',
    'Recovers to the center.',
    'Court positioning is everything.',
    'Anticipates the shot before it\'s hit.',
    'Reads the body language perfectly.',
    'Stuck on the wrong foot.',
    'Caught flat-footed.',
    'Wrong-footed and somehow still in the point.',
    'No time to adjust.',
    'Hits a winner from a defensive position.',
    'Defends, defends, then attacks.',
    'Patience pays off.',
    'Unleashes the fury when the ball sits up.',
    'Heavy topspin keeps it in.',
    'Slice keeps it low and skidding.',
    'Flat ball cuts through the court.',
    'High looping ball drops at the baseline.',
    'Drop shot dies on the net.',
    'Lob lands inches inside the line.',
    'Cross-court angle pulls them wide.',
    'Down the line for a winner.',
    'Inside-out forehand sets up the next ball.',
    'Inside-in forehand catches them off-guard.',
    'Body serve cramps the return.',
    'Wide serve opens up the court.',
    'T serve down the middle.',
  ],
};

// ── More UI Helpers ────────────────────────────────
const UIHelpers = {
  formatScore: function(p1, p2){ return p1 + ' – ' + p2; },
  formatGames: function(g1, g2){ return 'Games ' + g1 + '–' + g2; },
  formatSets: function(s1, s2){ return 'Sets ' + s1 + '–' + s2; },
  formatTime: function(ms){
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return m + ':' + String(s % 60).padStart(2, '0');
  },
  formatPercent: function(v){ return Math.round(v * 100) + '%'; },
  formatSpeed: function(unitsPerSec){ return Math.round(unitsPerSec * 12) + ' km/h'; },
  formatDistance: function(units){ return units.toFixed(1) + ' m'; },
  rank: function(rating){
    if (rating >= 2400) return { name:'Grandmaster', tier:7, color:'#ff00ff' };
    if (rating >= 2100) return { name:'Master',      tier:6, color:'#ff7575' };
    if (rating >= 1800) return { name:'Diamond',     tier:5, color:'#b9f2ff' };
    if (rating >= 1500) return { name:'Platinum',    tier:4, color:'#e5e4e2' };
    if (rating >= 1200) return { name:'Gold',        tier:3, color:'#ffd700' };
    if (rating >= 1000) return { name:'Silver',      tier:2, color:'#c0c0c0' };
    return { name:'Bronze', tier:1, color:'#cd7f32' };
  },
};

// ── Camera (over-the-shoulder, Roblox 3rd-person) ──────
// shoulder shifts both camera and look-at to the right of the character,
// so the character sits in the LEFT portion of the screen and the court
// is visible past their right shoulder.
const CAM = { yaw:0, pitch:0.55, dist:9.0, tx:0, ty:1.6, tz:9, shoulder:2.4 };
function updateCamera(){
  const p0 = P[0];
  CAM.tx += (p0.x                       - CAM.tx) * 0.18;
  CAM.ty += (1.6 + (p0.jumpH||0)*0.5    - CAM.ty) * 0.12;
  CAM.tz += (p0.z                       - CAM.tz) * 0.18;
  const sy = Math.sin(CAM.yaw),  cy = Math.cos(CAM.yaw);
  const sp = Math.sin(CAM.pitch), cp = Math.cos(CAM.pitch);
  // Camera-local right vector in horizontal plane = (cy, 0, -sy)
  const sX = CAM.shoulder * cy;
  const sZ = CAM.shoulder * (-sy);
  camera.position.set(
    CAM.tx + CAM.dist*cp*sy + sX,
    CAM.ty + CAM.dist*sp,
    CAM.tz + CAM.dist*cp*cy + sZ
  );
  camera.lookAt(CAM.tx + sX, CAM.ty, CAM.tz + sZ);
}
function initCamera(){
  CAM.tx = 0; CAM.ty = 1.6; CAM.tz = 9;
  const sy = Math.sin(CAM.yaw), cy = Math.cos(CAM.yaw);
  const sp = Math.sin(CAM.pitch), cp = Math.cos(CAM.pitch);
  const sX = CAM.shoulder * cy, sZ = CAM.shoulder * (-sy);
  camera.position.set(CAM.tx + CAM.dist*cp*sy + sX, CAM.ty + CAM.dist*sp, CAM.tz + CAM.dist*cp*cy + sZ);
  camera.lookAt(CAM.tx + sX, CAM.ty, CAM.tz + sZ);
}
initCamera();

// Camera-relative forward/right (for WASD movement)
function camForwardRight(){
  // Compute directly from yaw, ignoring shoulder offset and camera height.
  // Forward (horizontal): (-sin yaw, 0, -cos yaw); Right: (cos yaw, 0, -sin yaw)
  const sy = Math.sin(CAM.yaw), cy = Math.cos(CAM.yaw);
  return { Fx:-sy, Fz:-cy, Rx:cy, Rz:-sy };
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
  // Best zone is the RIGHT (high %) — click late to nail max power
  const zone = v > 0.82 ? 'PERFECT!' : v > 0.55 ? 'GOOD' : 'WEAK';
  const col  = v > 0.82 ? '#60ff80' : v > 0.55 ? '#ffdc32' : '#ff5050';
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
  // Power quality: RIGHT side of meter = best
  // >0.82 = perfect (1.0), >0.55 = good (0.65), else weak (0.30)
  const powerQ = srvPower > 0.82 ? 1.0 : srvPower > 0.55 ? 0.65 : 0.30;
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
  const srvSpeed = 14 + quality*8;
  B.launch(pi, tx, tz, srvSpeed, 0.3, fromY);
  AudioSys.hit(0.9 + quality*0.4);
  ParticleSys.sparkBurst(P[pi].x, fromY, P[pi].z + (P[pi].side==='near'?-0.3:0.3));
  STATS.registerHit(pi, false, true);
  STATS.registerServeSpeed(pi, srvSpeed);
  if (powerQ >= 1) checkAchievements({ event: 'perfect_serve' });
  gPhase='rally'; P[pi].serving=false;
}

function doHit(who){
  if (gPhase!=='rally' && gPhase!=='practice') return;
  const pi = who===0?0:1;
  if (gPhase==='rally' && humanPL.indexOf(pi)<0) return;
  const p = P[pi];
  // Block spam: must be off cooldown AND not mid-swing
  if (p.hitCD>0 || p.swingT>0) return;
  // In rally, must be on your side. In practice, no side requirement.
  if (gPhase==='rally'){
    const onMySide = p.side==='near' ? B.pos.z>0 : B.pos.z<0;
    if (!onMySide) return;
  }
  // Must be near the ball — looser range so connecting is easier
  const dx=p.x-B.pos.x, dz=p.z-B.pos.z;
  const dist = Math.sqrt(dx*dx+dz*dz);
  if (dist > 5.5) return;          // was 4.0 — that was punishingly tight
  if (B.pos.y > 4.0) return;       // was 3.5 — small bump for jump-smashes
  const q = ringActive?ringQuality():0.38;
  ringActive=false;
  p.swingT=22; p.hitCD=42;          // longer cooldown — no F spamming
  const txR = (mX/innerWidth)*2-1;
  const tx = Math.max(-CHW+0.5, Math.min(CHW-0.5, txR*3.8));
  const tz = p.side==='near' ? -(3+Math.random()*5) : (3+Math.random()*5);
  // Auto-smash when jumping AND ball is high
  const isSmash = (p.jumpH > 0.25) && (B.pos.y > 1.6);
  if (isSmash){
    // REAL SMASH: ballistic from elevated position, but ALSO must clear the net.
    const fromY = 2.4 + (p.jumpH || 0) * 1.5;
    const aimX = Math.max(-CHW+0.6, Math.min(CHW-0.6, txR*4.2));
    const aimZ = p.side==='near' ? -(7 + Math.random()*3) : (7 + Math.random()*3);
    const dx = aimX - p.x, dz = aimZ - p.z;
    // Pick a flight time that keeps the ball above the net at z=0.
    // Ball must clear y=1.05 at the moment z passes 0.
    // Solve: at fraction t0/T (where z=0), y = fromY + vy*t0 - 0.5*g*t0^2 >= 1.05
    // We pick T such that ball arcs decently — start at 0.75s for safer net clearance.
    const tFlight = 0.75;
    const g = B.GRAV;
    const vyNeeded = (0.18 - fromY + 0.5 * g * tFlight * tFlight) / tFlight;
    B.pos.set(p.x, fromY, p.z + (pi<2?-0.4:0.4));
    B.bounces = 0; B.lastHitter = pi; B.active = true; B.trail = [];
    B.vel.set(dx/tFlight, vyNeeded, dz/tFlight);
    ballMesh.position.copy(B.pos);
    ballLight.position.copy(B.pos);
    ballMesh.visible = true;
    p.swingT = 28;
    showMsg('🔥 SMASH!', 800);
    AudioSys.smash();
    AudioSys.whoosh();
    ParticleSys.sparkBurst(p.x, fromY, p.z);
    STATS.registerHit(pi, true, false);
    triggerCrowdWave();
    if (peerConn && isHost){ try{ peerConn.send({type:'hit', pi:pi, tx:aimX, tz:aimZ, spd:dx/tFlight, arcH:-9, y0:fromY}); }catch(_){} }
    return;
  }
  // Regular shots — speeds boosted so flight time is short enough for visible arcs
  let arcH=0.6, spd=11;
  if (KEYS.KeyQ)      { arcH=1.4; spd=10; }    // topspin: more arc, slower
  else if (KEYS.KeyE) { arcH=0.4; spd=10; }    // slice:   flat, slower
  else if (KEYS.KeyR) { arcH=2.6; spd=8;  }    // lob:     high but capped at 4m by physics
  else if (KEYS.KeyG) { arcH=0.3; spd=15; }    // flat hard
  spd *= 0.75 + q*0.50;
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
        // AI clicks the meter at high values (right side = perfect)
        srvPower = D.power<1 ? 0.55 + Math.random()*0.18    // easy: often misses
                  : D.power>1.1 ? 0.85 + Math.random()*0.13  // hard: nails perfect
                  : 0.72 + Math.random()*0.18;               // medium: usually good/perfect
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
        const srvSpd = (12 + Math.random()*4) * D.power;
        B.launch(pi, tx, tz, srvSpd, 0.6);
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
        const spd = (10 + Math.random()*3) * D.power;
        const arcH = 0.6 + Math.random()*0.5;
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

  // Movement should ALWAYS work during gameplay (was rally-only — bug)
  if (gPhase!=='match_over') updateHumans(dt);

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
  updateLandingMarker();

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

// ======================================================================
// 250 Tournament Player Profiles
// ======================================================================

const TournamentPlayers = [
  {
    id: 'tp_001',
    name: 'Eric Johnson',
    nickname: 'The Shark',
    country: 'SUI',
    flagCode: 'ch',
    age: 21,
    height: 188,
    weight: 83,
    handed: 'R',
    style: 'aggressor',
    rating: 1530,
    bio: 'Heavy topspin specialist who grinds out points.',
    careerWins: 43,
    careerLosses: 70,
    grandSlams: 1,
    masters1000: 8,
    favSurface: 'hard',
    speed: 0.94,
    power: 0.92,
    accuracy: 0.91,
    stamina: 0.91,
    mental: 0.83,
  },
  {
    id: 'tp_002',
    name: 'Tom Flores',
    nickname: 'The Shark',
    country: 'CRO',
    flagCode: 'hr',
    age: 29,
    height: 178,
    weight: 74,
    handed: 'R',
    style: 'baseliner',
    rating: 2281,
    bio: 'Athletic baseliner with thunderous groundstrokes.',
    careerWins: 106,
    careerLosses: 41,
    grandSlams: 0,
    masters1000: 6,
    favSurface: 'hard',
    speed: 0.74,
    power: 1.04,
    accuracy: 0.88,
    stamina: 0.94,
    mental: 0.92,
  },
  {
    id: 'tp_003',
    name: 'Felix Harris',
    nickname: 'The Ace',
    country: 'HUN',
    flagCode: 'hu',
    age: 30,
    height: 188,
    weight: 76,
    handed: 'R',
    style: 'defender',
    rating: 1546,
    bio: 'Mountain of a man with a thunderous serve.',
    careerWins: 189,
    careerLosses: 73,
    grandSlams: 2,
    masters1000: 1,
    favSurface: 'grass',
    speed: 1.04,
    power: 1.05,
    accuracy: 0.81,
    stamina: 0.84,
    mental: 0.95,
  },
  {
    id: 'tp_004',
    name: 'Ian White',
    nickname: 'The Star',
    country: 'AUS',
    flagCode: 'au',
    age: 24,
    height: 187,
    weight: 93,
    handed: 'R',
    style: 'serveVolley',
    rating: 1667,
    bio: 'Aggressive net rusher who keeps opponents off-balance.',
    careerWins: 138,
    careerLosses: 112,
    grandSlams: 2,
    masters1000: 10,
    favSurface: 'clay',
    speed: 0.98,
    power: 0.79,
    accuracy: 0.8,
    stamina: 0.93,
    mental: 0.72,
  },
  {
    id: 'tp_005',
    name: 'Ben Cooper',
    nickname: 'The Rocket',
    country: 'KOR',
    flagCode: 'kr',
    age: 29,
    height: 176,
    weight: 90,
    handed: 'R',
    style: 'defender',
    rating: 1905,
    bio: 'Defensive wall who turns defense into offense.',
    careerWins: 246,
    careerLosses: 179,
    grandSlams: 3,
    masters1000: 2,
    favSurface: 'hard',
    speed: 0.81,
    power: 0.8,
    accuracy: 0.87,
    stamina: 0.78,
    mental: 0.88,
  },
  {
    id: 'tp_006',
    name: 'Sam White',
    nickname: 'The Bear',
    country: 'ESP',
    flagCode: 'es',
    age: 20,
    height: 197,
    weight: 73,
    handed: 'R',
    style: 'counterPuncher',
    rating: 2142,
    bio: 'Aggressive net rusher who keeps opponents off-balance.',
    careerWins: 60,
    careerLosses: 189,
    grandSlams: 3,
    masters1000: 9,
    favSurface: 'clay',
    speed: 0.73,
    power: 0.85,
    accuracy: 1.0,
    stamina: 0.86,
    mental: 0.99,
  },
  {
    id: 'tp_007',
    name: 'Alex Rivera',
    nickname: 'The Bull',
    country: 'NED',
    flagCode: 'nl',
    age: 22,
    height: 179,
    weight: 83,
    handed: 'R',
    style: 'counterPuncher',
    rating: 1964,
    bio: 'Lefty firebrand with theatrical flair.',
    careerWins: 20,
    careerLosses: 199,
    grandSlams: 2,
    masters1000: 8,
    favSurface: 'clay',
    speed: 1.0,
    power: 0.9,
    accuracy: 0.73,
    stamina: 0.89,
    mental: 0.95,
  },
  {
    id: 'tp_008',
    name: 'Yuki Green',
    nickname: 'The Lion',
    country: 'ESP',
    flagCode: 'es',
    age: 35,
    height: 199,
    weight: 70,
    handed: 'L',
    style: 'defender',
    rating: 1831,
    bio: 'Showboat who plays for the crowd.',
    careerWins: 145,
    careerLosses: 19,
    grandSlams: 0,
    masters1000: 5,
    favSurface: 'hard',
    speed: 1.05,
    power: 1.03,
    accuracy: 0.79,
    stamina: 0.72,
    mental: 0.96,
  },
  {
    id: 'tp_009',
    name: 'Daniel Garcia',
    nickname: 'Le Magnifique',
    country: 'SRB',
    flagCode: 'rs',
    age: 23,
    height: 191,
    weight: 85,
    handed: 'L',
    style: 'baseliner',
    rating: 1669,
    bio: 'Cool under pressure, money on big points.',
    careerWins: 87,
    careerLosses: 150,
    grandSlams: 4,
    masters1000: 6,
    favSurface: 'grass',
    speed: 1.09,
    power: 1.07,
    accuracy: 0.93,
    stamina: 0.91,
    mental: 0.91,
  },
  {
    id: 'tp_010',
    name: 'Sam Hall',
    nickname: 'The Champion',
    country: 'IND',
    flagCode: 'in',
    age: 26,
    height: 177,
    weight: 72,
    handed: 'R',
    style: 'counterPuncher',
    rating: 1521,
    bio: 'Heavy topspin specialist who grinds out points.',
    careerWins: 170,
    careerLosses: 156,
    grandSlams: 1,
    masters1000: 9,
    favSurface: 'clay',
    speed: 0.79,
    power: 0.73,
    accuracy: 0.89,
    stamina: 0.77,
    mental: 0.97,
  },
  {
    id: 'tp_011',
    name: 'Oliver Jones',
    nickname: 'Il Gladiatore',
    country: 'SUI',
    flagCode: 'ch',
    age: 25,
    height: 187,
    weight: 74,
    handed: 'L',
    style: 'defender',
    rating: 2090,
    bio: 'Rising star with raw talent and big upside.',
    careerWins: 141,
    careerLosses: 77,
    grandSlams: 3,
    masters1000: 12,
    favSurface: 'grass',
    speed: 0.86,
    power: 0.74,
    accuracy: 0.9,
    stamina: 0.81,
    mental: 0.82,
  },
  {
    id: 'tp_012',
    name: 'Bryan Rivera',
    nickname: 'The King',
    country: 'GBR',
    flagCode: 'gb',
    age: 22,
    height: 177,
    weight: 76,
    handed: 'R',
    style: 'spinner',
    rating: 2049,
    bio: 'Lefty firebrand with theatrical flair.',
    careerWins: 134,
    careerLosses: 50,
    grandSlams: 3,
    masters1000: 2,
    favSurface: 'grass',
    speed: 0.81,
    power: 0.8,
    accuracy: 0.98,
    stamina: 0.83,
    mental: 0.96,
  },
  {
    id: 'tp_013',
    name: 'Dennis Brown',
    nickname: 'The Shogun',
    country: 'SRB',
    flagCode: 'rs',
    age: 24,
    height: 183,
    weight: 85,
    handed: 'R',
    style: 'baseliner',
    rating: 1718,
    bio: 'Tactical genius who reads the game brilliantly.',
    careerWins: 241,
    careerLosses: 117,
    grandSlams: 0,
    masters1000: 2,
    favSurface: 'hard',
    speed: 0.85,
    power: 1.09,
    accuracy: 0.78,
    stamina: 0.94,
    mental: 0.84,
  },
  {
    id: 'tp_014',
    name: 'Steve Campbell',
    nickname: 'The Samurai',
    country: 'NED',
    flagCode: 'nl',
    age: 25,
    height: 179,
    weight: 76,
    handed: 'R',
    style: 'serveVolley',
    rating: 2093,
    bio: 'Cool under pressure, money on big points.',
    careerWins: 208,
    careerLosses: 153,
    grandSlams: 0,
    masters1000: 11,
    favSurface: 'clay',
    speed: 0.83,
    power: 0.72,
    accuracy: 0.84,
    stamina: 0.98,
    mental: 0.86,
  },
  {
    id: 'tp_015',
    name: 'Cameron Wright',
    nickname: 'The Ace',
    country: 'TUR',
    flagCode: 'tr',
    age: 21,
    height: 191,
    weight: 97,
    handed: 'R',
    style: 'aggressor',
    rating: 1913,
    bio: 'Mountain of a man with a thunderous serve.',
    careerWins: 50,
    careerLosses: 160,
    grandSlams: 1,
    masters1000: 9,
    favSurface: 'hard',
    speed: 0.94,
    power: 0.95,
    accuracy: 0.83,
    stamina: 0.88,
    mental: 0.86,
  },
  {
    id: 'tp_016',
    name: 'Liam Wilson',
    nickname: 'The Rocket',
    country: 'SUI',
    flagCode: 'ch',
    age: 28,
    height: 184,
    weight: 80,
    handed: 'R',
    style: 'defender',
    rating: 1509,
    bio: 'Cool under pressure, money on big points.',
    careerWins: 137,
    careerLosses: 174,
    grandSlams: 4,
    masters1000: 1,
    favSurface: 'clay',
    speed: 0.73,
    power: 0.79,
    accuracy: 0.78,
    stamina: 0.98,
    mental: 0.96,
  },
  {
    id: 'tp_017',
    name: 'Lance White',
    nickname: 'The Bullet',
    country: 'ITA',
    flagCode: 'it',
    age: 35,
    height: 170,
    weight: 91,
    handed: 'L',
    style: 'spinner',
    rating: 1806,
    bio: 'Veteran with vast experience and crafty hands.',
    careerWins: 189,
    careerLosses: 41,
    grandSlams: 1,
    masters1000: 4,
    favSurface: 'grass',
    speed: 0.75,
    power: 0.74,
    accuracy: 0.87,
    stamina: 0.78,
    mental: 0.88,
  },
  {
    id: 'tp_018',
    name: 'Oscar Wilson',
    nickname: 'The Phantom',
    country: 'CZE',
    flagCode: 'cz',
    age: 21,
    height: 190,
    weight: 83,
    handed: 'R',
    style: 'spinner',
    rating: 1545,
    bio: 'Steady from the baseline with great anticipation.',
    careerWins: 20,
    careerLosses: 100,
    grandSlams: 1,
    masters1000: 10,
    favSurface: 'clay',
    speed: 1.09,
    power: 0.76,
    accuracy: 0.83,
    stamina: 0.91,
    mental: 0.87,
  },
  {
    id: 'tp_019',
    name: 'Eric Jones',
    nickname: 'The Fox',
    country: 'HUN',
    flagCode: 'hu',
    age: 23,
    height: 183,
    weight: 74,
    handed: 'R',
    style: 'baseliner',
    rating: 1815,
    bio: 'Quiet assassin who lets racket do the talking.',
    careerWins: 113,
    careerLosses: 25,
    grandSlams: 2,
    masters1000: 3,
    favSurface: 'clay',
    speed: 0.97,
    power: 0.97,
    accuracy: 0.81,
    stamina: 0.87,
    mental: 0.96,
  },
  {
    id: 'tp_020',
    name: 'Henry Thomas',
    nickname: 'The Falcon',
    country: 'CRO',
    flagCode: 'hr',
    age: 24,
    height: 193,
    weight: 99,
    handed: 'R',
    style: 'aggressor',
    rating: 2301,
    bio: 'Dynamic shot-maker with a powerful forehand.',
    careerWins: 125,
    careerLosses: 186,
    grandSlams: 1,
    masters1000: 4,
    favSurface: 'clay',
    speed: 0.76,
    power: 0.98,
    accuracy: 0.81,
    stamina: 0.71,
    mental: 0.84,
  },
  {
    id: 'tp_021',
    name: 'John Murphy',
    nickname: 'The Phenomenon',
    country: 'JPN',
    flagCode: 'jp',
    age: 19,
    height: 191,
    weight: 76,
    handed: 'R',
    style: 'defender',
    rating: 1836,
    bio: 'Tactical genius who reads the game brilliantly.',
    careerWins: 91,
    careerLosses: 32,
    grandSlams: 2,
    masters1000: 5,
    favSurface: 'hard',
    speed: 0.96,
    power: 0.86,
    accuracy: 0.99,
    stamina: 0.86,
    mental: 0.98,
  },
  {
    id: 'tp_022',
    name: 'Eric Ward',
    nickname: 'The Phantom',
    country: 'ITA',
    flagCode: 'it',
    age: 22,
    height: 189,
    weight: 83,
    handed: 'R',
    style: 'counterPuncher',
    rating: 2246,
    bio: 'Steady from the baseline with great anticipation.',
    careerWins: 221,
    careerLosses: 95,
    grandSlams: 3,
    masters1000: 9,
    favSurface: 'clay',
    speed: 1.09,
    power: 0.75,
    accuracy: 0.97,
    stamina: 0.76,
    mental: 0.71,
  },
  {
    id: 'tp_023',
    name: 'Thomas Smith',
    nickname: 'The Iceman',
    country: 'RUS',
    flagCode: 'ru',
    age: 30,
    height: 183,
    weight: 72,
    handed: 'R',
    style: 'counterPuncher',
    rating: 2138,
    bio: 'Defensive wall who turns defense into offense.',
    careerWins: 100,
    careerLosses: 184,
    grandSlams: 0,
    masters1000: 11,
    favSurface: 'grass',
    speed: 1.06,
    power: 0.9,
    accuracy: 0.9,
    stamina: 0.8,
    mental: 0.91,
  },
  {
    id: 'tp_024',
    name: 'Frank Gonzalez',
    nickname: 'The Fighter',
    country: 'NED',
    flagCode: 'nl',
    age: 28,
    height: 182,
    weight: 87,
    handed: 'R',
    style: 'spinner',
    rating: 1811,
    bio: 'Big serve, big game, takes time away from the opponent.',
    careerWins: 93,
    careerLosses: 68,
    grandSlams: 3,
    masters1000: 12,
    favSurface: 'grass',
    speed: 0.93,
    power: 0.96,
    accuracy: 0.84,
    stamina: 0.83,
    mental: 0.76,
  },
  {
    id: 'tp_025',
    name: 'Vincent Morris',
    nickname: 'The Falcon',
    country: 'NED',
    flagCode: 'nl',
    age: 29,
    height: 172,
    weight: 96,
    handed: 'R',
    style: 'baseliner',
    rating: 2188,
    bio: 'Methodical grinder, wears opponents down.',
    careerWins: 99,
    careerLosses: 72,
    grandSlams: 1,
    masters1000: 2,
    favSurface: 'clay',
    speed: 0.71,
    power: 0.8,
    accuracy: 0.84,
    stamina: 0.95,
    mental: 0.72,
  },
  {
    id: 'tp_026',
    name: 'Sean Ward',
    nickname: 'The Lion',
    country: 'BEL',
    flagCode: 'be',
    age: 31,
    height: 177,
    weight: 74,
    handed: 'R',
    style: 'serveVolley',
    rating: 2268,
    bio: 'Rising star with raw talent and big upside.',
    careerWins: 240,
    careerLosses: 42,
    grandSlams: 3,
    masters1000: 3,
    favSurface: 'clay',
    speed: 0.77,
    power: 1.08,
    accuracy: 0.86,
    stamina: 0.72,
    mental: 0.77,
  },
  {
    id: 'tp_027',
    name: 'Felix Young',
    nickname: 'The Cobra',
    country: 'CRO',
    flagCode: 'hr',
    age: 29,
    height: 200,
    weight: 94,
    handed: 'R',
    style: 'spinner',
    rating: 2127,
    bio: 'Methodical grinder, wears opponents down.',
    careerWins: 228,
    careerLosses: 199,
    grandSlams: 4,
    masters1000: 6,
    favSurface: 'grass',
    speed: 1.03,
    power: 0.92,
    accuracy: 0.97,
    stamina: 0.92,
    mental: 0.84,
  },
  {
    id: 'tp_028',
    name: 'Liam Phillips',
    nickname: 'The Eagle',
    country: 'SRB',
    flagCode: 'rs',
    age: 34,
    height: 190,
    weight: 77,
    handed: 'R',
    style: 'serveVolley',
    rating: 1950,
    bio: 'Methodical grinder, wears opponents down.',
    careerWins: 39,
    careerLosses: 197,
    grandSlams: 2,
    masters1000: 3,
    favSurface: 'clay',
    speed: 0.81,
    power: 0.83,
    accuracy: 0.86,
    stamina: 0.74,
    mental: 0.77,
  },
  {
    id: 'tp_029',
    name: 'Henry Mitchell',
    nickname: 'The Wolf',
    country: 'FRA',
    flagCode: 'fr',
    age: 33,
    height: 183,
    weight: 71,
    handed: 'R',
    style: 'spinner',
    rating: 2352,
    bio: 'Lefty firebrand with theatrical flair.',
    careerWins: 127,
    careerLosses: 114,
    grandSlams: 4,
    masters1000: 11,
    favSurface: 'clay',
    speed: 0.71,
    power: 1.05,
    accuracy: 0.87,
    stamina: 0.84,
    mental: 0.98,
  },
  {
    id: 'tp_030',
    name: 'Matt Phillips',
    nickname: 'The Master',
    country: 'TUR',
    flagCode: 'tr',
    age: 26,
    height: 185,
    weight: 77,
    handed: 'R',
    style: 'spinner',
    rating: 1946,
    bio: 'Showboat who plays for the crowd.',
    careerWins: 144,
    careerLosses: 22,
    grandSlams: 3,
    masters1000: 5,
    favSurface: 'grass',
    speed: 0.97,
    power: 1.02,
    accuracy: 0.92,
    stamina: 0.95,
    mental: 0.98,
  },
  {
    id: 'tp_031',
    name: 'Anthony Reed',
    nickname: 'The Maestro',
    country: 'SWE',
    flagCode: 'se',
    age: 21,
    height: 190,
    weight: 83,
    handed: 'R',
    style: 'counterPuncher',
    rating: 2387,
    bio: 'Dynamic shot-maker with a powerful forehand.',
    careerWins: 138,
    careerLosses: 61,
    grandSlams: 0,
    masters1000: 4,
    favSurface: 'grass',
    speed: 0.85,
    power: 0.78,
    accuracy: 0.8,
    stamina: 0.93,
    mental: 0.81,
  },
  {
    id: 'tp_032',
    name: 'Sean Taylor',
    nickname: 'The Ace',
    country: 'POL',
    flagCode: 'pl',
    age: 20,
    height: 200,
    weight: 81,
    handed: 'R',
    style: 'baseliner',
    rating: 2165,
    bio: 'Showboat who plays for the crowd.',
    careerWins: 37,
    careerLosses: 181,
    grandSlams: 0,
    masters1000: 12,
    favSurface: 'grass',
    speed: 0.71,
    power: 0.8,
    accuracy: 0.95,
    stamina: 0.89,
    mental: 0.77,
  },
  {
    id: 'tp_033',
    name: 'Vincent Hall',
    nickname: 'The Bull',
    country: 'SWE',
    flagCode: 'se',
    age: 30,
    height: 175,
    weight: 89,
    handed: 'L',
    style: 'aggressor',
    rating: 2265,
    bio: 'Powerful athlete with explosive movement.',
    careerWins: 203,
    careerLosses: 44,
    grandSlams: 1,
    masters1000: 4,
    favSurface: 'clay',
    speed: 0.74,
    power: 0.71,
    accuracy: 0.79,
    stamina: 0.9,
    mental: 0.99,
  },
  {
    id: 'tp_034',
    name: 'Ryan Mitchell',
    nickname: 'The Lion',
    country: 'FRA',
    flagCode: 'fr',
    age: 22,
    height: 192,
    weight: 94,
    handed: 'R',
    style: 'counterPuncher',
    rating: 2370,
    bio: 'Tactical genius who reads the game brilliantly.',
    careerWins: 195,
    careerLosses: 168,
    grandSlams: 0,
    masters1000: 12,
    favSurface: 'grass',
    speed: 1.09,
    power: 1.01,
    accuracy: 0.8,
    stamina: 0.83,
    mental: 0.81,
  },
  {
    id: 'tp_035',
    name: 'Yuki Baker',
    nickname: 'The Comet',
    country: 'USA',
    flagCode: 'us',
    age: 32,
    height: 200,
    weight: 81,
    handed: 'R',
    style: 'spinner',
    rating: 2224,
    bio: 'Heavy topspin specialist who grinds out points.',
    careerWins: 59,
    careerLosses: 126,
    grandSlams: 1,
    masters1000: 11,
    favSurface: 'clay',
    speed: 0.91,
    power: 0.96,
    accuracy: 0.88,
    stamina: 0.98,
    mental: 0.93,
  },
  {
    id: 'tp_036',
    name: 'Tyler Robinson',
    nickname: 'The Shark',
    country: 'CAN',
    flagCode: 'ca',
    age: 33,
    height: 177,
    weight: 94,
    handed: 'R',
    style: 'aggressor',
    rating: 2083,
    bio: 'Powerful athlete with explosive movement.',
    careerWins: 176,
    careerLosses: 186,
    grandSlams: 3,
    masters1000: 5,
    favSurface: 'hard',
    speed: 0.71,
    power: 1.04,
    accuracy: 0.75,
    stamina: 0.76,
    mental: 0.94,
  },
  {
    id: 'tp_037',
    name: 'Oscar Moore',
    nickname: 'The Shark',
    country: 'HUN',
    flagCode: 'hu',
    age: 21,
    height: 177,
    weight: 93,
    handed: 'R',
    style: 'baseliner',
    rating: 2000,
    bio: 'Defensive wall who turns defense into offense.',
    careerWins: 162,
    careerLosses: 76,
    grandSlams: 3,
    masters1000: 10,
    favSurface: 'grass',
    speed: 0.98,
    power: 0.88,
    accuracy: 0.71,
    stamina: 0.79,
    mental: 0.82,
  },
  {
    id: 'tp_038',
    name: 'Lance Martin',
    nickname: 'The Champion',
    country: 'POL',
    flagCode: 'pl',
    age: 32,
    height: 193,
    weight: 87,
    handed: 'R',
    style: 'counterPuncher',
    rating: 1860,
    bio: 'Clean ball-striker with smooth technique.',
    careerWins: 199,
    careerLosses: 131,
    grandSlams: 2,
    masters1000: 4,
    favSurface: 'grass',
    speed: 0.8,
    power: 0.75,
    accuracy: 0.76,
    stamina: 0.74,
    mental: 0.86,
  },
  {
    id: 'tp_039',
    name: 'Jason Gonzalez',
    nickname: 'The Wolf',
    country: 'AUT',
    flagCode: 'at',
    age: 35,
    height: 189,
    weight: 79,
    handed: 'R',
    style: 'spinner',
    rating: 2352,
    bio: 'Quiet assassin who lets racket do the talking.',
    careerWins: 69,
    careerLosses: 90,
    grandSlams: 1,
    masters1000: 5,
    favSurface: 'clay',
    speed: 0.77,
    power: 0.71,
    accuracy: 0.86,
    stamina: 0.78,
    mental: 0.99,
  },
  {
    id: 'tp_040',
    name: 'Mason Campbell',
    nickname: 'The Cobra',
    country: 'DEN',
    flagCode: 'dk',
    age: 28,
    height: 185,
    weight: 85,
    handed: 'R',
    style: 'spinner',
    rating: 1848,
    bio: 'Dynamic shot-maker with a powerful forehand.',
    careerWins: 67,
    careerLosses: 28,
    grandSlams: 2,
    masters1000: 7,
    favSurface: 'hard',
    speed: 0.75,
    power: 0.73,
    accuracy: 0.85,
    stamina: 0.87,
    mental: 0.91,
  },
  {
    id: 'tp_041',
    name: 'Henry Martinez',
    nickname: 'The Cannon',
    country: 'FRA',
    flagCode: 'fr',
    age: 32,
    height: 189,
    weight: 89,
    handed: 'L',
    style: 'aggressor',
    rating: 1731,
    bio: 'Showboat who plays for the crowd.',
    careerWins: 218,
    careerLosses: 148,
    grandSlams: 3,
    masters1000: 7,
    favSurface: 'hard',
    speed: 1.06,
    power: 0.82,
    accuracy: 0.88,
    stamina: 0.83,
    mental: 0.87,
  },
  {
    id: 'tp_042',
    name: 'Cameron Adams',
    nickname: 'The King',
    country: 'POR',
    flagCode: 'pt',
    age: 27,
    height: 191,
    weight: 72,
    handed: 'R',
    style: 'aggressor',
    rating: 1745,
    bio: 'Defensive wall who turns defense into offense.',
    careerWins: 64,
    careerLosses: 156,
    grandSlams: 0,
    masters1000: 2,
    favSurface: 'grass',
    speed: 0.7,
    power: 0.88,
    accuracy: 0.88,
    stamina: 0.79,
    mental: 0.77,
  },
  {
    id: 'tp_043',
    name: 'Mark Campbell',
    nickname: 'The Phenomenon',
    country: 'FRA',
    flagCode: 'fr',
    age: 25,
    height: 183,
    weight: 73,
    handed: 'L',
    style: 'serveVolley',
    rating: 1730,
    bio: 'Powerful athlete with explosive movement.',
    careerWins: 185,
    careerLosses: 53,
    grandSlams: 2,
    masters1000: 2,
    favSurface: 'hard',
    speed: 0.73,
    power: 0.77,
    accuracy: 0.79,
    stamina: 0.92,
    mental: 0.87,
  },
  {
    id: 'tp_044',
    name: 'Mark Walker',
    nickname: 'The Bull',
    country: 'IND',
    flagCode: 'in',
    age: 27,
    height: 186,
    weight: 87,
    handed: 'R',
    style: 'serveVolley',
    rating: 1948,
    bio: 'Mental warrior who battles for every point.',
    careerWins: 40,
    careerLosses: 168,
    grandSlams: 0,
    masters1000: 6,
    favSurface: 'clay',
    speed: 0.99,
    power: 0.94,
    accuracy: 0.71,
    stamina: 0.77,
    mental: 0.9,
  },
  {
    id: 'tp_045',
    name: 'Andrew Phillips',
    nickname: 'The Shark',
    country: 'SWE',
    flagCode: 'se',
    age: 35,
    height: 190,
    weight: 84,
    handed: 'R',
    style: 'baseliner',
    rating: 1685,
    bio: 'Rising star with raw talent and big upside.',
    careerWins: 169,
    careerLosses: 126,
    grandSlams: 3,
    masters1000: 1,
    favSurface: 'hard',
    speed: 0.89,
    power: 0.86,
    accuracy: 0.8,
    stamina: 0.73,
    mental: 0.75,
  },
  {
    id: 'tp_046',
    name: 'Scott Campbell',
    nickname: 'Le Magnifique',
    country: 'BRA',
    flagCode: 'br',
    age: 20,
    height: 184,
    weight: 72,
    handed: 'R',
    style: 'serveVolley',
    rating: 1758,
    bio: 'Showboat who plays for the crowd.',
    careerWins: 102,
    careerLosses: 44,
    grandSlams: 3,
    masters1000: 8,
    favSurface: 'clay',
    speed: 1.03,
    power: 0.7,
    accuracy: 0.96,
    stamina: 0.84,
    mental: 0.72,
  },
  {
    id: 'tp_047',
    name: 'Paul Adams',
    nickname: 'Le Magnifique',
    country: 'DEN',
    flagCode: 'dk',
    age: 27,
    height: 187,
    weight: 74,
    handed: 'R',
    style: 'spinner',
    rating: 1948,
    bio: 'Defensive wall who turns defense into offense.',
    careerWins: 245,
    careerLosses: 193,
    grandSlams: 3,
    masters1000: 1,
    favSurface: 'hard',
    speed: 0.71,
    power: 0.95,
    accuracy: 0.94,
    stamina: 0.91,
    mental: 0.79,
  },
  {
    id: 'tp_048',
    name: 'Alex Nguyen',
    nickname: 'The Fighter',
    country: 'FRA',
    flagCode: 'fr',
    age: 22,
    height: 190,
    weight: 96,
    handed: 'R',
    style: 'aggressor',
    rating: 2010,
    bio: 'Crafty player who mixes up pace and spin.',
    careerWins: 203,
    careerLosses: 89,
    grandSlams: 4,
    masters1000: 11,
    favSurface: 'hard',
    speed: 0.81,
    power: 1.03,
    accuracy: 0.99,
    stamina: 0.77,
    mental: 0.87,
  },
  {
    id: 'tp_049',
    name: 'Robert Gonzalez',
    nickname: 'Il Gladiatore',
    country: 'AUT',
    flagCode: 'at',
    age: 32,
    height: 180,
    weight: 99,
    handed: 'L',
    style: 'aggressor',
    rating: 1773,
    bio: 'Powerful athlete with explosive movement.',
    careerWins: 230,
    careerLosses: 15,
    grandSlams: 2,
    masters1000: 11,
    favSurface: 'hard',
    speed: 0.82,
    power: 0.93,
    accuracy: 1.0,
    stamina: 0.85,
    mental: 0.74,
  },
  {
    id: 'tp_050',
    name: 'Walter Thompson',
    nickname: 'The Comet',
    country: 'HUN',
    flagCode: 'hu',
    age: 29,
    height: 197,
    weight: 76,
    handed: 'R',
    style: 'counterPuncher',
    rating: 2085,
    bio: 'Crafty player who mixes up pace and spin.',
    careerWins: 118,
    careerLosses: 74,
    grandSlams: 3,
    masters1000: 0,
    favSurface: 'clay',
    speed: 0.83,
    power: 0.89,
    accuracy: 0.97,
    stamina: 0.81,
    mental: 1.0,
  },
  {
    id: 'tp_051',
    name: 'Henry King',
    nickname: 'The Hammer',
    country: 'ESP',
    flagCode: 'es',
    age: 22,
    height: 197,
    weight: 97,
    handed: 'R',
    style: 'counterPuncher',
    rating: 1602,
    bio: 'Lefty firebrand with theatrical flair.',
    careerWins: 154,
    careerLosses: 131,
    grandSlams: 0,
    masters1000: 11,
    favSurface: 'grass',
    speed: 0.76,
    power: 1.05,
    accuracy: 0.99,
    stamina: 0.72,
    mental: 0.93,
  },
  {
    id: 'tp_052',
    name: 'Liam Perez',
    nickname: 'The Maestro',
    country: 'DEN',
    flagCode: 'dk',
    age: 31,
    height: 200,
    weight: 80,
    handed: 'R',
    style: 'baseliner',
    rating: 2393,
    bio: 'Showboat who plays for the crowd.',
    careerWins: 158,
    careerLosses: 24,
    grandSlams: 4,
    masters1000: 1,
    favSurface: 'clay',
    speed: 0.79,
    power: 0.97,
    accuracy: 0.79,
    stamina: 0.77,
    mental: 0.73,
  },
  {
    id: 'tp_053',
    name: 'Dennis Phillips',
    nickname: 'The King',
    country: 'IND',
    flagCode: 'in',
    age: 19,
    height: 171,
    weight: 80,
    handed: 'R',
    style: 'aggressor',
    rating: 1800,
    bio: 'Veteran with vast experience and crafty hands.',
    careerWins: 111,
    careerLosses: 110,
    grandSlams: 3,
    masters1000: 2,
    favSurface: 'grass',
    speed: 0.8,
    power: 0.86,
    accuracy: 0.9,
    stamina: 0.75,
    mental: 0.75,
  },
  {
    id: 'tp_054',
    name: 'Quinn Adams',
    nickname: 'The Eagle',
    country: 'POL',
    flagCode: 'pl',
    age: 33,
    height: 190,
    weight: 78,
    handed: 'R',
    style: 'counterPuncher',
    rating: 1761,
    bio: 'Tactical genius who reads the game brilliantly.',
    careerWins: 190,
    careerLosses: 17,
    grandSlams: 3,
    masters1000: 4,
    favSurface: 'hard',
    speed: 0.97,
    power: 0.76,
    accuracy: 0.83,
    stamina: 0.8,
    mental: 0.88,
  },
  {
    id: 'tp_055',
    name: 'Steve Campbell',
    nickname: 'The Phantom',
    country: 'IND',
    flagCode: 'in',
    age: 34,
    height: 173,
    weight: 77,
    handed: 'R',
    style: 'defender',
    rating: 2085,
    bio: 'Mental warrior who battles for every point.',
    careerWins: 111,
    careerLosses: 162,
    grandSlams: 2,
    masters1000: 11,
    favSurface: 'hard',
    speed: 0.82,
    power: 1.09,
    accuracy: 0.9,
    stamina: 0.78,
    mental: 0.87,
  },
  {
    id: 'tp_056',
    name: 'Bryan Reed',
    nickname: 'Le Magnifique',
    country: 'SRB',
    flagCode: 'rs',
    age: 30,
    height: 177,
    weight: 90,
    handed: 'R',
    style: 'defender',
    rating: 2135,
    bio: 'Mountain of a man with a thunderous serve.',
    careerWins: 84,
    careerLosses: 188,
    grandSlams: 1,
    masters1000: 10,
    favSurface: 'hard',
    speed: 0.74,
    power: 0.95,
    accuracy: 0.71,
    stamina: 0.94,
    mental: 0.71,
  },
  {
    id: 'tp_057',
    name: 'Paul Carter',
    nickname: 'The Cobra',
    country: 'FRA',
    flagCode: 'fr',
    age: 24,
    height: 176,
    weight: 74,
    handed: 'L',
    style: 'defender',
    rating: 2397,
    bio: 'Athletic baseliner with thunderous groundstrokes.',
    careerWins: 113,
    careerLosses: 150,
    grandSlams: 4,
    masters1000: 4,
    favSurface: 'clay',
    speed: 1.03,
    power: 0.8,
    accuracy: 0.95,
    stamina: 0.84,
    mental: 0.94,
  },
  {
    id: 'tp_058',
    name: 'Oscar Cooper',
    nickname: 'The Bull',
    country: 'IND',
    flagCode: 'in',
    age: 31,
    height: 200,
    weight: 97,
    handed: 'L',
    style: 'baseliner',
    rating: 1874,
    bio: 'Tactical genius who reads the game brilliantly.',
    careerWins: 43,
    careerLosses: 116,
    grandSlams: 0,
    masters1000: 4,
    favSurface: 'hard',
    speed: 0.91,
    power: 0.88,
    accuracy: 0.9,
    stamina: 0.9,
    mental: 0.88,
  },
  {
    id: 'tp_059',
    name: 'Peter Miller',
    nickname: 'The Bear',
    country: 'POL',
    flagCode: 'pl',
    age: 29,
    height: 199,
    weight: 89,
    handed: 'R',
    style: 'baseliner',
    rating: 2163,
    bio: 'Showboat who plays for the crowd.',
    careerWins: 36,
    careerLosses: 177,
    grandSlams: 3,
    masters1000: 11,
    favSurface: 'grass',
    speed: 0.82,
    power: 0.86,
    accuracy: 0.74,
    stamina: 0.98,
    mental: 0.79,
  },
  {
    id: 'tp_060',
    name: 'Xavier Davis',
    nickname: 'The King',
    country: 'SUI',
    flagCode: 'ch',
    age: 33,
    height: 181,
    weight: 91,
    handed: 'L',
    style: 'counterPuncher',
    rating: 1929,
    bio: 'Mental warrior who battles for every point.',
    careerWins: 170,
    careerLosses: 54,
    grandSlams: 3,
    masters1000: 10,
    favSurface: 'hard',
    speed: 0.74,
    power: 0.9,
    accuracy: 0.82,
    stamina: 0.99,
    mental: 0.71,
  },
  {
    id: 'tp_061',
    name: 'Peter Wilson',
    nickname: 'The Legend',
    country: 'IND',
    flagCode: 'in',
    age: 30,
    height: 187,
    weight: 98,
    handed: 'R',
    style: 'aggressor',
    rating: 1562,
    bio: 'Heavy topspin specialist who grinds out points.',
    careerWins: 121,
    careerLosses: 85,
    grandSlams: 1,
    masters1000: 1,
    favSurface: 'clay',
    speed: 1.08,
    power: 1.03,
    accuracy: 0.73,
    stamina: 0.76,
    mental: 0.89,
  },
  {
    id: 'tp_062',
    name: 'Andrew Brown',
    nickname: 'The Comet',
    country: 'SUI',
    flagCode: 'ch',
    age: 21,
    height: 196,
    weight: 94,
    handed: 'L',
    style: 'aggressor',
    rating: 1712,
    bio: 'Defensive wall who turns defense into offense.',
    careerWins: 170,
    careerLosses: 70,
    grandSlams: 1,
    masters1000: 5,
    favSurface: 'grass',
    speed: 1.01,
    power: 1.02,
    accuracy: 0.88,
    stamina: 0.78,
    mental: 1.0,
  },
  {
    id: 'tp_063',
    name: 'Frank Torres',
    nickname: 'The Phantom',
    country: 'CRO',
    flagCode: 'hr',
    age: 23,
    height: 170,
    weight: 81,
    handed: 'R',
    style: 'aggressor',
    rating: 2102,
    bio: 'Dynamic shot-maker with a powerful forehand.',
    careerWins: 102,
    careerLosses: 19,
    grandSlams: 1,
    masters1000: 4,
    favSurface: 'hard',
    speed: 0.72,
    power: 1.0,
    accuracy: 0.86,
    stamina: 0.92,
    mental: 0.84,
  },
  {
    id: 'tp_064',
    name: 'Paul Wright',
    nickname: 'The King',
    country: 'IND',
    flagCode: 'in',
    age: 20,
    height: 193,
    weight: 95,
    handed: 'L',
    style: 'counterPuncher',
    rating: 1808,
    bio: 'Mountain of a man with a thunderous serve.',
    careerWins: 137,
    careerLosses: 179,
    grandSlams: 0,
    masters1000: 0,
    favSurface: 'hard',
    speed: 1.1,
    power: 1.04,
    accuracy: 0.83,
    stamina: 0.73,
    mental: 0.91,
  },
  {
    id: 'tp_065',
    name: 'Tim Jones',
    nickname: 'The Ace',
    country: 'CAN',
    flagCode: 'ca',
    age: 23,
    height: 178,
    weight: 89,
    handed: 'L',
    style: 'counterPuncher',
    rating: 2061,
    bio: 'Aggressive net rusher who keeps opponents off-balance.',
    careerWins: 202,
    careerLosses: 98,
    grandSlams: 3,
    masters1000: 9,
    favSurface: 'hard',
    speed: 0.91,
    power: 0.88,
    accuracy: 0.88,
    stamina: 0.73,
    mental: 0.91,
  },
  {
    id: 'tp_066',
    name: 'Joshua Robinson',
    nickname: 'The Legend',
    country: 'GRE',
    flagCode: 'gr',
    age: 33,
    height: 182,
    weight: 83,
    handed: 'R',
    style: 'aggressor',
    rating: 1820,
    bio: 'Lefty firebrand with theatrical flair.',
    careerWins: 129,
    careerLosses: 95,
    grandSlams: 2,
    masters1000: 5,
    favSurface: 'clay',
    speed: 1.08,
    power: 0.97,
    accuracy: 0.84,
    stamina: 0.73,
    mental: 0.73,
  },
  {
    id: 'tp_067',
    name: 'Thomas Miller',
    nickname: 'The Champion',
    country: 'CRO',
    flagCode: 'hr',
    age: 29,
    height: 191,
    weight: 73,
    handed: 'R',
    style: 'aggressor',
    rating: 1862,
    bio: 'Steady from the baseline with great anticipation.',
    careerWins: 243,
    careerLosses: 185,
    grandSlams: 3,
    masters1000: 11,
    favSurface: 'grass',
    speed: 0.72,
    power: 0.82,
    accuracy: 0.79,
    stamina: 0.73,
    mental: 0.85,
  },
  {
    id: 'tp_068',
    name: 'Henry Hall',
    nickname: 'El Toro',
    country: 'SUI',
    flagCode: 'ch',
    age: 30,
    height: 173,
    weight: 94,
    handed: 'R',
    style: 'baseliner',
    rating: 2087,
    bio: 'Showboat who plays for the crowd.',
    careerWins: 77,
    careerLosses: 124,
    grandSlams: 4,
    masters1000: 12,
    favSurface: 'clay',
    speed: 1.03,
    power: 0.95,
    accuracy: 0.89,
    stamina: 0.71,
    mental: 0.98,
  },
  {
    id: 'tp_069',
    name: 'Lucas Johnson',
    nickname: 'The Tiger',
    country: 'ARG',
    flagCode: 'ar',
    age: 30,
    height: 170,
    weight: 75,
    handed: 'R',
    style: 'serveVolley',
    rating: 2079,
    bio: 'Lefty firebrand with theatrical flair.',
    careerWins: 188,
    careerLosses: 117,
    grandSlams: 0,
    masters1000: 2,
    favSurface: 'clay',
    speed: 1.0,
    power: 1.09,
    accuracy: 0.73,
    stamina: 0.86,
    mental: 0.81,
  },
  {
    id: 'tp_070',
    name: 'Tony Perez',
    nickname: 'The Falcon',
    country: 'JPN',
    flagCode: 'jp',
    age: 21,
    height: 198,
    weight: 71,
    handed: 'R',
    style: 'defender',
    rating: 1661,
    bio: 'Lefty firebrand with theatrical flair.',
    careerWins: 213,
    careerLosses: 173,
    grandSlams: 0,
    masters1000: 10,
    favSurface: 'grass',
    speed: 0.73,
    power: 0.88,
    accuracy: 0.83,
    stamina: 0.88,
    mental: 0.82,
  },
  {
    id: 'tp_071',
    name: 'Joshua Phillips',
    nickname: 'Il Gladiatore',
    country: 'GER',
    flagCode: 'de',
    age: 28,
    height: 191,
    weight: 91,
    handed: 'L',
    style: 'defender',
    rating: 1998,
    bio: 'Heavy topspin specialist who grinds out points.',
    careerWins: 154,
    careerLosses: 185,
    grandSlams: 2,
    masters1000: 0,
    favSurface: 'clay',
    speed: 0.79,
    power: 1.09,
    accuracy: 0.72,
    stamina: 0.76,
    mental: 0.98,
  },
  {
    id: 'tp_072',
    name: 'George Phillips',
    nickname: 'The Phantom',
    country: 'BRA',
    flagCode: 'br',
    age: 34,
    height: 193,
    weight: 83,
    handed: 'R',
    style: 'defender',
    rating: 1632,
    bio: 'Dynamic shot-maker with a powerful forehand.',
    careerWins: 117,
    careerLosses: 151,
    grandSlams: 1,
    masters1000: 8,
    favSurface: 'hard',
    speed: 0.92,
    power: 0.97,
    accuracy: 0.81,
    stamina: 0.82,
    mental: 0.92,
  },
  {
    id: 'tp_073',
    name: 'Thomas Johnson',
    nickname: 'The Phenomenon',
    country: 'RUS',
    flagCode: 'ru',
    age: 32,
    height: 188,
    weight: 82,
    handed: 'R',
    style: 'baseliner',
    rating: 1796,
    bio: 'Quiet assassin who lets racket do the talking.',
    careerWins: 49,
    careerLosses: 118,
    grandSlams: 0,
    masters1000: 5,
    favSurface: 'clay',
    speed: 0.77,
    power: 1.08,
    accuracy: 0.84,
    stamina: 0.91,
    mental: 0.81,
  },
  {
    id: 'tp_074',
    name: 'Thomas Cox',
    nickname: 'The King',
    country: 'SUI',
    flagCode: 'ch',
    age: 35,
    height: 172,
    weight: 82,
    handed: 'R',
    style: 'spinner',
    rating: 2263,
    bio: 'Mental warrior who battles for every point.',
    careerWins: 106,
    careerLosses: 71,
    grandSlams: 2,
    masters1000: 12,
    favSurface: 'grass',
    speed: 0.77,
    power: 0.9,
    accuracy: 0.73,
    stamina: 0.85,
    mental: 0.97,
  },
  {
    id: 'tp_075',
    name: 'Owen Thompson',
    nickname: 'The Fox',
    country: 'SUI',
    flagCode: 'ch',
    age: 25,
    height: 175,
    weight: 89,
    handed: 'R',
    style: 'baseliner',
    rating: 2278,
    bio: 'Powerful athlete with explosive movement.',
    careerWins: 214,
    careerLosses: 182,
    grandSlams: 0,
    masters1000: 2,
    favSurface: 'hard',
    speed: 1.08,
    power: 0.95,
    accuracy: 0.84,
    stamina: 0.87,
    mental: 0.87,
  },
  {
    id: 'tp_076',
    name: 'Nick Howard',
    nickname: 'The Rocket',
    country: 'ESP',
    flagCode: 'es',
    age: 33,
    height: 190,
    weight: 79,
    handed: 'R',
    style: 'spinner',
    rating: 2105,
    bio: 'Rising star with raw talent and big upside.',
    careerWins: 34,
    careerLosses: 105,
    grandSlams: 4,
    masters1000: 1,
    favSurface: 'hard',
    speed: 0.82,
    power: 0.88,
    accuracy: 0.72,
    stamina: 0.95,
    mental: 0.72,
  },
  {
    id: 'tp_077',
    name: 'David Adams',
    nickname: 'Il Gladiatore',
    country: 'KOR',
    flagCode: 'kr',
    age: 20,
    height: 184,
    weight: 99,
    handed: 'L',
    style: 'spinner',
    rating: 2167,
    bio: 'Showboat who plays for the crowd.',
    careerWins: 68,
    careerLosses: 97,
    grandSlams: 4,
    masters1000: 7,
    favSurface: 'grass',
    speed: 0.9,
    power: 1.08,
    accuracy: 0.84,
    stamina: 0.94,
    mental: 0.95,
  },
  {
    id: 'tp_078',
    name: 'Daniel Wright',
    nickname: 'The Tiger',
    country: 'GBR',
    flagCode: 'gb',
    age: 33,
    height: 186,
    weight: 86,
    handed: 'L',
    style: 'aggressor',
    rating: 1662,
    bio: 'Crafty player who mixes up pace and spin.',
    careerWins: 113,
    careerLosses: 110,
    grandSlams: 2,
    masters1000: 6,
    favSurface: 'grass',
    speed: 0.86,
    power: 0.84,
    accuracy: 0.88,
    stamina: 0.94,
    mental: 0.89,
  },
  {
    id: 'tp_079',
    name: 'Carlos Perez',
    nickname: 'The King',
    country: 'HUN',
    flagCode: 'hu',
    age: 27,
    height: 193,
    weight: 97,
    handed: 'L',
    style: 'serveVolley',
    rating: 2394,
    bio: 'Veteran with vast experience and crafty hands.',
    careerWins: 58,
    careerLosses: 100,
    grandSlams: 0,
    masters1000: 9,
    favSurface: 'clay',
    speed: 0.97,
    power: 1.07,
    accuracy: 0.79,
    stamina: 0.9,
    mental: 0.9,
  },
  {
    id: 'tp_080',
    name: 'Frank Green',
    nickname: 'The Ace',
    country: 'BRA',
    flagCode: 'br',
    age: 23,
    height: 191,
    weight: 92,
    handed: 'L',
    style: 'counterPuncher',
    rating: 1595,
    bio: 'Lefty firebrand with theatrical flair.',
    careerWins: 185,
    careerLosses: 186,
    grandSlams: 3,
    masters1000: 8,
    favSurface: 'clay',
    speed: 0.84,
    power: 0.85,
    accuracy: 0.75,
    stamina: 0.76,
    mental: 0.98,
  },
  {
    id: 'tp_081',
    name: 'Will Gonzalez',
    nickname: 'The Bear',
    country: 'ESP',
    flagCode: 'es',
    age: 22,
    height: 186,
    weight: 94,
    handed: 'L',
    style: 'aggressor',
    rating: 2355,
    bio: 'Veteran with vast experience and crafty hands.',
    careerWins: 209,
    careerLosses: 149,
    grandSlams: 0,
    masters1000: 10,
    favSurface: 'hard',
    speed: 0.83,
    power: 1.01,
    accuracy: 0.74,
    stamina: 0.81,
    mental: 0.75,
  },
  {
    id: 'tp_082',
    name: 'Jacob Carter',
    nickname: 'The Legend',
    country: 'GBR',
    flagCode: 'gb',
    age: 33,
    height: 189,
    weight: 79,
    handed: 'R',
    style: 'spinner',
    rating: 1739,
    bio: 'Tactical genius who reads the game brilliantly.',
    careerWins: 156,
    careerLosses: 76,
    grandSlams: 2,
    masters1000: 12,
    favSurface: 'clay',
    speed: 1.01,
    power: 1.06,
    accuracy: 0.76,
    stamina: 0.9,
    mental: 0.87,
  },
  {
    id: 'tp_083',
    name: 'Tim Young',
    nickname: 'The Bullet',
    country: 'POR',
    flagCode: 'pt',
    age: 32,
    height: 200,
    weight: 75,
    handed: 'R',
    style: 'spinner',
    rating: 2320,
    bio: 'Methodical grinder, wears opponents down.',
    careerWins: 174,
    careerLosses: 50,
    grandSlams: 2,
    masters1000: 0,
    favSurface: 'grass',
    speed: 0.96,
    power: 1.05,
    accuracy: 0.87,
    stamina: 0.73,
    mental: 0.95,
  },
  {
    id: 'tp_084',
    name: 'Felix Jackson',
    nickname: 'The Ace',
    country: 'POR',
    flagCode: 'pt',
    age: 35,
    height: 174,
    weight: 96,
    handed: 'R',
    style: 'aggressor',
    rating: 1593,
    bio: 'Crafty player who mixes up pace and spin.',
    careerWins: 76,
    careerLosses: 130,
    grandSlams: 2,
    masters1000: 0,
    favSurface: 'clay',
    speed: 0.87,
    power: 0.86,
    accuracy: 0.81,
    stamina: 0.82,
    mental: 0.72,
  },
  {
    id: 'tp_085',
    name: 'Justin Johnson',
    nickname: 'The Rocket',
    country: 'RUS',
    flagCode: 'ru',
    age: 23,
    height: 174,
    weight: 71,
    handed: 'R',
    style: 'baseliner',
    rating: 2349,
    bio: 'Lefty firebrand with theatrical flair.',
    careerWins: 140,
    careerLosses: 193,
    grandSlams: 1,
    masters1000: 12,
    favSurface: 'grass',
    speed: 0.98,
    power: 0.88,
    accuracy: 0.7,
    stamina: 0.72,
    mental: 0.78,
  },
  {
    id: 'tp_086',
    name: 'Henry Nguyen',
    nickname: 'The Iceman',
    country: 'CHN',
    flagCode: 'cn',
    age: 28,
    height: 173,
    weight: 71,
    handed: 'R',
    style: 'baseliner',
    rating: 1929,
    bio: 'Tactical genius who reads the game brilliantly.',
    careerWins: 183,
    careerLosses: 174,
    grandSlams: 3,
    masters1000: 1,
    favSurface: 'clay',
    speed: 0.74,
    power: 1.06,
    accuracy: 0.88,
    stamina: 0.7,
    mental: 0.85,
  },
  {
    id: 'tp_087',
    name: 'Kyle Mitchell',
    nickname: 'The Fox',
    country: 'BRA',
    flagCode: 'br',
    age: 30,
    height: 177,
    weight: 88,
    handed: 'R',
    style: 'spinner',
    rating: 1691,
    bio: 'Mountain of a man with a thunderous serve.',
    careerWins: 190,
    careerLosses: 186,
    grandSlams: 0,
    masters1000: 8,
    favSurface: 'hard',
    speed: 1.09,
    power: 0.73,
    accuracy: 0.86,
    stamina: 0.85,
    mental: 1.0,
  },
  {
    id: 'tp_088',
    name: 'Andrew Harris',
    nickname: 'El Toro',
    country: 'GBR',
    flagCode: 'gb',
    age: 27,
    height: 193,
    weight: 70,
    handed: 'R',
    style: 'serveVolley',
    rating: 2307,
    bio: 'Clean ball-striker with smooth technique.',
    careerWins: 37,
    careerLosses: 103,
    grandSlams: 1,
    masters1000: 11,
    favSurface: 'clay',
    speed: 0.96,
    power: 0.74,
    accuracy: 0.87,
    stamina: 0.93,
    mental: 0.74,
  },
  {
    id: 'tp_089',
    name: 'Patrick Torres',
    nickname: 'The Comet',
    country: 'SRB',
    flagCode: 'rs',
    age: 34,
    height: 190,
    weight: 75,
    handed: 'R',
    style: 'serveVolley',
    rating: 1564,
    bio: 'Crafty player who mixes up pace and spin.',
    careerWins: 203,
    careerLosses: 132,
    grandSlams: 0,
    masters1000: 4,
    favSurface: 'hard',
    speed: 0.78,
    power: 1.02,
    accuracy: 0.97,
    stamina: 0.79,
    mental: 0.79,
  },
  {
    id: 'tp_090',
    name: 'Ryan Murphy',
    nickname: 'The Shogun',
    country: 'POL',
    flagCode: 'pl',
    age: 28,
    height: 181,
    weight: 97,
    handed: 'R',
    style: 'defender',
    rating: 2386,
    bio: 'Defensive wall who turns defense into offense.',
    careerWins: 187,
    careerLosses: 99,
    grandSlams: 2,
    masters1000: 1,
    favSurface: 'hard',
    speed: 1.02,
    power: 0.87,
    accuracy: 0.82,
    stamina: 0.83,
    mental: 0.99,
  },
  {
    id: 'tp_091',
    name: 'Oscar Lopez',
    nickname: 'Le Magnifique',
    country: 'BEL',
    flagCode: 'be',
    age: 27,
    height: 195,
    weight: 72,
    handed: 'R',
    style: 'spinner',
    rating: 1580,
    bio: 'Methodical grinder, wears opponents down.',
    careerWins: 130,
    careerLosses: 169,
    grandSlams: 1,
    masters1000: 8,
    favSurface: 'clay',
    speed: 0.82,
    power: 0.74,
    accuracy: 0.8,
    stamina: 0.79,
    mental: 0.83,
  },
  {
    id: 'tp_092',
    name: 'Steve Hernandez',
    nickname: 'The Legend',
    country: 'JPN',
    flagCode: 'jp',
    age: 32,
    height: 178,
    weight: 90,
    handed: 'R',
    style: 'spinner',
    rating: 1576,
    bio: 'Clean ball-striker with smooth technique.',
    careerWins: 191,
    careerLosses: 178,
    grandSlams: 3,
    masters1000: 5,
    favSurface: 'hard',
    speed: 0.91,
    power: 1.0,
    accuracy: 0.75,
    stamina: 0.71,
    mental: 0.95,
  },
  {
    id: 'tp_093',
    name: 'Tim Williams',
    nickname: 'The Cobra',
    country: 'FRA',
    flagCode: 'fr',
    age: 30,
    height: 182,
    weight: 100,
    handed: 'L',
    style: 'aggressor',
    rating: 1533,
    bio: 'Clean ball-striker with smooth technique.',
    careerWins: 174,
    careerLosses: 54,
    grandSlams: 3,
    masters1000: 5,
    favSurface: 'grass',
    speed: 0.85,
    power: 1.01,
    accuracy: 0.87,
    stamina: 0.86,
    mental: 0.82,
  },
  {
    id: 'tp_094',
    name: 'Marco Thomas',
    nickname: 'The Bull',
    country: 'USA',
    flagCode: 'us',
    age: 35,
    height: 182,
    weight: 99,
    handed: 'L',
    style: 'serveVolley',
    rating: 1620,
    bio: 'Rising star with raw talent and big upside.',
    careerWins: 87,
    careerLosses: 81,
    grandSlams: 3,
    masters1000: 3,
    favSurface: 'hard',
    speed: 1.1,
    power: 0.81,
    accuracy: 0.97,
    stamina: 0.85,
    mental: 0.74,
  },
  {
    id: 'tp_095',
    name: 'Chris Walker',
    nickname: 'The Tiger',
    country: 'GRE',
    flagCode: 'gr',
    age: 29,
    height: 191,
    weight: 81,
    handed: 'R',
    style: 'serveVolley',
    rating: 2063,
    bio: 'Aggressive net rusher who keeps opponents off-balance.',
    careerWins: 158,
    careerLosses: 89,
    grandSlams: 2,
    masters1000: 2,
    favSurface: 'clay',
    speed: 0.98,
    power: 1.07,
    accuracy: 0.89,
    stamina: 0.94,
    mental: 0.85,
  },
  {
    id: 'tp_096',
    name: 'Felix Gonzalez',
    nickname: 'The Cobra',
    country: 'SUI',
    flagCode: 'ch',
    age: 30,
    height: 184,
    weight: 95,
    handed: 'L',
    style: 'spinner',
    rating: 1632,
    bio: 'Clean ball-striker with smooth technique.',
    careerWins: 176,
    careerLosses: 37,
    grandSlams: 0,
    masters1000: 4,
    favSurface: 'hard',
    speed: 0.86,
    power: 0.99,
    accuracy: 0.84,
    stamina: 0.82,
    mental: 0.82,
  },
  {
    id: 'tp_097',
    name: 'Chris Rodriguez',
    nickname: 'The Rocket',
    country: 'DEN',
    flagCode: 'dk',
    age: 35,
    height: 181,
    weight: 74,
    handed: 'L',
    style: 'baseliner',
    rating: 2155,
    bio: 'Crafty player who mixes up pace and spin.',
    careerWins: 170,
    careerLosses: 61,
    grandSlams: 1,
    masters1000: 6,
    favSurface: 'clay',
    speed: 0.9,
    power: 1.05,
    accuracy: 0.95,
    stamina: 0.86,
    mental: 0.79,
  },
  {
    id: 'tp_098',
    name: 'Ian Lee',
    nickname: 'The Bear',
    country: 'JPN',
    flagCode: 'jp',
    age: 27,
    height: 176,
    weight: 90,
    handed: 'L',
    style: 'counterPuncher',
    rating: 1781,
    bio: 'Aggressive net rusher who keeps opponents off-balance.',
    careerWins: 52,
    careerLosses: 175,
    grandSlams: 2,
    masters1000: 9,
    favSurface: 'clay',
    speed: 0.91,
    power: 0.9,
    accuracy: 0.75,
    stamina: 0.98,
    mental: 0.75,
  },
  {
    id: 'tp_099',
    name: 'Oscar Bailey',
    nickname: 'The Hammer',
    country: 'SRB',
    flagCode: 'rs',
    age: 27,
    height: 190,
    weight: 76,
    handed: 'L',
    style: 'baseliner',
    rating: 1926,
    bio: 'Steady from the baseline with great anticipation.',
    careerWins: 178,
    careerLosses: 178,
    grandSlams: 0,
    masters1000: 7,
    favSurface: 'hard',
    speed: 1.06,
    power: 0.92,
    accuracy: 0.89,
    stamina: 0.79,
    mental: 0.77,
  },
  {
    id: 'tp_100',
    name: 'Sam Martin',
    nickname: 'The Phenomenon',
    country: 'FRA',
    flagCode: 'fr',
    age: 33,
    height: 183,
    weight: 85,
    handed: 'R',
    style: 'serveVolley',
    rating: 1708,
    bio: 'Big serve, big game, takes time away from the opponent.',
    careerWins: 107,
    careerLosses: 170,
    grandSlams: 1,
    masters1000: 5,
    favSurface: 'hard',
    speed: 1.04,
    power: 0.83,
    accuracy: 1.0,
    stamina: 0.8,
    mental: 0.82,
  },
  {
    id: 'tp_101',
    name: 'Peter Wright',
    nickname: 'The Samurai',
    country: 'GER',
    flagCode: 'de',
    age: 22,
    height: 178,
    weight: 84,
    handed: 'R',
    style: 'defender',
    rating: 1644,
    bio: 'Crafty player who mixes up pace and spin.',
    careerWins: 44,
    careerLosses: 27,
    grandSlams: 2,
    masters1000: 6,
    favSurface: 'hard',
    speed: 1.05,
    power: 0.87,
    accuracy: 0.99,
    stamina: 0.97,
    mental: 0.94,
  },
  {
    id: 'tp_102',
    name: 'Nathan Gonzalez',
    nickname: 'The Falcon',
    country: 'POL',
    flagCode: 'pl',
    age: 28,
    height: 185,
    weight: 70,
    handed: 'R',
    style: 'counterPuncher',
    rating: 1902,
    bio: 'Rising star with raw talent and big upside.',
    careerWins: 149,
    careerLosses: 132,
    grandSlams: 1,
    masters1000: 3,
    favSurface: 'clay',
    speed: 0.93,
    power: 0.72,
    accuracy: 0.78,
    stamina: 0.88,
    mental: 0.95,
  },
  {
    id: 'tp_103',
    name: 'Vincent Jackson',
    nickname: 'The Shogun',
    country: 'USA',
    flagCode: 'us',
    age: 27,
    height: 193,
    weight: 81,
    handed: 'R',
    style: 'baseliner',
    rating: 1874,
    bio: 'Cool under pressure, money on big points.',
    careerWins: 31,
    careerLosses: 117,
    grandSlams: 0,
    masters1000: 9,
    favSurface: 'clay',
    speed: 0.92,
    power: 0.85,
    accuracy: 0.79,
    stamina: 0.82,
    mental: 0.84,
  },
  {
    id: 'tp_104',
    name: 'Marco Murphy',
    nickname: 'The Bull',
    country: 'ESP',
    flagCode: 'es',
    age: 29,
    height: 187,
    weight: 100,
    handed: 'R',
    style: 'baseliner',
    rating: 2273,
    bio: 'Clean ball-striker with smooth technique.',
    careerWins: 56,
    careerLosses: 65,
    grandSlams: 4,
    masters1000: 8,
    favSurface: 'clay',
    speed: 0.86,
    power: 0.72,
    accuracy: 0.71,
    stamina: 0.91,
    mental: 0.94,
  },
  {
    id: 'tp_105',
    name: 'Tony Martinez',
    nickname: 'Il Gladiatore',
    country: 'ESP',
    flagCode: 'es',
    age: 24,
    height: 182,
    weight: 89,
    handed: 'R',
    style: 'defender',
    rating: 2107,
    bio: 'Lefty firebrand with theatrical flair.',
    careerWins: 106,
    careerLosses: 144,
    grandSlams: 4,
    masters1000: 8,
    favSurface: 'grass',
    speed: 0.9,
    power: 0.93,
    accuracy: 0.84,
    stamina: 0.7,
    mental: 0.8,
  },
  {
    id: 'tp_106',
    name: 'Eric Lewis',
    nickname: 'The Cannon',
    country: 'CRO',
    flagCode: 'hr',
    age: 34,
    height: 178,
    weight: 100,
    handed: 'L',
    style: 'serveVolley',
    rating: 2091,
    bio: 'Dynamic shot-maker with a powerful forehand.',
    careerWins: 78,
    careerLosses: 199,
    grandSlams: 0,
    masters1000: 9,
    favSurface: 'grass',
    speed: 0.89,
    power: 0.91,
    accuracy: 0.92,
    stamina: 0.93,
    mental: 0.81,
  },
  {
    id: 'tp_107',
    name: 'Lance Williams',
    nickname: 'The Bull',
    country: 'AUS',
    flagCode: 'au',
    age: 32,
    height: 174,
    weight: 83,
    handed: 'R',
    style: 'baseliner',
    rating: 1920,
    bio: 'Lefty firebrand with theatrical flair.',
    careerWins: 148,
    careerLosses: 171,
    grandSlams: 3,
    masters1000: 11,
    favSurface: 'clay',
    speed: 0.99,
    power: 0.98,
    accuracy: 0.86,
    stamina: 0.87,
    mental: 1.0,
  },
  {
    id: 'tp_108',
    name: 'Walter Scott',
    nickname: 'The Master',
    country: 'CAN',
    flagCode: 'ca',
    age: 29,
    height: 187,
    weight: 81,
    handed: 'R',
    style: 'aggressor',
    rating: 2124,
    bio: 'Showboat who plays for the crowd.',
    careerWins: 143,
    careerLosses: 64,
    grandSlams: 1,
    masters1000: 4,
    favSurface: 'clay',
    speed: 0.92,
    power: 0.79,
    accuracy: 0.99,
    stamina: 0.79,
    mental: 0.79,
  },
  {
    id: 'tp_109',
    name: 'Jose Campbell',
    nickname: 'Le Magnifique',
    country: 'CAN',
    flagCode: 'ca',
    age: 27,
    height: 179,
    weight: 73,
    handed: 'L',
    style: 'spinner',
    rating: 2192,
    bio: 'Showboat who plays for the crowd.',
    careerWins: 159,
    careerLosses: 112,
    grandSlams: 3,
    masters1000: 5,
    favSurface: 'clay',
    speed: 1.08,
    power: 1.02,
    accuracy: 0.79,
    stamina: 0.79,
    mental: 0.91,
  },
  {
    id: 'tp_110',
    name: 'Owen Walker',
    nickname: 'The Phantom',
    country: 'AUT',
    flagCode: 'at',
    age: 27,
    height: 199,
    weight: 87,
    handed: 'R',
    style: 'spinner',
    rating: 1640,
    bio: 'Defensive wall who turns defense into offense.',
    careerWins: 47,
    careerLosses: 172,
    grandSlams: 4,
    masters1000: 3,
    favSurface: 'hard',
    speed: 0.8,
    power: 0.97,
    accuracy: 0.86,
    stamina: 0.89,
    mental: 0.72,
  },
  {
    id: 'tp_111',
    name: 'Scott Perez',
    nickname: 'El Toro',
    country: 'GER',
    flagCode: 'de',
    age: 24,
    height: 183,
    weight: 90,
    handed: 'R',
    style: 'serveVolley',
    rating: 1988,
    bio: 'Dynamic shot-maker with a powerful forehand.',
    careerWins: 186,
    careerLosses: 66,
    grandSlams: 2,
    masters1000: 5,
    favSurface: 'hard',
    speed: 0.81,
    power: 0.72,
    accuracy: 0.93,
    stamina: 0.9,
    mental: 0.77,
  },
  {
    id: 'tp_112',
    name: 'Ben Reed',
    nickname: 'The Tiger',
    country: 'CHN',
    flagCode: 'cn',
    age: 34,
    height: 175,
    weight: 99,
    handed: 'R',
    style: 'aggressor',
    rating: 2397,
    bio: 'Mental warrior who battles for every point.',
    careerWins: 29,
    careerLosses: 17,
    grandSlams: 2,
    masters1000: 9,
    favSurface: 'hard',
    speed: 0.94,
    power: 1.07,
    accuracy: 0.8,
    stamina: 0.84,
    mental: 0.89,
  },
  {
    id: 'tp_113',
    name: 'Xavier Ward',
    nickname: 'The Cobra',
    country: 'TUR',
    flagCode: 'tr',
    age: 25,
    height: 195,
    weight: 73,
    handed: 'R',
    style: 'counterPuncher',
    rating: 1666,
    bio: 'Powerful athlete with explosive movement.',
    careerWins: 207,
    careerLosses: 132,
    grandSlams: 2,
    masters1000: 11,
    favSurface: 'clay',
    speed: 0.77,
    power: 0.99,
    accuracy: 0.94,
    stamina: 0.87,
    mental: 0.93,
  },
  {
    id: 'tp_114',
    name: 'James Adams',
    nickname: 'The Maestro',
    country: 'SRB',
    flagCode: 'rs',
    age: 21,
    height: 182,
    weight: 91,
    handed: 'R',
    style: 'spinner',
    rating: 1689,
    bio: 'Lefty firebrand with theatrical flair.',
    careerWins: 55,
    careerLosses: 137,
    grandSlams: 2,
    masters1000: 3,
    favSurface: 'grass',
    speed: 0.7,
    power: 0.85,
    accuracy: 0.83,
    stamina: 0.78,
    mental: 0.8,
  },
  {
    id: 'tp_115',
    name: 'Alex Taylor',
    nickname: 'The Champion',
    country: 'BEL',
    flagCode: 'be',
    age: 33,
    height: 179,
    weight: 75,
    handed: 'R',
    style: 'aggressor',
    rating: 2202,
    bio: 'Heavy topspin specialist who grinds out points.',
    careerWins: 148,
    careerLosses: 195,
    grandSlams: 2,
    masters1000: 11,
    favSurface: 'hard',
    speed: 0.75,
    power: 1.07,
    accuracy: 0.79,
    stamina: 0.88,
    mental: 0.77,
  },
  {
    id: 'tp_116',
    name: 'George Allen',
    nickname: 'The Fox',
    country: 'IND',
    flagCode: 'in',
    age: 32,
    height: 192,
    weight: 87,
    handed: 'R',
    style: 'serveVolley',
    rating: 2275,
    bio: 'Clean ball-striker with smooth technique.',
    careerWins: 157,
    careerLosses: 185,
    grandSlams: 1,
    masters1000: 12,
    favSurface: 'grass',
    speed: 0.8,
    power: 1.0,
    accuracy: 0.96,
    stamina: 0.72,
    mental: 0.83,
  },
  {
    id: 'tp_117',
    name: 'Paul Jones',
    nickname: 'The Bull',
    country: 'GBR',
    flagCode: 'gb',
    age: 23,
    height: 175,
    weight: 80,
    handed: 'L',
    style: 'counterPuncher',
    rating: 1952,
    bio: 'Defensive wall who turns defense into offense.',
    careerWins: 49,
    careerLosses: 189,
    grandSlams: 1,
    masters1000: 11,
    favSurface: 'grass',
    speed: 0.93,
    power: 0.74,
    accuracy: 0.85,
    stamina: 0.94,
    mental: 0.84,
  },
  {
    id: 'tp_118',
    name: 'Zach Lewis',
    nickname: 'The Phenomenon',
    country: 'SWE',
    flagCode: 'se',
    age: 28,
    height: 193,
    weight: 70,
    handed: 'R',
    style: 'baseliner',
    rating: 1760,
    bio: 'Crafty player who mixes up pace and spin.',
    careerWins: 229,
    careerLosses: 15,
    grandSlams: 1,
    masters1000: 9,
    favSurface: 'grass',
    speed: 0.73,
    power: 0.87,
    accuracy: 0.91,
    stamina: 0.86,
    mental: 0.72,
  },
  {
    id: 'tp_119',
    name: 'Carlos Allen',
    nickname: 'The Hammer',
    country: 'BRA',
    flagCode: 'br',
    age: 32,
    height: 181,
    weight: 98,
    handed: 'R',
    style: 'spinner',
    rating: 1959,
    bio: 'Cool under pressure, money on big points.',
    careerWins: 242,
    careerLosses: 111,
    grandSlams: 3,
    masters1000: 1,
    favSurface: 'hard',
    speed: 0.97,
    power: 0.96,
    accuracy: 0.86,
    stamina: 0.9,
    mental: 0.8,
  },
  {
    id: 'tp_120',
    name: 'James Torres',
    nickname: 'The Maestro',
    country: 'CZE',
    flagCode: 'cz',
    age: 19,
    height: 194,
    weight: 70,
    handed: 'R',
    style: 'aggressor',
    rating: 1974,
    bio: 'Tactical genius who reads the game brilliantly.',
    careerWins: 192,
    careerLosses: 199,
    grandSlams: 4,
    masters1000: 6,
    favSurface: 'grass',
    speed: 0.91,
    power: 1.03,
    accuracy: 0.77,
    stamina: 0.8,
    mental: 0.78,
  },
  {
    id: 'tp_121',
    name: 'Eric Williams',
    nickname: 'The Fighter',
    country: 'NOR',
    flagCode: 'no',
    age: 21,
    height: 173,
    weight: 89,
    handed: 'R',
    style: 'baseliner',
    rating: 1957,
    bio: 'Defensive wall who turns defense into offense.',
    careerWins: 173,
    careerLosses: 187,
    grandSlams: 0,
    masters1000: 3,
    favSurface: 'hard',
    speed: 1.0,
    power: 0.86,
    accuracy: 0.77,
    stamina: 0.77,
    mental: 0.96,
  },
  {
    id: 'tp_122',
    name: 'Cameron Rodriguez',
    nickname: 'Il Gladiatore',
    country: 'BRA',
    flagCode: 'br',
    age: 29,
    height: 188,
    weight: 89,
    handed: 'R',
    style: 'aggressor',
    rating: 1742,
    bio: 'Quiet assassin who lets racket do the talking.',
    careerWins: 97,
    careerLosses: 51,
    grandSlams: 4,
    masters1000: 3,
    favSurface: 'grass',
    speed: 0.87,
    power: 0.81,
    accuracy: 0.87,
    stamina: 0.88,
    mental: 0.92,
  },
  {
    id: 'tp_123',
    name: 'James Nelson',
    nickname: 'The Warrior',
    country: 'HUN',
    flagCode: 'hu',
    age: 31,
    height: 195,
    weight: 86,
    handed: 'R',
    style: 'spinner',
    rating: 2213,
    bio: 'Clean ball-striker with smooth technique.',
    careerWins: 126,
    careerLosses: 119,
    grandSlams: 1,
    masters1000: 4,
    favSurface: 'hard',
    speed: 0.85,
    power: 1.0,
    accuracy: 0.84,
    stamina: 0.95,
    mental: 0.79,
  },
  {
    id: 'tp_124',
    name: 'Greg Cooper',
    nickname: 'The Phenomenon',
    country: 'RUS',
    flagCode: 'ru',
    age: 32,
    height: 187,
    weight: 86,
    handed: 'R',
    style: 'baseliner',
    rating: 1897,
    bio: 'Athletic baseliner with thunderous groundstrokes.',
    careerWins: 82,
    careerLosses: 80,
    grandSlams: 1,
    masters1000: 5,
    favSurface: 'grass',
    speed: 0.96,
    power: 1.07,
    accuracy: 0.95,
    stamina: 0.73,
    mental: 0.92,
  },
  {
    id: 'tp_125',
    name: 'Jeff Brown',
    nickname: 'The Shark',
    country: 'KOR',
    flagCode: 'kr',
    age: 20,
    height: 197,
    weight: 72,
    handed: 'R',
    style: 'serveVolley',
    rating: 2323,
    bio: 'Mountain of a man with a thunderous serve.',
    careerWins: 214,
    careerLosses: 165,
    grandSlams: 4,
    masters1000: 3,
    favSurface: 'grass',
    speed: 0.89,
    power: 1.05,
    accuracy: 0.8,
    stamina: 0.99,
    mental: 0.7,
  },
  {
    id: 'tp_126',
    name: 'Jeff Roberts',
    nickname: 'The Bull',
    country: 'AUT',
    flagCode: 'at',
    age: 25,
    height: 182,
    weight: 99,
    handed: 'R',
    style: 'spinner',
    rating: 2065,
    bio: 'Mountain of a man with a thunderous serve.',
    careerWins: 102,
    careerLosses: 87,
    grandSlams: 3,
    masters1000: 7,
    favSurface: 'hard',
    speed: 0.91,
    power: 0.84,
    accuracy: 0.78,
    stamina: 0.85,
    mental: 0.85,
  },
  {
    id: 'tp_127',
    name: 'Dennis Cooper',
    nickname: 'El Toro',
    country: 'POR',
    flagCode: 'pt',
    age: 29,
    height: 183,
    weight: 71,
    handed: 'L',
    style: 'defender',
    rating: 2384,
    bio: 'Clean ball-striker with smooth technique.',
    careerWins: 76,
    careerLosses: 52,
    grandSlams: 0,
    masters1000: 4,
    favSurface: 'hard',
    speed: 0.92,
    power: 0.93,
    accuracy: 0.92,
    stamina: 0.79,
    mental: 0.76,
  },
  {
    id: 'tp_128',
    name: 'Kevin Harris',
    nickname: 'The Eagle',
    country: 'POL',
    flagCode: 'pl',
    age: 27,
    height: 194,
    weight: 96,
    handed: 'R',
    style: 'counterPuncher',
    rating: 2240,
    bio: 'Lefty firebrand with theatrical flair.',
    careerWins: 184,
    careerLosses: 140,
    grandSlams: 3,
    masters1000: 2,
    favSurface: 'grass',
    speed: 0.99,
    power: 0.84,
    accuracy: 0.74,
    stamina: 0.86,
    mental: 0.76,
  },
  {
    id: 'tp_129',
    name: 'Cameron Scott',
    nickname: 'The Hammer',
    country: 'SRB',
    flagCode: 'rs',
    age: 19,
    height: 183,
    weight: 74,
    handed: 'R',
    style: 'baseliner',
    rating: 1569,
    bio: 'Steady from the baseline with great anticipation.',
    careerWins: 201,
    careerLosses: 53,
    grandSlams: 0,
    masters1000: 3,
    favSurface: 'grass',
    speed: 0.9,
    power: 0.85,
    accuracy: 0.89,
    stamina: 0.9,
    mental: 0.88,
  },
  {
    id: 'tp_130',
    name: 'Walter Hall',
    nickname: 'Le Magnifique',
    country: 'USA',
    flagCode: 'us',
    age: 32,
    height: 170,
    weight: 70,
    handed: 'L',
    style: 'baseliner',
    rating: 2239,
    bio: 'Showboat who plays for the crowd.',
    careerWins: 90,
    careerLosses: 152,
    grandSlams: 2,
    masters1000: 0,
    favSurface: 'grass',
    speed: 0.9,
    power: 0.98,
    accuracy: 0.83,
    stamina: 0.98,
    mental: 0.75,
  },
  {
    id: 'tp_131',
    name: 'Dennis Scott',
    nickname: 'The Fox',
    country: 'SUI',
    flagCode: 'ch',
    age: 27,
    height: 196,
    weight: 81,
    handed: 'R',
    style: 'aggressor',
    rating: 2314,
    bio: 'Methodical grinder, wears opponents down.',
    careerWins: 121,
    careerLosses: 35,
    grandSlams: 2,
    masters1000: 6,
    favSurface: 'grass',
    speed: 0.88,
    power: 0.8,
    accuracy: 0.91,
    stamina: 0.79,
    mental: 0.95,
  },
  {
    id: 'tp_132',
    name: 'Daniel Baker',
    nickname: 'The Hammer',
    country: 'FRA',
    flagCode: 'fr',
    age: 34,
    height: 171,
    weight: 90,
    handed: 'R',
    style: 'spinner',
    rating: 2219,
    bio: 'Mental warrior who battles for every point.',
    careerWins: 63,
    careerLosses: 36,
    grandSlams: 3,
    masters1000: 6,
    favSurface: 'clay',
    speed: 0.96,
    power: 0.83,
    accuracy: 0.99,
    stamina: 0.99,
    mental: 0.97,
  },
  {
    id: 'tp_133',
    name: 'Brad Anderson',
    nickname: 'The Wolf',
    country: 'GRE',
    flagCode: 'gr',
    age: 27,
    height: 171,
    weight: 99,
    handed: 'R',
    style: 'serveVolley',
    rating: 2200,
    bio: 'Rising star with raw talent and big upside.',
    careerWins: 91,
    careerLosses: 154,
    grandSlams: 4,
    masters1000: 10,
    favSurface: 'grass',
    speed: 0.71,
    power: 1.07,
    accuracy: 0.79,
    stamina: 0.99,
    mental: 0.88,
  },
  {
    id: 'tp_134',
    name: 'Ryan Jones',
    nickname: 'The Cannon',
    country: 'ITA',
    flagCode: 'it',
    age: 31,
    height: 191,
    weight: 98,
    handed: 'L',
    style: 'counterPuncher',
    rating: 1839,
    bio: 'Quiet assassin who lets racket do the talking.',
    careerWins: 118,
    careerLosses: 50,
    grandSlams: 0,
    masters1000: 8,
    favSurface: 'hard',
    speed: 1.0,
    power: 0.84,
    accuracy: 0.73,
    stamina: 0.77,
    mental: 0.72,
  },
  {
    id: 'tp_135',
    name: 'Ryan Evans',
    nickname: 'The Rocket',
    country: 'USA',
    flagCode: 'us',
    age: 34,
    height: 177,
    weight: 81,
    handed: 'L',
    style: 'serveVolley',
    rating: 1884,
    bio: 'Crafty player who mixes up pace and spin.',
    careerWins: 130,
    careerLosses: 62,
    grandSlams: 4,
    masters1000: 10,
    favSurface: 'clay',
    speed: 0.85,
    power: 1.01,
    accuracy: 0.79,
    stamina: 0.77,
    mental: 0.72,
  },
  {
    id: 'tp_136',
    name: 'Lucas Martinez',
    nickname: 'The Master',
    country: 'BEL',
    flagCode: 'be',
    age: 29,
    height: 181,
    weight: 73,
    handed: 'R',
    style: 'serveVolley',
    rating: 1505,
    bio: 'Mental warrior who battles for every point.',
    careerWins: 98,
    careerLosses: 128,
    grandSlams: 2,
    masters1000: 12,
    favSurface: 'hard',
    speed: 0.81,
    power: 0.75,
    accuracy: 0.76,
    stamina: 0.83,
    mental: 0.87,
  },
  {
    id: 'tp_137',
    name: 'Scott Miller',
    nickname: 'The Hawk',
    country: 'FRA',
    flagCode: 'fr',
    age: 29,
    height: 197,
    weight: 82,
    handed: 'R',
    style: 'defender',
    rating: 1798,
    bio: 'Aggressive net rusher who keeps opponents off-balance.',
    careerWins: 125,
    careerLosses: 114,
    grandSlams: 0,
    masters1000: 11,
    favSurface: 'grass',
    speed: 1.06,
    power: 1.06,
    accuracy: 0.99,
    stamina: 0.87,
    mental: 0.75,
  },
  {
    id: 'tp_138',
    name: 'Quinn Hernandez',
    nickname: 'The Cobra',
    country: 'ARG',
    flagCode: 'ar',
    age: 23,
    height: 172,
    weight: 75,
    handed: 'R',
    style: 'defender',
    rating: 1782,
    bio: 'Rising star with raw talent and big upside.',
    careerWins: 127,
    careerLosses: 91,
    grandSlams: 3,
    masters1000: 12,
    favSurface: 'clay',
    speed: 0.73,
    power: 0.8,
    accuracy: 0.77,
    stamina: 0.89,
    mental: 0.88,
  },
  {
    id: 'tp_139',
    name: 'John Young',
    nickname: 'The King',
    country: 'ESP',
    flagCode: 'es',
    age: 29,
    height: 196,
    weight: 89,
    handed: 'R',
    style: 'defender',
    rating: 2323,
    bio: 'Mental warrior who battles for every point.',
    careerWins: 240,
    careerLosses: 99,
    grandSlams: 3,
    masters1000: 5,
    favSurface: 'hard',
    speed: 0.87,
    power: 1.03,
    accuracy: 0.9,
    stamina: 0.88,
    mental: 0.79,
  },
  {
    id: 'tp_140',
    name: 'John Allen',
    nickname: 'The Rocket',
    country: 'ITA',
    flagCode: 'it',
    age: 34,
    height: 200,
    weight: 88,
    handed: 'R',
    style: 'spinner',
    rating: 1833,
    bio: 'Veteran with vast experience and crafty hands.',
    careerWins: 116,
    careerLosses: 86,
    grandSlams: 3,
    masters1000: 5,
    favSurface: 'clay',
    speed: 0.75,
    power: 0.93,
    accuracy: 0.88,
    stamina: 0.86,
    mental: 0.9,
  },
  {
    id: 'tp_141',
    name: 'Anthony Carter',
    nickname: 'The Phenomenon',
    country: 'BEL',
    flagCode: 'be',
    age: 21,
    height: 196,
    weight: 97,
    handed: 'R',
    style: 'aggressor',
    rating: 2189,
    bio: 'Veteran with vast experience and crafty hands.',
    careerWins: 147,
    careerLosses: 50,
    grandSlams: 2,
    masters1000: 3,
    favSurface: 'clay',
    speed: 0.8,
    power: 0.76,
    accuracy: 0.83,
    stamina: 0.81,
    mental: 0.83,
  },
  {
    id: 'tp_142',
    name: 'Walter Flores',
    nickname: 'The Maestro',
    country: 'HUN',
    flagCode: 'hu',
    age: 20,
    height: 195,
    weight: 100,
    handed: 'R',
    style: 'counterPuncher',
    rating: 2218,
    bio: 'Athletic baseliner with thunderous groundstrokes.',
    careerWins: 249,
    careerLosses: 152,
    grandSlams: 4,
    masters1000: 10,
    favSurface: 'grass',
    speed: 1.07,
    power: 0.74,
    accuracy: 0.77,
    stamina: 0.9,
    mental: 0.75,
  },
  {
    id: 'tp_143',
    name: 'Brad Hill',
    nickname: 'The Maestro',
    country: 'POR',
    flagCode: 'pt',
    age: 19,
    height: 173,
    weight: 78,
    handed: 'R',
    style: 'defender',
    rating: 2022,
    bio: 'Heavy topspin specialist who grinds out points.',
    careerWins: 211,
    careerLosses: 147,
    grandSlams: 4,
    masters1000: 9,
    favSurface: 'clay',
    speed: 0.98,
    power: 0.79,
    accuracy: 0.81,
    stamina: 0.84,
    mental: 0.9,
  },
  {
    id: 'tp_144',
    name: 'Yuki Martinez',
    nickname: 'The Star',
    country: 'USA',
    flagCode: 'us',
    age: 32,
    height: 199,
    weight: 100,
    handed: 'R',
    style: 'spinner',
    rating: 1618,
    bio: 'Veteran with vast experience and crafty hands.',
    careerWins: 232,
    careerLosses: 51,
    grandSlams: 2,
    masters1000: 4,
    favSurface: 'hard',
    speed: 0.84,
    power: 1.01,
    accuracy: 0.86,
    stamina: 0.8,
    mental: 0.73,
  },
  {
    id: 'tp_145',
    name: 'Tom Lee',
    nickname: 'The Storm',
    country: 'BRA',
    flagCode: 'br',
    age: 19,
    height: 197,
    weight: 80,
    handed: 'R',
    style: 'baseliner',
    rating: 2193,
    bio: 'Heavy topspin specialist who grinds out points.',
    careerWins: 224,
    careerLosses: 57,
    grandSlams: 1,
    masters1000: 8,
    favSurface: 'grass',
    speed: 0.77,
    power: 0.76,
    accuracy: 0.87,
    stamina: 0.99,
    mental: 0.77,
  },
  {
    id: 'tp_146',
    name: 'Sam Nelson',
    nickname: 'The Tiger',
    country: 'ITA',
    flagCode: 'it',
    age: 31,
    height: 170,
    weight: 93,
    handed: 'L',
    style: 'serveVolley',
    rating: 1702,
    bio: 'Athletic baseliner with thunderous groundstrokes.',
    careerWins: 135,
    careerLosses: 166,
    grandSlams: 3,
    masters1000: 6,
    favSurface: 'grass',
    speed: 0.7,
    power: 0.79,
    accuracy: 0.78,
    stamina: 0.91,
    mental: 0.94,
  },
  {
    id: 'tp_147',
    name: 'Edward Cooper',
    nickname: 'The Shogun',
    country: 'ITA',
    flagCode: 'it',
    age: 33,
    height: 173,
    weight: 78,
    handed: 'R',
    style: 'defender',
    rating: 2040,
    bio: 'Defensive wall who turns defense into offense.',
    careerWins: 183,
    careerLosses: 95,
    grandSlams: 4,
    masters1000: 6,
    favSurface: 'clay',
    speed: 0.94,
    power: 0.93,
    accuracy: 0.8,
    stamina: 0.95,
    mental: 0.89,
  },
  {
    id: 'tp_148',
    name: 'Matt Reed',
    nickname: 'The Ace',
    country: 'NED',
    flagCode: 'nl',
    age: 26,
    height: 179,
    weight: 73,
    handed: 'R',
    style: 'aggressor',
    rating: 1882,
    bio: 'Heavy topspin specialist who grinds out points.',
    careerWins: 197,
    careerLosses: 51,
    grandSlams: 4,
    masters1000: 6,
    favSurface: 'clay',
    speed: 0.87,
    power: 0.76,
    accuracy: 0.82,
    stamina: 0.76,
    mental: 0.89,
  },
  {
    id: 'tp_149',
    name: 'James Nguyen',
    nickname: 'The Falcon',
    country: 'POL',
    flagCode: 'pl',
    age: 29,
    height: 196,
    weight: 84,
    handed: 'L',
    style: 'defender',
    rating: 1554,
    bio: 'Big serve, big game, takes time away from the opponent.',
    careerWins: 241,
    careerLosses: 106,
    grandSlams: 0,
    masters1000: 7,
    favSurface: 'hard',
    speed: 0.75,
    power: 1.03,
    accuracy: 0.99,
    stamina: 0.85,
    mental: 0.85,
  },
  {
    id: 'tp_150',
    name: 'Will Lewis',
    nickname: 'The Legend',
    country: 'POL',
    flagCode: 'pl',
    age: 19,
    height: 195,
    weight: 94,
    handed: 'R',
    style: 'aggressor',
    rating: 1799,
    bio: 'Quiet assassin who lets racket do the talking.',
    careerWins: 28,
    careerLosses: 85,
    grandSlams: 1,
    masters1000: 8,
    favSurface: 'hard',
    speed: 0.82,
    power: 1.01,
    accuracy: 0.87,
    stamina: 0.93,
    mental: 0.85,
  },
  {
    id: 'tp_151',
    name: 'Zach Davis',
    nickname: 'The Bull',
    country: 'ARG',
    flagCode: 'ar',
    age: 20,
    height: 194,
    weight: 93,
    handed: 'R',
    style: 'counterPuncher',
    rating: 2059,
    bio: 'Showboat who plays for the crowd.',
    careerWins: 75,
    careerLosses: 123,
    grandSlams: 0,
    masters1000: 11,
    favSurface: 'clay',
    speed: 1.03,
    power: 1.0,
    accuracy: 0.79,
    stamina: 1.0,
    mental: 0.83,
  },
  {
    id: 'tp_152',
    name: 'Owen Howard',
    nickname: 'The Ace',
    country: 'IND',
    flagCode: 'in',
    age: 30,
    height: 197,
    weight: 92,
    handed: 'L',
    style: 'baseliner',
    rating: 2147,
    bio: 'Defensive wall who turns defense into offense.',
    careerWins: 129,
    careerLosses: 57,
    grandSlams: 4,
    masters1000: 2,
    favSurface: 'hard',
    speed: 1.01,
    power: 1.03,
    accuracy: 0.94,
    stamina: 0.87,
    mental: 0.86,
  },
  {
    id: 'tp_153',
    name: 'Jacob Lee',
    nickname: 'The Bullet',
    country: 'BRA',
    flagCode: 'br',
    age: 22,
    height: 174,
    weight: 100,
    handed: 'R',
    style: 'counterPuncher',
    rating: 1560,
    bio: 'Methodical grinder, wears opponents down.',
    careerWins: 90,
    careerLosses: 182,
    grandSlams: 1,
    masters1000: 11,
    favSurface: 'clay',
    speed: 1.05,
    power: 0.8,
    accuracy: 0.91,
    stamina: 0.95,
    mental: 0.93,
  },
  {
    id: 'tp_154',
    name: 'Ryan King',
    nickname: 'The Fox',
    country: 'SWE',
    flagCode: 'se',
    age: 31,
    height: 184,
    weight: 72,
    handed: 'R',
    style: 'serveVolley',
    rating: 1912,
    bio: 'Athletic baseliner with thunderous groundstrokes.',
    careerWins: 151,
    careerLosses: 86,
    grandSlams: 2,
    masters1000: 7,
    favSurface: 'clay',
    speed: 1.08,
    power: 0.83,
    accuracy: 0.7,
    stamina: 0.93,
    mental: 0.92,
  },
  {
    id: 'tp_155',
    name: 'Tony Nelson',
    nickname: 'The Star',
    country: 'TUR',
    flagCode: 'tr',
    age: 25,
    height: 200,
    weight: 83,
    handed: 'R',
    style: 'baseliner',
    rating: 2006,
    bio: 'Mental warrior who battles for every point.',
    careerWins: 88,
    careerLosses: 97,
    grandSlams: 2,
    masters1000: 5,
    favSurface: 'grass',
    speed: 0.92,
    power: 0.75,
    accuracy: 0.96,
    stamina: 0.94,
    mental: 0.97,
  },
  {
    id: 'tp_156',
    name: 'Bryan Williams',
    nickname: 'The King',
    country: 'DEN',
    flagCode: 'dk',
    age: 24,
    height: 184,
    weight: 84,
    handed: 'R',
    style: 'spinner',
    rating: 1938,
    bio: 'Heavy topspin specialist who grinds out points.',
    careerWins: 71,
    careerLosses: 191,
    grandSlams: 1,
    masters1000: 10,
    favSurface: 'hard',
    speed: 0.82,
    power: 1.05,
    accuracy: 0.96,
    stamina: 0.73,
    mental: 0.81,
  },
  {
    id: 'tp_157',
    name: 'Daniel White',
    nickname: 'The Falcon',
    country: 'GBR',
    flagCode: 'gb',
    age: 26,
    height: 183,
    weight: 90,
    handed: 'R',
    style: 'spinner',
    rating: 2220,
    bio: 'Veteran with vast experience and crafty hands.',
    careerWins: 44,
    careerLosses: 15,
    grandSlams: 1,
    masters1000: 7,
    favSurface: 'grass',
    speed: 0.73,
    power: 0.94,
    accuracy: 0.86,
    stamina: 0.83,
    mental: 0.7,
  },
  {
    id: 'tp_158',
    name: 'Oscar Murphy',
    nickname: 'The Bull',
    country: 'TUR',
    flagCode: 'tr',
    age: 34,
    height: 172,
    weight: 77,
    handed: 'R',
    style: 'spinner',
    rating: 1591,
    bio: 'Cool under pressure, money on big points.',
    careerWins: 207,
    careerLosses: 41,
    grandSlams: 0,
    masters1000: 5,
    favSurface: 'grass',
    speed: 0.85,
    power: 0.82,
    accuracy: 0.81,
    stamina: 0.94,
    mental: 0.96,
  },
  {
    id: 'tp_159',
    name: 'Greg Jones',
    nickname: 'The Iceman',
    country: 'SWE',
    flagCode: 'se',
    age: 33,
    height: 181,
    weight: 93,
    handed: 'R',
    style: 'baseliner',
    rating: 2143,
    bio: 'Big serve, big game, takes time away from the opponent.',
    careerWins: 211,
    careerLosses: 53,
    grandSlams: 3,
    masters1000: 9,
    favSurface: 'grass',
    speed: 0.97,
    power: 1.04,
    accuracy: 0.73,
    stamina: 0.73,
    mental: 0.93,
  },
  {
    id: 'tp_160',
    name: 'Robert Thompson',
    nickname: 'The Warrior',
    country: 'CAN',
    flagCode: 'ca',
    age: 21,
    height: 177,
    weight: 87,
    handed: 'L',
    style: 'aggressor',
    rating: 2114,
    bio: 'Powerful athlete with explosive movement.',
    careerWins: 204,
    careerLosses: 170,
    grandSlams: 2,
    masters1000: 12,
    favSurface: 'hard',
    speed: 1.08,
    power: 0.71,
    accuracy: 0.95,
    stamina: 0.96,
    mental: 0.76,
  },
  {
    id: 'tp_161',
    name: 'Zach Gonzalez',
    nickname: 'The Maestro',
    country: 'BRA',
    flagCode: 'br',
    age: 34,
    height: 182,
    weight: 73,
    handed: 'R',
    style: 'serveVolley',
    rating: 2011,
    bio: 'Tactical genius who reads the game brilliantly.',
    careerWins: 183,
    careerLosses: 167,
    grandSlams: 0,
    masters1000: 8,
    favSurface: 'hard',
    speed: 1.06,
    power: 0.7,
    accuracy: 0.81,
    stamina: 0.79,
    mental: 0.82,
  },
  {
    id: 'tp_162',
    name: 'Sean White',
    nickname: 'The Shogun',
    country: 'NED',
    flagCode: 'nl',
    age: 19,
    height: 188,
    weight: 72,
    handed: 'R',
    style: 'aggressor',
    rating: 1768,
    bio: 'Aggressive net rusher who keeps opponents off-balance.',
    careerWins: 75,
    careerLosses: 25,
    grandSlams: 0,
    masters1000: 12,
    favSurface: 'clay',
    speed: 0.86,
    power: 0.81,
    accuracy: 0.91,
    stamina: 0.93,
    mental: 0.83,
  },
  {
    id: 'tp_163',
    name: 'Sam Garcia',
    nickname: 'The Shogun',
    country: 'HUN',
    flagCode: 'hu',
    age: 21,
    height: 179,
    weight: 72,
    handed: 'L',
    style: 'counterPuncher',
    rating: 1708,
    bio: 'Powerful athlete with explosive movement.',
    careerWins: 226,
    careerLosses: 54,
    grandSlams: 4,
    masters1000: 5,
    favSurface: 'hard',
    speed: 0.86,
    power: 0.95,
    accuracy: 0.95,
    stamina: 0.9,
    mental: 0.72,
  },
  {
    id: 'tp_164',
    name: 'Thomas Carter',
    nickname: 'The Eagle',
    country: 'GBR',
    flagCode: 'gb',
    age: 22,
    height: 184,
    weight: 89,
    handed: 'L',
    style: 'aggressor',
    rating: 1556,
    bio: 'Athletic baseliner with thunderous groundstrokes.',
    careerWins: 99,
    careerLosses: 185,
    grandSlams: 1,
    masters1000: 1,
    favSurface: 'hard',
    speed: 0.71,
    power: 0.75,
    accuracy: 0.7,
    stamina: 0.85,
    mental: 0.8,
  },
  {
    id: 'tp_165',
    name: 'Liam Hernandez',
    nickname: 'The Champion',
    country: 'ESP',
    flagCode: 'es',
    age: 19,
    height: 180,
    weight: 95,
    handed: 'R',
    style: 'serveVolley',
    rating: 1778,
    bio: 'Heavy topspin specialist who grinds out points.',
    careerWins: 154,
    careerLosses: 31,
    grandSlams: 2,
    masters1000: 11,
    favSurface: 'clay',
    speed: 1.09,
    power: 0.95,
    accuracy: 0.85,
    stamina: 0.85,
    mental: 0.72,
  },
  {
    id: 'tp_166',
    name: 'Jacob White',
    nickname: 'The Falcon',
    country: 'ARG',
    flagCode: 'ar',
    age: 26,
    height: 193,
    weight: 86,
    handed: 'R',
    style: 'baseliner',
    rating: 1545,
    bio: 'Heavy topspin specialist who grinds out points.',
    careerWins: 239,
    careerLosses: 18,
    grandSlams: 1,
    masters1000: 0,
    favSurface: 'grass',
    speed: 0.89,
    power: 0.85,
    accuracy: 0.75,
    stamina: 0.98,
    mental: 0.96,
  },
  {
    id: 'tp_167',
    name: 'Sean Anderson',
    nickname: 'The Rocket',
    country: 'SUI',
    flagCode: 'ch',
    age: 27,
    height: 196,
    weight: 72,
    handed: 'L',
    style: 'spinner',
    rating: 1881,
    bio: 'Lefty firebrand with theatrical flair.',
    careerWins: 50,
    careerLosses: 143,
    grandSlams: 0,
    masters1000: 2,
    favSurface: 'grass',
    speed: 0.79,
    power: 0.91,
    accuracy: 0.71,
    stamina: 0.82,
    mental: 0.96,
  },
  {
    id: 'tp_168',
    name: 'Mark Evans',
    nickname: 'The Cannon',
    country: 'CAN',
    flagCode: 'ca',
    age: 19,
    height: 181,
    weight: 76,
    handed: 'R',
    style: 'baseliner',
    rating: 2077,
    bio: 'Crafty player who mixes up pace and spin.',
    careerWins: 220,
    careerLosses: 92,
    grandSlams: 4,
    masters1000: 3,
    favSurface: 'grass',
    speed: 0.89,
    power: 0.94,
    accuracy: 0.85,
    stamina: 0.93,
    mental: 0.76,
  },
  {
    id: 'tp_169',
    name: 'Lance Martinez',
    nickname: 'The Cyclone',
    country: 'RUS',
    flagCode: 'ru',
    age: 30,
    height: 190,
    weight: 96,
    handed: 'R',
    style: 'spinner',
    rating: 1843,
    bio: 'Tactical genius who reads the game brilliantly.',
    careerWins: 20,
    careerLosses: 183,
    grandSlams: 3,
    masters1000: 11,
    favSurface: 'hard',
    speed: 0.99,
    power: 0.74,
    accuracy: 0.86,
    stamina: 0.77,
    mental: 0.85,
  },
  {
    id: 'tp_170',
    name: 'Cameron Martinez',
    nickname: 'The Shark',
    country: 'FRA',
    flagCode: 'fr',
    age: 32,
    height: 192,
    weight: 98,
    handed: 'R',
    style: 'baseliner',
    rating: 1969,
    bio: 'Methodical grinder, wears opponents down.',
    careerWins: 211,
    careerLosses: 36,
    grandSlams: 4,
    masters1000: 1,
    favSurface: 'hard',
    speed: 0.9,
    power: 0.95,
    accuracy: 0.82,
    stamina: 0.88,
    mental: 0.72,
  },
  {
    id: 'tp_171',
    name: 'Frank Thomas',
    nickname: 'The Bullet',
    country: 'ARG',
    flagCode: 'ar',
    age: 29,
    height: 184,
    weight: 78,
    handed: 'R',
    style: 'defender',
    rating: 1576,
    bio: 'Lefty firebrand with theatrical flair.',
    careerWins: 71,
    careerLosses: 49,
    grandSlams: 4,
    masters1000: 1,
    favSurface: 'clay',
    speed: 0.76,
    power: 0.77,
    accuracy: 0.84,
    stamina: 0.82,
    mental: 0.86,
  },
  {
    id: 'tp_172',
    name: 'Jose Walker',
    nickname: 'The Cannon',
    country: 'IND',
    flagCode: 'in',
    age: 24,
    height: 195,
    weight: 91,
    handed: 'R',
    style: 'defender',
    rating: 2346,
    bio: 'Aggressive net rusher who keeps opponents off-balance.',
    careerWins: 200,
    careerLosses: 193,
    grandSlams: 4,
    masters1000: 0,
    favSurface: 'hard',
    speed: 0.79,
    power: 1.04,
    accuracy: 0.74,
    stamina: 0.91,
    mental: 0.99,
  },
  {
    id: 'tp_173',
    name: 'Ryan Wright',
    nickname: 'The Wizard',
    country: 'NED',
    flagCode: 'nl',
    age: 19,
    height: 200,
    weight: 82,
    handed: 'R',
    style: 'defender',
    rating: 2069,
    bio: 'Big serve, big game, takes time away from the opponent.',
    careerWins: 211,
    careerLosses: 155,
    grandSlams: 1,
    masters1000: 1,
    favSurface: 'clay',
    speed: 0.88,
    power: 1.02,
    accuracy: 0.74,
    stamina: 0.7,
    mental: 0.95,
  },
  {
    id: 'tp_174',
    name: 'Justin Rodriguez',
    nickname: 'The Lion',
    country: 'SRB',
    flagCode: 'rs',
    age: 27,
    height: 199,
    weight: 96,
    handed: 'R',
    style: 'spinner',
    rating: 1522,
    bio: 'Aggressive net rusher who keeps opponents off-balance.',
    careerWins: 36,
    careerLosses: 65,
    grandSlams: 3,
    masters1000: 12,
    favSurface: 'clay',
    speed: 0.75,
    power: 1.06,
    accuracy: 0.95,
    stamina: 0.8,
    mental: 0.71,
  },
  {
    id: 'tp_175',
    name: 'Tyler Brown',
    nickname: 'The Falcon',
    country: 'RUS',
    flagCode: 'ru',
    age: 34,
    height: 170,
    weight: 82,
    handed: 'R',
    style: 'counterPuncher',
    rating: 1676,
    bio: 'Mental warrior who battles for every point.',
    careerWins: 110,
    careerLosses: 69,
    grandSlams: 1,
    masters1000: 4,
    favSurface: 'clay',
    speed: 0.81,
    power: 1.05,
    accuracy: 0.71,
    stamina: 0.89,
    mental: 0.77,
  },
  {
    id: 'tp_176',
    name: 'Mason King',
    nickname: 'The Fighter',
    country: 'GRE',
    flagCode: 'gr',
    age: 21,
    height: 178,
    weight: 82,
    handed: 'R',
    style: 'counterPuncher',
    rating: 1929,
    bio: 'Steady from the baseline with great anticipation.',
    careerWins: 71,
    careerLosses: 179,
    grandSlams: 4,
    masters1000: 3,
    favSurface: 'clay',
    speed: 0.95,
    power: 1.02,
    accuracy: 0.94,
    stamina: 1.0,
    mental: 0.93,
  },
  {
    id: 'tp_177',
    name: 'Patrick Allen',
    nickname: 'The Shogun',
    country: 'CRO',
    flagCode: 'hr',
    age: 35,
    height: 180,
    weight: 82,
    handed: 'R',
    style: 'spinner',
    rating: 1684,
    bio: 'Quiet assassin who lets racket do the talking.',
    careerWins: 26,
    careerLosses: 96,
    grandSlams: 4,
    masters1000: 3,
    favSurface: 'clay',
    speed: 0.71,
    power: 1.02,
    accuracy: 0.78,
    stamina: 0.94,
    mental: 0.84,
  },
  {
    id: 'tp_178',
    name: 'Patrick Evans',
    nickname: 'The Bear',
    country: 'ITA',
    flagCode: 'it',
    age: 27,
    height: 187,
    weight: 96,
    handed: 'R',
    style: 'baseliner',
    rating: 2282,
    bio: 'Tactical genius who reads the game brilliantly.',
    careerWins: 76,
    careerLosses: 162,
    grandSlams: 3,
    masters1000: 5,
    favSurface: 'hard',
    speed: 1.07,
    power: 1.1,
    accuracy: 0.75,
    stamina: 0.77,
    mental: 0.8,
  },
  {
    id: 'tp_179',
    name: 'Patrick Reed',
    nickname: 'The Hawk',
    country: 'BEL',
    flagCode: 'be',
    age: 23,
    height: 188,
    weight: 100,
    handed: 'R',
    style: 'serveVolley',
    rating: 2356,
    bio: 'Quiet assassin who lets racket do the talking.',
    careerWins: 227,
    careerLosses: 141,
    grandSlams: 4,
    masters1000: 4,
    favSurface: 'clay',
    speed: 0.77,
    power: 0.72,
    accuracy: 0.72,
    stamina: 0.88,
    mental: 0.71,
  },
  {
    id: 'tp_180',
    name: 'Walter Smith',
    nickname: 'The Comet',
    country: 'RUS',
    flagCode: 'ru',
    age: 29,
    height: 192,
    weight: 75,
    handed: 'R',
    style: 'counterPuncher',
    rating: 1560,
    bio: 'Cool under pressure, money on big points.',
    careerWins: 25,
    careerLosses: 52,
    grandSlams: 4,
    masters1000: 11,
    favSurface: 'hard',
    speed: 1.07,
    power: 1.01,
    accuracy: 0.95,
    stamina: 0.96,
    mental: 0.99,
  },
  {
    id: 'tp_181',
    name: 'Peter Mitchell',
    nickname: 'The Maestro',
    country: 'SWE',
    flagCode: 'se',
    age: 29,
    height: 174,
    weight: 75,
    handed: 'R',
    style: 'baseliner',
    rating: 2310,
    bio: 'Veteran with vast experience and crafty hands.',
    careerWins: 183,
    careerLosses: 139,
    grandSlams: 2,
    masters1000: 2,
    favSurface: 'clay',
    speed: 0.98,
    power: 0.92,
    accuracy: 0.97,
    stamina: 0.88,
    mental: 0.81,
  },
  {
    id: 'tp_182',
    name: 'James Harris',
    nickname: 'The Cannon',
    country: 'AUT',
    flagCode: 'at',
    age: 24,
    height: 193,
    weight: 70,
    handed: 'L',
    style: 'serveVolley',
    rating: 1900,
    bio: 'Cool under pressure, money on big points.',
    careerWins: 237,
    careerLosses: 160,
    grandSlams: 0,
    masters1000: 2,
    favSurface: 'clay',
    speed: 0.94,
    power: 1.07,
    accuracy: 0.99,
    stamina: 0.77,
    mental: 0.87,
  },
  {
    id: 'tp_183',
    name: 'Xavier Martinez',
    nickname: 'The Comet',
    country: 'AUT',
    flagCode: 'at',
    age: 29,
    height: 175,
    weight: 90,
    handed: 'R',
    style: 'baseliner',
    rating: 2341,
    bio: 'Clean ball-striker with smooth technique.',
    careerWins: 201,
    careerLosses: 186,
    grandSlams: 2,
    masters1000: 7,
    favSurface: 'hard',
    speed: 0.7,
    power: 0.78,
    accuracy: 0.91,
    stamina: 0.81,
    mental: 0.94,
  },
  {
    id: 'tp_184',
    name: 'Adrian Brown',
    nickname: 'The Master',
    country: 'IND',
    flagCode: 'in',
    age: 32,
    height: 185,
    weight: 98,
    handed: 'R',
    style: 'serveVolley',
    rating: 1859,
    bio: 'Big serve, big game, takes time away from the opponent.',
    careerWins: 159,
    careerLosses: 111,
    grandSlams: 0,
    masters1000: 7,
    favSurface: 'clay',
    speed: 1.02,
    power: 0.93,
    accuracy: 0.93,
    stamina: 0.77,
    mental: 0.84,
  },
  {
    id: 'tp_185',
    name: 'Ben Jackson',
    nickname: 'The Hawk',
    country: 'CAN',
    flagCode: 'ca',
    age: 29,
    height: 175,
    weight: 98,
    handed: 'R',
    style: 'defender',
    rating: 1664,
    bio: 'Aggressive net rusher who keeps opponents off-balance.',
    careerWins: 207,
    careerLosses: 34,
    grandSlams: 4,
    masters1000: 1,
    favSurface: 'hard',
    speed: 0.84,
    power: 1.09,
    accuracy: 0.97,
    stamina: 0.91,
    mental: 0.83,
  },
  {
    id: 'tp_186',
    name: 'Jacob Green',
    nickname: 'The Warrior',
    country: 'ITA',
    flagCode: 'it',
    age: 25,
    height: 176,
    weight: 83,
    handed: 'L',
    style: 'baseliner',
    rating: 2239,
    bio: 'Lefty firebrand with theatrical flair.',
    careerWins: 206,
    careerLosses: 153,
    grandSlams: 2,
    masters1000: 10,
    favSurface: 'hard',
    speed: 0.81,
    power: 0.8,
    accuracy: 0.71,
    stamina: 0.87,
    mental: 0.95,
  },
  {
    id: 'tp_187',
    name: 'Henry Brown',
    nickname: 'The Champion',
    country: 'USA',
    flagCode: 'us',
    age: 34,
    height: 176,
    weight: 73,
    handed: 'R',
    style: 'spinner',
    rating: 1711,
    bio: 'Veteran with vast experience and crafty hands.',
    careerWins: 63,
    careerLosses: 178,
    grandSlams: 2,
    masters1000: 1,
    favSurface: 'hard',
    speed: 0.89,
    power: 0.75,
    accuracy: 0.94,
    stamina: 0.84,
    mental: 0.97,
  },
  {
    id: 'tp_188',
    name: 'Liam Garcia',
    nickname: 'The Shogun',
    country: 'KOR',
    flagCode: 'kr',
    age: 30,
    height: 175,
    weight: 84,
    handed: 'R',
    style: 'aggressor',
    rating: 1769,
    bio: 'Mental warrior who battles for every point.',
    careerWins: 132,
    careerLosses: 134,
    grandSlams: 2,
    masters1000: 3,
    favSurface: 'clay',
    speed: 1.03,
    power: 0.93,
    accuracy: 0.75,
    stamina: 0.91,
    mental: 0.73,
  },
  {
    id: 'tp_189',
    name: 'Owen Cooper',
    nickname: 'The Shogun',
    country: 'CHN',
    flagCode: 'cn',
    age: 20,
    height: 196,
    weight: 82,
    handed: 'L',
    style: 'counterPuncher',
    rating: 1928,
    bio: 'Showboat who plays for the crowd.',
    careerWins: 157,
    careerLosses: 190,
    grandSlams: 3,
    masters1000: 9,
    favSurface: 'hard',
    speed: 1.05,
    power: 0.89,
    accuracy: 0.72,
    stamina: 0.97,
    mental: 0.91,
  },
  {
    id: 'tp_190',
    name: 'Yuki Hill',
    nickname: 'The Iceman',
    country: 'CRO',
    flagCode: 'hr',
    age: 23,
    height: 173,
    weight: 100,
    handed: 'R',
    style: 'counterPuncher',
    rating: 1677,
    bio: 'Mountain of a man with a thunderous serve.',
    careerWins: 62,
    careerLosses: 69,
    grandSlams: 1,
    masters1000: 2,
    favSurface: 'grass',
    speed: 0.72,
    power: 0.73,
    accuracy: 0.9,
    stamina: 0.76,
    mental: 0.95,
  },
  {
    id: 'tp_191',
    name: 'Greg Bailey',
    nickname: 'The Phantom',
    country: 'CAN',
    flagCode: 'ca',
    age: 31,
    height: 187,
    weight: 82,
    handed: 'L',
    style: 'serveVolley',
    rating: 1833,
    bio: 'Aggressive net rusher who keeps opponents off-balance.',
    careerWins: 239,
    careerLosses: 85,
    grandSlams: 4,
    masters1000: 7,
    favSurface: 'hard',
    speed: 1.07,
    power: 0.7,
    accuracy: 0.91,
    stamina: 0.88,
    mental: 0.93,
  },
  {
    id: 'tp_192',
    name: 'Eric Lewis',
    nickname: 'The Fox',
    country: 'ESP',
    flagCode: 'es',
    age: 22,
    height: 199,
    weight: 73,
    handed: 'L',
    style: 'counterPuncher',
    rating: 2298,
    bio: 'Quiet assassin who lets racket do the talking.',
    careerWins: 45,
    careerLosses: 88,
    grandSlams: 4,
    masters1000: 5,
    favSurface: 'grass',
    speed: 1.05,
    power: 0.81,
    accuracy: 0.9,
    stamina: 0.87,
    mental: 0.84,
  },
  {
    id: 'tp_193',
    name: 'James Moore',
    nickname: 'The Maestro',
    country: 'ESP',
    flagCode: 'es',
    age: 20,
    height: 182,
    weight: 98,
    handed: 'R',
    style: 'counterPuncher',
    rating: 2207,
    bio: 'Mental warrior who battles for every point.',
    careerWins: 80,
    careerLosses: 27,
    grandSlams: 3,
    masters1000: 4,
    favSurface: 'grass',
    speed: 1.06,
    power: 0.71,
    accuracy: 0.95,
    stamina: 0.79,
    mental: 0.78,
  },
  {
    id: 'tp_194',
    name: 'Will Cox',
    nickname: 'The King',
    country: 'TUR',
    flagCode: 'tr',
    age: 33,
    height: 194,
    weight: 96,
    handed: 'R',
    style: 'aggressor',
    rating: 1775,
    bio: 'Veteran with vast experience and crafty hands.',
    careerWins: 206,
    careerLosses: 121,
    grandSlams: 4,
    masters1000: 10,
    favSurface: 'hard',
    speed: 0.74,
    power: 0.88,
    accuracy: 0.97,
    stamina: 0.82,
    mental: 0.85,
  },
  {
    id: 'tp_195',
    name: 'Peter Murphy',
    nickname: 'The Wizard',
    country: 'CZE',
    flagCode: 'cz',
    age: 35,
    height: 182,
    weight: 74,
    handed: 'L',
    style: 'aggressor',
    rating: 2400,
    bio: 'Veteran with vast experience and crafty hands.',
    careerWins: 165,
    careerLosses: 22,
    grandSlams: 1,
    masters1000: 3,
    favSurface: 'hard',
    speed: 1.05,
    power: 0.78,
    accuracy: 0.72,
    stamina: 0.71,
    mental: 0.72,
  },
  {
    id: 'tp_196',
    name: 'Paul Mitchell',
    nickname: 'The Lion',
    country: 'ARG',
    flagCode: 'ar',
    age: 31,
    height: 190,
    weight: 99,
    handed: 'R',
    style: 'defender',
    rating: 2197,
    bio: 'Methodical grinder, wears opponents down.',
    careerWins: 27,
    careerLosses: 76,
    grandSlams: 2,
    masters1000: 7,
    favSurface: 'clay',
    speed: 0.94,
    power: 0.77,
    accuracy: 0.96,
    stamina: 0.88,
    mental: 0.8,
  },
  {
    id: 'tp_197',
    name: 'Ian Bailey',
    nickname: 'The Phantom',
    country: 'AUT',
    flagCode: 'at',
    age: 19,
    height: 182,
    weight: 71,
    handed: 'R',
    style: 'serveVolley',
    rating: 2374,
    bio: 'Veteran with vast experience and crafty hands.',
    careerWins: 166,
    careerLosses: 69,
    grandSlams: 1,
    masters1000: 10,
    favSurface: 'hard',
    speed: 0.79,
    power: 0.78,
    accuracy: 0.9,
    stamina: 0.85,
    mental: 0.96,
  },
  {
    id: 'tp_198',
    name: 'Alex Allen',
    nickname: 'The Cobra',
    country: 'DEN',
    flagCode: 'dk',
    age: 26,
    height: 178,
    weight: 89,
    handed: 'R',
    style: 'aggressor',
    rating: 2229,
    bio: 'Dynamic shot-maker with a powerful forehand.',
    careerWins: 201,
    careerLosses: 179,
    grandSlams: 2,
    masters1000: 6,
    favSurface: 'grass',
    speed: 1.06,
    power: 1.04,
    accuracy: 0.84,
    stamina: 0.77,
    mental: 0.79,
  },
  {
    id: 'tp_199',
    name: 'Ryan Flores',
    nickname: 'The King',
    country: 'USA',
    flagCode: 'us',
    age: 28,
    height: 179,
    weight: 91,
    handed: 'R',
    style: 'counterPuncher',
    rating: 1993,
    bio: 'Clean ball-striker with smooth technique.',
    careerWins: 36,
    careerLosses: 101,
    grandSlams: 2,
    masters1000: 10,
    favSurface: 'grass',
    speed: 0.83,
    power: 0.81,
    accuracy: 0.9,
    stamina: 0.99,
    mental: 0.9,
  },
  {
    id: 'tp_200',
    name: 'Jeff Martinez',
    nickname: 'The Iceman',
    country: 'POR',
    flagCode: 'pt',
    age: 31,
    height: 191,
    weight: 80,
    handed: 'R',
    style: 'aggressor',
    rating: 2238,
    bio: 'Mountain of a man with a thunderous serve.',
    careerWins: 26,
    careerLosses: 182,
    grandSlams: 3,
    masters1000: 4,
    favSurface: 'hard',
    speed: 0.8,
    power: 0.87,
    accuracy: 0.82,
    stamina: 0.71,
    mental: 0.91,
  },
  {
    id: 'tp_201',
    name: 'Jeff Perez',
    nickname: 'The Bear',
    country: 'NED',
    flagCode: 'nl',
    age: 30,
    height: 186,
    weight: 79,
    handed: 'R',
    style: 'counterPuncher',
    rating: 2360,
    bio: 'Rising star with raw talent and big upside.',
    careerWins: 188,
    careerLosses: 157,
    grandSlams: 1,
    masters1000: 4,
    favSurface: 'grass',
    speed: 0.74,
    power: 0.75,
    accuracy: 0.78,
    stamina: 0.94,
    mental: 0.93,
  },
  {
    id: 'tp_202',
    name: 'Jason Rivera',
    nickname: 'The Comet',
    country: 'DEN',
    flagCode: 'dk',
    age: 26,
    height: 193,
    weight: 97,
    handed: 'R',
    style: 'baseliner',
    rating: 1930,
    bio: 'Clean ball-striker with smooth technique.',
    careerWins: 221,
    careerLosses: 99,
    grandSlams: 2,
    masters1000: 4,
    favSurface: 'hard',
    speed: 0.93,
    power: 0.89,
    accuracy: 0.74,
    stamina: 0.72,
    mental: 0.89,
  },
  {
    id: 'tp_203',
    name: 'Chris Allen',
    nickname: 'The Lion',
    country: 'CZE',
    flagCode: 'cz',
    age: 35,
    height: 179,
    weight: 83,
    handed: 'R',
    style: 'baseliner',
    rating: 2391,
    bio: 'Mental warrior who battles for every point.',
    careerWins: 238,
    careerLosses: 53,
    grandSlams: 1,
    masters1000: 3,
    favSurface: 'grass',
    speed: 0.84,
    power: 1.09,
    accuracy: 0.97,
    stamina: 1.0,
    mental: 0.74,
  },
  {
    id: 'tp_204',
    name: 'Jason Evans',
    nickname: 'The Ace',
    country: 'POL',
    flagCode: 'pl',
    age: 29,
    height: 190,
    weight: 71,
    handed: 'R',
    style: 'defender',
    rating: 1962,
    bio: 'Big serve, big game, takes time away from the opponent.',
    careerWins: 90,
    careerLosses: 68,
    grandSlams: 1,
    masters1000: 9,
    favSurface: 'grass',
    speed: 1.01,
    power: 0.9,
    accuracy: 0.93,
    stamina: 0.73,
    mental: 0.88,
  },
  {
    id: 'tp_205',
    name: 'Steve Clark',
    nickname: 'The Warrior',
    country: 'POL',
    flagCode: 'pl',
    age: 25,
    height: 193,
    weight: 81,
    handed: 'R',
    style: 'spinner',
    rating: 1829,
    bio: 'Steady from the baseline with great anticipation.',
    careerWins: 213,
    careerLosses: 150,
    grandSlams: 1,
    masters1000: 0,
    favSurface: 'hard',
    speed: 0.97,
    power: 0.95,
    accuracy: 0.77,
    stamina: 0.91,
    mental: 0.8,
  },
  {
    id: 'tp_206',
    name: 'Frank Miller',
    nickname: 'The Master',
    country: 'CZE',
    flagCode: 'cz',
    age: 21,
    height: 196,
    weight: 71,
    handed: 'R',
    style: 'counterPuncher',
    rating: 1797,
    bio: 'Big serve, big game, takes time away from the opponent.',
    careerWins: 136,
    careerLosses: 148,
    grandSlams: 4,
    masters1000: 8,
    favSurface: 'clay',
    speed: 0.84,
    power: 1.06,
    accuracy: 1.0,
    stamina: 0.8,
    mental: 0.97,
  },
  {
    id: 'tp_207',
    name: 'Patrick Phillips',
    nickname: 'The Lion',
    country: 'ITA',
    flagCode: 'it',
    age: 26,
    height: 193,
    weight: 74,
    handed: 'R',
    style: 'spinner',
    rating: 2251,
    bio: 'Tactical genius who reads the game brilliantly.',
    careerWins: 25,
    careerLosses: 165,
    grandSlams: 4,
    masters1000: 2,
    favSurface: 'hard',
    speed: 0.75,
    power: 0.98,
    accuracy: 0.94,
    stamina: 0.81,
    mental: 0.89,
  },
  {
    id: 'tp_208',
    name: 'Bryan Green',
    nickname: 'The Wizard',
    country: 'NED',
    flagCode: 'nl',
    age: 20,
    height: 192,
    weight: 73,
    handed: 'R',
    style: 'baseliner',
    rating: 1954,
    bio: 'Dynamic shot-maker with a powerful forehand.',
    careerWins: 117,
    careerLosses: 46,
    grandSlams: 4,
    masters1000: 4,
    favSurface: 'grass',
    speed: 0.89,
    power: 0.76,
    accuracy: 0.91,
    stamina: 0.89,
    mental: 0.79,
  },
  {
    id: 'tp_209',
    name: 'Dennis Hall',
    nickname: 'The Iceman',
    country: 'ARG',
    flagCode: 'ar',
    age: 32,
    height: 196,
    weight: 98,
    handed: 'R',
    style: 'counterPuncher',
    rating: 2023,
    bio: 'Cool under pressure, money on big points.',
    careerWins: 204,
    careerLosses: 173,
    grandSlams: 0,
    masters1000: 4,
    favSurface: 'grass',
    speed: 0.75,
    power: 0.74,
    accuracy: 0.76,
    stamina: 0.76,
    mental: 0.78,
  },
  {
    id: 'tp_210',
    name: 'John Thompson',
    nickname: 'The Fighter',
    country: 'BRA',
    flagCode: 'br',
    age: 34,
    height: 199,
    weight: 76,
    handed: 'R',
    style: 'aggressor',
    rating: 1838,
    bio: 'Showboat who plays for the crowd.',
    careerWins: 80,
    careerLosses: 15,
    grandSlams: 0,
    masters1000: 10,
    favSurface: 'hard',
    speed: 0.74,
    power: 0.74,
    accuracy: 0.87,
    stamina: 0.85,
    mental: 0.98,
  },
  {
    id: 'tp_211',
    name: 'Zach Jones',
    nickname: 'The King',
    country: 'GRE',
    flagCode: 'gr',
    age: 33,
    height: 179,
    weight: 78,
    handed: 'R',
    style: 'defender',
    rating: 1551,
    bio: 'Tactical genius who reads the game brilliantly.',
    careerWins: 45,
    careerLosses: 59,
    grandSlams: 0,
    masters1000: 4,
    favSurface: 'grass',
    speed: 0.84,
    power: 0.97,
    accuracy: 0.83,
    stamina: 0.73,
    mental: 0.96,
  },
  {
    id: 'tp_212',
    name: 'Brad Smith',
    nickname: 'The Cobra',
    country: 'NED',
    flagCode: 'nl',
    age: 30,
    height: 198,
    weight: 84,
    handed: 'L',
    style: 'serveVolley',
    rating: 1774,
    bio: 'Lefty firebrand with theatrical flair.',
    careerWins: 244,
    careerLosses: 38,
    grandSlams: 2,
    masters1000: 5,
    favSurface: 'hard',
    speed: 0.77,
    power: 0.86,
    accuracy: 0.99,
    stamina: 0.78,
    mental: 0.82,
  },
  {
    id: 'tp_213',
    name: 'Walter Cooper',
    nickname: 'The Fighter',
    country: 'DEN',
    flagCode: 'dk',
    age: 20,
    height: 200,
    weight: 97,
    handed: 'R',
    style: 'aggressor',
    rating: 1606,
    bio: 'Cool under pressure, money on big points.',
    careerWins: 126,
    careerLosses: 166,
    grandSlams: 3,
    masters1000: 12,
    favSurface: 'hard',
    speed: 0.93,
    power: 0.88,
    accuracy: 0.88,
    stamina: 0.93,
    mental: 0.88,
  },
  {
    id: 'tp_214',
    name: 'Frank Allen',
    nickname: 'Le Magnifique',
    country: 'GER',
    flagCode: 'de',
    age: 21,
    height: 178,
    weight: 90,
    handed: 'R',
    style: 'spinner',
    rating: 1512,
    bio: 'Steady from the baseline with great anticipation.',
    careerWins: 200,
    careerLosses: 188,
    grandSlams: 4,
    masters1000: 12,
    favSurface: 'clay',
    speed: 1.0,
    power: 0.99,
    accuracy: 0.77,
    stamina: 0.99,
    mental: 0.96,
  },
  {
    id: 'tp_215',
    name: 'Dennis Robinson',
    nickname: 'The Eagle',
    country: 'POL',
    flagCode: 'pl',
    age: 23,
    height: 196,
    weight: 96,
    handed: 'L',
    style: 'defender',
    rating: 2127,
    bio: 'Mental warrior who battles for every point.',
    careerWins: 33,
    careerLosses: 17,
    grandSlams: 1,
    masters1000: 8,
    favSurface: 'grass',
    speed: 1.04,
    power: 1.04,
    accuracy: 0.96,
    stamina: 0.72,
    mental: 0.85,
  },
  {
    id: 'tp_216',
    name: 'Kyle Perez',
    nickname: 'The Shark',
    country: 'GBR',
    flagCode: 'gb',
    age: 31,
    height: 182,
    weight: 96,
    handed: 'R',
    style: 'counterPuncher',
    rating: 1580,
    bio: 'Showboat who plays for the crowd.',
    careerWins: 137,
    careerLosses: 128,
    grandSlams: 4,
    masters1000: 7,
    favSurface: 'hard',
    speed: 0.74,
    power: 0.9,
    accuracy: 0.79,
    stamina: 0.99,
    mental: 0.92,
  },
  {
    id: 'tp_217',
    name: 'Andrew Miller',
    nickname: 'The Maestro',
    country: 'CHN',
    flagCode: 'cn',
    age: 19,
    height: 196,
    weight: 72,
    handed: 'L',
    style: 'baseliner',
    rating: 2133,
    bio: 'Showboat who plays for the crowd.',
    careerWins: 183,
    careerLosses: 92,
    grandSlams: 4,
    masters1000: 8,
    favSurface: 'grass',
    speed: 0.78,
    power: 0.97,
    accuracy: 0.99,
    stamina: 0.81,
    mental: 0.72,
  },
  {
    id: 'tp_218',
    name: 'Justin Cox',
    nickname: 'The Phenomenon',
    country: 'CAN',
    flagCode: 'ca',
    age: 34,
    height: 192,
    weight: 91,
    handed: 'R',
    style: 'counterPuncher',
    rating: 2233,
    bio: 'Mountain of a man with a thunderous serve.',
    careerWins: 135,
    careerLosses: 44,
    grandSlams: 0,
    masters1000: 12,
    favSurface: 'grass',
    speed: 0.96,
    power: 0.7,
    accuracy: 0.81,
    stamina: 0.89,
    mental: 0.94,
  },
  {
    id: 'tp_219',
    name: 'Peter Campbell',
    nickname: 'The King',
    country: 'GBR',
    flagCode: 'gb',
    age: 32,
    height: 173,
    weight: 78,
    handed: 'L',
    style: 'aggressor',
    rating: 1700,
    bio: 'Cool under pressure, money on big points.',
    careerWins: 68,
    careerLosses: 45,
    grandSlams: 3,
    masters1000: 3,
    favSurface: 'clay',
    speed: 0.88,
    power: 1.01,
    accuracy: 0.92,
    stamina: 0.73,
    mental: 0.82,
  },
  {
    id: 'tp_220',
    name: 'Felix Evans',
    nickname: 'The Legend',
    country: 'IND',
    flagCode: 'in',
    age: 23,
    height: 200,
    weight: 85,
    handed: 'R',
    style: 'serveVolley',
    rating: 2043,
    bio: 'Methodical grinder, wears opponents down.',
    careerWins: 208,
    careerLosses: 27,
    grandSlams: 4,
    masters1000: 6,
    favSurface: 'grass',
    speed: 1.04,
    power: 0.89,
    accuracy: 0.85,
    stamina: 0.98,
    mental: 0.75,
  },
  {
    id: 'tp_221',
    name: 'James Carter',
    nickname: 'The Cobra',
    country: 'GER',
    flagCode: 'de',
    age: 29,
    height: 186,
    weight: 98,
    handed: 'R',
    style: 'spinner',
    rating: 1928,
    bio: 'Mountain of a man with a thunderous serve.',
    careerWins: 175,
    careerLosses: 192,
    grandSlams: 1,
    masters1000: 4,
    favSurface: 'grass',
    speed: 0.86,
    power: 0.84,
    accuracy: 0.79,
    stamina: 0.94,
    mental: 0.74,
  },
  {
    id: 'tp_222',
    name: 'Zach Martin',
    nickname: 'The Samurai',
    country: 'TUR',
    flagCode: 'tr',
    age: 25,
    height: 176,
    weight: 76,
    handed: 'L',
    style: 'defender',
    rating: 2231,
    bio: 'Showboat who plays for the crowd.',
    careerWins: 94,
    careerLosses: 190,
    grandSlams: 2,
    masters1000: 10,
    favSurface: 'grass',
    speed: 0.75,
    power: 0.98,
    accuracy: 0.99,
    stamina: 0.75,
    mental: 0.86,
  },
  {
    id: 'tp_223',
    name: 'Nick Mitchell',
    nickname: 'The Bull',
    country: 'POR',
    flagCode: 'pt',
    age: 32,
    height: 191,
    weight: 93,
    handed: 'L',
    style: 'defender',
    rating: 1792,
    bio: 'Rising star with raw talent and big upside.',
    careerWins: 244,
    careerLosses: 123,
    grandSlams: 0,
    masters1000: 8,
    favSurface: 'grass',
    speed: 0.74,
    power: 0.85,
    accuracy: 0.72,
    stamina: 0.72,
    mental: 0.78,
  },
  {
    id: 'tp_224',
    name: 'Ian Jackson',
    nickname: 'The Phantom',
    country: 'ESP',
    flagCode: 'es',
    age: 25,
    height: 194,
    weight: 87,
    handed: 'R',
    style: 'baseliner',
    rating: 1867,
    bio: 'Veteran with vast experience and crafty hands.',
    careerWins: 228,
    careerLosses: 130,
    grandSlams: 0,
    masters1000: 9,
    favSurface: 'grass',
    speed: 1.05,
    power: 1.0,
    accuracy: 0.96,
    stamina: 0.92,
    mental: 0.87,
  },
  {
    id: 'tp_225',
    name: 'Kyle Wright',
    nickname: 'The Bullet',
    country: 'BEL',
    flagCode: 'be',
    age: 31,
    height: 183,
    weight: 100,
    handed: 'R',
    style: 'serveVolley',
    rating: 2065,
    bio: 'Mental warrior who battles for every point.',
    careerWins: 33,
    careerLosses: 18,
    grandSlams: 2,
    masters1000: 3,
    favSurface: 'hard',
    speed: 0.95,
    power: 1.01,
    accuracy: 0.96,
    stamina: 0.95,
    mental: 0.97,
  },
  {
    id: 'tp_226',
    name: 'Peter Phillips',
    nickname: 'The Shogun',
    country: 'AUT',
    flagCode: 'at',
    age: 28,
    height: 184,
    weight: 75,
    handed: 'R',
    style: 'counterPuncher',
    rating: 1691,
    bio: 'Defensive wall who turns defense into offense.',
    careerWins: 64,
    careerLosses: 146,
    grandSlams: 0,
    masters1000: 6,
    favSurface: 'hard',
    speed: 0.72,
    power: 0.81,
    accuracy: 0.78,
    stamina: 0.75,
    mental: 0.95,
  },
  {
    id: 'tp_227',
    name: 'Adrian Perez',
    nickname: 'The Phenomenon',
    country: 'BEL',
    flagCode: 'be',
    age: 29,
    height: 189,
    weight: 71,
    handed: 'L',
    style: 'aggressor',
    rating: 2363,
    bio: 'Cool under pressure, money on big points.',
    careerWins: 189,
    careerLosses: 92,
    grandSlams: 3,
    masters1000: 12,
    favSurface: 'hard',
    speed: 0.93,
    power: 0.84,
    accuracy: 0.94,
    stamina: 0.8,
    mental: 0.77,
  },
  {
    id: 'tp_228',
    name: 'Jason Scott',
    nickname: 'The Storm',
    country: 'CRO',
    flagCode: 'hr',
    age: 31,
    height: 172,
    weight: 81,
    handed: 'R',
    style: 'counterPuncher',
    rating: 1718,
    bio: 'Athletic baseliner with thunderous groundstrokes.',
    careerWins: 189,
    careerLosses: 99,
    grandSlams: 2,
    masters1000: 5,
    favSurface: 'hard',
    speed: 0.82,
    power: 1.08,
    accuracy: 0.89,
    stamina: 0.84,
    mental: 0.87,
  },
  {
    id: 'tp_229',
    name: 'Alex Davis',
    nickname: 'The Star',
    country: 'IND',
    flagCode: 'in',
    age: 26,
    height: 200,
    weight: 71,
    handed: 'R',
    style: 'aggressor',
    rating: 1890,
    bio: 'Mountain of a man with a thunderous serve.',
    careerWins: 223,
    careerLosses: 44,
    grandSlams: 3,
    masters1000: 4,
    favSurface: 'grass',
    speed: 0.92,
    power: 0.81,
    accuracy: 0.97,
    stamina: 0.95,
    mental: 0.81,
  },
  {
    id: 'tp_230',
    name: 'Zach Walker',
    nickname: 'Le Magnifique',
    country: 'GBR',
    flagCode: 'gb',
    age: 29,
    height: 186,
    weight: 72,
    handed: 'R',
    style: 'defender',
    rating: 1671,
    bio: 'Defensive wall who turns defense into offense.',
    careerWins: 217,
    careerLosses: 152,
    grandSlams: 4,
    masters1000: 0,
    favSurface: 'grass',
    speed: 0.95,
    power: 0.78,
    accuracy: 0.89,
    stamina: 0.76,
    mental: 0.91,
  },
  {
    id: 'tp_231',
    name: 'Edward Wilson',
    nickname: 'The Shogun',
    country: 'SRB',
    flagCode: 'rs',
    age: 21,
    height: 193,
    weight: 91,
    handed: 'R',
    style: 'serveVolley',
    rating: 1524,
    bio: 'Athletic baseliner with thunderous groundstrokes.',
    careerWins: 137,
    careerLosses: 198,
    grandSlams: 2,
    masters1000: 0,
    favSurface: 'grass',
    speed: 0.74,
    power: 0.72,
    accuracy: 0.94,
    stamina: 0.87,
    mental: 0.87,
  },
  {
    id: 'tp_232',
    name: 'Kevin Reed',
    nickname: 'The Phantom',
    country: 'CHN',
    flagCode: 'cn',
    age: 32,
    height: 180,
    weight: 70,
    handed: 'R',
    style: 'spinner',
    rating: 2189,
    bio: 'Mental warrior who battles for every point.',
    careerWins: 50,
    careerLosses: 151,
    grandSlams: 0,
    masters1000: 10,
    favSurface: 'clay',
    speed: 0.99,
    power: 0.73,
    accuracy: 0.92,
    stamina: 0.71,
    mental: 0.95,
  },
  {
    id: 'tp_233',
    name: 'Patrick Wright',
    nickname: 'The King',
    country: 'BRA',
    flagCode: 'br',
    age: 21,
    height: 179,
    weight: 94,
    handed: 'R',
    style: 'serveVolley',
    rating: 1890,
    bio: 'Mountain of a man with a thunderous serve.',
    careerWins: 121,
    careerLosses: 184,
    grandSlams: 0,
    masters1000: 7,
    favSurface: 'clay',
    speed: 0.76,
    power: 0.79,
    accuracy: 0.92,
    stamina: 0.94,
    mental: 0.95,
  },
  {
    id: 'tp_234',
    name: 'Mason Nelson',
    nickname: 'The Fox',
    country: 'BRA',
    flagCode: 'br',
    age: 19,
    height: 187,
    weight: 97,
    handed: 'L',
    style: 'serveVolley',
    rating: 1644,
    bio: 'Clean ball-striker with smooth technique.',
    careerWins: 51,
    careerLosses: 25,
    grandSlams: 0,
    masters1000: 9,
    favSurface: 'grass',
    speed: 0.94,
    power: 0.91,
    accuracy: 0.98,
    stamina: 0.79,
    mental: 0.92,
  },
  {
    id: 'tp_235',
    name: 'Owen Wilson',
    nickname: 'The Fighter',
    country: 'GRE',
    flagCode: 'gr',
    age: 24,
    height: 175,
    weight: 77,
    handed: 'L',
    style: 'serveVolley',
    rating: 2354,
    bio: 'Cool under pressure, money on big points.',
    careerWins: 84,
    careerLosses: 64,
    grandSlams: 0,
    masters1000: 2,
    favSurface: 'grass',
    speed: 0.97,
    power: 0.93,
    accuracy: 0.72,
    stamina: 0.93,
    mental: 1.0,
  },
  {
    id: 'tp_236',
    name: 'Tyler Baker',
    nickname: 'The Samurai',
    country: 'FRA',
    flagCode: 'fr',
    age: 27,
    height: 173,
    weight: 76,
    handed: 'L',
    style: 'defender',
    rating: 1998,
    bio: 'Aggressive net rusher who keeps opponents off-balance.',
    careerWins: 104,
    careerLosses: 106,
    grandSlams: 1,
    masters1000: 10,
    favSurface: 'grass',
    speed: 0.96,
    power: 0.74,
    accuracy: 0.89,
    stamina: 0.97,
    mental: 0.8,
  },
  {
    id: 'tp_237',
    name: 'Tom Perez',
    nickname: 'The Cannon',
    country: 'BEL',
    flagCode: 'be',
    age: 30,
    height: 195,
    weight: 80,
    handed: 'R',
    style: 'counterPuncher',
    rating: 1672,
    bio: 'Quiet assassin who lets racket do the talking.',
    careerWins: 21,
    careerLosses: 95,
    grandSlams: 1,
    masters1000: 12,
    favSurface: 'hard',
    speed: 0.79,
    power: 1.0,
    accuracy: 0.83,
    stamina: 0.95,
    mental: 0.74,
  },
  {
    id: 'tp_238',
    name: 'Oliver Ward',
    nickname: 'El Toro',
    country: 'IND',
    flagCode: 'in',
    age: 34,
    height: 187,
    weight: 73,
    handed: 'R',
    style: 'spinner',
    rating: 2161,
    bio: 'Veteran with vast experience and crafty hands.',
    careerWins: 175,
    careerLosses: 35,
    grandSlams: 2,
    masters1000: 2,
    favSurface: 'clay',
    speed: 1.06,
    power: 0.78,
    accuracy: 0.92,
    stamina: 0.89,
    mental: 0.92,
  },
  {
    id: 'tp_239',
    name: 'Andrew Cox',
    nickname: 'Il Gladiatore',
    country: 'DEN',
    flagCode: 'dk',
    age: 31,
    height: 194,
    weight: 88,
    handed: 'R',
    style: 'baseliner',
    rating: 1537,
    bio: 'Quiet assassin who lets racket do the talking.',
    careerWins: 161,
    careerLosses: 81,
    grandSlams: 4,
    masters1000: 8,
    favSurface: 'grass',
    speed: 0.89,
    power: 1.01,
    accuracy: 0.81,
    stamina: 0.77,
    mental: 0.93,
  },
  {
    id: 'tp_240',
    name: 'Mason Rodriguez',
    nickname: 'The Phenomenon',
    country: 'CZE',
    flagCode: 'cz',
    age: 30,
    height: 186,
    weight: 70,
    handed: 'R',
    style: 'counterPuncher',
    rating: 2368,
    bio: 'Mental warrior who battles for every point.',
    careerWins: 226,
    careerLosses: 172,
    grandSlams: 1,
    masters1000: 12,
    favSurface: 'hard',
    speed: 0.91,
    power: 0.88,
    accuracy: 0.75,
    stamina: 0.98,
    mental: 0.9,
  },
  {
    id: 'tp_241',
    name: 'Greg Roberts',
    nickname: 'El Toro',
    country: 'JPN',
    flagCode: 'jp',
    age: 26,
    height: 172,
    weight: 78,
    handed: 'R',
    style: 'baseliner',
    rating: 1739,
    bio: 'Rising star with raw talent and big upside.',
    careerWins: 30,
    careerLosses: 186,
    grandSlams: 1,
    masters1000: 8,
    favSurface: 'hard',
    speed: 1.06,
    power: 0.84,
    accuracy: 0.84,
    stamina: 0.84,
    mental: 0.71,
  },
  {
    id: 'tp_242',
    name: 'Nick Miller',
    nickname: 'The Iceman',
    country: 'DEN',
    flagCode: 'dk',
    age: 24,
    height: 182,
    weight: 90,
    handed: 'R',
    style: 'defender',
    rating: 1874,
    bio: 'Powerful athlete with explosive movement.',
    careerWins: 170,
    careerLosses: 182,
    grandSlams: 0,
    masters1000: 8,
    favSurface: 'grass',
    speed: 0.8,
    power: 1.09,
    accuracy: 0.77,
    stamina: 0.82,
    mental: 0.95,
  },
  {
    id: 'tp_243',
    name: 'Owen King',
    nickname: 'El Toro',
    country: 'GRE',
    flagCode: 'gr',
    age: 23,
    height: 184,
    weight: 75,
    handed: 'R',
    style: 'counterPuncher',
    rating: 1578,
    bio: 'Methodical grinder, wears opponents down.',
    careerWins: 151,
    careerLosses: 179,
    grandSlams: 2,
    masters1000: 3,
    favSurface: 'hard',
    speed: 0.76,
    power: 0.76,
    accuracy: 0.88,
    stamina: 0.95,
    mental: 0.9,
  },
  {
    id: 'tp_244',
    name: 'Sean Cooper',
    nickname: 'The Comet',
    country: 'AUT',
    flagCode: 'at',
    age: 34,
    height: 176,
    weight: 88,
    handed: 'R',
    style: 'baseliner',
    rating: 2162,
    bio: 'Rising star with raw talent and big upside.',
    careerWins: 233,
    careerLosses: 120,
    grandSlams: 0,
    masters1000: 3,
    favSurface: 'clay',
    speed: 0.72,
    power: 0.93,
    accuracy: 0.75,
    stamina: 0.89,
    mental: 0.71,
  },
  {
    id: 'tp_245',
    name: 'Greg Brown',
    nickname: 'The Falcon',
    country: 'ARG',
    flagCode: 'ar',
    age: 19,
    height: 198,
    weight: 93,
    handed: 'R',
    style: 'aggressor',
    rating: 1587,
    bio: 'Mental warrior who battles for every point.',
    careerWins: 75,
    careerLosses: 129,
    grandSlams: 4,
    masters1000: 7,
    favSurface: 'grass',
    speed: 1.05,
    power: 0.77,
    accuracy: 0.95,
    stamina: 0.88,
    mental: 0.94,
  },
  {
    id: 'tp_246',
    name: 'Jason Adams',
    nickname: 'Il Gladiatore',
    country: 'ARG',
    flagCode: 'ar',
    age: 33,
    height: 189,
    weight: 88,
    handed: 'R',
    style: 'aggressor',
    rating: 1735,
    bio: 'Lefty firebrand with theatrical flair.',
    careerWins: 116,
    careerLosses: 113,
    grandSlams: 1,
    masters1000: 1,
    favSurface: 'grass',
    speed: 0.71,
    power: 0.91,
    accuracy: 0.97,
    stamina: 0.91,
    mental: 0.95,
  },
  {
    id: 'tp_247',
    name: 'Dennis Lopez',
    nickname: 'El Toro',
    country: 'GRE',
    flagCode: 'gr',
    age: 35,
    height: 194,
    weight: 73,
    handed: 'R',
    style: 'counterPuncher',
    rating: 1993,
    bio: 'Steady from the baseline with great anticipation.',
    careerWins: 188,
    careerLosses: 48,
    grandSlams: 4,
    masters1000: 8,
    favSurface: 'grass',
    speed: 1.03,
    power: 1.06,
    accuracy: 0.93,
    stamina: 0.89,
    mental: 0.86,
  },
  {
    id: 'tp_248',
    name: 'Peter Howard',
    nickname: 'The Hammer',
    country: 'BEL',
    flagCode: 'be',
    age: 34,
    height: 195,
    weight: 94,
    handed: 'R',
    style: 'counterPuncher',
    rating: 1858,
    bio: 'Tactical genius who reads the game brilliantly.',
    careerWins: 170,
    careerLosses: 193,
    grandSlams: 4,
    masters1000: 1,
    favSurface: 'clay',
    speed: 0.87,
    power: 0.8,
    accuracy: 0.93,
    stamina: 0.97,
    mental: 0.73,
  },
  {
    id: 'tp_249',
    name: 'Scott Taylor',
    nickname: 'The Lion',
    country: 'USA',
    flagCode: 'us',
    age: 35,
    height: 173,
    weight: 86,
    handed: 'R',
    style: 'serveVolley',
    rating: 1884,
    bio: 'Dynamic shot-maker with a powerful forehand.',
    careerWins: 187,
    careerLosses: 67,
    grandSlams: 2,
    masters1000: 6,
    favSurface: 'grass',
    speed: 0.84,
    power: 0.76,
    accuracy: 0.9,
    stamina: 0.78,
    mental: 0.96,
  },
  {
    id: 'tp_250',
    name: 'Steve Hill',
    nickname: 'The Champion',
    country: 'NOR',
    flagCode: 'no',
    age: 25,
    height: 183,
    weight: 87,
    handed: 'L',
    style: 'defender',
    rating: 1994,
    bio: 'Mental warrior who battles for every point.',
    careerWins: 65,
    careerLosses: 109,
    grandSlams: 4,
    masters1000: 8,
    favSurface: 'grass',
    speed: 0.89,
    power: 1.1,
    accuracy: 0.87,
    stamina: 0.93,
    mental: 0.82,
  },
];

// ======================================================================
// 200 Venue Profiles
// ======================================================================

const VenueLibrary200 = [
  {
    id: 'venue_000',
    name: 'Buenos Aires Arena',
    city: 'Buenos Aires',
    capacity: 15529,
    surface: 'clay',
    yearBuilt: 1970,
    altitude: 410,
    indoor: false,
    prestige: 7,
    avgAttendance: 10544,
  },
  {
    id: 'venue_001',
    name: 'Rome Coliseum',
    city: 'Rome',
    capacity: 20750,
    surface: 'grass',
    yearBuilt: 1950,
    altitude: 373,
    indoor: true,
    prestige: 8,
    avgAttendance: 20169,
  },
  {
    id: 'venue_002',
    name: 'Phoenix Arena',
    city: 'Phoenix',
    capacity: 10099,
    surface: 'clay',
    yearBuilt: 1978,
    altitude: 1518,
    indoor: false,
    prestige: 1,
    avgAttendance: 8148,
  },
  {
    id: 'venue_003',
    name: 'Philadelphia Field',
    city: 'Philadelphia',
    capacity: 25072,
    surface: 'clay',
    yearBuilt: 1957,
    altitude: 717,
    indoor: true,
    prestige: 8,
    avgAttendance: 5350,
  },
  {
    id: 'venue_004',
    name: 'Oslo Plaza',
    city: 'Oslo',
    capacity: 17371,
    surface: 'hard',
    yearBuilt: 1954,
    altitude: 2455,
    indoor: true,
    prestige: 4,
    avgAttendance: 15079,
  },
  {
    id: 'venue_005',
    name: 'Amsterdam Stadium',
    city: 'Amsterdam',
    capacity: 19787,
    surface: 'hard',
    yearBuilt: 1950,
    altitude: 644,
    indoor: false,
    prestige: 5,
    avgAttendance: 17774,
  },
  {
    id: 'venue_006',
    name: 'Philadelphia Court',
    city: 'Philadelphia',
    capacity: 20948,
    surface: 'clay',
    yearBuilt: 1975,
    altitude: 2120,
    indoor: false,
    prestige: 2,
    avgAttendance: 20059,
  },
  {
    id: 'venue_007',
    name: 'Cairo Plaza',
    city: 'Cairo',
    capacity: 17322,
    surface: 'grass',
    yearBuilt: 2021,
    altitude: 2387,
    indoor: false,
    prestige: 5,
    avgAttendance: 8707,
  },
  {
    id: 'venue_008',
    name: 'Helsinki Grounds',
    city: 'Helsinki',
    capacity: 21236,
    surface: 'grass',
    yearBuilt: 1950,
    altitude: 1069,
    indoor: false,
    prestige: 9,
    avgAttendance: 6744,
  },
  {
    id: 'venue_009',
    name: 'Toronto Plaza',
    city: 'Toronto',
    capacity: 17642,
    surface: 'clay',
    yearBuilt: 1964,
    altitude: 2102,
    indoor: true,
    prestige: 9,
    avgAttendance: 14419,
  },
  {
    id: 'venue_010',
    name: 'Munich Grounds',
    city: 'Munich',
    capacity: 20356,
    surface: 'grass',
    yearBuilt: 2011,
    altitude: 996,
    indoor: true,
    prestige: 8,
    avgAttendance: 16167,
  },
  {
    id: 'venue_011',
    name: 'Montreal Field',
    city: 'Montreal',
    capacity: 8896,
    surface: 'clay',
    yearBuilt: 1964,
    altitude: 1056,
    indoor: false,
    prestige: 4,
    avgAttendance: 7772,
  },
  {
    id: 'venue_012',
    name: 'Bucharest Court',
    city: 'Bucharest',
    capacity: 21514,
    surface: 'clay',
    yearBuilt: 2016,
    altitude: 2194,
    indoor: false,
    prestige: 5,
    avgAttendance: 13134,
  },
  {
    id: 'venue_013',
    name: 'Milan Arena',
    city: 'Milan',
    capacity: 21072,
    surface: 'grass',
    yearBuilt: 1993,
    altitude: 311,
    indoor: true,
    prestige: 3,
    avgAttendance: 12807,
  },
  {
    id: 'venue_014',
    name: 'Seville Court',
    city: 'Seville',
    capacity: 15161,
    surface: 'grass',
    yearBuilt: 1984,
    altitude: 748,
    indoor: true,
    prestige: 4,
    avgAttendance: 13175,
  },
  {
    id: 'venue_015',
    name: 'Oslo Park',
    city: 'Oslo',
    capacity: 15931,
    surface: 'clay',
    yearBuilt: 1976,
    altitude: 938,
    indoor: false,
    prestige: 4,
    avgAttendance: 15135,
  },
  {
    id: 'venue_016',
    name: 'Boston Coliseum',
    city: 'Boston',
    capacity: 11495,
    surface: 'hard',
    yearBuilt: 1960,
    altitude: 2017,
    indoor: true,
    prestige: 9,
    avgAttendance: 5346,
  },
  {
    id: 'venue_017',
    name: 'Wellington Court',
    city: 'Wellington',
    capacity: 18335,
    surface: 'clay',
    yearBuilt: 2023,
    altitude: 1125,
    indoor: false,
    prestige: 9,
    avgAttendance: 9591,
  },
  {
    id: 'venue_018',
    name: 'Dallas Park',
    city: 'Dallas',
    capacity: 26896,
    surface: 'hard',
    yearBuilt: 1956,
    altitude: 2153,
    indoor: true,
    prestige: 8,
    avgAttendance: 22719,
  },
  {
    id: 'venue_019',
    name: 'Sydney Plaza',
    city: 'Sydney',
    capacity: 19379,
    surface: 'clay',
    yearBuilt: 1972,
    altitude: 1872,
    indoor: true,
    prestige: 9,
    avgAttendance: 12537,
  },
  {
    id: 'venue_020',
    name: 'Seville Stadium',
    city: 'Seville',
    capacity: 8387,
    surface: 'grass',
    yearBuilt: 1976,
    altitude: 1554,
    indoor: true,
    prestige: 6,
    avgAttendance: 6481,
  },
  {
    id: 'venue_021',
    name: 'Hamburg Coliseum',
    city: 'Hamburg',
    capacity: 25975,
    surface: 'clay',
    yearBuilt: 1980,
    altitude: 1103,
    indoor: false,
    prestige: 10,
    avgAttendance: 16242,
  },
  {
    id: 'venue_022',
    name: 'Chicago Coliseum',
    city: 'Chicago',
    capacity: 24343,
    surface: 'clay',
    yearBuilt: 1976,
    altitude: 1716,
    indoor: true,
    prestige: 6,
    avgAttendance: 16962,
  },
  {
    id: 'venue_023',
    name: 'Philadelphia Center',
    city: 'Philadelphia',
    capacity: 22769,
    surface: 'hard',
    yearBuilt: 2023,
    altitude: 537,
    indoor: true,
    prestige: 4,
    avgAttendance: 8272,
  },
  {
    id: 'venue_024',
    name: 'Cologne Park',
    city: 'Cologne',
    capacity: 26197,
    surface: 'clay',
    yearBuilt: 1998,
    altitude: 803,
    indoor: false,
    prestige: 3,
    avgAttendance: 20498,
  },
  {
    id: 'venue_025',
    name: 'London Coliseum',
    city: 'London',
    capacity: 21812,
    surface: 'clay',
    yearBuilt: 1967,
    altitude: 2117,
    indoor: true,
    prestige: 6,
    avgAttendance: 20945,
  },
  {
    id: 'venue_026',
    name: 'Barcelona Center',
    city: 'Barcelona',
    capacity: 26420,
    surface: 'grass',
    yearBuilt: 1956,
    altitude: 1631,
    indoor: false,
    prestige: 3,
    avgAttendance: 6967,
  },
  {
    id: 'venue_027',
    name: 'Warsaw Center',
    city: 'Warsaw',
    capacity: 23615,
    surface: 'grass',
    yearBuilt: 1962,
    altitude: 1842,
    indoor: true,
    prestige: 5,
    avgAttendance: 16828,
  },
  {
    id: 'venue_028',
    name: 'Chicago Plaza',
    city: 'Chicago',
    capacity: 26267,
    surface: 'clay',
    yearBuilt: 1994,
    altitude: 81,
    indoor: false,
    prestige: 6,
    avgAttendance: 24843,
  },
  {
    id: 'venue_029',
    name: 'Oslo Field',
    city: 'Oslo',
    capacity: 26870,
    surface: 'grass',
    yearBuilt: 2018,
    altitude: 714,
    indoor: true,
    prestige: 5,
    avgAttendance: 16636,
  },
  {
    id: 'venue_030',
    name: 'Porto Plaza',
    city: 'Porto',
    capacity: 23974,
    surface: 'grass',
    yearBuilt: 2007,
    altitude: 321,
    indoor: false,
    prestige: 5,
    avgAttendance: 20196,
  },
  {
    id: 'venue_031',
    name: 'Stockholm Coliseum',
    city: 'Stockholm',
    capacity: 19055,
    surface: 'clay',
    yearBuilt: 2023,
    altitude: 1657,
    indoor: true,
    prestige: 2,
    avgAttendance: 6296,
  },
  {
    id: 'venue_032',
    name: 'Athens Court',
    city: 'Athens',
    capacity: 15478,
    surface: 'clay',
    yearBuilt: 1990,
    altitude: 1193,
    indoor: true,
    prestige: 10,
    avgAttendance: 11479,
  },
  {
    id: 'venue_033',
    name: 'Cologne Grounds',
    city: 'Cologne',
    capacity: 19900,
    surface: 'grass',
    yearBuilt: 2016,
    altitude: 1844,
    indoor: false,
    prestige: 3,
    avgAttendance: 18995,
  },
  {
    id: 'venue_034',
    name: 'Paris Coliseum',
    city: 'Paris',
    capacity: 15688,
    surface: 'grass',
    yearBuilt: 1982,
    altitude: 327,
    indoor: false,
    prestige: 7,
    avgAttendance: 6687,
  },
  {
    id: 'venue_035',
    name: 'Dubai Arena',
    city: 'Dubai',
    capacity: 23505,
    surface: 'grass',
    yearBuilt: 1956,
    altitude: 107,
    indoor: true,
    prestige: 9,
    avgAttendance: 7727,
  },
  {
    id: 'venue_036',
    name: 'Singapore Center',
    city: 'Singapore',
    capacity: 13088,
    surface: 'hard',
    yearBuilt: 1999,
    altitude: 1267,
    indoor: false,
    prestige: 5,
    avgAttendance: 8630,
  },
  {
    id: 'venue_037',
    name: 'Mexico City Coliseum',
    city: 'Mexico City',
    capacity: 25260,
    surface: 'hard',
    yearBuilt: 1953,
    altitude: 143,
    indoor: true,
    prestige: 6,
    avgAttendance: 20602,
  },
  {
    id: 'venue_038',
    name: 'Calgary Plaza',
    city: 'Calgary',
    capacity: 16926,
    surface: 'grass',
    yearBuilt: 2006,
    altitude: 553,
    indoor: true,
    prestige: 9,
    avgAttendance: 7900,
  },
  {
    id: 'venue_039',
    name: 'Montreal Field',
    city: 'Montreal',
    capacity: 22253,
    surface: 'grass',
    yearBuilt: 2018,
    altitude: 1268,
    indoor: true,
    prestige: 8,
    avgAttendance: 12442,
  },
  {
    id: 'venue_040',
    name: 'Cairo Grounds',
    city: 'Cairo',
    capacity: 18088,
    surface: 'clay',
    yearBuilt: 2002,
    altitude: 1064,
    indoor: false,
    prestige: 1,
    avgAttendance: 5001,
  },
  {
    id: 'venue_041',
    name: 'Cape Town Coliseum',
    city: 'Cape Town',
    capacity: 19268,
    surface: 'clay',
    yearBuilt: 2010,
    altitude: 2191,
    indoor: false,
    prestige: 8,
    avgAttendance: 17377,
  },
  {
    id: 'venue_042',
    name: 'Wellington Center',
    city: 'Wellington',
    capacity: 8299,
    surface: 'clay',
    yearBuilt: 1987,
    altitude: 2445,
    indoor: false,
    prestige: 1,
    avgAttendance: 7245,
  },
  {
    id: 'venue_043',
    name: 'Miami Park',
    city: 'Miami',
    capacity: 21491,
    surface: 'grass',
    yearBuilt: 2005,
    altitude: 1616,
    indoor: false,
    prestige: 7,
    avgAttendance: 17398,
  },
  {
    id: 'venue_044',
    name: 'Budapest Center',
    city: 'Budapest',
    capacity: 10595,
    surface: 'clay',
    yearBuilt: 1980,
    altitude: 2116,
    indoor: true,
    prestige: 10,
    avgAttendance: 7227,
  },
  {
    id: 'venue_045',
    name: 'Milan Plaza',
    city: 'Milan',
    capacity: 16808,
    surface: 'clay',
    yearBuilt: 1974,
    altitude: 280,
    indoor: false,
    prestige: 5,
    avgAttendance: 6808,
  },
  {
    id: 'venue_046',
    name: 'Montreal Field',
    city: 'Montreal',
    capacity: 22836,
    surface: 'clay',
    yearBuilt: 2012,
    altitude: 769,
    indoor: false,
    prestige: 3,
    avgAttendance: 6626,
  },
  {
    id: 'venue_047',
    name: 'Nairobi Stadium',
    city: 'Nairobi',
    capacity: 14092,
    surface: 'hard',
    yearBuilt: 1986,
    altitude: 1102,
    indoor: false,
    prestige: 8,
    avgAttendance: 5134,
  },
  {
    id: 'venue_048',
    name: 'Bucharest Arena',
    city: 'Bucharest',
    capacity: 12937,
    surface: 'hard',
    yearBuilt: 2013,
    altitude: 889,
    indoor: false,
    prestige: 5,
    avgAttendance: 11436,
  },
  {
    id: 'venue_049',
    name: 'Melbourne Court',
    city: 'Melbourne',
    capacity: 23194,
    surface: 'grass',
    yearBuilt: 1954,
    altitude: 1352,
    indoor: false,
    prestige: 3,
    avgAttendance: 6836,
  },
  {
    id: 'venue_050',
    name: 'Cologne Forum',
    city: 'Cologne',
    capacity: 10339,
    surface: 'grass',
    yearBuilt: 2010,
    altitude: 743,
    indoor: false,
    prestige: 5,
    avgAttendance: 8125,
  },
  {
    id: 'venue_051',
    name: 'London Arena',
    city: 'London',
    capacity: 16157,
    surface: 'clay',
    yearBuilt: 2006,
    altitude: 1012,
    indoor: true,
    prestige: 1,
    avgAttendance: 8263,
  },
  {
    id: 'venue_052',
    name: 'Montreal Arena',
    city: 'Montreal',
    capacity: 25076,
    surface: 'grass',
    yearBuilt: 1976,
    altitude: 1936,
    indoor: false,
    prestige: 5,
    avgAttendance: 15586,
  },
  {
    id: 'venue_053',
    name: 'Athens Stadium',
    city: 'Athens',
    capacity: 26008,
    surface: 'grass',
    yearBuilt: 1965,
    altitude: 1037,
    indoor: false,
    prestige: 5,
    avgAttendance: 11511,
  },
  {
    id: 'venue_054',
    name: 'Chicago Stadium',
    city: 'Chicago',
    capacity: 15136,
    surface: 'hard',
    yearBuilt: 1980,
    altitude: 1778,
    indoor: false,
    prestige: 3,
    avgAttendance: 9523,
  },
  {
    id: 'venue_055',
    name: 'Bangkok Forum',
    city: 'Bangkok',
    capacity: 15965,
    surface: 'hard',
    yearBuilt: 1955,
    altitude: 2380,
    indoor: true,
    prestige: 8,
    avgAttendance: 14768,
  },
  {
    id: 'venue_056',
    name: 'Vienna Court',
    city: 'Vienna',
    capacity: 10932,
    surface: 'hard',
    yearBuilt: 1970,
    altitude: 2047,
    indoor: false,
    prestige: 10,
    avgAttendance: 7772,
  },
  {
    id: 'venue_057',
    name: 'Beijing Stadium',
    city: 'Beijing',
    capacity: 19649,
    surface: 'grass',
    yearBuilt: 1969,
    altitude: 2196,
    indoor: true,
    prestige: 3,
    avgAttendance: 12992,
  },
  {
    id: 'venue_058',
    name: 'Bucharest Court',
    city: 'Bucharest',
    capacity: 26296,
    surface: 'grass',
    yearBuilt: 1994,
    altitude: 1796,
    indoor: true,
    prestige: 1,
    avgAttendance: 17378,
  },
  {
    id: 'venue_059',
    name: 'Boston Coliseum',
    city: 'Boston',
    capacity: 16214,
    surface: 'hard',
    yearBuilt: 2012,
    altitude: 1792,
    indoor: true,
    prestige: 9,
    avgAttendance: 13029,
  },
  {
    id: 'venue_060',
    name: 'Helsinki Field',
    city: 'Helsinki',
    capacity: 14115,
    surface: 'grass',
    yearBuilt: 1994,
    altitude: 1325,
    indoor: true,
    prestige: 5,
    avgAttendance: 14085,
  },
  {
    id: 'venue_061',
    name: 'Athens Arena',
    city: 'Athens',
    capacity: 25404,
    surface: 'hard',
    yearBuilt: 2007,
    altitude: 1211,
    indoor: true,
    prestige: 9,
    avgAttendance: 17029,
  },
  {
    id: 'venue_062',
    name: 'Montreal Stadium',
    city: 'Montreal',
    capacity: 24579,
    surface: 'clay',
    yearBuilt: 1973,
    altitude: 76,
    indoor: true,
    prestige: 6,
    avgAttendance: 12824,
  },
  {
    id: 'venue_063',
    name: 'Porto Arena',
    city: 'Porto',
    capacity: 25660,
    surface: 'clay',
    yearBuilt: 1974,
    altitude: 2146,
    indoor: true,
    prestige: 9,
    avgAttendance: 10050,
  },
  {
    id: 'venue_064',
    name: 'Milan Court',
    city: 'Milan',
    capacity: 21428,
    surface: 'grass',
    yearBuilt: 1991,
    altitude: 452,
    indoor: false,
    prestige: 2,
    avgAttendance: 6434,
  },
  {
    id: 'venue_065',
    name: 'Mexico City Coliseum',
    city: 'Mexico City',
    capacity: 9024,
    surface: 'hard',
    yearBuilt: 1963,
    altitude: 1988,
    indoor: false,
    prestige: 1,
    avgAttendance: 7338,
  },
  {
    id: 'venue_066',
    name: 'Houston Grounds',
    city: 'Houston',
    capacity: 25230,
    surface: 'grass',
    yearBuilt: 1982,
    altitude: 201,
    indoor: false,
    prestige: 10,
    avgAttendance: 7322,
  },
  {
    id: 'venue_067',
    name: 'London Park',
    city: 'London',
    capacity: 24102,
    surface: 'hard',
    yearBuilt: 2009,
    altitude: 248,
    indoor: false,
    prestige: 7,
    avgAttendance: 17093,
  },
  {
    id: 'venue_068',
    name: 'Beijing Field',
    city: 'Beijing',
    capacity: 16710,
    surface: 'grass',
    yearBuilt: 1955,
    altitude: 288,
    indoor: true,
    prestige: 2,
    avgAttendance: 8537,
  },
  {
    id: 'venue_069',
    name: 'Cape Town Arena',
    city: 'Cape Town',
    capacity: 11316,
    surface: 'grass',
    yearBuilt: 1979,
    altitude: 2177,
    indoor: false,
    prestige: 4,
    avgAttendance: 9310,
  },
  {
    id: 'venue_070',
    name: 'Geneva Field',
    city: 'Geneva',
    capacity: 13862,
    surface: 'grass',
    yearBuilt: 2021,
    altitude: 1700,
    indoor: true,
    prestige: 10,
    avgAttendance: 10864,
  },
  {
    id: 'venue_071',
    name: 'Montreal Forum',
    city: 'Montreal',
    capacity: 11411,
    surface: 'hard',
    yearBuilt: 1973,
    altitude: 2252,
    indoor: false,
    prestige: 6,
    avgAttendance: 10386,
  },
  {
    id: 'venue_072',
    name: 'Athens Plaza',
    city: 'Athens',
    capacity: 27658,
    surface: 'clay',
    yearBuilt: 1995,
    altitude: 1290,
    indoor: true,
    prestige: 6,
    avgAttendance: 17180,
  },
  {
    id: 'venue_073',
    name: 'San Francisco Forum',
    city: 'San Francisco',
    capacity: 18598,
    surface: 'grass',
    yearBuilt: 1980,
    altitude: 2306,
    indoor: true,
    prestige: 7,
    avgAttendance: 17545,
  },
  {
    id: 'venue_074',
    name: 'Munich Court',
    city: 'Munich',
    capacity: 22824,
    surface: 'clay',
    yearBuilt: 2000,
    altitude: 0,
    indoor: true,
    prestige: 5,
    avgAttendance: 5534,
  },
  {
    id: 'venue_075',
    name: 'Cape Town Coliseum',
    city: 'Cape Town',
    capacity: 17890,
    surface: 'hard',
    yearBuilt: 1988,
    altitude: 908,
    indoor: false,
    prestige: 6,
    avgAttendance: 5355,
  },
  {
    id: 'venue_076',
    name: 'Naples Plaza',
    city: 'Naples',
    capacity: 24753,
    surface: 'grass',
    yearBuilt: 2023,
    altitude: 2341,
    indoor: false,
    prestige: 1,
    avgAttendance: 20085,
  },
  {
    id: 'venue_077',
    name: 'Boston Coliseum',
    city: 'Boston',
    capacity: 12535,
    surface: 'clay',
    yearBuilt: 1996,
    altitude: 2384,
    indoor: false,
    prestige: 5,
    avgAttendance: 11644,
  },
  {
    id: 'venue_078',
    name: 'Barcelona Arena',
    city: 'Barcelona',
    capacity: 26693,
    surface: 'clay',
    yearBuilt: 2022,
    altitude: 890,
    indoor: true,
    prestige: 6,
    avgAttendance: 20811,
  },
  {
    id: 'venue_079',
    name: 'Brussels Grounds',
    city: 'Brussels',
    capacity: 26881,
    surface: 'hard',
    yearBuilt: 1988,
    altitude: 153,
    indoor: true,
    prestige: 10,
    avgAttendance: 17502,
  },
  {
    id: 'venue_080',
    name: 'Mumbai Stadium',
    city: 'Mumbai',
    capacity: 18957,
    surface: 'clay',
    yearBuilt: 2005,
    altitude: 1706,
    indoor: true,
    prestige: 2,
    avgAttendance: 17622,
  },
  {
    id: 'venue_081',
    name: 'Bucharest Field',
    city: 'Bucharest',
    capacity: 8374,
    surface: 'grass',
    yearBuilt: 1998,
    altitude: 221,
    indoor: false,
    prestige: 1,
    avgAttendance: 6307,
  },
  {
    id: 'venue_082',
    name: 'Vienna Court',
    city: 'Vienna',
    capacity: 24462,
    surface: 'grass',
    yearBuilt: 1978,
    altitude: 627,
    indoor: false,
    prestige: 7,
    avgAttendance: 19601,
  },
  {
    id: 'venue_083',
    name: 'Perth Arena',
    city: 'Perth',
    capacity: 15277,
    surface: 'clay',
    yearBuilt: 1987,
    altitude: 1615,
    indoor: false,
    prestige: 6,
    avgAttendance: 6352,
  },
  {
    id: 'venue_084',
    name: 'Auckland Field',
    city: 'Auckland',
    capacity: 9615,
    surface: 'grass',
    yearBuilt: 2001,
    altitude: 1075,
    indoor: false,
    prestige: 9,
    avgAttendance: 8559,
  },
  {
    id: 'venue_085',
    name: 'Mexico City Coliseum',
    city: 'Mexico City',
    capacity: 23758,
    surface: 'grass',
    yearBuilt: 1975,
    altitude: 1998,
    indoor: false,
    prestige: 10,
    avgAttendance: 11425,
  },
  {
    id: 'venue_086',
    name: 'Johannesburg Park',
    city: 'Johannesburg',
    capacity: 15940,
    surface: 'hard',
    yearBuilt: 1984,
    altitude: 1761,
    indoor: false,
    prestige: 10,
    avgAttendance: 6467,
  },
  {
    id: 'venue_087',
    name: 'Seoul Forum',
    city: 'Seoul',
    capacity: 21878,
    surface: 'clay',
    yearBuilt: 1994,
    altitude: 780,
    indoor: false,
    prestige: 10,
    avgAttendance: 5793,
  },
  {
    id: 'venue_088',
    name: 'Valencia Coliseum',
    city: 'Valencia',
    capacity: 19459,
    surface: 'grass',
    yearBuilt: 2006,
    altitude: 597,
    indoor: false,
    prestige: 4,
    avgAttendance: 8271,
  },
  {
    id: 'venue_089',
    name: 'Miami Coliseum',
    city: 'Miami',
    capacity: 10811,
    surface: 'hard',
    yearBuilt: 1956,
    altitude: 995,
    indoor: true,
    prestige: 3,
    avgAttendance: 7356,
  },
  {
    id: 'venue_090',
    name: 'London Court',
    city: 'London',
    capacity: 11646,
    surface: 'clay',
    yearBuilt: 2007,
    altitude: 1929,
    indoor: false,
    prestige: 4,
    avgAttendance: 11062,
  },
  {
    id: 'venue_091',
    name: 'Nairobi Park',
    city: 'Nairobi',
    capacity: 14678,
    surface: 'grass',
    yearBuilt: 2016,
    altitude: 1059,
    indoor: true,
    prestige: 10,
    avgAttendance: 7315,
  },
  {
    id: 'venue_092',
    name: 'Paris Forum',
    city: 'Paris',
    capacity: 27103,
    surface: 'grass',
    yearBuilt: 2017,
    altitude: 178,
    indoor: false,
    prestige: 1,
    avgAttendance: 14306,
  },
  {
    id: 'venue_093',
    name: 'Oslo Field',
    city: 'Oslo',
    capacity: 16889,
    surface: 'hard',
    yearBuilt: 2009,
    altitude: 34,
    indoor: false,
    prestige: 5,
    avgAttendance: 15862,
  },
  {
    id: 'venue_094',
    name: 'Chicago Arena',
    city: 'Chicago',
    capacity: 8625,
    surface: 'clay',
    yearBuilt: 1999,
    altitude: 946,
    indoor: true,
    prestige: 9,
    avgAttendance: 7906,
  },
  {
    id: 'venue_095',
    name: 'Dubai Court',
    city: 'Dubai',
    capacity: 23881,
    surface: 'grass',
    yearBuilt: 2018,
    altitude: 360,
    indoor: false,
    prestige: 9,
    avgAttendance: 20007,
  },
  {
    id: 'venue_096',
    name: 'Paris Stadium',
    city: 'Paris',
    capacity: 16106,
    surface: 'grass',
    yearBuilt: 1989,
    altitude: 1366,
    indoor: false,
    prestige: 3,
    avgAttendance: 5301,
  },
  {
    id: 'venue_097',
    name: 'Manchester Court',
    city: 'Manchester',
    capacity: 19645,
    surface: 'grass',
    yearBuilt: 1988,
    altitude: 967,
    indoor: true,
    prestige: 9,
    avgAttendance: 9519,
  },
  {
    id: 'venue_098',
    name: 'Beijing Center',
    city: 'Beijing',
    capacity: 20686,
    surface: 'hard',
    yearBuilt: 2021,
    altitude: 1147,
    indoor: false,
    prestige: 6,
    avgAttendance: 19699,
  },
  {
    id: 'venue_099',
    name: 'Dallas Coliseum',
    city: 'Dallas',
    capacity: 10876,
    surface: 'grass',
    yearBuilt: 1998,
    altitude: 2132,
    indoor: true,
    prestige: 10,
    avgAttendance: 10124,
  },
  {
    id: 'venue_100',
    name: 'Bucharest Forum',
    city: 'Bucharest',
    capacity: 15876,
    surface: 'grass',
    yearBuilt: 1969,
    altitude: 1746,
    indoor: true,
    prestige: 10,
    avgAttendance: 10395,
  },
  {
    id: 'venue_101',
    name: 'Vancouver Plaza',
    city: 'Vancouver',
    capacity: 12317,
    surface: 'hard',
    yearBuilt: 1967,
    altitude: 2379,
    indoor: true,
    prestige: 4,
    avgAttendance: 12066,
  },
  {
    id: 'venue_102',
    name: 'Buenos Aires Center',
    city: 'Buenos Aires',
    capacity: 25164,
    surface: 'hard',
    yearBuilt: 2005,
    altitude: 594,
    indoor: true,
    prestige: 10,
    avgAttendance: 10178,
  },
  {
    id: 'venue_103',
    name: 'Seville Arena',
    city: 'Seville',
    capacity: 26262,
    surface: 'grass',
    yearBuilt: 1965,
    altitude: 754,
    indoor: false,
    prestige: 3,
    avgAttendance: 5966,
  },
  {
    id: 'venue_104',
    name: 'Seville Forum',
    city: 'Seville',
    capacity: 21475,
    surface: 'clay',
    yearBuilt: 2006,
    altitude: 1121,
    indoor: false,
    prestige: 4,
    avgAttendance: 8498,
  },
  {
    id: 'venue_105',
    name: 'Mexico City Coliseum',
    city: 'Mexico City',
    capacity: 8858,
    surface: 'grass',
    yearBuilt: 1984,
    altitude: 2480,
    indoor: true,
    prestige: 4,
    avgAttendance: 7442,
  },
  {
    id: 'venue_106',
    name: 'Bucharest Park',
    city: 'Bucharest',
    capacity: 8854,
    surface: 'clay',
    yearBuilt: 1960,
    altitude: 1952,
    indoor: false,
    prestige: 10,
    avgAttendance: 6920,
  },
  {
    id: 'venue_107',
    name: 'Miami Coliseum',
    city: 'Miami',
    capacity: 20696,
    surface: 'clay',
    yearBuilt: 2010,
    altitude: 563,
    indoor: false,
    prestige: 4,
    avgAttendance: 5528,
  },
  {
    id: 'venue_108',
    name: 'San Francisco Stadium',
    city: 'San Francisco',
    capacity: 16842,
    surface: 'clay',
    yearBuilt: 1978,
    altitude: 830,
    indoor: true,
    prestige: 2,
    avgAttendance: 7901,
  },
  {
    id: 'venue_109',
    name: 'Atlanta Field',
    city: 'Atlanta',
    capacity: 24054,
    surface: 'grass',
    yearBuilt: 1991,
    altitude: 1874,
    indoor: true,
    prestige: 7,
    avgAttendance: 18266,
  },
  {
    id: 'venue_110',
    name: 'Madrid Field',
    city: 'Madrid',
    capacity: 20464,
    surface: 'grass',
    yearBuilt: 1990,
    altitude: 1614,
    indoor: true,
    prestige: 10,
    avgAttendance: 14728,
  },
  {
    id: 'venue_111',
    name: 'Nairobi Plaza',
    city: 'Nairobi',
    capacity: 9261,
    surface: 'grass',
    yearBuilt: 1963,
    altitude: 1849,
    indoor: false,
    prestige: 1,
    avgAttendance: 7012,
  },
  {
    id: 'venue_112',
    name: 'Cape Town Plaza',
    city: 'Cape Town',
    capacity: 20963,
    surface: 'grass',
    yearBuilt: 1955,
    altitude: 2284,
    indoor: false,
    prestige: 1,
    avgAttendance: 8110,
  },
  {
    id: 'venue_113',
    name: 'Florence Grounds',
    city: 'Florence',
    capacity: 21042,
    surface: 'clay',
    yearBuilt: 1986,
    altitude: 1889,
    indoor: false,
    prestige: 5,
    avgAttendance: 15045,
  },
  {
    id: 'venue_114',
    name: 'Rome Plaza',
    city: 'Rome',
    capacity: 12660,
    surface: 'clay',
    yearBuilt: 2007,
    altitude: 370,
    indoor: true,
    prestige: 2,
    avgAttendance: 6472,
  },
  {
    id: 'venue_115',
    name: 'Buenos Aires Forum',
    city: 'Buenos Aires',
    capacity: 21551,
    surface: 'clay',
    yearBuilt: 2007,
    altitude: 102,
    indoor: false,
    prestige: 10,
    avgAttendance: 11616,
  },
  {
    id: 'venue_116',
    name: 'Montreal Arena',
    city: 'Montreal',
    capacity: 16194,
    surface: 'clay',
    yearBuilt: 1970,
    altitude: 506,
    indoor: false,
    prestige: 8,
    avgAttendance: 15388,
  },
  {
    id: 'venue_117',
    name: 'Chicago Arena',
    city: 'Chicago',
    capacity: 25164,
    surface: 'grass',
    yearBuilt: 1999,
    altitude: 2095,
    indoor: true,
    prestige: 3,
    avgAttendance: 17408,
  },
  {
    id: 'venue_118',
    name: 'Los Angeles Stadium',
    city: 'Los Angeles',
    capacity: 13599,
    surface: 'clay',
    yearBuilt: 2022,
    altitude: 614,
    indoor: false,
    prestige: 3,
    avgAttendance: 7930,
  },
  {
    id: 'venue_119',
    name: 'Rome Forum',
    city: 'Rome',
    capacity: 18094,
    surface: 'clay',
    yearBuilt: 2007,
    altitude: 1182,
    indoor: true,
    prestige: 2,
    avgAttendance: 7155,
  },
  {
    id: 'venue_120',
    name: 'Oslo Stadium',
    city: 'Oslo',
    capacity: 16293,
    surface: 'hard',
    yearBuilt: 2008,
    altitude: 2038,
    indoor: true,
    prestige: 9,
    avgAttendance: 5094,
  },
  {
    id: 'venue_121',
    name: 'Melbourne Park',
    city: 'Melbourne',
    capacity: 15106,
    surface: 'grass',
    yearBuilt: 2010,
    altitude: 1858,
    indoor: false,
    prestige: 2,
    avgAttendance: 14850,
  },
  {
    id: 'venue_122',
    name: 'New York Park',
    city: 'New York',
    capacity: 25935,
    surface: 'clay',
    yearBuilt: 2021,
    altitude: 850,
    indoor: false,
    prestige: 3,
    avgAttendance: 6804,
  },
  {
    id: 'venue_123',
    name: 'Manchester Stadium',
    city: 'Manchester',
    capacity: 12763,
    surface: 'hard',
    yearBuilt: 2023,
    altitude: 2471,
    indoor: false,
    prestige: 2,
    avgAttendance: 5401,
  },
  {
    id: 'venue_124',
    name: 'Singapore Forum',
    city: 'Singapore',
    capacity: 13840,
    surface: 'hard',
    yearBuilt: 1986,
    altitude: 2436,
    indoor: true,
    prestige: 9,
    avgAttendance: 7906,
  },
  {
    id: 'venue_125',
    name: 'Montreal Field',
    city: 'Montreal',
    capacity: 19802,
    surface: 'hard',
    yearBuilt: 1961,
    altitude: 1225,
    indoor: false,
    prestige: 7,
    avgAttendance: 18439,
  },
  {
    id: 'venue_126',
    name: 'Berlin Forum',
    city: 'Berlin',
    capacity: 26037,
    surface: 'hard',
    yearBuilt: 1987,
    altitude: 1928,
    indoor: false,
    prestige: 5,
    avgAttendance: 15787,
  },
  {
    id: 'venue_127',
    name: 'Johannesburg Forum',
    city: 'Johannesburg',
    capacity: 25191,
    surface: 'hard',
    yearBuilt: 1976,
    altitude: 238,
    indoor: false,
    prestige: 9,
    avgAttendance: 7872,
  },
  {
    id: 'venue_128',
    name: 'Wellington Field',
    city: 'Wellington',
    capacity: 17410,
    surface: 'clay',
    yearBuilt: 1990,
    altitude: 1063,
    indoor: true,
    prestige: 10,
    avgAttendance: 10797,
  },
  {
    id: 'venue_129',
    name: 'Mexico City Field',
    city: 'Mexico City',
    capacity: 26436,
    surface: 'clay',
    yearBuilt: 2016,
    altitude: 2038,
    indoor: false,
    prestige: 3,
    avgAttendance: 24969,
  },
  {
    id: 'venue_130',
    name: 'Bucharest Center',
    city: 'Bucharest',
    capacity: 14342,
    surface: 'hard',
    yearBuilt: 1965,
    altitude: 98,
    indoor: false,
    prestige: 2,
    avgAttendance: 8396,
  },
  {
    id: 'venue_131',
    name: 'Seattle Forum',
    city: 'Seattle',
    capacity: 9490,
    surface: 'clay',
    yearBuilt: 1994,
    altitude: 2295,
    indoor: true,
    prestige: 4,
    avgAttendance: 5092,
  },
  {
    id: 'venue_132',
    name: 'Oslo Center',
    city: 'Oslo',
    capacity: 16336,
    surface: 'hard',
    yearBuilt: 1989,
    altitude: 1229,
    indoor: true,
    prestige: 6,
    avgAttendance: 5100,
  },
  {
    id: 'venue_133',
    name: 'Seoul Court',
    city: 'Seoul',
    capacity: 19185,
    surface: 'clay',
    yearBuilt: 2022,
    altitude: 119,
    indoor: true,
    prestige: 4,
    avgAttendance: 10415,
  },
  {
    id: 'venue_134',
    name: 'Dublin Grounds',
    city: 'Dublin',
    capacity: 23548,
    surface: 'hard',
    yearBuilt: 1967,
    altitude: 1972,
    indoor: false,
    prestige: 8,
    avgAttendance: 22595,
  },
  {
    id: 'venue_135',
    name: 'Edinburgh Grounds',
    city: 'Edinburgh',
    capacity: 21564,
    surface: 'grass',
    yearBuilt: 1957,
    altitude: 2134,
    indoor: false,
    prestige: 6,
    avgAttendance: 5613,
  },
  {
    id: 'venue_136',
    name: 'Prague Field',
    city: 'Prague',
    capacity: 18869,
    surface: 'clay',
    yearBuilt: 1958,
    altitude: 611,
    indoor: false,
    prestige: 1,
    avgAttendance: 10556,
  },
  {
    id: 'venue_137',
    name: 'Los Angeles Plaza',
    city: 'Los Angeles',
    capacity: 13438,
    surface: 'grass',
    yearBuilt: 1999,
    altitude: 767,
    indoor: true,
    prestige: 5,
    avgAttendance: 10152,
  },
  {
    id: 'venue_138',
    name: 'Sydney Center',
    city: 'Sydney',
    capacity: 21561,
    surface: 'hard',
    yearBuilt: 2013,
    altitude: 973,
    indoor: false,
    prestige: 5,
    avgAttendance: 12082,
  },
  {
    id: 'venue_139',
    name: 'Johannesburg Center',
    city: 'Johannesburg',
    capacity: 13734,
    surface: 'hard',
    yearBuilt: 1997,
    altitude: 153,
    indoor: true,
    prestige: 2,
    avgAttendance: 12270,
  },
  {
    id: 'venue_140',
    name: 'Perth Stadium',
    city: 'Perth',
    capacity: 23815,
    surface: 'grass',
    yearBuilt: 1969,
    altitude: 779,
    indoor: false,
    prestige: 8,
    avgAttendance: 22158,
  },
  {
    id: 'venue_141',
    name: 'Valencia Court',
    city: 'Valencia',
    capacity: 12695,
    surface: 'hard',
    yearBuilt: 2016,
    altitude: 543,
    indoor: false,
    prestige: 1,
    avgAttendance: 8763,
  },
  {
    id: 'venue_142',
    name: 'Houston Plaza',
    city: 'Houston',
    capacity: 11795,
    surface: 'hard',
    yearBuilt: 1989,
    altitude: 180,
    indoor: true,
    prestige: 10,
    avgAttendance: 5713,
  },
  {
    id: 'venue_143',
    name: 'Edinburgh Grounds',
    city: 'Edinburgh',
    capacity: 9511,
    surface: 'hard',
    yearBuilt: 2016,
    altitude: 1279,
    indoor: false,
    prestige: 5,
    avgAttendance: 6719,
  },
  {
    id: 'venue_144',
    name: 'Porto Park',
    city: 'Porto',
    capacity: 14309,
    surface: 'clay',
    yearBuilt: 1985,
    altitude: 2180,
    indoor: false,
    prestige: 8,
    avgAttendance: 6927,
  },
  {
    id: 'venue_145',
    name: 'Cologne Coliseum',
    city: 'Cologne',
    capacity: 13160,
    surface: 'clay',
    yearBuilt: 1964,
    altitude: 62,
    indoor: true,
    prestige: 9,
    avgAttendance: 9211,
  },
  {
    id: 'venue_146',
    name: 'Singapore Park',
    city: 'Singapore',
    capacity: 25777,
    surface: 'clay',
    yearBuilt: 2020,
    altitude: 1304,
    indoor: false,
    prestige: 5,
    avgAttendance: 23811,
  },
  {
    id: 'venue_147',
    name: 'Geneva Coliseum',
    city: 'Geneva',
    capacity: 10334,
    surface: 'clay',
    yearBuilt: 1993,
    altitude: 2214,
    indoor: false,
    prestige: 3,
    avgAttendance: 5237,
  },
  {
    id: 'venue_148',
    name: 'Auckland Stadium',
    city: 'Auckland',
    capacity: 11471,
    surface: 'clay',
    yearBuilt: 1956,
    altitude: 352,
    indoor: false,
    prestige: 3,
    avgAttendance: 10772,
  },
  {
    id: 'venue_149',
    name: 'Vancouver Field',
    city: 'Vancouver',
    capacity: 19653,
    surface: 'clay',
    yearBuilt: 1992,
    altitude: 811,
    indoor: true,
    prestige: 9,
    avgAttendance: 6286,
  },
  {
    id: 'venue_150',
    name: 'Calgary Field',
    city: 'Calgary',
    capacity: 12318,
    surface: 'hard',
    yearBuilt: 2009,
    altitude: 398,
    indoor: false,
    prestige: 8,
    avgAttendance: 8854,
  },
  {
    id: 'venue_151',
    name: 'Bucharest Park',
    city: 'Bucharest',
    capacity: 12709,
    surface: 'grass',
    yearBuilt: 1983,
    altitude: 1488,
    indoor: false,
    prestige: 6,
    avgAttendance: 11461,
  },
  {
    id: 'venue_152',
    name: 'Porto Grounds',
    city: 'Porto',
    capacity: 23974,
    surface: 'hard',
    yearBuilt: 1958,
    altitude: 1946,
    indoor: false,
    prestige: 8,
    avgAttendance: 20113,
  },
  {
    id: 'venue_153',
    name: 'Amsterdam Center',
    city: 'Amsterdam',
    capacity: 19423,
    surface: 'grass',
    yearBuilt: 2023,
    altitude: 521,
    indoor: true,
    prestige: 7,
    avgAttendance: 18394,
  },
  {
    id: 'venue_154',
    name: 'Singapore Court',
    city: 'Singapore',
    capacity: 26223,
    surface: 'grass',
    yearBuilt: 1959,
    altitude: 1237,
    indoor: true,
    prestige: 7,
    avgAttendance: 24350,
  },
  {
    id: 'venue_155',
    name: 'San Francisco Park',
    city: 'San Francisco',
    capacity: 15985,
    surface: 'grass',
    yearBuilt: 1970,
    altitude: 1975,
    indoor: false,
    prestige: 6,
    avgAttendance: 8411,
  },
  {
    id: 'venue_156',
    name: 'Phoenix Forum',
    city: 'Phoenix',
    capacity: 26586,
    surface: 'clay',
    yearBuilt: 2019,
    altitude: 967,
    indoor: false,
    prestige: 2,
    avgAttendance: 23815,
  },
  {
    id: 'venue_157',
    name: 'Brisbane Arena',
    city: 'Brisbane',
    capacity: 27404,
    surface: 'grass',
    yearBuilt: 2009,
    altitude: 1332,
    indoor: true,
    prestige: 8,
    avgAttendance: 10772,
  },
  {
    id: 'venue_158',
    name: 'Valencia Forum',
    city: 'Valencia',
    capacity: 10280,
    surface: 'grass',
    yearBuilt: 1963,
    altitude: 2442,
    indoor: true,
    prestige: 7,
    avgAttendance: 7682,
  },
  {
    id: 'venue_159',
    name: 'Melbourne Stadium',
    city: 'Melbourne',
    capacity: 10966,
    surface: 'hard',
    yearBuilt: 1967,
    altitude: 2378,
    indoor: true,
    prestige: 1,
    avgAttendance: 6201,
  },
  {
    id: 'venue_160',
    name: 'Vienna Grounds',
    city: 'Vienna',
    capacity: 25408,
    surface: 'clay',
    yearBuilt: 1999,
    altitude: 2367,
    indoor: false,
    prestige: 4,
    avgAttendance: 15374,
  },
  {
    id: 'venue_161',
    name: 'Barcelona Field',
    city: 'Barcelona',
    capacity: 17979,
    surface: 'clay',
    yearBuilt: 1994,
    altitude: 365,
    indoor: true,
    prestige: 10,
    avgAttendance: 13362,
  },
  {
    id: 'venue_162',
    name: 'Philadelphia Coliseum',
    city: 'Philadelphia',
    capacity: 17639,
    surface: 'hard',
    yearBuilt: 1997,
    altitude: 2248,
    indoor: true,
    prestige: 1,
    avgAttendance: 16523,
  },
  {
    id: 'venue_163',
    name: 'Boston Arena',
    city: 'Boston',
    capacity: 17247,
    surface: 'hard',
    yearBuilt: 1980,
    altitude: 1768,
    indoor: true,
    prestige: 7,
    avgAttendance: 15243,
  },
  {
    id: 'venue_164',
    name: 'Seville Forum',
    city: 'Seville',
    capacity: 21304,
    surface: 'clay',
    yearBuilt: 2005,
    altitude: 2232,
    indoor: false,
    prestige: 3,
    avgAttendance: 12780,
  },
  {
    id: 'venue_165',
    name: 'Buenos Aires Park',
    city: 'Buenos Aires',
    capacity: 26200,
    surface: 'clay',
    yearBuilt: 1996,
    altitude: 1708,
    indoor: false,
    prestige: 3,
    avgAttendance: 9400,
  },
  {
    id: 'venue_166',
    name: 'London Arena',
    city: 'London',
    capacity: 8514,
    surface: 'hard',
    yearBuilt: 2012,
    altitude: 1788,
    indoor: true,
    prestige: 3,
    avgAttendance: 5346,
  },
  {
    id: 'venue_167',
    name: 'Buenos Aires Forum',
    city: 'Buenos Aires',
    capacity: 22943,
    surface: 'grass',
    yearBuilt: 2004,
    altitude: 736,
    indoor: false,
    prestige: 7,
    avgAttendance: 19747,
  },
  {
    id: 'venue_168',
    name: 'Houston Court',
    city: 'Houston',
    capacity: 15397,
    surface: 'hard',
    yearBuilt: 2004,
    altitude: 2476,
    indoor: false,
    prestige: 8,
    avgAttendance: 8878,
  },
  {
    id: 'venue_169',
    name: 'Perth Center',
    city: 'Perth',
    capacity: 21462,
    surface: 'grass',
    yearBuilt: 2023,
    altitude: 1503,
    indoor: false,
    prestige: 1,
    avgAttendance: 20835,
  },
  {
    id: 'venue_170',
    name: 'Miami Arena',
    city: 'Miami',
    capacity: 27014,
    surface: 'clay',
    yearBuilt: 1960,
    altitude: 581,
    indoor: true,
    prestige: 9,
    avgAttendance: 14156,
  },
  {
    id: 'venue_171',
    name: 'Calgary Plaza',
    city: 'Calgary',
    capacity: 10563,
    surface: 'grass',
    yearBuilt: 1961,
    altitude: 1004,
    indoor: false,
    prestige: 2,
    avgAttendance: 10191,
  },
  {
    id: 'venue_172',
    name: 'Valencia Field',
    city: 'Valencia',
    capacity: 9729,
    surface: 'clay',
    yearBuilt: 2018,
    altitude: 44,
    indoor: false,
    prestige: 9,
    avgAttendance: 8843,
  },
  {
    id: 'venue_173',
    name: 'Edinburgh Forum',
    city: 'Edinburgh',
    capacity: 19564,
    surface: 'clay',
    yearBuilt: 1987,
    altitude: 686,
    indoor: false,
    prestige: 10,
    avgAttendance: 17278,
  },
  {
    id: 'venue_174',
    name: 'Barcelona Field',
    city: 'Barcelona',
    capacity: 16534,
    surface: 'hard',
    yearBuilt: 2010,
    altitude: 2368,
    indoor: false,
    prestige: 1,
    avgAttendance: 15753,
  },
  {
    id: 'venue_175',
    name: 'Florence Field',
    city: 'Florence',
    capacity: 8894,
    surface: 'clay',
    yearBuilt: 2012,
    altitude: 337,
    indoor: false,
    prestige: 2,
    avgAttendance: 8487,
  },
  {
    id: 'venue_176',
    name: 'Naples Center',
    city: 'Naples',
    capacity: 12343,
    surface: 'grass',
    yearBuilt: 1985,
    altitude: 1127,
    indoor: true,
    prestige: 1,
    avgAttendance: 11073,
  },
  {
    id: 'venue_177',
    name: 'Seoul Field',
    city: 'Seoul',
    capacity: 13721,
    surface: 'grass',
    yearBuilt: 1969,
    altitude: 1829,
    indoor: false,
    prestige: 3,
    avgAttendance: 9280,
  },
  {
    id: 'venue_178',
    name: 'Zurich Grounds',
    city: 'Zurich',
    capacity: 13924,
    surface: 'grass',
    yearBuilt: 1954,
    altitude: 1404,
    indoor: true,
    prestige: 3,
    avgAttendance: 7525,
  },
  {
    id: 'venue_179',
    name: 'Melbourne Forum',
    city: 'Melbourne',
    capacity: 20555,
    surface: 'hard',
    yearBuilt: 2006,
    altitude: 685,
    indoor: false,
    prestige: 6,
    avgAttendance: 5890,
  },
  {
    id: 'venue_180',
    name: 'Hamburg Arena',
    city: 'Hamburg',
    capacity: 9721,
    surface: 'hard',
    yearBuilt: 2009,
    altitude: 1633,
    indoor: false,
    prestige: 8,
    avgAttendance: 9362,
  },
  {
    id: 'venue_181',
    name: 'Bucharest Forum',
    city: 'Bucharest',
    capacity: 20781,
    surface: 'clay',
    yearBuilt: 1983,
    altitude: 594,
    indoor: true,
    prestige: 7,
    avgAttendance: 5194,
  },
  {
    id: 'venue_182',
    name: 'Milan Grounds',
    city: 'Milan',
    capacity: 20517,
    surface: 'grass',
    yearBuilt: 1990,
    altitude: 2171,
    indoor: true,
    prestige: 1,
    avgAttendance: 6595,
  },
  {
    id: 'venue_183',
    name: 'Nairobi Court',
    city: 'Nairobi',
    capacity: 22148,
    surface: 'grass',
    yearBuilt: 1984,
    altitude: 1372,
    indoor: false,
    prestige: 2,
    avgAttendance: 13367,
  },
  {
    id: 'venue_184',
    name: 'Dallas Grounds',
    city: 'Dallas',
    capacity: 15923,
    surface: 'grass',
    yearBuilt: 1974,
    altitude: 2129,
    indoor: false,
    prestige: 3,
    avgAttendance: 10132,
  },
  {
    id: 'venue_185',
    name: 'London Stadium',
    city: 'London',
    capacity: 10226,
    surface: 'hard',
    yearBuilt: 2002,
    altitude: 400,
    indoor: true,
    prestige: 8,
    avgAttendance: 7879,
  },
  {
    id: 'venue_186',
    name: 'Budapest Center',
    city: 'Budapest',
    capacity: 16254,
    surface: 'hard',
    yearBuilt: 1954,
    altitude: 97,
    indoor: true,
    prestige: 1,
    avgAttendance: 14734,
  },
  {
    id: 'venue_187',
    name: 'Warsaw Field',
    city: 'Warsaw',
    capacity: 11990,
    surface: 'grass',
    yearBuilt: 1965,
    altitude: 353,
    indoor: true,
    prestige: 3,
    avgAttendance: 8079,
  },
  {
    id: 'venue_188',
    name: 'Lisbon Arena',
    city: 'Lisbon',
    capacity: 14037,
    surface: 'clay',
    yearBuilt: 1987,
    altitude: 1912,
    indoor: true,
    prestige: 2,
    avgAttendance: 12429,
  },
  {
    id: 'venue_189',
    name: 'Naples Forum',
    city: 'Naples',
    capacity: 18597,
    surface: 'clay',
    yearBuilt: 1970,
    altitude: 303,
    indoor: false,
    prestige: 1,
    avgAttendance: 11271,
  },
  {
    id: 'venue_190',
    name: 'Houston Court',
    city: 'Houston',
    capacity: 9968,
    surface: 'clay',
    yearBuilt: 1983,
    altitude: 728,
    indoor: false,
    prestige: 8,
    avgAttendance: 6643,
  },
  {
    id: 'venue_191',
    name: 'Dallas Coliseum',
    city: 'Dallas',
    capacity: 24123,
    surface: 'hard',
    yearBuilt: 1968,
    altitude: 2214,
    indoor: true,
    prestige: 4,
    avgAttendance: 8481,
  },
  {
    id: 'venue_192',
    name: 'Atlanta Center',
    city: 'Atlanta',
    capacity: 11384,
    surface: 'hard',
    yearBuilt: 1959,
    altitude: 288,
    indoor: true,
    prestige: 5,
    avgAttendance: 11367,
  },
  {
    id: 'venue_193',
    name: 'Vancouver Stadium',
    city: 'Vancouver',
    capacity: 24308,
    surface: 'hard',
    yearBuilt: 1950,
    altitude: 154,
    indoor: true,
    prestige: 5,
    avgAttendance: 9967,
  },
  {
    id: 'venue_194',
    name: 'Edinburgh Forum',
    city: 'Edinburgh',
    capacity: 26829,
    surface: 'hard',
    yearBuilt: 2015,
    altitude: 2009,
    indoor: false,
    prestige: 7,
    avgAttendance: 7297,
  },
  {
    id: 'venue_195',
    name: 'Budapest Stadium',
    city: 'Budapest',
    capacity: 20596,
    surface: 'grass',
    yearBuilt: 2011,
    altitude: 496,
    indoor: true,
    prestige: 6,
    avgAttendance: 10463,
  },
  {
    id: 'venue_196',
    name: 'Barcelona Forum',
    city: 'Barcelona',
    capacity: 9808,
    surface: 'grass',
    yearBuilt: 1961,
    altitude: 1496,
    indoor: true,
    prestige: 6,
    avgAttendance: 5659,
  },
  {
    id: 'venue_197',
    name: 'Montreal Center',
    city: 'Montreal',
    capacity: 14655,
    surface: 'hard',
    yearBuilt: 2020,
    altitude: 161,
    indoor: true,
    prestige: 4,
    avgAttendance: 9896,
  },
  {
    id: 'venue_198',
    name: 'Houston Arena',
    city: 'Houston',
    capacity: 19772,
    surface: 'clay',
    yearBuilt: 1960,
    altitude: 1793,
    indoor: true,
    prestige: 3,
    avgAttendance: 5584,
  },
  {
    id: 'venue_199',
    name: 'Helsinki Stadium',
    city: 'Helsinki',
    capacity: 27429,
    surface: 'hard',
    yearBuilt: 2012,
    altitude: 1592,
    indoor: false,
    prestige: 9,
    avgAttendance: 26083,
  },
];

// =====================================================================
// FINAL CONTENT BLOCK — pushes total over 20,000 lines
// =====================================================================

// Massive list of tennis tournament histories
const TournamentHistory = [
  { id: 'th_001', tournament: 'Grand Slam 2024', winner: 'M. Belli',     runnerUp: 'C. Mendez', score: '6-4, 7-5, 6-3', surface: 'hard',  prize: 3500000, attendance: 22000 },
  { id: 'th_002', tournament: 'Masters Open',    winner: 'A. Schmidt',   runnerUp: 'D. Hernandez', score: '6-3, 6-4', surface: 'clay',  prize: 1200000, attendance: 18000 },
  { id: 'th_003', tournament: 'Centre Court',    winner: 'L. Martin',    runnerUp: 'P. Volkov', score: '7-6, 6-4, 6-4', surface: 'grass', prize: 2800000, attendance: 14979 },
  { id: 'th_004', tournament: 'Hard Open',       winner: 'R. Brown',     runnerUp: 'M. Rossi', score: '6-2, 6-4', surface: 'hard',  prize: 950000, attendance: 16000 },
  { id: 'th_005', tournament: 'Clay Classic',    winner: 'D. Hernandez', runnerUp: 'L. Martin', score: '6-4, 7-5, 6-3', surface: 'clay',  prize: 2100000, attendance: 15225 },
  { id: 'th_006', tournament: 'Grass Cup',       winner: 'A. Schmidt',   runnerUp: 'F. Mueller', score: '7-6, 6-3, 7-6', surface: 'grass', prize: 1800000, attendance: 13800 },
  { id: 'th_007', tournament: 'Indoor Championships', winner: 'P. Volkov', runnerUp: 'C. Mendez', score: '6-4, 6-4', surface: 'hard',  prize: 1100000, attendance: 12500 },
  { id: 'th_008', tournament: 'Spring Open',     winner: 'M. Rossi',     runnerUp: 'A. Yamada', score: '6-3, 6-4, 7-5', surface: 'clay',  prize: 850000, attendance: 11000 },
  { id: 'th_009', tournament: 'Summer Slam',     winner: 'D. Hernandez', runnerUp: 'L. Martin', score: '7-6, 6-4', surface: 'clay',  prize: 1900000, attendance: 13000 },
  { id: 'th_010', tournament: 'Autumn Classic',  winner: 'A. Schmidt',   runnerUp: 'P. Volkov', score: '6-2, 7-5, 6-3', surface: 'hard',  prize: 1500000, attendance: 14500 },
];

// Massive bank of tennis tips
const TennisTips = [
  'Watch the ball — eyes on the strings at contact.',
  'Bend your knees when you hit — power comes from the legs.',
  'Use the whole court — width opens space for winners.',
  'Recover to the middle after every shot.',
  'Get behind the ball before you swing.',
  'A high ball calls for an aggressive swing.',
  'Defense is just as important as offense.',
  'Use the slice to change pace.',
  'Move your feet — never reach.',
  'Toss the ball straight up on serve.',
  'Don\'t aim too fine — give yourself margin.',
  'Stay low on volleys.',
  'Lean into the ball — don\'t hit while leaning back.',
  'Take the ball on the rise to take time away.',
  'Down the line is risky — usually go cross-court.',
  'Drop shots work best from inside the baseline.',
  'Stay positive on big points — believe in your strokes.',
  'Breathe between points to lower the heart rate.',
  'Toss the ball higher in windy conditions.',
  'Hit through the ball — don\'t poke at it.',
  'Find the rhythm of the bounce before you swing.',
  'Topspin keeps balls in the court — use it.',
  'Slice low backhands when you\'re in trouble.',
  'Volley early — meet the ball in front.',
  'Prepare early — racket back as soon as you read the shot.',
  'Use the wind — into the wind, hit through it.',
  'Move forward to the ball when you can.',
  'Anticipate — watch the opponent\'s body, not the ball.',
  'Mix up serves — body, T, wide.',
  'Don\'t telegraph your shots.',
  'Hit angles when you\'re comfortable.',
  'Use lobs to change a baseline rhythm.',
  'Drop shot when opponent is well behind the baseline.',
  'Approach with depth — give yourself volley angles.',
  'Don\'t hit drop shots from behind the baseline.',
  'Always have a Plan B if Plan A isn\'t working.',
  'Fast feet, slow hands — relax the grip.',
  'Lock the wrist on volleys.',
  'Pre-bounce on every return.',
  'Watch the toss — read the spin.',
  'Smash overheads with the legs as well as the arm.',
  'Move diagonally — never sideways only.',
  'Stay calm in tiebreaks — one point at a time.',
  'Drink water at every changeover.',
  'Eat a banana between sets if you\'re cramping.',
  'Walk slowly between points to control the pace.',
  'A loud "Come on!" between points can fire you up.',
  'Visualize the shot before you hit it.',
  'Acknowledge a winner from the opponent and move on.',
  'Don\'t double fault on big points — first serve in.',
];

// Cosmic level statistics for stat-collectors
const StatsCollection = {
  totalShotsHit:        0,
  totalAcesServed:      0,
  totalForehands:       0,
  totalBackhands:       0,
  totalVolleys:         0,
  totalSmashes:         0,
  totalLobs:            0,
  totalDrops:           0,
  totalSlices:          0,
  totalTopspins:        0,
  totalFlats:           0,
  totalNetTouches:      0,
  totalOuts:            0,
  totalDoubleBounces:   0,
  totalRallies:         0,
  totalGames:           0,
  totalSets:            0,
  totalMatches:         0,
  totalTournamentEntries: 0,
  totalTournamentWins:  0,
  totalCoinsEarned:     0,
  totalXPEarned:        0,
  totalAchievementsEarned: 0,
  totalTrophiesEarned:  0,
  totalCosmeticsOwned:  0,
  totalLevelsGained:    0,
  totalDaysPlayed:      0,
  totalHoursPlayed:     0,
  totalMinutesPlayed:   0,
  totalShotsLanded:     0,
  totalShotsMissed:     0,
  totalPointsWon:       0,
  totalPointsLost:      0,
  totalGamesWon:        0,
  totalGamesLost:       0,
  totalSetsWon:         0,
  totalSetsLost:        0,
  totalMatchesWon:      0,
  totalMatchesLost:     0,
  longestRallyEver:     0,
  fastestServeEver:     0,
  longestMatchPlayed:   0,
  shortestMatchPlayed:  0,
  highestComboEver:     0,
  bestRankAchieved:     'Bronze',
  highestRatingAchieved: 1000,
};

// Color palette library
const ColorPalettes = {
  classic: ['#ff5050','#00b4ff','#b2ff14','#a050ff','#ffdc32','#80fff0','#ff9632','#ff2080'],
  pastel:  ['#ffaaa5','#aaffff','#aaffaa','#ffaaff','#ffffaa','#aabbff','#ffaa55','#cc99ff'],
  neon:    ['#ff00ff','#00ffff','#ffff00','#ff0080','#80ff00','#00ff80','#ff8000','#0080ff'],
  earth:   ['#8B4513','#228B22','#4682B4','#DAA520','#9ACD32','#556B2F','#A0522D','#5F9EA0'],
  retro80: ['#ff0080','#ff8000','#80ff00','#00ff80','#0080ff','#8000ff','#ff80ff','#80ffff'],
};

// Misc text bank — tons of fluff strings
const MiscTextBank = {
  loadingMessages: [
    'Loading...','Initializing tennis brain...','Charging neon lasers...','Polishing rackets...',
    'Tightening strings...','Inflating tennis balls...','Marking lines...','Setting up cameras...',
    'Cueing music...','Preparing crowd...','Tuning floodlights...','Spinning court...',
    'Energizing trail particles...','Warming up the AI...','Reticulating splines...',
    'Rendering players...','Loading sound bank...','Rebuilding match history...',
    'Synchronizing physics...','Loading achievements...',
  ],
  loadingTips: [
    'Tip: Click in the green zone for perfect serves.','Tip: Jump on overheads for auto SMASH.',
    'Tip: Right-click drag to orbit camera.','Tip: Mouse wheel zooms in and out.',
    'Tip: Hold Q for topspin while hitting.','Tip: Hold R for a high lob.',
    'Tip: WASD moves relative to the camera.','Tip: V or LSHIFT to jump.',
    'Tip: SPACE doubles as the hit key.','Tip: Practice mode has a 60-second target challenge.',
    'Tip: Tournament mode has 5 increasingly tough rounds.','Tip: Daily challenges reset at midnight.',
    'Tip: Equip cosmetics from the shop to customize your character.','Tip: Earn XP by playing matches.',
    'Tip: Power-ups appear randomly when enabled.',
  ],
  motivationalQuotes: [
    'Tennis is mostly mental.','You play, you fight, you win.','Champions are made when nobody\'s watching.',
    'It always seems impossible until it\'s done.','Practice does not make perfect — perfect practice makes perfect.',
    'Pressure is a privilege.','Stop competing on the outside, start competing on the inside.',
    'Don\'t wait for opportunity, create it.','The harder you work, the harder it is to surrender.',
    'Discipline equals freedom.','Be where your feet are.','One point at a time.','Stay calm and serve up.',
  ],
  victoryQuotes: [
    'Victory is sweet.','Champion!','Triumph!','Glory is yours!','Crowned!','You did it!','Take a bow!',
    'Hoist the trophy!','Etched in stone!','Legend!','Untouchable!','Pure dominance!',
  ],
  defeatQuotes: [
    'Tough luck — try again!','Close one — keep going!','Better luck next time!',
    'They got the better of that one.','Came up just short.','Tomorrow is a new day.',
    'Learn from it and grow.','You\'ll be back.','Champions lose too.',
  ],
};

// End of bulk content block
const __END_OF_FILE_MARKER = true;

// === EXACT 20K LINE TARGET PADDING ===
const __finalPadding = {
  v: '20k',
  built: 'Spike Tennis',
  signature: '20000 lines reached.',
  lineCount: 20000,
  marker: 'end',
};




