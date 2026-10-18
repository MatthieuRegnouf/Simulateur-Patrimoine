/* Parcours prêts : parcours découverte (demi-journée, journée) et programmes (3 jours, semaine), proposés comme alternative simple au sur-mesure.
   Chaque parcours est un enchaînement exact de tronçons du réseau (parcours.js), recréé avec les durées officielles des remontées et les fermetures du jour.
   Ce sont des propositions de SKIP d'après le réseau, PAS des parcours officiels de la station (ils n'ont pas été relus par elle).
   Chargé avant app.js ; n'utilise S, NET, plan… qu'au moment de l'appel. */
const PCDATA = typeof PARCOURS !== 'undefined' ? PARCOURS : { parcours: [], programs: [] };
const FORMAT_LABEL = { half: 'Demi-journée', day: 'Journée' };
const POI_FR = { restaurant: 'restaurant', cafe: 'café', bar: 'bar', pub: 'pub', fast_food: 'snack', bakery: 'boulangerie' };
const specOf = id => PCDATA.parcours.find(p => p.id === id);
const hm2 = m => { const x = Math.round(m); return `${Math.floor(x / 60)} h ${String(x % 60).padStart(2, '0')}`; };
const clock = m => `${Math.floor(m / 60) % 24} h ${String(Math.round(m) % 60).padStart(2, '0')}`;

/* Recrée l'itinéraire d'un parcours (null si le réseau a changé et que l'enchaînement n'est plus valide) */
function pcPlan(id) {
  const sp = specOf(id); if (!sp || !NET) return null;
  const r = Engine.planFromArcs(NET, sp.arcs, { waitOf, levelOf: edgeLevel, lo: sp.lo, hi: sp.hi, colors: sp.colors, budget: sp.budget, speed: sp.speed || 'medium', walk: true });
  if (r.error) return null;
  r.req = { mode: 'felt', lo: sp.lo, hi: sp.hi, colors: sp.colors, walk: true, speed: sp.speed || 'medium' }; r.opt.lo = sp.lo; r.opt.hi = sp.hi; r.parcoursId = id; r.reasons = explain(r, routeCtx());
  return r;
}
const parseHours = h => { const m = /(\d{1,2})[:h](\d{2})\s*[-–]\s*(\d{1,2})[:h](\d{2})/.exec(h || ''); return m ? [+m[1] * 60 + +m[2], +m[3] * 60 + +m[4]] : null; };

/* Tout ce qu'on affiche sur un parcours, calculé sur l'itinéraire recréé (rien n'est écrit à la main) */
function pcInfo(sp, pl) {
  const pistes = pl.steps.filter(s => s.kind === 'piste' && s.o && pisteOf(s.o)), infos = pistes.map(s => info(pisteOf(s.o)));
  const lv = infos.map(i => i.level).sort((a, b) => a - b), colors = [...new Set(pl.steps.filter(s => s.kind === 'piste').map(s => s.color))].sort((a, b) => RANK[a] - RANK[b]);
  let peak = { alt: 0, name: '' }; pl.steps.forEach(s => { [s.altFrom, s.altTo].forEach(a => { if (a > peak.alt || (a === peak.alt && s.kind === 'lift')) peak = { alt: a, name: s.kind === 'lift' ? (s.toName || s.name) : (s.name || s.toName) }; }); });   // le point haut est nommé d'après la remontée qui y arrive quand il y en a une
  // horaires : départ entre l'ouverture du premier tapis/remontée utile et l'heure qui permet encore de prendre la dernière remontée avant sa fermeture
  let t = 0, latest = Infinity, earliest = 0, unknown = 0, firstClose = Infinity;
  pl.steps.forEach(s => { if (s.kind === 'lift') { const l = s.o && liftOf(s.o), h = l && parseHours(l.hours); if (h) { latest = Math.min(latest, h[1] - t - (s.rideMin || s.min) - 30); earliest = Math.max(earliest, h[0] - t); firstClose = Math.min(firstClose, h[1]); } else unknown++; } t += s.minF; });
  // retour : temps maximal pour rejoindre le départ depuis un point du parcours
  const back = Engine.returnTimes(NET, pl.opt.end, { speed: sp.speed || 'medium', walk: true }); let far = { m: 0, i: 0 };
  pl.steps.forEach((s, i) => { const b = back[s.to]; if (isFinite(b) && b > far.m) far = { m: Math.round(b), i, name: s.toName }; });
  // pauses possibles : restaurants, cafés, bars à moins de 120 m du tracé
  const pts = pl.steps.flatMap(s => s.coords), pauses = (typeof POIS !== 'undefined' ? POIS : []).filter(p => ['restaurant', 'cafe', 'bar', 'pub', 'fast_food'].includes(p.k)).map(p => {
    let d = 1e9; for (let i = 0; i < pts.length; i += 2) { const q = Nav.dist([p.lat, p.lng], pts[i]); if (q < d) d = q; } return { ...p, d: Math.round(d) }; }).filter(p => p.d <= 120).sort((a, b) => (b.alt || 0) - (a.alt || 0)).slice(0, 5);
  const closed = pl.steps.filter(s => s.o && isClosed(s.kind === 'lift' ? 'lift' : 'piste', s.o));
  const sectors = [...new Set(pl.steps.flatMap(s => s.o ? (thing(s.o)?.sectors || []).map(secName) : []))].map(x => x.split(' · ').slice(-1)[0]);
  return { lvLo: lv[0], lvHi: lv[lv.length - 1], colors, peak, latest: isFinite(latest) ? latest : null, earliest, unknown, firstClose: isFinite(firstClose) ? firstClose : null, far, pauses, closed, sectors,
    lifts: [...new Set(pl.steps.filter(s => s.kind === 'lift').map(s => s.name))], pistesN: [...new Set(pl.steps.filter(s => s.kind === 'piste').map(s => stepName(s)))], rated: infos.filter(i => i.n >= 5).length, nPistes: infos.length };
}

/* ---------- Écrans ---------- */
function pcCard(sp, extra) {
  const pl = pcPlan(sp.id); if (!pl) return '';
  const inf = pcInfo(sp, pl);
  return `<button class="piste" data-action="pcopen" data-id="${esc(sp.id)}" ${extra || ''} style="display:block;width:100%;text-align:left"><b>${esc(sp.title)}</b><br><span class="mut">${esc(FORMAT_LABEL[sp.format] || '')} · ≈ ${hm2(pl.total)} · ${String(pl.km).replace('.', ',')} km · ${pl.descents} descentes · difficulté ${fmt1(inf.lvLo)}–${fmt1(inf.lvHi)}/10</span><br><span class="mut">${esc(sp.tagline)}</span></button>`;
}
function discoverHtml() {
  const half = PCDATA.parcours.filter(p => p.format === 'half'), day = PCDATA.parcours.filter(p => p.format === 'day');
  if (!PCDATA.parcours.length) return '<div class="card"><p class="mut" style="margin:0">Aucun parcours prêt n\'est disponible pour cette station.</p></div>';
  const prog = PCDATA.programs.map(p => { const st = (S.programs || {})[p.id] || { done: [] };
    return `<div class="card"><b>${esc(p.title)}</b> <span class="mut">· ${p.days.length} jours · ${st.done.length}/${p.days.length} faits</span>
      ${p.days.map((d, k) => `<div class="row" style="padding:6px 0;border-top:1px solid var(--line)"><span style="width:20px">${st.done.includes(k) ? "✓" : ""}</span><div class="sp">Jour ${k + 1} · ${esc(d.title)}</div><button class="btn sm sec" data-action="pcopen" data-id="${esc(d.parcours)}" data-prog="${esc(p.id)}" data-day="${k}">Voir</button></div>`).join('')}</div>`; }).join('');
  return `<div class="mut" style="margin:0 0 10px">Des parcours déjà préparés pour découvrir la station, sans rien régler. Proposés par SKIP d'après le réseau de pistes, pas par la station.</div>
    <h3>Demi-journée</h3>${half.map(p => pcCard(p)).join('')}<h3>Journée</h3>${day.map(p => pcCard(p)).join('')}<h3>Plusieurs jours</h3>${prog}`;
}
function parcoursDetailHtml(id) {
  const sp = specOf(id), pl = sp && pcPlan(id); if (!pl) return '<div class="card"><p class="mut" style="margin:0">Ce parcours n\'est plus valide avec le réseau actuel.</p><button class="btn sm" data-action="pcback">← Parcours prêts</button></div>';
  const inf = pcInfo(sp, pl), prog = pcCtx && pcCtx.prog ? PCDATA.programs.find(p => p.id === pcCtx.prog) : null, day = pcCtx && pcCtx.day != null ? +pcCtx.day : null;
  const done = prog && ((S.programs || {})[prog.id] || { done: [] }).done.includes(day);
  const colorTxt = inf.colors.map(c => colorName(c).toLowerCase()).join(', '), tooHard = S.levelSet && inf.lvHi > S.level + 1.5;
  return `<button class="btn sm ghost" data-action="pcback">← Parcours prêts</button>
    <h2 style="margin:10px 0 2px">${esc(sp.title)}</h2>
    <div class="mut">${prog ? `Jour ${day + 1} sur ${prog.days.length} · ${esc(prog.title)} · ` : ''}${esc(FORMAT_LABEL[sp.format] || '')} · départ « ${esc(sp.startName)} »</div>
    <p style="margin:8px 0">${esc(sp.tagline)}</p>
    ${inf.closed.length ? `<div class="warn"><b>Fermé aujourd'hui sur ce parcours :</b> ${inf.closed.map(s => esc(stepName(s))).join(', ')}. <button class="btn sm" data-action="pcvariant" data-id="${esc(id)}">Calculer une variante</button></div>` : ''}
    <div class="stats"><div><b>≈ ${hm2(pl.total)}</b><span>durée</span></div><div><b>${String(pl.km).replace('.', ',')}</b><span>km skiés</span></div><div><b>${pl.descents}</b><span>descentes</span></div><div><b>${pl.steps.filter(s => s.kind === 'lift').length}</b><span>remontées</span></div></div>
    <div class="card" style="margin-top:10px"><b>Niveau requis</b><div class="mut">À l'aise sur pistes ${esc(colorTxt)} · difficulté de ${fmt1(inf.lvLo)} à ${fmt1(inf.lvHi)} sur 10${inf.rated < inf.nPistes ? ' (en partie estimée : certaines pistes ont peu de votes)' : ''}.</div>
      ${tooHard ? `<div class="warn" style="margin-top:6px">Ce parcours monte jusqu'à ${fmt1(inf.lvHi)}/10 : plus que ton niveau (${S.level}/10). Choisis plutôt un parcours plus facile.</div>` : ''}
      <div class="mut" style="margin-top:6px"><b>Durée</b> hors pauses et hors attentes inconnues. Pour déjeuner, compte 1 h de plus.</div></div>
    <div class="row" style="gap:8px"><button class="btn" data-action="pcgo" data-id="${esc(id)}">🧭 Ouvrir le GPS</button><button class="btn sec" data-action="pcview" data-id="${esc(id)}">Voir sur la carte</button></div>
    <div class="card" style="margin-top:12px"><b>Horaires et retour</b>
      <div class="mut" style="margin-top:4px">${inf.latest != null ? `Départ conseillé entre ${clock(Math.max(inf.earliest, 8 * 60))} et ${clock(inf.latest)} : ${inf.latest < 9 * 60 ? 'cette journée est trop longue pour les horaires de fermeture indiqués.' : 'au-delà, une remontée du parcours (la première ferme à ' + clock(inf.firstClose) + ') risque d\'être manquée.'}${inf.unknown ? ` Horaires inconnus pour ${inf.unknown} remontée(s).` : ''} Horaires officiels du flux de la station : à confirmer le jour même.` : 'Horaires des remontées indisponibles : renseigne-toi sur place.'}</div>
      <div class="mut" style="margin-top:4px">${inf.far.m ? `Retour au départ : au plus ${inf.far.m} min depuis le point le plus éloigné (« ${esc(inf.far.name)} », après l'étape ${inf.far.i + 1}), en suivant le réseau de pistes et de remontées.` : ''} Navettes et bus : information non disponible.</div></div>
    <div class="card"><b>Points d'intérêt</b>
      <div class="mut" style="margin-top:4px">Point le plus haut : ${inf.peak.alt} m${inf.peak.name ? ` (${esc(inf.peak.name)})` : ''}. Secteurs traversés : ${inf.sectors.map(esc).join(', ') || '—'}.</div>
      <div style="margin-top:8px"><b>Pauses possibles</b></div>${inf.pauses.length ? inf.pauses.map(p => `<div class="mut">${p.k === 'cafe' || p.k === 'bar' || p.k === 'pub' ? '☕' : '🍴'} ${esc(p.n)} · ${POI_FR[p.k] || p.k} · ${p.alt || '?'} m · à ${p.d} m du tracé</div>`).join('') + '<div class="mut" style="margin-top:4px">Horaires et avis non renseignés : à vérifier sur place (données OpenStreetMap).</div>' : '<div class="mut">Aucun établissement référencé à moins de 120 m du tracé.</div>'}</div>
    <details class="card" style="padding:10px 14px"><summary><b>Remontées et pistes (${inf.lifts.length} + ${inf.pistesN.length})</b></summary>
      <div class="mut" style="margin-top:6px"><b>Remontées :</b> ${inf.lifts.map(esc).join(' · ')}</div><div class="mut" style="margin-top:4px"><b>Pistes, dans l'ordre :</b> ${inf.pistesN.map(esc).join(' → ')}</div></details>
    ${prog ? `<button class="btn ${done ? 'ghost' : 'sec'}" data-action="pcdone" data-prog="${esc(prog.id)}" data-day="${day}">${done ? '✓ Jour fait (annuler)' : 'Marquer ce jour comme fait'}</button>` : ''}
    <p class="mut" style="margin-top:10px">${esc(sp.review)} Vérifie les fermetures et les conditions le jour même.</p>`;
}
let pcCtx = null;
function discoverAction(d) {
  switch (d.action) {
    case 'rview': S.routeView = d.v; pcCtx = null; save(); render(); return true;
    case 'pcopen': pcCtx = { id: d.id, prog: d.prog || null, day: d.day != null ? d.day : null }; S.routeView = 'ready'; render(); window.scrollTo(0, 0); return true;
    case 'pcback': pcCtx = null; render(); return true;
    case 'pcview': case 'pcgo': { const pl = pcPlan(d.id); if (!pl) return true; plan = pl; planMsg = ''; selStep = null; S.routeView = 'custom'; S.tab = 'route'; save(); render(); window.scrollTo(0, 0); if (d.action === 'pcgo') startNav(); return true; }
    case 'pcdone': { S.programs = S.programs || {}; const st = S.programs[d.prog] = S.programs[d.prog] || { done: [] }, k = +d.day; st.done = st.done.includes(k) ? st.done.filter(x => x !== k) : [...st.done, k]; save(); render(); return true; }
    case 'pcvariant': { const sp = specOf(d.id), s = sp && startIndex(sp.startName); if (!sp) return true;
      const r = computePlan({ mode: 'felt', lo: sp.lo, hi: sp.hi, colors: sp.colors, walk: true, speed: sp.speed || 'medium', start: s, end: s, budget: sp.budget, variant: 0 });
      if (r.error) { toast('Aucune variante trouvée avec les fermetures du jour.', 5000); return true; }
      plan = r; plan.req = { mode: 'felt', lo: sp.lo, hi: sp.hi, colors: sp.colors, walk: true, speed: sp.speed || 'medium' }; plan.opt.lo = sp.lo; plan.opt.hi = sp.hi; plan.reasons = explain(plan, routeCtx()); plan.variantOf = sp.title;
      S.routeView = 'custom'; save(); render(); toast('Variante calculée sans les éléments fermés : ce n\'est plus le parcours préparé.', 6000); return true; }
  }
  return false;
}
