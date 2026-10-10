/* HAZE RUN - WebAudio synth (no audio files). Namespace: HR.Audio */
(function () {
  'use strict';
  var HR = window.HR = window.HR || {};
  var ctx = null, master = null, windG = null, windF = null, muted = false, noiseBuf = null;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; return; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ctx.destination);
    var len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    var src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    windF = ctx.createBiquadFilter(); windF.type = 'lowpass'; windF.frequency.value = 400;
    windG = ctx.createGain(); windG.gain.value = 0.03;
    src.connect(windF); windF.connect(windG); windG.connect(master); src.start();
  }
  function ok() { return ctx && !muted; }
  function tone(freq, t0, dur, type, vol) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function burst(t0, dur, freq, vol, type) {
    var s = ctx.createBufferSource(); s.buffer = noiseBuf;
    var f = ctx.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq;
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t0, Math.random()); s.stop(t0 + dur + 0.05);
  }
  HR.Audio = {
    init: init,
    isMuted: function () { return muted; },
    toggleMute: function () {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    setHaze: function (v) {
      if (!ctx) return;
      v = Math.max(0, Math.min(1, v));
      windG.gain.setTargetAtTime(0.03 + v * 0.3, ctx.currentTime, 0.4);
      windF.frequency.setTargetAtTime(250 + v * 650, ctx.currentTime, 0.4);
    },
    cough: function () {
      if (!ok()) return; var t = ctx.currentTime;
      burst(t, 0.12, 900, 0.5); burst(t + 0.18, 0.15, 700, 0.5); tone(140, t, 0.25, 'sawtooth', 0.12);
    },
    chime: function () {
      if (!ok()) return; var t = ctx.currentTime;
      tone(660, t, 0.25, 'sine', 0.25); tone(990, t + 0.1, 0.35, 'sine', 0.22);
    },
    splash: function () { if (!ok()) return; burst(ctx.currentTime, 0.3, 2500, 0.35, 'highpass'); },
    hurt: function () { if (!ok()) return; tone(110, ctx.currentTime, 0.2, 'square', 0.15); },
    siren: function () {
      if (!ok()) return; var t = ctx.currentTime;
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sawtooth';
      for (var i = 0; i < 6; i++) {
        o.frequency.setValueAtTime(500, t + i * 0.8);
        o.frequency.linearRampToValueAtTime(900, t + i * 0.8 + 0.4);
        o.frequency.linearRampToValueAtTime(500, t + i * 0.8 + 0.8);
      }
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.1);
      g.gain.setValueAtTime(0.18, t + 4.4); g.gain.exponentialRampToValueAtTime(0.0001, t + 4.8);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 4.9);
    },
    win: function () {
      if (!ok()) return; var t = ctx.currentTime;
      tone(523, t, 0.2, 'triangle', 0.25); tone(659, t + 0.15, 0.2, 'triangle', 0.25); tone(784, t + 0.3, 0.4, 'triangle', 0.25);
    }
  };
})();
