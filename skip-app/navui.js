/* Interface de la carte, de la navigation, du hors-ligne et du profil personnel.
   Chargé AVANT app.js : ne définit que des fonctions ; elles s'appuient sur les variables de app.js (S, plan, NET, render…) au moment de l'appel. */

/* ---------- Fond de carte ---------- */
let bm = { pm: null, from: '', error: '', busy: false, date: '', tried: false };
let pvMap = null, navMap = null, selStep = null, netCache = null, showNet = false;
async function loadBasemap(prefer) {
  bm.busy = true; bm.tried = true; updateBaseNote();
  const r = await Offline.openBasemap(prefer); let date = '';
  if (r.pm) { try { const md = await r.pm.getMetadata(); date = (md['planetiler:osm:osmosisreplicationtime'] || '').slice(0, 10); } catch { /* sans date */ } }
  bm = { pm: r.pm, from: r.from || '', error: r.error || '', busy: false, date, tried: true };
  [pvMap, navMap].forEach(m => m && m.setBase(bm.pm)); updateBaseNote();
}
const frDate = iso => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '';
const baseNote = () => bm.busy ? 'Chargement du fond de carte…' : bm.pm
  ? (bm.from === 'device' ? '🗺 Fond de carte gardé sur ton téléphone : il fonctionne sans réseau.' : '🗺 Fond de carte lu par le réseau. Télécharge l\'itinéraire pour l\'avoir sans réseau.') + (bm.date ? ` Données OpenStreetMap du ${frDate(bm.date)}.` : '')
  : '⚠︎ Pas de fond de carte : ' + (bm.error || 'indisponible.') + ' Le tracé et les étapes restent affichés.';
function updateBaseNote() { const n = $('#pvnote'); if (n) n.textContent = baseNote(); }
function netEdges() { return netCache || (netCache = NET.edges.map(e => ({ k: e.k, c: e.c, g: NET.geom(e) }))); }

/* ---------- Carte d'aperçu (onglet Itinéraire) ---------- */
const planId = pl => { let h = 5381; const s = pl.steps.map(x => x.edges.join('.')).join('|'); for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h >>> 0); };
function previewHtml() {
  return `<div class="mapbox" id="pvmap" style="height:min(62vh,420px)"></div>
    <div class="legend"><span><i class="lg solid"></i> piste (couleur officielle)</span><span><i class="lg dash"></i> remontée</span><span><i class="lg dot"></i> à pied</span><span><i class="lg dash2"></i> liaison à ski</span><span>① numéro d'étape · ➤ sens</span></div>
    <label class="chk" style="padding:2px 0"><input type="checkbox" data-bind="pvnet" ${showNet ? 'checked' : ''}> Montrer aussi les autres pistes (en transparence)</label>
    <div class="mut" id="pvnote">${esc(baseNote())}</div>
    <div class="mut" style="margin-top:4px">Touche une étape de la liste, ou le tracé, pour la mettre en évidence. Les consignes écrites et le tracé viennent des mêmes données.</div>
    ${consistencyHtml(plan)}`;
}
/* Cohérence consignes / tracé : on compare ce qui est écrit (distance de l'étape) à ce qui est dessiné, et on signale les raccords approximatifs */
function consistency(pl) {
  const R = Nav.build(pl), out = { gaps: [], diffs: [] };
  pl.steps.forEach((s, i) => {
    const drawn = R.ranges[i].s1 - R.ranges[i].s0; if (s.m > 50 && Math.abs(drawn - s.m) / s.m > 0.2) out.diffs.push({ i, drawn: Math.round(drawn), written: Math.round(s.m) });
    if (i > 0) { const g = Nav.dist(pl.steps[i - 1].coords[pl.steps[i - 1].coords.length - 1], s.coords[0]); if (g > 40) out.gaps.push({ i, m: Math.round(g) }); }
  });
  return out;
}
function consistencyHtml(pl) {
  if (!pl) return ''; const c = consistency(pl); if (!c.gaps.length && !c.diffs.length) return '';
  return `<div class="warn" style="margin-top:8px">Précision des données : ${c.gaps.length ? `à ${c.gaps.length} endroit${c.gaps.length > 1 ? 's' : ''}, le point d'arrivée d'une étape est à plus de 40 m du départ de la suivante (${c.gaps.map(g => `étapes ${g.i}→${g.i + 1} : ${g.m} m`).join(', ')}) : le tracé OpenStreetMap n'est pas raccordé finement, suis alors les panneaux. ` : ''}${c.diffs.length ? `Distance écrite et distance dessinée différentes pour ${c.diffs.map(d => `l'étape ${d.i + 1} (${d.written} m écrits, ${d.drawn} m dessinés)`).join(', ')}.` : ''}</div>`;
}
function mountPreview() {
  if (pvMap) { pvMap.destroy(); pvMap = null; }
  const h = $('#pvmap'); if (!h || !plan) return;
  pvMap = SkiMap.create(h, { pm: bm.pm, onSelect: i => selectStep(i, true), pad: { t: 24, b: 24, l: 24, r: 24 } });
  pvMap.setRoute(plan, Nav.build(plan)); pvMap.setNetwork(netEdges(), showNet); pvMap.fit();
  if (selStep != null && selStep < plan.steps.length) pvMap.highlight(selStep, true);
  if (!bm.tried) loadBasemap();
}
function selectStep(i, scroll) {
  selStep = selStep === i && !scroll ? null : i;
  document.querySelectorAll('#stepslist .step').forEach(el => el.classList.toggle('sel', +el.dataset.i === selStep));
  if (pvMap) { if (selStep == null) { pvMap.highlight(null); pvMap.fit(); } else pvMap.highlight(selStep, true); }
  if (scroll && selStep != null) document.querySelector(`#stepslist .step[data-i="${selStep}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/* ---------- Hors ligne : téléchargement et état ---------- */
let dl = { run: false, got: 0, total: 0, items: [], ctl: null };
const fmtDT = t => new Date(t).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
const mo = b => (b / 1048576).toFixed(1).replace('.', ',') + ' Mo';
const VERDICT = { 'complet': ['ok', 'Complet'], 'complet-avertissements': ['warn', 'Complet, avec avertissements'], 'partiel': ['warn', 'Incomplet'], 'echec': ['bad', 'Échec'] };
let offStat = { checked: false, map: null, miss: [] };
async function refreshOffStat() {
  const bi = await Offline.basemapInfo(), sh = await Offline.checkShell(false);
  offStat = { checked: true, map: bi.stored, miss: sh.missing, supported: bi.supported }; updateOffCard();
}
function itemsHtml(items) {
  return items.map(it => `<div class="net-row"><span style="width:22px">${it.ok ? '✅' : it.required ? '❌' : '⚠︎'}</span><div class="sp"><b>${esc(it.label)}</b><div class="mut">${esc(it.detail || '')}</div></div></div>`).join('');
}
function whatWorksHtml() {
  return `<details class="mut" style="margin-top:8px"><summary><b>Sans réseau, ça marche / ça ne marche pas</b></summary>
    <p style="margin:6px 0 2px"><b>✅ Sans réseau</b> (si l'itinéraire est complet) : carte et tracé · étapes écrites · ta position GPS (le GPS du téléphone n'a pas besoin d'internet, mais peut être plus lent à démarrer) · avancement et détection de sortie de parcours · <b>recalcul d'itinéraire depuis ta position</b> : le calcul se fait sur le téléphone, avec les pistes et remontées connues et les fermetures enregistrées au moment du téléchargement · tes notes (envoyées plus tard).</p>
    <p style="margin:2px 0"><b>🌐 Besoin de réseau</b> : ouverture et fermetures en direct · temps d'attente en direct · météo · notes des autres skieurs · mise à jour du fond de carte. Hors ligne, l'appli n'affiche que les <b>dernières données enregistrées, datées</b>, jamais présentées comme du direct.</p>
    <p style="margin:2px 0"><b>⚠︎ Limites</b> : un recalcul ne marche que si tu es à moins de 150 m d'un point connu du réseau. Les liaisons viennent d'OpenStreetMap et peuvent être approximatives. Le téléphone peut effacer le stockage si l'espace manque : l'état affiché ci-dessus est revérifié à chaque ouverture.</p></details>`;
}
function offCardHtml() {
  const sv = S.route && S.route.stationId === S.station ? S.route : null;
  const bar = dl.run ? `<div class="bar" style="margin:8px 0"><i id="dlbar" style="width:${dl.total ? Math.round(dl.got / dl.total * 100) : 5}%"></i></div><div class="mut" id="dltxt">${dl.total ? `Fond de carte : ${mo(dl.got)} sur ${mo(dl.total)}` : 'Téléchargement…'}</div>${itemsHtml(dl.items)}<div class="row" style="margin-top:8px"><button class="btn sm ghost" data-action="dlcancel">Annuler</button></div>` : '';
  const cur = plan && sv && sv.planId === planId(plan);
  if (dl.run) return `<b>📥 Téléchargement pour l'utilisation hors ligne…</b>${bar}`;
  if (!sv) return plan ? `<b>📥 Utilisation hors ligne</b><p class="mut" style="margin:6px 0">Garde cet itinéraire sur ton téléphone : tracé, étapes écrites, application et fond de carte de la zone (≈ 5,4 Mo). Tu pourras naviguer sans réseau en montagne.</p>
      <button class="btn" data-action="dlstart">Télécharger pour une utilisation hors ligne</button>${whatWorksHtml()}` : '';
  const v = sv.items ? VERDICT[sv.verdict] || VERDICT.partiel : ['warn', 'Ancien enregistrement : tracé seul'];
  const mapGone = offStat.checked && sv.items && sv.items.find(i => i.key === 'map' && i.ok) && offStat.map === false, shellGone = offStat.checked && offStat.miss.length;
  return `<b>📥 ${cur ? 'Cet itinéraire est' : 'Un itinéraire est'} gardé sur ton téléphone</b> <span class="badge st-${v[0]}">${v[1]}</span>
    <div class="mut" style="margin:4px 0">Téléchargé le ${fmtDT(sv.savedAt)} · ${sv.plan.steps.length} étapes · ${String(sv.plan.km).replace('.', ',')} km skiés${cur ? '' : ' · différent de celui affiché'}${navigator.onLine ? '' : ' · <b>hors ligne</b>'}</div>
    ${sv.items ? itemsHtml(sv.items) : '<div class="mut">Cet ancien enregistrement ne contient ni fond de carte ni vérification : retélécharge-le.</div>'}
    ${mapGone ? '<div class="warn" style="margin-top:6px">⚠︎ Le téléphone a effacé le fond de carte téléchargé. Retélécharge l\'itinéraire.</div>' : ''}${shellGone ? `<div class="warn" style="margin-top:6px">⚠︎ Fichiers de l'appli absents du cache : ${esc(offStat.miss.join(', '))}. Reconnecte-toi puis mets à jour.</div>` : ''}
    <div class="mut" style="margin-top:6px">${sv.liveAt ? `Ouverture des pistes : instantané du ${esc(dm(sv.liveAt))} à ${esc(hm(sv.liveAt))}, <b>pas du direct</b>.` : 'Ouverture des pistes : non enregistrée.'} ${sv.wxAt ? `Météo : prévisions du ${esc(dm(sv.wxAt))} à ${esc(hm(sv.wxAt))}, <b>pas du direct</b>.` : 'Météo : non enregistrée.'} Temps d'attente : estimations, jamais du direct hors ligne.${sv.mapDate ? ` Fond de carte : données OpenStreetMap du ${frDate(sv.mapDate)}.` : ''}</div>
    <div class="row" style="margin-top:8px;flex-wrap:wrap"><button class="btn sm" data-action="${cur ? 'nstart' : 'loadsaved'}">${cur ? '🧭 Ouvrir le GPS' : 'Ouvrir cet itinéraire'}</button><button class="btn sm sec" data-action="dlstart" ${navigator.onLine ? '' : 'disabled'}>${sv.verdict === 'complet' ? 'Mettre à jour' : 'Réessayer le téléchargement'}</button><button class="btn sm ghost" data-action="delsaved">Supprimer</button></div>
    ${navigator.onLine ? '' : '<div class="mut" style="margin-top:4px">Mise à jour impossible sans réseau.</div>'}${whatWorksHtml()}`;
}
function updateOffCard() { const c = $('#offcard'); if (c) c.innerHTML = offCardHtml(); }
async function downloadPackage() {
  if (!plan || dl.run) return;
  if (!navigator.onLine) { toast('Pas de réseau : le téléchargement est impossible pour l\'instant.', 4500); return; }
  dl = { run: true, got: 0, total: 0, items: [], ctl: new AbortController() }; updateOffCard();
  const thePlan = plan;
  const items = await Offline.run({ plan: thePlan, signal: dl.ctl.signal,
    onItem: (it, all) => { dl.items = all.slice(); updateOffCard(); },
    onProgress: (g, t) => { dl.got = g; dl.total = t; const b = $('#dlbar'); if (b) b.style.width = (t ? Math.round(g / t * 100) : 5) + '%'; const x = $('#dltxt'); if (x) x.textContent = `Fond de carte : ${mo(g)}${t ? ' sur ' + mo(t) : ''}`; },
    refreshLive: async () => { await liveLoad(true); return !!live && !live.snapshot && !live.stale; },
    refreshWeather: async () => { await wxLoad(true); return !!(wxData.base && wxData.base.live && !wxData.base.stale && !wxData.base.snapshot); } });
  const verdict = Offline.verdict(items);
  if (verdict === 'echec') { dl.run = false; toast('Échec du téléchargement : rien n\'a été enregistré.', 5000); dl.items = items; updateOffCard(); return; }
  await loadBasemap('device');
  S.route = { stationId: S.station, plan: thePlan, planId: planId(thePlan), savedAt: Date.now(), items, verdict, mapDate: bm.from === 'device' ? bm.date : '',
    liveAt: live && !live.snapshot ? live.data.source.feedUpdated || live.data.source.fetchedAt : null, wxAt: wxData.base && wxData.base.live && !wxData.base.snapshot ? wxData.base.updated : null };
  save(); dl.run = false; toast(verdict === 'complet' ? 'Téléchargement terminé : disponible hors ligne.' : 'Téléchargement terminé avec des éléments manquants (voir la liste).', 5000);
  refreshOffStat(); render();
}

/* ---------- Profil personnel (filtres d'itinéraire) ---------- */
const profileInput = () => ({ level: S.level, levelSet: !!S.levelSet, wants: S.profile.wants, discipline: S.profile.discipline });
const profCrit = () => Nav.profileCriteria(Engine, profileInput(), S.rf.tmp || {});
const hasTmp = () => { const t = S.rf.tmp || {}; return t.level != null || t.wants != null || t.walk != null || t.speed != null; };
/* Formulaire effectif : ce que le calcul utilise réellement */
function effectiveForm() {
  const f = S.rf; if (f.mode !== 'profile') return { mode: f.mode, lo: f.lo, hi: f.hi, colors: f.colors, speed: f.speed, walk: f.walk, profile: null };
  const c = profCrit(), t = f.tmp || {};
  return { mode: 'felt', lo: c.lo, hi: c.hi, colors: f.colors, speed: t.speed || c.speed || f.speed, walk: t.walk != null ? t.walk : c.walk === false ? false : f.walk, profile: c };
}
function profileCardHtml() {
  const c = profCrit(), t = S.rf.tmp || {}, wants = c.wants, tmp = hasTmp();
  const need = c.missing.includes('level');
  const lvl = need ? `<div class="warn"><b>Une seule information manque : ton niveau.</b> Les autres éléments de ton profil sont facultatifs.
      <div class="mut" style="margin-top:6px">Niveau : <b id="plv">${t.level != null ? t.level : S.level}</b>/10</div><input type="range" min="1" max="10" step="0.5" value="${t.level != null ? t.level : S.level}" data-range="plevel" aria-label="Niveau">
      <div class="row" style="margin-top:6px;flex-wrap:wrap"><button class="btn sm" data-action="plvsave">Enregistrer dans mon profil</button><button class="btn sm sec" data-action="plvtmp">Utiliser seulement pour cet itinéraire</button></div></div>` : '';
  return `<div class="inset"><b>👤 Calculé d'après ton profil</b>
    <div class="mut" style="margin:4px 0">Seuls les champs que ton profil contient vraiment sont utilisés.</div>
    ${lvl}
    ${need ? '' : `<div style="margin:4px 0">${c.used.map(u => `<div class="net-row"><span style="width:22px">✔︎</span><div class="sp"><b>${esc(u.label)}</b><div class="mut">${esc(u.effect)}</div></div></div>`).join('')}</div>
    ${c.ignored.length ? `<div class="mut">Non pris en compte : ${c.ignored.map(i => esc(i.label) + ' (' + esc(i.why) + ')').join(' · ')}.</div>` : ''}
    <div class="mut" style="margin-top:4px">Résultat : pistes de difficulté ${c.lo === c.hi ? c.lo : c.lo + ' à ' + c.hi}/5${c.speed ? ' · rythme ' + ({ slow: 'lent' }[c.speed] || c.speed) : ''}${c.walk === false ? ' · sans chemin à pied' : ''}.</div>`}
    ${need && t.level == null ? '' : `<details style="margin-top:8px" ${tmp ? 'open' : ''}><summary><b>Ajuster pour cet itinéraire seulement</b> ${tmp ? '<span class="badge st-warn">ajusté, profil inchangé</span>' : ''}</summary>
      <div class="mut" style="margin:6px 0 4px">Niveau pour ce trajet</div>
      <div class="row"><button class="btn sm sec" data-action="plvl" data-d="-0.5" aria-label="Moins">−</button><b style="min-width:70px;text-align:center">${c.level}/10</b><button class="btn sm sec" data-action="plvl" data-d="0.5" aria-label="Plus">+</button><span class="mut">profil : ${S.levelSet ? S.level + '/10' : 'non renseigné'}</span></div>
      <div class="mut" style="margin:8px 0 4px">Envies pour ce trajet</div>
      <div class="chips">${Nav.WANTS.map(w => `<button class="chip${wants.includes(w) ? ' on' : ''}" data-action="pwant" data-w="${esc(w)}">${esc(w)}</button>`).join('')}</div>
      ${c.walk === false ? `<label class="chk"><input type="checkbox" data-bind="ptmpwalk" ${t.walk ? 'checked' : ''}> Autoriser quand même les chemins à pied</label>` : ''}
      ${tmp ? `<div class="row" style="margin-top:8px;flex-wrap:wrap"><button class="btn sm ghost" data-action="preset">Revenir à mon profil</button><button class="btn sm sec" data-action="psave">Enregistrer ces choix dans mon profil</button></div>
        <div class="mut" style="margin-top:4px">« Enregistrer » ne modifie que le niveau et les envies. Le rythme et les chemins à pied ne font pas partie du profil.</div>` : ''}
    </details>`}
  </div>`;
}
function profileAction(d) {
  const rf = S.rf; rf.tmp = rf.tmp || {};
  switch (d.action) {
    case 'plvsave': { const v = +($('[data-range=plevel]').value); S.level = v; S.levelSet = true; delete rf.tmp.level; save(); render(); return true; }
    case 'plvtmp': { rf.tmp.level = +($('[data-range=plevel]').value); save(); render(); return true; }
    case 'plvl': { const c = profCrit(); rf.tmp.level = Math.max(1, Math.min(10, c.level + +d.d)); if (S.levelSet && rf.tmp.level === S.level) delete rf.tmp.level; save(); render(); return true; }
    case 'pwant': { const cur = profCrit().wants, nx = cur.includes(d.w) ? cur.filter(w => w !== d.w) : [...cur, d.w]; const same = nx.length === S.profile.wants.length && nx.every(w => S.profile.wants.includes(w)); if (same) delete rf.tmp.wants; else rf.tmp.wants = nx; save(); render(); return true; }
    case 'preset': rf.tmp = {}; save(); render(); return true;
    case 'psave': { const t = rf.tmp; if (t.level != null) { S.level = t.level; S.levelSet = true; } if (t.wants) S.profile.wants = t.wants.slice(); rf.tmp = {}; save(); toast('Profil mis à jour (niveau et envies).'); render(); return true; }
  }
  return false;
}

/* ---------- Navigation ---------- */
let nv = null;   // { st, watch, tick, wake, open, expanded, lastStep, off:{ignore}, said }
const KIND_ICON = { lift: '🚡', piste: '⛷', walk: '🚶', link: '↝' };
const kindCol = s => s.kind === 'piste' ? `var(--${s.color})` : s.kind === 'lift' ? '#3d4660' : '#a0702a';
function instrFor(pl, i, rem, list) {   // list : version courte pour la liste d'étapes (la distance est affichée à part)
  const s = pl.steps[i]; if (!s) return { icon: '🏁', main: 'Arrivée', sub: '' };
  const dist = rem != null ? mText(rem) : mText(s.m);
  if (s.kind === 'lift') {
    const cab = /cabine|Télécabine|Téléphérique|Télémix/i.test(liftType(s)), sub = s.viaNames && s.viaNames.length ? (cab ? `Restez dans la cabine jusqu'à ${s.toName}` : `Descendez à ${s.toName} (arrêts intermédiaires : vérifie les panneaux)`) : `Descendez à ${s.toName}`;
    return { icon: '🚡', main: `Rejoignez la remontée ${s.name}`, sub: list ? `${liftType(s)} · ${s.min} min · ${sub}` : `${sub} · ${s.min} min` };
  }
  if (s.kind === 'piste') return { icon: '⛷', main: `Prenez la piste ${stepName(s)}`, sub: list ? `${colorName(s.color)} · jusqu'à ${s.toName}` : `${colorName(s.color)} · encore ${dist} · jusqu'à ${s.toName}` };
  if (s.kind === 'walk') return { icon: '🚶', main: list ? 'Marchez' : `Marchez ${dist}`, sub: list ? `Jusqu'à ${s.toName}` : `En chaussures de ski, jusqu'à ${s.toName}` };
  return { icon: '↝', main: 'Suivez la liaison à ski', sub: list ? `Jusqu'à ${s.toName}` : `Encore ${dist} jusqu'à ${s.toName}` };
}
function nextLine(pl, i) { const n = pl.steps[i + 1]; if (!n) return 'Ensuite : arrivée.'; const x = instrFor(pl, i + 1); return 'Ensuite : ' + x.main.charAt(0).toLowerCase() + x.main.slice(1) + '.'; }
function remainMin(pl, st) {   // minutes restantes : estimation, étape en cours au prorata de la distance
  let t = 0; pl.steps.forEach((s, i) => { if (i > st.step) t += s.min + (s.waitMin || 0); else if (i === st.step) { const r = st.route.ranges[i], len = r.s1 - r.s0 || 1; t += (s.min + (s.waitMin || 0)) * (st.started ? Math.max(0, r.s1 - st.s) / len : 1); } });
  return Math.round(t);
}
function navTopHtml() {
  const st = nv.st, pl = plan, stt = Nav.statusText(st), fin = Nav.atEnd(st), i = st.step;
  let ins; const rem = st.started ? Nav.stepRemaining(st) : null;
  if (fin) ins = { icon: '🏁', main: 'Arrivée atteinte', sub: pl.steps[pl.steps.length - 1].toName };
  else if (!st.started) ins = { icon: '📍', main: `Rejoins le départ`, sub: `${pl.steps[0].fromName} — puis ${instrFor(pl, 0).main.charAt(0).toLowerCase() + instrFor(pl, 0).main.slice(1)}` };
  else ins = instrFor(pl, i, rem);
  const offBlock = st.off && !nv.ignore ? `<div class="offbox"><b>Tu n'es plus sur l'itinéraire</b> (≈ ${Math.round(st.dev)} m du tracé${st.nearest && st.pos ? `, le point du tracé le plus proche est vers le ${Nav.compass(Nav.bearing(st.pos, st.nearest.p))}` : ''}).
      <div class="mut" style="color:inherit;opacity:.9;margin:4px 0">Rien n'est recalculé tout seul. Choisis :</div>
      <div class="row" style="flex-wrap:wrap;gap:6px"><button class="btn sm" data-action="nrecalc">↻ Recalculer depuis ici</button><button class="btn sm sec" data-action="nrejoin">⤴ Revenir au tracé</button><button class="btn sm ghost" data-action="nignore">Ignorer</button></div></div>` : '';
  const off = !navigator.onLine ? `<div class="nstat">📴 Hors ligne : ouverture, météo et attentes = dernières données enregistrées${live ? ' (' + esc(dm(live.data.source.feedUpdated)) + ' ' + esc(hm(live.data.source.feedUpdated)) + ')' : ' (aucune)'}, pas du direct.</div>` : '';
  const recalc = pl.recalc ? `<div class="nstat">↻ Itinéraire recalculé à ${esc(hhmm(pl.recalc.at))} avec les données enregistrées. Non téléchargé.</div>` : '';
  return `<div class="nmain"><div class="nico" style="background:${st.started && pl.steps[i] ? kindCol(pl.steps[i]) : 'var(--brand)'}">${ins.icon}</div><div class="sp"><div class="nbig">${esc(ins.main)}</div><div class="nsub">${esc(ins.sub)}</div>${fin ? '' : `<div class="nsub nnext">${esc(nextLine(pl, i))}</div>`}</div>
      <button class="nq" data-action="nquit" aria-label="Arrêter la navigation et revenir au résumé">✕ Arrêter</button></div>
    <div class="nstat g-${stt.key}">${{ good: '🟢', fair: '🟡', poor: '🟠', stale: '🟠', denied: '🚫', unavailable: '🚫', off: '🔴', near: '🟡', wait: '⏳' }[stt.key] || ''} ${esc(stt.text)}</div>${offBlock}${off}${recalc}`;
}
function navBottomHtml() {
  const st = nv.st, pl = plan, tot = st.route.total, done = st.started ? Math.min(st.s, tot) : 0, pct = tot ? Math.round(done / tot * 100) : 0, km = m => (m / 1000).toFixed(1).replace('.', ',');
  const rows = pl.steps.map((s, k) => { const state = st.started ? (k < st.step ? 'done' : k === st.step ? 'cur' : 'todo') : 'todo', r = st.route.ranges[k];
    return `<div class="nrow ${state}${selStep === k ? ' sel' : ''}" data-action="nsel" data-i="${k}"><div class="num" style="background:${kindCol(s)}">${k + 1}</div><div class="sp"><b>${KIND_ICON[s.kind]} ${esc(instrFor(pl, k, null, true).main)}</b><div class="mut">${esc(instrFor(pl, k, null, true).sub)} · ${mText(r.s1 - r.s0)}</div></div><span>${state === 'done' ? '✔︎' : state === 'cur' ? '●' : ''}</span></div>`; }).join('');
  return `<div class="nprog"><div class="bar"><i style="width:${pct}%"></i></div>
    <div class="mut">${st.started ? `Parcouru ${km(done)} km · reste ${km(tot - done)} km · ≈ ${remainMin(pl, st)} min (estimation)` : `Itinéraire : ${km(tot)} km · ≈ ${remainMin(pl, st)} min (estimation)`}</div></div>
    <div class="row nbtn"><button class="btn sm sec" data-action="nprev" aria-label="Étape précédente">◀ Précédente</button><button class="btn sm sec" data-action="nnext">Suivante ▶</button><button class="btn sm ${nv.expanded ? '' : 'ghost'}" data-action="nlist">${nv.expanded ? '▼ Masquer' : '▲ Étapes'}</button></div>
    ${nv.expanded ? `<div class="nlist">${rows}</div>` : ''}`;
}
function navCtlHtml() {
  const f = navMap && navMap.follow;
  return `<button data-action="nzin" aria-label="Zoom avant">＋</button><button data-action="nzout" aria-label="Zoom arrière">−</button>
    <button data-action="nfollow" class="${f ? 'on' : ''}" aria-label="Recentrer sur ma position" ${nv.st.pos ? '' : 'disabled'}>🎯</button><button data-action="nfit" aria-label="Voir tout l'itinéraire">⤢</button>`;
}
let navHtmlCache = {};
function navPaint(force) {
  if (!nv) return; const parts = { top: navTopHtml(), bot: navBottomHtml(), ctl: navCtlHtml() };
  for (const [k, id] of [['top', '#ntop'], ['bot', '#nbot'], ['ctl', '#nctl']]) if (force || navHtmlCache[k] !== parts[k]) { const el = $(id); if (el) { const sc = el.querySelector('.nlist')?.scrollTop; el.innerHTML = parts[k]; const l = el.querySelector('.nlist'); if (l && sc) l.scrollTop = sc; } navHtmlCache[k] = parts[k]; }
}
function navFix(p) {
  const c = p.coords; return { lat: c.latitude, lng: c.longitude, acc: c.accuracy, alt: c.altitude, heading: c.heading, speed: c.speed, t: Date.now() };
}
function navUpdate() {
  if (!nv) return; const st = nv.st;
  navMap.setPosition(st.q === 'stale' ? null : st.fix, st.q, st.off && st.nearest ? st.nearest : null);
  if (st.started) navMap.setProgress(st.s);
  if (st.step !== nv.lastStep && st.started) { nv.lastStep = st.step; selStep = null; navMap.highlight(null); if (S.audio) { const x = Nav.atEnd(st) ? 'Arrivée atteinte.' : instrFor(plan, st.step).main + '. ' + instrFor(plan, st.step).sub; speak(x); } }
  if (st.off && !nv.wasOff) { nv.wasOff = true; nv.ignore = false; speak('Tu t\'es écarté de l\'itinéraire.'); }
  if (!st.off) { nv.wasOff = false; nv.ignore = false; }
  if (Nav.atEnd(st) && !nv.done) { nv.done = true; speak('Itinéraire terminé. Bravo !'); }
  if (st.q === 'stale' && !nv.wasStale) { nv.wasStale = true; speak('Position perdue.'); } else if (st.q !== 'stale') nv.wasStale = false;
  navPaint();
}
async function startNav() {
  if (!plan || nv) return;
  const ov = $('#nav'); ov.hidden = false; document.body.classList.add('navopen');
  ov.innerHTML = `<div id="nmap" class="nmap"></div><div id="ntop" class="ntop"></div><div id="nctl" class="nctl"></div><div id="nbot" class="nbot"></div>`;
  nv = { st: Nav.create(plan), expanded: false, lastStep: -1, tick: null, watch: null, wake: null, wasOff: false, ignore: false };
  navHtmlCache = {}; selStep = null;
  navMap = SkiMap.create($('#nmap'), { pm: bm.pm, label: 'Carte de navigation', pad: { t: 150, b: 130, l: 30, r: 60 }, onFollow: () => navPaint(), onSelect: i => { selStep = i; navMap.highlight(i); navPaint(true); } });
  navMap.setRoute(plan, nv.st.route); navMap.setNetwork(netEdges(), false); navMap.fit();
  if (!bm.tried || !bm.pm) loadBasemap(); else navMap.setBase(bm.pm);
  navPaint(true);
  if (!navigator.geolocation) { nv.st.geo = 'unavailable'; } else {
    nv.watch = navigator.geolocation.watchPosition(p => {
      const fix = navFix(p); nv.st.geo = 'ok'; const was = nv.st.started; Nav.update(nv.st, fix);
      if (!was && nv.st.started && !nv.followed) { nv.followed = true; navMap.setFollow(true, 16); }
      if (fix.alt != null) { try { handleFix({ lat: fix.lat, lng: fix.lng, alt: fix.alt, t: fix.t }); } catch { /* journal de la journée facultatif */ } }
      navUpdate();
    }, err => { nv.st.geo = err.code === 1 ? 'denied' : err.code === 3 ? 'timeout' : 'unavailable'; if (err.code === 1 && nv.watch != null) { navigator.geolocation.clearWatch(nv.watch); nv.watch = null; } navUpdate(); },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
  }
  navUpdate();
  nv.tick = setInterval(() => { Nav.tick(nv.st); navUpdate(); }, 1000);
  try { if (navigator.wakeLock) nv.wake = await navigator.wakeLock.request('screen'); } catch { /* facultatif */ }
  if (S.audio && plan.steps[0]) speak('Navigation démarrée. ' + instrFor(plan, 0).main);
}
function stopNav() {
  if (!nv) return; clearInterval(nv.tick); if (nv.watch != null) navigator.geolocation.clearWatch(nv.watch); try { nv.wake && nv.wake.release(); } catch { /* ignore */ }
  navMap && navMap.destroy(); navMap = null; nv = null; $('#nav').hidden = true; $('#nav').innerHTML = ''; document.body.classList.remove('navopen'); if (S.tab === 'route') { render(); setTimeout(() => $('#planres')?.scrollIntoView({ block: 'start' }), 30); }
}
/* Recalcul depuis la position : fonctionne sans réseau (le planificateur est dans l'appli) mais seulement près d'un point connu du réseau */
function navRecalc() {
  const st = nv.st, rs = Nav.recalcStart(Engine, NET, st.fix);
  if (!rs || rs.idx == null) { toast(`Pas de recalcul possible : le point connu le plus proche est à ${rs ? Math.round(rs.dist) : '?'} m (maximum 150 m). Reviens vers une piste ou une remontée.`, 6500); return; }
  const req = plan.req, endIdx = plan.opt.end, minLeft = Math.max(30, remainMin(plan, st) + 10);
  const r = computePlan({ ...req, start: rs.idx, end: endIdx, budget: minLeft, variant: 0 });
  if (r.error) { toast('Aucun itinéraire trouvé d\'ici jusqu\'à l\'arrivée prévue avec tes filtres (le réseau connu ne permet pas de la rejoindre). Reviens vers le tracé.', 7000); return; }
  r.recalc = { at: Date.now(), from: rs.node.label || 'position' }; r.req = req; r.opt.loL = plan.opt.loL; r.opt.hiL = plan.opt.hiL; r.reasons = explain(r, routeCtx());
  plan = r; selStep = null; nv.st = Nav.create(plan); nv.lastStep = -1; nv.wasOff = false; nv.ignore = false; navHtmlCache = {};
  navMap.setRoute(plan, nv.st.route); Nav.update(nv.st, nv.st.fix); navMap.fit(); navUpdate(); navPaint(true);
  speak('Itinéraire recalculé.'); toast('Itinéraire recalculé depuis ta position (données enregistrées).', 4500);
}
function navAction(d) {
  switch (d.action) {
    case 'dlstart': downloadPackage(); return true;
    case 'dlcancel': dl.ctl && dl.ctl.abort(); return true;
    case 'selstep': selectStep(+d.i, false); return true;
    case 'nstart': startNav(); return true;
    case 'nquit': stopNav(); return true;
    case 'nzin': navMap.zoomBy(1); return true;
    case 'nzout': navMap.zoomBy(-1); return true;
    case 'nfit': navMap.fit(); return true;
    case 'nfollow': navMap.setFollow(!navMap.follow, 16); navPaint(true); return true;
    case 'nlist': nv.expanded = !nv.expanded; navPaint(true); return true;
    case 'nsel': selStep = selStep === +d.i ? null : +d.i; navMap.highlight(selStep, true); navMap.setFollow(false); navPaint(true); return true;
    case 'nnext': Nav.jump(nv.st, Math.min(plan.steps.length - 1, nv.st.step + (nv.st.started ? 1 : 0))); navMap.setProgress(nv.st.s); navUpdate(); return true;
    case 'nprev': Nav.jump(nv.st, Math.max(0, nv.st.step - 1)); navMap.setProgress(nv.st.s); navUpdate(); return true;
    case 'nignore': nv.ignore = true; navPaint(true); return true;
    case 'nrejoin': if (nv.st.nearest) { nv.ignore = false; navMap.setFollow(false); navMap.centerOn(nv.st.nearest.p[0], nv.st.nearest.p[1], 16.5); toast(`Le point du tracé le plus proche est à ${Math.round(nv.st.dev)} m${nv.st.pos ? ', vers le ' + Nav.compass(Nav.bearing(nv.st.pos, nv.st.nearest.p)) : ''}. Rejoins-le en suivant la ligne rouge.`, 6000); } return true;
    case 'nrecalc': navRecalc(); return true;
  }
  return profileAction(d);
}
function afterRender() { if (S.tab === 'route') { mountPreview(); if (!offStat.checked) refreshOffStat(); } else if (pvMap) { pvMap.destroy(); pvMap = null; } }
