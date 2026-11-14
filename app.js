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

const MX = METRICS.map(m => {
  const base = mean(m.series.slice(0, 7)), latest = m.series[N - 1], dev = (latest - base) / base * 100;
  let dur = 0;
  for (let i = N - 1; i >= 0; i--) { const d = (m.series[i] - base) / base * 100; if (Math.abs(d) >= 8 && Math.sign(d) === Math.sign(dev)) dur++; else break; }
  return { ...m, base, latest, dev, st: stat(dev), dur, tr: slope(m.series.slice(-5)) / base * 100 };
});
const val = (m, v) => v.toFixed(m.dec);
const latestTxt = m => m.k === 'bp' ? `${m.latest}/${m.dia[N - 1]}` : val(m, m.latest);
const trTxt = m => m.tr > .8 ? 'Ascendente' : m.tr < -.8 ? 'Descendente' : 'Estable';
const pct = v => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
const flagged = () => MX.filter(m => m.st > 0);

/* ---------- Estado persistente ---------- */
let S = load(), view = 'monitor', sel = 'sleep', period = 14, cat = 'rest';
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.log) return s; } catch (e) {} return seed(); }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('No se pudo guardar en el navegador'); } }
function seed() {
  const log = {};
  for (let k = 1; k <= 7; k++) { const d = new Date(TODAY); d.setDate(d.getDate() - k); log[lisoDate(d)] = ACT.filter((a, i) => Math.abs(Math.sin(k * 3 + i * 1.7)) > .35 + k * .04).map(a => a.id); }
  return { notes: [], log };
}
const doneToday = () => S.log[TODAY_ISO] || [];
const lastDone = id => Object.keys(S.log).filter(d => S.log[d].includes(id)).sort().pop();

/* ---------- Utilidades UI ---------- */
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2200); }
const chip = s => `<span class="chip ${ST[s][1]}">${ST[s][0]}</span>`;
function spark(m) {
  const a = m.series, lo = Math.min(...a), hi = Math.max(...a), r = hi - lo || 1;
  const pts = a.map((v, i) => `${(i * 70 / (N - 1)).toFixed(1)},${(22 - (v - lo) / r * 20).toFixed(1)}`).join(' ');
  return `<svg class="spark ${ST[m.st][1]}" viewBox="0 0 70 24"><polyline points="${pts}"/></svg>`;
}

/* ---------- Gráfica SVG ---------- */
let hover = false;
function chart(m, ys, xlabel, live) {
  const n = ys.length, W = 720, H = 300, p = { l: 46, r: 16, t: 16, b: 30 };
  let lo = Math.min(...ys, m.base), hi = Math.max(...ys, m.base); const pad = (hi - lo) * .25 || 1; lo -= pad; hi += pad;
  const X = i => p.l + i * (W - p.l - p.r) / (n - 1), Y = v => p.t + (hi - v) * (H - p.t - p.b) / (hi - lo);
  let g = '';
  for (let i = 0; i <= 4; i++) { const v = lo + (hi - lo) * i / 4, y = Y(v); g += `<line class="grid" x1="${p.l}" x2="${W - p.r}" y1="${y}" y2="${y}"/><text class="ax" x="${p.l - 8}" y="${y + 4}" text-anchor="end">${val(m, v)}</text>`; }
  for (let i = 0; i < n; i++) { const t = xlabel(i); if (t) g += `<text class="ax" x="${X(i)}" y="${H - 8}" text-anchor="middle">${t}</text>`; }
  const line = ys.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join('');
  const dots = ys.map((v, i) => `<circle class="pt ${ST[stat((v - m.base) / m.base * 100)][1]}${i === n - 1 ? ' last' : ''}" cx="${X(i)}" cy="${Y(v)}" r="${i === n - 1 ? 6 : n > 20 ? 2 : 3.5}"/>`).join('');
  return `<svg id="ch" class="${live ? 'lv' : ''}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${live ? 'Simulación en vivo' : 'Historial'} de ${m.label}">${g}
  <line class="base" x1="${p.l}" x2="${W - p.r}" y1="${Y(m.base)}" y2="${Y(m.base)}"/>
  <text class="ax acc" x="${W - p.r}" y="${Y(m.base) - 6}" text-anchor="end">Referencia personal ${val(m, m.base)}</text>
  <path class="ln" d="${line}"/>${dots}<line id="gd" class="guide" y1="${p.t}" y2="${H - p.b}" x1="0" x2="0"/></svg>`;
}
const histX = (n, ds) => i => (n <= 7 || i % 2 === 0 || i === n - 1) ? fd(ds[i]) : '';
const liveX = n => i => (n - 1 - i) % 8 === 0 ? (i === n - 1 ? 'ahora' : `-${(n - 1 - i) * 1.5} s`) : '';
const histTip = (m, ys, ds) => i => {
  const dv = (ys[i] - m.base) / m.base * 100, dia = m.dia ? `/${m.dia.slice(-ys.length)[i]}` : '';
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
function statsHtml(m, isLive, ys) {
  const cur = isLive ? ys[ys.length - 1] : m.latest, dev = (cur - m.base) / m.base * 100;
  const t = isLive ? slope(ys.slice(-10)) * 9 / m.base * 100 : m.tr, th = isLive ? .3 : .8;
  const tr = t > th ? 'Ascendente' : t < -th ? 'Descendente' : 'Estable';
  return `<div><dt>${isLive ? 'Muestra actual' : 'Más reciente'}</dt><dd>${isLive ? val(m, cur) : latestTxt(m)} <small>${m.unit}</small></dd></div><div><dt>Referencia personal</dt><dd>${val(m, m.base)} <small>${m.unit}</small></dd></div><div><dt>Variación</dt><dd>${pct(dev)}</dd></div><div><dt>Tendencia</dt><dd>${tr}</dd></div>`;
}
function paintLive(m) {
  const ys = liveBuf(m), svg = $('#ch'); if (!svg) return;
  svg.outerHTML = chart(m, ys, liveX(ys.length), true);
  $('#stats').innerHTML = statsHtml(m, true, ys);
  bindChart(m, ys, liveTip(m, ys));
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
  const m = MX.find(x => x.k === sel), fl = flagged(), isLive = period === 'live';
  const ys = isLive ? liveBuf(m) : m.series.slice(-period), ds = isLive ? null : DATES.slice(-period);
  const rows = MX.map(x => `<button class="row ${x.k === sel ? 'sel' : ''}" data-act="sel" data-k="${x.k}">
    <span class="rl"><b>${x.label}</b><small>Ref. ${val(x, x.base)} ${x.unit}</small></span>${spark(x)}
    <span class="rv"><b>${latestTxt(x)}</b><small>${x.unit}</small></span><span class="rs">${chip(x.st)}</span></button>`).join('');
  const notes = S.notes.length ? S.notes.slice().reverse().map(n => `<li><b>${n.label}</b> <small>${new Date(n.ts).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}${n.dur ? ' · ' + n.dur + ' d' : ''}</small><p>${n.text.replace(/</g, '&lt;')}</p></li>`).join('') : '<li class="mut">Aún no hay observaciones registradas. Use el formulario para añadir la primera.</li>';
  $('#view').innerHTML = `
  <header class="ph"><div><h1>Monitor</h1><p>Seguimiento de indicadores respecto a la referencia personal (primeros 7 días del período).</p></div></header>
  <div class="grid2">
    <section class="panel"><h2>Indicadores</h2><div class="rows">${rows}</div><p class="foot">Estados demostrativos (±8 % y ±15 % de variación). Las reglas clínicas reales quedan pendientes de validación profesional.</p></section>
    <section class="panel"><div class="ch-h"><div class="ch-t"><h2>${m.label}</h2>${isLive ? '<span class="livebadge"><i></i>En vivo · simulado</span>' : ''}</div><div class="seg">${[7, 14, 'live'].map(p => `<button class="${p === period ? 'on' : ''}" data-act="period" data-p="${p}">${p === 'live' ? 'En vivo' : p + ' días'}</button>`).join('')}</div></div>
      <dl class="stats" id="stats">${statsHtml(m, isLive, ys)}</dl>
      <div class="chw">${isLive ? chart(m, ys, liveX(ys.length), true) : chart(m, ys, histX(ys.length, ds), false)}<div id="tip" class="tip"></div></div>
      <p class="foot">${isLive ? 'Simulación en vivo: una muestra aleatoria cada 1,5 s cerca del último registro. No son mediciones reales; el desplazamiento solo ilustra cómo se vería la telemetría continua.' : 'Valores simulados. Pase el cursor sobre la gráfica para ver cada registro. Los puntos adoptan el color de su estado.'}${m.k === 'bp' ? ' Se grafica la presión sistólica.' : ''}</p></section>
  </div>
  <section class="panel"><h2>Observaciones</h2>
    <div class="grid2 obsg"><div>${fl.length ? fl.map(observation).join('') : '<p class="mut">Todos los indicadores están dentro de su referencia personal.</p>'}</div>
    <div><form id="nf"><h3>Registrar observación</h3>
      <label>Indicador<select name="k">${MX.map(x => `<option value="${x.k}" ${x.k === sel ? 'selected' : ''}>${x.label}</option>`).join('')}</select></label>
      <label>Duración del cambio (días)<input name="dur" type="number" min="0" max="365" placeholder="Opcional"></label>
      <label>Nota<textarea name="text" rows="3" required placeholder="Ej.: dormí con interrupciones por ruido del módulo."></textarea></label>
      <button class="pri" type="submit">Guardar observación</button></form>
      <ul class="notes">${notes}</ul></div></div>
  </section>`;
  bindChart(m, ys, isLive ? liveTip(m, ys) : histTip(m, ys, ds));
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
  const L = ['ASTROCARE MISSION HEALTH — INFORME DEMOSTRATIVO', 'Equipo Cosmic Pirates · NASA Space Apps Challenge', `Generado: ${new Date().toLocaleString('es')}`, 'AVISO: prototipo con datos ficticios. No son mediciones reales, no es un diagnóstico y no hay conexión con la NASA.', '', 'Astronauta (perfil ficticio): Cdte. A. Ríos · AC-0417', '', 'INDICADORES (referencia personal = promedio de los primeros 7 días)'];
  MX.forEach(m => L.push(`- ${m.label}: ${latestTxt(m)} ${m.unit} | ref. ${val(m, m.base)} | ${pct(m.dev)} | ${trTxt(m)} | ${ST[m.st][0]} (regla demostrativa)`));
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
  $('#lastupd').textContent = `${fd(DATES[N - 1])}, 09:00 (demo)`;
  const on = navigator.onLine;
  $('#conn').className = 'conn ' + (on ? 'on' : 'off');
  $('#conn').innerHTML = on ? '<i></i><div><b>Con red disponible</b><span>La demo funciona localmente</span></div>' : '<i></i><div><b>Modo offline</b><span>Registros guardados en este equipo</span></div>';
  document.querySelectorAll('.nav').forEach(b => b.classList.toggle('on', b.dataset.v === view));
}
const tick = () => { $('#clock').textContent = new Date().toISOString().slice(11, 16) + ' UTC'; };
function render() { view === 'monitor' ? renderMonitor() : renderRecovery(); side(); }
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]'); if (!t) return; const d = t.dataset;
  switch (d.act) {
    case 'view': view = d.v; render(); window.scrollTo(0, 0); break;
    case 'sel': sel = d.k; render(); break;
    case 'period': period = d.p === 'live' ? 'live' : +d.p; render(); break;
    case 'goto': view = 'recovery'; cat = d.cat; render(); window.scrollTo(0, 0); break;
    case 'cat': cat = d.cat; render(); break;
    case 'toggle': { const l = S.log[TODAY_ISO] || (S.log[TODAY_ISO] = []), i = l.indexOf(d.id); i < 0 ? l.push(d.id) : l.splice(i, 1); save(); render(); toast(i < 0 ? 'Actividad registrada' : 'Registro deshecho'); break; }
    case 'export': report(); break;
    case 'reset': if (confirm('¿Borrar observaciones y registros de actividades de esta demo?')) { localStorage.removeItem(KEY); S = seed(); save(); render(); toast('Demo restablecida'); } break;
  }
});
addEventListener('online', side); addEventListener('offline', () => { side(); toast('Sin conexión: la plataforma sigue funcionando'); });
setInterval(() => {
  if (view !== 'monitor' || period !== 'live' || hover || document.hidden) return;
  const m = MX.find(x => x.k === sel), b = liveBuf(m);
  b.push(nextSample(m, b[b.length - 1])); b.shift(); paintLive(m);
}, 1500);
tick(); setInterval(tick, 30000); save(); render();
})();
