(() => {
const $ = (s, r = document) => r.querySelector(s);
const KEY = 'astrocare.demo.v1';
const lisoDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fd = d => d.toLocaleDateString('es', { day: '2-digit', month: 'short' });
const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
const slope = a => { const n = a.length, mx = (n - 1) / 2, my = mean(a); let nu = 0, de = 0; a.forEach((v, i) => { nu += (i - mx) * (v - my); de += (i - mx) ** 2; }); return nu / de; };
const ST = [['Normal', 'ok'], ['Requiere seguimiento', 'warn'], ['Requiere evaluación', 'alert']];
/* Regla DEMOSTRATIVA: variación vs. referencia personal. No es un umbral clínico validado. */
const stat = dev => { const a = Math.abs(dev); return a < 8 ? 0 : a < 15 ? 1 : 2; };
const TODAY_ISO = lisoDate(TODAY);

/* Si hay mediciones registradas para un indicador, se usan en lugar de los datos simulados.
   Referencia personal: promedio de las 3 primeras mediciones registradas (7 primeros días en la demo). */
const build = m => {
  const e = (S.meas || []).filter(x => x.k === m.k).sort((a, b) => a.ts - b.ts), reg = e.length > 0;
  const series = reg ? e.map(x => x.v) : m.series, dia = reg && m.k === 'bp' ? e.map(x => x.v2) : m.dia;
  const dates = reg ? e.map(x => new Date(x.ts)) : DATES, n = series.length;
  const base = mean(series.slice(0, reg ? 3 : 7)), latest = series[n - 1], dev = (latest - base) / base * 100;
  let first = n - 1;
  for (let i = n - 1; i >= 0; i--) { const d = (series[i] - base) / base * 100; if (Math.abs(d) >= 8 && Math.sign(d) === Math.sign(dev)) first = i; else break; }
  const dur = Math.abs(dev) >= 8 ? Math.max(1, Math.round((dates[n - 1] - dates[first]) / 864e5) + 1) : 0;
  return { ...m, series, dia, dates, reg, n, base, latest, dev, st: stat(dev), dur, tr: n > 1 ? slope(series.slice(-5)) / base * 100 : 0 };
};
let MX = [];
const recompute = () => { MX = METRICS.map(build); };
const val = (m, v) => v.toFixed(m.dec);
const latestTxt = m => m.k === 'bp' ? `${m.latest}/${m.dia[m.dia.length - 1]}` : val(m, m.latest);
const trTxt = m => m.tr > .8 ? 'Ascendente' : m.tr < -.8 ? 'Descendente' : 'Estable';
const pct = v => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
const flagged = () => MX.filter(m => m.st > 0 && !(m.k === 'hr' && watch.status === 'on' && watch.bpm));

/* ---------- Estado persistente ---------- */
let S = load(), view = 'monitor', sel = 'sleep', period = 14, cat = 'rest';
S.meas = S.meas || []; recompute();
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.log) return s; } catch (e) {} return seed(); }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('No se pudo guardar en el navegador'); } }
function seed() {
  const log = {};
  for (let k = 1; k <= 7; k++) { const d = new Date(TODAY); d.setDate(d.getDate() - k); log[lisoDate(d)] = ACT.filter((a, i) => Math.abs(Math.sin(k * 3 + i * 1.7)) > .35 + k * .04).map(a => a.id); }
  return { notes: [], log, meas: [] };
}
const doneToday = () => S.log[TODAY_ISO] || [];
const lastDone = id => Object.keys(S.log).filter(d => S.log[d].includes(id)).sort().pop();

/* ---------- Utilidades UI ---------- */
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2200); }
const chip = s => `<span class="chip ${ST[s][1]}">${ST[s][0]}</span>`;
function sparkFrom(a, cls, minRange) {
  if (a.length < 2) return `<svg class="spark ${cls}" viewBox="0 0 70 24"><line x1="0" y1="12" x2="70" y2="12" opacity=".4"/></svg>`;
  const lo0 = Math.min(...a), hi0 = Math.max(...a), r = Math.max(hi0 - lo0, minRange || 0) || 1, lo = (hi0 + lo0) / 2 - r / 2;
  const pts = a.map((v, i) => `${(i * 70 / (a.length - 1)).toFixed(1)},${(22 - (v - lo) / r * 20).toFixed(1)}`).join(' ');
  return `<svg class="spark ${cls}" viewBox="0 0 70 24"><polyline points="${pts}"/></svg>`;
}
const spark = m => sparkFrom(m.series, ST[m.st][1]);

/* ---------- Zonas del pulso (DEMOSTRATIVAS, ajustables) ----------
   Verde: dentro del rango; amarillo: zona intermedia; rojo: fuera del rango de alerta.
   No son umbrales clínicos validados. Se asumen valores en reposo. */
const HRZ_DEF = { aMin: 50, gMin: 60, gMax: 100, aMax: 120 };
const zoneOf = b => { const z = S.hrz || HRZ_DEF; return b < z.aMin || b > z.aMax ? 2 : (b < z.gMin || b > z.gMax ? 1 : 0); };
const zoneCls = b => ST[zoneOf(b)][1];

/* ---------- Gráfica SVG ---------- */
let hover = false;
function chart(m, ys, xlabel, live, real) {
  const n = ys.length, W = 720, H = 300, p = { l: 46, r: 16, t: 16, b: 30 };
  const z = S.hrz || HRZ_DEF, ext = real ? [z.gMin, z.gMax] : [m.base];
  let lo = Math.min(...ys, ...ext), hi = Math.max(...ys, ...ext); const pad = (hi - lo) * .25 || 1; lo -= pad; hi += pad;
  const X = i => p.l + i * (W - p.l - p.r) / (n - 1), Y = v => p.t + (hi - v) * (H - p.t - p.b) / (hi - lo);
  const band = (a, b, c) => { const t = Math.max(a, lo), u = Math.min(b, hi); return u > t ? `<rect class="zone ${c}" x="${p.l}" y="${Y(u)}" width="${W - p.l - p.r}" height="${Y(t) - Y(u)}"/>` : ''; };
  let g = real ? band(-1e9, z.aMin, 'alert') + band(z.aMin, z.gMin, 'warn') + band(z.gMin, z.gMax, 'ok') + band(z.gMax, z.aMax, 'warn') + band(z.aMax, 1e9, 'alert') : '';
  for (let i = 0; i <= 4; i++) { const v = lo + (hi - lo) * i / 4, y = Y(v); g += `<line class="grid" x1="${p.l}" x2="${W - p.r}" y1="${y}" y2="${y}"/><text class="ax" x="${p.l - 8}" y="${y + 4}" text-anchor="end">${val(m, v)}</text>`; }
  for (let i = 0; i < n; i++) { const t = xlabel(i); if (t) g += `<text class="ax" x="${X(i)}" y="${H - 8}" text-anchor="middle">${t}</text>`; }
  const line = ys.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join('');
  const dots = ys.map((v, i) => `<circle class="pt ${real ? zoneCls(v) : ST[stat((v - m.base) / m.base * 100)][1]}${i === n - 1 ? ' last' : ''}" cx="${X(i)}" cy="${Y(v)}" r="${i === n - 1 ? 6 : n > 20 ? 2 : 3.5}"/>`).join('');
  return `<svg id="ch" class="${live ? 'lv' : ''}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${live ? 'Simulación en vivo' : 'Historial'} de ${m.label}">${g}
  ${real ? '' : `<line class="base" x1="${p.l}" x2="${W - p.r}" y1="${Y(m.base)}" y2="${Y(m.base)}"/><text class="ax acc" x="${W - p.r}" y="${Y(m.base) - 6}" text-anchor="end">Referencia personal ${val(m, m.base)}</text>`}
  <path class="ln" d="${line}"/>${dots}<line id="gd" class="guide" y1="${p.t}" y2="${H - p.b}" x1="0" x2="0"/></svg>`;
}
const histX = (n, ds) => i => (n <= 7 || i % 2 === 0 || i === n - 1) ? fd(ds[i]) : '';
const liveX = n => i => (n - 1 - i) % 8 === 0 ? (i === n - 1 ? 'ahora' : `-${(n - 1 - i) * 1.5} s`) : '';
const histTip = (m, ys, ds, dw) => i => {
  const dv = (ys[i] - m.base) / m.base * 100, dia = dw ? `/${dw[i]}` : '';
  return `<b>${ds[i].toLocaleDateString('es', { weekday: 'short', day: '2-digit', month: 'short' })}</b>${val(m, ys[i])}${dia} ${m.unit}<br><span>${pct(dv)} vs. referencia · ${ST[stat(dv)][0]}</span>`;
};
const liveTip = (m, ys) => i => {
  const dv = (ys[i] - m.base) / m.base * 100;
  return `<b>Muestra simulada</b>${val(m, ys[i])} ${m.unit}<br><span>${pct(dv)} vs. referencia · ${ST[stat(dv)][0]}</span>`;
};
function bindChart(m, ys, tipFn) {
  const svg = $('#ch'), tip = $('#tip'); if (!svg) return;
  const n = ys.length, W = 720, l = 46, r = 16;
  const move = e => {
    hover = true;
    const b = svg.getBoundingClientRect(), x = (e.clientX - b.left) / b.width * W;
    const i = Math.max(0, Math.min(n - 1, Math.round((x - l) / ((W - l - r) / (n - 1)))));
    const px = l + i * (W - l - r) / (n - 1);
    const gd = $('#gd'); gd.setAttribute('x1', px); gd.setAttribute('x2', px); gd.style.opacity = 1;
    tip.innerHTML = tipFn(i); tip.style.opacity = 1; tip.style.left = Math.min(Math.max(px / W * b.width, 90), b.width - 90) + 'px';
  };
  const leave = () => { hover = false; tip.style.opacity = 0; const gd = $('#gd'); if (gd) gd.style.opacity = 0; };
  svg.onmousemove = move; svg.ontouchmove = e => move(e.touches[0]);
  svg.onmouseleave = leave; svg.ontouchend = leave;
}

/* ---------- Modo en vivo (SIMULADO) ----------
   Genera muestras aleatorias cerca del último registro. No son mediciones reales. */
const live = {};
const sd = a => Math.sqrt(mean(a.map(v => (v - mean(a)) ** 2)));
const vol = m => (sd(m.series) * .6) || .1;
const nextSample = (m, last) => last + (m.latest - last) * .1 + (Math.random() - .5) * vol(m);
function liveBuf(m) {
  if (!live[m.k]) { let v = m.latest; const a = []; for (let i = 0; i < 40; i++) { a.unshift(v); v = nextSample(m, v); } live[m.k] = a; }
  return live[m.k];
}
function statsHtml(m, isLive, ys, real) {
  if (real) {
    const has = ys.length > 0, cur = has ? ys[ys.length - 1] : null, t = ys.length > 1 ? slope(ys.slice(-10)) * 9 : 0;
    return `<div><dt>Muestra actual</dt><dd class="${has ? 's-' + zoneCls(cur) : ''}">${has ? cur : '--'} <small>BPM</small></dd></div><div><dt>Promedio (ventana)</dt><dd>${has ? Math.round(mean(ys)) : '--'} <small>BPM</small></dd></div><div><dt>Mín. / Máx.</dt><dd>${has ? Math.min(...ys) + ' / ' + Math.max(...ys) : '--'}</dd></div><div><dt>Tendencia</dt><dd>${t > 2 ? 'Ascendente' : t < -2 ? 'Descendente' : 'Estable'}</dd></div>`;
  }
  const cur = isLive && ys.length ? ys[ys.length - 1] : m.latest, dev = (cur - m.base) / m.base * 100;
  const t = isLive ? slope(ys.slice(-10)) * 9 / m.base * 100 : m.tr, th = isLive ? .3 : .8;
  const tr = t > th ? 'Ascendente' : t < -th ? 'Descendente' : 'Estable', cls = 's-' + ST[stat(dev)][1];
  return `<div><dt>${isLive ? 'Muestra actual' : 'Más reciente'}</dt><dd class="${cls}">${isLive ? val(m, cur) : latestTxt(m)} <small>${m.unit}</small></dd></div><div><dt>Referencia personal</dt><dd>${val(m, m.base)} <small>${m.unit}</small></dd></div><div><dt>Variación</dt><dd class="${cls}">${pct(dev)}</dd></div><div><dt>Tendencia</dt><dd>${tr}</dd></div>`;
}

/* ---------- Reloj por Bluetooth (pulso REAL) ----------
   Lee el servicio estándar "heart_rate" con Web Bluetooth.
   Requiere Chrome o Edge (Android o PC) y HTTPS o localhost. */
const watch = { status: 'off', name: '', bpm: null, dev: null };
const realBuf = { v: [], t: [] };
const realX = (n, ts) => i => (n - 1 - i) % 8 === 0 ? (i === n - 1 ? 'ahora' : `-${Math.round((ts[n - 1] - ts[i]) / 1000)} s`) : '';
const realTip = (ys, ts) => i => `<b>${new Date(ts[i]).toLocaleTimeString('es')}</b>${ys[i]} BPM · medición real<br><span>${ST[zoneOf(ys[i])][0]} (zona demostrativa)</span>`;

function liveSrc(m) {
  if (m.k === 'hr' && watch.status === 'on') {
    const ys = realBuf.v.slice(), ts = realBuf.t.slice();
    return { real: true, ys, xl: realX(ys.length, ts), tip: realTip(ys, ts) };
  }
  const ys = liveBuf(m);
  return { real: false, ys, xl: liveX(ys.length), tip: liveTip(m, ys) };
}
function paintLive(m) {
  const src = liveSrc(m), svg = $('#ch');
  if (!svg) { if (src.ys.length >= 2) renderMonitor(); return; }
  if (src.ys.length < 2) return;
  svg.outerHTML = chart(m, src.ys, src.xl, true, src.real);
  $('#stats').innerHTML = statsHtml(m, true, src.ys, src.real);
  bindChart(m, src.ys, src.tip);
}

function watchPanel() {
  const on = watch.status === 'on', busy = watch.status === 'connecting', ok = !!navigator.bluetooth, has = on && watch.bpm;
  const z = S.hrz || HRZ_DEF, zi = (k, lab) => `<input type="number" min="20" max="250" data-hrz="${k}" value="${z[k]}" aria-label="${lab}">`;
  const msg = on ? `Conectado a ${watch.name}. Mantén abierta la app Heart for Bluetooth en el reloj.`
    : ok ? 'En el reloj abre Heart for Bluetooth y espera a ver tu pulso. Luego pulsa Conectar y elige el reloj.'
    : 'Este navegador no admite Web Bluetooth. Usa Chrome o Edge en Android o PC.';
  return `<div><h2>Reloj por Bluetooth <span class="realtag">Pulso real</span></h2><p class="mut">${msg}</p>
    <p class="zones">Zonas en reposo (demostrativas): <i class="dot ok"></i>verde ${zi('gMin', 'Verde desde')} a ${zi('gMax', 'Verde hasta')} BPM · <i class="dot warn"></i>amarillo en medio · <i class="dot alert"></i>rojo bajo ${zi('aMin', 'Rojo por debajo de')} o sobre ${zi('aMax', 'Rojo por encima de')}</p>
    <p class="foot">Solo el pulso es real; los demás indicadores siguen simulados. Dato de bienestar, no médico. Con ejercicio el pulso sube de forma normal.</p></div>
    <div class="w-bpm"><b id="bpm" class="${has ? 's-' + zoneCls(watch.bpm) : ''}">${has ? watch.bpm : '--'}</b><small>BPM</small><span id="wzone" class="chip ${has ? zoneCls(watch.bpm) : 'hide'}">${has ? ST[zoneOf(watch.bpm)][0] : ''}</span></div>
    <button class="${on ? '' : 'pri'}" data-act="watch" ${busy || !ok ? 'disabled' : ''}>${on ? 'Desconectar' : busy ? 'Conectando…' : 'Conectar reloj'}</button>`;
}
function updateBanner() {
  const d = $('#demo'); if (!d) return;
  const parts = [];
  if (watch.status === 'on') parts.push('El pulso en tiempo real viene de un reloj por Bluetooth');
  if (S.meas && S.meas.length) parts.push('Hay mediciones registradas manualmente');
  d.textContent = parts.length
    ? `Prototipo demostrativo. ${parts.join('. ')} (bienestar, no médico). Los indicadores sin etiqueta "real" o "registro manual" son ficticios. Sin diagnóstico y sin conexión con la NASA.`
    : 'Prototipo demostrativo: datos ficticios, sin sensores ni dispositivos médicos, sin diagnóstico y sin conexión con la NASA.';
}
function setWatch(s) { watch.status = s; const p = $('#watchp'); if (p) p.innerHTML = watchPanel(); updateBanner(); }
async function connectWatch() {
  if (!navigator.bluetooth) { toast('Este navegador no admite Web Bluetooth. Usa Chrome o Edge.'); return; }
  let dev;
  try {
    const pending = navigator.bluetooth.requestDevice({ filters: [{ services: ['heart_rate'] }] });
    setWatch('connecting');
    dev = await pending;
    dev.addEventListener('gattserverdisconnected', onWatchLost);
    const srv = await dev.gatt.connect(), svc = await srv.getPrimaryService('heart_rate'), ch = await svc.getCharacteristic('heart_rate_measurement');
    ch.addEventListener('characteristicvaluechanged', onHr);
    await ch.startNotifications();
    Object.assign(watch, { dev, name: dev.name || 'reloj', bpm: null }); realBuf.v = []; realBuf.t = [];
    setWatch('on'); toast('Reloj conectado'); if (view === 'monitor') renderMonitor();
  } catch (e) {
    try { dev && dev.gatt.connected && dev.gatt.disconnect(); } catch (_) {}
    setWatch('off'); toast(e && e.name === 'NotFoundError' ? 'No se eligió ningún reloj' : 'No se pudo conectar: ' + (e && e.message || 'error'));
  }
}
function disconnectWatch() { if (watch.dev && watch.dev.gatt.connected) watch.dev.gatt.disconnect(); else onWatchLost(); }
function onWatchLost() { watch.bpm = null; setWatch('off'); save(); toast('Reloj desconectado'); if (view === 'monitor') renderMonitor(); }
function onHr(e) {
  const dv = e.target.value, bpm = (dv.getUint8(0) & 1) ? dv.getUint16(1, true) : dv.getUint8(1);
  if (!bpm) return; /* 0 = sin contacto con la piel */
  const now = Date.now(); watch.bpm = bpm;
  realBuf.v.push(bpm); realBuf.t.push(now); if (realBuf.v.length > 60) { realBuf.v.shift(); realBuf.t.shift(); }
  const r = S.real || (S.real = { n: 0, sum: 0, min: bpm, max: bpm, first: now, last: now });
  r.n++; r.sum += bpm; r.min = Math.min(r.min, bpm); r.max = Math.max(r.max, bpm); r.last = now; if (r.n % 10 === 0) save();
  const bEl = $('#bpm'), zEl = $('#wzone'), zc = zoneCls(bpm);
  if (bEl) { bEl.textContent = bpm; bEl.className = 's-' + zc; }
  if (zEl) { zEl.className = 'chip ' + zc; zEl.textContent = ST[zoneOf(bpm)][0]; }
  updateHrRow();
  if (view === 'monitor' && period === 'live' && sel === 'hr' && !hover) paintLive(MX.find(x => x.k === 'hr'));
}

/* ---------- Fila de indicador ----------
   Si el reloj está conectado, la fila del pulso muestra el valor, el estado y la
   minigráfica REALES (los mismos datos que la gráfica en vivo). */
const isRealRow = x => x.k === 'hr' && watch.status === 'on' && watch.bpm;
const rowState = x => isRealRow(x) ? zoneOf(watch.bpm) : x.st;
const rowCls = x => `row ${x.k === sel ? 'sel' : ''} ${ST[rowState(x)][1]}`;
function rowInner(x) {
  const real = isRealRow(x), s = rowState(x);
  return `<span class="rl"><b>${x.label}</b><small>${real ? 'Medición real · reloj' : x.reg ? `Registro manual · ${x.n} med.${x.n < 3 ? ' · ref. provisional' : ''}` : `Ref. ${val(x, x.base)} ${x.unit}`}</small></span>${real ? sparkFrom(realBuf.v, ST[s][1], 10) : spark(x)}
    <span class="rv"><b>${real ? watch.bpm : latestTxt(x)}</b><small>${x.unit}</small></span><span class="rs">${chip(s)}</span>`;
}
function updateHrRow() {
  const r = $('#row-hr'); if (!r) return;
  const x = MX.find(m => m.k === 'hr'); r.className = rowCls(x); r.innerHTML = rowInner(x);
}

/* ---------- Mediciones registradas manualmente ---------- */
const MEAS = {
  bp: { label: 'Presión arterial', unit: 'mmHg', fields: [['v', 'Sistólica (mmHg)', 60, 250, 1], ['v2', 'Diastólica (mmHg)', 30, 150, 1]] },
  temp: { label: 'Temperatura corporal', unit: '°C', fields: [['v', 'Temperatura (°C)', 33, 42, .1]] },
  glu: { label: 'Glucosa sanguínea', unit: 'mg/dL', fields: [['v', 'Glucosa (mg/dL)', 30, 500, 1]] },
  sleep: { label: 'Horas de sueño', unit: 'h', fields: [['v', 'Horas dormidas', 0, 24, .1]] },
  well: { label: 'Bienestar y fatiga', unit: '/10', fields: [['v', 'Bienestar de 0 a 10 (10 = mejor)', 0, 10, .5]] },
  spo2: { label: 'Oxígeno en sangre (SpO2)', unit: '%', fields: [['v', 'SpO2 (%)', 70, 100, 1]] },
  body: { label: 'Composición corporal', unit: '', fields: [['v', 'Masa muscular esquelética (kg)', 5, 80, .1], ['v2', 'Grasa corporal (%)', 2, 70, .1], ['v3', 'Agua corporal (%)', 20, 80, .1]] }
};
const SRC = ['Samsung Health (manual)', 'Dispositivo externo (manual)', 'Autoevaluación'];
const meas = k => (S.meas || []).filter(x => x.k === k).sort((a, b) => a.ts - b.ts);
const spo2St = v => v >= 95 ? 0 : v >= 90 ? 1 : 2; /* regla DEMOSTRATIVA, no clínica */
const fdt = ts => new Date(ts).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const fmtM = e => e.k === 'bp' ? `${e.v}/${e.v2} mmHg` : e.k === 'body' ? `${e.v} kg músculo · ${e.v2} % grasa · ${e.v3} % agua` : `${e.v} ${MEAS[e.k].unit}`;
function extraCards() {
  const sp = meas('spo2'), bd = meas('body');
  const c1 = sp.length ? (() => { const l = sp[sp.length - 1], s = spo2St(l.v); return `<div class="xc"><small>Oxígeno en sangre (SpO2)</small><b class="s-${ST[s][1]}">${l.v}<i>%</i></b>${chip(s)}${sparkFrom(sp.map(x => x.v), ST[s][1], 4)}<small>${fdt(l.ts)} · ${l.src}</small></div>`; })()
    : '<div class="xc"><small>Oxígeno en sangre (SpO2)</small><p class="mut">Sin registros</p></div>';
  const c2 = bd.length ? (() => { const l = bd[bd.length - 1], f = bd[0], d = (l.v - f.v) / f.v * 100;
    return `<div class="xc"><small>Composición corporal</small><b>${l.v}<i>kg músculo</i></b><span class="mut">${l.v2} % grasa · ${l.v3} % agua</span><span>${bd.length > 1 ? `${pct(d)} de masa muscular vs. la primera medición` : 'Primera medición: referencia inicial'}</span><small>${fdt(l.ts)} · ${l.src}</small></div>`; })()
    : '<div class="xc"><small>Composición corporal</small><p class="mut">Sin registros</p></div>';
  return c1 + c2;
}
function measPanel() {
  const list = (S.meas || []).slice().sort((a, b) => b.ts - a.ts).slice(0, 10).map(e => `<li><span><b>${MEAS[e.k].label}</b> ${fmtM(e)}<small>${fdt(e.ts)} · ${e.src}</small></span><button class="link" data-act="delmeas" data-id="${e.id}" aria-label="Eliminar medición">Eliminar</button></li>`).join('') || '<li class="mut">Aún no hay mediciones registradas.</li>';
  return `<section class="panel"><h2>Mediciones registradas <span class="realtag">Registro manual</span></h2>
  <p class="mut">Anota lo que muestra el reloj, un dispositivo externo o tu autoevaluación. Los indicadores que tengan registros usan estos valores en lugar de los simulados.</p>
  <div class="grid2 obsg"><form id="mf"><h3>Registrar medición</h3>
    <label>Medición<select name="k">${Object.keys(MEAS).map(k => `<option value="${k}" ${k === sel ? 'selected' : ''}>${MEAS[k].label}</option>`).join('')}</select></label>
    <div id="mfields"></div>
    <label>Fecha y hora<input name="when" type="datetime-local" required></label>
    <label>Fuente<select name="src">${SRC.map(s => `<option>${s}</option>`).join('')}</select></label>
    <button class="pri" type="submit">Guardar medición</button>
    <p class="foot">Dato de bienestar, no médico. La referencia personal es el promedio de las 3 primeras mediciones de cada indicador.</p></form>
  <div><div class="xcs">${extraCards()}</div><ul class="meas">${list}</ul></div></div></section>`;
}
function bindMeas() {
  const f = $('#mf'); if (!f) return;
  const nowLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
  const fill = () => { $('#mfields').innerHTML = MEAS[f.k.value].fields.map(([n, lab, lo, hi, st]) => `<label>${lab}<input name="${n}" type="number" min="${lo}" max="${hi}" step="${st}" required></label>`).join(''); };
  fill(); f.when.value = nowLocal(); f.k.onchange = fill;
  f.onsubmit = e => {
    e.preventDefault();
    const d = MEAS[f.k.value], en = { id: Date.now(), k: f.k.value, src: f.src.value, ts: new Date(f.when.value).getTime() };
    for (const [n, , lo, hi] of d.fields) { const v = parseFloat(f[n].value); if (!(v >= lo && v <= hi)) { toast(`Valor fuera de rango (${lo} a ${hi})`); return; } en[n] = v; }
    if (!(en.ts <= Date.now() + 6e4)) { toast('La fecha no puede ser futura'); return; }
    S.meas.push(en); save(); recompute(); if (MX.some(x => x.k === en.k)) sel = en.k;
    updateBanner(); renderMonitor(); toast('Medición guardada');
  };
}

/* ---------- Monitor ---------- */
function observation(m) {
  const sign = m.dev > 0 ? 'por encima' : 'por debajo';
  return `<article class="obs ${ST[m.st][1]}"><header><b>${m.label}</b>${chip(m.st)}</header>
  <p>Su referencia personal era <b>${val(m, m.base)} ${m.unit}</b> y el valor actual es <b>${latestTxt(m)} ${m.unit}</b> (${pct(m.dev)}, ${sign} de la referencia). El cambio se observa desde hace <b>${m.dur} ${m.dur === 1 ? 'día' : 'días'}</b>.</p>
  <p class="mut">Conviene registrar: ${m.ask}</p>
  <button class="link" data-act="goto" data-cat="${m.rec}">Ver actividades de seguimiento relacionadas</button></article>`;
}
function renderMonitor() {
  const m = MX.find(x => x.k === sel), fl = flagged(), noLive = m.reg && m.k !== 'hr', isLive = period === 'live' && !noLive, per = isLive ? 'live' : (period === 'live' ? 14 : period);
  const cut = new Date(TODAY); cut.setDate(cut.getDate() - (isLive ? 0 : per) + 1);
  const ix = isLive ? [] : m.dates.map((d, i) => i).filter(i => m.dates[i] >= cut);
  const src = isLive ? liveSrc(m) : null, ys = isLive ? src.ys : ix.map(i => m.series[i]), ds = isLive ? null : ix.map(i => m.dates[i]), dw = !isLive && m.dia ? ix.map(i => m.dia[i]) : null;
  const rows = MX.map(x => `<button id="row-${x.k}" class="${rowCls(x)}" data-act="sel" data-k="${x.k}">${rowInner(x)}</button>`).join('');
  const notes = S.notes.length ? S.notes.slice().reverse().map(n => `<li><b>${n.label}</b> <small>${new Date(n.ts).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}${n.dur ? ' · ' + n.dur + ' d' : ''}</small><p>${n.text.replace(/</g, '&lt;')}</p></li>`).join('') : '<li class="mut">Aún no hay observaciones registradas. Use el formulario para añadir la primera.</li>';
  $('#view').innerHTML = `
  <header class="ph"><div><h1>Monitor</h1><p>Seguimiento de indicadores respecto a la referencia personal (primeros 7 días del período).</p></div></header>
  <section class="panel watch" id="watchp">${watchPanel()}</section>
  <div class="grid2">
    <section class="panel"><h2>Indicadores</h2><div class="rows">${rows}</div><p class="foot">Estados demostrativos (±8 % y ±15 % de variación). Las reglas clínicas reales quedan pendientes de validación profesional.</p></section>
    <section class="panel"><div class="ch-h"><div class="ch-t"><h2>${m.label}</h2>${isLive ? `<span class="livebadge"><i></i>En vivo · ${src.real ? 'real (reloj)' : 'simulado'}</span>` : ''}</div><div class="seg">${[7, 14, ...(noLive ? [] : ['live'])].map(p => `<button class="${p === per ? 'on' : ''}" data-act="period" data-p="${p}">${p === 'live' ? 'En vivo' : p + ' días'}</button>`).join('')}</div></div>
      <dl class="stats" id="stats">${statsHtml(m, isLive, ys, isLive && src.real)}</dl>
      <div class="chw">${isLive ? (ys.length < 2 ? '<p class="mut wait">Esperando muestras del reloj…</p>' : chart(m, ys, src.xl, true, src.real)) : (ys.length < 2 ? '<p class="mut wait">Registra al menos 2 mediciones de este indicador en este período para ver la gráfica.</p>' : chart(m, ys, histX(ys.length, ds), false, false))}<div id="tip" class="tip"></div></div>
      <p class="foot">${isLive ? (src.real ? 'Medición real del reloj por Bluetooth (una muestra por segundo aproximadamente). Dato de bienestar, no médico. Las zonas de color son demostrativas y ajustables.' : 'Simulación en vivo: una muestra aleatoria cada 1,5 s cerca del último registro. No son mediciones reales; el desplazamiento solo ilustra cómo se vería la telemetría continua.') : (m.reg ? 'Mediciones registradas manualmente por la persona (la fuente figura en cada registro). Estados demostrativos respecto a la referencia personal. Dato de bienestar, no médico.' : 'Valores simulados. Pase el cursor sobre la gráfica para ver cada registro. Los puntos adoptan el color de su estado.')}${m.k === 'bp' ? ' Se grafica la presión sistólica.' : ''}</p></section>
  </div>
  ${measPanel()}
  <section class="panel"><h2>Observaciones</h2>
    <div class="grid2 obsg"><div>${fl.length ? fl.map(observation).join('') : '<p class="mut">Todos los indicadores están dentro de su referencia personal.</p>'}</div>
    <div><form id="nf"><h3>Registrar observación</h3>
      <label>Indicador<select name="k">${MX.map(x => `<option value="${x.k}" ${x.k === sel ? 'selected' : ''}>${x.label}</option>`).join('')}</select></label>
      <label>Duración del cambio (días)<input name="dur" type="number" min="0" max="365" placeholder="Opcional"></label>
      <label>Nota<textarea name="text" rows="3" required placeholder="Ej.: dormí con interrupciones por ruido del módulo."></textarea></label>
      <button class="pri" type="submit">Guardar observación</button></form>
      <ul class="notes">${notes}</ul></div></div>
  </section>`;
  bindMeas();
  bindChart(m, ys, isLive ? src.tip : histTip(m, ys, ds, dw));
  $('#nf').onsubmit = e => {
    e.preventDefault(); const f = e.target, mm = MX.find(x => x.k === f.k.value), t = f.text.value.trim(); if (!t) return;
    S.notes.push({ ts: Date.now(), k: mm.k, label: mm.label, dur: f.dur.value, text: t }); save(); toast('Observación guardada'); renderMonitor();
  };
}

/* ---------- Recovery ---------- */
function renderRecovery() {
  const dt = doneToday(), total = ACT.length, pctT = Math.round(dt.length / total * 100);
  const fl = flagged();
  const rel = fl.length ? `<section class="rel"><b>Relacionado con Monitor</b><ul>${fl.map(m => `<li>${m.label}: ${pct(m.dev)} vs. referencia → <button class="link" data-act="cat" data-cat="${m.rec}">${CATS.find(c => c.k === m.rec).name}</button></li>`).join('')}</ul></section>` : '';
  const tabs = CATS.map(c => { const rl = fl.some(m => m.rec === c.k), a = ACT.filter(x => x.cat === c.k), d = a.filter(x => dt.includes(x.id)).length;
    return `<button class="tab ${c.k === cat ? 'on' : ''}" data-act="cat" data-cat="${c.k}">${c.name}${rl ? '<i title="Relacionado con una variación en Monitor"></i>' : ''}<small class="${d === a.length ? 's-ok' : 's-no'}">${d}/${a.length}</small></button>`; }).join('');
  const items = ACT.filter(a => a.cat === cat).map(a => { const ok = dt.includes(a.id), ld = lastDone(a.id);
    return `<article class="act ${ok ? 'done' : 'pend'}"><div><h3>${a.name}</h3><p>${a.desc}</p><dl><div><dt>Objetivo</dt><dd>${a.goal}</dd></div><div><dt>Duración</dt><dd>${a.min} min</dd></div><div><dt>Estado</dt><dd class="${ok ? 's-ok' : 's-no'}">${ok ? 'Completada hoy' : 'Pendiente'}</dd></div><div><dt>Última realización</dt><dd>${ld ? fd(new Date(ld + 'T00:00')) : 'Sin registro'}</dd></div></dl></div>
    <button class="${ok ? '' : 'pri'}" data-act="toggle" data-id="${a.id}">${ok ? 'Deshacer' : 'Marcar completada'}</button></article>`; }).join('');
  const days = [...Array(7)].map((_, i) => { const d = new Date(TODAY); d.setDate(d.getDate() - (6 - i)); const k = lisoDate(d), c = (S.log[k] || []).length; return `<div class="hb ${k === TODAY_ISO ? 'today' : ''}${k === TODAY_ISO && c === total ? ' full' : ''}"><i style="height:${Math.round(c / total * 100)}%"></i><b>${c}</b><small>${d.toLocaleDateString('es', { weekday: 'short' })}</small></div>`; }).join('');
  $('#view').innerHTML = `
  <header class="ph"><div><h1>Recovery</h1><p>Actividades de seguimiento asignadas y supervisadas por profesionales (ilustrativas). No constituyen tratamiento médico.</p></div></header>
  ${rel}
  <div class="grid3"><section class="panel"><nav class="tabs">${tabs}</nav>${items}</section>
  <aside class="panel prog ${pctT === 100 ? 'full' : ''}"><h2>Progreso de hoy</h2><div class="big">${pctT}<small>%</small></div><div class="bar"><i style="width:${pctT}%"></i></div>
    <p class="${pctT === 100 ? 's-ok' : 's-no'}">${pctT === 100 ? 'Todo lo asignado está completo' : dt.length + ' completadas · ' + (total - dt.length) + ' pendientes'}</p>
    <h3>Historial de cumplimiento</h3><div class="hist">${days}</div><p class="foot">Actividades completadas por día (de ${total}). Historial previo ficticio.</p></aside></div>`;
}

/* ---------- Informe ---------- */
function report() {
  const L = ['ASTROCARE MISSION HEALTH — INFORME DEMOSTRATIVO', 'Equipo Cosmic Pirates · NASA Space Apps Challenge', `Generado: ${new Date().toLocaleString('es')}`, 'AVISO: prototipo. [simulado] = dato ficticio; [registrado] = introducido manualmente por la persona (fuente indicada en cada registro); el pulso de la sección del reloj proviene de un dispositivo de consumo. Datos de bienestar, no médicos. No es un diagnóstico y no hay conexión con la NASA.', '', 'Astronauta (perfil ficticio): Cdte. A. Ríos · AC-0417', '', 'INDICADORES (referencia personal = promedio de los primeros 7 días)'];
  MX.forEach(m => L.push(`- ${m.label} [${m.reg ? 'registrado' : 'simulado'}]: ${latestTxt(m)} ${m.unit} | ref. ${val(m, m.base)} | ${pct(m.dev)} | ${trTxt(m)} | ${ST[m.st][0]} (regla demostrativa)`));
  L.push('', 'MEDICIONES REGISTRADAS MANUALMENTE');
  S.meas.length ? S.meas.slice().sort((a, b) => a.ts - b.ts).forEach(e => L.push(`- [${new Date(e.ts).toLocaleString('es')}] ${MEAS[e.k].label}: ${fmtM(e)} (${e.src})`)) : L.push('- Ninguna');
  L.push('', 'PULSO REAL DEL RELOJ (Bluetooth; dato de bienestar, no médico)');
  const r = S.real; r && r.n ? L.push(`- ${r.n} muestras · promedio ${Math.round(r.sum / r.n)} BPM · mín. ${r.min} · máx. ${r.max} · ${new Date(r.first).toLocaleString('es')} a ${new Date(r.last).toLocaleString('es')}`) : L.push('- Sin sesión con reloj');
  const zz = S.hrz || HRZ_DEF; L.push(`- Zonas demostrativas de pulso en reposo: verde ${zz.gMin}-${zz.gMax} BPM; amarillo intermedio; rojo bajo ${zz.aMin} o sobre ${zz.aMax} (no clínicas)`);
  L.push('', 'OBSERVACIONES REGISTRADAS'); S.notes.length ? S.notes.forEach(n => L.push(`- [${new Date(n.ts).toLocaleString('es')}] ${n.label}${n.dur ? ' (' + n.dur + ' d)' : ''}: ${n.text}`)) : L.push('- Ninguna');
  L.push('', `RECOVERY — hoy: ${doneToday().length}/${ACT.length} actividades completadas`);
  ACT.forEach(a => L.push(`- [${doneToday().includes(a.id) ? 'x' : ' '}] ${a.name} (${a.min} min)`));
  const b = new Blob([L.join('\n')], { type: 'text/plain;charset=utf-8' }), a = document.createElement('a');
  a.href = URL.createObjectURL(b); a.download = `astrocare-informe-${TODAY_ISO}.txt`; a.click(); URL.revokeObjectURL(a.href); toast('Informe exportado');
}

/* ---------- Barra lateral y eventos ---------- */
function side() {
  const ms = new Date(TODAY); ms.setDate(ms.getDate() - 186);
  $('#mday').textContent = `Día ${Math.round((TODAY - ms) / 864e5) + 1} (simulado)`;
  const lm = (S.meas || []).slice().sort((a, b) => b.ts - a.ts)[0];
  $('#lastupd').textContent = lm ? `${fdt(lm.ts)} (registro manual)` : `${fd(DATES[N - 1])}, 09:00 (demo)`;
  const on = navigator.onLine;
  $('#conn').className = 'conn ' + (on ? 'on' : 'off');
  $('#conn').innerHTML = on ? '<i></i><div><b>Con red disponible</b><span>La demo funciona localmente</span></div>' : '<i></i><div><b>Modo offline</b><span>Registros guardados en este equipo</span></div>';
  document.querySelectorAll('.nav').forEach(b => b.classList.toggle('on', b.dataset.v === view));
}
const tick = () => { $('#clock').textContent = new Date().toISOString().slice(11, 16) + ' UTC'; };
function render() { view === 'monitor' ? renderMonitor() : renderRecovery(); side(); updateBanner(); }
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]'); if (!t) return; const d = t.dataset;
  switch (d.act) {
    case 'view': view = d.v; render(); window.scrollTo(0, 0); break;
    case 'sel': sel = d.k; render(); break;
    case 'period': period = d.p === 'live' ? 'live' : +d.p; render(); break;
    case 'goto': view = 'recovery'; cat = d.cat; render(); window.scrollTo(0, 0); break;
    case 'cat': cat = d.cat; render(); break;
    case 'toggle': { const l = S.log[TODAY_ISO] || (S.log[TODAY_ISO] = []), i = l.indexOf(d.id); i < 0 ? l.push(d.id) : l.splice(i, 1); save(); render(); toast(i < 0 ? 'Actividad registrada' : 'Registro deshecho'); break; }
    case 'watch': watch.status === 'on' ? disconnectWatch() : connectWatch(); break;
    case 'delmeas': S.meas = S.meas.filter(e => String(e.id) !== d.id); save(); recompute(); updateBanner(); renderMonitor(); toast('Medición eliminada'); break;
    case 'export': report(); break;
    case 'reset': if (confirm('¿Borrar observaciones y registros de actividades de esta demo?')) { localStorage.removeItem(KEY); S = seed(); save(); recompute(); render(); toast('Demo restablecida'); } break;
  }
});
document.addEventListener('change', e => {
  const t = e.target; if (!t.dataset || !t.dataset.hrz) return;
  const z = Object.assign({}, S.hrz || HRZ_DEF); z[t.dataset.hrz] = +t.value;
  const v = [z.aMin, z.gMin, z.gMax, z.aMax];
  if (v.some(x => !(x >= 20 && x <= 250)) || !(z.aMin <= z.gMin && z.gMin <= z.gMax && z.gMax <= z.aMax)) { toast('Valores no válidos: deben ir de menor a mayor'); renderMonitor(); return; }
  S.hrz = z; save(); renderMonitor(); toast('Zonas actualizadas');
});
addEventListener('online', side); addEventListener('offline', () => { side(); toast('Sin conexión: la plataforma sigue funcionando'); });
setInterval(() => {
  if (view !== 'monitor' || period !== 'live' || hover || document.hidden) return;
  const m = MX.find(x => x.k === sel); if ((m.k === 'hr' && watch.status === 'on') || (m.reg && m.k !== 'hr')) return;
  const b = liveBuf(m);
  b.push(nextSample(m, b[b.length - 1])); b.shift(); paintLive(m);
}, 1500);
tick(); setInterval(tick, 30000); save(); render();
})();
