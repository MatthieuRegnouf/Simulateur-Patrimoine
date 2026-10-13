/* SKIP APP – interface mobile (PWA). Données de l'Espace Alpe d'Huez : voir data.js. Préférences : localStorage. */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const KEY = 'skip.v2';
const todayKey = () => new Date().toISOString().slice(0, 10);
const hhmm = t => new Date(t).toTimeString().slice(0, 5);
const scoreColor = s => `hsl(${Math.round(130 - (Math.max(1, Math.min(10, s)) - 1) / 9 * 130)} 75% 42%)`;
const fmtMin = m => `${Math.floor(m / 60)}h${String(Math.round(m % 60)).padStart(2, '0')}`;
const COLORS = ['green', 'blue', 'red', 'black'], RANK = { green: 0, blue: 1, red: 2, black: 3 };

const defaults = () => ({
  station: 'alpe', tab: 'pistes', level: 5, audio: true,
  profile: { pseudo: '', discipline: 'ski', wants: [], status: 'slopes', socials: {} },
  votes: {}, vlog: [], hearts: [], log: {}, route: null, chat: {}, screen: {}, friends: {},
  filt: { colors: [], q: '', sector: '', sort: 'color', fit: false, open: false, view: 'pistes', mine: false },
  notif: { enabled: false, sys: false, lift: true, evening: true, eveningTime: '17:30', max: 3 }, pro: { d: '', ids: [], n: 0, evening: false },
  rf: { start: '', end: '', budget: 120, speed: 'medium', mode: 'felt', lo: 2, hi: 3, colors: ['green', 'blue', 'red'], walk: true, variant: 0 }
});
let S = (() => { try { return Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { return defaults(); } })();
S.notif = { ...defaults().notif, ...S.notif }; S.profile = { ...defaults().profile, ...S.profile }; S.filt = { ...defaults().filt, ...S.filt }; S.rf = { ...defaults().rf, ...S.rf };
if (S.votes && Object.keys(S.votes).length) { Object.entries(S.votes).forEach(([id, sc]) => S.vlog.push({ id, s: sc, t: Date.now(), tags: [] })); S.votes = {}; }   // ancien format
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* stockage indisponible */ } };

const station = () => DATA.stations[S.station];
const pisteOf = (id, st = station()) => st.pistes.find(p => p.id === id);
const liftOf = (id, st = station()) => st.lifts.find(l => l.id === id);
const thing = id => pisteOf(id) || liftOf(id);
const colorName = c => Engine.COLOR_LABEL[c];
const secName = id => station().sectors[id] || id;
const alts = x => x.altFrom && x.altTo ? `${x.altFrom} → ${x.altTo} m` : '';
const kmText = km => km ? `${String(km).replace('.', ',')} km` : '';
/* ---------- Notes : votes, moyennes, estimation objective ---------- */
const TAGS = ['Damée', 'Poudreuse', 'Transformée', 'Dure / verglacée', 'Bosses', 'Peu de neige'];
const PERIODS = [[0, 'Tout'], [1, '24 h'], [3, '3 j'], [7, '7 j'], [30, '30 j']];
const DAY = 864e5, PRIOR = 8;   // PRIOR : poids de l'estimation objective, équivalent à 8 votes
const PI = typeof GRAPH !== 'undefined' && GRAPH.pi ? GRAPH.pi : {};
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const r1 = x => Math.round(x * 10) / 10;
const fmt1 = x => String(r1(x)).replace('.', ',');
const BAND = { green: [1, 3.9], blue: [3, 5.9], red: [4.5, 8], black: [7, 10] };
const BEAR = ['Nord', 'Nord-est', 'Est', 'Sud-est', 'Sud', 'Sud-ouest', 'Ouest', 'Nord-ouest'];

/* Niveau technique estimé (1–10) : moyenne de la couleur officielle et d'un score de pente (pente moyenne et pente maximale
   d'un tronçon, mesurées sur les tracés et les altitudes), puis ramenée dans la fourchette de la couleur. */
function objective(p) {
  const base = Engine.COLOR_LEVEL[p.color], pi = PI[p.id];
  let avg = pi ? pi[0] : null; const max = pi ? pi[1] : null;
  if (avg == null && p.altFrom && p.altTo && p.km) avg = r1((p.altFrom - p.altTo) / (p.km * 1000) * 100);
  const bearing = pi ? pi[2] : null;
  let level = base, basis = 'la couleur officielle';
  if (avg != null) { level = clamp((base + clamp(1 + (avg - 4) * 0.28 + Math.max(0, (max ?? avg) - avg) * 0.05, 1, 10)) / 2, ...BAND[p.color]); basis = 'la couleur et la pente'; }
  return { level: r1(level), avg, max, bearing, expo: bearing == null ? null : BEAR[Math.round(bearing / 45) % 8], basis };
}
const myVote = id => S.vlog.find(v => v.id === id);
function votesOf(id) {   // mon vote + ceux de mes contacts SKIP (la communauté tant qu'il n'y a pas de serveur)
  const out = [], m = myVote(id);
  if (m) out.push({ s: m.s, t: m.t, tags: m.tags || [] });
  Object.values(S.friends).forEach(f => (f.v || []).forEach(v => { if (v[0] === id) out.push({ s: v[1], t: v[2], tags: (v[3] || []).map(i => TAGS[i]).filter(Boolean) }); }));
  return out;
}
function agg(id, days) {
  const min = days ? Date.now() - days * DAY : 0, vs = votesOf(id).filter(v => v.t >= min), tags = {};
  vs.forEach(v => v.tags.forEach(t => tags[t] = (tags[t] || 0) + 1));
  return { n: vs.length, avg: vs.length ? r1(vs.reduce((a, v) => a + v.s, 0) / vs.length) : null, tags };
}
function setVote(id, s, tags) { const old = myVote(id); S.vlog = S.vlog.filter(v => v.id !== id); S.vlog.push({ id, s, t: Date.now(), tags: tags ?? old?.tags ?? [] }); save(); }
const info = p => {
  const a = agg(p.id, 0), o = objective(p), w = a.n / (a.n + PRIOR), global = a.n ? r1(w * a.avg + (1 - w) * o.level) : null, lv = global ?? o.level;
  return { n: a.n, avg: a.avg, global, est: o.level, obj: o, level: lv, label: Engine.label(lv), fit: Engine.fit(lv, S.level, global == null ? 'estimé' : ''), liked: S.hearts.includes(p.id), mine: myVote(p.id)?.s || null };
};
// Pastille : pleine si la piste a des votes, en pointillés (estimation) sinon
const scoreBubble = (i, big) => i.global == null
  ? `<div class="score est${big ? ' big' : ''}" style="color:${scoreColor(i.est)}">~${fmt1(i.est)}<small>estimé</small></div>`
  : `<div class="score${big ? ' big' : ''}" style="background:${scoreColor(i.global)}">${fmt1(i.global)}<small>/10</small></div>`;
const levelText = i => i.global == null ? `Difficulté estimée : ${fmt1(i.est)}/10` : `Difficulté : ${fmt1(i.global)}/10 · ${i.n} vote${i.n > 1 ? 's' : ''}`;

let guide = null, pending = {}, netEdit = null, plan = null, planMsg = '', sheetPeriod = 0, showChars = false, sheetId = null;
const NET = typeof GRAPH !== 'undefined' ? Engine.buildNet(GRAPH) : null;
let watchId = null, trk = Engine.newTracker(), wakeLock = null, altWarned = false;

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
function openSheet(html) {
  const s = $('#sheet'), top = s.hidden ? 0 : s.querySelector('.in')?.scrollTop || 0;
  s.innerHTML = `<div class="in"><button class="x" data-action="close" aria-label="Fermer">✕</button>${html}</div>`; s.hidden = false;
  s.querySelector('.in').scrollTop = top;
}
function closeSheet() { $('#sheet').hidden = true; sheetId = null; }

/* ---------- Pistes et remontées ---------- */
const norm = t => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
const LIFT_ICON = { 'Téléski': '⛷', 'Tapis': '➡️', 'Ascenseur': '🛗' };
function filteredPistes() {
  const f = S.filt, q = norm(f.q).trim();
  const l = station().pistes.map(p => ({ p, i: info(p) })).filter(({ p, i }) => q ? norm(p.name).includes(q) :
    (!f.colors.length || f.colors.includes(p.color)) && (!f.sector || p.sectors.includes(f.sector)) && (!f.fit || i.fit.key !== 'hard') && (!f.mine || i.fit.key !== 'hard'));
  const byColor = (a, b) => RANK[a.p.color] - RANK[b.p.color] || a.p.name.localeCompare(b.p.name);
  const goal = S.level + 1;   // « Pour moi » : d'abord un cran au-dessus (progresser), puis ce qui est à mon niveau
  l.sort(f.mine && !q ? (a, b) => (b.i.fit.key === 'progress') - (a.i.fit.key === 'progress') || Math.abs(a.i.level - goal) - Math.abs(b.i.level - goal)
    : f.sort === 'hearts' ? (a, b) => (b.i.liked - a.i.liked) || byColor(a, b) : f.sort === 'name' ? (a, b) => a.p.name.localeCompare(b.p.name)
    : f.sort === 'score' ? (a, b) => b.i.level - a.i.level || byColor(a, b) : f.sort === 'alt' ? (a, b) => (b.p.altFrom || 0) - (a.p.altFrom || 0) : byColor);
  return l;
}
function pisteRow({ p, i }) {
  return `<button class="piste" data-action="open" data-id="${p.id}">
    <span class="sq ${p.color}" title="${colorName(p.color)}"></span>
    <span class="sp"><b>${esc(p.name)}</b><br><span class="mut">${[`Piste ${colorName(p.color).toLowerCase()}`, kmText(p.km), alts(p)].filter(Boolean).join(' · ')}</span> ${stateChip('piste', p.id)}<br>
      <span class="lvl${i.global == null ? ' est' : ''}">${levelText(i)}</span> <span class="fit ${i.fit.key}">${i.fit.key === 'hard' ? '⚠ trop dur' : i.fit.key === 'progress' ? '↗ pour progresser' : ''}</span></span>
    ${scoreBubble(i)}</button>`;
}
function filteredLifts() {
  const f = S.filt, q = norm(f.q).trim();
  return station().lifts.filter(l => q ? norm(l.name).includes(q) : !f.sector || l.sectors.includes(f.sector)).sort((a, b) => a.name.localeCompare(b.name));
}
function liftRow(l) {
  return `<button class="piste" data-action="openlift" data-id="${l.id}"><span class="ico">${LIFT_ICON[l.type] || '🚡'}</span>
    <span class="sp"><b>${esc(l.name)}</b><br><span class="mut">${[l.type, l.min ? Math.round(l.min) + ' min' : '', alts(l) || (l.denivele ? 'dénivelé ' + l.denivele + ' m' : '')].filter(Boolean).join(' · ')}</span> ${stateChip('lift', l.id)}</span></button>`;
}
function listHtml() {
  const lifts = S.filt.view === 'lifts', l = lifts ? filteredLifts() : filteredPistes();
  if (!l.length) return '<p class="mut">Aucun résultat.</p>';
  if (lifts || !S.filt.mine || S.filt.q) return l.map(lifts ? liftRow : pisteRow).join('');
  const prog = l.filter(x => x.i.fit.key === 'progress'), ok = l.filter(x => x.i.fit.key === 'ok');
  return (prog.length ? `<h3>↗ Pour progresser</h3>${prog.map(pisteRow).join('')}` : '') + (ok.length ? `<h3>À ton niveau</h3>${ok.map(pisteRow).join('')}` : '');
}
function renderPistes() {
  if (liveState === 'idle') liveLoad(false).then(() => { if (S.tab === 'pistes') render(); });
  const f = S.filt, st = station(), lifts = f.view === 'lifts';
  return `<h2>${esc(st.name)}</h2>${liveBanner()}
  <input type="search" id="q" class="bigsearch" placeholder="🔍 Chercher ${lifts ? 'une remontée' : 'une piste'}" value="${esc(f.q)}" aria-label="Rechercher" autocomplete="off">
  <div class="seg" style="margin:10px 0"><button class="${lifts ? '' : 'on'}" data-action="view" data-v="pistes">Pistes (${st.pistes.length})</button><button class="${lifts ? 'on' : ''}" data-action="view" data-v="lifts">Remontées (${st.lifts.length})</button></div>
  ${lifts ? '' : `<div class="chips" style="margin-bottom:10px"><button class="chip${f.colors.length ? '' : ' on'}" data-action="allcolors">Toutes</button>
    ${COLORS.map(c => `<button class="chip${f.colors.includes(c) ? ' on' : ''}" data-action="color" data-c="${c}"><span class="sq ${c}" style="display:inline-block;vertical-align:-2px"></span> ${colorName(c)}</button>`).join('')}
    <button class="chip${f.mine ? ' on' : ''}" data-action="mine">🎯 Pour moi</button>
    <button class="chip${f.open ? ' on' : ''}" data-action="filters">Réglages</button></div>`}
  ${f.mine && !lifts ? `<div class="card"><div class="mut">🎯 Pistes adaptées à ton niveau, en commençant par celles qui font progresser d'un cran. Les pistes trop dures sont masquées.</div>
    <div class="mut" style="margin-top:6px">Mon niveau : <b id="lvl">${S.level}</b>/10</div><input type="range" min="1" max="10" step="0.5" value="${S.level}" data-range="level" aria-label="Mon niveau"></div>` : ''}
  <select class="f" data-bind="sector" aria-label="Secteur" style="margin-bottom:10px"><option value="">Tous les secteurs</option>${Object.entries(st.sectors).map(([id, n]) => `<option value="${id}" ${f.sector === id ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
  ${f.open && !lifts ? `<div class="card"><div class="mut">Trier par</div>
    <div class="seg" style="margin:6px 0 10px">${[['color', 'Couleur'], ['score', 'Difficulté'], ['alt', 'Altitude'], ['hearts', '❤'], ['name', 'A-Z']].map(([k, t]) => `<button class="${f.sort === k ? 'on' : ''}" data-action="sort" data-k="${k}">${t}</button>`).join('')}</div>
    <div class="mut">Mon niveau : <b id="lvl">${S.level}</b>/10</div>
    <input type="range" min="1" max="10" step="0.5" value="${S.level}" data-range="level" aria-label="Mon niveau">
    <label class="chk"><input type="checkbox" data-bind="fit" ${f.fit ? 'checked' : ''}> Masquer les pistes trop dures pour moi</label></div>` : ''}
  <div id="plist">${listHtml()}</div>
  <p class="mut" style="margin-top:14px">Données officielles de l'Espace Alpe d'Huez (mise à jour du ${esc(st.updated)}). La difficulté « estimée » vient de la couleur officielle et de la pente ; elle est remplacée par la note des skieurs dès qu'il y a des votes.</p>`;
}

function periodLine(id, i) {
  const a = agg(id, sheetPeriod), name = PERIODS.find(x => x[0] === sheetPeriod)[1], all = agg(id, 0), rec = agg(id, 3);
  if (!a.n) return `<span class="mut">Aucun vote${sheetPeriod ? ' sur cette période' : ''}.</span>`;
  const top = Object.entries(a.tags).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([t, n]) => `${t.toLowerCase()} (${n})`).join(', ');
  const trend = sheetPeriod === 0 && rec.n >= 2 && all.n - rec.n >= 2 ? (rec.avg - all.avg >= 1 ? ' · ↗ jugée plus difficile ces 3 derniers jours' : rec.avg - all.avg <= -1 ? ' · ↘ jugée plus facile ces 3 derniers jours' : '') : '';
  return `<b>${fmt1(a.avg)}/10</b> <span class="mut">(${sheetPeriod ? name : 'toutes périodes'}) · ${a.n} vote${a.n > 1 ? 's' : ''}${top ? ' · signalé : ' + esc(top) : ''}${trend}</span>`;
}
function tipsFor(p, i) {
  const o = i.obj, t = [], rec = agg(p.id, 3), hard = (rec.tags['Dure / verglacée'] || 0);
  if (p.color === 'black') t.push('Piste noire : réservée aux skieurs confirmés.');
  if (o.avg != null && o.avg >= 25) t.push(`Pente soutenue (${Math.round(o.avg)} % en moyenne).`);
  if (o.max != null && o.max >= 40) t.push(`Passages très raides (jusqu'à ${o.max} % sur un tronçon).`);
  if (p.altFrom >= 2800) t.push('Haute altitude : froid et vent plus marqués, visibilité parfois réduite.');
  if (o.expo && /Sud/.test(o.expo)) t.push('Exposition sud : la neige se transforme plus vite l\'après-midi.');
  if (o.expo && /Nord/.test(o.expo)) t.push('Exposition nord : neige souvent mieux conservée, mais plaques dures ou verglacées possibles.');
  if (hard >= 2 || (rec.n >= 3 && hard / rec.n >= 0.4)) t.unshift('⚠ Neige dure ou verglacée signalée ces 3 derniers jours.');
  return t;
}
function charsHtml(p, i) {
  const o = i.obj, row = (k, v) => `<div>${k}<b>${v}</b></div>`, a3 = agg(p.id, 3), all = agg(p.id, 0);
  const snow = all.n >= 3 ? Object.entries(all.tags).sort((x, y) => y[1] - x[1]).slice(0, 2).map(([t]) => t).join(', ') : '';   // « habituelle » : il faut au moins 3 votes
  const recent = Object.entries(a3.tags).sort((x, y) => y[1] - x[1]).map(([t, n]) => `${t.toLowerCase()} (${n})`).join(', ');
  const times = p.km ? ['slow', 'medium', 'fast'].map(k => Engine.estMin(p, k)).join(' / ') + ' min' : '';
  const tips = tipsFor(p, i);
  return `<div class="data">
    ${row('Pente moyenne', o.avg != null ? Math.round(o.avg) + ' %' : '—')}${row('Pente maximale (tronçon)', o.max != null ? o.max + ' %' : '—')}
    ${row('Exposition', o.expo ? o.expo + (/Sud/.test(o.expo) ? ' · ensoleillée' : /Nord/.test(o.expo) ? ' · à l\'ombre' : '') : '—')}${row('Largeur', 'non fournie')}
    ${row('Neige habituelle', esc(snow || 'pas assez de votes (3 minimum)'))}${row('Niveau technique estimé', fmt1(o.level) + '/10')}
    ${row('État récent (3 j)', esc(recent || 'aucun signalement'))}${row('Longueur', p.km ? kmText(p.km) : '—')}
    ${row('Altitudes', alts(p) || '—')}${row('Dénivelé', p.denivele ? p.denivele + ' m' : Engine.drop(p) && !p.official ? Engine.drop(p) + ' m' : '—')}
    ${row('Durée estimée (lent / moyen / rapide)', times || '—')}${row('Secteur', esc(p.sectors.map(secName).join(' ; ')))}${p.hours ? row('Horaires', esc(p.hours)) : ''}</div>
    ${tips.length ? `<div class="warn" style="background:var(--brand2);color:var(--ink)"><b>À savoir</b><br>${tips.map(t => esc(t)).join('<br>')}</div>` : ''}
    ${p.info ? `<p style="margin:8px 0 0">${esc(p.info)}</p>` : ''}
    ${p.official ? `<div class="warn" style="background:var(--brand2);color:var(--ink)"><b>Selon le site officiel</b><br>${p.official.map(esc).join('<br>')}</div>` : ''}
    <div class="mut">Pente, exposition et niveau estimés d'après les tracés OpenStreetMap et un modèle d'altitude (valeurs approximatives). Largeur et état de la neige : pas fournis par la station, ils viendront des skieurs. Source : flux officiel de l'Espace Alpe d'Huez.</div>`;
}
function pisteSheet(id) {
  const p = pisteOf(id), i = info(p); sheetId = id;
  if (liveState === 'idle') liveLoad(false).then(() => { if (sheetId === id) pisteSheet(id); });
  const tags = myVote(id)?.tags || [];
  openSheet(`<div class="row"><span class="sq ${p.color}" style="width:22px;height:22px"></span><h2 style="margin:0">${esc(p.name)}</h2></div>
    <div class="mut">Couleur officielle : ${colorName(p.color).toLowerCase()} · ${[kmText(p.km), alts(p)].filter(Boolean).join(' · ')}</div>
    <div class="mut" style="margin-top:4px">Difficulté ressentie (skieurs) : ${i.global == null ? 'pas encore de vote' : Engine.reliability(i.n).text}</div>
    <div class="row" style="margin:12px 0">${scoreBubble(i, true)}<div>
      <span class="lab ${i.label.key}">${i.label.icon} ${i.label.text.toUpperCase()}${i.global == null ? ' (estimé)' : ''}</span><br>
      <b>${i.global == null ? `Difficulté estimée : ${fmt1(i.est)}/10` : `Note moyenne : ${fmt1(i.avg)}/10`}</b> <span class="mut">· niveau ${Engine.levelOf(i.level).n}/5 ${Engine.levelOf(i.level).label.toLowerCase()}</span><br>
      <span class="mut">${i.global == null ? `Aucun vote pour l'instant. Estimation d'après ${esc(i.obj.basis)}.` : `Basée sur ${i.n} vote${i.n > 1 ? 's' : ''} · difficulté globale ${fmt1(i.global)}/10 (avec l'estimation objective ${fmt1(i.est)}/10)`}</span></div></div>
    ${openingLine('piste', id)}
    <div class="fit ${i.fit.key}" style="margin-bottom:8px">${i.fit.text} (niveau ${S.level}/10)</div>
    ${i.fit.key === 'hard' ? '<div class="warn">⚠ Cette piste est au-dessus de ton niveau. Choisis plutôt une piste plus facile.</div>' : ''}
    ${tipsFor(p, i)[0]?.startsWith('⚠') ? `<div class="warn">${esc(tipsFor(p, i)[0])}</div>` : ''}
    <h3 style="margin-top:6px">${i.mine ? 'Ta note : ' + i.mine + '/10' : 'Donne ta note en 1 tap'}</h3><div class="mut">1 = très facile · 10 = très difficile</div>
    <div class="rate" data-rate="${id}">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<button style="background:${scoreColor(n)}" class="${i.mine === n ? 'on' : ''}" data-action="rate" data-id="${id}" data-n="${n}" aria-label="Note ${n} sur 10">${n}</button>`).join('')}</div>
    ${i.mine ? `<div class="mut">Conditions aujourd'hui ? (facultatif)</div><div class="chips" style="margin:6px 0">${TAGS.map((t, k) => `<button class="chip${tags.includes(t) ? ' on' : ''}" data-action="vtag" data-id="${id}" data-t="${k}">${t}</button>`).join('')}</div>
      <button class="chip" data-action="unrate" data-id="${id}">Retirer ma note</button>` : ''}
    <div class="row" style="margin:14px 0 4px;gap:6px"><span class="mut">Période :</span>${PERIODS.map(([d, t]) => `<button class="chip pchip${sheetPeriod === d ? ' on' : ''}" data-action="period" data-d="${d}">${t}</button>`).join('')}</div>
    <div style="margin-bottom:12px">${periodLine(id, i)}</div>
    <div class="row"><button class="heart${i.liked ? ' on' : ''}" data-action="heart" data-id="${id}">${i.liked ? '❤️ Coup de cœur' : '🤍 Coup de cœur'}</button><button class="btn sec" data-action="skied" data-id="${id}">✅ Skiée</button></div>
    <button class="btn ghost" data-action="chars" style="margin-top:12px">${showChars ? '▾' : '▸'} Caractéristiques</button>
    ${showChars ? `<div style="margin-top:10px">${charsHtml(p, i)}</div>` : ''}`);
}
function liftSheet(id) {
  const l = liftOf(id), cell = (k, v) => v ? `<div>${k}<b>${esc(v)}</b></div>` : '';
  openSheet(`<div class="row"><span class="ico">${LIFT_ICON[l.type] || '🚡'}</span><h2 style="margin:0">${esc(l.name)}</h2></div><div class="mut">${esc(l.type)}</div>
    ${openingLine('lift', id)}<div class="data" style="margin-top:12px">${cell('Durée du trajet', l.min ? Math.round(l.min) + ' min' : '')}${cell('Altitudes', alts(l))}${cell('Dénivelé', l.denivele ? l.denivele + ' m' : l.altFrom && l.altTo ? l.altTo - l.altFrom + ' m' : '')}
      ${cell('Horaires', l.hours)}${cell('Débit maximum', l.debit ? l.debit + ' pers/h' : '')}${cell('Secteur', l.sectors.map(secName).join(' ; '))}</div>
    <div class="mut">Source : flux officiel de l'Espace Alpe d'Huez. Les informations manquantes ne sont pas fournies.</div>
`);
}

/* ---------- Itinéraire ---------- */
const LIFT_FR = { gondola: 'Télécabine', chair_lift: 'Télésiège', mixed_lift: 'Télémix', cable_car: 'Téléphérique', platter: 'Téléski', magic_carpet: 'Tapis', rope_tow: 'Téléski', drag_lift: 'Téléski', 't-bar': 'Téléski', 'j-bar': 'Téléski' };
const DUR = [[60, '1 h'], [90, '1 h 30'], [120, '2 h'], [180, '3 h'], [240, '4 h']];
const starts = () => NET ? Engine.startPoints(NET) : [];
function startIndex(name) {
  const list = starts(); if (!list.length) return null;
  const hit = list.find(p => p.name === name) || list.find(p => p.name === 'Départ Signal') || list[0];
  return hit.i;
}
const stepName = s => s.kind === 'piste' ? (s.name || `Piste ${colorName(s.color).toLowerCase()} sans nom`) : s.name;
const liftType = s => (s.o && liftOf(s.o)?.type) || LIFT_FR[s.y] || 'Remontée';
const mText = m => m >= 1000 ? (m / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(m / 10) * 10 + ' m';
function stepText(s) {
  if (s.kind === 'lift') return `Prenez ${s.name}, ${s.min} minutes. Arrivée : ${s.toName}.`;
  if (s.kind === 'piste') return `Descendez ${stepName(s)}, piste ${colorName(s.color).toLowerCase()}, ${mText(s.m)}, environ ${s.min} minutes.`;
  if (s.kind === 'walk') return `Marchez ${mText(s.m)} en chaussures de ski, environ ${s.min} minutes, jusqu'à ${s.toName}.`;
  return `Liaison à ski, ${mText(s.m)}, jusqu'à ${s.toName}.`;
}
function mapSvg(pl) {
  const W = 340, H = 340, pts = pl.steps.flatMap(s => s.coords);
  let la0 = Math.min(...pts.map(p => p[0])), la1 = Math.max(...pts.map(p => p[0])), lo0 = Math.min(...pts.map(p => p[1])), lo1 = Math.max(...pts.map(p => p[1]));
  const k = Math.cos((la0 + la1) / 2 * Math.PI / 180), padLa = (la1 - la0) * 0.08 + 0.0008, padLo = (lo1 - lo0) * 0.08 + 0.001;
  la0 -= padLa; la1 += padLa; lo0 -= padLo; lo1 += padLo;
  const sc = Math.min((W - 16) / ((lo1 - lo0) * k), (H - 16) / (la1 - la0)), ox = (W - (lo1 - lo0) * k * sc) / 2, oy = (H - (la1 - la0) * sc) / 2;
  const X = lo => ox + (lo - lo0) * k * sc, Y = la => oy + (la1 - la) * sc;
  const path = c => 'M' + c.map(p => X(p[1]).toFixed(1) + ' ' + Y(p[0]).toFixed(1)).join('L');
  const used = new Set(pl.steps.flatMap(s => s.edges));
  const bg = NET.edges.filter(e => !used.has(e.id)).map(e => { const g = NET.geom(e), p = g[0]; return p[0] > la0 && p[0] < la1 && p[1] > lo0 && p[1] < lo1 ? `<path d="${path(g)}" fill="none" style="stroke:${e.k === 'piste' ? 'var(--' + e.c + ')' : 'var(--mut)'}" stroke-opacity=".28" stroke-width="1.2"/>` : ''; }).join('');
  const line = pl.steps.map(s => `<path d="${path(s.coords)}" fill="none" style="stroke:${s.kind === 'piste' ? 'var(--' + s.color + ')' : s.kind === 'lift' ? '#3d4660' : '#a0702a'}" stroke-width="${s.kind === 'piste' ? 4 : 3}" stroke-linecap="round" stroke-linejoin="round" ${s.kind === 'lift' ? 'stroke-dasharray="7 4"' : s.kind === 'walk' ? 'stroke-dasharray="2 4"' : ''}/>`).join('');
  const badge = (s, i) => { const c = s.coords[Math.floor(s.coords.length / 2)], col = s.kind === 'piste' ? 'var(--' + s.color + ')' : s.kind === 'lift' ? '#3d4660' : '#a0702a';
    return `<circle cx="${X(c[1]).toFixed(1)}" cy="${Y(c[0]).toFixed(1)}" r="8.5" style="fill:${col}" stroke="#fff" stroke-width="1.5"/><text x="${X(c[1]).toFixed(1)}" y="${(Y(c[0]) + 3.5).toFixed(1)}" text-anchor="middle" font-size="9.5" font-weight="800" fill="#fff">${i + 1}</text>`; };
  const f = pl.steps[0].coords[0], e = pl.steps[pl.steps.length - 1].coords.slice(-1)[0];
  const flag = (p, t, c) => `<circle cx="${X(p[1]).toFixed(1)}" cy="${Y(p[0]).toFixed(1)}" r="6" style="fill:${c}" stroke="#fff" stroke-width="2"/><text x="${(X(p[1]) + 9).toFixed(1)}" y="${(Y(p[0]) - 7).toFixed(1)}" font-size="10" font-weight="800" style="fill:var(--ink)" stroke="var(--card)" stroke-width="3" paint-order="stroke">${t}</text>`;
  return `<svg class="map" viewBox="0 0 ${W} ${H}" role="img" aria-label="Carte de l'itinéraire">${bg}${line}${pl.steps.map(badge).join('')}${Math.abs(f[0] - e[0]) + Math.abs(f[1] - e[1]) < 0.0004 ? flag(f, 'DÉPART · ARRIVÉE', '#0b5fff') : flag(f, 'DÉPART', '#1fb04a') + flag(e, 'ARRIVÉE', '#0b5fff')}</svg>
    <div class="mut" style="margin-top:6px">Trait plein = piste (couleur officielle) · pointillés longs = remontée · pointillés courts = marche · fond clair = autres pistes. Tracés © contributeurs OpenStreetMap.</div>`;
}
function feltLine(o) {
  const p = o && pisteOf(o); if (!p) return 'Piste non officielle : difficulté inconnue';
  const i = info(p), rel = Engine.reliability(i.n), lvl = Engine.levelOf(i.level);
  return i.global == null ? `Difficulté estimée ≈ ${lvl.n}/5 · ${rel.text}` : `Difficulté ressentie ${rel.key === 'low' ? '≈ ' : ''}${lvl.n}/5 (${fmt1(i.global)}/10) · ${rel.text}`;
}
function stepsHtml(pl) {
  return pl.steps.map((s, i) => {
    const col = s.kind === 'piste' ? `var(--${s.color})` : s.kind === 'lift' ? '#3d4660' : '#a0702a';
    const head = s.kind === 'lift' ? `🚡 ${esc(liftType(s))} · ${esc(s.name)}` : s.kind === 'piste' ? `Piste ${colorName(s.color).toLowerCase()} · ${esc(stepName(s))}` : s.kind === 'walk' ? '🚶 À pied (chaussures de ski)' : '↝ Liaison à ski';
    const info = (s.o && (s.kind === 'piste' ? pisteOf(s.o) : liftOf(s.o))) ? `<button class="btn sm ghost" data-action="openstep" data-i="${i}" aria-label="Détails">ℹ︎</button>` : '';
    return `<div class="step"><div class="num" style="background:${col}">${i + 1}</div><div class="sp"><b>${head}</b><br>
      ${s.kind === 'piste' ? `<span class="mut" style="display:block"><span class="sq ${s.color}" style="display:inline-block;vertical-align:-2px"></span> Couleur officielle : ${colorName(s.color).toLowerCase()} · ${esc(feltLine(s.o))}</span>` : ''}<span class="mut">De : ${esc(s.fromName)}${s.altFrom && !s.fromName.startsWith('Carrefour') ? ` (${s.altFrom} m)` : ''}<br>À : ${esc(s.toName)}${s.altTo && !s.toName.startsWith('Carrefour') ? ` (${s.altTo} m)` : ''}<br>${mText(s.m)} · ${s.min} min</span></div>${info}</div>`;
  }).join('') + `<div class="step"><div class="num" style="background:var(--brand)">🏁</div><div class="sp"><b>Arrivée</b><br><span class="mut">${esc(pl.steps[pl.steps.length - 1].toName)}</span></div></div>`;
}
function levelSummary(pl) {
  const ps = pl.steps.filter(x => x.kind === 'piste' && x.o && pisteOf(x.o)), inf = ps.map(x => info(pisteOf(x.o)));
  const rated = inf.filter(i => i.n >= 5).length, few = inf.filter(i => i.n > 0 && i.n < 5).length, est = inf.length - rated - few;
  return `<div class="mut" style="margin-top:6px">Difficulté recherchée : ${pl.opt.loL} à ${pl.opt.hiL} sur 5 (${Engine.LEVELS[pl.opt.loL - 1].label.toLowerCase()} à ${Engine.LEVELS[pl.opt.hiL - 1].label.toLowerCase()}). Sur ${inf.length} pistes : ${rated} avec au moins 5 votes, ${few} peu documentée${few > 1 ? 's' : ''}, ${est} estimée${est > 1 ? 's' : ''} (aucun vote). Les couleurs officielles restent la référence : une note de skieurs ne rend pas une piste adaptée à tous.</div>`;
}
function planSummary(pl) {
  const cols = {}; pl.steps.filter(s => s.kind === 'piste').forEach(s => cols[s.color] = (cols[s.color] || 0) + 1);
  const st0 = pl.steps[0], stN = pl.steps[pl.steps.length - 1];
  return `<p style="margin:0 0 10px">Tu pars de <b>${esc(st0.fromName)}</b> et tu finis à <b>${esc(stN.toName)}</b>, en ${pl.steps.length} étapes.</p>
    <div class="stats"><div><b>${fmtMin(pl.total)}</b><span>durée</span></div><div><b>${pl.descents}</b><span>pistes</span></div><div><b>${String(pl.km).replace('.', ',')}</b><span>km skiés</span></div><div><b>${pl.down}</b><span>m descendus</span></div></div>
    <div class="chips" style="margin-top:8px">${Object.entries(cols).map(([c, n]) => `<span class="chip"><span class="sq ${c}" style="display:inline-block;vertical-align:-2px"></span> ${n}</span>`).join('')}${pl.walkMin ? `<span class="chip">🚶 ${pl.walkMin} min à pied</span>` : ''}</div>
    ${pl.opt.mode === 'felt' ? levelSummary(pl) : ''}
    ${pl.offColor ? `<div class="mut" style="margin-top:6px">dont ${pl.offColor} min sur des pistes plus faciles que celles choisies, pour relier les secteurs.</div>` : ''}
    ${Math.abs(pl.total - pl.opt.budget) > pl.opt.budget * 0.15 ? `<div class="mut" style="margin-top:6px">Durée demandée : ${fmtMin(pl.opt.budget)}. C'est le meilleur parcours trouvé.</div>` : ''}
    <div class="mut" style="margin-top:6px">Remontées : durées officielles (sans attente). Descentes et marche : durées estimées d'après la longueur.</div>`;
}
function renderRoute() {
  const f = S.rf, list = starts(), saved = S.route && S.route.stationId === S.station ? S.route : null;
  if (!NET) return '<h2>Mon itinéraire</h2><p class="mut">Le réseau des pistes n\'est pas disponible.</p>';
  const si = startIndex(f.start), ei = f.end ? startIndex(f.end) : null;
  const opt = p => `<option value="${esc(p.name)}">${esc(p.name)} (${p.alt} m)</option>`;
  return `<h2>Mon itinéraire</h2>
  ${guide ? `<div class="card" style="border-color:var(--brand)"><b>🔊 Guidage en cours</b><div style="margin:6px 0">${guide.idx < guide.steps.length ? 'Prochaine étape : ' + esc(stepText(guide.steps[guide.idx])) : '🎉 Itinéraire terminé !'}</div>
    <div class="row"><button class="btn sm" data-action="gnext">Étape suivante</button><button class="btn sm ghost" data-action="gstop">Arrêter</button></div></div>` : ''}
  <div class="card">
    <label class="mut" for="rstart">D'où pars-tu ?</label>
    <select class="f" id="rstart" data-bind="rstart">${list.map(p => opt(p).replace('<option ', `<option ${p.i === si ? 'selected ' : ''}`)).join('')}</select>
    <div style="height:10px"></div><label class="mut" for="rend">Où veux-tu finir ?</label>
    <select class="f" id="rend" data-bind="rend"><option value="">Au même endroit</option>${list.map(p => opt(p).replace('<option ', `<option ${f.end && p.i === ei ? 'selected ' : ''}`)).join('')}</select>
    <div style="height:10px"></div><div class="mut">Combien de temps ?</div>
    <div class="chips" style="margin-top:6px">${DUR.map(([m, t]) => `<button class="chip${f.budget === m ? ' on' : ''}" data-action="rf" data-k="budget" data-v="${m}">${t}</button>`).join('')}</div>
    <div style="height:10px"></div><div class="mut">Comment choisir la difficulté ?</div>
    <div class="seg" style="margin:6px 0 8px"><button class="${f.mode === 'felt' ? 'on' : ''}" data-action="rf" data-k="mode" data-v="felt">Difficulté ressentie</button><button class="${f.mode === 'color' ? 'on' : ''}" data-action="rf" data-k="mode" data-v="color">Couleurs officielles</button></div>
    ${f.mode === 'felt' ? `<div class="mut">Difficulté recherchée : de <b>${f.lo}</b> (${Engine.LEVELS[f.lo - 1].label}) à <b>${f.hi}</b> (${Engine.LEVELS[f.hi - 1].label}) sur 5</div>
      <div class="mut" style="margin-top:6px">De</div><div class="chips" style="margin-top:4px">${Engine.LEVELS.map(l => `<button class="chip${f.lo === l.n ? ' on' : ''}" data-action="rlevel" data-k="lo" data-v="${l.n}" title="${l.label}">${l.n}</button>`).join('')}</div>
      <div class="mut" style="margin-top:6px">À</div><div class="chips" style="margin-top:4px">${Engine.LEVELS.map(l => `<button class="chip${f.hi === l.n ? ' on' : ''}" data-action="rlevel" data-k="hi" data-v="${l.n}" title="${l.label}">${l.n}</button>`).join('')}</div>
      <div class="mut" style="margin-top:6px">1 très facile · 2 facile · 3 intermédiaire · 4 difficile · 5 très difficile (tranches de la note 1–10 des pistes). La difficulté ressentie vient des votes des skieurs, mélangée à une estimation d'après la pente ; une piste peu notée est marquée « estimée » ou « peu documentée ». La couleur officielle reste un garde-fou : une piste dont la couleur est bien plus difficile que ton maximum n'est jamais proposée.</div>`
    : `<div class="chips" style="margin-top:6px">${COLORS.map(c => `<button class="chip${f.colors.includes(c) ? ' on' : ''}" data-action="rcolor" data-c="${c}"><span class="sq ${c}" style="display:inline-block;vertical-align:-2px"></span> ${colorName(c)}</button>`).join('')}</div>
      <div class="mut" style="margin-top:4px">Jamais plus difficile que ta couleur la plus dure. Les pistes plus faciles peuvent servir de liaison.</div>`}
    <div style="height:10px"></div><div class="mut">Ta vitesse</div>
    <div class="seg" style="margin-top:6px">${[['slow', '🐢 Lent'], ['medium', '⛷ Moyen'], ['fast', '⚡ Rapide']].map(([k, t]) => `<button class="${f.speed === k ? 'on' : ''}" data-action="rf" data-k="speed" data-v="${k}">${t}</button>`).join('')}</div>
    <label class="chk"><input type="checkbox" data-bind="rwalk" ${f.walk ? 'checked' : ''}> Autoriser de courts chemins à pied (en chaussures de ski)</label>
    <button class="btn" data-action="plan">Créer mon itinéraire</button>
  </div>
  ${planMsg ? `<div class="warn">${esc(planMsg)}</div>` : ''}
  ${plan ? `<div class="card"><h3 style="margin-top:0">Ton itinéraire</h3>${planSummary(plan)}</div>
    <div class="card">${mapSvg(plan)}</div>
    <div class="card"><h3 style="margin-top:0">Étape par étape</h3>${stepsHtml(plan)}</div>
    <div class="row"><button class="btn sec" data-action="plan" data-next="1">↻ Autre proposition</button><button class="btn sec" data-action="download">📥 Hors ligne</button></div>
    <div style="height:8px"></div><div class="row"><button class="btn sec" data-action="gstart">🔊 Guidage audio</button><button class="btn ghost" data-action="share" data-k="route">📤 Partager</button></div>` : ''}
  ${saved ? `<div class="card"><b>📥 Itinéraire téléchargé</b><div class="mut">Enregistré le ${new Date(saved.savedAt).toLocaleString('fr-FR')}, disponible sans réseau.</div>
    <div class="row" style="margin-top:8px"><button class="btn sm sec" data-action="loadsaved">Ouvrir</button><button class="btn sm ghost" data-action="delsaved">Supprimer</button></div></div>` : ''}
  <p class="mut">Les liaisons entre pistes, remontées et chemins viennent de la carte OpenStreetMap, rapprochée des données officielles. Elles peuvent contenir des erreurs : vérifie toujours sur le plan officiel et sur place, et respecte la fermeture des pistes et le balisage.</p>`;
}
const generate = next => generateAt(next ? (S.rf.variant || 0) + 1 : 0);
const edgeLevel = e => { const p = e.o && pisteOf(e.o); if (p) { const i = info(p); return { level: i.level, n: i.n }; } return { level: Engine.COLOR_LEVEL[e.c] ?? 5, n: 0 }; };
function generateAt(v) {
  const f = S.rf; f.variant = v;
  const si = startIndex(f.start), ei = f.end ? startIndex(f.end) : si;
  const [lo, hi] = Engine.levelRange(f.lo, f.hi);
  const r = Engine.planRoute(NET, { start: si, end: ei, budget: f.budget, speed: f.speed, colors: f.colors, walk: f.walk, variant: f.variant, blocked: e => !!e.o && isClosed(e.k === 'lift' ? 'lift' : 'piste', e.o),
    ...(f.mode === 'felt' ? { levelOf: edgeLevel, lo, hi } : {}) });
  planMsg = '';
  if (r.error) {
    plan = null;
    planMsg = f.mode === 'color' && !f.colors.length ? 'Choisis au moins une couleur de piste.' : !f.walk ? "Aucun itinéraire sans marche depuis ce départ : autorise les courts chemins à pied." : "Aucun itinéraire trouvé avec ces choix : essaie une durée plus longue, une autre couleur ou un autre départ.";
  } else { plan = r; plan.opt.loL = f.lo; plan.opt.hiL = f.hi; }
  save(); render();
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
function handleFix(fix) {
  if (fix.alt == null) { if (!altWarned) { altWarned = true; toast("Ton téléphone ne donne pas l'altitude : la détection automatique est impossible.", 5000); } return; }
  const seg = Engine.onFix(station(), trk, fix);
  if (seg) { addLog(seg); if (guide && seg.type === 'piste') advanceGuide(); }
  if (S.notif.enabled && S.notif.lift && Engine.climbGain(trk) >= 60) {   // en remontée : on invite à noter la dernière descente identifiée
    const log = logToday(), k = log.map((e, j) => ({ e, j })).reverse().find(x => x.e.type === 'piste' && Date.now() - x.e.t < 25 * 60000);
    if (k) { const id = k.e.pick || k.e.cands[0]; if (id) promptRate(id, k.j); }
  }
  if (S.tab === 'day' && $('#pocket').hidden) render();
}
function startTracking() {
  if (watchId !== null) return true;
  if (!navigator.geolocation) { toast('GPS indisponible sur cet appareil.'); return false; }
  trk = Engine.newTracker(); altWarned = false;
  watchId = navigator.geolocation.watchPosition(p => handleFix({ lat: p.coords.latitude, lng: p.coords.longitude, alt: p.coords.altitude, t: Date.now() }),
    e => toast('GPS : ' + e.message, 5000), { enableHighAccuracy: true, maximumAge: 5000 });
  return true;
}
function stopTracking() { if (watchId !== null) navigator.geolocation.clearWatch(watchId); watchId = null; }
function simulateDescent(id) {
  const p = pisteOf(id); if (!p || !p.altFrom || !p.altTo) return toast('Cette piste n\'a pas d\'altitudes : test impossible.');
  const tr = Engine.newTracker(); let t = Date.now() - 3600000, lng = 6.07, found = null;
  const push = (alt, d) => { lng += d / 78000; const r = Engine.onFix(station(), tr, { lat: 45.09, lng, alt, t: t += 10000 }); if (r) found = r; };
  for (let i = 0; i < 3; i++) push(p.altFrom, 0);
  for (let i = 1; i <= 40; i++) push(p.altFrom - (p.altFrom - p.altTo) * i / 40, (p.km || 1) * 1000 / 40);
  for (let i = 1; i <= 9; i++) push(p.altTo + Math.min(i, 6) * 25, 5);
  if (found) { addLog(found); render(); } else toast('Descente non détectée dans la simulation.');
}
function renderDay() {
  const st = station(), log = logToday();
  const mins = Math.round((S.screen[todayKey()] || 0) / 60), auto = log.filter(e => e.auto && e.type === 'piste').length;
  const pistes = [...new Set(log.filter(e => e.type === 'piste' && e.pick).map(e => e.pick))];
  const nPending = Object.keys(pending).length, hour = new Date().getHours();
  return `<h2>Ma journée</h2>
  ${pistes.length && hour >= 16 ? '<div class="warn">🌇 La journée est finie ? Note tes pistes ci-dessous en 2 secondes chacune.</div>' : ''}
  <div class="card"><b>📍 Enregistrement sans regarder l'écran</b>
    <div class="mut" style="margin:4px 0 10px">Le GPS suit ton altitude : l'appli reconnaît les descentes et les remontées dont les altitudes correspondent. S'il hésite entre plusieurs pistes, tu choisis le soir.</div>
    <div class="row"><button class="btn" data-action="track">${watchId !== null ? '⏹ Arrêter' : '▶ Démarrer'} l'enregistrement</button>
    <button class="btn sec" data-action="pocket">🌑 Mode poche</button></div>
    <label class="chk"><input type="checkbox" data-bind="audio" ${S.audio ? 'checked' : ''}> Confirmation vocale + vibration (sans regarder)</label></div>
  ${renderNotifCard()}
  <div class="card"><b>📵 Temps d'écran aujourd'hui : ${mins} min</b>
    <div class="bar" style="margin:8px 0"><i style="width:${Math.min(100, mins / 15 * 100)}%"></i></div>
    <div class="mut">Objectif : moins de 15 min. ${auto} descente(s) enregistrée(s) automatiquement. Profite de la remontée pour admirer le paysage 🏔️</div></div>
  <h3>Descentes de la journée (${log.filter(e => e.type === 'piste').length})</h3>
  <div class="card">${log.length ? log.map((e, k) => logRow(e, k)).join('') : '<p class="mut" style="margin:0">Rien d\'enregistré pour l\'instant.</p>'}
    <div class="row" style="margin-top:10px"><select class="f" id="manual" style="flex:1"><option value="">Ajouter une piste à la main…</option>${st.pistes.map(p => `<option value="${p.id}">${esc(p.name)} (${colorName(p.color).toLowerCase()})</option>`).join('')}</select></div>
    <div class="row" style="margin-top:8px"><select class="f" id="simsel" style="flex:1"><option value="">Tester la détection avec…</option>${st.pistes.filter(p => p.altFrom && p.altTo).map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div></div>
  <h3>⭐ Noter mes pistes</h3>
  ${pistes.length ? `<div class="card">${pistes.map(id => { const p = pisteOf(id), cur = pending[id] ?? myVote(id)?.s; return `<div style="margin-bottom:12px"><div class="row"><span class="sq ${p.color}"></span><b class="sp">${esc(p.name)}</b></div>
      <div class="rate mini">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<button style="background:${scoreColor(n)}" class="${cur === n ? 'on' : ''}" data-action="pend" data-id="${id}" data-n="${n}">${n}</button>`).join('')}</div></div>`; }).join('')}
    <button class="btn" data-action="sendvotes" ${nPending ? '' : 'disabled'}>Enregistrer mes ${nPending} note(s)</button></div>` : '<p class="mut">Ski quelques pistes, elles apparaîtront ici pour un vote de fin de journée.</p>'}`;
}
function logRow(e, k) {
  const alt = e.altFrom && e.altTo ? ` <span class="mut">(${e.altFrom} → ${e.altTo} m)</span>` : '';
  let txt;
  if (e.pick) { const x = thing(e.pick); txt = e.type === 'lift' ? '🚡 ' + esc(x.name) : `<span class="sq ${x.color}" style="display:inline-block"></span> ${esc(x.name)}`; }
  else if (e.cands.length) txt = `${e.type === 'lift' ? 'Remontée' : 'Piste'} à identifier${alt} <div class="chips" style="margin-top:4px">${e.cands.map(c => `<button class="chip" data-action="resolve" data-k="${k}" data-id="${c}">${esc(thing(c).name)}</button>`).join('')}</div>`;
  else txt = `${e.type === 'lift' ? 'Montée' : 'Descente'} non identifiée${alt}`;
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
const chatKey = () => S.station + ':' + todayKey();
const heartNames = ids => ids.map(id => pisteOf(id)?.name).filter(Boolean);
const netLinks = so => Object.entries(so || {}).filter(([k, h]) => NETWORKS[k] && HANDLE.test(h)).map(([k, h]) =>
  `<a class="chip" href="${NETWORKS[k].url(encodeURIComponent(h))}" target="_blank" rel="noopener noreferrer">${NETWORKS[k].name} ↗</a>`).join('');

/* Partage sans serveur : un message texte contient un code SKIP que l'ami colle dans son appli. */
const b64e = o => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64d = c => JSON.parse(decodeURIComponent(escape(atob(c.replace(/-/g, '+').replace(/_/g, '/')))));
function sharePayload(kind) {
  const pr = S.profile;
  const f = S.rf, r = kind === 'route' && plan ? { start: starts().find(p => p.i === plan.opt.start)?.name, end: plan.opt.end !== plan.opt.start ? starts().find(p => p.i === plan.opt.end)?.name : '', budget: plan.opt.budget, speed: plan.opt.speed, colors: plan.opt.colors, walk: plan.opt.walk, variant: plan.opt.variant, mode: plan.opt.mode, lo: plan.opt.loL || 0, hi: plan.opt.hiL || 0 } : null;
  return { v: 2, n: pr.pseudo || 'Skieur', l: S.level, d: pr.discipline, s: pr.status, w: pr.wants, so: pr.socials, st: S.station, h: S.hearts, r, t: Date.now(),
    v: S.vlog.slice(-80).map(v => [v.id, v.s, v.t, (v.tags || []).map(t => TAGS.indexOf(t)).filter(i => i >= 0)]) };
}
function shareText(kind) {
  const pl = sharePayload(kind), hn = heartNames(S.hearts);
  const lines = [`⛷ ${pl.n} sur SKIP, ${station().name}`, `Niveau ${pl.l}/10 · ${pl.d === 'snowboard' ? 'snowboard' : 'ski'} · ${STATUSES[pl.s]}`];
  if (kind === 'route' && plan) lines.push(`🧭 Itinéraire de ${fmtMin(plan.total)} : ${plan.steps.filter(s => s.kind === 'piste' && s.name).map(s => s.name).slice(0, 12).join(' → ')}`);
  if ((kind === 'hearts' || kind === 'profile') && hn.length) lines.push(`❤ Mes coups de cœur : ${hn.join(', ')}`);
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
  if (!o || typeof o.n !== 'string') return 'Code non reconnu.';
  const so = {}; Object.entries(o.so || {}).forEach(([k, h]) => { if (NETWORKS[k] && typeof h === 'string' && HANDLE.test(h)) so[k] = h; });
  const f = {
    n: o.n.slice(0, 30), l: Math.min(10, Math.max(1, +o.l || 5)), d: o.d === 'snowboard' ? 'snowboard' : 'ski', s: STATUSES[o.s] ? o.s : 'slopes',
    w: (Array.isArray(o.w) ? o.w : []).filter(x => WANTS.includes(x)), so, st: DATA.stations[o.st] ? o.st : S.station,
    h: (Array.isArray(o.h) ? o.h : []).filter(x => typeof x === 'string').slice(0, 60), t: +o.t || Date.now()
  };
  if (Array.isArray(o.v)) f.v = o.v.slice(0, 100).filter(v => Array.isArray(v) && typeof v[0] === 'string' && pisteOf(v[0]) && Number.isInteger(v[1]) && v[1] >= 1 && v[1] <= 10 && Number.isFinite(v[2]) && v[2] > 1.6e12 && v[2] < Date.now() + DAY)
    .map(v => [v[0], v[1], v[2], (Array.isArray(v[3]) ? v[3] : []).filter(i => Number.isInteger(i) && i >= 0 && i < TAGS.length)]);
  const r = o.r;
  if (r && typeof r.start === 'string' && r.start.length < 120 && Engine.SPEED_KMH[r.speed] && Array.isArray(r.colors))
    f.r = { start: r.start, end: typeof r.end === 'string' ? r.end.slice(0, 120) : '', budget: Math.min(480, Math.max(30, +r.budget || 120)), speed: r.speed, colors: r.colors.filter(c => COLORS.includes(c)), walk: r.walk !== false, variant: Math.min(50, Math.max(0, +r.variant || 0)),
      mode: r.mode === 'felt' ? 'felt' : 'color', lo: clamp(Math.round(+r.lo || 2), 1, 5), hi: clamp(Math.round(+r.hi || 3), 1, 5) };
  if (Object.keys(S.friends).length >= 50 && !S.friends[f.n.toLowerCase()]) return 'Limite de 50 contacts atteinte.';
  S.friends[f.n.toLowerCase()] = f; save(); return null;
}
function renderMeet() {
  const pr = S.profile, msgs = S.chat[chatKey()] || [], hn = heartNames(S.hearts);
  const netRows = Object.entries(NETWORKS).map(([k, n]) => {
    const h = pr.socials[k];
    if (h) return `<div class="net-row"><b class="sp">${n.name}</b><a href="${n.url(encodeURIComponent(h))}" target="_blank" rel="noopener noreferrer">@${esc(h)} ↗</a><button class="btn sm ghost" data-action="netdel" data-k="${k}">Retirer</button></div>`;
    if (netEdit === k) return `<div class="net-row" style="flex-wrap:wrap"><div class="sp mut" style="flex-basis:100%">1. <a href="${n.login}" target="_blank" rel="noopener noreferrer">Ouvre ${n.name} ↗</a> et connecte-toi. 2. Recopie ton identifiant :</div>
      <input type="text" id="nethandle" placeholder="ton identifiant" maxlength="40" aria-label="Identifiant ${n.name}" autocapitalize="off"><button class="btn sm" data-action="netsave" data-k="${k}">OK</button></div>`;
    return `<div class="net-row"><b class="sp">${n.name}</b><button class="btn sm sec" data-action="netedit" data-k="${k}">Connecter</button></div>`;
  }).join('');
  const friends = Object.entries(S.friends).sort((a, b) => b[1].t - a[1].t).map(([key, f]) => {
    const stn = DATA.stations[f.st] || station(), hn2 = stn.pistes.filter(p => f.h.includes(p.id)).map(p => p.name);
    return `<div class="card"><div class="me-card"><div class="avatar">${esc(f.n[0].toUpperCase())}</div><div class="sp"><b>${esc(f.n)}</b> <span class="mut">· ${f.d === 'snowboard' ? 'snowboard' : 'ski'} · niveau ${f.l}/10</span><br>
      <span class="badge">${STATUSES[f.s]}</span> <span class="mut">mis à jour le ${new Date(f.t).toLocaleDateString('fr-FR')}${(f.v || []).length ? ' · ' + f.v.length + ' note(s) partagée(s)' : ''}</span></div></div>
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
  const Y = '✅', N = '❌', M = '➖', st = station();
  const rows = [
    ['Note de difficulté 1–10', N, N, N, Y],
    ['Notes communautaires + données terrain', N, N, M, Y],
    ['Aide à la progression / sécurité', N, N, N, Y],
    ['Tracking des descentes', N, Y, M, Y],
    ['Parcours multi-pistes sur mesure', N, N, N, Y],
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
     ['SKIIF (le « Waze du ski »)', "Cartes 2D/3D, guidage audio, amis en temps réel, affluence, neige, SOS 112, 200+ stations, gratuit. L'appli la plus proche de la nôtre.", "Pas d'aide à la progression ni de note précise ; GPS moyen sur les pistes ; pas de programme de ski sur plusieurs pistes.", "On reprend guidage audio et SOS, on ajoute notation, progression et parcours sur mesure."]]
    .map(([n, a, l, r]) => `<div class="card"><b>${n}</b><p style="margin:4px 0">${a}</p><p class="mut" style="margin:4px 0">Limite : ${l}</p><p style="margin:4px 0;color:var(--brand)"><b>Notre réponse :</b> ${r}</p></div>`).join('')}
  <h3>Réduire le temps d'écran</h3>
  <div class="card"><div>📍 Détection des descentes par GPS (onglet Ma journée)</div><div>🌑 Mode poche : écran noir, retour vocal et vibration</div>
    <div>⭐ Notes en fin de journée, en un clic par piste</div><div>🔊 Guidage audio du parcours</div><div>📵 Compteur de temps d'écran quotidien</div></div>
  <h3>Données</h3>
  <div class="card"><div class="mut">${st.pistes.length} pistes et ${st.lifts.length} remontées de l'Espace Alpe d'Huez, issues du flux officiel de la station (mise à jour du ${esc(st.updated)}). Aucune note, aucun vote, aucun coup de cœur n'est inventé : tout démarre à zéro.</div>
    <p class="mut" style="margin:8px 0 0">Chiffres annoncés par le site de l'Espace Alpe d'Huez : ${st.site.km} km, ${st.site.pistes} pistes (${st.site.colors.green} vertes, ${st.site.colors.blue} bleues, ${st.site.colors.red} rouges, ${st.site.colors.black} noires), de ${st.site.min} à ${st.site.max} m. Le détail du flux donne ${['green', 'blue', 'red', 'black'].map(c => st.pistes.filter(p => p.color === c).length).join(' / ')} : l'écart par couleur vient des données de la station.</p>
    <p class="mut" style="margin:8px 0 0">Réseau des pistes, remontées et chemins : © contributeurs OpenStreetMap (licence ODbL), rapproché des données officielles. Altitudes des jonctions : EU-DEM 25 m.</p>
    <button class="btn ghost" data-action="reset" style="margin-top:8px">Réinitialiser mes données</button></div>`;
}

/* ---------- Données du relais (ouverture, mesures de la station, attentes déclarées) ---------- */
const CFG = window.SKIP_CONFIG || {};
const liveUrl = () => CFG.liveUrl || (CFG.relay ? CFG.relay.replace(/\/$/, '') + '/live.json' : 'live.json');
let live = null, liveState = 'idle';   // live : { data, at, stale?, snapshot? }
const LIVE_TTL = 5 * 60000;
const hm = iso => iso ? new Date(iso).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }) : '';
const dm = iso => iso ? new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short' }) : '';
async function liveLoad(force) {
  liveState = 'loading';
  let c = null; try { c = JSON.parse(localStorage.getItem('skip.live')); } catch { /* ignore */ }
  if (!force && c && Date.now() - c.at < LIVE_TTL) { live = c; liveState = 'ok'; return; }
  try {
    const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 9000);
    const r = await fetch(liveUrl(), { signal: ctl.signal }); clearTimeout(tm);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json(); if (data.schema !== 1) throw new Error('schéma');
    live = { data, at: Date.now(), stale: !!data.stale }; try { localStorage.setItem('skip.live', JSON.stringify(live)); } catch { /* ignore */ }
  } catch {
    live = c ? { ...c, stale: true } : null;
    if (!live) { try { const d = await (await fetch('live-snapshot.json')).json(); live = { data: d, at: Date.now(), snapshot: true }; } catch { /* aucun */ } }
  }
  liveState = live ? 'ok' : 'none';
}
const liveAge = () => live ? Math.round((Date.now() - new Date(live.data.source.feedUpdated || live.data.source.fetchedAt).getTime()) / 60000) : null;
// Source affichée partout : nature de la donnée + heure de mise à jour du flux
const liveTag = () => !live ? 'Information indisponible' : `${live.snapshot ? 'Instantané d\'aperçu' : live.stale ? 'Dernière version enregistrée' : 'Flux officiel'} · maj ${dm(live.data.source.feedUpdated)} ${hm(live.data.source.feedUpdated)}`;
const seasonOpen = () => !!live?.data?.summary?.seasonOpen && !live.snapshot;
const liveItem = (kind, id) => live?.data?.[kind === 'lift' ? 'lifts' : 'pistes']?.find(x => x.id === id) || null;
const OPEN_STATES = ['open', 'delayed'];
const stateText = it => !it ? 'Information indisponible' : ({ open: 'Ouvert', delayed: 'Ouverture décalée', temp_closed: 'Fermeture momentanée', closed: 'Fermé', closed_today: 'Fermé jusqu\'à demain', off_season: 'Hors période d\'exploitation', unknown: 'Information indisponible' })[it.state] || it.status;
// Fermeture connue : appliquée aux itinéraires seulement quand le domaine est réellement en exploitation (sinon tout serait « fermé »)
const isClosed = (kind, id) => { if (!seasonOpen()) return false; const it = liveItem(kind, id); return !!it && !OPEN_STATES.includes(it.state); };
const openingLine = (kind, id) => { const it = liveItem(kind, id); return `<div class="mut" style="margin:6px 0">Ouverture : <b>${esc(stateText(it))}</b>${it?.hours ? ' · ' + esc(it.hours) : ''} · <span>${esc(liveTag())}</span></div>`; };
function stateChip(kind, id) {
  const it = seasonOpen() ? liveItem(kind, id) : null; if (!it) return '';
  return `<span class="badge" style="${OPEN_STATES.includes(it.state) ? 'background:#dff5e6;color:#12803a' : 'background:#ffdcd9;color:#b3261e'}">${esc(stateText(it))}</span>`;
}
function liveBanner() {
  if (!live) return '';
  const s = live.data.summary;
  return `<div class="warn" style="background:var(--brand2);color:var(--ink)">${seasonOpen() ? `🟢 ${s.liftsOpen} remontées sur ${s.liftsTotal} et ${s.pistesOpen} pistes sur ${s.pistesTotal} ouvertes.` : `Domaine fermé ou hors saison : ${s.liftsOpen} remontée(s) sur ${s.liftsTotal} ouverte(s). L'état d'ouverture n'est pas appliqué aux itinéraires.`}<br><span class="mut">${esc(liveTag())}</span></div>`;
}
const DIRS = { N: 'nord', NE: 'nord-est', E: 'est', SE: 'sud-est', S: 'sud', SO: 'sud-ouest', O: 'ouest', NO: 'nord-ouest' };
function stationWeatherHtml() {
  if (!live) return `<div class="card"><b>Mesures de la station</b><p class="mut" style="margin:6px 0 0">Information indisponible : aucun relais configuré ou injoignable (voir relay/README.md). Les prévisions ci-dessus viennent d'un modèle, pas des capteurs de la station.</p></div>`;
  const zs = live.data.weather.zones.filter(z => z.alt), idx = live.data.indices || {};
  return `<div class="card"><b>Mesures de la station</b> <span class="badge">${live.snapshot ? 'instantané' : 'mesure station'}</span>
    ${zs.map(z => `<div class="step"><div class="sp"><b>${esc(z.name)}</b> <span class="mut">${z.alt} m · maj ${esc(hm(z.updated))}</span><br>
      <span class="mut">${[z.tempC != null ? `${Math.round(z.tempC)} °C${z.feelsC != null && z.feelsC !== z.tempC ? ` (ressenti ${Math.round(z.feelsC)}°)` : ''}` : '', z.windKmh != null ? `vent ${Math.round(z.windKmh)} km/h${z.windDir ? ' ' + esc(DIRS[z.windDir] || z.windDir) : ''}${z.gustKmh ? `, rafales ${Math.round(z.gustKmh)}` : ''}` : '',
        z.freshSnowCm ? `neige fraîche ${z.freshSnowCm} cm` : '', z.snowQuality ? `neige : ${esc(z.snowQuality.toLowerCase())}` : '', z.isoZeroM ? `0 °C vers ${z.isoZeroM} m` : '', z.avalancheRisk ? `avalanche : ${esc(z.avalancheRisk.label.toLowerCase())} (${z.avalancheRisk.level}/${z.avalancheRisk.scale})` : ''].filter(Boolean).join(' · ')}</span></div></div>`).join('')}
    ${idx.skiabilite ? `<div class="mut" style="margin-top:6px">${esc(idx.skiabilite.label)} · ${esc(idx.ambiance?.label || '')}</div>` : ''}
    <div class="mut" style="margin-top:6px">${esc(liveTag())}. ${live.data.weather.forecast.some(f => !f.usable) ? 'Les prévisions J+2 et J+3 du flux sont vides (valeurs de remplissage) : elles ne sont pas affichées.' : ''}</div></div>`;
}

/* ---------- Météo (prévisions MET Norway, par altitude) ---------- */
const WX = { lat: 45.0917, lng: 6.07, alts: { base: 1860, top: 3000 }, ttl: 30 * 60000 };
let wxData = { base: null, top: null }, wxAlt = 'base', wxState = 'idle';
const wxUrl = a => `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${WX.lat}&lon=${WX.lng}&altitude=${WX.alts[a]}`;
const wxStore = { get: k => { try { return JSON.parse(localStorage.getItem('skip.wx.' + k)); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem('skip.wx.' + k, JSON.stringify(v)); } catch { /* ignore */ } } };
function symInfo(code) {
  const c = (code || '').replace(/_(day|night|polartwilight)$/, '');
  if (/thunder/.test(c)) return ['⛈', 'Orage'];
  if (/heavysnow/.test(c)) return ['❄️', 'Forte neige'];
  if (/snow/.test(c)) return ['🌨', /light/.test(c) ? 'Neige faible' : 'Neige'];
  if (/sleet/.test(c)) return ['🌨', 'Neige fondue'];
  if (/heavyrain/.test(c)) return ['🌧', 'Forte pluie'];
  if (/lightrain/.test(c)) return ['🌦', 'Pluie faible'];
  if (/rain/.test(c)) return ['🌧', 'Pluie'];
  if (/fog/.test(c)) return ['🌫', 'Brouillard'];
  return { clearsky: ['☀️', 'Ciel dégagé'], fair: ['🌤', 'Peu nuageux'], partlycloudy: ['⛅', 'Éclaircies'], cloudy: ['☁️', 'Nuageux'] }[c] || ['🌡', 'Variable'];
}
const parisDate = d => new Date(d).toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
const parisHour = d => +new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(d)).find(p => p.type === 'hour').value;
const skiSeason = () => [10, 11, 0, 1, 2, 3, 4].includes(new Date().getMonth());   // novembre à mai : les conseils neige n'ont de sens qu'en saison
function wxDaily(ts) {
  const days = {};
  ts.forEach(e => {
    const d = e.data, det = d.instant.details, k = parisDate(e.time), g = days[k] = days[k] || { date: k, t: [], wind: 0, precip: 0, snow: 0, sym: null, noon: 99 };
    g.t.push(det.air_temperature); g.wind = Math.max(g.wind, det.wind_speed * 3.6);
    const step = d.next_1_hours || d.next_6_hours, mm = step?.details?.precipitation_amount || 0;
    g.precip += mm; if (det.air_temperature <= 1) g.snow += mm;   // 1 mm d'eau ≈ 1 cm de neige fraîche
    const dist = Math.abs(parisHour(e.time) - 12), code = (d.next_6_hours || d.next_1_hours)?.summary?.symbol_code;
    if (code && dist < g.noon) { g.noon = dist; g.sym = code; }
  });
  return Object.values(days).map(g => ({ date: g.date, tmin: Math.round(Math.min(...g.t)), tmax: Math.round(Math.max(...g.t)), wind: Math.round(g.wind), precip: Math.round(g.precip * 10) / 10, snow: Math.round(g.snow), sym: g.sym }));
}
function wxHints(d) {
  const h = []; if (!skiSeason()) return h;
  if (d.wind >= 50) h.push('💨 Vent fort : remontées d\'altitude parfois fermées');
  if (d.snow >= 10) h.push('❄ Neige fraîche : prudence hors-piste, vérifie le bulletin d\'avalanche');
  if (d.tmax <= -12) h.push('🥶 Très froid : couvre-toi, attention aux gelures');
  if (d.tmin >= 2 && d.tmax >= 8) h.push('💧 Neige lourde ou transformée : skie plutôt le matin');
  if (d.precip >= 3 && d.snow < d.precip / 2) h.push('🌧 Pluie : visibilité et confort réduits');
  return h;
}
async function wxLoad(force) {
  wxState = 'loading';
  for (const a of ['base', 'top']) {
    const c = wxStore.get(a);
    if (!force && c && Date.now() - c.at < WX.ttl) { wxData[a] = c; continue; }
    try {
      const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 9000);
      const j = await (await fetch(wxUrl(a), { signal: ctl.signal })).json(); clearTimeout(tm);
      wxData[a] = { at: Date.now(), updated: j.properties.meta.updated_at, ts: j.properties.timeseries, live: true }; wxStore.set(a, wxData[a]);
    } catch { wxData[a] = c ? { ...c, stale: true } : null; }
  }
  if (!wxData.base && !wxData.top) {   // dernier recours : instantané fourni avec l'application (aperçu, démonstration)
    try { const snap = await (await fetch('meteo-snapshot.json')).json(); wxData = { base: { ...snap.base, snapshot: true }, top: { ...snap.top, snapshot: true } }; } catch { /* aucun */ }
  }
  wxState = wxData.base || wxData.top ? 'ok' : 'error';
  if (S.tab === 'weather') render();
}
function renderWeather() {
  if (wxState === 'idle') wxLoad(false);
  if (liveState === 'idle') liveLoad(false).then(() => { if (S.tab === 'weather' || S.tab === 'pistes') render(); });
  const alt = WX.alts[wxAlt], d = wxData[wxAlt];
  const seg = `<div class="seg" style="margin:6px 0 12px">${[['base', `Station ${WX.alts.base} m`], ['top', `Sommet ${WX.alts.top} m`]].map(([k, t]) => `<button class="${wxAlt === k ? 'on' : ''}" data-action="wxalt" data-k="${k}">${t}</button>`).join('')}</div>`;
  const links = `<p class="mut">Pour les conditions mesurées par la station et le risque d'avalanche, consulte la source officielle : <a href="https://skipass.alpedhuez.com/meteo-espace-alpe-dhuez/" target="_blank" rel="noopener noreferrer">météo Espace Alpe d'Huez ↗</a> · <a href="https://meteofrance.com/meteo-montagne" target="_blank" rel="noopener noreferrer">Météo-France montagne ↗</a>.</p>`;
  if (wxState === 'loading' || wxState === 'idle') return `<h2>Météo · Alpe d'Huez</h2>${seg}<p class="mut">Chargement des prévisions…</p>`;
  if (!d) return `<h2>Météo · Alpe d'Huez</h2>${seg}<div class="warn">Prévisions indisponibles : pas de réseau, ou service injoignable depuis cet appareil.</div><button class="btn sm" data-action="wxreload">Réessayer</button>${links}`;
  const days = wxDaily(d.ts), now = d.ts.find(e => new Date(e.time) >= Date.now() - 3600000) || d.ts[0], nd = now.data.instant.details;
  const [ic, txt] = symInfo((now.data.next_1_hours || now.data.next_6_hours)?.summary?.symbol_code), today = days.find(x => x.date === parisDate(Date.now())) || days[0];
  const hrs = d.ts.filter(e => new Date(e.time) >= Date.now() - 3600000 && e.data.next_1_hours).slice(0, 14);
  const label = dt => { const t = parisDate(Date.now()), tm = parisDate(Date.now() + DAY); return dt === t ? 'Aujourd\'hui' : dt === tm ? 'Demain' : new Date(dt + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }); };
  return `<h2>Météo · Alpe d'Huez</h2>${seg}
  <div class="card"><div class="row"><div style="font-size:46px;line-height:1">${ic}</div><div class="sp"><b style="font-size:26px">${Math.round(nd.air_temperature)} °C</b> <span class="mut">à ${alt} m</span><br><span class="mut">${esc(txt)} · vent ${Math.round(nd.wind_speed * 3.6)} km/h</span></div></div>
    <div class="mut" style="margin-top:6px">Aujourd'hui : ${today.tmin}° / ${today.tmax}° · précipitations ${String(today.precip).replace('.', ',')} mm${today.snow ? ` · neige ≈ ${today.snow} cm` : ''}</div>
    ${hrs.length ? `<div class="hrs">${hrs.map(e => `<div class="hr"><span class="mut">${String(parisHour(e.time)).padStart(2, '0')} h</span><span>${symInfo(e.data.next_1_hours.summary.symbol_code)[0]}</span><b>${Math.round(e.data.instant.details.air_temperature)}°</b></div>`).join('')}</div>` : ''}</div>
  <h3>Jour par jour</h3>
  <div class="card">${days.map(x => { const [i2, t2] = symInfo(x.sym), h = wxHints(x); return `<div class="step"><div style="font-size:26px;width:34px;text-align:center">${i2}</div><div class="sp"><b>${esc(label(x.date))}</b> <span class="mut">${esc(t2)}</span><br>
      <span class="mut">${x.tmin}° / ${x.tmax}° · vent max ${x.wind} km/h${x.precip ? ` · ${String(x.precip).replace('.', ',')} mm` : ''}${x.snow ? ` · ❄ ≈ ${x.snow} cm` : ''}</span>${h.length ? `<br><span class="fit hard" style="font-weight:600">${esc(h[0])}</span>` : ''}</div></div>`; }).join('')}</div>
  <p class="mut">Prévisions MET Norway (modèle météo public), calculées pour ${alt} m, mises à jour le ${new Date(d.updated).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}${d.snapshot ? ' (instantané d\'aperçu, pas en direct)' : d.stale ? ' (hors ligne : dernière version enregistrée)' : ''}. La neige est estimée (1 mm de pluie ≈ 1 cm de neige quand il fait moins de 1 °C) ; ce sont des prévisions, pas des mesures de la station.${skiSeason() ? '' : ' Hors saison de ski : les conseils neige et vent ne sont pas affichés.'}</p>
  ${stationWeatherHtml()}
  <button class="btn sm ghost" data-action="wxreload">↻ Actualiser</button>${links}`;
}

/* ---------- Invitations à noter (notifications) ---------- */
/* Principes : consentement explicite ; jamais pendant une descente ; une seule invitation par piste et par jour ; jamais pour une piste déjà notée ;
   plafond quotidien réglable ; la notation reste locale (aucun réseau nécessaire). Les notifications système passent par le service worker. */
const QUESTION = "Alors, cette piste, tu l'as trouvée difficile ?";
let rateCtx = null, bannerTimer = null, queuedBanner = null;
const notifSupported = () => 'Notification' in window && 'serviceWorker' in navigator;
function resetPro() { if (S.pro.d !== todayKey()) S.pro = { d: todayKey(), ids: [], n: 0, evening: false }; }
const unratedToday = () => [...new Set(logToday().filter(e => e.type === 'piste' && e.pick && !myVote(e.pick)).map(e => e.pick))];
const canPrompt = id => { resetPro(); return S.notif.enabled && !myVote(id) && !S.pro.ids.includes(id) && S.pro.n < S.notif.max && !Engine.descending(trk); };
async function enableNotif() {
  S.notif.enabled = true;
  if (notifSupported()) {
    let p = Notification.permission; if (p === 'default') p = await Notification.requestPermission();
    S.notif.sys = p === 'granted';
    toast(p === 'granted' ? 'Notifications activées.' : 'Autorisation non accordée : les invitations apparaîtront dans l\'appli, sans notification système.', 4500);
  } else { S.notif.sys = false; toast('Notifications système indisponibles sur cet appareil : invitations dans l\'appli uniquement.', 4500); }
  save(); render();
}
async function sysNotify(title, body, data, tag) {
  try { const reg = await navigator.serviceWorker.ready; await reg.showNotification(title, { body, tag, data, icon: 'icons/icon.svg', badge: 'icons/icon.svg', renotify: false }); return true; } catch { return false; }
}
function showBanner(b) {
  const el = $('#prompt'); clearTimeout(bannerTimer);
  el.innerHTML = `<div class="sp"><b>${esc(b.title)}</b><br><span class="mut">${esc(b.sub)}</span></div><button class="btn sm" data-action="${b.evening ? 'qevening' : 'qopen'}" data-id="${b.id || ''}" data-k="${b.k ?? ''}">${b.evening ? 'Voir' : 'Noter'}</button><button class="btn sm ghost" data-action="qlater" aria-label="Plus tard">✕</button>`;
  el.hidden = false; bannerTimer = setTimeout(() => el.hidden = true, 25000);
}
function deliver(b, sysData) {
  if (document.visibilityState === 'visible') return showBanner(b);
  if (S.notif.sys) sysNotify(b.title, b.sub, sysData, b.tag).then(ok => { if (!ok) queuedBanner = b; });
  else queuedBanner = b;   // affichée au retour dans l'appli
}
function promptRate(id, k) {
  if (!canPrompt(id)) return false;
  S.pro.ids.push(id); S.pro.n++; save();
  deliver({ title: QUESTION, sub: pisteOf(id).name, id, k, tag: 'rate-' + id }, { id, k });
  return true;
}
function eveningCheck() {
  resetPro();
  if (!S.notif.enabled || !S.notif.evening || S.pro.evening || Engine.descending(trk)) return;
  const [h, m] = S.notif.eveningTime.split(':').map(Number), now = new Date();
  if (now.getHours() * 60 + now.getMinutes() < h * 60 + m) return;
  const todo = unratedToday(); S.pro.evening = true; save();
  if (todo.length) deliver({ title: 'Fin de journée : tes pistes à noter', sub: `${todo.length} piste${todo.length > 1 ? 's' : ''} sans note, 2 secondes chacune`, evening: true, tag: 'evening' }, { evening: true });
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { if (queuedBanner) { showBanner(queuedBanner); queuedBanner = null; } eveningCheck(); } });

/* Fiche de notation rapide : ouverte directement depuis l'invitation, sans écran intermédiaire */
function openRate(id, k) { if (!pisteOf(id)) return; $('#prompt').hidden = true; rateCtx = { id, k: k === '' || k == null ? null : +k, correcting: false }; rateSheet(); }
function rateSheet() {
  const { id, k, correcting } = rateCtx, p = pisteOf(id), i = info(p), entry = k != null ? logToday()[k] : null, inDay = logToday().some(e => e.pick === id);
  const cands = (entry?.cands || []).filter(c => c !== id && pisteOf(c));
  openSheet(`<h2 style="margin:0 0 6px;font-size:19px">${QUESTION}</h2>
    <div class="row"><span class="sq ${p.color}" style="width:18px;height:18px"></span><b class="sp">${esc(p.name)}</b><span class="mut">piste ${colorName(p.color).toLowerCase()}</span></div>
    ${i.mine ? `<div class="mut" style="margin-top:4px">Déjà notée : ${i.mine}/10. Un tap pour corriger.</div>` : ''}
    <div class="rate" style="margin-top:10px">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<button style="background:${scoreColor(n)}" class="${i.mine === n ? 'on' : ''}" data-action="qrate" data-n="${n}" aria-label="Note ${n} sur 10">${n}</button>`).join('')}</div>
    <div class="row" style="justify-content:space-between"><span class="mut">très facile</span><span class="mut">très difficile</span></div>
    <div class="row" style="margin-top:12px"><button class="heart${i.liked ? ' on' : ''}" data-action="qheart">${i.liked ? '❤️ Coup de cœur' : '🤍 Coup de cœur'}</button>
      <button class="btn sec${inDay ? '' : ''}" data-action="qday">${inDay ? '✅ Dans ma journée' : '➕ Ajouter à ma journée'}</button></div>
    <div style="margin-top:10px"><button class="chip" data-action="qwrong">Ce n'est pas cette piste ?</button> <button class="chip" data-action="close">Terminé</button></div>
    ${correcting ? `<div class="mut" style="margin-top:10px">Quelle piste as-tu descendue ?</div>${cands.length ? `<div class="chips" style="margin-top:6px">${cands.map(c => `<button class="chip" data-action="qpick" data-id="${c}">${esc(pisteOf(c).name)}</button>`).join('')}</div>` : ''}
      <select class="f" id="qother" style="margin-top:8px"><option value="">Une autre piste…</option>${[...station().pistes].sort((a, b) => a.name.localeCompare(b.name)).map(x => `<option value="${x.id}">${esc(x.name)} (${colorName(x.color).toLowerCase()})</option>`).join('')}</select>` : ''}
    <p class="mut" style="margin-top:12px">Pas de commentaire à écrire. Ta note est enregistrée sur ton téléphone et améliore aussitôt la difficulté de la piste.</p>`);
}
function renderNotifCard() {
  const n = S.notif, perm = notifSupported() ? Notification.permission : 'unsupported';
  return `<div class="card"><b>🔔 Invitations à noter</b>
    <div class="mut" style="margin:4px 0 8px">« ${QUESTION} » : un tap ouvre la fiche, un tap enregistre ta note. Jamais pendant une descente, une seule invitation par piste et par jour, jamais pour une piste déjà notée.</div>
    <label class="chk"><input type="checkbox" data-bind="nenabled" ${n.enabled ? 'checked' : ''}> Me proposer de noter mes pistes</label>
    ${n.enabled ? `<label class="chk"><input type="checkbox" data-bind="nlift" ${n.lift ? 'checked' : ''}> Pendant la remontée (si elle est détectée)</label>
    <label class="chk"><input type="checkbox" data-bind="nevening" ${n.evening ? 'checked' : ''}> En fin de journée, pour les pistes non notées</label>
    ${n.evening ? `<div class="row" style="gap:8px"><label class="mut" for="neve">À partir de</label><input type="time" id="neve" value="${esc(n.eveningTime)}" style="width:auto"></div>` : ''}
    <div class="row" style="gap:8px;margin-top:6px"><label class="mut" for="nmax">Maximum par jour</label><select class="f" id="nmax" style="width:auto">${[1, 3, 5, 10].map(v => `<option value="${v}" ${n.max === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    <div class="mut" style="margin-top:8px">${perm === 'granted' ? 'Notifications système autorisées.' : perm === 'denied' ? 'Notifications système refusées par le navigateur : invitations dans l\'appli seulement.' : perm === 'unsupported' ? 'Notifications système indisponibles ici : invitations dans l\'appli seulement.' : 'Notifications système non encore autorisées.'}
      ${perm === 'default' ? '<button class="btn sm sec" data-action="nperm">Autoriser</button>' : ''}</div>
    <div class="row" style="margin-top:8px"><button class="btn sm ghost" data-action="ntest">Voir un exemple</button></div>` : ''}
    <details style="margin-top:10px"><summary class="mut">Ce qu'il faut pour la détection automatique</summary>
      <p class="mut">Autorisations : <b>notifications</b> et <b>position précise</b> (GPS, avec altitude). Sur le web, le téléphone suspend l'appli quand l'écran est verrouillé : la détection (et donc l'invitation « en remontée ») ne marche que <b>appli ouverte</b>, par exemple en mode poche avec l'écran maintenu allumé. L'invitation de fin de journée demande aussi que l'appli soit ouverte à l'heure choisie ; sinon elle s'affiche à ton retour. Pour être prévenu <b>appli fermée</b>, il faut des notifications poussées (serveur Web Push avec clés VAPID, voir relay/README.md) et, pour suivre ta position en arrière-plan, une appli native (Capacitor). Sur iPhone, installe d'abord l'appli sur l'écran d'accueil (iOS 16.4 minimum). Rien de tout cela n'est supposé actif : sans détection, ajoute tes pistes à la main ou cherche une piste ci-dessous.</p></details></div>
  <div class="card"><b>⭐ Noter une piste</b>
    <input type="search" id="qrs" placeholder="🔍 Nom de la piste" autocomplete="off" aria-label="Rechercher une piste à noter" style="margin:8px 0"><div id="qrres"></div></div>`;
}
const qrResults = () => { const q = norm($('#qrs')?.value || '').trim(); const l = q ? station().pistes.filter(p => norm(p.name).includes(q)).slice(0, 8) : []; return l.map(p => `<button class="piste" data-action="qopen" data-id="${p.id}"><span class="sq ${p.color}"></span><span class="sp"><b>${esc(p.name)}</b><br><span class="mut">${colorName(p.color).toLowerCase()}${myVote(p.id) ? ' · déjà notée ' + myVote(p.id).s + '/10' : ''}</span></span></button>`).join(''); };
function handleDeepLink(h) {
  const m = /^#?rate=([^&]+)/.exec(h || ''); if (m) { openRate(decodeURIComponent(m[1]), null); history.replaceState(null, '', location.pathname); return; }
  if (/^#?evening/.test(h || '')) { S.tab = 'day'; save(); render(); history.replaceState(null, '', location.pathname); }
}
window.addEventListener('hashchange', () => handleDeepLink(location.hash));
if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', ev => {
  const d = ev.data || {}; if (d.type === 'rate') openRate(d.id, d.k); else if (d.type === 'evening') { S.tab = 'day'; save(); render(); }
});

/* ---------- Guidage ---------- */
function advanceGuide() {
  if (!guide) return;
  guide.idx++;
  if (guide.idx < guide.steps.length) speak(stepText(guide.steps[guide.idx])); else speak('Parcours terminé. Bravo !');
  if (S.tab === 'route') render();
}

/* ---------- Rendu & événements ---------- */
function render() {
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === S.tab));
  $('#view').innerHTML = { pistes: renderPistes, route: renderRoute, weather: renderWeather, day: renderDay, meet: renderMeet, about: renderAbout }[S.tab]();
}
const updateList = () => { const l = $('#plist'); if (l) l.innerHTML = listHtml(); };

document.addEventListener('click', e => {
  const tab = e.target.closest('[data-tab]');
  if (tab) { S.tab = tab.dataset.tab; save(); render(); window.scrollTo(0, 0); return; }
  if (e.target.id === 'sheet') return closeSheet();
  const el = e.target.closest('[data-action]'); if (!el) return;
  const d = el.dataset, f = S.filt;
  switch (d.action) {
    case 'wxalt': wxAlt = d.k; render(); break;
    case 'wxreload': wxData = { base: null, top: null }; wxLoad(true); liveLoad(true).then(() => S.tab === 'weather' && render()); render(); break;
    case 'nperm': enableNotif(); break;
    case 'ntest': { const id = (station().pistes.find(p => !myVote(p.id)) || station().pistes[0]).id; deliver({ title: QUESTION, sub: pisteOf(id).name + ' (exemple)', id, k: null, tag: 'test' }, { id }); break; }
    case 'qopen': openRate(d.id, d.k); break;
    case 'qlater': $('#prompt').hidden = true; break;
    case 'qevening': $('#prompt').hidden = true; S.tab = 'day'; save(); render(); break;
    case 'qrate': { const before = info(pisteOf(rateCtx.id)).level; setVote(rateCtx.id, +d.n); toast(`Merci ! Difficulté de la piste : ${fmt1(before)} → ${fmt1(info(pisteOf(rateCtx.id)).level)}/10.`); rateSheet(); if (S.tab === 'pistes') updateList(); if (S.tab === 'day') render(); break; }
    case 'qheart': { const id = rateCtx.id; S.hearts = S.hearts.includes(id) ? S.hearts.filter(h => h !== id) : [...S.hearts, id]; save(); rateSheet(); break; }
    case 'qday': { const p = pisteOf(rateCtx.id); if (!logToday().some(e => e.pick === p.id)) addLog({ type: 'piste', cands: [p.id], altFrom: p.altFrom, altTo: p.altTo, t: Date.now(), manual: true }); rateSheet(); break; }
    case 'qwrong': rateCtx.correcting = !rateCtx.correcting; rateSheet(); break;
    case 'qpick': { const log = S.log[todayKey()]; if (rateCtx.k != null) { const e = logToday()[rateCtx.k]; if (e) { e.pick = d.id; save(); } } rateCtx.id = d.id; rateCtx.correcting = false; rateSheet(); break; }
    case 'sos': if (confirm('Appeler le 112 (urgences) ?')) location.href = 'tel:112'; break;
    case 'close': closeSheet(); break;
    case 'open': sheetPeriod = 0; showChars = false; pisteSheet(d.id); break;
    case 'openlift': liftSheet(d.id); break;
    case 'view': f.view = d.v; save(); render(); break;
    case 'allcolors': f.colors = []; save(); render(); break;
    case 'color': f.colors = f.colors.includes(d.c) ? f.colors.filter(c => c !== d.c) : [...f.colors, d.c]; save(); render(); break;
    case 'sort': f.sort = d.k; save(); render(); break;
    case 'filters': f.open = !f.open; save(); render(); break;
    case 'rate': { const before = info(pisteOf(d.id)).level; setVote(d.id, +d.n); const after = info(pisteOf(d.id)).level;
      toast(`Note enregistrée : ${d.n}/10. Difficulté de la piste : ${fmt1(before)} → ${fmt1(after)}/10.`); pisteSheet(d.id); updateList(); break; }
    case 'vtag': { const m = myVote(d.id), t = TAGS[+d.t]; setVote(d.id, m.s, m.tags?.includes(t) ? m.tags.filter(x => x !== t) : [...(m.tags || []), t]); pisteSheet(d.id); break; }
    case 'unrate': S.vlog = S.vlog.filter(v => v.id !== d.id); save(); pisteSheet(d.id); updateList(); break;
    case 'period': sheetPeriod = +d.d; pisteSheet(sheetId); break;
    case 'chars': showChars = !showChars; pisteSheet(sheetId); break;
    case 'mine': f.mine = !f.mine; save(); render(); break;
    case 'heart': S.hearts = S.hearts.includes(d.id) ? S.hearts.filter(h => h !== d.id) : [...S.hearts, d.id]; save(); pisteSheet(d.id); render(); break;
    case 'skied': addLog({ type: 'piste', cands: [d.id], altFrom: pisteOf(d.id).altFrom, altTo: pisteOf(d.id).altTo, t: Date.now(), manual: true }); toast('Ajoutée à ta journée'); break;
    case 'rf': S.rf[d.k] = d.k === 'budget' ? +d.v : d.v; save(); render(); break;
    case 'rlevel': { S.rf[d.k] = +d.v; if (S.rf.lo > S.rf.hi) { if (d.k === 'lo') S.rf.hi = S.rf.lo; else S.rf.lo = S.rf.hi; } save(); render(); break; }
    case 'rcolor': S.rf.colors = S.rf.colors.includes(d.c) ? S.rf.colors.filter(c => c !== d.c) : [...S.rf.colors, d.c]; save(); render(); break;
    case 'plan': generate(!!d.next); break;
    case 'openstep': { const s = plan.steps[+d.i]; if (s.kind === 'piste') pisteSheet(s.o); else liftSheet(s.o); break; }
    case 'download': S.route = { stationId: S.station, plan, savedAt: Date.now() }; save(); toast('Itinéraire téléchargé : utilisable sans réseau.'); render(); break;
    case 'loadsaved': plan = S.route.plan; render(); break;
    case 'delsaved': S.route = null; save(); render(); break;
    case 'gstart': guide = { steps: plan.steps, idx: 0 }; startTracking(); speak(stepText(guide.steps[0])); render(); break;
    case 'gnext': advanceGuide(); break;
    case 'gstop': guide = null; render(); break;
    case 'track': if (watchId !== null) stopTracking(); else startTracking(); render(); break;
    case 'pocket': enterPocket(); break;
    case 'resolve': { const l = S.log[todayKey()].filter(x => x.stationId === S.station)[+d.k]; l.pick = d.id; save(); render(); break; }
    case 'pend': pending[d.id] = +d.n; render(); break;
    case 'sendvotes': Object.entries(pending).forEach(([id, n]) => setVote(id, n)); toast(`${Object.keys(pending).length} note(s) enregistrée(s). Merci !`); pending = {}; save(); render(); break;
    case 'want': S.profile.wants = S.profile.wants.includes(d.w) ? S.profile.wants.filter(w => w !== d.w) : [...S.profile.wants, d.w]; save(); render(); break;
    case 'status': S.profile.status = d.s; save(); render(); break;
    case 'disc': S.profile.discipline = d.k; save(); render(); break;
    case 'netedit': netEdit = d.k; render(); break;
    case 'netsave': { const h = ($('#nethandle').value || '').trim().replace(/^@/, '');
      if (!HANDLE.test(h)) { toast('Identifiant invalide : lettres, chiffres, point, tiret.'); break; }
      S.profile.socials[d.k] = h; netEdit = null; save(); render(); break; }
    case 'netdel': delete S.profile.socials[d.k]; save(); render(); break;
    case 'share': openShare(d.k); break;
    case 'copy': { const t = $('#sharetxt'); t.select(); (navigator.clipboard ? navigator.clipboard.writeText(t.value) : Promise.reject()).then(() => toast('Message copié.'), () => toast('Sélectionne le texte et copie-le.')); break; }
    case 'import': { const e2 = importFriend($('#importtxt').value); if (e2) toast(e2, 4500); else { toast('Skieur ajouté !'); render(); } break; }
    case 'fdel': delete S.friends[d.k]; save(); render(); break;
    case 'fhearts': { const fr = S.friends[d.k]; S.hearts = [...new Set([...S.hearts, ...fr.h.filter(id => pisteOf(id))])]; save(); toast('Coups de cœur ajoutés.'); render(); break; }
    case 'froute': { const fr = S.friends[d.k]; S.rf = { ...S.rf, ...fr.r }; S.tab = 'route'; generateAt(fr.r.variant || 0); toast('Itinéraire de ' + fr.n + ' chargé.'); break; }
    case 'send': { const i = $('#chatin'), v = i.value.trim(); if (!v) break;
      (S.chat[chatKey()] = S.chat[chatKey()] || []).push({ who: S.profile.pseudo || 'Skieur', lvl: S.level, status: S.profile.status, t: hhmm(Date.now()), text: v, me: true }); save(); render(); break; }
    case 'reset': if (confirm('Effacer toutes tes données SKIP ?')) { localStorage.removeItem(KEY); location.reload(); } break;
  }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'q') { S.filt.q = t.value; updateList(); }
  else if (t.id === 'qrs') { $('#qrres').innerHTML = qrResults(); }
  else if (t.dataset.range === 'level') { S.level = +t.value; $('#lvl').textContent = t.value; save(); updateList(); }
  else if (t.dataset.range === 'level2') { S.level = +t.value; save(); }
});
document.addEventListener('change', e => {
  const t = e.target, b = t.dataset.bind;
  if (b === 'fit') { S.filt.fit = t.checked; save(); updateList(); }
  else if (b === 'sector') { S.filt.sector = t.value; save(); updateList(); }
  else if (b === 'rstart') { S.rf.start = t.value; save(); }
  else if (b === 'rend') { S.rf.end = t.value; save(); }
  else if (b === 'rwalk') { S.rf.walk = t.checked; save(); }
  else if (b === 'audio') { S.audio = t.checked; save(); }
  else if (b === 'nenabled') { if (t.checked) enableNotif(); else { S.notif.enabled = false; save(); render(); } }
  else if (b === 'nlift') { S.notif.lift = t.checked; save(); }
  else if (b === 'nevening') { S.notif.evening = t.checked; save(); render(); }
  else if (t.id === 'neve') { S.notif.eveningTime = t.value || '17:30'; S.pro.evening = false; save(); }
  else if (t.id === 'nmax') { S.notif.max = +t.value; save(); }
  else if (t.id === 'qother' && t.value) { rateCtx.id = t.value; rateCtx.k = null; rateCtx.correcting = false; rateSheet(); }
  else if (t.id === 'pseudo') { S.profile.pseudo = t.value.trim().slice(0, 30); save(); }
  else if (t.dataset.range === 'level2') { render(); }
  else if (t.id === 'manual' && t.value) { const p = pisteOf(t.value); addLog({ type: 'piste', cands: [p.id], altFrom: p.altFrom, altTo: p.altTo, t: Date.now(), manual: true }); render(); }
  else if (t.id === 'simsel' && t.value) { simulateDescent(t.value); }
});
$('#station').addEventListener('change', e => { S.station = e.target.value; guide = null; pending = {}; trk = Engine.newTracker(); plan = null; save(); render(); });
(() => { let tm; const p = $('#pocket'), go = () => { tm = setTimeout(exitPocket, 1000); }, no = () => clearTimeout(tm);
  p.addEventListener('pointerdown', go); p.addEventListener('pointerup', no); p.addEventListener('pointerleave', no); })();

/* ---------- Réseau, temps d'écran, démarrage ---------- */
const netState = () => { $('#net').hidden = navigator.onLine; };
window.addEventListener('online', netState); window.addEventListener('offline', netState);
setInterval(() => { if (document.visibilityState === 'visible' && $('#pocket').hidden) { const k = todayKey(); S.screen[k] = (S.screen[k] || 0) + 1; if (S.screen[k] % 10 === 0) save(); } }, 1000);

$('#station').innerHTML = Object.values(DATA.stations).map(s => `<option value="${s.id}" ${s.id === S.station ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
render(); netState(); resetPro(); handleDeepLink(location.hash); eveningCheck(); setInterval(eveningCheck, 60000);
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
