/* SKIP APP – interface mobile (PWA). Données de démo stockées sur l'appareil (localStorage). */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const KEY = 'skip.v1';
const todayKey = () => new Date().toISOString().slice(0, 10);
const hhmm = t => new Date(t).toTimeString().slice(0, 5);
const scoreColor = s => `hsl(${Math.round(130 - (Math.max(1, Math.min(10, s)) - 1) / 9 * 130)} 75% 42%)`;

const defaults = () => ({
  station: 'alpe', tab: 'pistes', level: 5, audio: true,
  profile: { pseudo: 'Moi', wants: [], status: 'slopes', socials: {} },
  votes: {}, hearts: [], log: {}, route: null, chat: {}, screen: {}, closed: [],
  filt: { min: 1, max: 10, colors: [], q: '', sort: 'score', fit: false, open: false },
  rf: { start: null, budget: 120, target: 6, speed: 'medium', avoidBlack: true, avoidCrowded: true }
});
let S = (() => { try { return Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { return defaults(); } })();
S.profile = { ...defaults().profile, ...S.profile }; S.filt = { ...defaults().filt, ...S.filt }; S.rf = { ...defaults().rf, ...S.rf };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* stockage indisponible */ } };

const station = () => DATA.stations[S.station];
const pisteOf = (id, st = station()) => st.pistes.find(p => p.id === id);
const liftOf = (id, st = station()) => st.lifts.find(l => l.id === id);
const info = p => {
  const b = Engine.blended(p, S.votes[p.id]);
  return { ...b, label: Engine.label(b.score), fit: Engine.fit(b.score, S.level), hearts: p.hearts + (S.hearts.includes(p.id) ? 1 : 0), closed: S.closed.includes(p.id) };
};
const scoreBubble = (s, big) => `<div class="score${big ? ' big' : ''}" style="background:${scoreColor(s)}">${s.toFixed(1).replace('.', ',')}<small>/10</small></div>`;
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
const norm = t => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
function filtered() {
  const f = S.filt, st = station(), q = norm(f.q).trim();
  let l = st.pistes.map(p => ({ p, i: info(p) })).filter(({ p, i }) => q ? norm(p.name).includes(q) :
    i.score >= f.min - 0.001 && i.score <= f.max + 0.001 &&
    (!f.colors.length || f.colors.includes(p.color)) && (!f.fit || i.score <= S.level + 1.5));
  l.sort((a, b) => f.sort === 'hearts' ? b.i.hearts - a.i.hearts : f.sort === 'name' ? a.p.name.localeCompare(b.p.name) : a.i.score - b.i.score);
  return l;
}
function pisteRow({ p, i }) {
  return `<button class="piste${i.closed ? ' closed' : ''}" data-action="open" data-id="${p.id}">
    <span class="sq ${p.color}" title="${colorName(p.color)}"></span>
    <span class="sp"><b>${esc(p.name)}</b><br>
      <span class="lab ${i.label.key}">${i.label.text}</span>${i.closed ? ' <span class="mut">fermée</span>' : ''}${i.fit.key === 'hard' ? ' <span class="fit hard">⚠ trop dur</span>' : ''}</span>
    ${scoreBubble(i.score)}</button>`;
}
function renderPistes() {
  const f = S.filt, st = station();
  const preset = (a, b) => !f.open && f.min === a && f.max === b && f.sort === 'score' ? ' on' : '';
  return `<h2>Pistes · ${esc(st.name)}</h2>
  <input type="search" id="q" class="bigsearch" placeholder="🔍 Chercher une piste" value="${esc(f.q)}" aria-label="Chercher une piste" autocomplete="off">
  <div class="chips" style="margin:10px 0">
    <button class="chip${preset(1, 10)}" data-action="preset" data-a="1" data-b="10">Toutes</button>
    <button class="chip${preset(1, 4)}" data-action="preset" data-a="1" data-b="4">Faciles</button>
    <button class="chip${preset(6, 8)}" data-action="preset" data-a="6" data-b="8">Sportives</button>
    <button class="chip${f.sort === 'hearts' ? ' on' : ''}" data-action="sort" data-k="${f.sort === 'hearts' ? 'score' : 'hearts'}">❤ Top</button>
    <button class="chip${f.open ? ' on' : ''}" data-action="filters">Filtres</button>
  </div>
  ${f.open ? `<div class="card">
    <div class="mut">Difficulté de <b id="rmin">${f.min}</b> à <b id="rmax">${f.max}</b> /10</div>
    <input type="range" min="1" max="10" step="0.5" value="${f.min}" data-range="min" aria-label="Note minimum">
    <input type="range" min="1" max="10" step="0.5" value="${f.max}" data-range="max" aria-label="Note maximum">
    <div class="chips" style="margin:8px 0">${['green', 'blue', 'red', 'black'].map(c =>
      `<button class="chip${f.colors.includes(c) ? ' on' : ''}" data-action="color" data-c="${c}"><span class="sq ${c}" style="display:inline-block;vertical-align:-2px"></span> ${colorName(c)}</button>`).join('')}</div>
    <div class="mut">Mon niveau : <b id="lvl">${S.level}</b>/10</div>
    <input type="range" min="1" max="10" step="0.5" value="${S.level}" data-range="level" aria-label="Mon niveau">
    <label class="chk"><input type="checkbox" data-bind="fit" ${f.fit ? 'checked' : ''}> Masquer les pistes trop dures pour moi</label></div>` : ''}
  <div id="plist">${listHtml()}</div>`;
}
const listHtml = () => { const l = filtered(); return l.length ? l.map(pisteRow).join('') : '<p class="mut">Aucune piste trouvée.</p>'; };

function openSheet(html) { const s = $('#sheet'); s.innerHTML = `<div class="in"><button class="x" data-action="close" aria-label="Fermer">✕</button>${html}</div>`; s.hidden = false; }
function closeSheet() { $('#sheet').hidden = true; sheetVote = null; }
function pisteSheet(id) {
  const p = pisteOf(id), i = info(p), mine = S.votes[id], liked = S.hearts.includes(id);
  const sel = sheetVote ?? mine;
  const t = Engine.speedMin(p, 'slow') + ' / ' + Engine.speedMin(p, 'medium') + ' / ' + Engine.speedMin(p, 'fast');
  openSheet(`<div class="row"><span class="sq ${p.color}" style="width:22px;height:22px"></span><h2 style="margin:0">${esc(p.name)}</h2></div>
    <div class="mut">Piste ${colorName(p.color).toLowerCase()} officielle · ${esc(station().nodes[p.from].name)} → ${esc(station().nodes[p.to].name)}</div>
    <div class="row" style="margin:12px 0">${scoreBubble(i.score, true)}<div>
      <span class="lab ${i.label.key}">${i.label.icon} Piste ${i.label.text.toUpperCase()}</span><br>
      <span class="fit ${i.fit.key}">${i.fit.text} (niveau ${S.level}/10)</span><br>
      <span class="mut">Moyenne basée sur ${i.votes} votes</span></div></div>
    ${i.closed ? '<div class="warn">⚠ Piste fermée actuellement.</div>' : ''}
    ${i.fit.key === 'hard' ? '<div class="warn">⚠ Cette piste est nettement au-dessus de ton niveau. Choisis plutôt une piste plus facile.</div>' : ''}
    ${i.reliable ? '' : '<div class="warn">Peu de votes : la note s\'appuie surtout sur les données terrain (pente, largeur).</div>'}
    <div class="data"><div>Note communauté<b>${i.comm}/10</b></div><div>Note objective (pente/largeur)<b>${i.obj}/10</b></div>
      <div>Pente moy. / max<b>${p.slope}% / ${p.maxSlope}%</b></div><div>Largeur<b>${p.width} m</b></div>
      <div>Longueur<b>${p.km} km</b></div><div>Durée lent / moyen / rapide<b>${t} min</b></div>
      <div style="grid-column:1/3">Neige habituelle<b>${esc(p.snow)}</b></div></div>
    <h3>Donne ta note</h3><div class="mut">1 = très facile · 10 = très difficile</div>
    <div class="rate" data-rate="${id}">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<button style="background:${scoreColor(n)}" class="${sel === n ? 'on' : ''}" data-action="pick" data-n="${n}">${n}</button>`).join('')}</div>
    <button class="btn" data-action="validate" data-id="${id}" ${sel ? '' : 'disabled'}>${mine ? 'Modifier ma note' : 'Valider ma note'}</button>
    <h3>Coup de cœur</h3>
    <button class="heart${liked ? ' on' : ''}" data-action="heart" data-id="${id}">${liked ? '❤️ Dans mes coups de cœur' : '🤍 Ajouter aux coups de cœur'} · ${i.hearts} skieurs ont adoré cette piste</button>
    <div style="height:10px"></div>
    <button class="btn sec" data-action="skied" data-id="${id}">✅ Je l'ai skiée aujourd'hui</button>`);
}

/* ---------- Itinéraire ---------- */
function nowHour() { const d = new Date(), h = d.getHours() + d.getMinutes() / 60; return h < 8 || h > 17 ? 10 : h; }
function mapSvg(st, pl) {
  const hl = new Set((pl ? pl.steps : []).map(s => s.ref.id));
  const pair = {};
  const edge = (e, kind) => {
    const a = st.nodes[e.from], b = st.nodes[e.to], k = [e.from, e.to].sort().join('|');
    const n = pair[k] = (pair[k] || 0) + 1, off = (n - 1) * 22 - 6;
    const mx = (a.x + b.x) / 2 + off, my = (a.y + b.y) / 2 + off;
    const col = kind === 'lift' ? '#8a94a8' : `var(--${e.color})`, on = hl.has(e.id);
    return `<path d="M${a.x} ${a.y} Q${mx} ${my} ${b.x} ${b.y}" fill="none" stroke="${col}" stroke-width="${on ? 5 : 2}" ${kind === 'lift' ? 'stroke-dasharray="5 4"' : ''} opacity="${!pl || on ? 1 : 0.35}"/>`;
  };
  const nodes = Object.entries(st.nodes).map(([id, n]) => `<circle cx="${n.x}" cy="${n.y}" r="6" fill="#fff" stroke="#12213a" stroke-width="2"/>
    <text x="${n.x + (n.x > 250 ? -9 : 9)}" y="${n.y - 9}" font-size="10" text-anchor="${n.x > 250 ? 'end' : 'start'}" fill="currentColor">${esc(n.name)} ${n.alt}m</text>`).join('');
  return `<svg class="map" viewBox="0 0 340 300" role="img" aria-label="Plan schématique">${st.pistes.map(p => edge(p, 'piste')).join('')}${st.lifts.map(l => edge(l, 'lift')).join('')}${nodes}</svg>`;
}
function stepsHtml(pl, st) {
  let t = 0;
  return pl.steps.map(s => {
    if (s.kind === 'lift') {
      const l = s.ref; t += s.min + s.wait;
      return `<div class="step"><div class="ico">🚡</div><div class="sp"><b>${esc(l.name)}</b><br><span class="mut">${s.min} min + ${s.wait} min d'attente (estimée) · ${esc(st.nodes[l.from].name)} → ${esc(st.nodes[l.to].name)}</span>
        ${l.note ? `<br><span class="warn" style="display:inline-block;margin:4px 0 0">⚠ ${esc(l.note)}</span>` : ''}</div><span class="mut">${t} min</span></div>`;
    }
    const p = s.ref; t += s.min; const lb = Engine.label(s.score);
    return `<div class="step"><div class="ico"><span class="sq ${p.color}"></span></div><div class="sp"><b>${esc(p.name)}</b> <span class="mut">· ${colorName(p.color)}</span><br>
      <span class="mut">${p.km} km · ${s.min} min · </span><span class="lab ${lb.key}">${s.score.toFixed(1)}/10 ${lb.text}</span></div><span class="mut">${t} min</span></div>`;
  }).join('');
}
function planSummary(pl) {
  return `<div class="stats"><div><b>${Math.floor(pl.total / 60)}h${String(pl.total % 60).padStart(2, '0')}</b><span>durée</span></div><div><b>${pl.descents}</b><span>descentes</span></div>
    <div><b>${pl.km} km</b><span>skiés</span></div><div><b>${pl.avg.toFixed(1)}</b><span>note moy.</span></div></div>
    <div class="mut" style="margin-top:6px">dont ${pl.waitTotal} min d'attente estimée aux remontées (simulation).</div>`;
}
function renderRoute() {
  const st = station(), f = S.rf;
  if (!f.start || !st.nodes[f.start]) f.start = st.base;
  const saved = S.route && S.route.stationId === S.station ? S.route : null;
  const dur = [[60, '1 h'], [90, '1 h 30'], [120, '2 h'], [180, '3 h'], [240, '4 h']];
  return `<h2>Créer mon itinéraire</h2>
  ${guide ? `<div class="card" style="border-color:var(--brand)"><b>🔊 Guidage en cours</b><div style="margin:6px 0">${guide.idx < guide.plan.steps.length ? 'Prochaine étape : ' + esc(stepText(guide.plan.steps[guide.idx])) : '🎉 Itinéraire terminé !'}</div>
    <div class="row"><button class="btn sm" data-action="gnext">Étape suivante</button><button class="btn sm ghost" data-action="gstop">Arrêter</button></div></div>` : ''}
  <div class="card">
    <label class="mut">Point de départ</label>
    <select class="f" data-bind="start">${Object.entries(st.nodes).map(([id, n]) => `<option value="${id}" ${f.start === id ? 'selected' : ''}>${esc(n.name)} (${n.alt} m)</option>`).join('')}</select>
    <div style="height:10px"></div><label class="mut">Durée de la session</label>
    <div class="chips">${dur.map(([m, t]) => `<button class="chip${f.budget === m ? ' on' : ''}" data-action="rf" data-k="budget" data-v="${m}">${t}</button>`).join('')}</div>
    <div style="height:10px"></div><div class="mut">Difficulté visée : <b id="tgt">${f.target}</b>/10 <span class="mut">(pistes jusqu'à +1,5)</span></div>
    <input type="range" min="1" max="10" step="0.5" value="${f.target}" data-range="target" aria-label="Difficulté visée">
    <div class="mut">Profil de vitesse</div>
    <div class="seg">${[['slow', '🐢 Lent'], ['medium', '⛷ Moyen'], ['fast', '⚡ Rapide']].map(([k, t]) => `<button class="${f.speed === k ? 'on' : ''}" data-action="rf" data-k="speed" data-v="${k}">${t}</button>`).join('')}</div>
    <label class="chk"><input type="checkbox" data-bind="avoidBlack" ${f.avoidBlack ? 'checked' : ''}> Éviter les pistes noires</label>
    <label class="chk"><input type="checkbox" data-bind="avoidCrowded" ${f.avoidCrowded ? 'checked' : ''}> Éviter les zones trop fréquentées</label>
    <button class="btn" data-action="plan">Créer mon itinéraire</button>
  </div>
  <div id="planOut">${plan ? planHtml(plan) : ''}</div>
  ${saved ? `<div class="card"><b>📥 Itinéraire téléchargé</b><div class="mut">Enregistré le ${new Date(saved.savedAt).toLocaleString('fr-FR')} – disponible sans réseau. Les infos (fermetures, attentes) sont celles de ce moment-là.</div>
    <div class="row" style="margin-top:8px"><button class="btn sm sec" data-action="loadsaved">Ouvrir</button><button class="btn sm ghost" data-action="delsaved">Supprimer</button></div></div>` : ''}`;
}
function planHtml(pl) {
  const st = DATA.stations[pl.stationId];
  return `<div class="card"><h3 style="margin-top:0">Ton parcours</h3>${planSummary(pl)}</div>${mapSvg(st, pl)}
    <div class="card" style="margin-top:12px">${stepsHtml(pl, st)}</div>
    <div class="row"><button class="btn sec" data-action="download">📥 Télécharger hors ligne</button><button class="btn sec" data-action="gstart">🔊 Guidage audio</button></div>`;
}
const stepText = s => s.kind === 'lift' ? `Prenez ${s.ref.name}, ${s.min} minutes.${s.ref.note ? ' ' + s.ref.note : ''}` : `Descendez ${s.ref.name}, piste ${colorName(s.ref.color).toLowerCase()}, ${s.min} minutes, difficulté ${s.score.toFixed(1).replace('.', ',')} sur 10.`;
function generate() {
  const f = S.rf, st = station();
  plan = Engine.plan(st, { ...f, hour: nowHour(), closed: S.closed });
  save(); render();
  if (!plan) toast('Aucun itinéraire trouvé : augmente la difficulté visée ou la durée, ou décoche un filtre.', 5000);
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
  const st = station(), pl = Engine.plan(st, { budget: 240, target: 6, hour: 10, closed: [] });
  if (!pl) return;
  trk = {}; let t = new Date().setHours(9, 0, 0, 0);
  const seq = [pl.opt.start, ...pl.steps.map(s => s.to)];
  seq.forEach(n => { const seg = Engine.onFix(st, trk, st.nodes[n], t); if (seg) addLog(seg); t += 11 * 60000; });
  toast('Journée de démonstration créée : descentes détectées sans toucher l\'écran.');
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
    <div class="row" style="margin-top:10px"><button class="btn sm ghost" data-action="sim">🧪 Simuler une journée</button>
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
  else txt = `Piste entre ${esc(st.nodes[e.from].name)} et ${esc(st.nodes[e.to].name)} <div class="chips" style="margin-top:4px">${e.cands.map(c => `<button class="chip" data-action="resolve" data-k="${k}" data-id="${c}">${esc(pisteOf(c).name)}</button>`).join('')}</div>`;
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
const NETWORKS = { instagram: ['Instagram', 'https://instagram.com/'], snapchat: ['Snapchat', 'https://www.snapchat.com/add/'], facebook: ['Facebook', 'https://facebook.com/'], strava: ['Strava', 'https://www.strava.com/athletes/'] };
let netEdit = null;
const chatKey = () => S.station + ':' + todayKey();
function renderMeet() {
  const st = station(), pr = S.profile, msgs = S.chat[chatKey()] || [];
  const netRows = Object.entries(NETWORKS).map(([k, [name, url]]) => {
    const h = pr.socials[k];
    if (h) return `<div class="net-row"><b class="sp">${name}</b><a href="${url}${encodeURIComponent(h)}" target="_blank" rel="noopener noreferrer">@${esc(h)}</a><button class="btn sm ghost" data-action="netdel" data-k="${k}">Retirer</button></div>`;
    if (netEdit === k) return `<div class="net-row"><input type="text" id="nethandle" placeholder="Ton identifiant ${name}" maxlength="40" aria-label="Identifiant ${name}"><button class="btn sm" data-action="netsave" data-k="${k}">OK</button></div>`;
    return `<div class="net-row"><b class="sp">${name}</b><button class="btn sm sec" data-action="netedit" data-k="${k}">Connecter</button></div>`;
  }).join('');
  return `<h2>Rencontres · ${esc(st.name)}</h2>
  <div class="card"><div class="me-card"><div class="avatar">${esc((pr.pseudo || 'M')[0].toUpperCase())}</div>
    <div class="sp"><input type="text" id="pseudo" value="${esc(pr.pseudo)}" maxlength="20" placeholder="Ton pseudo" aria-label="Pseudo"><div class="mut" style="margin-top:4px">Niveau ${S.level}/10 · <span class="badge">${STATUSES[pr.status]}</span></div></div></div>
    <h3>Mon statut</h3>
    <div class="chips">${Object.entries(STATUSES).map(([k, t]) => `<button class="chip${pr.status === k ? ' on' : ''}" data-action="status" data-s="${k}">${t}</button>`).join('')}</div>
    <h3>Mes envies</h3>
    <div class="chips">${WANTS.map(w => `<button class="chip${pr.wants.includes(w) ? ' on' : ''}" data-action="want" data-w="${w}">${w}</button>`).join('')}</div>
    <h3>Mes réseaux</h3>${netRows}
    <p class="mut" style="margin-bottom:0">Les skieurs de la station verront ton pseudo, ton niveau, ton statut et ces liens.</p></div>
  <h3>Skieurs de la station</h3>
  <div class="card"><p class="mut" style="margin:0">Aucun autre skieur pour l'instant. Les profils des autres skieurs (niveau, statut, réseaux) apparaîtront ici quand l'appli sera connectée à un serveur.</p></div>
  <h3>💬 Chat général du jour</h3>
  <div class="mut" style="margin-bottom:8px">Ouvert à toute la station, remis à zéro chaque jour.</div>
  ${msgs.length ? msgs.map(m => `<div class="msg${m.me ? ' me' : ''}"><b>${esc(m.who)}</b> <span class="mut">niv. ${m.lvl} · ${esc(m.t)}</span> <span class="badge">${esc(STATUSES[m.status] || '')}</span><br>${esc(m.text)}</div>`).join('') : '<p class="mut">Aucun message aujourd\'hui. Lance la discussion !</p>'}
  <div class="row" style="margin-top:8px"><input type="text" id="chatin" placeholder="Écrire à la station…" maxlength="300" aria-label="Message"><button class="btn sm" data-action="send">Envoyer</button></div>
  <p class="mut">Pour l'instant, sans serveur, les messages restent sur ce téléphone.</p>`;
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
    case 'preset': f.min = +d.a; f.max = +d.b; f.sort = 'score'; f.open = false; save(); render(); break;
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
      if (!/^[A-Za-z0-9._-]{1,40}$/.test(h)) { toast('Identifiant invalide : lettres, chiffres, point, tiret.'); break; }
      S.profile.socials[d.k] = h; netEdit = null; save(); render(); break; }
    case 'netdel': delete S.profile.socials[d.k]; save(); render(); break;
    case 'send': { const i = $('#chatin'), v = i.value.trim(); if (!v) break;
      (S.chat[chatKey()] = S.chat[chatKey()] || []).push({ who: S.profile.pseudo || 'Moi', lvl: S.level, status: S.profile.status, t: hhmm(Date.now()), text: v, me: true }); save(); render(); break; }
    case 'toggleclose': S.closed = S.closed.includes('combe') ? S.closed.filter(c => c !== 'combe') : [...S.closed, 'combe']; save(); render(); break;
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
  else if (t.id === 'pseudo') { S.profile.pseudo = t.value.trim().slice(0, 20) || 'Moi'; save(); }
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
