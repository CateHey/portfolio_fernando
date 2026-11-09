/* =====================================================================
   Hero animation — 2-DOF pick-and-place robot building a podium.
   The conveyor brings three achievement tokens (UNI, ARLISS, NASA);
   the arm places them on the low, middle and high platform, and the
   matching card under the robot lights up. Joint moves are planned with
   inverse kinematics per waypoint and interpolated in joint space, like
   a real robot controller. A HUD shows θ1, θ2 and the gripper live.
   ===================================================================== */
(function () {
  'use strict';

  var svg = document.getElementById('arm');
  if (!svg) return;
  var NS = 'http://www.w3.org/2000/svg';

  /* ---------- Geometry (SVG units) ---------- */
  var B = { x: 280, y: 352 };            // shoulder joint
  var L1 = 155, L2 = 145;                // link lengths
  var ITEM = 22;                         // token size
  var HANG = 4 + ITEM / 2;               // wrist → held token centre
  var BELT_Y = 330;                      // belt top surface
  var PICK_X = 180;                      // tokens stop here
  var SPAWN_X = 30;
  var SHELF = { high: 200, mid: 265, low: 330 };    // platform tops
  var SLOT = { high: 466, mid: 414, low: 362 };     // platform centres
  var HOME = { x: PICK_X, y: BELT_Y - ITEM / 2 - HANG - 50 };   // waits above the belt
  var BAR_W = 54;
  var OPEN = 16, CLOSED = 12;            // finger inner half-gap

  // Order: UNI → low, ARLISS → middle, NASA → high (the podium climbs)
  var TYPES = [
    { key: 'uni',    level: 'low',  fill: 'url(#gUni)',    stroke: '#ffe39a', icon: 'medal' },
    { key: 'arliss', level: 'mid',  fill: 'url(#gArliss)', stroke: '#ffc08f', icon: 'trophy' },
    { key: 'nasa',   level: 'high', fill: 'url(#gNasa)',   stroke: '#bcd2ff', icon: 'star' }
  ];
  var ICONS = {
    star: 'M0 -7 L2 -2.2 L7 -2.2 L3 1 L4.4 6 L0 3.1 L-4.4 6 L-3 1 L-7 -2.2 L-2 -2.2 Z',
    trophy: 'M-5 -6 H5 V-2 A5 5 0 0 1 -5 -2 Z M0 3 V5.5 M-3.5 6.5 H3.5 M-5 -4.5 H-7.5 A2.6 2.6 0 0 0 -5.2 0 M5 -4.5 H7.5 A2.6 2.6 0 0 1 5.2 0',
    medal: 'M-4.5 -7.5 L-1 -1.5 M4.5 -7.5 L1 -1.5 M0 6.5 A4.2 4.2 0 1 0 0 -1.9 A4.2 4.2 0 1 0 0 6.5 Z'
  };

  /* ---------- Elements ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var g1 = $('armG1'), g2 = $('armG2'), gGrip = $('armGrip');
  var fL = $('armFingerL'), fR = $('armFingerR');
  var itemsLayer = $('armItems');
  var hud1 = $('hudT1'), hud2 = $('hudT2'), hud3 = $('hudG');
  var hud1v = $('hudT1v'), hud2v = $('hudT2v'), hud3v = $('hudGv');
  var status = $('armStatus');
  var belt = $('beltDash');

  /* ---------- Kinematics ---------- */
  function ik(p) {
    var dx = p.x - B.x, dy = B.y - p.y;
    var c2 = (dx * dx + dy * dy - L1 * L1 - L2 * L2) / (2 * L1 * L2);
    c2 = Math.max(-1, Math.min(1, c2));
    var best = null;
    [1, -1].forEach(function (sgn) {
      var s2 = sgn * Math.sqrt(1 - c2 * c2);
      var t2 = Math.atan2(s2, c2);
      var t1 = Math.atan2(dy, dx) - Math.atan2(L2 * s2, L1 + L2 * c2);
      var ey = L1 * Math.sin(t1);           // elbow height: keep the elbow up
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
  function deg(a) { return a * 180 / Math.PI; }

  /* ---------- Tokens ---------- */
  var pieces = [];
  var onShelf = { high: null, mid: null, low: null };
  var nextType = 0;

  function el(name, attrs) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function makePiece() {
    var type = TYPES[nextType % TYPES.length];
    nextType++;
    var g = el('g', { 'class': 'piece' });
    g.appendChild(el('rect', { x: -ITEM / 2, y: -ITEM / 2, width: ITEM, height: ITEM, rx: 5, fill: type.fill, stroke: type.stroke, 'stroke-width': 1.2 }));
    g.appendChild(el('path', { d: ICONS[type.icon], fill: type.icon === 'star' ? '#06102a' : 'none', stroke: '#06102a', 'stroke-width': 1.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    itemsLayer.appendChild(g);
    var p = { el: g, type: type, x: SPAWN_X, y: BELT_Y - ITEM / 2, state: 'belt', o: 0 };
    pieces.push(p);
    return p;
  }
  function drawPiece(p) {
    p.el.setAttribute('transform', 'translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ')');
    p.el.style.opacity = Math.max(0, p.o).toFixed(2);
  }

  /* ---------- Cards under the robot light up ---------- */
  function flash(key) {
    var card = document.querySelector('[data-token="' + key + '"]');
    if (!card) return;
    card.classList.remove('is-hit');
    void card.offsetWidth;                 // restart the animation
    card.classList.add('is-hit');
    clearTimeout(card._hitT);
    card._hitT = setTimeout(function () { card.classList.remove('is-hit'); }, 1600);
  }

  /* ---------- Robot program ---------- */
  var q = ik(HOME);
  var grip = OPEN;
  var held = null;
  var plan = [];
  var step = null, stepT = 0;
  var waiting = null;

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
      gripTo(CLOSED, 0.25),
      call(function () {
        held = piece; piece.state = 'held'; waiting = null;
        if (onShelf[lvl]) { onShelf[lvl].state = 'fading'; onShelf[lvl] = null; }
      }),
      moveTo({ x: PICK_X, y: pickY - 60 }, 0.45),
      moveTo({ x: sx, y: placeY - 34 }, 1.2),
      moveTo({ x: sx, y: placeY }, 0.45),
      gripTo(OPEN, 0.25),
      call(function () {
        piece.state = 'placed'; piece.slotX = sx; onShelf[lvl] = piece; held = null;
        flash(piece.type.key);
      }),
      moveTo({ x: sx - 6, y: placeY - 55 }, 0.45),
      moveTo(HOME, 1.1)
    ];
  }

  function setStatus(type) {
    if (!status) return;
    var d = (window.I18N && window.I18N[document.documentElement.lang]) || {};
    var es = (window.I18N && window.I18N.es) || {};
    var lvl = d['arm.' + type.level] || es['arm.' + type.level] || type.level;
    status.textContent = type.key.toUpperCase() + ' → ' + lvl;
  }

  /* ---------- Render ---------- */
  function render() {
    var k = fk(q);
    g1.setAttribute('transform', 'translate(' + B.x + ' ' + B.y + ') rotate(' + (-deg(q[0])).toFixed(2) + ')');
    g2.setAttribute('transform', 'translate(' + k.e.x.toFixed(2) + ' ' + k.e.y.toFixed(2) + ') rotate(' + (-deg(q[0] + q[1])).toFixed(2) + ')');
    gGrip.setAttribute('transform', 'translate(' + k.w.x.toFixed(2) + ' ' + k.w.y.toFixed(2) + ')');
    var gl = (-grip - 5).toFixed(2), gr = grip.toFixed(2);
    fL.setAttribute('d', 'M' + gl + ' 2 h5 v24 l-3 3 h-2 Z');
    fR.setAttribute('d', 'M' + gr + ' 2 h5 v27 h-2 l-3 -3 Z');
    if (held) { held.x = k.w.x; held.y = k.w.y + HANG; }

    var a1 = deg(q[0]), a2 = deg(q[1]);
    if (hud1) { hud1.setAttribute('width', Math.max(2, Math.min(1, Math.max(0, a1) / 180) * BAR_W).toFixed(1)); hud1v.textContent = a1.toFixed(0) + '°'; }
    if (hud2) { hud2.setAttribute('width', Math.max(2, Math.min(1, Math.abs(a2) / 180) * BAR_W).toFixed(1)); hud2v.textContent = a2.toFixed(0) + '°'; }
    if (hud3) { var gp = (OPEN - grip) / (OPEN - CLOSED); hud3.setAttribute('width', Math.max(2, gp * BAR_W).toFixed(1)); hud3v.textContent = gp > 0.5 ? 'ON' : 'OFF'; }

    pieces.forEach(drawPiece);
  }

  /* ---------- Loop ---------- */
  var BELT_SPEED = 62;
  var last = 0, running = false, visible = true;
  var beltOffset = 0;

  function update(dt) {
    beltOffset = (beltOffset + BELT_SPEED * dt) % 20;
    if (belt) belt.setAttribute('stroke-dashoffset', (-beltOffset).toFixed(1));
    if (!waiting && !held) waiting = makePiece();
    if (waiting && waiting.state === 'belt') {
      waiting.o = Math.min(1, waiting.o + dt * 3);
      waiting.x = Math.min(PICK_X, waiting.x + BELT_SPEED * dt);
    }

    pieces.forEach(function (p) {
      if (p.state === 'placed') { p.x = p.slotX; p.y = SHELF[p.type.level] - ITEM / 2; }
      else if (p.state === 'fading') { p.o -= dt * 2.5; p.y -= dt * 14; }
    });
    pieces = pieces.filter(function (p) {
      if (p.state === 'fading' && p.o <= 0) { p.el.parentNode.removeChild(p.el); return false; }
      return true;
    });

    if (!step && plan.length === 0 && waiting && waiting.x >= PICK_X - 0.5) plan = program(waiting);
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
    TYPES.forEach(function (t, i) {
      nextType = i; var p = makePiece();
      p.state = 'placed'; p.slotX = SLOT[t.level]; p.x = p.slotX; p.o = 1; p.y = SHELF[t.level] - ITEM / 2;
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
