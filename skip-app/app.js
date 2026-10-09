/* SKIP APP – interface mobile (PWA). Données de démo stockées sur l'appareil (localStorage). */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const KEY = 'skip.v1';
const todayKey = () => new Date().toISOString().slice(0, 10);
const hhmm = t => new Date(t).toTimeString().slice(0, 5);
const scoreColor = s => `hsl(${Math.round(130 - (Math.max(1, Math.min(10, s)) - 1) / 9 * 130)} 75% 42%)`;

const defaults = () => ({
  station: 'alpe', tab: 'pistes', level: 5, audio: true,
  profile: { pseudo: '', discipline: 'ski', wants: [], status: 'slopes', socials: {} },
  votes: {}, hearts: [], log: {}, route: null, chat: {}, screen: {}, closed: [], friends: {},
  filt: { colors: [], q: '', sort: 'color', fit: false, open: false },
  rf: { start: null, budget: 120, speed: 'medium', colors: ['green', 'blue', 'red'] }
});
let S = (() => { try { return Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { return defaults(); } })();
S.profile = { ...defaults().profile, ...S.profile }; S.filt = { ...defaults().filt, ...S.filt }; S.rf = { ...defaults().rf, ...S.rf };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* stockage indisponible */ } };

const station = () => DATA.stations[S.station];
const pisteOf = (id, st = station()) => st.pistes.find(p => p.id === id);
const liftOf = (id, st = station()) => st.lifts.find(l => l.id === id);
const info = p => {
  const b = Engine.blended(p, S.votes[p.id]);
  return { ...b, label: Engine.label(b.score), fit: Engine.fit(b.score, S.level), hearts: (p.hearts || 0) + (S.hearts.includes(p.id) ? 1 : 0), closed: S.closed.includes(p.id) };
};
const scoreBubble = (s, big) => s == null ? `<div class="score none${big ? ' big' : ''}">–<small>non noté</small></div>` : `<div class="score${big ? ' big' : ''}" style="background:${scoreColor(s)}">${s.toFixed(1).replace('.', ',')}<small>/10</small></div>`;
const colorName = c => Engine.COLOR_LABEL[c];

let plan = null, guide = null, pending = {}, sheetVote = null;
let watchId = null, trk = {}, wakeLock = null;

function toast(msg, ms = 3200) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, ms);
}
function speak(text) {
  if (S.audio && 'speechSynthesis' in window) {
    try { const u = new SpeechSynthesisUtterance(text); u.lang = 'fr-FR'; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch { /* ignore */ }
  }
  if (navigator.vibrate) navigator.vibrate(80);
}

/* ---------- Pistes ---------- */
const COLORS = ['green', 'blue', 'red', 'black'], RANK = { green: 0, blue: 1, red: 2, black: 3 };
const norm = t => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
function filtered() {
  const f = S.filt, st = station(), q = norm(f.q).trim();
  const l = st.pistes.map(p => ({ p, i: info(p) })).filter(({ p, i }) => q ? norm(p.name).includes(q) :
    (!f.colors.length || f.colors.includes(p.color)) && (!f.fit || i.score == null || i.score <= S.level + 1.5));
  const byColor = (a, b) => RANK[a.p.color] - RANK[b.p.color] || a.p.name.localeCompare(b.p.name);
  l.sort(f.sort === 'hearts' ? (a, b) => b.i.hearts - a.i.hearts || byColor(a, b) : f.sort === 'name' ? (a, b) => a.p.name.localeCompare(b.p.name)
    : f.sort === 'score' ? (a, b) => (b.i.score ?? -1) - (a.i.score ?? -1) || byColor(a, b) : byColor);
  return l;
}
function pisteRow({ p, i }) {
  return `<button class="piste${i.closed ? ' closed' : ''}" data-action="open" data-id="${p.id}">
    <span class="sq ${p.color}" title="${colorName(p.color)}"></span>
    <span class="sp"><b>${esc(p.name)}</b><br>
      <span class="mut">Piste ${colorName(p.color).toLowerCase()}${p.km ? ' · ' + p.km + ' km' : ''}${i.closed ? ' · fermée' : ''}</span>${i.fit.key === 'hard' ? ' <span class="fit hard">⚠ trop dur</span>' : ''}</span>
    ${scoreBubble(i.score)}</button>`;
}
function renderPistes() {
  const f = S.filt, st = station();
  const full = st.pistes.filter(Engine.routable).length;
  return `<h2>Pistes · ${esc(st.name)}</h2>
  <input type="search" id="q" class="bigsearch" placeholder="🔍 Chercher une piste" value="${esc(f.q)}" aria-label="Chercher une piste" autocomplete="off">
  <div class="chips" style="margin:10px 0">
    <button class="chip${f.colors.length ? '' : ' on'}" data-action="allcolors">Toutes</button>
    ${COLORS.map(c => `<button class="chip${f.colors.includes(c) ? ' on' : ''}" data-action="color" data-c="${c}"><span class="sq ${c}" style="display:inline-block;vertical-align:-2px"></span> ${colorName(c)}</button>`).join('')}
    <button class="chip${f.sort === 'hearts' ? ' on' : ''}" data-action="sort" data-k="${f.sort === 'hearts' ? 'color' : 'hearts'}">❤ Top</button>
    <button class="chip${f.open ? ' on' : ''}" data-action="filters">Réglages</button>
  </div>
  ${f.open ? `<div class="card">
    <div class="mut">Trier par</div>
    <div class="seg" style="margin:6px 0 10px">${[['color', 'Couleur'], ['score', 'Note'], ['hearts', '❤'], ['name', 'A-Z']].map(([k, t]) => `<button class="${f.sort === k ? 'on' : ''}" data-action="sort" data-k="${k}">${t}</button>`).join('')}</div>
    <div class="mut">Mon niveau : <b id="lvl">${S.level}</b>/10</div>
    <input type="range" min="1" max="10" step="0.5" value="${S.level}" data-range="level" aria-label="Mon niveau">
    <label class="chk"><input type="checkbox" data-bind="fit" ${f.fit ? 'checked' : ''}> Masquer les pistes notées trop dures pour moi</label></div>` : ''}
  <div id="plist">${listHtml()}</div>
  <p class="mut" style="margin-top:14px">Les pistes n'ont pas encore de note : personne n'a voté. Skie une piste puis note-la pour lancer la moyenne. ${full} piste(s) sur ${st.pistes.length} ont un parcours complet pour les itinéraires, les autres sont à compléter avec le plan officiel.</p>`;
}
const listHtml = () => { const l = filtered(); return l.length ? l.map(pisteRow).join('') : '<p class="mut">Aucune piste trouvée.</p>'; };

function openSheet(html) { const s = $('#sheet'); s.innerHTML = `<div class="in"><button class="x" data-action="close" aria-label="Fermer">✕</button>${html}</div>`; s.hidden = false; }
function closeSheet() { $('#sheet').hidden = true; sheetVote = null; }
function pisteSheet(id) {
  const p = pisteOf(id), i = info(p), mine = S.votes[id], liked = S.hearts.includes(id), st = station();
  const sel = sheetVote ?? mine;
  const times = p.min ? ['slow', 'medium', 'fast'].map(k => Engine.speedMin(p, k)).join(' / ') + ' min' : null;
  const cell = (k, v) => v ? `<div>${k}<b>${esc(v)}</b></div>` : '';
  openSheet(`<div class="row"><span class="sq ${p.color}" style="width:22px;height:22px"></span><h2 style="margin:0">${esc(p.name)}</h2></div>
    <div class="mut">Piste ${colorName(p.color).toLowerCase()} officielle</div>
    <div class="row" style="margin:12px 0">${scoreBubble(i.score, true)}<div>
      ${i.score == null ? '<b>Pas encore noté</b><br><span class="mut">Personne n\'a voté. Sois le premier à la noter !</span>'
        : `<span class="lab ${i.label.key}">${i.label.icon} Piste ${i.label.text.toUpperCase()}</span><br><span class="fit ${i.fit.key}">${i.fit.text} (niveau ${S.level}/10)</span><br><span class="mut">Moyenne basée sur ${i.votes} vote${i.votes > 1 ? 's' : ''}</span>`}</div></div>
    ${i.closed ? '<div class="warn">⚠ Piste fermée actuellement.</div>' : ''}
    ${i.fit.key === 'hard' ? '<div class="warn">⚠ Cette piste est nettement au-dessus de ton niveau. Choisis plutôt une piste plus facile.</div>' : ''}
    ${p.info ? `<p>${esc(p.info)}</p>` : ''}
    <div class="data">${cell('Longueur', p.km ? p.km + ' km' : '')}${cell('Durée lent / moyen / rapide', times)}
      ${cell('Départ', p.from ? st.nodes[p.from].name : '')}${cell('Arrivée', p.to ? st.nodes[p.to].name : '')}
      ${cell('Pente moy. / max', p.slope != null ? p.slope + '% / ' + (p.maxSlope ?? '?') + '%' : '')}${cell('Largeur', p.width ? p.width + ' m' : '')}</div>
    <div class="mut">${Engine.routable(p) ? '' : 'Durée, départ et arrivée à compléter avec le plan officiel. '}Source : ${p.source === 'deck' ? 'présentation SKIP' : esc(p.src || 'recherche web')}.</div>
    <h3>${mine ? 'Ta note' : 'Donne ta note'}</h3><div class="mut">1 = très facile · 10 = très difficile</div>
    <div class="rate" data-rate="${id}">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<button style="background:${scoreColor(n)}" class="${sel === n ? 'on' : ''}" data-action="pick" data-n="${n}">${n}</button>`).join('')}</div>
    <button class="btn" data-action="validate" data-id="${id}" ${sel ? '' : 'disabled'}>${mine ? 'Modifier ma note' : 'Valider ma note'}</button>
    <h3>Coup de cœur</h3>
    <button class="heart${liked ? ' on' : ''}" data-action="heart" data-id="${id}">${liked ? '❤️ Dans mes coups de cœur' : '🤍 Ajouter aux coups de cœur'} · ${i.hearts ? i.hearts + ' skieur' + (i.hearts > 1 ? 's ont adoré' : ' a adoré') + ' cette piste' : 'sois le premier à l\'adorer'}</button>
    <div style="height:10px"></div>
    <button class="btn sec" data-action="skied" data-id="${id}">✅ Je l'ai skiée aujourd'hui</button>`);
}

/* ---------- Itinéraire ---------- */
const nodeName = (st, id) => st.nodes[id].name + (st.nodes[id].alt ? ` (${st.nodes[id].alt} m)` : '');
function wrap(t, n) { const w = t.split(' '), out = []; let c = ''; w.forEach(x => { if ((c + ' ' + x).trim().length > n) { out.push(c); c = x; } else c = (c + ' ' + x).trim(); }); out.push(c); return out; }
function mapSvg(st, pl) {
  const stepNums = {}; (pl ? pl.steps : []).forEach((s, i) => (stepNums[s.ref.id] = stepNums[s.ref.id] || []).push(i + 1));
  const pair = {}, edges = [...st.pistes.filter(Engine.routable).map(e => ({ e, k: 'piste' })), ...st.lifts.map(e => ({ e, k: 'lift' }))];
  const geo = edges.map(({ e, k }) => {
    const a = st.nodes[e.from], b = st.nodes[e.to], key = [e.from, e.to].sort().join('|'), n = pair[key] = (pair[key] || 0) + 1;
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, bend = (k === 'lift' ? 0 : 26) + (n - 1) * 22 * (k === 'lift' ? 1 : 1);
    const cx = (a.x + b.x) / 2 - dy / len * bend, cy = (a.y + b.y) / 2 + dx / len * bend;
    return { e, k, a, b, cx, cy, mx: .25 * a.x + .5 * cx + .25 * b.x, my: .25 * a.y + .5 * cy + .25 * b.y };
  });
  const draw = g => { const on = !!stepNums[g.e.id], col = g.k === 'lift' ? '#6b7690' : `var(--${g.e.color})`;
    return `<path d="M${g.a.x} ${g.a.y} Q${g.cx} ${g.cy} ${g.b.x} ${g.b.y}" fill="none" style="stroke:${col}" stroke-width="${on ? 5 : 2.5}" ${g.k === 'lift' ? 'stroke-dasharray="6 4"' : ''} stroke-linecap="round" opacity="${!pl || on ? 1 : .3}"/>`; };
  const badges = geo.filter(g => stepNums[g.e.id]).map(g => `<g><circle cx="${g.mx}" cy="${g.my}" r="${stepNums[g.e.id].length > 1 ? 14 : 11}" style="fill:${g.k === 'lift' ? '#3d4660' : 'var(--' + g.e.color + ')'}" stroke="#fff" stroke-width="2"/>
    <text x="${g.mx}" y="${g.my + 4}" text-anchor="middle" font-size="12" font-weight="800" fill="#fff">${stepNums[g.e.id].join(',')}</text></g>`).join('');
  const used = new Set(pl ? pl.steps.flatMap(s => [s.from, s.to]) : []);
  const startId = pl ? pl.opt.start : null, endId = st.base;
  const nodes = Object.entries(st.nodes).map(([id, n]) => {
    const right = n.x < 170, tx = n.x + (right ? 14 : -14), anchor = right ? 'start' : 'end';
    const lines = wrap(n.short || n.name, 16).slice(0, 2), tag = pl && (id === startId || id === endId) ? (id === startId && id === endId ? 'DÉPART · ARRIVÉE' : id === startId ? 'DÉPART' : 'ARRIVÉE') : '';
    const y0 = n.y - 4 - (lines.length - 1) * 6 + (n.alt ? -4 : 0);
    return `<g opacity="${!pl || used.has(id) ? 1 : .45}"><circle cx="${n.x}" cy="${n.y}" r="7" style="fill:var(--card);stroke:var(--ink)" stroke-width="2.5"/>
      <text text-anchor="${anchor}" font-size="10" style="fill:var(--ink)">${tag ? `<tspan x="${tx}" y="${y0 - 12}" font-weight="800" style="fill:var(--brand)">${tag}</tspan>` : ''}
      ${lines.map((t, i) => `<tspan x="${tx}" y="${y0 + i * 12}">${esc(t)}</tspan>`).join('')}${n.alt ? `<tspan x="${tx}" y="${y0 + lines.length * 12}" font-weight="700">${n.alt} m</tspan>` : ''}</text></g>`; }).join('');
  return `<svg class="map" viewBox="0 0 340 330" role="img" aria-label="Schéma de l'itinéraire">${geo.filter(g => !stepNums[g.e.id]).map(draw).join('')}${geo.filter(g => stepNums[g.e.id]).map(draw).join('')}${badges}${nodes}</svg>
    <div class="mut" style="margin:6px 0 0">Trait plein = piste (couleur officielle) · pointillés = remontée · pastille = numéro de l'étape. Schéma, pas à l'échelle.</div>`;
}
function stepsHtml(pl, st) {
  let t = 0;
  const rows = pl.steps.map((s, i) => {
    t += s.min;
    if (s.kind === 'lift') {
      const l = s.ref;
      return `<div class="step"><div class="num" style="background:#3d4660">${i + 1}</div><div class="sp"><b>Prends la ${esc(l.name.charAt(0).toLowerCase() + l.name.slice(1))}</b><br>
        <span class="mut">De : ${esc(nodeName(st, l.from))}<br>Jusqu'à : ${esc(nodeName(st, l.to))}<br>Trajet : ${s.min} min</span>
        ${l.note ? `<div class="warn" style="margin:6px 0 0">⚠ ${esc(l.note)}</div>` : ''}</div><span class="mut">${t} min</span></div>`;
    }
    const p = s.ref;
    return `<div class="step"><div class="num" style="background:var(--${p.color})">${i + 1}</div><div class="sp"><b>Descends « ${esc(p.name)} »</b> <span class="mut">· piste ${colorName(p.color).toLowerCase()}</span><br>
      <span class="mut">De : ${esc(nodeName(st, p.from))}<br>Jusqu'à : ${esc(nodeName(st, p.to))}<br>${p.km} km · environ ${s.min} min</span></div><span class="mut">${t} min</span></div>`;
  }).join('');
  return rows + `<div class="step"><div class="num" style="background:var(--brand)">🏁</div><div class="sp"><b>Arrivée</b><br><span class="mut">${esc(nodeName(st, pl.steps[pl.steps.length - 1].to))}</span></div><span class="mut">${pl.total} min</span></div>`;
}
const fmtMin = m => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
function planSummary(pl, st) {
  const cols = {}; pl.steps.filter(s => s.kind === 'piste').forEach(s => cols[s.ref.color] = (cols[s.ref.color] || 0) + 1);
  const first = pl.steps[0], want = pl.opt.budget;
  return `<p style="margin:0 0 10px">Tu pars de <b>${esc(st.nodes[pl.opt.start].name)}</b> et tu finis à <b>${esc(st.nodes[st.base].name)}</b>, en ${pl.steps.length} étapes.</p>
    <div class="stats"><div><b>${fmtMin(pl.total)}</b><span>durée</span></div><div><b>${pl.descents}</b><span>descentes</span></div><div><b>${pl.km} km</b><span>skiés</span></div>
    <div><b>${Object.entries(cols).map(([c, n]) => `<span class="sq ${c}" style="display:inline-block"></span>${n}`).join(' ')}</b><span>pistes</span></div></div>
    ${Math.abs(pl.total - want) > 15 ? `<div class="mut" style="margin-top:8px">Durée demandée : ${fmtMin(want)}. Le domaine saisi est encore petit : c'est le parcours qui s'en approche le plus.</div>` : ''}
    <div class="mut" style="margin-top:6px">Durées de remontée et de descente tirées de la présentation SKIP (skieur moyen). Les temps d'attente ne sont pas inclus.</div>`;
}
function renderRoute() {
  const st = station(), f = S.rf;
  if (!f.start || !st.nodes[f.start]) f.start = st.base;
  const saved = S.route && S.route.stationId === S.station ? S.route : null;
  const have = new Set(st.pistes.filter(Engine.routable).map(p => p.color));
  const dur = [[90, '1 h 30'], [120, '2 h'], [180, '3 h'], [240, '4 h']];
  return `<h2>Créer mon itinéraire</h2>
  ${guide ? `<div class="card" style="border-color:var(--brand)"><b>🔊 Guidage en cours</b><div style="margin:6px 0">${guide.idx < guide.plan.steps.length ? 'Prochaine étape : ' + esc(stepText(guide.plan.steps[guide.idx])) : '🎉 Itinéraire terminé !'}</div>
    <div class="row"><button class="btn sm" data-action="gnext">Étape suivante</button><button class="btn sm ghost" data-action="gstop">Arrêter</button></div></div>` : ''}
  <div class="card">
    <label class="mut">D'où pars-tu ?</label>
    <select class="f" data-bind="start">${Object.entries(st.nodes).map(([id, n]) => `<option value="${id}" ${f.start === id ? 'selected' : ''}>${esc(nodeName(st, id))}</option>`).join('')}</select>
    <div style="height:10px"></div><label class="mut">Combien de temps ?</label>
    <div class="chips">${dur.map(([m, t]) => `<button class="chip${f.budget === m ? ' on' : ''}" data-action="rf" data-k="budget" data-v="${m}">${t}</button>`).join('')}</div>
    <div style="height:10px"></div><label class="mut">Quelles pistes veux-tu ?</label>
    <div class="chips">${COLORS.map(c => `<button class="chip${f.colors.includes(c) ? ' on' : ''}" style="${have.has(c) ? '' : 'opacity:.45'}" data-action="rcolor" data-c="${c}"><span class="sq ${c}" style="display:inline-block;vertical-align:-2px"></span> ${colorName(c)}</button>`).join('')}</div>
    <div class="mut" style="margin-top:4px">Les couleurs estompées n'ont pas encore de piste avec parcours.</div>
    <div style="height:10px"></div><label class="mut">Ta vitesse</label>
    <div class="seg">${[['slow', '🐢 Lent'], ['medium', '⛷ Moyen'], ['fast', '⚡ Rapide']].map(([k, t]) => `<button class="${f.speed === k ? 'on' : ''}" data-action="rf" data-k="speed" data-v="${k}">${t}</button>`).join('')}</div>
    <div style="height:12px"></div><button class="btn" data-action="plan">Créer mon itinéraire</button>
  </div>
  <div id="planOut">${plan ? planHtml(plan) : ''}</div>
  ${saved ? `<div class="card"><b>📥 Itinéraire téléchargé</b><div class="mut">Enregistré le ${new Date(saved.savedAt).toLocaleString('fr-FR')}, disponible sans réseau. Les infos (fermetures) sont celles de ce moment-là.</div>
    <div class="row" style="margin-top:8px"><button class="btn sm sec" data-action="loadsaved">Ouvrir</button><button class="btn sm ghost" data-action="delsaved">Supprimer</button></div></div>` : ''}`;
}
function planHtml(pl) {
  const st = DATA.stations[pl.stationId];
  return `<div class="card"><h3 style="margin-top:0">Ton parcours</h3>${planSummary(pl, st)}</div>
    <div class="card">${mapSvg(st, pl)}</div>
    <div class="card"><h3 style="margin-top:0">Étape par étape</h3>${stepsHtml(pl, st)}</div>
    <div class="row"><button class="btn sec" data-action="download">📥 Télécharger hors ligne</button><button class="btn sec" data-action="gstart">🔊 Guidage audio</button></div>
    <div style="height:8px"></div><button class="btn ghost" data-action="share" data-k="route">📤 Partager cet itinéraire</button>`;
}
const stepText = s => s.kind === 'lift' ? `Prenez la ${s.ref.name}, ${s.min} minutes.${s.ref.note ? ' ' + s.ref.note : ''}` : `Descendez ${s.ref.name}, piste ${colorName(s.ref.color).toLowerCase()}, environ ${s.min} minutes.`;
function generate() {
  const f = S.rf, st = station();
  plan = Engine.plan(st, { ...f, closed: S.closed });
  save(); render();
  if (!plan) toast('Aucun parcours avec ces couleurs. Ajoute une couleur (rouge, verte…) ou change la durée.', 5000);
}

/* ---------- Ma journée ---------- */
const logToday = () => (S.log[todayKey()] || []).filter(e => e.stationId === S.station);
function addLog(seg) {
  const e = { ...seg, stationId: S.station, pick: seg.cands.length === 1 ? seg.cands[0] : null };
  (S.log[todayKey()] = S.log[todayKey()] || []).push(e); save();
  if (e.type === 'piste') {
    const nm = e.pick ? pisteOf(e.pick).name : 'une piste';
    if (!$('#pocket').hidden) { speak(`Descente enregistrée : ${nm}`); updatePocket(); } else toast('Descente enregistrée : ' + nm);
  }
}
function handleFix(pos, t) {
  const seg = Engine.onFix(station(), trk, pos, t);
  if (seg) { addLog(seg); if (guide && trk.lastNode === guide.plan.steps[guide.idx]?.to) advanceGuide(); }
  if (S.tab === 'day' && $('#pocket').hidden) render();
}
function startTracking() {
  if (watchId !== null) return true;
  if (!navigator.geolocation) { toast('GPS indisponible sur cet appareil.'); return false; }
  trk = {};
  watchId = navigator.geolocation.watchPosition(p => handleFix({ lat: p.coords.latitude, lng: p.coords.longitude }, Date.now()),
    e => toast('GPS : ' + e.message, 5000), { enableHighAccuracy: true, maximumAge: 5000 });
  return true;
}
function stopTracking() { if (watchId !== null) navigator.geolocation.clearWatch(watchId); watchId = null; }
function simulateDay() {
  const st = station(), pl = Engine.plan(st, { budget: 120, colors: COLORS, closed: [] });
  if (!pl) return;
  trk = {}; let t = new Date().setHours(9, 0, 0, 0);
  const seq = [pl.opt.start, ...pl.steps.map(s => s.to)];
  seq.forEach(n => { const seg = Engine.onFix(st, trk, { nodeId: n }, t); if (seg) addLog(seg); t += 11 * 60000; });
  toast('Journée de test créée : descentes détectées sans toucher l\'écran.');
  render();
}
function renderDay() {
  const st = station(), log = logToday();
  const mins = Math.round((S.screen[todayKey()] || 0) / 60), auto = log.filter(e => e.auto && e.type === 'piste').length;
  const pistes = [...new Set(log.filter(e => e.type === 'piste' && e.pick).map(e => e.pick))];
  const nPending = Object.keys(pending).length, hour = new Date().getHours();
  return `<h2>Ma journée</h2>
  ${pistes.length && hour >= 16 ? '<div class="warn">🌇 La journée est finie ? Note tes pistes ci-dessous en 2 secondes chacune.</div>' : ''}
  <div class="card"><b>📍 Enregistrement sans regarder l'écran</b>
    <div class="mut" style="margin:4px 0 10px">Le GPS détecte tes descentes et remontées. Range ton téléphone en poche : tu notes le soir.</div>
    <div class="row"><button class="btn" data-action="track">${watchId !== null ? '⏹ Arrêter' : '▶ Démarrer'} l'enregistrement</button>
    <button class="btn sec" data-action="pocket">🌑 Mode poche</button></div>
    <label class="chk"><input type="checkbox" data-bind="audio" ${S.audio ? 'checked' : ''}> Confirmation vocale + vibration (sans regarder)</label></div>
  <div class="card"><b>📵 Temps d'écran aujourd'hui : ${mins} min</b>
    <div class="bar" style="margin:8px 0"><i style="width:${Math.min(100, mins / 15 * 100)}%"></i></div>
    <div class="mut">Objectif : moins de 15 min. ${auto} descente(s) enregistrée(s) automatiquement, sans toucher le téléphone. Profite de la remontée pour admirer le paysage 🏔️</div></div>
  <h3>Descentes de la journée (${log.filter(e => e.type === 'piste').length})</h3>
  <div class="card">${log.length ? log.map((e, k) => logRow(e, k)).join('') : '<p class="mut" style="margin:0">Rien d\'enregistré pour l\'instant.</p>'}
    <div class="row" style="margin-top:10px"><button class="btn sm ghost" data-action="sim">🧪 Tester avec une journée simulée</button>
    <select class="f" id="manual" style="flex:1"><option value="">Ajouter à la main…</option>${st.pistes.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div></div>
  <h3>⭐ Noter mes pistes</h3>
  ${pistes.length ? `<div class="card">${pistes.map(id => { const p = pisteOf(id), cur = pending[id] ?? S.votes[id]; return `<div style="margin-bottom:12px"><div class="row"><span class="sq ${p.color}"></span><b class="sp">${esc(p.name)}</b><span class="mut">actuel ${info(p).score.toFixed(1)}</span></div>
      <div class="rate mini">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<button style="background:${scoreColor(n)}" class="${cur === n ? 'on' : ''}" data-action="pend" data-id="${id}" data-n="${n}">${n}</button>`).join('')}</div></div>`; }).join('')}
    <button class="btn" data-action="sendvotes" ${nPending ? '' : 'disabled'}>Envoyer mes ${nPending} note(s)</button></div>` : '<p class="mut">Ski quelques pistes, elles apparaîtront ici pour un vote de fin de journée.</p>'}`;
}
function logRow(e, k) {
  const st = station();
  let txt;
  if (e.type === 'lift') txt = '🚡 ' + esc(liftOf(e.pick || e.cands[0]).name);
  else if (e.pick) txt = `<span class="sq ${pisteOf(e.pick).color}" style="display:inline-block"></span> ${esc(pisteOf(e.pick).name)}`;
  else txt = `Piste entre ${esc(st.nodes[e.from]?.name || '?')} et ${esc(st.nodes[e.to]?.name || '?')} <div class="chips" style="margin-top:4px">${e.cands.map(c => `<button class="chip" data-action="resolve" data-k="${k}" data-id="${c}">${esc(pisteOf(c).name)}</button>`).join('')}</div>`;
  return `<div class="step"><span class="mut">${hhmm(e.t)}</span><div class="sp">${txt}</div></div>`;
}
function renderPocket() {
  const n = logToday().filter(e => e.type === 'piste').length;
  return `<div><div class="dot"></div><b>SKIP enregistre ta journée</b><p><span id="pn">${n}</span> descente(s)</p><p>Profite du paysage 🏔️<br>Maintiens l'écran 1 seconde pour quitter.</p></div>`;
}
function updatePocket() { const n = $('#pn'); if (n) n.textContent = logToday().filter(e => e.type === 'piste').length; }
async function enterPocket() {
  if (!startTracking()) return;
  const p = $('#pocket'); p.innerHTML = renderPocket(); p.hidden = false;
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* optionnel */ }
}
function exitPocket() { $('#pocket').hidden = true; try { wakeLock?.release(); } catch { /* ignore */ } wakeLock = null; render(); }

/* ---------- Rencontres ---------- */
const WANTS = ['Progresser', 'Rouge sportive', 'Balade', 'Pause chocolat', 'Photos', 'Famille'];
const STATUSES = { slopes: '⛷ Sur les pistes', seek: '🤝 Cherche des partenaires', pause: '☕ En pause', home: '🏠 Rentré' };
const NETWORKS = {
  instagram: { name: 'Instagram', login: 'https://www.instagram.com/accounts/login/', url: h => `https://www.instagram.com/${h}/` },
  snapchat: { name: 'Snapchat', login: 'https://accounts.snapchat.com/accounts/login', url: h => `https://www.snapchat.com/add/${h}` },
  facebook: { name: 'Facebook', login: 'https://www.facebook.com/login/', url: h => `https://www.facebook.com/${h}` },
  strava: { name: 'Strava', login: 'https://www.strava.com/login', url: h => `https://www.strava.com/athletes/${h}` }
};
const HANDLE = /^[A-Za-z0-9._-]{1,40}$/;
let netEdit = null;
const chatKey = () => S.station + ':' + todayKey();
const heartNames = ids => ids.map(id => station().pistes.find(p => p.id === id)?.name).filter(Boolean);
const netLinks = so => Object.entries(so || {}).filter(([k, h]) => NETWORKS[k] && HANDLE.test(h)).map(([k, h]) =>
  `<a class="chip" href="${NETWORKS[k].url(encodeURIComponent(h))}" target="_blank" rel="noopener noreferrer">${NETWORKS[k].name} ↗</a>`).join('');

/* Partage sans serveur : un message texte contient un code SKIP que l'ami colle dans son appli. */
const b64e = o => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64d = c => JSON.parse(decodeURIComponent(escape(atob(c.replace(/-/g, '+').replace(/_/g, '/')))));
function sharePayload(kind) {
  const pr = S.profile;
  const r = kind === 'route' && plan ? { st: plan.stationId, start: plan.opt.start, budget: plan.opt.budget, speed: plan.opt.speed, colors: plan.opt.colors } : null;
  return { v: 1, n: pr.pseudo || 'Skieur', l: S.level, d: pr.discipline, s: pr.status, w: pr.wants, so: pr.socials, st: S.station, h: S.hearts, r, t: Date.now() };
}
function shareText(kind) {
  const pl = sharePayload(kind), hn = heartNames(S.hearts);
  const lines = [`⛷ ${pl.n} sur SKIP, ${station().name}`, `Niveau ${pl.l}/10 · ${pl.d === 'snowboard' ? 'snowboard' : 'ski'} · ${STATUSES[pl.s]}`];
  if (kind === 'route' && plan) lines.push(`🧭 Itinéraire de ${fmtMin(plan.total)} : ${plan.descents} descentes, ${plan.km} km`);
  if (kind === 'hearts' || kind === 'profile') if (hn.length) lines.push(`❤ Mes coups de cœur : ${hn.join(', ')}`);
  lines.push('', "Pour m'ajouter : colle ce message dans SKIP > Rencontres > « Ajouter un skieur ».", 'SKIP:' + b64e(pl));
  return lines.join('\n');
}
function openShare(kind) {
  if (kind === 'route' && !plan) return toast("Crée d'abord un itinéraire.");
  const txt = shareText(kind), enc = encodeURIComponent(txt);
  if (navigator.share) { navigator.share({ title: 'SKIP', text: txt }).catch(() => {}); return; }
  openSheet(`<h2>Partager</h2><p class="mut">Envoie ce message à tes amis. Ils le collent dans SKIP pour te retrouver.</p>
    <textarea id="sharetxt" rows="7" readonly>${esc(txt)}</textarea>
    <div class="row" style="margin-top:10px;flex-wrap:wrap"><a class="btn sm" style="text-decoration:none;text-align:center" href="https://wa.me/?text=${enc}" target="_blank" rel="noopener noreferrer">WhatsApp</a>
    <a class="btn sm" style="text-decoration:none" href="https://t.me/share/url?url=SKIP&text=${enc}" target="_blank" rel="noopener noreferrer">Telegram</a>
    <a class="btn sm" style="text-decoration:none" href="sms:?&body=${enc}">SMS</a>
    <button class="btn sm sec" data-action="copy">Copier</button></div>`);
}
function importFriend(raw) {
  const m = /SKIP:([A-Za-z0-9_-]+)/.exec(raw || ''); if (!m) return 'Code SKIP introuvable dans ce message.';
  let o; try { o = b64d(m[1]); } catch { return 'Code illisible : copie le message en entier.'; }
  if (!o || o.v !== 1 || typeof o.n !== 'string') return 'Code non reconnu.';
  const so = {}; Object.entries(o.so || {}).forEach(([k, h]) => { if (NETWORKS[k] && typeof h === 'string' && HANDLE.test(h)) so[k] = h; });
  const f = {
    n: o.n.slice(0, 30), l: Math.min(10, Math.max(1, +o.l || 5)), d: o.d === 'snowboard' ? 'snowboard' : 'ski', s: STATUSES[o.s] ? o.s : 'slopes',
    w: (Array.isArray(o.w) ? o.w : []).filter(x => WANTS.includes(x)), so, st: typeof o.st === 'string' ? o.st : S.station,
    h: (Array.isArray(o.h) ? o.h : []).filter(x => typeof x === 'string').slice(0, 50), t: +o.t || Date.now()
  };
  const r = o.r; if (r && DATA.stations[r.st] && DATA.stations[r.st].nodes[r.start] && Engine.SPEED[r.speed] && Array.isArray(r.colors))
    f.r = { st: r.st, start: r.start, budget: Math.min(480, Math.max(30, +r.budget || 120)), speed: r.speed, colors: r.colors.filter(c => COLORS.includes(c)) };
  if (Object.keys(S.friends).length >= 50 && !S.friends[f.n.toLowerCase()]) return 'Limite de 50 contacts atteinte.';
  S.friends[f.n.toLowerCase()] = f; save(); return null;
}
function renderMeet() {
  const st = station(), pr = S.profile, msgs = S.chat[chatKey()] || [], hn = heartNames(S.hearts);
  const netRows = Object.entries(NETWORKS).map(([k, n]) => {
    const h = pr.socials[k];
    if (h) return `<div class="net-row"><b class="sp">${n.name}</b><a href="${n.url(encodeURIComponent(h))}" target="_blank" rel="noopener noreferrer">@${esc(h)} ↗</a><button class="btn sm ghost" data-action="netdel" data-k="${k}">Retirer</button></div>`;
    if (netEdit === k) return `<div class="net-row" style="flex-wrap:wrap"><div class="sp mut" style="flex-basis:100%">1. <a href="${n.login}" target="_blank" rel="noopener noreferrer">Ouvre ${n.name} ↗</a> et connecte-toi. 2. Recopie ton identifiant :</div>
      <input type="text" id="nethandle" placeholder="ton identifiant" maxlength="40" aria-label="Identifiant ${n.name}" autocapitalize="off"><button class="btn sm" data-action="netsave" data-k="${k}">OK</button></div>`;
    return `<div class="net-row"><b class="sp">${n.name}</b><button class="btn sm sec" data-action="netedit" data-k="${k}">Connecter</button></div>`;
  }).join('');
  const friends = Object.entries(S.friends).sort((a, b) => b[1].t - a[1].t).map(([key, f]) => {
    const hn2 = (DATA.stations[f.st] || st).pistes.filter(p => f.h.includes(p.id)).map(p => p.name);
    return `<div class="card"><div class="me-card"><div class="avatar">${esc(f.n[0].toUpperCase())}</div><div class="sp"><b>${esc(f.n)}</b> <span class="mut">· ${f.d === 'snowboard' ? 'snowboard' : 'ski'} · niveau ${f.l}/10</span><br>
      <span class="badge">${STATUSES[f.s]}</span> <span class="mut">mis à jour le ${new Date(f.t).toLocaleDateString('fr-FR')}</span></div></div>
      ${f.w.length ? `<div class="mut" style="margin-top:6px">Envies : ${f.w.map(esc).join(' · ')}</div>` : ''}
      ${netLinks(f.so) ? `<div class="chips" style="margin-top:8px">${netLinks(f.so)}</div>` : ''}
      ${hn2.length ? `<div style="margin-top:8px">❤ ${hn2.map(esc).join(', ')} <button class="chip" data-action="fhearts" data-k="${esc(key)}">Ajouter à mes cœurs</button></div>` : ''}
      <div class="row" style="margin-top:8px">${f.r ? `<button class="btn sm sec" data-action="froute" data-k="${esc(key)}">🧭 Voir son itinéraire</button>` : ''}<button class="btn sm ghost" data-action="fdel" data-k="${esc(key)}">Supprimer</button></div></div>`;
  }).join('');
  return `<h2>Rencontres</h2>
  <div class="card"><div class="me-card"><div class="avatar">${esc((pr.pseudo || '?')[0].toUpperCase())}</div>
    <div class="sp"><input type="text" id="pseudo" value="${esc(pr.pseudo)}" maxlength="30" placeholder="Ton pseudo" aria-label="Pseudo"></div></div>
    <h3>Je pratique</h3>
    <div class="seg">${[['ski', '⛷ Ski'], ['snowboard', '🏂 Snowboard']].map(([k, t]) => `<button class="${pr.discipline === k ? 'on' : ''}" data-action="disc" data-k="${k}">${t}</button>`).join('')}</div>
    <h3>Mon niveau : ${S.level}/10</h3>
    <input type="range" min="1" max="10" step="0.5" value="${S.level}" data-range="level2" aria-label="Mon niveau">
    <h3>Mon statut</h3>
    <div class="chips">${Object.entries(STATUSES).map(([k, t]) => `<button class="chip${pr.status === k ? ' on' : ''}" data-action="status" data-s="${k}">${t}</button>`).join('')}</div>
    <h3>Mes envies</h3>
    <div class="chips">${WANTS.map(w => `<button class="chip${pr.wants.includes(w) ? ' on' : ''}" data-action="want" data-w="${w}">${w}</button>`).join('')}</div>
    <h3>Mes réseaux</h3>${netRows}</div>
  <div class="card"><b>Partager avec mes amis</b>
    <p class="mut" style="margin:4px 0 10px">Envoie ton profil, ton itinéraire ou tes coups de cœur par WhatsApp, SMS ou autre. Ton ami les retrouve dans SKIP.</p>
    <div class="row" style="flex-wrap:wrap"><button class="btn sm" data-action="share" data-k="profile">📤 Mon profil</button><button class="btn sm sec" data-action="share" data-k="route">🧭 Mon itinéraire</button><button class="btn sm sec" data-action="share" data-k="hearts">❤ Mes coups de cœur</button></div>
    <div class="mut" style="margin-top:8px">❤ Mes coups de cœur : ${hn.length ? esc(hn.join(', ')) : 'aucun pour l\'instant'}</div></div>
  <h3>Mes skieurs</h3>
  ${friends || '<div class="card"><p class="mut" style="margin:0">Aucun skieur pour l\'instant. Demande à un ami de t\'envoyer son profil SKIP, puis colle son message ci-dessous.</p></div>'}
  <div class="card"><b>Ajouter un skieur</b><textarea id="importtxt" rows="3" placeholder="Colle ici le message reçu (il contient « SKIP:… »)" aria-label="Message reçu" style="margin:8px 0"></textarea>
    <button class="btn sm" data-action="import">Ajouter</button></div>
  <h3>💬 Chat général du jour</h3>
  <div class="mut" style="margin-bottom:8px">Pour toute la station, remis à zéro chaque jour.</div>
  ${msgs.length ? msgs.map(m => `<div class="msg${m.me ? ' me' : ''}"><b>${esc(m.who)}</b> <span class="mut">niv. ${m.lvl} · ${esc(m.t)}</span> <span class="badge">${esc(STATUSES[m.status] || '')}</span><br>${esc(m.text)}</div>`).join('') : '<p class="mut">Aucun message aujourd\'hui. Lance la discussion !</p>'}
  <div class="row" style="margin-top:8px"><input type="text" id="chatin" placeholder="Écrire à la station…" maxlength="300" aria-label="Message"><button class="btn sm" data-action="send">Envoyer</button></div>
  <p class="mut">Pour l'instant, sans serveur, ce chat reste sur ce téléphone. Il sera partagé quand l'appli sera connectée à un serveur.</p>`;
}

/* ---------- À propos / concurrence ---------- */
function renderAbout() {
  const Y = '✅', N = '❌', M = '➖';
  const rows = [
    ['Note de difficulté 1–10', N, N, N, Y],
    ['Notes communautaires + données terrain', N, N, M, Y],
    ['Aide à la progression / sécurité', N, N, N, Y],
    ['Tracking des descentes', N, Y, M, Y],
    ['Itinéraire multi-pistes sur mesure', N, N, N, Y],
    ['Affluence / état de la neige live', M, N, Y, M],
    ['Bouton SOS 112', N, N, Y, Y]
  ];
  return `<h2>Pourquoi SKIP ?</h2>
  <div class="card"><b>1 · Une note lisible de 1 à 10</b><div class="mut">Pour distinguer une rouge à 6/10 d'une rouge à 9/10.</div>
    <b>2 · Sécurité et progression</b><div class="mut">Ne pas finir sur une piste trop dure, choisir des pistes pour progresser.</div>
    <b>3 · Communauté + données objectives</b><div class="mut">Pente, largeur, neige : une note plus fiable.</div></div>
  <h3>Face à l'existant</h3>
  <div class="card"><table class="cmp"><tr><th></th><th>Skiinfo</th><th>Skitude Strava</th><th>Skiif</th><th class="us">SKIP</th></tr>
    ${rows.map(r => `<tr><td>${r[0]}</td>${r.slice(1).map((c, i) => `<td${i === 3 ? ' class="us"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</table>
    <div class="mut" style="margin-top:8px">${Y} oui · ${M} partiel · ${N} non. Analyse issue de la présentation SKIP, à vérifier avant diffusion.</div></div>
  ${[['SKIINFO', "Infos de station et de pistes, souvent officielles : difficulté, ouverture, longueur.", "Pas de note numérique précise : reprend les couleurs des stations, ignore l'avis des utilisateurs et la météo.", "On garde les couleurs officielles, on ajoute la note 1–10."],
     ['SKITUDE & STRAVA', "Tracking de performance : descentes, vitesse, dénivelé.", "Centré sur la performance : peu d'aide à la progression, à la sécurité ou à la difficulté réelle.", "On reprend le tracking, mais pour noter et progresser, pas pour la performance."],
     ['SKIIF (le « Waze du ski »)', "Cartes 2D/3D, guidage audio, amis en temps réel, affluence, neige, SOS 112, 200+ stations, gratuit. L'appli la plus proche de la nôtre.", "Pas d'aide à la progression ni de note précise ; GPS moyen sur les pistes ; pas de programme de ski sur plusieurs pistes.", "On reprend guidage audio et SOS, on ajoute notation, progression et itinéraires sur mesure."]]
    .map(([n, a, l, r]) => `<div class="card"><b>${n}</b><p style="margin:4px 0">${a}</p><p class="mut" style="margin:4px 0">Limite : ${l}</p><p style="margin:4px 0;color:var(--brand)"><b>Notre réponse :</b> ${r}</p></div>`).join('')}
  <h3>Réduire le temps d'écran</h3>
  <div class="card"><div>📍 Enregistrement automatique par GPS (onglet Ma journée)</div><div>🌑 Mode poche : écran noir, retour vocal et vibration</div>
    <div>⭐ Notes en fin de journée, en un clic par piste</div><div>🔊 Guidage audio de l'itinéraire</div><div>📵 Compteur de temps d'écran quotidien</div></div>
  <h3>Mode démo</h3>
  <div class="card"><div class="mut">Les stations, notes et attentes sont fictives. Teste l'alerte de fermeture de piste :</div>
    <button class="btn sec" data-action="toggleclose" style="margin:8px 0">${S.closed.includes('combe') ? 'Rouvrir' : 'Fermer'} La Combe Rouge (Alpe d'Huez)</button>
    <button class="btn ghost" data-action="reset">Réinitialiser mes données</button></div>`;
}

/* ---------- Guidage ---------- */
function advanceGuide() {
  if (!guide) return;
  guide.idx++;
  if (guide.idx < guide.plan.steps.length) speak(stepText(guide.plan.steps[guide.idx])); else speak('Itinéraire terminé. Bravo !');
  if (S.tab === 'route') render();
}

/* ---------- Rendu & événements ---------- */
function render() {
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === S.tab));
  $('#view').innerHTML = { pistes: renderPistes, route: renderRoute, day: renderDay, meet: renderMeet, about: renderAbout }[S.tab]();
}
const updateList = () => { const l = $('#plist'); if (l) l.innerHTML = listHtml(); };

document.addEventListener('click', e => {
  const tab = e.target.closest('[data-tab]');
  if (tab) { S.tab = tab.dataset.tab; save(); render(); window.scrollTo(0, 0); return; }
  if (e.target.id === 'sheet') return closeSheet();
  const el = e.target.closest('[data-action]'); if (!el) return;
  const d = el.dataset, f = S.filt;
  switch (d.action) {
    case 'sos': if (confirm('Appeler le 112 (urgences) ?')) location.href = 'tel:112'; break;
    case 'close': closeSheet(); break;
    case 'open': sheetVote = null; pisteSheet(d.id); break;
    case 'allcolors': f.colors = []; save(); render(); break;
    case 'rcolor': S.rf.colors = S.rf.colors.includes(d.c) ? S.rf.colors.filter(c => c !== d.c) : [...S.rf.colors, d.c]; save(); render(); break;
    case 'disc': S.profile.discipline = d.k; save(); render(); break;
    case 'share': openShare(d.k); break;
    case 'copy': { const t = $('#sharetxt'); t.select(); (navigator.clipboard ? navigator.clipboard.writeText(t.value) : Promise.reject()).then(() => toast('Message copié.'), () => toast('Sélectionne le texte et copie-le.')); break; }
    case 'import': { const e2 = importFriend($('#importtxt').value); if (e2) toast(e2, 4500); else { toast('Skieur ajouté !'); render(); } break; }
    case 'fdel': delete S.friends[d.k]; save(); render(); break;
    case 'fhearts': { const fr = S.friends[d.k]; S.hearts = [...new Set([...S.hearts, ...fr.h.filter(id => pisteOf(id))])]; save(); toast('Coups de cœur ajoutés.'); render(); break; }
    case 'froute': { const fr = S.friends[d.k], r = fr.r; if (r.st !== S.station) { toast('Cet itinéraire est dans une autre station.'); break; }
      S.rf = { ...S.rf, start: r.start, budget: r.budget, speed: r.speed, colors: r.colors }; plan = Engine.plan(station(), { ...S.rf, closed: S.closed }); S.tab = 'route'; save(); render(); if (!plan) toast('Parcours introuvable avec les pistes actuelles.'); break; }
    case 'filters': f.open = !f.open; save(); render(); break;
    case 'color': f.colors = f.colors.includes(d.c) ? f.colors.filter(c => c !== d.c) : [...f.colors, d.c]; save(); render(); break;
    case 'sort': f.sort = d.k; save(); render(); break;
    case 'pick': sheetVote = +d.n; pisteSheet(el.closest('[data-rate]').dataset.rate); break;
    case 'validate': S.votes[d.id] = sheetVote ?? S.votes[d.id]; save(); toast('Merci ! Ta note améliore la moyenne pour tous les skieurs.'); pisteSheet(d.id); render(); break;
    case 'heart': S.hearts = S.hearts.includes(d.id) ? S.hearts.filter(h => h !== d.id) : [...S.hearts, d.id]; save(); pisteSheet(d.id); render(); break;
    case 'skied': addLog({ type: 'piste', cands: [d.id], from: pisteOf(d.id).from, to: pisteOf(d.id).to, t: Date.now(), manual: true }); toast('Ajoutée à ta journée'); break;
    case 'rf': S.rf[d.k] = d.k === 'budget' ? +d.v : d.v; save(); render(); break;
    case 'plan': generate(); break;
    case 'download': S.route = { ...plan, savedAt: Date.now() }; save(); toast('Itinéraire téléchargé : utilisable sans réseau.'); render(); break;
    case 'loadsaved': plan = S.route; render(); break;
    case 'delsaved': S.route = null; save(); render(); break;
    case 'gstart': guide = { plan, idx: 0 }; startTracking(); speak(stepText(plan.steps[0])); render(); break;
    case 'gnext': advanceGuide(); break;
    case 'gstop': guide = null; render(); break;
    case 'track': if (watchId !== null) stopTracking(); else startTracking(); render(); break;
    case 'pocket': enterPocket(); break;
    case 'sim': simulateDay(); break;
    case 'resolve': { const l = S.log[todayKey()].filter(x => x.stationId === S.station)[+d.k]; l.pick = d.id; save(); render(); break; }
    case 'pend': pending[d.id] = +d.n; render(); break;
    case 'sendvotes': Object.entries(pending).forEach(([id, n]) => S.votes[id] = n); toast(`${Object.keys(pending).length} note(s) envoyée(s). Merci !`); pending = {}; save(); render(); break;
    case 'want': S.profile.wants = S.profile.wants.includes(d.w) ? S.profile.wants.filter(w => w !== d.w) : [...S.profile.wants, d.w]; save(); render(); break;
    case 'status': S.profile.status = d.s; save(); render(); break;
    case 'netedit': netEdit = d.k; render(); break;
    case 'netsave': { const h = ($('#nethandle').value || '').trim().replace(/^@/, '');
      if (!HANDLE.test(h)) { toast('Identifiant invalide : lettres, chiffres, point, tiret.'); break; }
      S.profile.socials[d.k] = h; netEdit = null; save(); render(); break; }
    case 'netdel': delete S.profile.socials[d.k]; save(); render(); break;
    case 'send': { const i = $('#chatin'), v = i.value.trim(); if (!v) break;
      (S.chat[chatKey()] = S.chat[chatKey()] || []).push({ who: S.profile.pseudo || 'Skieur', lvl: S.level, status: S.profile.status, t: hhmm(Date.now()), text: v, me: true }); save(); render(); break; }
    case 'toggleclose': S.closed = S.closed.includes('rousses') ? S.closed.filter(c => c !== 'rousses') : [...S.closed, 'rousses']; save(); render(); break;
    case 'reset': if (confirm('Effacer toutes tes données SKIP ?')) { localStorage.removeItem(KEY); location.reload(); } break;
  }
});
document.addEventListener('input', e => {
  const t = e.target, f = S.filt;
  if (t.id === 'q') { f.q = t.value; updateList(); }
  else if (t.dataset.range) {
    const k = t.dataset.range, v = +t.value;
    if (k === 'min') { f.min = Math.min(v, f.max); $('#rmin').textContent = f.min; }
    else if (k === 'max') { f.max = Math.max(v, f.min); $('#rmax').textContent = f.max; }
    else if (k === 'level') { S.level = v; $('#lvl').textContent = v; }
    else if (k === 'level2') { S.level = v; }
    else if (k === 'target') { return; }
    else if (k === 'target') { S.rf.target = v; $('#tgt').textContent = v; }
    save(); updateList();
  }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.bind === 'fit') { S.filt.fit = t.checked; save(); updateList(); }
  else if (t.dataset.bind === 'start') { S.rf.start = t.value; save(); }
  else if (t.dataset.bind === 'avoidBlack' || t.dataset.bind === 'avoidCrowded') { S.rf[t.dataset.bind] = t.checked; save(); }
  else if (t.dataset.bind === 'audio') { S.audio = t.checked; save(); }
  else if (t.id === 'pseudo') { S.profile.pseudo = t.value.trim().slice(0, 30); save(); }
  else if (t.dataset.range === 'level2') { render(); }
  else if (t.id === 'manual' && t.value) { const p = pisteOf(t.value); addLog({ type: 'piste', cands: [p.id], from: p.from, to: p.to, t: Date.now(), manual: true }); render(); }
});
$('#station').addEventListener('change', e => { S.station = e.target.value; plan = null; guide = null; pending = {}; trk = {}; S.rf.start = null; save(); render(); });
(() => { let tm; const p = $('#pocket'), go = () => { tm = setTimeout(exitPocket, 1000); }, no = () => clearTimeout(tm);
  p.addEventListener('pointerdown', go); p.addEventListener('pointerup', no); p.addEventListener('pointerleave', no); })();

/* ---------- Réseau, temps d'écran, démarrage ---------- */
function netState() {
  $('#net').hidden = navigator.onLine;
  if (navigator.onLine && S.route) {
    const bad = S.route.steps.filter(s => S.closed.includes(s.ref.id));
    if (bad.length) toast(`⚠ Réseau de retour : ${bad[0].ref.name} est fermée sur ton itinéraire. Recalcule-le.`, 6000);
  }
}
window.addEventListener('online', netState); window.addEventListener('offline', netState);
setInterval(() => { if (document.visibilityState === 'visible' && $('#pocket').hidden) { const k = todayKey(); S.screen[k] = (S.screen[k] || 0) + 1; if (S.screen[k] % 10 === 0) save(); } }, 1000);

$('#station').innerHTML = Object.values(DATA.stations).map(s => `<option value="${s.id}" ${s.id === S.station ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
render(); netState();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
