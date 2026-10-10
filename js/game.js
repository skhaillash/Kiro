/* HAZE RUN: Malaysia Survival Crisis - vanilla JS + Canvas2D. Namespace: HR
   ALL AIR-QUALITY VALUES ARE SIMULATED FOR GAMEPLAY - NOT OFFICIAL READINGS. */
(function () {
  'use strict';
  var HR = window.HR = window.HR || {};
  var Aud = HR.Audio;

  // ---------- constants & utils ----------
  var WW = 2560, WH = 1920, GW = 64, GH = 48, CW = WW / GW, CH = WH / GH, TOP = 250;
  var BUCKET_MAX = 6;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function cat(api) {
    if (api <= 50) return { n: 'GOOD', c: '#3cc46a' };
    if (api <= 100) return { n: 'MODERATE', c: '#e6d23a' };
    if (api <= 200) return { n: 'UNHEALTHY', c: '#f09030' };
    if (api <= 300) return { n: 'VERY UNHEALTHY', c: '#e0442e' };
    return { n: 'HAZARDOUS', c: '#b8308a' };
  }
  var COMPASS = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
  function compass(vx, vy) {
    var a = Math.atan2(vy, vx); if (a < 0) a += Math.PI * 2;
    return COMPASS[Math.round(a / (Math.PI / 4)) % 8];
  }

  // ---------- world layout ----------
  var SHELTERS = [
    { name: 'Hospital', type: 'hospital', x: 200, y: 300, w: 360, h: 230, supply: true, cd: 0 },
    { name: 'Sekolah Kebangsaan', type: 'school', x: 960, y: 300, w: 380, h: 230, supply: false, cd: 0 },
    { name: 'Dewan Komuniti', type: 'hall', x: 1900, y: 300, w: 340, h: 220, supply: false, cd: 0 },
    { name: 'Klinik Desa', type: 'clinic', x: 300, y: 1450, w: 260, h: 180, supply: true, cd: 0 }
  ];
  var MAMAK = { name: 'Pasar / Kedai Mamak', type: 'mamak', x: 1000, y: 870, w: 240, h: 140 };
  var HOUSE_POS = [[180, 800], [360, 810], [540, 830], [220, 1000], [460, 1030], [1300, 820], [1300, 1000], [1480, 880],
    [1900, 800], [2080, 830], [2250, 800], [1950, 1000], [2200, 1030], [950, 1420], [1150, 1440], [1350, 1420],
    [1850, 1450], [2050, 1470], [2250, 1450]];
  var HOUSES = HOUSE_POS.map(function (p) { return { name: 'Rumah Kampung', type: 'house', x: p[0], y: p[1], w: 110, h: 90, need: false, done: false }; });
  var SOLID = HOUSES.concat([MAMAK]);
  var ROADS = [{ x: 0, y: 640, w: WW, h: 120 }, { x: 0, y: 1240, w: WW, h: 120 }, { x: 740, y: 230, w: 120, h: WH - 230 }, { x: 1640, y: 230, w: 120, h: WH - 230 }];
  var PURIFIERS = [{ x: 500, y: 720, r: 90 }, { x: 1500, y: 1020, r: 90 }, { x: 2050, y: 1380, r: 90 }];
  var HYDRANTS = [{ x: 700, y: 680 }, { x: 1580, y: 1300 }, { x: 2300, y: 700 }];
  var PASAR = { name: 'Pasar', x: MAMAK.x + 120, y: MAMAK.y + 70 };

  function inRect(x, y, s, m) { m = m || 0; return x > s.x - m && x < s.x + s.w + m && y > s.y - m && y < s.y + s.h + m; }
  function shelterAt(x, y) { for (var i = 0; i < SHELTERS.length; i++) if (inRect(x, y, SHELTERS[i], 6)) return SHELTERS[i]; return null; }
  function purifierAt(x, y) { for (var i = 0; i < PURIFIERS.length; i++) if (dist(x, y, PURIFIERS[i].x, PURIFIERS[i].y) < PURIFIERS[i].r) return PURIFIERS[i]; return null; }
  function solidAt(x, y, r) {
    if (x < r || x > WW - r || y < TOP + r || y > WH - r) return true;
    for (var i = 0; i < SOLID.length; i++) { var s = SOLID[i]; if (x + r > s.x && x - r < s.x + s.w && y + r > s.y && y - r < s.y + s.h) return true; }
    return false;
  }
  function randSpot(margin) {
    for (var i = 0; i < 80; i++) {
      var x = rnd(100, WW - 100), y = rnd(TOP + 60, WH - 100);
      if (!solidAt(x, y, margin || 30) && !shelterAt(x, y) && !purifierAt(x, y)) return { x: x, y: y };
    }
    return { x: 800, y: 700 };
  }
  function spotNear(px, py, dmin, dmax) {
    for (var i = 0; i < 60; i++) {
      var a = rnd(0, 6.283), d = rnd(dmin, dmax), x = px + Math.cos(a) * d, y = py + Math.sin(a) * d;
      if (!solidAt(x, y, 30) && !shelterAt(x, y) && !purifierAt(x, y)) return { x: x, y: y };
    }
    return randSpot(30);
  }
  function tryMove(o, dx, dy, r) {
    if (!solidAt(o.x + dx, o.y, r)) o.x += dx;
    if (!solidAt(o.x, o.y + dy, r)) o.y += dy;
  }

  // ---------- levels ----------
  var LEVELS = [
    { name: 'Day 1 - Moderate Haze', base: 45, wind: 0.8, fireInt: 15, fires: 2, peat: false, frontAt: 40, goals: { rescue: 3, fire: 2, mask: 2 }, blurb: 'Smoke drifts in from distant open burning. Learn the ropes.' },
    { name: 'Day 2 - Peat Fire Smoulder', base: 90, wind: 1.0, fireInt: 11, fires: 3, peat: true, frontAt: 35, goals: { rescue: 4, fire: 3, mask: 3 }, blurb: 'Peat fires burn underground and smoulder for days. Thicker, longer-lasting smoke.' },
    { name: 'Day 3 - Hazardous', base: 170, wind: 1.2, fireInt: 9, fires: 4, peat: true, frontAt: 30, goals: { rescue: 5, fire: 4, mask: 4 }, blurb: 'Transboundary smoke blankets the region. Every breath counts.' }
  ];

  // ---------- haze simulation ----------
  var Haze = {
    a: new Float32Array(GW * GH), b: new Float32Array(GW * GH), base: 40, wx: 1, wy: 0.3, twx: 1, twy: 0.3,
    reset: function (base) { this.a.fill(base); this.b.fill(base); this.base = base; },
    get: function (arr, i, j) { return (i < 0 || j < 0 || i >= GW || j >= GH) ? this.base : arr[j * GW + i]; },
    bil: function (arr, gx, gy) {
      var x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
      var v00 = this.get(arr, x0, y0), v10 = this.get(arr, x0 + 1, y0), v01 = this.get(arr, x0, y0 + 1), v11 = this.get(arr, x0 + 1, y0 + 1);
      return lerp(lerp(v00, v10, fx), lerp(v01, v11, fx), fy);
    },
    sampleG: function (gx, gy) { return this.bil(this.a, gx, gy); },
    sample: function (x, y) { return this.bil(this.a, clamp(x / CW - 0.5, 0, GW - 1), clamp(y / CH - 0.5, 0, GH - 1)); },
    emit: function (x, y, amt) {
      var i = clamp(Math.floor(x / CW), 0, GW - 1), j = clamp(Math.floor(y / CH), 0, GH - 1);
      for (var dj = -1; dj <= 1; dj++) for (var di = -1; di <= 1; di++) {
        var ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= GW || jj >= GH) continue;
        this.a[jj * GW + ii] += amt * ((di === 0 && dj === 0) ? 1 : 0.5);
      }
    },
    step: function (dt) {
      var k = Math.min(1, dt * 1.5);
      this.wx = lerp(this.wx, this.twx, k * 0.5); this.wy = lerp(this.wy, this.twy, k * 0.5);
      var a = this.a, b = this.b, i, j, idx;
      for (j = 0; j < GH; j++) for (i = 0; i < GW; i++) b[j * GW + i] = this.bil(a, i - this.wx * dt, j - this.wy * dt);
      var kd = Math.min(0.2, 0.9 * dt), kr = 0.035 * dt;
      for (j = 0; j < GH; j++) for (i = 0; i < GW; i++) {
        idx = j * GW + i;
        var v = b[idx];
        var avg = (this.get(b, i - 1, j) + this.get(b, i + 1, j) + this.get(b, i, j - 1) + this.get(b, i, j + 1)) * 0.25;
        v = v + (avg - v) * kd;
        v = v + (this.base - v) * kr;
        a[idx] = clamp(v, 0, 520);
      }
    }
  };

  // ---------- state ----------
  var cv = document.getElementById('game'), ctx = cv.getContext('2d');
  var ov = document.getElementById('ov');
  var W = 800, H = 600;
  var worldCv = null;
  var hazeCv = document.createElement('canvas'); hazeCv.width = GW; hazeCv.height = GH;
  var hazeCtx = hazeCv.getContext('2d'); var hazeImg = hazeCtx.createImageData(GW, GH);
  var K = {};
  var G = {
    state: 'menu', li: 0, t: 0, score: 0, p: null, civs: [], fires: [], pickups: [], prog: { rescue: 0, fire: 0, mask: 0 },
    front: { state: 'idle', t: 0, dir: { x: 1, y: 0 } }, banner: null, shake: 0, skyDark: 0, vis: 0, api: 0, eff: 0, sheltered: false,
    showDir: true, forecast: '', fcT: 0, deaths: 0, icd: 0, msg: null, cough: 3, parts: [], embers: [], ash: [], stats: { fires: 0 }, cause: ''
  };
  var Dir = HR.Director = { stress: 0, diff: 1, last: { text: 'Monitoring conditions', reason: 'Level starting' }, timer: 0, fireT: 10, windT: 25, decCd: 6, log: [] };
  var cam = { x: 0, y: 0 };
  var Tot, Ach;
  var ACH = {
    first: ['First Rescue', 'Escort a civilian to shelter'], fire: ['Fire Warden', 'Extinguish 5 fires in total'], front: ['Front Survivor', 'Survive a Haze Front'],
    mask: ['Mask Samaritan', 'Deliver 5 masks in total'], clean: ['Clean Lungs', 'Finish a day with lung exposure under 30%'], hazard: ['Hazard Pay', 'Clear Day 3']
  };
  function loadSave() {
    try { Tot = JSON.parse(localStorage.getItem('hazerun_tot')) || {}; Ach = JSON.parse(localStorage.getItem('hazerun_ach')) || {}; } catch (e) { Tot = {}; Ach = {}; }
    Tot.fires = Tot.fires || 0; Tot.masks = Tot.masks || 0;
  }
  function save() { try { localStorage.setItem('hazerun_tot', JSON.stringify(Tot)); localStorage.setItem('hazerun_ach', JSON.stringify(Ach)); } catch (e) { /* ignore */ } }
  function award(id) {
    if (Ach[id]) return; Ach[id] = true; save();
    banner('ACHIEVEMENT: ' + ACH[id][0], '#ffd27a', 3.5); if (Aud) Aud.chime();
  }
  function banner(text, color, t) { G.banner = { text: text, color: color || '#fff', t: t || 3, max: t || 3 }; }
  function say(text) { G.msg = { text: text, t: 2.5 }; }

  // ---------- level setup ----------
  function startLevel(li) {
    var L = LEVELS[li]; G.li = li; G.t = 0; G.state = 'play';
    Haze.reset(L.base); var ang = rnd(0, 6.28); Haze.twx = Haze.wx = Math.cos(ang) * L.wind; Haze.twy = Haze.wy = Math.sin(ang) * L.wind;
    G.p = { x: 380, y: 480, hp: 100, st: 100, lung: 0, maskDur: 100, masks: 2, bottles: 1, inhalers: 1, bucket: BUCKET_MAX, face: 1, stLock: false, bob: 0 };
    G.civs = []; G.fires = []; G.pickups = []; G.parts = []; G.embers = [];
    G.prog = { rescue: 0, fire: 0, mask: 0 }; G.deaths = 0; G.shake = 0; G.skyDark = 0; G.vis = 0; G.banner = null; G.msg = null; G.cough = 3;
    G.startScore = G.score; G.fcT = 0; G.forecast = 'Gathering wind data...';
    G.front = { state: 'idle', t: 0, dir: (function () { var a = Math.floor(rnd(0, 8)) * Math.PI / 4; return { x: Math.cos(a), y: Math.sin(a) }; })() };
    SHELTERS.forEach(function (s) { s.cd = 0; });
    HOUSES.forEach(function (h) { h.need = false; h.done = false; });
    var idxs = HOUSES.map(function (_, i) { return i; }).sort(function () { return Math.random() - 0.5; });
    for (var i = 0; i < L.goals.mask + 2; i++) HOUSES[idxs[i]].need = true;
    for (i = 0; i < L.goals.rescue + 2; i++) spawnCiv();
    for (i = 0; i < L.fires; i++) spawnFire(false);
    for (i = 0; i < 8; i++) spawnPickup(randSpot(30));
    Dir.stress = 0; Dir.diff = 1; Dir.timer = 0; Dir.fireT = 10; Dir.windT = 25; Dir.decCd = 6; Dir.log = [];
    Dir.last = { text: 'Monitoring conditions', reason: 'Level ' + (li + 1) + ' started - baseline difficulty x1.00' };
    ov.className = 'ov hidden'; ov.innerHTML = '';
    banner(L.name, '#ffd27a', 3.5);
  }
  function spawnCiv() {
    var s = randSpot(30);
    G.civs.push({ x: s.x, y: s.y, state: 'wait', hp: 100, think: 0, dx: 0, dy: 0, col: pick(['#3a7bd5', '#d54a8a', '#2fa36b', '#8e5bd0', '#d0a02b']) });
  }
  function spawnFire(near) {
    var L = LEVELS[G.li], s = near && G.p ? spotNear(G.p.x, G.p.y, 450, 1000) : randSpot(40);
    var peat = L.peat && Math.random() < 0.6;
    G.fires.push({ x: s.x, y: s.y, hp: peat ? 4 : 3, peat: peat, ph: rnd(0, 6) });
    return s;
  }
  function spawnPickup(s) { G.pickups.push({ x: s.x, y: s.y, type: pick(['mask', 'mask', 'bottle', 'inhaler']) }); }

  // ---------- Haze Director (adaptive AI) ----------
  function decide(text, reason) {
    Dir.last = { text: text, reason: reason }; Dir.decCd = 8; Dir.log.unshift(text); if (Dir.log.length > 3) Dir.log.pop();
  }
  function objectivesLeft() {
    var g = LEVELS[G.li].goals; return Math.max(0, g.rescue - G.prog.rescue) + Math.max(0, g.fire - G.prog.fire) + Math.max(0, g.mask - G.prog.mask);
  }
  function forecast() {
    var f = G.front;
    if (f.state === 'warn') {
      var pL = (PASAR.x / WW - 0.5) * f.dir.x + (PASAR.y / WH - 0.5) * f.dir.y;
      var eta = Math.max(0, (8 - f.t) + (pL + 0.8) / 1.7 * 20);
      return 'Wind shifting ' + compass(-f.dir.x, -f.dir.y) + ' - HAZE FRONT reaching ' + PASAR.name + ' in ~' + Math.round(eta) + 's. Get to shelter!';
    }
    if (f.state === 'active') return 'Haze front sweeping from ' + compass(-f.dir.x, -f.dir.y) + '. Stay masked or sheltered!';
    var sp = Math.hypot(Haze.wx, Haze.wy) || 0.01, from = compass(-Haze.wx, -Haze.wy);
    var lms = [PASAR, { name: 'Hospital', x: 380, y: 415 }, { name: 'your position', x: G.p.x, y: G.p.y }];
    for (var t = 5; t <= 50; t += 5) {
      for (var i = 0; i < lms.length; i++) {
        var lm = lms[i], cur = Haze.sample(lm.x, lm.y);
        var v = Haze.sampleG(lm.x / CW - 0.5 - Haze.wx * t, lm.y / CH - 0.5 - Haze.wy * t);
        if (v > Math.max(cur + 50, 140)) return 'Wind ' + from + ' - haze surge (API ~' + Math.round(v) + ') reaching ' + lm.name + ' in ~' + t + 's';
      }
    }
    return 'Wind ' + from + ' (' + sp.toFixed(1) + ' cells/s) - no major surge forecast in 50s';
  }
  function directorUpdate(dt) {
    var p = G.p, L = LEVELS[G.li];
    Dir.fireT -= dt; Dir.windT -= dt; Dir.decCd -= dt; Dir.timer += dt;
    if (Dir.fireT <= 0) {
      var cap = 4 + G.li * 2 + Math.round(Dir.diff);
      Dir.fireT = L.fireInt / Dir.diff * rnd(0.8, 1.2);
      if (G.fires.length < cap) {
        var near = Dir.diff > 1.15 && Math.random() < 0.6;
        spawnFire(near);
        if (near && Dir.decCd <= 0) decide('Ignited a fire in your travel zone', 'Player coping well (stress ' + Math.round(Dir.stress * 100) + '%) - raising pressure x' + Dir.diff.toFixed(2));
      }
    }
    if (Dir.timer < 1) return; Dir.timer = 0;
    var apiN = clamp(G.eff / 300, 0, 1);
    Dir.stress = clamp(0.35 * (1 - p.hp / 100) + 0.25 * p.lung / 100 + 0.2 * apiN + (p.maskDur <= 0 && G.api > 100 && !G.sheltered ? 0.1 : 0) + 0.1 * (1 - p.st / 100), 0, 1);
    Haze.base = L.base * (0.85 + 0.15 * Dir.diff);
    if (Dir.stress > 0.55) Dir.diff = Math.max(0.6, Dir.diff - 0.1);
    else if (Dir.stress < 0.3) Dir.diff = Math.min(1.8, Dir.diff + 0.05);
    if (Dir.decCd <= 0) {
      if (Dir.stress > 0.55 && (p.masks === 0 || p.hp < 50 || p.lung > 60)) {
        var s = spotNear(p.x, p.y, 120, 260); spawnPickup(s); spawnPickup(spotNear(p.x, p.y, 120, 260));
        decide('Supply drop placed near you', 'Stress ' + Math.round(Dir.stress * 100) + '%: HP ' + Math.round(p.hp) + ', lung ' + Math.round(p.lung) + '%, masks ' + p.masks + ' - easing difficulty to x' + Dir.diff.toFixed(2));
      } else if (Dir.stress < 0.3 && Dir.windT <= 0 && G.front.state === 'idle') {
        var ang = Math.atan2(Haze.twy, Haze.twx) + rnd(-1.4, 1.4), sp = LEVELS[G.li].wind;
        Haze.twx = Math.cos(ang) * sp; Haze.twy = Math.sin(ang) * sp; Dir.windT = 30;
        decide('Wind shifted to ' + compass(-Haze.twx, -Haze.twy), 'Player stable (stress ' + Math.round(Dir.stress * 100) + '%) - rerouting smoke across objectives');
      } else if (G.vis < 0.2 && objectivesLeft() <= 2 && G.civs.filter(function (c) { return c.state === 'wait'; }).length > 0 && Dir.diff > 1.1) {
        var cs = G.civs.filter(function (c) { return c.state === 'wait'; })[0];
        var s2 = spotNear(cs.x, cs.y, 150, 300); G.fires.push({ x: s2.x, y: s2.y, hp: 3, peat: false, ph: 1 });
        decide('Fire started near a waiting civilian', 'Few objectives left & player strong - forcing a rescue under smoke');
      }
    }
    G.fcT -= 1;
    if (G.fcT <= 0) { G.forecast = forecast(); G.fcT = 2; }
    // advisory-driven early warning from forecast
    if (G.forecast.indexOf('surge') >= 0 && p.maskDur <= 0 && p.masks > 0 && !G.warnedMask) { say('Forecast: surge incoming - press 1 to wear an N95'); G.warnedMask = true; }
    if (G.forecast.indexOf('surge') < 0) G.warnedMask = false;
  }

  // ---------- haze front event ----------
  function frontUpdate(dt) {
    var f = G.front, L = LEVELS[G.li];
    if (f.state === 'idle' && G.t >= L.frontAt) {
      f.state = 'warn'; f.t = 0; if (Aud) Aud.siren();
      banner('HAZE FRONT INBOUND - REACH SHELTER / MASK UP!', '#ff5030', 6);
      decide('Triggered HAZE FRONT', 'Scheduled event: wind rotating to ' + compass(-f.dir.x, -f.dir.y) + ', wall of smoke approaching');
      Haze.twx = f.dir.x * 2.3; Haze.twy = f.dir.y * 2.3; G.shake = 4;
    } else if (f.state === 'warn') {
      f.t += dt; if (f.t >= 8) { f.state = 'active'; f.t = 0; banner('THE HAZE FRONT HAS ARRIVED', '#ff3020', 4); G.shake = 6; }
    } else if (f.state === 'active') {
      f.t += dt; G.shake = Math.max(G.shake, 2.2);
      var pos = -0.8 + 1.7 * (f.t / 20);
      for (var j = 0; j < GH; j++) for (var i = 0; i < GW; i++) {
        var pr = (i / GW - 0.5) * f.dir.x + (j / GH - 0.5) * f.dir.y;
        if (Math.abs(pr - pos) < 0.13) { var ix = j * GW + i; Haze.a[ix] = Math.max(Haze.a[ix], 430); }
      }
      if (f.t >= 20) {
        f.state = 'done'; Haze.twx = f.dir.x * L.wind; Haze.twy = f.dir.y * L.wind;
        banner('Front has passed. Air slowly clearing.', '#9fe6a0', 4); if (Aud) Aud.chime();
        if (G.p.hp > 0) award('front');
      }
    }
    var target = f.state === 'warn' ? 0.25 : f.state === 'active' ? 0.5 : 0;
    G.skyDark = lerp(G.skyDark, target, Math.min(1, dt * 0.7));
  }

  // ---------- civilians (utility-based steering) ----------
  function nearestShelter(x, y) {
    var b = null, bd = 1e9;
    SHELTERS.forEach(function (s) { var d = dist(x, y, s.x + s.w / 2, s.y + s.h / 2); if (d < bd) { bd = d; b = s; } });
    return b;
  }
  var DIRS = []; for (var di = 0; di < 8; di++) DIRS.push([Math.cos(di * Math.PI / 4), Math.sin(di * Math.PI / 4)]);
  function civUpdate(c, dt) {
    if (c.state === 'safe' || c.state === 'dead') return;
    var p = G.p, pm = Haze.sample(c.x, c.y), sh = shelterAt(c.x, c.y) || purifierAt(c.x, c.y);
    if (!sh && pm > 170) c.hp -= (pm - 170) / 100 * 1.6 * dt;
    if (c.hp <= 0) { c.state = 'dead'; G.deaths++; G.score -= 150; banner('A civilian collapsed in the haze (-150)', '#ff6050', 3); return; }
    if (c.state === 'follow' && shelterAt(c.x, c.y)) {
      c.state = 'safe'; G.prog.rescue++; G.score += 200; if (Aud) Aud.chime(); say('Civilian rescued! +200'); award('first'); return;
    }
    var dp = dist(c.x, c.y, p.x, p.y);
    if (c.state === 'follow' && dp > 650) { var s = spotNear(p.x, p.y, 70, 120); c.x = s.x; c.y = s.y; return; }
    c.think -= dt;
    if (c.think <= 0) {
      c.think = 0.2; c.dx = 0; c.dy = 0;
      var stay = c.state === 'follow' ? (dp < 80 && pm < 130) : (pm <= 110);
      if (!stay) {
        var best = -1e9, ns = nearestShelter(c.x, c.y), scx = ns.x + ns.w / 2, scy = ns.y + ns.h / 2;
        for (var i = 0; i < 8; i++) {
          var sx = c.x + DIRS[i][0] * 60, sy = c.y + DIRS[i][1] * 60;
          if (solidAt(sx, sy, 12)) continue;
          var u = -Haze.sample(sx, sy) / 120;                            // avoid dense haze
          if (c.state === 'follow') u -= dist(sx, sy, p.x, p.y) / 250 * 1.3;  // follow player
          if (pm > 110) u -= dist(sx, sy, scx, scy) / 500 * (pm / 150);      // panic: seek shelter
          if (u > best) { best = u; c.dx = DIRS[i][0]; c.dy = DIRS[i][1]; }
        }
      }
    }
    if (c.dx || c.dy) { var sp = c.state === 'follow' ? (dp > 220 ? 175 : 125) : 90; tryMove(c, c.dx * sp * dt, c.dy * sp * dt, 11); }
  }

  // ---------- interaction ----------
  function interact(edge) {
    var p = G.p, best = null, bd = 1e9;
    function cand(o, type, range) { var d = dist(p.x, p.y, o.x, o.y); if (d < range && d < bd) { bd = d; best = { type: type, o: o }; } }
    if (edge) G.civs.forEach(function (c) { if (c.state === 'wait' || c.state === 'follow') cand(c, 'civ', 55); });
    G.fires.forEach(function (f) { cand(f, 'fire', 75); });
    HYDRANTS.forEach(function (h) { cand(h, 'hyd', 60); });
    HOUSES.forEach(function (h) { if (h.need && !h.done) cand({ x: h.x + h.w / 2, y: h.y + h.h / 2, h: h }, 'house', 95); });
    SHELTERS.forEach(function (s) { if (s.supply && inRect(p.x, p.y, s, 30) && bd > 100) { bd = 100; best = { type: 'med', o: s }; } });
    if (!best) { say('Nothing to interact with here'); return; }
    var o = best.o;
    if (best.type === 'civ') {
      if (o.state === 'wait') { o.state = 'follow'; say('Civilian is following you - lead them to a shelter'); } else { o.state = 'wait'; say('Civilian told to wait'); }
    } else if (best.type === 'fire') {
      if (p.bucket > 0) {
        p.bucket--; o.hp--; if (Aud) Aud.splash();
        for (var i = 0; i < 6; i++) G.parts.push({ x: o.x + rnd(-10, 10), y: o.y, vx: rnd(-40, 40), vy: rnd(-90, -30), l: 0.6, c: '#8fd0ff' });
        if (o.hp <= 0) {
          G.fires.splice(G.fires.indexOf(o), 1); G.prog.fire++; G.score += 100; Tot.fires++; save(); say('Fire extinguished! +100'); if (Aud) Aud.chime();
          if (Tot.fires >= 5) award('fire');
        }
      } else say('Bucket empty - refill at a hydrant');
    } else if (best.type === 'hyd') { p.bucket = BUCKET_MAX; if (Aud) Aud.splash(); say('Bucket refilled'); }
    else if (best.type === 'house') {
      if (p.masks > 0) { p.masks--; o.h.done = true; G.prog.mask++; G.score += 75; Tot.masks++; save(); say('Mask delivered! +75'); if (Aud) Aud.chime(); if (Tot.masks >= 5) award('mask'); }
      else say('No masks! Restock at Hospital / Klinik or find crates');
    } else if (best.type === 'med') {
      if (o.cd <= 0) { p.masks += 2; p.inhalers += 1; p.bottles += 1; o.cd = 30; if (Aud) Aud.chime(); say('Restocked: +2 N95, +1 inhaler, +1 water'); }
      else say('Supplies restock in ' + Math.ceil(o.cd) + 's');
    }
  }
  function useItem(n) {
    var p = G.p;
    if (n === 1) {
      if (p.masks > 0 && p.maskDur < 30) { p.masks--; p.maskDur = 100; if (Aud) Aud.chime(); say('N95 mask on'); }
      else say(p.masks <= 0 ? 'No masks left' : 'Current mask still good');
    } else if (n === 2) {
      if (p.bottles > 0) { p.bottles--; p.st = Math.min(100, p.st + 50); p.lung = Math.max(0, p.lung - 10); p.stLock = false; if (Aud) Aud.splash(); say('Drank water: stamina restored'); } else say('No water');
    } else if (n === 3) {
      if (p.inhalers > 0) { p.inhalers--; p.lung = Math.max(0, p.lung - 40); p.hp = Math.min(100, p.hp + 10); if (Aud) Aud.chime(); say('Inhaler used: lung exposure reduced'); } else say('No inhaler');
    }
  }

  // ---------- main update ----------
  function update(dt) {
    var p = G.p, L = LEVELS[G.li];
    G.t += dt;
    var mx = (K.KeyD || K.ArrowRight ? 1 : 0) - (K.KeyA || K.ArrowLeft ? 1 : 0), my = (K.KeyS || K.ArrowDown ? 1 : 0) - (K.KeyW || K.ArrowUp ? 1 : 0);
    var moving = mx || my, l = Math.hypot(mx, my) || 1; mx /= l; my /= l;
    var sprint = moving && (K.ShiftLeft || K.ShiftRight) && p.st > 0 && !p.stLock;
    var spd = sprint ? 250 : 155;
    if (moving) { tryMove(p, mx * spd * dt, my * spd * dt, 12); p.bob += dt * 10; if (mx) p.face = mx > 0 ? 1 : -1; }
    // environment at player
    G.api = Haze.sample(p.x, p.y);
    G.sheltered = !!(shelterAt(p.x, p.y) || purifierAt(p.x, p.y));
    var filt = G.sheltered ? 0 : p.maskDur > 20 ? 0.12 : p.maskDur > 0 ? 0.4 : 1;
    G.eff = G.api * filt;
    if (p.maskDur > 0 && !G.sheltered) p.maskDur = Math.max(0, p.maskDur - (0.1 + G.api * 0.008) * dt);
    // stamina
    if (sprint) p.st -= 22 * dt; else p.st += (14 - clamp(G.eff / 40, 0, 10)) * dt;
    if (p.st <= 0) { p.st = 0; p.stLock = true; } if (p.stLock && p.st > 25) p.stLock = false; p.st = clamp(p.st, 0, 100);
    // lung & health
    if (G.eff > 50) p.lung += (G.eff - 50) / 100 * 1.8 * dt; else p.lung -= 0.8 * dt;
    p.lung = clamp(p.lung, 0, 100);
    var dmg = Math.max(0, G.eff - 100) / 100 * 1.2 + Math.max(0, p.lung - 60) / 40;
    if (dmg > 0) { p.hp -= dmg * dt; } else if (G.eff < 50 && p.lung < 40) p.hp = Math.min(100, p.hp + 0.6 * dt);
    G.cough -= dt;
    if (G.eff > 120 && G.cough <= 0) { G.cough = rnd(2, 4); if (Aud) Aud.cough(); G.shake = Math.max(G.shake, 3); p.st = Math.max(0, p.st - 4); }
    // interaction (hold E)
    G.icd -= dt; if (K.KeyE && (G.icd <= 0 || G.eEdge)) { interact(!!G.eEdge); G.icd = 0.35; }
    G.eEdge = false;
    SHELTERS.forEach(function (s) { if (s.cd > 0) s.cd -= dt; });
    // pickups
    for (var i = G.pickups.length - 1; i >= 0; i--) {
      var k = G.pickups[i];
      if (dist(p.x, p.y, k.x, k.y) < 26) {
        if (k.type === 'mask') p.masks++; else if (k.type === 'bottle') p.bottles++; else p.inhalers++;
        G.pickups.splice(i, 1); if (Aud) Aud.chime(); say('Picked up ' + (k.type === 'mask' ? 'N95 mask' : k.type === 'bottle' ? 'water' : 'inhaler'));
      }
    }
    // fires emit haze
    G.fires.forEach(function (f) {
      Haze.emit(f.x, f.y, (f.peat ? 190 : 120) * dt);
      if (Math.random() < dt * 8) G.embers.push({ x: f.x + rnd(-10, 10), y: f.y, vx: rnd(-15, 15), vy: rnd(-70, -30), l: rnd(0.6, 1.2) });
    });
    frontUpdate(dt);
    Haze.step(dt);
    directorUpdate(dt);
    // civilians
    G.civs.forEach(function (c) { civUpdate(c, dt); });
    var alive = G.civs.filter(function (c) { return c.state !== 'dead' && c.state !== 'safe'; }).length;
    if (alive + G.prog.rescue < L.goals.rescue) { spawnCiv(); }
    // particles
    for (i = G.parts.length - 1; i >= 0; i--) { var q = G.parts[i]; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 120 * dt; q.l -= dt; if (q.l <= 0) G.parts.splice(i, 1); }
    for (i = G.embers.length - 1; i >= 0; i--) { var e = G.embers[i]; e.x += e.vx * dt; e.y += e.vy * dt; e.l -= dt; if (e.l <= 0) G.embers.splice(i, 1); }
    // camera, visuals
    cam.x = clamp(p.x - W / 2, 0, Math.max(0, WW - W)); cam.y = clamp(p.y - H / 2, 0, Math.max(0, WH - H));
    var fv = G.front.state === 'active' ? 0.45 : 0;
    var vt = clamp(G.api / 480 + fv, 0, 1) * (G.sheltered ? 0.4 : 1);
    G.vis = lerp(G.vis, vt, Math.min(1, dt * 1.5));
    G.shake = Math.max(0, G.shake - dt * 5);
    if (G.banner) { G.banner.t -= dt; if (G.banner.t <= 0) G.banner = null; }
    if (G.msg) { G.msg.t -= dt; if (G.msg.t <= 0) G.msg = null; }
    if (Aud) Aud.setHaze(clamp(G.api / 400 + fv, 0, 1));
    // end conditions
    if (p.hp <= 0) { p.hp = 0; defeat(); return; }
    var g = L.goals;
    if (G.prog.rescue >= g.rescue && G.prog.fire >= g.fire && G.prog.mask >= g.mask && G.front.state === 'done') levelDone();
  }

  // ---------- screens ----------
  var DISC = '<div class="disc"><b>DISCLAIMER:</b> All air-quality values (API, PM2.5, forecasts, events) in this game are <b>SIMULATED for gameplay</b> and are <b>NOT official readings</b>. For real data see DOE Malaysia APIMS (apims.doe.gov.my) and MetMalaysia (met.gov.my).</div>';
  function show(html) { ov.className = 'ov'; ov.innerHTML = '<div class="panel">' + html + '</div>'; var b = ov.querySelector('button'); if (b) b.focus(); }
  function hide() { ov.className = 'ov hidden'; ov.innerHTML = ''; }
  function menu() {
    G.state = 'menu';
    show('<h1>HAZE RUN</h1><p class="sub">MALAYSIA SURVIVAL CRISIS</p>' +
      '<p>The haze is rolling in. Rescue civilians, put out fires, hand out masks and survive the Haze Front. An adaptive <b>Haze Director</b> AI watches how you cope and reshapes the crisis in real time.</p>' + DISC +
      '<button data-act="start">Start Game</button><button class="alt" data-act="howto">How to Play</button><button class="alt" data-act="learn">Learn About Haze</button>' +
      '<button class="alt" data-act="ach">Achievements</button>' +
      '<button class="alt" data-act="sound">Sound: ' + (Aud && Aud.isMuted() ? 'OFF' : 'ON') + '</button>');
  }
  function howto() {
    show('<h2>How to Play</h2><table><tr><th>WASD / Arrows</th><td>Move</td></tr><tr><th>Shift</th><td>Sprint (uses stamina)</td></tr><tr><th>E (hold)</th><td>Interact: recruit civilian, spray fire, refill at hydrant, deliver mask, restock at Hospital/Klinik</td></tr>' +
      '<tr><th>1 / 2 / 3</th><td>Wear N95 mask / drink water / use inhaler</td></tr><tr><th>Tab</th><td>Toggle AI Director panel</td></tr><tr><th>P / Esc</th><td>Pause</td></tr><tr><th>M</th><td>Mute</td></tr></table>' +
      '<ul><li>Rescue: press E near a civilian, then walk them into a green-outlined shelter (Hospital, School, Dewan, Klinik).</li><li>Purifier zones (blue rings) and shelters give clean air.</li>' +
      '<li>Fires feed the haze. Spray with E (bucket), refill at hydrants. Peat fires need 4 sprays.</li><li>Orange houses with a blue "M" need a mask delivered.</li>' +
      '<li>Each day ends only after you survive the <b>Haze Front</b>.</li></ul>' + DISC + '<button data-act="menu">Back</button>');
  }
  function learn() {
    show('<h2>Learn About Haze in Malaysia</h2><ul>' +
      '<li><b>PM2.5</b> are particles under 2.5 micrometres. They slip deep into the lungs and bloodstream.</li>' +
      '<li><b>Open burning &amp; peat fires</b>: clearing land by fire and smouldering peat soil produce long-lasting, thick smoke.</li>' +
      '<li><b>Transboundary smoke</b>: during dry, southwest-monsoon months, winds can carry smoke across borders into Malaysia.</li>' +
      '<li><b>N95 vs surgical mask</b>: a properly fitted N95/KN95 filters most fine particles; thin surgical masks mainly block droplets and let PM2.5 through.</li>' +
      '<li><b>Vulnerable groups</b>: children, elderly, pregnant women, and people with asthma, heart or lung disease.</li>' +
      '<li><b>Stay safe</b>: limit outdoor activity at high readings, stay in filtered or closed indoor spaces, drink water, keep medication handy.</li>' +
      '<li><b>Real data</b>: Malaysia\'s API is published by DOE (APIMS); weather and haze outlooks by MetMalaysia.</li></ul>' +
      '<p>Game categories: Good 0-50, Moderate 51-100, Unhealthy 101-200, Very Unhealthy 201-300, Hazardous 300+.</p>' + DISC + '<button data-act="menu">Back</button>');
  }
  function achScreen() {
    var h = '<h2>Achievements</h2><ul>';
    Object.keys(ACH).forEach(function (k) { h += '<li>' + (Ach[k] ? '[x] ' : '[ ] ') + '<b>' + ACH[k][0] + '</b> - ' + ACH[k][1] + '</li>'; });
    show(h + '</ul><button data-act="menu">Back</button>');
  }
  function pauseScreen() { G.state = 'pause'; show('<h2>Paused</h2>' + DISC + '<button data-act="resume">Resume</button><button class="alt" data-act="menu">Quit to Menu</button>'); }
  function levelDone() {
    G.state = 'summary'; var p = G.p, L = LEVELS[G.li];
    var tb = Math.max(0, Math.round(300 - G.t)), hb = Math.round(p.hp * 3);
    G.score += tb + hb;
    var stars = 1 + (p.hp >= 50 ? 1 : 0) + (G.deaths === 0 ? 1 : 0);
    if (p.lung < 30) award('clean');
    if (Aud) Aud.win();
    var last = G.li >= LEVELS.length - 1;
    if (last) award('hazard');
    show('<h2>' + L.name + ' - Complete!</h2><p class="big">' + '*'.repeat(stars) + ' ' + stars + ' / 3 stars</p>' +
      '<table><tr><th>Time</th><td>' + Math.round(G.t) + 's (bonus +' + tb + ')</td></tr><tr><th>Health left</th><td>' + Math.round(p.hp) + '% (bonus +' + hb + ')</td></tr>' +
      '<tr><th>Lung exposure</th><td>' + Math.round(p.lung) + '%</td></tr><tr><th>Civilians lost</th><td>' + G.deaths + '</td></tr><tr><th>Director difficulty</th><td>x' + Dir.diff.toFixed(2) + '</td></tr>' +
      '<tr><th>Total score</th><td><b>' + G.score + '</b></td></tr></table>' +
      (last ? '<button data-act="victory">Continue</button>' : '<button data-act="next">Next Day</button>') + '<button class="alt" data-act="menu">Quit to Menu</button>');
  }
  function victory() {
    G.state = 'victory';
    show('<h1>VICTORY</h1><p class="sub">You survived the haze crisis</p><p class="big">Final score: ' + G.score + '</p>' +
      '<p>Real-world haze needs real-world action: prevent open burning, protect peatlands, and check official air quality readings before going outdoors.</p>' + DISC +
      '<button data-act="start">Play Again</button><button class="alt" data-act="menu">Main Menu</button>');
  }
  function defeat() {
    G.state = 'over'; if (Aud) Aud.hurt();
    var tip = G.api > 200 ? 'Tip: Very Unhealthy air needs an N95 or a shelter - surgical masks are not enough.' : 'Tip: lung exposure builds up. Use inhalers and clean-air zones to recover.';
    show('<h1>GAME OVER</h1><p class="sub">The haze overwhelmed you on ' + LEVELS[G.li].name + '</p><p class="big">Score: ' + G.score + '</p><p>' + tip + '</p>' + DISC +
      '<button data-act="retry">Retry Day</button><button class="alt" data-act="menu">Main Menu</button>');
  }
  ov.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('button') : null; if (!b) return;
    if (Aud) Aud.init();
    var a = b.getAttribute('data-act');
    if (a === 'start') { G.score = 0; startLevel(0); }
    else if (a === 'howto') howto(); else if (a === 'learn') learn(); else if (a === 'ach') achScreen();
    else if (a === 'menu') menu();
    else if (a === 'sound') { if (Aud) Aud.toggleMute(); menu(); }
    else if (a === 'next') startLevel(G.li + 1);
    else if (a === 'retry') { G.score = G.startScore; startLevel(G.li); }
    else if (a === 'victory') victory();
    else if (a === 'resume') { hide(); G.state = 'play'; }
  });

  // ---------- input ----------
  window.addEventListener('keydown', function (e) {
    if (Aud) Aud.init();
    if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.code) >= 0) e.preventDefault();
    K[e.code] = true;
    if (e.repeat) return;
    if (e.code === 'KeyE') G.eEdge = true;
    if (e.code === 'KeyM') { if (Aud) Aud.toggleMute(); say(Aud && Aud.isMuted() ? 'Sound off' : 'Sound on'); }
    if (G.state === 'play') {
      if (e.code === 'Digit1') useItem(1); else if (e.code === 'Digit2') useItem(2); else if (e.code === 'Digit3') useItem(3);
      else if (e.code === 'Tab') G.showDir = !G.showDir;
      else if (e.code === 'KeyP' || e.code === 'Escape') pauseScreen();
    } else if (G.state === 'pause' && (e.code === 'KeyP' || e.code === 'Escape')) { hide(); G.state = 'play'; }
  });
  window.addEventListener('keyup', function (e) { K[e.code] = false; });
  window.addEventListener('blur', function () { K = {}; if (G.state === 'play') pauseScreen(); });
  function resize() { W = cv.width = window.innerWidth; H = cv.height = window.innerHeight; }
  window.addEventListener('resize', resize); resize();

  // ---------- world art (pre-rendered) ----------
  function buildWorld() {
    var c = document.createElement('canvas'); c.width = WW; c.height = WH; var g = c.getContext('2d');
    var seed = 7; function R() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    var sg = g.createLinearGradient(0, 0, 0, 240); sg.addColorStop(0, '#e8a455'); sg.addColorStop(1, '#f3d2a0'); g.fillStyle = sg; g.fillRect(0, 0, WW, 240);
    g.fillStyle = 'rgba(255,235,180,.75)'; g.beginPath(); g.arc(2100, 90, 46, 0, 7); g.fill();
    var x, y, i;
    g.fillStyle = '#c29a72'; for (x = 0; x < WW; x += 50) { var h1 = 40 + R() * 90; g.fillRect(x, 232 - h1, 44, h1); }
    g.fillStyle = '#93705c'; for (x = 20; x < WW; x += 64) { var h2 = 30 + R() * 70; g.fillRect(x, 232 - h2, 50, h2); }
    // KL Tower
    g.fillStyle = '#7b5b4b'; g.fillRect(697, 70, 6, 165); g.beginPath(); g.ellipse(700, 100, 15, 10, 0, 0, 7); g.fill(); g.fillRect(699, 20, 2, 60);
    // Petronas Twin Towers
    [1246, 1314].forEach(function (cx) {
      g.fillStyle = '#d3dade'; g.fillRect(cx - 20, 110, 40, 125); g.fillRect(cx - 15, 80, 30, 35); g.fillRect(cx - 10, 58, 20, 25); g.fillRect(cx - 5, 42, 10, 18);
      g.fillStyle = '#eef3f6'; g.fillRect(cx - 20, 110, 8, 125); g.fillRect(cx - 15, 80, 6, 35);
      g.fillStyle = '#9aa6ad'; for (var wy = 114; wy < 232; wy += 8) g.fillRect(cx - 20, wy, 40, 1);
      g.fillStyle = '#c9ced1'; g.fillRect(cx - 1, 8, 2, 36);
    });
    g.fillStyle = '#b8c0c5'; g.fillRect(1264, 150, 32, 8);
    g.fillStyle = 'rgba(240,170,90,.35)'; g.fillRect(0, 150, WW, 90); // smog layer
    // ground
    g.fillStyle = '#5b8a3c'; g.fillRect(0, 232, WW, WH - 232);
    for (i = 0; i < 4000; i++) { g.fillStyle = R() < 0.5 ? 'rgba(40,90,30,.35)' : 'rgba(130,170,70,.3)'; g.fillRect(R() * WW, 232 + R() * (WH - 232), 3, 3); }
    g.fillStyle = '#6d5a4a'; g.fillRect(0, 232, WW, 16);
    ROADS.forEach(function (r) {
      g.fillStyle = '#3f3f46'; g.fillRect(r.x, r.y, r.w, r.h);
      g.strokeStyle = '#e8d27a'; g.lineWidth = 3; g.setLineDash([30, 24]); g.beginPath();
      if (r.w > r.h) { g.moveTo(r.x, r.y + r.h / 2); g.lineTo(r.x + r.w, r.y + r.h / 2); } else { g.moveTo(r.x + r.w / 2, r.y); g.lineTo(r.x + r.w / 2, r.y + r.h); }
      g.stroke(); g.setLineDash([]);
    });
    function label(t, bx, by, col) {
      g.font = 'bold 16px "Segoe UI",sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(0,0,0,.6)'; g.fillText(t, bx + 1, by + 1); g.fillStyle = col || '#fff'; g.fillText(t, bx, by);
    }
    function bld(s) {
      g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(s.x + 8, s.y + 10, s.w, s.h);
      var t = s.type;
      if (t === 'house') {
        g.fillStyle = '#c79a5a'; g.fillRect(s.x, s.y, s.w, s.h); g.fillStyle = '#a6402e'; g.fillRect(s.x + 4, s.y + 4, s.w - 8, s.h - 8);
        g.strokeStyle = '#7a2a1c'; g.lineWidth = 2; for (var k = 1; k < 6; k++) { g.beginPath(); g.moveTo(s.x + 4, s.y + k * s.h / 6); g.lineTo(s.x + s.w - 4, s.y + k * s.h / 6); g.stroke(); }
        g.fillStyle = '#5b3a24'; g.fillRect(s.x + s.w / 2 - 2, s.y + 4, 4, s.h - 8);
      } else if (t === 'hospital' || t === 'clinic') {
        g.fillStyle = '#f2f2f2'; g.fillRect(s.x, s.y, s.w, s.h); g.fillStyle = t === 'hospital' ? '#d9e6ea' : '#dcead9'; g.fillRect(s.x + 10, s.y + 10, s.w - 20, s.h - 20);
        g.fillStyle = t === 'hospital' ? '#d62f2f' : '#2f9e5a'; var cx = s.x + s.w / 2, cy = s.y + s.h / 2; g.fillRect(cx - 8, cy - 30, 16, 60); g.fillRect(cx - 30, cy - 8, 60, 16);
      } else if (t === 'school') {
        g.fillStyle = '#f2d36b'; g.fillRect(s.x, s.y, s.w, s.h); g.fillStyle = '#c0392b'; g.fillRect(s.x + 10, s.y + 10, s.w - 20, s.h - 20);
        g.fillStyle = '#fff'; g.fillRect(s.x + s.w - 30, s.y + 14, 3, 30); g.fillStyle = '#d62f2f'; g.fillRect(s.x + s.w - 27, s.y + 14, 20, 10); g.fillStyle = '#1b3b8f'; g.fillRect(s.x + s.w - 27, s.y + 14, 8, 10);
      } else if (t === 'hall') {
        g.fillStyle = '#7fb5a0'; g.fillRect(s.x, s.y, s.w, s.h); g.fillStyle = '#2f6f73'; g.fillRect(s.x + 12, s.y + 12, s.w - 24, s.h - 24);
        g.fillStyle = '#e8c35a'; g.beginPath(); g.arc(s.x + s.w / 2, s.y + s.h / 2, 28, 0, 7); g.fill();
      } else if (t === 'mamak') {
        g.fillStyle = '#e9dcc0'; g.fillRect(s.x, s.y, s.w, s.h);
        for (var a = 0; a < 12; a++) { g.fillStyle = a % 2 ? '#fff' : '#d62f2f'; g.fillRect(s.x + a * s.w / 12, s.y, s.w / 12, 50); }
        g.fillStyle = '#5b3a24'; for (var tb = 0; tb < 4; tb++) { g.beginPath(); g.arc(s.x + 40 + tb * 55, s.y + 100, 14, 0, 7); g.fill(); }
      }
      g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 2; g.strokeRect(s.x, s.y, s.w, s.h);
      if (t !== 'house') label(s.name, s.x + s.w / 2, s.y - 8);
      if (s.supply !== undefined) label('SHELTER', s.x + s.w / 2, s.y + s.h + 20, '#9fffb4');
    }
    SHELTERS.forEach(bld); bld(MAMAK); HOUSES.forEach(bld);
    function palm(px, py) {
      g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(px + 6, py + 6, 18, 10, 0, 0, 7); g.fill();
      g.fillStyle = '#6b4a2a'; g.beginPath(); g.arc(px, py, 5, 0, 7); g.fill();
      g.strokeStyle = '#2f7a2f'; g.lineWidth = 5; g.lineCap = 'round';
      for (var f = 0; f < 8; f++) { var an = f * Math.PI / 4; g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(an) * 30, py + Math.sin(an) * 30); g.stroke(); }
      g.lineCap = 'butt';
    }
    var n = 0, tries = 0;
    while (n < 70 && tries < 800) {
      tries++; var px = R() * WW, py = 270 + R() * (WH - 290), bad = false;
      if (solidAt(px, py, 40) || shelterAt(px, py) || purifierAt(px, py)) bad = true;
      if (!bad) for (i = 0; i < ROADS.length; i++) if (inRect(px, py, ROADS[i], 25)) { bad = true; break; }
      if (!bad) for (i = 0; i < SHELTERS.length; i++) if (inRect(px, py, SHELTERS[i], 45)) { bad = true; break; }
      if (!bad) { palm(px, py); n++; }
    }
    return c;
  }

  // ---------- rendering ----------
  function drawFlame(f, t) {
    var x = f.x - cam.x, y = f.y - cam.y, s = f.peat ? 1.2 : 1;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, y + 8, 22 * s, 9, 0, 0, 7); ctx.fill();
    var cols = ['#c0391b', '#f07a1e', '#ffd13a'];
    for (var i = 0; i < 3; i++) {
      var fl = Math.sin(t * 9 + f.ph + i * 2) * 3, hgt = (26 - i * 7) * s + fl;
      ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.moveTo(x - (16 - i * 4) * s, y + 6); ctx.quadraticCurveTo(x + fl, y - hgt * 1.4, x + (16 - i * 4) * s, y + 6); ctx.closePath(); ctx.fill();
    }
    if (f.peat) { ctx.strokeStyle = '#3b2a20'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y + 6, 24, 0, 7); ctx.stroke(); }
    if (f.hp < (f.peat ? 4 : 3)) { ctx.fillStyle = '#8fd0ff'; ctx.fillRect(x - 15, y + 18, 30 * f.hp / (f.peat ? 4 : 3), 4); }
  }
  function person(x, y, shirt, mask, t, face) {
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, y + 12, 11, 5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = shirt; ctx.beginPath(); ctx.arc(x, y + 2, 11, 0, 7); ctx.fill();
    ctx.fillStyle = '#e0b088'; ctx.beginPath(); ctx.arc(x, y - 7 + Math.sin(t) * 1.2, 8, 0, 7); ctx.fill();
    ctx.fillStyle = '#222'; ctx.fillRect(x - 8, y - 15 + Math.sin(t) * 1.2, 16, 5);
    if (mask) { ctx.fillStyle = '#e8f1f5'; ctx.fillRect(x - 6 + face * 1, y - 7 + Math.sin(t) * 1.2, 12, 6); }
  }
  function bar(x, y, w, v, col, label) {
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(x, y, w, 14); ctx.fillStyle = col; ctx.fillRect(x + 1, y + 1, (w - 2) * clamp(v / 100, 0, 1), 12);
    ctx.fillStyle = '#fff'; ctx.font = '11px "Segoe UI",sans-serif'; ctx.textAlign = 'left'; ctx.fillText(label + ' ' + Math.round(v), x + 4, y + 11);
  }
  function panel(x, y, w, h) { ctx.fillStyle = 'rgba(25,14,6,.7)'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = 'rgba(232,160,74,.7)'; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, w, h); }
  function wrap(text, x, y, maxW, lh) {
    var words = text.split(' '), line = '';
    for (var i = 0; i < words.length; i++) {
      var tst = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(tst).width > maxW && line) { ctx.fillText(line, x, y); y += lh; line = words[i]; } else line = tst;
    }
    ctx.fillText(line, x, y); return y + lh;
  }

  function updateHazeImg() {
    var d = hazeImg.data, a = Haze.a;
    for (var i = 0; i < GW * GH; i++) {
      var v = a[i], t = clamp(v / 400, 0, 1);
      d[i * 4] = lerp(210, 70, t); d[i * 4 + 1] = lerp(140, 38, t); d[i * 4 + 2] = lerp(60, 18, t);
      d[i * 4 + 3] = clamp((v - 25) / 330, 0, 0.84) * 255;
    }
    hazeCtx.putImageData(hazeImg, 0, 0);
  }

  function render(now) {
    var t = now / 1000;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#120a05'; ctx.fillRect(0, 0, W, H);
    if (G.state === 'menu' || !G.p) { renderMenuBg(t); return; }
    var p = G.p;
    ctx.save();
    if (G.shake > 0.05) ctx.translate(rnd(-1, 1) * G.shake, rnd(-1, 1) * G.shake);
    var sw = Math.min(W, WW), sh = Math.min(H, WH);
    ctx.drawImage(worldCv, cam.x, cam.y, sw, sh, 0, 0, sw, sh);
    // dynamic world objects
    var i, o;
    SHELTERS.forEach(function (s) {
      ctx.strokeStyle = 'rgba(100,255,150,' + (0.45 + 0.2 * Math.sin(t * 3)) + ')'; ctx.lineWidth = 3; ctx.strokeRect(s.x - cam.x, s.y - cam.y, s.w, s.h);
      if (s.supply && s.cd > 0) { ctx.fillStyle = '#fff'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('restock ' + Math.ceil(s.cd) + 's', s.x + s.w / 2 - cam.x, s.y + s.h / 2 + 50 - cam.y); }
    });
    PURIFIERS.forEach(function (u) {
      var x = u.x - cam.x, y = u.y - cam.y; ctx.fillStyle = 'rgba(120,200,255,.18)'; ctx.beginPath(); ctx.arc(x, y, u.r, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(140,220,255,' + (0.5 + 0.3 * Math.sin(t * 4)) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, u.r - (t * 20 % 12), 0, 7); ctx.stroke();
      ctx.fillStyle = '#2d89c8'; ctx.fillRect(x - 10, y - 10, 20, 20); ctx.fillStyle = '#cfefff'; ctx.fillRect(x - 6, y - 6, 12, 12);
      ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#d7f1ff'; ctx.fillText('PURIFIER', x, y + u.r + 14);
    });
    HYDRANTS.forEach(function (h) { var x = h.x - cam.x, y = h.y - cam.y; ctx.fillStyle = '#d62f2f'; ctx.fillRect(x - 7, y - 10, 14, 20); ctx.fillStyle = '#fff'; ctx.fillRect(x - 9, y - 4, 18, 4); });
    HOUSES.forEach(function (h) {
      if (!h.need) return; var x = h.x + h.w / 2 - cam.x, y = h.y - 14 - cam.y + Math.sin(t * 4) * 3;
      ctx.fillStyle = h.done ? '#3cc46a' : '#2d89c8'; ctx.beginPath(); ctx.arc(x, y, 12, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(h.done ? 'OK' : 'M', x, y + 5);
    });
    G.pickups.forEach(function (k) {
      var x = k.x - cam.x, y = k.y - cam.y + Math.sin(t * 4 + k.x) * 3; ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.arc(x, y, 16, 0, 7); ctx.fill();
      ctx.fillStyle = k.type === 'mask' ? '#e8f1f5' : k.type === 'bottle' ? '#5bb8ff' : '#ffd24a'; ctx.fillRect(x - 8, y - 6, 16, 12);
      ctx.fillStyle = '#222'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(k.type === 'mask' ? 'N95' : k.type === 'bottle' ? 'H2O' : 'INH', x, y + 4);
    });
    G.fires.forEach(function (f) { drawFlame(f, t); });
    G.civs.forEach(function (c) {
      if (c.state === 'safe') return; var x = c.x - cam.x, y = c.y - cam.y;
      if (c.state === 'dead') { ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(x, y, 14, 7, 0, 0, 7); ctx.fill(); return; }
      person(x, y, c.col, false, t * 3 + x, 1);
      ctx.fillStyle = c.state === 'follow' ? '#6df08a' : '#ffd24a'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(c.state === 'follow' ? 'FOLLOWING' : '! HELP', x, y - 26);
      if (c.hp < 100) { ctx.fillStyle = '#400'; ctx.fillRect(x - 12, y + 18, 24, 3); ctx.fillStyle = '#e44'; ctx.fillRect(x - 12, y + 18, 24 * c.hp / 100, 3); }
    });
    person(p.x - cam.x, p.y - cam.y, '#f07a1e', p.maskDur > 0, p.bob, p.face);
    ctx.fillStyle = '#ffeed0'; ctx.fillRect(p.x - cam.x - 3, p.y - cam.y - 2, 6, 3);
    G.embers.forEach(function (e) { ctx.fillStyle = 'rgba(255,' + Math.round(120 + e.l * 100) + ',40,' + clamp(e.l, 0, 1) + ')'; ctx.fillRect(e.x - cam.x, e.y - cam.y, 3, 3); });
    G.parts.forEach(function (q) { ctx.fillStyle = q.c; ctx.fillRect(q.x - cam.x, q.y - cam.y, 3, 3); });
    // haze overlay
    updateHazeImg();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(hazeCv, 0, 0, GW, GH, -cam.x, -cam.y, WW, WH);
    ctx.restore();
    // ash particles
    renderAsh(t);
    // sky darkening + tint
    var tint = clamp(G.api / 500, 0, 0.35) + G.skyDark;
    if (G.front.state === 'active') tint += 0.12 * Math.sin(t * 6);
    ctx.fillStyle = 'rgba(70,25,5,' + clamp(tint, 0, 0.7) + ')'; ctx.fillRect(0, 0, W, H);
    // vignette
    var diag = Math.hypot(W, H) / 2, r0 = lerp(diag * 0.9, 220, clamp(G.vis, 0, 1)), vg = ctx.createRadialGradient(W / 2, H / 2, r0 * 0.4, W / 2, H / 2, Math.max(r0 + 80, diag));
    vg.addColorStop(0, 'rgba(30,12,4,0)'); vg.addColorStop(Math.min(0.95, r0 / Math.max(r0 + 80, diag)), 'rgba(30,12,4,0.25)'); vg.addColorStop(1, 'rgba(20,8,2,' + (0.55 + G.vis * 0.4) + ')');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    if (p.hp < 40) { ctx.fillStyle = 'rgba(180,0,0,' + (0.15 + 0.1 * Math.sin(t * 6)) * (1 - p.hp / 40) + ')'; ctx.fillRect(0, 0, W, H); }
    if (G.state === 'play' || G.state === 'pause') renderHUD(t);
  }
  function renderMenuBg(t) {
    if (!worldCv) return;
    var ox = (Math.sin(t * 0.1) * 0.5 + 0.5) * Math.max(0, WW - W), oy = 0;
    ctx.drawImage(worldCv, ox, oy, Math.min(W, WW), Math.min(H, WH), 0, 0, Math.min(W, WW), Math.min(H, WH));
    ctx.fillStyle = 'rgba(150,70,15,.45)'; ctx.fillRect(0, 0, W, H);
  }
  function renderAsh(t) {
    var n = Math.floor(clamp(G.api / 400 + (G.front.state === 'active' ? 0.5 : 0), 0, 1) * 160);
    while (G.ash.length < 160) G.ash.push({ x: rnd(0, W), y: rnd(0, H), s: rnd(1, 3) });
    var wx = Haze.wx * 50, wy = Haze.wy * 50, dt = 1 / 60;
    ctx.fillStyle = 'rgba(60,40,30,.55)';
    for (var i = 0; i < n; i++) {
      var a = G.ash[i]; a.x += (wx + Math.sin(t + i) * 10) * dt; a.y += (wy + Math.cos(t + i) * 10) * dt;
      if (a.x < 0) a.x += W; if (a.x > W) a.x -= W; if (a.y < 0) a.y += H; if (a.y > H) a.y -= H;
      ctx.fillRect(a.x, a.y, a.s, a.s);
    }
  }

  function renderHUD(t) {
    var p = G.p, L = LEVELS[G.li], y;
    ctx.font = '12px "Segoe UI",sans-serif'; ctx.textBaseline = 'alphabetic';
    // vitals
    panel(10, 10, 210, 100);
    bar(18, 18, 194, p.hp, p.hp > 40 ? '#d83a3a' : '#ff1010', 'Health'); bar(18, 38, 194, p.st, '#e8c13a', 'Stamina');
    bar(18, 58, 194, p.lung, '#9a6bd0', 'Lung exposure'); bar(18, 78, 194, p.maskDur, '#5bb8ff', p.maskDur > 0 ? 'N95 durability' : 'No mask worn');
    ctx.fillStyle = '#ffd27a'; ctx.fillText('Score ' + G.score, 18, 106);
    // API gauge
    var c = cat(G.api), c2 = cat(G.eff);
    panel(W / 2 - 170, 10, 340, 52);
    ctx.textAlign = 'center'; ctx.fillStyle = c.c; ctx.font = 'bold 20px "Segoe UI",sans-serif'; ctx.fillText('API ' + Math.round(G.api) + '  ' + c.n, W / 2, 34);
    ctx.font = '11px "Segoe UI",sans-serif'; ctx.fillStyle = '#ffe9a8';
    ctx.fillText(G.sheltered ? 'SHELTERED - clean air' : 'Breathing: ' + Math.round(G.eff) + ' (' + c2.n + ')  |  SIMULATED, NOT OFFICIAL', W / 2, 54);
    // objectives
    var g = L.goals; panel(W - 250, 10, 240, 128);
    ctx.textAlign = 'left'; ctx.fillStyle = '#ffb347'; ctx.font = 'bold 13px "Segoe UI",sans-serif'; ctx.fillText(L.name, W - 242, 28);
    ctx.font = '13px "Segoe UI",sans-serif';
    var objs = [['Rescue civilians', G.prog.rescue, g.rescue], ['Extinguish fires', G.prog.fire, g.fire], ['Deliver masks', G.prog.mask, g.mask], ['Survive Haze Front', G.front.state === 'done' ? 1 : 0, 1]];
    for (var i = 0; i < objs.length; i++) {
      var ok = objs[i][1] >= objs[i][2]; ctx.fillStyle = ok ? '#6df08a' : '#fff';
      ctx.fillText((ok ? '[x] ' : '[ ] ') + objs[i][0] + ' ' + Math.min(objs[i][1], objs[i][2]) + '/' + objs[i][2], W - 242, 48 + i * 18);
    }
    ctx.fillStyle = '#c9b090'; ctx.font = '11px sans-serif'; ctx.fillText('Time ' + Math.round(G.t) + 's' + (G.front.state === 'idle' ? '  |  front in ~' + Math.max(0, Math.round(L.frontAt - G.t)) + 's' : ''), W - 242, 128);
    // items
    var iy = H - 46; panel(W / 2 - 230, iy, 460, 36);
    ctx.fillStyle = '#fff'; ctx.font = '13px "Segoe UI",sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('[1] N95 x' + p.masks + '   [2] Water x' + p.bottles + '   [3] Inhaler x' + p.inhalers + '   Bucket ' + p.bucket + '/' + BUCKET_MAX, W / 2, iy + 23);
    // advisory
    ctx.textAlign = 'left'; ctx.font = '12px "Segoe UI",sans-serif';
    var adv = G.forecast || ''; var aw = Math.min(W - 40, 560);
    panel(10, H - 94, aw > 0 ? Math.min(aw, 440) : 440, 38); ctx.fillStyle = G.front.state === 'warn' || G.front.state === 'active' ? '#ff9070' : '#ffd27a';
    wrap('FORECAST: ' + adv, 18, H - 78, Math.min(aw, 440) - 16, 14);
    // director panel
    if (G.showDir) {
      var dx = 10, dy = 120, dw = 270;
      panel(dx, dy, dw, 150); ctx.fillStyle = '#7fe0ff'; ctx.font = 'bold 13px "Segoe UI",sans-serif'; ctx.fillText('HAZE DIRECTOR AI  [Tab]', dx + 8, dy + 18);
      ctx.font = '12px "Segoe UI",sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText('Stress', dx + 8, dy + 36);
      ctx.fillStyle = '#222'; ctx.fillRect(dx + 60, dy + 27, 120, 10); ctx.fillStyle = Dir.stress > 0.55 ? '#ff5040' : Dir.stress < 0.3 ? '#50e070' : '#e8c13a'; ctx.fillRect(dx + 60, dy + 27, 120 * Dir.stress, 10);
      ctx.fillStyle = '#fff'; ctx.fillText(Math.round(Dir.stress * 100) + '%', dx + 186, dy + 36);
      ctx.fillText('Difficulty x' + Dir.diff.toFixed(2) + '  (fire rate / wind)', dx + 8, dy + 54);
      ctx.fillStyle = '#ffd27a'; ctx.fillText('Last decision:', dx + 8, dy + 72); ctx.fillStyle = '#fff';
      var yy = wrap(Dir.last.text, dx + 8, dy + 86, dw - 16, 14);
      ctx.fillStyle = '#b8d8e0'; wrap('Why: ' + Dir.last.reason, dx + 8, yy, dw - 16, 13);
    }
    // minimap
    var mw = 176, mh = 132, mx = W - mw - 10, my = H - mh - 10; panel(mx - 2, my - 2, mw + 4, mh + 4);
    ctx.drawImage(worldCv, 0, 0, WW, WH, mx, my, mw, mh); ctx.drawImage(hazeCv, 0, 0, GW, GH, mx, my, mw, mh);
    function dot(x, y, col, s) { ctx.fillStyle = col; ctx.fillRect(mx + x / WW * mw - s / 2, my + y / WH * mh - s / 2, s, s); }
    SHELTERS.forEach(function (s) { dot(s.x + s.w / 2, s.y + s.h / 2, '#6dff9a', 6); });
    G.fires.forEach(function (f) { dot(f.x, f.y, '#ff5a20', 4); });
    G.civs.forEach(function (cc) { if (cc.state === 'wait' || cc.state === 'follow') dot(cc.x, cc.y, '#ffd24a', 4); });
    dot(p.x, p.y, '#fff', 6);
    // message & banner
    if (G.msg) { ctx.textAlign = 'center'; ctx.font = 'bold 15px "Segoe UI",sans-serif'; ctx.fillStyle = 'rgba(0,0,0,.6)'; var mwid = ctx.measureText(G.msg.text).width + 24; ctx.fillRect(W / 2 - mwid / 2, H - 120, mwid, 26); ctx.fillStyle = '#fff'; ctx.fillText(G.msg.text, W / 2, H - 102); }
    if (G.banner) {
      var b = G.banner, al = clamp(b.t / 0.6, 0, 1) * clamp((b.max - b.t) / 0.3 + 0.01, 0, 1);
      ctx.globalAlpha = al; ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(0, H * 0.22, W, 64);
      ctx.textAlign = 'center'; ctx.font = 'bold 30px "Segoe UI",sans-serif'; ctx.fillStyle = b.color; ctx.fillText(b.text, W / 2, H * 0.22 + 42);
      if (b.color === '#ff5030' && Math.floor(t * 4) % 2 === 0) { ctx.fillStyle = 'rgba(255,40,20,.18)'; ctx.fillRect(0, 0, W, H); }
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left';
  }

  // ---------- loop ----------
  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    if (G.state === 'play') update(dt);
    render(now);
    requestAnimationFrame(frame);
  }
  loadSave();
  worldCv = buildWorld();
  menu();
  requestAnimationFrame(frame);
  HR.G = G; HR.Haze = Haze; HR.startLevel = startLevel; HR.update = update; HR.render = render; HR.keys = K;
})();
