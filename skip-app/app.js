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
  station: 'alpe', tab: 'pistes', level: 5, levelSet: false, audio: true, voice: { name: '', rate: 0.95, volume: 1 },
  profile: { pseudo: '', discipline: 'ski', wants: [], status: 'slopes', slots: [], zone: '', socials: {} },
  intent: null, me: null, invites: { sent: [], recv: [] },
  votes: {}, vlog: [], hearts: [], log: {}, days: {}, outing: null, route: null, chat: {}, screen: {}, friends: {},
  filt: { colors: [], q: '', sector: '', sort: 'color', fit: false, open: false, view: 'pistes', mine: false },
  waits: [], waitMargin: 0, notif: { enabled: false, sys: false, lift: true, evening: true, eveningTime: '17:30', max: 3 }, pro: { d: '', ids: [], n: 0, evening: false },
  rf: { start: '', end: '', budget: 120, speed: 'medium', mode: 'profile', lo: 2, hi: 6, scale: 10, colors: ['green', 'blue', 'red'], walk: true, variant: 0 }
});
let S = (() => { try { return Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { return defaults(); } })();
S.voice = { ...defaults().voice, ...S.voice }; S.invites = { sent: [], recv: [], ...(S.invites || {}) }; if (!S.days) S.days = {}; S.notif = { ...defaults().notif, ...S.notif }; S.profile = { ...defaults().profile, ...S.profile }; S.filt = { ...defaults().filt, ...S.filt }; S.rf = { ...defaults().rf, ...S.rf };
const savedRf = (() => { try { return JSON.parse(localStorage.getItem(KEY) || '{}').rf || null; } catch { return null; } })();
if (savedRf && savedRf.scale !== 10 && savedRf.lo !== undefined) {   // ancien réglage de difficulté sur 5 : conversion explicite, annoncée à l'utilisateur (les notes de pistes étaient déjà sur 10)
  const [a, b] = Engine.levelRange(Math.min(5, Math.max(1, Math.round(savedRf.lo) || 2)), Math.min(5, Math.max(1, Math.round(savedRf.hi) || 3)));
  S.scaleNotice = { from: `${savedRf.lo} à ${savedRf.hi}`, to: `${a} à ${b}` }; S.rf.lo = a; S.rf.hi = b; S.rf.scale = 10; delete S.rf.tmp;
}
if (!S.levelSet && S.level !== 5) S.levelSet = true;   // un niveau déjà modifié par l'utilisateur compte comme renseigné
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
  : `<div class="score${big ? ' big' : ''}" style="background:${scoreColor(i.global)}">${fmt1(i.global)}<small>${i.n} avis</small></div>`;
const levelText = i => i.global == null ? `Difficulté estimée : ${fmt1(i.est)}/10` : `Difficulté : ${fmt1(i.global)}/10 · ${i.n} vote${i.n > 1 ? 's' : ''}`;

let guide = null, pending = {}, netEdit = null, plan = null, planMsg = '', sheetPeriod = 0, showChars = false, sheetId = null;
const NET = typeof GRAPH !== 'undefined' ? Engine.buildNet(GRAPH) : null;
let trk = Engine.newTracker(), wakeLock = null, altWarned = false;

function toast(msg, ms = 3200) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, ms);
}
function speak(text) {
  if (S.audio) Voice.say(text, S.voice, 'speechSynthesis' in window ? speechSynthesis.getVoices() : [], navigator.onLine);
  if (navigator.vibrate) navigator.vibrate(80);
}
function openSheet(html) {
  const s = $('#sheet'), top = s.hidden ? 0 : s.querySelector('.in')?.scrollTop || 0;
  s.innerHTML = `<div class="in"><button class="x" data-action="close" aria-label="Fermer">✕</button>${html}</div>`; s.hidden = false;
  s.querySelector('.in').scrollTop = top;
}
function closeSheet() { const was = sheetKind; $('#sheet').hidden = true; sheetId = null; sheetKind = ''; if (was === 'settings') render(); }

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
    <span class="sq ${p.color}" title="Piste ${colorName(p.color).toLowerCase()}"></span>
    <span class="sp"><b>${esc(p.name)}</b><br><span class="mut">${[kmText(p.km), alts(p)].filter(Boolean).join(' · ')}</span> ${stateChip('piste', p.id)}${i.fit.key === 'hard' ? ' <span class="fit hard">⚠ trop dur</span>' : ''}</span>
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
  if (!l.length) { const f = S.filt, what = lifts ? 'remontée' : f.colors.length ? 'piste ' + colorName(f.colors[0]).toLowerCase() : 'piste';
    return `<div class="card"><p style="margin:0 0 8px"><b>Aucune ${what} ne correspond.</b></p><p class="mut" style="margin:0 0 8px">${f.q ? `Recherche « ${esc(f.q)} ». ` : ''}${f.sector ? 'Un secteur est sélectionné. ' : ''}${f.mine || f.fit ? 'Le filtre « pour moi » masque les pistes trop dures. ' : ''}Retire un filtre pour voir plus de pistes.</p><button class="btn sm" data-action="clearfilters">Retirer les filtres</button></div>`; }
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
    <button class="chip${f.open ? ' on' : ''}" data-action="filters">Trier</button></div>`}
  ${!lifts && f.colors.length ? `<div class="row" style="margin:-4px 0 10px;gap:8px"><span class="mut">Filtre : pistes <b>${colorName(f.colors[0]).toLowerCase()}s</b> · ${filteredPistes().length} résultat${filteredPistes().length > 1 ? 's' : ''}</span><button class="chip" data-action="allcolors">✕ Retirer</button></div>` : ''}
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
  const tags = myVote(id)?.tags || [], inDay = logToday().some(e => e.pick === id);
  openSheet(`<div class="row"><span class="sq ${p.color}" style="width:22px;height:22px"></span><h2 style="margin:0">${esc(p.name)}</h2></div>
    <div class="mut">Piste ${colorName(p.color).toLowerCase()} (couleur officielle) · ${[kmText(p.km), alts(p)].filter(Boolean).join(' · ')}</div>
    <div class="row" style="margin:10px 0">${scoreBubble(i, true)}<div><b>${i.global == null ? `Difficulté estimée ${fmt1(i.est)}/10` : `Difficulté ressentie ${fmt1(i.global)}/10`}</b><br>
      <span class="mut">${i.global == null ? 'Aucun vote pour l\'instant' : Engine.reliability(i.n).text}</span></div></div>
    ${i.fit.key === 'hard' ? '<div class="warn">⚠ Cette piste est au-dessus de ton niveau. Choisis plutôt une piste plus facile.</div>' : ''}
    ${tipsFor(p, i)[0]?.startsWith('⚠') ? `<div class="warn">${esc(tipsFor(p, i)[0])}</div>` : ''}
    <div class="mut" style="margin-top:6px">${i.mine ? 'Ta note : <b>' + i.mine + '/10</b>' : 'Ta note'} · 1 très facile, 10 très difficile</div>
    <div class="rate" data-rate="${id}">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<button style="background:${scoreColor(n)}" class="${i.mine === n ? 'on' : ''}" data-action="rate" data-id="${id}" data-n="${n}" aria-label="Note ${n} sur 10">${n}</button>`).join('')}</div>
    <div class="row" style="gap:8px"><button class="heart${i.liked ? ' on' : ''}" data-action="heart" data-id="${id}">${i.liked ? '❤️ Coup de cœur' : '🤍 Coup de cœur'}</button><button class="btn sec${inDay ? ' on' : ''}" data-action="skied" data-id="${id}">${inDay ? '✓ Dans ma journée' : '➕ Ma journée'}</button></div>
    ${i.mine ? `<details style="margin-top:12px"><summary class="mut">Conditions aujourd'hui (facultatif)</summary><div class="chips" style="margin:6px 0">${TAGS.map((t, k) => `<button class="chip${tags.includes(t) ? ' on' : ''}" data-action="vtag" data-id="${id}" data-t="${k}">${t}</button>`).join('')}</div>
      <button class="chip" data-action="unrate" data-id="${id}">Retirer ma note</button></details>` : ''}
    <details style="margin-top:10px"><summary class="mut">Avis des skieurs par période</summary><div class="row" style="margin:8px 0 4px;gap:6px;flex-wrap:wrap">${PERIODS.map(([d, t]) => `<button class="chip pchip${sheetPeriod === d ? ' on' : ''}" data-action="period" data-d="${d}">${t}</button>`).join('')}</div>
      <div>${periodLine(id, i)}</div></details>
    <details style="margin-top:10px" ${showChars ? 'open' : ''}><summary class="mut" data-action="chars">Caractéristiques et ouverture</summary><div style="margin-top:8px">${openingLine('piste', id)}${charsHtml(p, i)}</div></details>`);
}
function liftSheet(id) {
  const l = liftOf(id), cell = (k, v) => v ? `<div>${k}<b>${esc(v)}</b></div>` : '';
  openSheet(`<div class="row"><span class="ico">${LIFT_ICON[l.type] || '🚡'}</span><h2 style="margin:0">${esc(l.name)}</h2></div><div class="mut">${esc(l.type)}</div>
    ${openingLine('lift', id)}<div class="data" style="margin-top:12px">${cell('Durée du trajet', l.min ? Math.round(l.min) + ' min' : '')}${cell('Altitudes', alts(l))}${cell('Dénivelé', l.denivele ? l.denivele + ' m' : l.altFrom && l.altTo ? l.altTo - l.altFrom + ' m' : '')}
      ${cell('Horaires', l.hours)}${cell('Débit maximum', l.debit ? l.debit + ' pers/h' : '')}${cell('Secteur', l.sectors.map(secName).join(' ; '))}</div>
    <h3>Temps d'attente</h3>
    <div>${esc(waitText(waitFor(id)))}</div>
    <div class="mut" style="margin-top:4px">Moyenne habituelle (vacances scolaires, hors vacances, heure) : ${waitHist?.lifts[id] ? 'voir ci-dessus (' + esc(waitHist.source || '') + ')' : 'information indisponible, aucune statistique publique trouvée pour cette remontée.'}</div>
    ${waitReportHtml(id)}
    <div class="mut" style="margin-top:10px">Source : flux officiel de l'Espace Alpe d'Huez. Les informations manquantes ne sont pas fournies.</div>
`);
}

/* ---------- Temps d'attente aux remontées ---------- */
/* Quatre natures de données, toujours distinguées à l'écran :
   mesure de l'exploitant (flux officiel, si renseignée) · signalement de skieurs (< 30 min) · moyenne historique · estimation générique choisie par l'utilisateur.
   Sinon : « information indisponible ». Aucune valeur n'est inventée. */
const WAIT_BUCKETS = [[1, 'moins de 2 min'], [3.5, '2 à 5 min'], [7.5, '5 à 10 min'], [15, '10 à 20 min'], [25, 'plus de 20 min']];
const median = a => { const x = [...a].sort((p, q) => p - q), m = x.length >> 1; return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2; };
const ageMin = t => Math.max(0, Math.round((Date.now() - t) / 60000));
let waitHist = null;   // waits-history.json : moyennes historiques fournies par l'exploitant (aucune statistique publique trouvée à ce jour)
async function loadWaitHistory() { try { const j = await (await fetch('waits-history.json')).json(); if (j && j.lifts) waitHist = j; } catch { /* fichier absent : normal */ } }
function waitReports(id) {
  const out = S.waits.filter(w => w.id === id).map(w => ({ m: w.m, t: w.t, d: todayKey() }));
  Object.values(S.friends).forEach(f => (f.w || []).forEach(w => { if (w[0] === id) out.push({ m: w[1], t: w[2] }); }));
  return out;
}
function waitFor(id) {
  const li = liveItem('lift', id);
  if (li && li.waitMin != null) return { min: li.waitMin, src: 'live', fresh: !live.snapshot && !live.stale && liveAge() <= 30, at: live.data.source.feedUpdated };
  const all = waitReports(id), rec = all.filter(w => Date.now() - w.t < 30 * 60000);
  if (rec.length) return { min: Math.round(median(rec.map(w => w.m))), src: 'report', n: rec.length, at: Math.max(...rec.map(w => w.t)) };
  if (waitHist?.lifts[id]) {   // moyenne historique fournie : période (vacances / hors vacances) et créneau horaire
    const day = new Date().toISOString().slice(0, 10), hol = (waitHist.holidays || []).some(h => day >= h.from && day <= h.to), tab = waitHist.lifts[id][hol ? 'holiday' : 'offpeak'] || {};
    const hr = new Date().getHours(), slot = Object.keys(tab).find(k => { const [a, b] = k.split('-').map(Number); return hr >= a && hr < b; });
    if (slot) return { min: tab[slot], src: 'history', period: hol ? 'vacances scolaires' : 'hors vacances', slot, source: waitHist.source };
  }
  const hr = new Date().getHours(), same = all.filter(w => Math.abs(new Date(w.t).getHours() - hr) <= 1 && Date.now() - w.t >= 30 * 60000);
  if (same.length >= 3 && new Set(same.map(w => new Date(w.t).toDateString())).size >= 2) return { min: Math.round(median(same.map(w => w.m))), src: 'history', local: true, n: same.length };
  if (S.waitMargin > 0) return { min: S.waitMargin, src: 'estimate' };
  return null;
}
const waitText = w => !w ? 'Attente : information indisponible (non incluse)'
  : w.src === 'live' ? `Attente : ${w.min} min · ${w.fresh ? 'mesure en temps réel' : 'dernière valeur'} de l'exploitant (maj ${hm(w.at)})`
  : w.src === 'report' ? `Attente : ≈ ${w.min} min · signalée par ${w.n} skieur${w.n > 1 ? 's' : ''}, il y a ${ageMin(w.at)} min (signalement, pas une mesure)`
  : w.src === 'history' ? (w.local ? `Attente habituelle : ≈ ${w.min} min · moyenne de ${w.n} signalements à cette heure (collecte locale)` : `Attente habituelle : ≈ ${w.min} min · moyenne historique (${w.period}, ${w.slot} h) · ${esc(w.source || '')}`)
  : `Attente : ≈ ${w.min} min · estimation générique réglée par toi, pas une mesure`;
const waitOf = e => e.o && e.k === 'lift' ? waitFor(e.o) : null;
function waitReportHtml(id) {
  return `<div class="mut" style="margin-top:6px">Signaler l'attente actuelle (aide les autres skieurs) :</div><div class="chips" style="margin-top:4px">${WAIT_BUCKETS.map(([m, t]) => `<button class="chip" data-action="wreport" data-id="${id}" data-m="${m}">${t}</button>`).join('')}</div>`;
}
const wxToday = () => { const d = wxData.top; if (!d) return null; const days = wxDaily(d.ts), t = days.find(x => x.date === parisDate(Date.now())) || days[0]; return t ? { wind: t.wind } : null; };

/* ---------- Préférences et explications d'un itinéraire ---------- */
const WIND_HIGH = 50;   // km/h en altitude : seuil à partir duquel on évite les zones hautes
function routeCtx(extra) { const w = wxToday(); return { wind: w ? w.wind : null, windHigh: !!w && w.wind >= WIND_HIGH, heart: 0.6, ...extra }; }
function prefOf(ctx, hiNote) {
  return e => {
    let v = 0; const p = e.o && pisteOf(e.o);
    if (e.k === 'piste' && p) {
      if (S.hearts.includes(p.id)) v += ctx.heart;
      const mv = myVote(p.id); if (mv && hiNote && mv.s > hiNote + 1) v -= 1.5;
      if ((agg(p.id, 3).tags['Dure / verglacée'] || 0) >= 2) v -= 1.5;
    }
    if (ctx.windHigh && Math.max(NET.nodes[e.a].alt, NET.nodes[e.b].alt) >= 2700) v -= e.k === 'lift' ? 3 : 1.5;
    return v;
  };
}
const fmtApprox = m => '≈ ' + fmtMin(Math.round(m / 5) * 5);
function explain(pl, ctx) {
  const why = [], lim = [], o = pl.opt, t = pl.times, ps = pl.steps.filter(x => x.kind === 'piste' && x.o && pisteOf(x.o));
  if (o.mode === 'felt') why.push(`Les pistes sont choisies pour une difficulté de ${fmt1(o.lo)} à ${fmt1(o.hi)} sur 10 (${bandOf(o.lo)} à ${bandOf(o.hi)}), d'après les notes des skieurs (complétées par la couleur officielle et la pente quand il y en a peu). Ton niveau : ${S.level}/10.`);
  else why.push(`Elle respecte les couleurs choisies (jamais plus difficile que ${colorName(['black', 'red', 'blue', 'green'].find(c => o.colors.includes(c)) || 'green').toLowerCase()}).`);
  if (o.profile) why.unshift(`Calculée avec ton profil${o.profile.adjusted ? ' (ajusté pour ce trajet, profil inchangé)' : ''} : ${o.profile.used.join(' ; ')}.${o.profile.ignored.length ? ' Non pris en compte : ' + o.profile.ignored.join(', ') + '.' : ''}`);
  const hearts = [...new Set(ps.filter(x => S.hearts.includes(x.o)).map(x => pisteOf(x.o).name))];
  if (hearts.length) why.push(`Elle passe par ${hearts.length} de tes coups de cœur : ${hearts.slice(0, 4).join(', ')}.`);
  if (t.waitKnown) { const srcs = [...new Set(pl.steps.filter(x => x.wait).map(x => ({ live: 'exploitant', report: 'signalements', history: 'moyenne historique', estimate: 'estimation générique' })[x.wait.src]))]; why.push(`Les attentes connues sont prises en compte pour ${t.waitKnown} remontée${t.waitKnown > 1 ? 's' : ''} sur ${t.lifts} (${srcs.join(', ')}) : elle évite les remontées les plus lentes.`); }
  else lim.push(`Attentes : information indisponible pour ces ${t.lifts} remontées, non incluses dans la durée (voir « Temps d'attente »).`);
  if (seasonOpen()) { why.push(`Seules les remontées et pistes ouvertes sont utilisées (flux officiel, ${esc(liveTag())}).`); if (liveAge() > 60) lim.push(`Les données d'ouverture ont ${Math.round(liveAge() / 60)} h : à vérifier avant de partir.`); }
  else lim.push(live ? 'Ouverture : domaine fermé ou hors saison, l\'état d\'ouverture n\'est pas appliqué.' : 'Ouverture : information indisponible.');
  if (ctx.wind != null) why.push(ctx.windHigh ? `Vent fort annoncé en altitude (${ctx.wind} km/h) : les zones au-dessus de 2 700 m sont évitées.` : `Météo consultée (vent maximal ${ctx.wind} km/h en altitude) : pas de contrainte particulière.`);
  else lim.push('Météo : prévisions non chargées, non prises en compte.');
  const ice = ps.filter(x => (agg(x.o, 3).tags['Dure / verglacée'] || 0) >= 2); if (ice.length) lim.push(`Neige dure ou verglacée signalée sur ${ice.map(x => pisteOf(x.o).name).slice(0, 3).join(', ')} ces 3 derniers jours.`);
  why.push(`Durée : ${fmtApprox(pl.total)} pour ${fmtMin(o.budget)} demandées.`);
  return { why, lim };
}
function explainHtml(pl) {
  const x = pl.reasons || explain(pl, routeCtx());
  return `<details open style="margin-top:10px"><summary><b>Pourquoi cet itinéraire ?</b></summary><ul style="margin:6px 0 0;padding-left:18px">${x.why.map(w => `<li>${esc(w)}</li>`).join('')}</ul>
    ${x.lim.length ? `<div class="warn" style="margin-top:8px"><b>Limites</b><ul style="margin:4px 0 0;padding-left:18px">${x.lim.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}</details>`;
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
function feltLine(o) {
  const p = o && pisteOf(o); if (!p) return 'Piste non officielle : difficulté inconnue';
  const i = info(p), rel = Engine.reliability(i.n);
  return i.global == null ? `Difficulté estimée ≈ ${fmt1(i.est)}/10 · ${rel.text}` : `Difficulté ${rel.key === 'low' ? '≈ ' : ''}${fmt1(i.global)}/10 · ${rel.text}`;
}
/* Consignes d'étape : liées au parcours exact. Un arrêt intermédiaire n'est mentionné que s'il apparaît dans le réseau cartographié pour CETTE remontée. */
function guidance(pl, i) {
  const s = pl.steps[i], nx = pl.steps[i + 1], out = [];
  if (s.kind === 'lift') {
    out.push(`Prends « ${s.name} » (${liftType(s).toLowerCase()}). Descends à : ${s.toName}${s.altTo ? ` (${s.altTo} m)` : ''}.`);
    if (s.viaNames?.length) out.push(`Cette remontée passe par ${s.viaNames.length > 1 ? s.viaNames.length + ' stations intermédiaires' : 'une station intermédiaire'} : ${s.viaNames.join(', ')}. Vérifie sur place, avec les panneaux, s'il faut rester dans la cabine ou changer de remontée avant ${s.toName}.`);
  } else if (s.kind === 'piste') out.push(`Descends « ${stepName(s)} » (piste ${colorName(s.color).toLowerCase()}) jusqu'à : ${s.toName}.`);
  else if (s.kind === 'walk') out.push(`À pied, en chaussures de ski, sur ${mText(s.m)} jusqu'à : ${s.toName}.`);
  else out.push(`Suis la liaison à ski jusqu'à : ${s.toName}.`);
  if (nx) out.push(`Ensuite : ${nx.kind === 'lift' ? `prends « ${nx.name} »` : nx.kind === 'piste' ? `descends « ${stepName(nx)} »` : nx.kind === 'walk' ? `marche ${mText(nx.m)}` : 'liaison à ski'}.`);
  return out;
}
function stepTimes(s) {
  if (s.kind === 'lift') return `Trajet : ${s.rideMin} min (durée officielle)<br>${esc(waitText(s.wait))}`;
  if (s.kind === 'piste') return `Descente : ≈ ${s.min} min (estimée d'après la longueur) · ${mText(s.m)}`;
  return `${s.kind === 'walk' ? 'Marche' : 'Liaison'} : ≈ ${s.min} min (estimée) · ${mText(s.m)}`;
}
function stepsHtml(pl) {
  return `<div id="stepslist">` + pl.steps.map((s, i) => {
    const col = s.kind === 'piste' ? `var(--${s.color})` : s.kind === 'lift' ? '#3d4660' : '#a0702a';
    const head = s.kind === 'lift' ? `🚡 ${esc(liftType(s))} · ${esc(s.name)}` : s.kind === 'piste' ? `Piste ${colorName(s.color).toLowerCase()} · ${esc(stepName(s))}` : s.kind === 'walk' ? '🚶 À pied (chaussures de ski)' : '↝ Liaison à ski';
    const info = (s.o && (s.kind === 'piste' ? pisteOf(s.o) : liftOf(s.o))) ? `<button class="btn sm ghost" data-action="openstep" data-i="${i}" aria-label="Détails">ℹ︎</button>` : '';
    return `<div class="step${selStep === i ? ' sel' : ''}" data-action="selstep" data-i="${i}"><div class="num" style="background:${col}">${i + 1}</div><div class="sp"><b>${head}</b>
      ${s.kind === 'piste' ? `<span class="mut" style="display:block"><span class="sq ${s.color}" style="display:inline-block;vertical-align:-2px"></span> Couleur officielle : ${colorName(s.color).toLowerCase()} · ${esc(feltLine(s.o))}</span>` : ''}
      <span class="mut" style="display:block">${stepTimes(s)}</span>
      ${s.kind === 'lift' && s.o ? `<span class="mut" style="display:block">${esc(stateText(liveItem('lift', s.o)))}${liveItem('lift', s.o) ? ' · ' + esc(liveTag()) : ''}</span>` : ''}
      <div class="mut" style="margin-top:4px;border-left:3px solid var(--line);padding-left:8px">${guidance(pl, i).map(esc).join('<br>')}</div></div>${info}</div>`;
  }).join('') + `<div class="step"><div class="num" style="background:var(--brand)">🏁</div><div class="sp"><b>Arrivée</b><br><span class="mut">${esc(pl.steps[pl.steps.length - 1].toName)}</span></div></div></div>`;
}
function levelSummary(pl) {
  const ps = pl.steps.filter(x => x.kind === 'piste' && x.o && pisteOf(x.o)), inf = ps.map(x => info(pisteOf(x.o)));
  const rated = inf.filter(i => i.n >= 5).length, few = inf.filter(i => i.n > 0 && i.n < 5).length, est = inf.length - rated - few;
  return `<div class="mut" style="margin-top:6px">Difficulté recherchée : de ${fmt1(pl.opt.lo)} à ${fmt1(pl.opt.hi)} sur 10. Sur ${inf.length} pistes : ${rated} bien notées (5 votes ou plus), ${few} peu notées, ${est} estimées (aucun vote). La couleur officielle reste un garde-fou : une piste bien plus dure que ton maximum n'est jamais proposée.</div>`;
}
/* Résumé court : la chaîne des étapes principales (remontées et pistes nommées) */
function keyStepsHtml(pl) {
  const ic = { lift: '🚡', piste: '⛷', walk: '🚶', link: '↝' }, ss = pl.steps.filter(s => s.kind === 'lift' || (s.kind === 'piste' && s.m > 300));
  const shown = ss.slice(0, 6).map(s => `<span class="chip" style="cursor:default">${ic[s.kind]} ${esc(s.kind === 'piste' ? stepName(s) : s.name)}</span>`).join('');
  return `<div class="chips" style="margin:0 0 10px">${shown}${ss.length > 6 ? `<span class="chip" style="cursor:default">+ ${ss.length - 6} autres</span>` : ''}</div>`;
}
function planSummary(pl) {
  const cols = {}; pl.steps.filter(s => s.kind === 'piste').forEach(s => cols[s.color] = (cols[s.color] || 0) + 1);
  const st0 = pl.steps[0], stN = pl.steps[pl.steps.length - 1], t = pl.times, partial = t.waitKnown < t.lifts;
  return `<div class="mut" style="margin:0 0 8px">De <b>${esc(st0.fromName)}</b> à <b>${esc(stN.toName)}</b> · ${pl.steps.length} étapes</div>
    <div class="stats"><div><b>${fmtApprox(pl.total).replace('≈ ', '≈')}</b><span>durée${partial ? '*' : ''}</span></div><div><b>${pl.descents}</b><span>pistes</span></div><div><b>${String(pl.km).replace('.', ',')}</b><span>km skiés</span></div><div><b>${pl.down}</b><span>m descendus</span></div></div>
    <div class="chips" style="margin-top:8px">${Object.entries(cols).map(([c, n]) => `<span class="chip" style="cursor:default"><span class="sq ${c}" style="display:inline-block;vertical-align:-2px"></span> ${n}</span>`).join('')}${pl.walkMin ? `<span class="chip" style="cursor:default">🚶 ${pl.walkMin} min</span>` : ''}</div>
    <details style="margin-top:8px"><summary class="mut">Détail des durées</summary>
      <div class="mut" style="margin-top:4px">Descentes ≈ ${t.descent} min · liaisons ≈ ${t.link} min · remontées ${t.ride} min · attentes ${t.waitKnown ? t.wait + ' min connues pour ' + t.waitKnown + ' remontée' + (t.waitKnown > 1 ? 's' : '') + ' sur ' + t.lifts : 'inconnues'}${partial ? ' (* hors attente inconnue)' : ''}. Remontées : durées officielles ; descentes et marche : estimées d'après la longueur.</div>
      ${pl.opt.mode === 'felt' ? levelSummary(pl) : ''}
      ${pl.offColor ? `<div class="mut" style="margin-top:6px">dont ${pl.offColor} min sur des pistes plus faciles, pour relier les secteurs.</div>` : ''}
      ${Math.abs(pl.total - pl.opt.budget) > pl.opt.budget * 0.15 ? `<div class="mut" style="margin-top:6px">Durée demandée : ${fmtMin(pl.opt.budget)}. C'est le meilleur parcours trouvé.</div>` : ''}</details>`;
}
function explainCard() { return `<details class="card" style="padding:10px 14px"><summary><b>Pourquoi ce parcours ?</b></summary>${explainHtml(plan)}</details>`; }
const bandOf = n => Engine.levelOf(n).label.toLowerCase();
function scaleNoticeHtml() {
  return S.scaleNotice ? `<div class="warn">Ton réglage de difficulté était sur 5 (${esc(S.scaleNotice.from)}). Il a été converti sur 10 : ${esc(S.scaleNotice.to)}. Les notes des pistes, elles, étaient déjà sur 10 et n'ont pas changé. <button class="btn sm ghost" data-action="scaleok">OK</button></div>` : '';
}
function renderRoute() {
  const f = S.rf, list = starts(), saved = S.route && S.route.stationId === S.station ? S.route : null;
  if (!NET) return '<h2>Mon itinéraire</h2><p class="mut">Le réseau des pistes n\'est pas disponible.</p>';
  const si = startIndex(f.start), ei = f.end ? startIndex(f.end) : null;
  const opt = p => `<option value="${esc(p.name)}">${esc(p.name)} (${p.alt} m)</option>`;
  const modeBtn = (m, t) => `<button class="${f.mode === m ? 'on' : ''}" data-action="rf" data-k="mode" data-v="${m}">${t}</button>`;
  const eff = effectiveForm();
  return `<h2>Mon itinéraire</h2>${scaleNoticeHtml()}
  <div class="card">
    <label class="mut" for="rstart">Départ</label>
    <select class="f" id="rstart" data-bind="rstart">${list.map(p => opt(p).replace('<option ', `<option ${p.i === si ? 'selected ' : ''}`)).join('')}</select>
    <div style="height:8px"></div><label class="mut" for="rend">Arrivée</label>
    <select class="f" id="rend" data-bind="rend"><option value="">Au même endroit</option>${list.map(p => opt(p).replace('<option ', `<option ${f.end && p.i === ei ? 'selected ' : ''}`)).join('')}</select>
    <div style="height:8px"></div><div class="mut">Durée</div>
    <div class="chips" style="margin-top:4px">${DUR.map(([m, t]) => `<button class="chip${f.budget === m ? ' on' : ''}" data-action="rf" data-k="budget" data-v="${m}">${t}</button>`).join('')}</div>
    <div style="height:8px"></div><div class="mut">Difficulté</div>
    <div class="seg" style="margin:4px 0 8px">${modeBtn('profile', '👤 Mon profil')}${modeBtn('felt', 'Ressentie /10')}${modeBtn('color', 'Couleurs')}</div>
    ${f.mode === 'profile' ? profileCardHtml() : f.mode === 'felt' ? `<div class="mut">De <b id="rlov">${fmt1(f.lo)}</b> à <b id="rhiv">${fmt1(f.hi)}</b> sur 10 <span class="mut">(1 très facile · 10 très difficile)</span></div>
      <div class="mut" style="margin-top:6px">Minimum</div><input type="range" min="1" max="10" step="0.5" value="${f.lo}" data-range="rlo" aria-label="Difficulté minimale">
      <div class="mut">Maximum</div><input type="range" min="1" max="10" step="0.5" value="${f.hi}" data-range="rhi" aria-label="Difficulté maximale">`
    : `<div class="chips" style="margin-top:6px">${COLORS.map(c => `<button class="chip${f.colors.includes(c) ? ' on' : ''}" data-action="rcolor" data-c="${c}"><span class="sq ${c}" style="display:inline-block;vertical-align:-2px"></span> ${colorName(c)}</button>`).join('')}</div>`}
    <details style="margin-top:10px"><summary class="mut">Options avancées</summary>
      <div class="mut" style="margin-top:8px">Ta vitesse</div>
      <div class="seg" style="margin-top:4px">${[['slow', '🐢 Lent'], ['medium', '⛷ Moyen'], ['fast', '⚡ Rapide']].map(([k, t]) => `<button class="${eff.speed === k ? 'on' : ''}" data-action="rf" data-k="speed" data-v="${k}">${t}</button>`).join('')}</div>
      <div class="row" style="gap:8px;margin-top:8px"><label class="mut" for="wmargin">Marge d'attente par remontée</label><select class="f" id="wmargin" style="width:auto">${[[0, 'aucune'], [3, '3 min'], [5, '5 min'], [8, '8 min']].map(([v, t]) => `<option value="${v}" ${S.waitMargin === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      ${f.mode === 'profile' && profCrit().walk === false ? '' : `<label class="chk"><input type="checkbox" data-bind="rwalk" ${f.walk ? 'checked' : ''}> Autoriser de courts chemins à pied</label>`}
      <div class="mut">Les attentes connues sont toujours utilisées ; la marge ne s'applique qu'aux remontées sans donnée.</div></details>
    <div style="height:10px"></div><button class="btn" data-action="plan">Créer mon itinéraire</button>
  </div>
  ${planMsg ? `<div class="warn">${esc(planMsg)}</div>` : ''}
  ${plan ? `<div class="card" id="planres"><h3 style="margin-top:0">Ton itinéraire</h3>${keyStepsHtml(plan)}
      <button class="btn gps" data-action="nstart">🧭 Ouvrir le GPS</button><div style="height:10px"></div>${planSummary(plan)}</div>
    <div class="card">${previewHtml()}</div>
    <details class="card" style="padding:10px 14px"><summary><b>Étapes écrites</b></summary><div style="margin-top:6px">${stepsHtml(plan)}</div></details>
    ${explainCard()}
    <div class="row"><button class="btn sec" data-action="plan" data-next="1">↻ Autre proposition</button><button class="btn ghost" data-action="share" data-k="route">📤 Partager</button></div><div style="height:12px"></div>` : ''}
  ${plan || saved ? `<div class="card" id="offcard">${offCardHtml()}</div>` : ''}
  <p class="mut">Tracés : © contributeurs OpenStreetMap, rapprochés des données officielles. Ils peuvent contenir des erreurs : vérifie les panneaux et respecte la fermeture des pistes.</p>`;
}
const generate = next => generateAt(next ? (S.rf.variant || 0) + 1 : 0);
const edgeLevel = e => { const p = e.o && pisteOf(e.o); if (p) { const i = info(p); return { level: i.level, n: i.n }; } return { level: Engine.COLOR_LEVEL[e.c] ?? 5, n: 0 }; };
/* Calcul commun (génération, recalcul en navigation). req : { mode, lo, hi, colors, walk, speed } déjà résolus (niveaux 1–5). */
function computePlan(q) {
  const lo = Math.min(q.lo, q.hi), hi = Math.max(q.lo, q.hi), ctx = routeCtx();
  return Engine.planRoute(NET, { start: q.start, end: q.end, budget: q.budget, speed: q.speed, colors: q.colors, walk: q.walk, variant: q.variant, blocked: e => !!e.o && isClosed(e.k === 'lift' ? 'lift' : 'piste', e.o),
    waitOf, pref: prefOf(ctx, hi), ...(q.mode === 'felt' ? { levelOf: edgeLevel, lo, hi } : {}) });
}
function generateAt(v) {
  const f = S.rf; f.variant = v;
  const si = startIndex(f.start), ei = f.end ? startIndex(f.end) : si, eff = effectiveForm();
  if (f.mode === 'profile' && eff.profile.missing.includes('level')) { plan = null; planMsg = 'Pour utiliser ton profil, indique ton niveau (seule information indispensable), ou choisis un autre mode.'; save(); render(); return; }
  const req = { mode: eff.mode, lo: eff.lo, hi: eff.hi, colors: eff.colors, walk: eff.walk, speed: eff.speed }, ctx = routeCtx();
  const r = computePlan({ ...req, start: si, end: ei, budget: f.budget, variant: f.variant });
  planMsg = '';
  if (r.error) {
    plan = null;
    planMsg = eff.mode === 'color' && !eff.colors.length ? 'Choisis au moins une couleur de piste.' : !eff.walk ? "Aucun itinéraire sans marche depuis ce départ : autorise les courts chemins à pied." : "Aucun itinéraire trouvé avec ces choix : essaie une durée plus longue, une autre couleur ou un autre départ.";
  } else {
    plan = r; plan.req = req; plan.opt.lo = eff.lo; plan.opt.hi = eff.hi; selStep = null;
    if (eff.profile) plan.opt.profile = { used: eff.profile.used.map(u => u.label + ' → ' + u.effect), ignored: eff.profile.ignored.map(i => i.label), adjusted: hasTmp() };
    plan.reasons = explain(plan, ctx);
  }
  save(); render();
  if (plan) setTimeout(() => $('#planres')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60);
}

/* ---------- Ma journée ---------- */
const logToday = () => (S.log[todayKey()] || []).filter(e => e.stationId === S.station);
function addLog(seg) {
  const e = { ...seg, stationId: S.station, pick: seg.cands.length === 1 && (seg.manual || seg.conf === 'track') ? seg.cands[0] : null };   // piste « parcourue » seulement si choisie à la main ou identifiée par le tracé GPS
  (S.log[todayKey()] = S.log[todayKey()] || []).push(e); save();
  if (e.type === 'piste') {
    const nm = e.pick ? pisteOf(e.pick).name : 'une piste';
    if (!$('#pocket').hidden) { speak(`Descente enregistrée : ${nm}`); updatePocket(); } else toast('Descente enregistrée : ' + nm);
  }
}
function handleFix(fix) {
  if (fix.alt == null) { if (!altWarned) { altWarned = true; toast("Ton téléphone ne donne pas l'altitude : la détection automatique est impossible.", 5000); } return; }
  const seg = Engine.onFix(station(), trk, fix);
  if (seg) { refineByTrack(seg); addLog(seg); if (guide && seg.type === 'piste') advanceGuide(); if (S.tab === 'day' && $('#pocket').hidden) render(); }
  if (S.notif.enabled && S.notif.lift && Engine.climbGain(trk) >= 60) {   // en remontée : on invite à noter la dernière descente identifiée
    const log = logToday(), k = log.map((e, j) => ({ e, j })).reverse().find(x => x.e.type === 'piste' && Date.now() - x.e.t < 25 * 60000);
    if (k) { const id = k.e.pick || k.e.cands[0]; if (id) promptRate(id, k.j); }
  }
}
function renderPocket() {
  const n = logToday().filter(e => e.type === 'piste').length;
  return `<div><div class="dot"></div><b>SKIP enregistre ta journée</b><p><span id="pn">${n}</span> descente(s)</p><p>Profite du paysage 🏔️<br>Maintiens l'écran 1 seconde pour quitter.</p></div>`;
}
function updatePocket() { const n = $('#pn'); if (n) n.textContent = logToday().filter(e => e.type === 'piste').length; }
async function enterPocket() {
  if (!S.outing) outingStart();
  if (!S.outing) return;
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
  const f = S.rf, r = kind === 'route' && plan ? { start: starts().find(p => p.i === plan.opt.start)?.name, end: plan.opt.end !== plan.opt.start ? starts().find(p => p.i === plan.opt.end)?.name : '', budget: plan.opt.budget, speed: plan.opt.speed, colors: plan.opt.colors, walk: plan.opt.walk, variant: plan.opt.variant, mode: plan.opt.mode, lo: plan.opt.lo || 0, hi: plan.opt.hi || 0, sc: 10 } : null;
  return { v: 2, n: pr.pseudo || 'Skieur', l: S.level, d: pr.discipline, s: pr.status, w: pr.wants, so: pr.socials, st: S.station, h: S.hearts, r, t: Date.now(),
    w: S.waits.slice(-20).map(w => [w.id, w.m, w.t]),
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
  if (navigator.share) { navigator.share({ title: 'SKIP', text: txt }).catch(e => { if (!e || e.name !== 'AbortError') shareSheet(txt, enc); }); return; }   // le partage natif peut être refusé (aperçu intégré) : on bascule alors sur la fenêtre de copie
  shareSheet(txt, enc);
}
function shareSheet(txt, enc) {
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
  if (Array.isArray(o.w)) f.w = o.w.slice(0, 30).filter(w => Array.isArray(w) && liftOf(w[0]) && Number.isFinite(w[1]) && w[1] >= 0 && w[1] <= 60 && Number.isFinite(w[2]) && w[2] > Date.now() - 3 * DAY && w[2] < Date.now() + DAY).map(w => [w[0], w[1], w[2]]);
  const r = o.r;
  if (r && typeof r.start === 'string' && r.start.length < 120 && Engine.SPEED_KMH[r.speed] && Array.isArray(r.colors))
    f.r = { start: r.start, end: typeof r.end === 'string' ? r.end.slice(0, 120) : '', budget: Math.min(480, Math.max(30, +r.budget || 120)), speed: r.speed, colors: r.colors.filter(c => COLORS.includes(c)), walk: r.walk !== false, variant: Math.min(50, Math.max(0, +r.variant || 0)),
      mode: r.mode === 'felt' ? 'felt' : 'color', ...(r.sc === 10 ? { lo: clamp(+r.lo || 2, 1, 10), hi: clamp(+r.hi || 6, 1, 10) } : (([a, b]) => ({ lo: a, hi: b }))(Engine.levelRange(clamp(Math.round(+r.lo || 2), 1, 5), clamp(Math.round(+r.hi || 3), 1, 5)))) };   // ancien format sur 5 : converti sur 10
  if (Object.keys(S.friends).length >= 50 && !S.friends[f.n.toLowerCase()]) return 'Limite de 50 contacts atteinte.';
  S.friends[f.n.toLowerCase()] = f; save(); return null;
}
/* ---------- Secours ----------
   Numéro propre à la station, repris d'une source officielle (voir data.js > sos). Aucun appel n'est lancé automatiquement : le bouton est un lien « tel: » que l'utilisateur déclenche lui-même.
   Pourquoi l'ancien bouton ne marchait pas : il passait par confirm() puis location.href, deux actions bloquées dans une page intégrée (aperçu) ; et il n'appelait que le 112, sans le numéro des secours du domaine. */
function sosSheet() {
  const st = station(), s = st.sos, la = (typeof Geo !== 'undefined' && Geo.last && Geo.last()), recent = la && Date.now() - la.t < 120000;
  const touch = navigator.maxTouchPoints > 0 && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
  openSheet(`<h2 style="margin-top:0">🆘 Secours</h2>
    ${s ? `<div class="card" style="border-color:#c62828"><b>${esc(s.name)}</b><div class="mut" style="margin:2px 0 8px">Pisteurs-secouristes du domaine skiable</div>
        <a class="btn gps" style="display:block;text-align:center;text-decoration:none;background:#c62828" href="tel:${esc(s.tel)}">📞 Appeler le ${esc(s.display)}</a>
        <div class="row" style="margin-top:8px;gap:8px"><b class="sp" style="font-size:20px">${esc(s.display)}</b><button class="btn sm ghost" data-action="soscopy" data-n="${esc(s.display)}">Copier</button></div></div>`
      : `<div class="warn">Le numéro des secours sur les pistes de ${esc(st.name)} n'est pas vérifié dans l'appli : utilise le 112 ou préviens le personnel d'une remontée.</div>`}
    <div class="card"><b>Urgence générale (toute situation, hors pistes aussi)</b>
      <a class="btn sec" style="display:block;text-align:center;text-decoration:none;margin-top:8px" href="tel:112">📞 Appeler le 112</a></div>
    ${touch ? '' : '<div class="warn">Cet appareil ne semble pas pouvoir passer d\'appel : compose le numéro depuis un téléphone, ou préviens le personnel d\'une remontée ou un pisteur.</div>'}
    ${recent ? `<div class="mut">Ta dernière position : ${la.lat.toFixed(5)}, ${la.lng.toFixed(5)} (± ${Math.round(la.acc || 0)} m, il y a ${Math.round((Date.now() - la.t) / 1000)} s)</div>` : ''}
    <ul class="mut" style="padding-left:18px;margin:8px 0 0"><li>Reste près du blessé et protège-le du froid.</li><li>Donne le numéro du poteau de la piste ou ta position.</li><li>Préviens le personnel de la remontée la plus proche.</li></ul>
    ${s ? `<div class="mut" style="margin-top:8px">Numéro du plan des pistes officiel ${esc(s.season)} : à revérifier chaque saison.</div>` : ''}`);
}
/* ---------- Réglages et sources (ouvert par ⚙︎) ---------- */
let sheetKind = '';
function settingsSheet() {
  const st = station(); sheetKind = 'settings';
  openSheet(`<h2>Réglages</h2>
    ${profileSettingsHtml()}
    ${renderNotifCard()}
    <div class="card"><b>🔊 Voix du guidage</b><div class="mut" style="margin:4px 0 8px">Voix, débit, volume, écoute d'un extrait.</div><button class="btn sm sec" data-action="nvoice">Régler la voix</button></div>
    <div class="card"><b>Données</b><div class="mut" style="margin-top:6px">${st.pistes.length} pistes et ${st.lifts.length} remontées de l'Espace Alpe d'Huez, issues du flux officiel de la station (mise à jour du ${esc(st.updated)}). Aucune note, aucun vote, aucun coup de cœur n'est inventé : tout démarre à zéro.</div>
      <p class="mut" style="margin:8px 0 0">Annoncé par le site de l'Espace Alpe d'Huez : ${st.site.km} km, ${st.site.pistes} pistes (${st.site.colors.green} vertes, ${st.site.colors.blue} bleues, ${st.site.colors.red} rouges, ${st.site.colors.black} noires), de ${st.site.min} à ${st.site.max} m. Le flux détaille ${['green', 'blue', 'red', 'black'].map(c => st.pistes.filter(p => p.color === c).length).join(' / ')} : l'écart vient des données de la station.</p>
      <p class="mut" style="margin:8px 0 0">Tracés des pistes, remontées et chemins, fond de carte : © contributeurs OpenStreetMap (licence ODbL), fond Protomaps, rapprochés des données officielles. Altitudes des jonctions : EU-DEM 25 m.</p></div>
    <button class="btn ghost" data-action="reset">Réinitialiser mes données</button>`);
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
    <div class="mut" style="margin-top:6px">Notifications appli fermée : ${CFG.vapidKey ? 'clé configurée, mais le service d\'envoi n\'est pas encore fourni.' : 'non configurées (il faut un serveur Web Push avec clés VAPID).'}</div>
    <div class="row" style="margin-top:8px"><button class="btn sm ghost" data-action="ntest">Voir un exemple</button></div>` : ''}
    <details style="margin-top:10px"><summary class="mut">Ce qu'il faut pour la détection automatique</summary>
      <p class="mut">Autorisations : <b>notifications</b> et <b>position précise</b> (GPS, avec altitude). Sur le web, le téléphone suspend l'appli quand l'écran est verrouillé : la détection (et donc l'invitation « en remontée ») ne marche que <b>appli ouverte</b>, par exemple en mode poche avec l'écran maintenu allumé. L'invitation de fin de journée demande aussi que l'appli soit ouverte à l'heure choisie ; sinon elle s'affiche à ton retour. Pour être prévenu <b>appli fermée</b>, il faut des notifications poussées (serveur Web Push avec clés VAPID, voir relay/README.md) et, pour suivre ta position en arrière-plan, une appli native (Capacitor). Sur iPhone, installe d'abord l'appli sur l'écran d'accueil (iOS 16.4 minimum). Rien de tout cela n'est supposé actif : sans détection, ajoute tes pistes à la main ou cherche une piste ci-dessous.</p></details></div>`;
}
const quickRateCard = () => `<div class="card"><b>⭐ Noter une piste</b><input type="search" id="qrs" placeholder="🔍 Nom de la piste" autocomplete="off" aria-label="Rechercher une piste à noter" style="margin:8px 0"><div id="qrres"></div></div>`;
const qrResults = () => { const q = norm($('#qrs')?.value || '').trim(); const l = q ? station().pistes.filter(p => norm(p.name).includes(q)).slice(0, 8) : []; return l.map(p => `<button class="piste" data-action="qopen" data-id="${p.id}"><span class="sq ${p.color}"></span><span class="sp"><b>${esc(p.name)}</b><br><span class="mut">${colorName(p.color).toLowerCase()}${myVote(p.id) ? ' · déjà notée ' + myVote(p.id).s + '/10' : ''}</span></span></button>`).join(''); };
function handleDeepLink(h) {
  if (typeof socialDeepLink === 'function' && socialDeepLink(h)) return;
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
  if (S.tab === 'share') { S.tab = 'meet'; S.meetView = 'friends'; }   // l'ancien onglet Partage vit désormais dans Rencontres
  if (!{ pistes: 1, route: 1, weather: 1, day: 1, meet: 1 }[S.tab]) S.tab = 'pistes';
  $('#view').innerHTML = { pistes: renderPistes, route: renderRoute, weather: renderWeather, day: renderDay, meet: renderMeet }[S.tab]();
  afterRender();
}
const updateList = () => { const l = $('#plist'); if (l) l.innerHTML = listHtml(); };

document.addEventListener('click', e => {
  const tab = e.target.closest('[data-tab]');
  if (tab) { S.tab = tab.dataset.tab; save(); render(); window.scrollTo(0, 0); return; }
  if (e.target.id === 'sheet') return closeSheet();
  const el = e.target.closest('[data-action]'); if (!el) return;
  const d = el.dataset, f = S.filt;
  if (sheetKind === 'settings' && ['disc', 'want', 'slot', 'netedit', 'netsave', 'netdel'].includes(d.action)) queueMicrotask(settingsSheet);   // la feuille Réglages se met à jour après l'action
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
    case 'wreport': S.waits.push({ id: d.id, m: +d.m, t: Date.now() }); S.waits = S.waits.slice(-300); save(); toast('Merci ! Attente signalée.'); liftSheet(d.id); break;
    case 'settings': settingsSheet(); break;
    case 'sos': sosSheet(); break;
    case 'soscopy': copyText(d.n).then(ok => toast(ok ? 'Numéro copié.' : 'Copie impossible : note le numéro et compose-le.', 4000)); break;
    case 'close': closeSheet(); break;
    case 'open': sheetPeriod = 0; showChars = false; pisteSheet(d.id); break;
    case 'openlift': liftSheet(d.id); break;
    case 'view': f.view = d.v; save(); render(); break;
    case 'allcolors': f.colors = []; save(); render(); break;
    case 'color': f.colors = f.colors.length === 1 && f.colors[0] === d.c ? [] : [d.c]; f.q = ''; save(); render(); break;   // un clic = uniquement cette couleur ; un second clic retire le filtre
    case 'clearfilters': Object.assign(f, { colors: [], sector: '', q: '', mine: false, fit: false }); save(); render(); break;
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
    case 'rf': if (d.k === 'speed' && S.rf.mode === 'profile') (S.rf.tmp = S.rf.tmp || {}).speed = d.v; else S.rf[d.k] = d.k === 'budget' ? +d.v : d.v; save(); render(); break;
    case 'scaleok': delete S.scaleNotice; save(); render(); break;
    case 'rcolor': S.rf.colors = S.rf.colors.includes(d.c) ? S.rf.colors.filter(c => c !== d.c) : [...S.rf.colors, d.c]; save(); render(); break;
    case 'plan': generate(!!d.next); break;
    case 'openstep': { const s = plan.steps[+d.i]; if (s.kind === 'piste') pisteSheet(s.o); else liftSheet(s.o); break; }
    case 'loadsaved': plan = S.route.plan; planMsg = ''; selStep = null; S.tab = 'route'; render(); window.scrollTo(0, 0); break;
    case 'delsaved': if (confirm('Supprimer l\'itinéraire téléchargé et le fond de carte de ton téléphone ?')) { S.route = null; save(); Offline.removeBasemap().then(() => { offStat = { checked: false, map: null, miss: [] }; loadBasemap('network'); render(); }); } break;
    case 'gnext': advanceGuide(); break;
    case 'gstop': guide = null; render(); break;
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
    default: if (!navAction(d) && !outingAction(d) && typeof socialAction === 'function') socialAction(d);
  }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'q') { S.filt.q = t.value; updateList(); }
  else if (t.id === 'psearch') { pquery = t.value; $('#pres').innerHTML = searchHtml(); }
  else if (t.id === 'qrs') { $('#qrres').innerHTML = qrResults(); }
  else if (t.dataset.range === 'level') { S.level = +t.value; S.levelSet = true; $('#lvl').textContent = t.value; save(); updateList(); }
  else if (t.dataset.range === 'level2') { S.level = +t.value; S.levelSet = true; save(); }
  else if (t.dataset.range === 'rlo' || t.dataset.range === 'rhi') { const k = t.dataset.range === 'rlo' ? 'lo' : 'hi'; S.rf[k] = +t.value; if (S.rf.lo > S.rf.hi) { if (k === 'lo') S.rf.hi = S.rf.lo; else S.rf.lo = S.rf.hi; } $('#rlov').textContent = fmt1(S.rf.lo); $('#rhiv').textContent = fmt1(S.rf.hi); const o = document.querySelector('[data-range=' + (k === 'lo' ? 'rhi' : 'rlo') + ']'); if (o) o.value = S.rf[k === 'lo' ? 'hi' : 'lo']; save(); }
  else if (t.dataset.range === 'plevel') { $('#plv').textContent = t.value; }
  else if (t.id === 'vrate') { S.voice.rate = +t.value; $('#vratev').textContent = (+t.value).toFixed(2).replace('.', ','); save(); }
  else if (t.id === 'vvol') { S.voice.volume = +t.value; $('#vvolv').textContent = Math.round(t.value * 100); save(); }
});
document.addEventListener('change', e => {
  const t = e.target, b = t.dataset.bind;
  if (b === 'fit') { S.filt.fit = t.checked; save(); updateList(); }
  else if (b === 'sector') { S.filt.sector = t.value; save(); updateList(); }
  else if (b === 'izone') { S.intent = { ...(S.intent || { k: 'ski', when: 'now' }), zone: t.value, day: todayKey() }; save(); }
  else if (b === 'pzone') { S.profile.zone = t.value; save(); }
  else if (b === 'rstart') { S.rf.start = t.value; save(); }
  else if (b === 'rend') { S.rf.end = t.value; save(); }
  else if (b === 'rwalk') { S.rf.walk = t.checked; save(); }
  else if (b === 'ptmpwalk') { (S.rf.tmp = S.rf.tmp || {}).walk = t.checked ? true : undefined; if (!t.checked) delete S.rf.tmp.walk; save(); render(); }
  else if (b === 'pvnet') { showNet = t.checked; pvMap && pvMap.showDomain(showNet); }
  else if (b === 'audio') { S.audio = t.checked; save(); }
  else if (b === 'nenabled') { if (t.checked) enableNotif(); else { S.notif.enabled = false; save(); render(); if (sheetKind === 'settings') settingsSheet(); } }
  else if (b === 'nlift') { S.notif.lift = t.checked; save(); }
  else if (b === 'nevening') { S.notif.evening = t.checked; save(); render(); if (sheetKind === 'settings') settingsSheet(); }
  else if (t.id === 'neve') { S.notif.eveningTime = t.value || '17:30'; S.pro.evening = false; save(); }
  else if (t.id === 'nmax') { S.notif.max = +t.value; save(); }
  else if (t.id === 'wmargin') { S.waitMargin = +t.value; save(); }
  else if (t.id === 'vname') { S.voice.name = t.value; save(); }
  else if (t.id === 'qother' && t.value) { rateCtx.id = t.value; rateCtx.k = null; rateCtx.correcting = false; rateSheet(); }
  else if (t.id === 'pseudo') { S.profile.pseudo = t.value.trim().slice(0, 30); save(); }
  else if (t.dataset.range === 'level2') { render(); }
  else if (t.id === 'manual' && t.value) { const p = pisteOf(t.value); addLog({ type: 'piste', cands: [p.id], altFrom: p.altFrom, altTo: p.altTo, t: Date.now(), manual: true }); render(); }
});
$('#station').addEventListener('change', e => { S.station = e.target.value; guide = null; if (nv) stopNav(); pending = {}; trk = Engine.newTracker(); plan = null; save(); render(); });
(() => { let tm; const p = $('#pocket'), go = () => { tm = setTimeout(exitPocket, 1000); }, no = () => clearTimeout(tm);
  p.addEventListener('pointerdown', go); p.addEventListener('pointerup', no); p.addEventListener('pointerleave', no); })();

/* ---------- Réseau, temps d'écran, démarrage ---------- */
const netState = () => { $('#net').hidden = navigator.onLine; };
window.addEventListener('online', netState); window.addEventListener('offline', netState);

$('#station').innerHTML = Object.values(DATA.stations).map(s => `<option value="${s.id}" ${s.id === S.station ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
loadWaitHistory(); render(); outingResumeOnLoad(); netState(); resetPro(); handleDeepLink(location.hash); eveningCheck(); setInterval(eveningCheck, 60000);
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
