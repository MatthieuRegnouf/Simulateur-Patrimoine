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
  votes: {}, hearts: [], log: {}, route: null, chat: {}, screen: {}, friends: {}, draft: [],
  filt: { colors: [], q: '', sector: '', sort: 'color', fit: false, open: false, view: 'pistes' },
  rf: { speed: 'medium', kind: 'lift', sector: '', colors: COLORS.slice(), q: '' }
});
let S = (() => { try { return Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { return defaults(); } })();
S.profile = { ...defaults().profile, ...S.profile }; S.filt = { ...defaults().filt, ...S.filt }; S.rf = { ...defaults().rf, ...S.rf };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* stockage indisponible */ } };

const station = () => DATA.stations[S.station];
const pisteOf = (id, st = station()) => st.pistes.find(p => p.id === id);
const liftOf = (id, st = station()) => st.lifts.find(l => l.id === id);
const thing = id => pisteOf(id) || liftOf(id);
const colorName = c => Engine.COLOR_LABEL[c];
const secName = id => station().sectors[id] || id;
const alts = x => x.altFrom && x.altTo ? `${x.altFrom} → ${x.altTo} m` : '';
const kmText = km => km ? `${String(km).replace('.', ',')} km` : '';
const info = p => {
  const mine = S.votes[p.id] || null;
  return { score: mine, label: Engine.label(mine), fit: Engine.fit(p, mine, S.level), liked: S.hearts.includes(p.id) };
};
const scoreBubble = (s, big) => s == null ? `<div class="score none${big ? ' big' : ''}">–<small>non noté</small></div>`
  : `<div class="score${big ? ' big' : ''}" style="background:${scoreColor(s)}">${String(s).replace('.', ',')}<small>/10</small></div>`;

let guide = null, pending = {}, sheetVote = null, netEdit = null;
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
function openSheet(html) { const s = $('#sheet'); s.innerHTML = `<div class="in"><button class="x" data-action="close" aria-label="Fermer">✕</button>${html}</div>`; s.hidden = false; }
function closeSheet() { $('#sheet').hidden = true; sheetVote = null; }

/* ---------- Pistes et remontées ---------- */
const norm = t => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
const LIFT_ICON = { 'Téléski': '⛷', 'Tapis': '➡️', 'Ascenseur': '🛗' };
function filteredPistes() {
  const f = S.filt, q = norm(f.q).trim();
  const l = station().pistes.filter(p => q ? norm(p.name).includes(q) :
    (!f.colors.length || f.colors.includes(p.color)) && (!f.sector || p.sectors.includes(f.sector)) && (!f.fit || info(p).fit.key !== 'hard'));
  const byColor = (a, b) => RANK[a.color] - RANK[b.color] || a.name.localeCompare(b.name);
  return l.sort(f.sort === 'hearts' ? (a, b) => (S.hearts.includes(b.id) - S.hearts.includes(a.id)) || byColor(a, b) : f.sort === 'name' ? (a, b) => a.name.localeCompare(b.name)
    : f.sort === 'score' ? (a, b) => (S.votes[b.id] || 0) - (S.votes[a.id] || 0) || byColor(a, b) : f.sort === 'alt' ? (a, b) => (b.altFrom || 0) - (a.altFrom || 0) : byColor);
}
function filteredLifts() {
  const f = S.filt, q = norm(f.q).trim();
  return station().lifts.filter(l => q ? norm(l.name).includes(q) : !f.sector || l.sectors.includes(f.sector)).sort((a, b) => a.name.localeCompare(b.name));
}
function pisteRow(p) {
  const i = info(p);
  return `<button class="piste" data-action="open" data-id="${p.id}">
    <span class="sq ${p.color}" title="${colorName(p.color)}"></span>
    <span class="sp"><b>${esc(p.name)}</b><br><span class="mut">${[`Piste ${colorName(p.color).toLowerCase()}`, kmText(p.km), alts(p)].filter(Boolean).join(' · ')}</span>${i.fit.key === 'hard' ? ' <span class="fit hard">⚠ trop dur</span>' : ''}</span>
    ${scoreBubble(i.score)}</button>`;
}
function liftRow(l) {
  return `<button class="piste" data-action="openlift" data-id="${l.id}"><span class="ico">${LIFT_ICON[l.type] || '🚡'}</span>
    <span class="sp"><b>${esc(l.name)}</b><br><span class="mut">${[l.type, l.min ? Math.round(l.min) + ' min' : '', alts(l) || (l.denivele ? 'dénivelé ' + l.denivele + ' m' : '')].filter(Boolean).join(' · ')}</span></span></button>`;
}
function listHtml() {
  const lifts = S.filt.view === 'lifts', l = lifts ? filteredLifts() : filteredPistes();
  return l.length ? l.map(lifts ? liftRow : pisteRow).join('') : '<p class="mut">Aucun résultat.</p>';
}
function renderPistes() {
  const f = S.filt, st = station(), lifts = f.view === 'lifts';
  return `<h2>${esc(st.name)}</h2>
  <input type="search" id="q" class="bigsearch" placeholder="🔍 Chercher ${lifts ? 'une remontée' : 'une piste'}" value="${esc(f.q)}" aria-label="Rechercher" autocomplete="off">
  <div class="seg" style="margin:10px 0"><button class="${lifts ? '' : 'on'}" data-action="view" data-v="pistes">Pistes (${st.pistes.length})</button><button class="${lifts ? 'on' : ''}" data-action="view" data-v="lifts">Remontées (${st.lifts.length})</button></div>
  ${lifts ? '' : `<div class="chips" style="margin-bottom:10px"><button class="chip${f.colors.length ? '' : ' on'}" data-action="allcolors">Toutes</button>
    ${COLORS.map(c => `<button class="chip${f.colors.includes(c) ? ' on' : ''}" data-action="color" data-c="${c}"><span class="sq ${c}" style="display:inline-block;vertical-align:-2px"></span> ${colorName(c)}</button>`).join('')}
    <button class="chip${f.open ? ' on' : ''}" data-action="filters">Réglages</button></div>`}
  <select class="f" data-bind="sector" aria-label="Secteur" style="margin-bottom:10px"><option value="">Tous les secteurs</option>${Object.entries(st.sectors).map(([id, n]) => `<option value="${id}" ${f.sector === id ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
  ${f.open && !lifts ? `<div class="card"><div class="mut">Trier par</div>
    <div class="seg" style="margin:6px 0 10px">${[['color', 'Couleur'], ['alt', 'Altitude'], ['hearts', '❤'], ['name', 'A-Z']].map(([k, t]) => `<button class="${f.sort === k ? 'on' : ''}" data-action="sort" data-k="${k}">${t}</button>`).join('')}</div>
    <div class="mut">Mon niveau : <b id="lvl">${S.level}</b>/10</div>
    <input type="range" min="1" max="10" step="0.5" value="${S.level}" data-range="level" aria-label="Mon niveau">
    <label class="chk"><input type="checkbox" data-bind="fit" ${f.fit ? 'checked' : ''}> Masquer les pistes trop dures pour moi</label></div>` : ''}
  <div id="plist">${listHtml()}</div>
  <p class="mut" style="margin-top:14px">Données officielles de l'Espace Alpe d'Huez (mise à jour du ${esc(st.updated)}). Personne n'a encore noté les pistes : skie, puis note pour lancer la moyenne.</p>`;
}

function pisteSheet(id) {
  const p = pisteOf(id), i = info(p), mine = S.votes[id], liked = i.liked, sel = sheetVote ?? mine;
  const cell = (k, v) => v ? `<div>${k}<b>${esc(v)}</b></div>` : '';
  const times = p.km ? ['slow', 'medium', 'fast'].map(k => Engine.estMin(p, k)).join(' / ') + ' min' : '';
  openSheet(`<div class="row"><span class="sq ${p.color}" style="width:22px;height:22px"></span><h2 style="margin:0">${esc(p.name)}</h2></div>
    <div class="mut">Piste ${colorName(p.color).toLowerCase()} officielle</div>
    <div class="row" style="margin:12px 0">${scoreBubble(i.score, true)}<div>
      ${i.score == null ? '<b>Pas encore noté</b><br><span class="mut">Personne n\'a voté. Sois le premier à la noter !</span>'
        : `<span class="lab ${i.label.key}">${i.label.icon} Piste ${i.label.text.toUpperCase()}</span><br><span class="mut">Ta note. La moyenne de la communauté apparaîtra quand l'appli sera connectée à un serveur.</span>`}</div></div>
    <div class="fit ${i.fit.key}" style="margin-bottom:8px">${i.fit.text} (niveau ${S.level}/10)</div>
    ${i.fit.key === 'hard' ? '<div class="warn">⚠ Cette piste est au-dessus de ton niveau. Choisis plutôt une piste plus facile.</div>' : ''}
    ${p.info ? `<p style="margin:0 0 8px">${esc(p.info)}</p>` : ''}
    ${p.official ? `<div class="warn" style="background:var(--brand2);color:var(--ink)"><b>Selon le site officiel</b><br>${p.official.map(esc).join('<br>')}</div>` : ''}
    <div class="data">${cell('Longueur', kmText(p.km))}${cell('Altitudes', alts(p))}${cell('Dénivelé', p.denivele ? p.denivele + ' m' : !p.official && Engine.drop(p) ? Engine.drop(p) + ' m' : '')}
      ${cell('Horaires', p.hours)}${cell('Durée estimée lent / moyen / rapide', times)}${cell('Secteur', p.sectors.map(secName).join(' ; '))}</div>
    <div class="mut">${times ? 'Durée estimée d\'après la longueur (hypothèse de vitesse). ' : ''}Source : flux officiel de l'Espace Alpe d'Huez.</div>
    <h3>${mine ? 'Ta note' : 'Donne ta note'}</h3><div class="mut">1 = très facile · 10 = très difficile</div>
    <div class="rate" data-rate="${id}">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<button style="background:${scoreColor(n)}" class="${sel === n ? 'on' : ''}" data-action="pick" data-n="${n}">${n}</button>`).join('')}</div>
    <button class="btn" data-action="validate" data-id="${id}" ${sel ? '' : 'disabled'}>${mine ? 'Modifier ma note' : 'Valider ma note'}</button>
    <h3>Coup de cœur</h3>
    <button class="heart${liked ? ' on' : ''}" data-action="heart" data-id="${id}">${liked ? '❤️ Dans mes coups de cœur' : '🤍 Ajouter aux coups de cœur'}</button>
    <div class="mut" style="margin-top:4px">Le nombre de skieurs qui l'ont adorée apparaîtra avec le serveur.</div>
    <div class="row" style="margin-top:12px"><button class="btn sec" data-action="addstep" data-k="p" data-id="${id}">➕ À mon parcours</button><button class="btn sec" data-action="skied" data-id="${id}">✅ Skiée aujourd'hui</button></div>`);
}
function liftSheet(id) {
  const l = liftOf(id), cell = (k, v) => v ? `<div>${k}<b>${esc(v)}</b></div>` : '';
  openSheet(`<div class="row"><span class="ico">${LIFT_ICON[l.type] || '🚡'}</span><h2 style="margin:0">${esc(l.name)}</h2></div><div class="mut">${esc(l.type)}</div>
    <div class="data" style="margin-top:12px">${cell('Durée du trajet', l.min ? Math.round(l.min) + ' min' : '')}${cell('Altitudes', alts(l))}${cell('Dénivelé', l.denivele ? l.denivele + ' m' : l.altFrom && l.altTo ? l.altTo - l.altFrom + ' m' : '')}
      ${cell('Horaires', l.hours)}${cell('Débit maximum', l.debit ? l.debit + ' pers/h' : '')}${cell('Secteur', l.sectors.map(secName).join(' ; '))}</div>
    <div class="mut">Source : flux officiel de l'Espace Alpe d'Huez. Les informations manquantes ne sont pas fournies.</div>
    <div style="height:12px"></div><button class="btn sec" data-action="addstep" data-k="l" data-id="${id}">➕ Ajouter à mon parcours</button>`);
}

/* ---------- Parcours ---------- */
const draftSteps = () => S.draft.map(d => d.k === 'l' ? { kind: 'lift', ref: liftOf(d.id) } : { kind: 'piste', ref: pisteOf(d.id) }).filter(s => s.ref);
const stepTitle = s => s.kind === 'lift' ? s.ref.name : `${s.ref.name}`;
function stepText(s, speed = S.rf.speed) {
  const m = Engine.stepMin(s.kind, s.ref, speed);
  return s.kind === 'lift' ? `Prenez ${s.ref.name}${m ? ', environ ' + m + ' minutes' : ''}.` : `Descendez ${s.ref.name}, piste ${colorName(s.ref.color).toLowerCase()}${s.ref.km ? ', ' + String(s.ref.km).replace('.', ',') + ' kilomètres' : ''}.`;
}
function profileSvg(steps, speed) {
  const W = 340, H = 220, L = 46, R = 10, T = 16, B = 18;
  const all = steps.flatMap(s => [s.ref.altFrom, s.ref.altTo]).filter(Boolean);
  if (!all.length) return '';
  const lo = Math.floor(Math.min(...all) / 100) * 100 - 100, hi = Math.ceil(Math.max(...all) / 100) * 100 + 100;
  const y = a => T + (hi - a) / (hi - lo) * (H - T - B);
  const mins = steps.map(s => Engine.stepMin(s.kind, s.ref, speed) || 6), tot = mins.reduce((a, b) => a + b, 0);
  const x = t => L + t / tot * (W - L - R);
  const step = hi - lo > 1200 ? 500 : 250, grid = [];
  for (let a = Math.ceil(lo / step) * step; a <= hi; a += step) grid.push(`<line x1="${L}" x2="${W - R}" y1="${y(a)}" y2="${y(a)}" style="stroke:var(--line)"/><text x="${L - 5}" y="${y(a) + 3}" text-anchor="end" font-size="9" style="fill:var(--mut)">${a} m</text>`);
  let t = 0, cur = null, marks = '', lines = '';
  steps.forEach((s, i) => {
    const x0 = x(t), x1 = x(t + mins[i]), a0 = s.ref.altFrom ?? cur, a1 = s.ref.altTo ?? a0;
    if (i > 0 && cur && s.ref.altFrom && Math.abs(cur - s.ref.altFrom) > Engine.LIFT_GAP_M) lines += `<line x1="${x0}" x2="${x0}" y1="${y(cur)}" y2="${y(s.ref.altFrom)}" stroke="#e5372b" stroke-width="2" stroke-dasharray="2 3"/>`;
    if (a0 != null && a1 != null) {
      const col = s.kind === 'lift' ? '#6b7690' : `var(--${s.ref.color})`;
      lines += `<line x1="${x0}" y1="${y(a0)}" x2="${x1}" y2="${y(a1)}" style="stroke:${col}" stroke-width="5" stroke-linecap="round" ${s.kind === 'lift' ? 'stroke-dasharray="7 5"' : ''}/>`;
      marks += `<circle cx="${(x0 + x1) / 2}" cy="${(y(a0) + y(a1)) / 2}" r="10" style="fill:${s.kind === 'lift' ? '#3d4660' : 'var(--' + s.ref.color + ')'}" stroke="#fff" stroke-width="2"/><text x="${(x0 + x1) / 2}" y="${(y(a0) + y(a1)) / 2 + 4}" text-anchor="middle" font-size="11" font-weight="800" fill="#fff">${i + 1}</text>`;
    }
    cur = a1 ?? cur; t += mins[i];
  });
  return `<svg class="map" viewBox="0 0 ${W} ${H}" role="img" aria-label="Profil d'altitude du parcours">${grid.join('')}${lines}${marks}</svg>
    <div class="mut" style="margin-top:6px">Profil d'altitude : les remontées montent (pointillés), les pistes descendent (couleur officielle). Pointillé rouge = les deux étapes ne s'enchaînent pas à la même altitude.</div>`;
}
function stepsHtml(steps, speed, edit) {
  let prev = null;
  return steps.map((s, i) => {
    const g = prev ? Engine.gap(prev.ref, s.ref) : { ok: null };
    const m = Engine.stepMin(s.kind, s.ref, speed), est = s.kind === 'piste' && m;
    prev = s;
    const col = s.kind === 'lift' ? '#3d4660' : `var(--${s.ref.color})`;
    return `${g.ok === false ? `<div class="warn" style="margin:6px 0">⚠ Tu arrives vers ${esc(String(steps[i - 1].ref.altTo))} m et cette étape part de ${esc(String(s.ref.altFrom))} m (écart ${g.d} m). Vérifie le chemin sur le plan officiel.</div>` : ''}
    <div class="step"><div class="num" style="background:${col}">${i + 1}</div><div class="sp"><b>${s.kind === 'lift' ? 'Remontée' : 'Piste ' + colorName(s.ref.color).toLowerCase()} · ${esc(stepTitle(s))}</b><br>
      <span class="mut">${[s.kind === 'lift' ? s.ref.type : '', alts(s.ref), m ? (est ? '≈ ' : '') + m + ' min' : 'durée inconnue', s.kind === 'piste' ? kmText(s.ref.km) : ''].filter(Boolean).join(' · ')}</span></div>
      ${edit ? `<button class="btn sm ghost" data-action="rm" data-i="${i}" aria-label="Retirer l'étape ${i + 1}">✕</button>` : ''}</div>`;
  }).join('');
}
function summaryHtml(steps, speed) {
  const s = Engine.summary(steps, speed);
  return `<div class="stats"><div><b>${s.total ? '≈ ' + fmtMin(s.total) : '–'}</b><span>durée</span></div><div><b>${s.descents}</b><span>descentes</span></div><div><b>${s.km ? String(s.km).replace('.', ',') : '–'}</b><span>km skiés</span></div><div><b>${s.down || '–'}</b><span>m descendus</span></div></div>
    ${s.unknown ? `<div class="mut" style="margin-top:6px">${s.unknown} étape(s) sans durée connue ne sont pas comptées.</div>` : ''}
    <div class="mut" style="margin-top:4px">Remontées : durées officielles. Descentes : durée estimée d'après la longueur. Attentes non incluses.</div>`;
}
function candidates() {
  const f = S.rf, st = station(), steps = draftSteps(), last = steps[steps.length - 1], q = norm(f.q).trim();
  let l = (f.kind === 'lift' ? st.lifts : st.pistes.filter(p => f.colors.includes(p.color))).filter(x => (!f.sector || x.sectors.includes(f.sector)) && (!q || norm(x.name).includes(q)));
  const rank = x => { if (!last) return 1; const g = Engine.gap(last.ref, x); return g.ok === true ? 0 : g.ok === null ? 1 : 2; };
  l = l.map(x => ({ x, g: last ? Engine.gap(last.ref, x) : { ok: null } })).sort((a, b) => rank(a.x) - rank(b.x) || a.x.name.localeCompare(b.x.name));
  return l;
}
function candHtml() {
  const f = S.rf, l = candidates(), shown = l.slice(0, 40);
  return (shown.map(({ x, g }) => `<div class="step"><span class="${f.kind === 'lift' ? 'ico' : 'sq ' + x.color}"${f.kind === 'lift' ? '' : ' style="margin-top:4px"'}>${f.kind === 'lift' ? (LIFT_ICON[x.type] || '🚡') : ''}</span>
    <div class="sp"><b>${esc(x.name)}</b>${g.ok === true ? ' <span class="badge" style="background:#dff5e6;color:#12803a">✓ enchaîne</span>' : ''}<br><span class="mut">${[f.kind === 'lift' ? x.type : '', alts(x), f.kind === 'lift' ? (x.min ? Math.round(x.min) + ' min' : '') : kmText(x.km)].filter(Boolean).join(' · ')}</span></div>
    <button class="btn sm sec" data-action="addstep" data-k="${f.kind === 'lift' ? 'l' : 'p'}" data-id="${x.id}">➕</button></div>`).join('') || '<p class="mut">Aucun résultat.</p>')
    + (l.length > 40 ? `<p class="mut">${l.length - 40} autres : précise le secteur ou la recherche.</p>` : '');
}
function renderRoute() {
  const st = station(), f = S.rf, steps = draftSteps();
  const saved = S.route && S.route.stationId === S.station ? S.route : null;
  return `<h2>Mon parcours</h2>
  ${guide ? `<div class="card" style="border-color:var(--brand)"><b>🔊 Guidage en cours</b><div style="margin:6px 0">${guide.idx < guide.steps.length ? 'Prochaine étape : ' + esc(stepText(guide.steps[guide.idx])) : '🎉 Parcours terminé !'}</div>
    <div class="row"><button class="btn sm" data-action="gnext">Étape suivante</button><button class="btn sm ghost" data-action="gstop">Arrêter</button></div></div>` : ''}
  <div class="card">
    <div class="mut">Ta vitesse</div>
    <div class="seg" style="margin:6px 0 10px">${[['slow', '🐢 Lent'], ['medium', '⛷ Moyen'], ['fast', '⚡ Rapide']].map(([k, t]) => `<button class="${f.speed === k ? 'on' : ''}" data-action="rspeed" data-v="${k}">${t}</button>`).join('')}</div>
    ${steps.length ? `${summaryHtml(steps, f.speed)}<div style="height:8px"></div>${stepsHtml(steps, f.speed, true)}
      <div class="row" style="margin-top:10px"><button class="btn sm ghost" data-action="clear">Tout effacer</button></div>`
      : '<p class="mut" style="margin:0">Construis ton parcours : ajoute une remontée, puis une piste qui part de là où tu arrives, et ainsi de suite. Les étapes qui enchaînent bien sont signalées ✓.</p>'}
  </div>
  ${steps.length ? `<div class="card">${profileSvg(steps, f.speed)}</div>
    <div class="row"><button class="btn sec" data-action="download">📥 Hors ligne</button><button class="btn sec" data-action="gstart">🔊 Guidage</button></div>
    <div style="height:8px"></div><button class="btn ghost" data-action="share" data-k="route">📤 Partager ce parcours</button>` : ''}
  <h3>Ajouter une étape</h3>
  <div class="card">
    <div class="seg" style="margin-bottom:10px"><button class="${f.kind === 'lift' ? 'on' : ''}" data-action="rkind" data-v="lift">🚡 Remontées</button><button class="${f.kind === 'piste' ? 'on' : ''}" data-action="rkind" data-v="piste">🎿 Pistes</button></div>
    ${f.kind === 'piste' ? `<div class="chips" style="margin-bottom:10px">${COLORS.map(c => `<button class="chip${f.colors.includes(c) ? ' on' : ''}" data-action="rcolor" data-c="${c}"><span class="sq ${c}" style="display:inline-block;vertical-align:-2px"></span> ${colorName(c)}</button>`).join('')}</div>` : ''}
    <select class="f" data-bind="rsector" aria-label="Secteur" style="margin-bottom:10px"><option value="">Tous les secteurs</option>${Object.entries(st.sectors).map(([id, n]) => `<option value="${id}" ${f.sector === id ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
    <input type="search" id="rq" placeholder="🔍 Chercher par nom" value="${esc(f.q)}" aria-label="Rechercher une étape" autocomplete="off" style="margin-bottom:6px">
    <div id="clist">${candHtml()}</div></div>
  ${saved ? `<div class="card"><b>📥 Parcours téléchargé</b><div class="mut">Enregistré le ${new Date(saved.savedAt).toLocaleString('fr-FR')}, disponible sans réseau.</div>
    <div class="row" style="margin-top:8px"><button class="btn sm sec" data-action="loadsaved">Ouvrir</button><button class="btn sm ghost" data-action="delsaved">Supprimer</button></div></div>` : ''}
  <p class="mut">Les connexions exactes entre pistes et remontées ne sont pas dans les données officielles : l'appli compare les altitudes, vérifie toujours sur le plan de la station.</p>`;
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
  <div class="card"><b>📵 Temps d'écran aujourd'hui : ${mins} min</b>
    <div class="bar" style="margin:8px 0"><i style="width:${Math.min(100, mins / 15 * 100)}%"></i></div>
    <div class="mut">Objectif : moins de 15 min. ${auto} descente(s) enregistrée(s) automatiquement. Profite de la remontée pour admirer le paysage 🏔️</div></div>
  <h3>Descentes de la journée (${log.filter(e => e.type === 'piste').length})</h3>
  <div class="card">${log.length ? log.map((e, k) => logRow(e, k)).join('') : '<p class="mut" style="margin:0">Rien d\'enregistré pour l\'instant.</p>'}
    <div class="row" style="margin-top:10px"><select class="f" id="manual" style="flex:1"><option value="">Ajouter une piste à la main…</option>${st.pistes.map(p => `<option value="${p.id}">${esc(p.name)} (${colorName(p.color).toLowerCase()})</option>`).join('')}</select></div>
    <div class="row" style="margin-top:8px"><select class="f" id="simsel" style="flex:1"><option value="">Tester la détection avec…</option>${st.pistes.filter(p => p.altFrom && p.altTo).map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div></div>
  <h3>⭐ Noter mes pistes</h3>
  ${pistes.length ? `<div class="card">${pistes.map(id => { const p = pisteOf(id), cur = pending[id] ?? S.votes[id]; return `<div style="margin-bottom:12px"><div class="row"><span class="sq ${p.color}"></span><b class="sp">${esc(p.name)}</b></div>
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
  const r = kind === 'route' && S.draft.length ? { st: S.station, steps: S.draft.map(d => d.k + ':' + d.id), speed: S.rf.speed } : null;
  return { v: 2, n: pr.pseudo || 'Skieur', l: S.level, d: pr.discipline, s: pr.status, w: pr.wants, so: pr.socials, st: S.station, h: S.hearts, r, t: Date.now() };
}
function shareText(kind) {
  const pl = sharePayload(kind), hn = heartNames(S.hearts), steps = draftSteps();
  const lines = [`⛷ ${pl.n} sur SKIP, ${station().name}`, `Niveau ${pl.l}/10 · ${pl.d === 'snowboard' ? 'snowboard' : 'ski'} · ${STATUSES[pl.s]}`];
  if (kind === 'route' && steps.length) lines.push(`🧭 Parcours : ${steps.map(s => s.ref.name).join(' → ')}`);
  if ((kind === 'hearts' || kind === 'profile') && hn.length) lines.push(`❤ Mes coups de cœur : ${hn.join(', ')}`);
  lines.push('', "Pour m'ajouter : colle ce message dans SKIP > Rencontres > « Ajouter un skieur ».", 'SKIP:' + b64e(pl));
  return lines.join('\n');
}
function openShare(kind) {
  if (kind === 'route' && !S.draft.length) return toast("Construis d'abord un parcours.");
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
  const r = o.r, stn = DATA.stations[f.st];
  if (r && Array.isArray(r.steps)) {
    const steps = r.steps.filter(x => typeof x === 'string').slice(0, 40).map(x => ({ k: x[0], id: x.slice(2) })).filter(d => (d.k === 'l' ? stn.lifts : stn.pistes).some(z => z.id === d.id));
    if (steps.length) f.r = { steps, speed: Engine.SPEED_KMH[r.speed] ? r.speed : 'medium' };
  }
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
      <span class="badge">${STATUSES[f.s]}</span> <span class="mut">mis à jour le ${new Date(f.t).toLocaleDateString('fr-FR')}</span></div></div>
      ${f.w.length ? `<div class="mut" style="margin-top:6px">Envies : ${f.w.map(esc).join(' · ')}</div>` : ''}
      ${netLinks(f.so) ? `<div class="chips" style="margin-top:8px">${netLinks(f.so)}</div>` : ''}
      ${hn2.length ? `<div style="margin-top:8px">❤ ${hn2.map(esc).join(', ')} <button class="chip" data-action="fhearts" data-k="${esc(key)}">Ajouter à mes cœurs</button></div>` : ''}
      <div class="row" style="margin-top:8px">${f.r ? `<button class="btn sm sec" data-action="froute" data-k="${esc(key)}">🧭 Voir son parcours</button>` : ''}<button class="btn sm ghost" data-action="fdel" data-k="${esc(key)}">Supprimer</button></div></div>`;
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
    <p class="mut" style="margin:4px 0 10px">Envoie ton profil, ton parcours ou tes coups de cœur par WhatsApp, SMS ou autre. Ton ami les retrouve dans SKIP.</p>
    <div class="row" style="flex-wrap:wrap"><button class="btn sm" data-action="share" data-k="profile">📤 Mon profil</button><button class="btn sm sec" data-action="share" data-k="route">🧭 Mon parcours</button><button class="btn sm sec" data-action="share" data-k="hearts">❤ Mes coups de cœur</button></div>
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
    <button class="btn ghost" data-action="reset" style="margin-top:8px">Réinitialiser mes données</button></div>`;
}

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
  $('#view').innerHTML = { pistes: renderPistes, route: renderRoute, day: renderDay, meet: renderMeet, about: renderAbout }[S.tab]();
}
const updateList = () => { const l = $('#plist'); if (l) l.innerHTML = listHtml(); };
const updateCands = () => { const l = $('#clist'); if (l) l.innerHTML = candHtml(); };

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
    case 'openlift': liftSheet(d.id); break;
    case 'view': f.view = d.v; save(); render(); break;
    case 'allcolors': f.colors = []; save(); render(); break;
    case 'color': f.colors = f.colors.includes(d.c) ? f.colors.filter(c => c !== d.c) : [...f.colors, d.c]; save(); render(); break;
    case 'sort': f.sort = d.k; save(); render(); break;
    case 'filters': f.open = !f.open; save(); render(); break;
    case 'pick': sheetVote = +d.n; pisteSheet(el.closest('[data-rate]').dataset.rate); break;
    case 'validate': S.votes[d.id] = sheetVote ?? S.votes[d.id]; save(); toast('Merci ! Ta note est enregistrée.'); pisteSheet(d.id); render(); break;
    case 'heart': S.hearts = S.hearts.includes(d.id) ? S.hearts.filter(h => h !== d.id) : [...S.hearts, d.id]; save(); pisteSheet(d.id); render(); break;
    case 'skied': addLog({ type: 'piste', cands: [d.id], altFrom: pisteOf(d.id).altFrom, altTo: pisteOf(d.id).altTo, t: Date.now(), manual: true }); toast('Ajoutée à ta journée'); break;
    case 'addstep': S.draft.push({ k: d.k, id: d.id }); save(); toast('Ajouté à ton parcours.'); if (S.tab === 'route') render(); break;
    case 'rm': S.draft.splice(+d.i, 1); save(); render(); break;
    case 'clear': S.draft = []; save(); render(); break;
    case 'rspeed': S.rf.speed = d.v; save(); render(); break;
    case 'rkind': S.rf.kind = d.v; save(); render(); break;
    case 'rcolor': S.rf.colors = S.rf.colors.includes(d.c) ? S.rf.colors.filter(c => c !== d.c) : [...S.rf.colors, d.c]; save(); render(); break;
    case 'download': S.route = { stationId: S.station, steps: S.draft.slice(), speed: S.rf.speed, savedAt: Date.now() }; save(); toast('Parcours téléchargé : utilisable sans réseau.'); render(); break;
    case 'loadsaved': S.draft = S.route.steps.slice(); S.rf.speed = S.route.speed; save(); render(); break;
    case 'delsaved': S.route = null; save(); render(); break;
    case 'gstart': guide = { steps: draftSteps(), idx: 0 }; startTracking(); speak(stepText(guide.steps[0])); render(); break;
    case 'gnext': advanceGuide(); break;
    case 'gstop': guide = null; render(); break;
    case 'track': if (watchId !== null) stopTracking(); else startTracking(); render(); break;
    case 'pocket': enterPocket(); break;
    case 'resolve': { const l = S.log[todayKey()].filter(x => x.stationId === S.station)[+d.k]; l.pick = d.id; save(); render(); break; }
    case 'pend': pending[d.id] = +d.n; render(); break;
    case 'sendvotes': Object.entries(pending).forEach(([id, n]) => S.votes[id] = n); toast(`${Object.keys(pending).length} note(s) enregistrée(s). Merci !`); pending = {}; save(); render(); break;
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
    case 'froute': { const fr = S.friends[d.k]; S.draft = fr.r.steps.slice(); S.rf.speed = fr.r.speed; S.tab = 'route'; save(); render(); toast('Parcours de ' + fr.n + ' chargé.'); break; }
    case 'send': { const i = $('#chatin'), v = i.value.trim(); if (!v) break;
      (S.chat[chatKey()] = S.chat[chatKey()] || []).push({ who: S.profile.pseudo || 'Skieur', lvl: S.level, status: S.profile.status, t: hhmm(Date.now()), text: v, me: true }); save(); render(); break; }
    case 'reset': if (confirm('Effacer toutes tes données SKIP ?')) { localStorage.removeItem(KEY); location.reload(); } break;
  }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'q') { S.filt.q = t.value; updateList(); }
  else if (t.id === 'rq') { S.rf.q = t.value; updateCands(); }
  else if (t.dataset.range === 'level') { S.level = +t.value; $('#lvl').textContent = t.value; save(); updateList(); }
  else if (t.dataset.range === 'level2') { S.level = +t.value; save(); }
});
document.addEventListener('change', e => {
  const t = e.target, b = t.dataset.bind;
  if (b === 'fit') { S.filt.fit = t.checked; save(); updateList(); }
  else if (b === 'sector') { S.filt.sector = t.value; save(); updateList(); }
  else if (b === 'rsector') { S.rf.sector = t.value; save(); updateCands(); }
  else if (b === 'audio') { S.audio = t.checked; save(); }
  else if (t.id === 'pseudo') { S.profile.pseudo = t.value.trim().slice(0, 30); save(); }
  else if (t.dataset.range === 'level2') { render(); }
  else if (t.id === 'manual' && t.value) { const p = pisteOf(t.value); addLog({ type: 'piste', cands: [p.id], altFrom: p.altFrom, altTo: p.altTo, t: Date.now(), manual: true }); render(); }
  else if (t.id === 'simsel' && t.value) { simulateDescent(t.value); }
});
$('#station').addEventListener('change', e => { S.station = e.target.value; guide = null; pending = {}; trk = Engine.newTracker(); S.draft = []; save(); render(); });
(() => { let tm; const p = $('#pocket'), go = () => { tm = setTimeout(exitPocket, 1000); }, no = () => clearTimeout(tm);
  p.addEventListener('pointerdown', go); p.addEventListener('pointerup', no); p.addEventListener('pointerleave', no); })();

/* ---------- Réseau, temps d'écran, démarrage ---------- */
const netState = () => { $('#net').hidden = navigator.onLine; };
window.addEventListener('online', netState); window.addEventListener('offline', netState);
setInterval(() => { if (document.visibilityState === 'visible' && $('#pocket').hidden) { const k = todayKey(); S.screen[k] = (S.screen[k] || 0) + 1; if (S.screen[k] % 10 === 0) save(); } }, 1000);

$('#station').innerHTML = Object.values(DATA.stations).map(s => `<option value="${s.id}" ${s.id === S.station ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
render(); netState();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
