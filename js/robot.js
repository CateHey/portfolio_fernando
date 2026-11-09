/* =====================================================================
   Hero animation — 2-DOF pick-and-place robot.
   A conveyor brings metal, glass and plastic pieces; the arm picks each
   one and places it on the high (metal), middle (glass) or low (plastic)
   shelf. Joint moves are interpolated in joint space with inverse
   kinematics for each waypoint, like a real robot controller. A small
   HUD shows θ1, θ2 and the gripper in real time.
   ===================================================================== */
(function () {
  'use strict';

  var svg = document.getElementById('arm');
  if (!svg) return;
  var NS = 'http://www.w3.org/2000/svg';

  /* ---------- Geometry (SVG units) ---------- */
  var B = { x: 280, y: 352 };           // shoulder (base joint)
  var L1 = 155, L2 = 145;               // link lengths
  var ITEM = 22;                        // piece size
  var HANG = 4 + ITEM / 2;              // wrist → held piece centre
  var BELT_Y = 330;                     // belt top surface
  var PICK_X = 180;                     // where pieces stop on the belt
  var SPAWN_X = 30;
  var SHELF = { high: 200, mid: 265, low: 330 };   // platform tops
  var SLOT = { high: 466, mid: 414, low: 362 };     // platform centres
  var HOME = { x: 180, y: 254 };          // waits right above the pick point
  var BAR_W = 54;

  var TYPES = [
    { key: 'metal',   level: 'high', fill: 'url(#gMetal)',   stroke: '#c9d4ea' },
    { key: 'glass',   level: 'mid',  fill: 'url(#gGlass)',   stroke: '#6cc7ff' },
    { key: 'plastic', level: 'low',  fill: 'url(#gPlastic)', stroke: '#b9a8ff' }
  ];

  /* ---------- Elements ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var l1 = $('armL1'), l2 = $('armL2'), jE = $('armElbow'), jW = $('armWrist');
  var fL = $('armFingerL'), fR = $('armFingerR'), bar = $('armGripBar');
  var itemsLayer = $('armItems');
  var hud1 = $('hudT1'), hud2 = $('hudT2'), hud3 = $('hudG');
  var hud1v = $('hudT1v'), hud2v = $('hudT2v'), hud3v = $('hudGv');
  var status = $('armStatus');
  var belt = $('beltDash');

  /* ---------- Kinematics ---------- */
  function ik(p) {
    var dx = p.x - B.x, dy = B.y - p.y;
    var r2 = dx * dx + dy * dy;
    var c2 = (r2 - L1 * L1 - L2 * L2) / (2 * L1 * L2);
    c2 = Math.max(-1, Math.min(1, c2));
    var best = null;
    [1, -1].forEach(function (sgn) {
      var s2 = sgn * Math.sqrt(1 - c2 * c2);
      var t2 = Math.atan2(s2, c2);
      var t1 = Math.atan2(dy, dx) - Math.atan2(L2 * s2, L1 + L2 * c2);
      var ey = L1 * Math.sin(t1);           // elbow height (up = +)
      if (!best || ey > best.ey) best = { t1: t1, t2: t2, ey: ey };
    });
    return [best.t1, best.t2];
  }
  function fk(q) {
    var e = { x: B.x + L1 * Math.cos(q[0]), y: B.y - L1 * Math.sin(q[0]) };
    var a = q[0] + q[1];
    return { e: e, w: { x: e.x + L2 * Math.cos(a), y: e.y - L2 * Math.sin(a) } };
  }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  /* ---------- Pieces ---------- */
  var pieces = [];          // {el, type, x, y, o, state:'belt'|'held'|'placed'|'fading'}
  var onShelf = { high: null, mid: null, low: null };
  var nextType = 0;

  function makePiece() {
    var type = TYPES[nextType % TYPES.length];
    nextType++;
    var g = document.createElementNS(NS, 'g');
    var r = document.createElementNS(NS, 'rect');
    r.setAttribute('x', -ITEM / 2); r.setAttribute('y', -ITEM / 2);
    r.setAttribute('width', ITEM); r.setAttribute('height', ITEM);
    r.setAttribute('rx', type.key === 'plastic' ? 7 : (type.key === 'glass' ? 3 : 2));
    r.setAttribute('fill', type.fill); r.setAttribute('stroke', type.stroke); r.setAttribute('stroke-width', '1.5');
    g.appendChild(r);
    if (type.key === 'glass') {
      var s = document.createElementNS(NS, 'path');
      s.setAttribute('d', 'M-6 -7 L-1 -7 L-7 4'); s.setAttribute('fill', 'none');
      s.setAttribute('stroke', '#ffffff'); s.setAttribute('stroke-opacity', '0.7'); s.setAttribute('stroke-width', '1.5');
      g.appendChild(s);
    } else if (type.key === 'metal') {
      var m = document.createElementNS(NS, 'path');
      m.setAttribute('d', 'M-11 -4 H11 M-11 4 H11'); m.setAttribute('stroke', '#7d8aa8'); m.setAttribute('stroke-width', '1');
      g.appendChild(m);
    }
    g.setAttribute('class', 'piece');
    itemsLayer.appendChild(g);
    var p = { el: g, type: type, x: SPAWN_X, y: BELT_Y - ITEM / 2, state: 'belt', o: 0 };
    pieces.push(p);
    return p;
  }

  function drawPiece(p) {
    p.el.setAttribute('transform', 'translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ')');
    p.el.style.opacity = p.o.toFixed(2);
  }

  /* ---------- Robot program ---------- */
  var q = ik(HOME);          // current joints
  var grip = 16;             // finger half-gap (open 16, closed 12)
  var held = null;
  var plan = [];             // queue of steps
  var step = null, stepT = 0;
  var waiting = null;        // piece on its way to the pick point

  function moveTo(p, dur) { return { kind: 'move', target: ik(p), dur: dur }; }
  function gripTo(g, dur) { return { kind: 'grip', target: g, dur: dur }; }
  function call(fn) { return { kind: 'call', fn: fn, dur: 0 }; }

  function program(piece) {
    var lvl = piece.type.level;
    var sx = SLOT[lvl];
    var placeY = SHELF[lvl] - ITEM / 2 - HANG;
    var pickY = BELT_Y - ITEM / 2 - HANG;
    setStatus(piece.type);
    return [
      moveTo({ x: PICK_X, y: pickY }, 0.45),
      gripTo(12, 0.25),
      call(function () {
        held = piece; piece.state = 'held'; waiting = null;
        if (onShelf[lvl]) { onShelf[lvl].state = 'fading'; onShelf[lvl] = null; }   // make room
      }),
      moveTo({ x: PICK_X, y: pickY - 60 }, 0.45),
      moveTo({ x: sx, y: placeY - 34 }, 1.2),
      moveTo({ x: sx, y: placeY }, 0.45),
      gripTo(16, 0.25),
      call(function () { piece.state = 'placed'; piece.slotX = sx; onShelf[lvl] = piece; held = null; }),
      moveTo({ x: sx - 6, y: placeY - 55 }, 0.45),
      moveTo(HOME, 1.1)
    ];
  }

  function setStatus(type) {
    if (!status) return;
    var d = (window.I18N && window.I18N[document.documentElement.lang]) || {};
    var es = (window.I18N && window.I18N.es) || {};
    var mat = d['arm.' + type.key] || es['arm.' + type.key] || type.key;
    var lvl = d['arm.' + type.level] || es['arm.' + type.level] || type.level;
    status.textContent = mat + ' → ' + lvl;
  }

  /* ---------- Render ---------- */
  function deg(a) { return a * 180 / Math.PI; }
  function render() {
    var k = fk(q);
    l1.setAttribute('x2', k.e.x); l1.setAttribute('y2', k.e.y);
    l2.setAttribute('x1', k.e.x); l2.setAttribute('y1', k.e.y);
    l2.setAttribute('x2', k.w.x); l2.setAttribute('y2', k.w.y);
    jE.setAttribute('cx', k.e.x); jE.setAttribute('cy', k.e.y);
    jW.setAttribute('cx', k.w.x); jW.setAttribute('cy', k.w.y);
    var wx = k.w.x, wy = k.w.y;
    bar.setAttribute('x1', wx - grip - 2); bar.setAttribute('x2', wx + grip + 2);
    bar.setAttribute('y1', wy + 2); bar.setAttribute('y2', wy + 2);
    fL.setAttribute('d', 'M' + (wx - grip) + ' ' + (wy + 2) + ' V' + (wy + 2 + ITEM + 2));
    fR.setAttribute('d', 'M' + (wx + grip) + ' ' + (wy + 2) + ' V' + (wy + 2 + ITEM + 2));
    if (held) { held.x = wx; held.y = wy + HANG; }

    // HUD
    var a1 = deg(q[0]), a2 = deg(q[1]);
    if (hud1) { hud1.setAttribute('width', Math.max(2, Math.min(1, Math.max(0, a1) / 180) * BAR_W).toFixed(1)); hud1v.textContent = a1.toFixed(0) + '°'; }
    if (hud2) { hud2.setAttribute('width', Math.max(2, Math.min(1, Math.abs(a2) / 180) * BAR_W).toFixed(1)); hud2v.textContent = a2.toFixed(0) + '°'; }
    if (hud3) { var gpct = (16 - grip) / 4; hud3.setAttribute('width', Math.max(2, gpct * BAR_W).toFixed(1)); hud3v.textContent = gpct > 0.5 ? 'ON' : 'OFF'; }

    pieces.forEach(drawPiece);
  }

  /* ---------- Loop ---------- */
  var BELT_SPEED = 62;     // units / s
  var last = 0, running = false, visible = true;
  var beltOffset = 0;

  function update(dt) {
    // conveyor
    beltOffset = (beltOffset + BELT_SPEED * dt) % 20;
    if (belt) belt.setAttribute('stroke-dashoffset', (-beltOffset).toFixed(1));
    if (!waiting && !held) waiting = makePiece();
    if (waiting && waiting.state === 'belt') {
      waiting.o = Math.min(1, waiting.o + dt * 3);
      waiting.x = Math.min(PICK_X, waiting.x + BELT_SPEED * dt);
    }

    // pieces on shelves glide to their slot / fade
    pieces.forEach(function (p) {
      if (p.state === 'placed') {
        p.x = p.slotX;
        p.y = SHELF[p.type.level] - ITEM / 2;
      } else if (p.state === 'fading') {
        p.o -= dt * 2.5; p.y -= dt * 12;
      }
    });
    pieces = pieces.filter(function (p) {
      if (p.state === 'fading' && p.o <= 0) { p.el.remove(); return false; }
      return true;
    });

    // robot program
    if (!step && plan.length === 0 && waiting && waiting.x >= PICK_X - 0.5) {
      plan = program(waiting);
    }
    if (!step && plan.length) {
      step = plan.shift(); stepT = 0;
      if (step.kind === 'move') step.from = q.slice();
      if (step.kind === 'grip') step.from = grip;
    }
    if (step) {
      stepT += dt;
      var t = step.dur ? Math.min(1, stepT / step.dur) : 1, e = ease(t);
      if (step.kind === 'move') q = [step.from[0] + (step.target[0] - step.from[0]) * e, step.from[1] + (step.target[1] - step.from[1]) * e];
      else if (step.kind === 'grip') grip = step.from + (step.target - step.from) * e;
      else if (step.kind === 'call') step.fn();
      if (t >= 1) step = null;
    }
  }

  function frame(now) {
    if (!running) return;
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }
  function start() { if (running) return; running = true; last = 0; requestAnimationFrame(frame); }
  function stop() { running = false; }

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    // static scene: one piece on each shelf, arm at home
    TYPES.forEach(function (t, i) {
      nextType = i; var p = makePiece(); p.state = 'placed'; p.slotX = SLOT[t.level]; p.x = p.slotX; p.o = 1; p.y = SHELF[t.level] - ITEM / 2;
    });
    render();
    return;
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible && !document.hidden) start(); else stop();
    }).observe(svg);
  } else { start(); }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else if (visible) start();
  });
  render();
})();
