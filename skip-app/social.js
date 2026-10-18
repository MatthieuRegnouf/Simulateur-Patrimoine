/* Rencontres (intentions) et Partage (invitations).
   Sans serveur : une invitation est un LIEN qui contient le profil de l'invitant (dans la partie # de l'adresse, qui n'est jamais envoyée à un serveur).
   - Le destinataire ouvre le lien : l'invitation est enregistrée sur son téléphone AVANT toute autre étape (rien n'est perdu s'il doit d'abord saisir son pseudo).
   - Il accepte : l'invitant est ajouté à ses amis, et un lien de réponse (profil du destinataire) est proposé.
   - L'invitant ouvre ce lien de réponse : l'invitation passe à « acceptée » et le destinataire rejoint ses amis.
   Il n'existe pas d'annuaire : on ne peut chercher que parmi les personnes déjà connues de cet appareil (amis, invitations). Inviter quelqu'un de nouveau passe par un lien.
   Chargé avant app.js : les fonctions n'utilisent les variables de app.js (S, save, render…) qu'au moment de l'appel. */
const INTENTS = { ski: '⛷ Cherche des personnes pour skier', out: '🍻 Souhaite sortir dans la station', break: '☕ Disponible pour une pause ou un verre', none: 'Pas disponible pour l\'instant' };
const INTENT_SHORT = { ski: 'Cherche à skier', out: 'Veut sortir', break: 'Pause / verre', none: 'Pas disponible' };
const WHENS = { now: 'Maintenant', am: 'Ce matin', pm: 'Cet après-midi', eve: 'Ce soir' };
const SLOTS = { am: 'Matin', pm: 'Après-midi', eve: 'Soirée' };
const SOC_ID = /^[a-z0-9]{4,24}$/;

const meId = () => { if (!S.me || !SOC_ID.test(S.me.id || '')) { S.me = { id: Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3) }; save(); } return S.me.id; };
const shortId = id => String(id || '').slice(0, 4).toUpperCase();
const intentNow = it => it && it.day === todayKey() && INTENTS[it.k] && it.k !== 'none' ? it : null;   // une intention n'est valable que le jour même
const zoneName = z => (z && station().sectors[z]) || (z ? '' : 'Toute la station');

/* ---------- Profil partagé (sobre : seulement ce qui sert à se rencontrer) ---------- */
function profilePayload() {
  const pr = S.profile, it = intentNow(S.intent);
  return { u: meId(), n: pr.pseudo || 'Skieur', l: S.level, d: pr.discipline, w: pr.wants, sl: pr.slots || [], st: S.station, z: pr.zone || '', so: pr.socials, t: Date.now(),
    i: it ? { k: it.k, w: it.when, z: it.zone || '', day: it.day } : null };
}
/* Nettoie un profil reçu : tout est validé, rien n'est pris tel quel */
function cleanProfile(f) {
  if (!f || typeof f.n !== 'string' || !SOC_ID.test(String(f.u || ''))) return null;
  const so = {}; Object.entries(f.so || {}).forEach(([k, h]) => { if (NETWORKS[k] && typeof h === 'string' && HANDLE.test(h)) so[k] = h; });
  const it = f.i && INTENTS[f.i.k] && /^\d{4}-\d{2}-\d{2}$/.test(f.i.day || '') ? { k: f.i.k, w: WHENS[f.i.w] ? f.i.w : 'now', z: typeof f.i.z === 'string' ? f.i.z.slice(0, 40) : '', day: f.i.day } : null;
  return { u: f.u, n: f.n.trim().slice(0, 30) || 'Skieur', l: clamp(+f.l || 5, 1, 10), d: f.d === 'snowboard' ? 'snowboard' : 'ski', w: (Array.isArray(f.w) ? f.w : []).filter(x => WANTS.includes(x)),
    sl: (Array.isArray(f.sl) ? f.sl : []).filter(x => SLOTS[x]), st: DATA.stations[f.st] ? f.st : S.station, z: typeof f.z === 'string' ? f.z.slice(0, 40) : '', so, i: it, t: +f.t > 1.6e12 ? +f.t : Date.now(), h: [] };
}
const linkOf = (kind, extra) => location.href.split('#')[0] + '#' + kind + '=' + b64e({ ...extra, f: profilePayload() });
function newInvite(to) {
  const id = Math.random().toString(36).slice(2, 10); S.invites.sent.unshift({ id, to: (to || '').trim().slice(0, 40), t: Date.now(), status: 'sent' }); S.invites.sent = S.invites.sent.slice(0, 60); save();
  return { id, url: linkOf('invite', { k: 'inv', i: id }) };
}
function addFriend(f, via) {
  const key = f.u, old = S.friends[key]; if (!old && Object.keys(S.friends).length >= 80) return false;
  S.friends[key] = { ...(old || {}), ...f, h: (old && old.h) || [], addedAt: (old && old.addedAt) || Date.now(), via: (old && old.via) || via }; save(); return true;
}

/* ---------- Lien reçu (#invite / #accept / #hello) ---------- */
function socialDeepLink(h) {
  const m = /^#?(invite|accept|hello)=([A-Za-z0-9_-]+)/.exec(h || ''); if (!m) return false;
  history.replaceState(null, '', location.pathname + location.search);
  let o; try { o = b64d(m[2]); } catch { toast('Lien d\'invitation illisible : demande à ton ami de le renvoyer en entier.', 6000); return true; }
  const f = cleanProfile(o && o.f); if (!f) { toast('Lien d\'invitation non reconnu.', 5000); return true; }
  if (f.u === meId()) { toast('C\'est ton propre lien : envoie-le à un ami.', 4500); return true; }
  S.tab = 'meet'; S.meetView = 'friends'; const iid = typeof o.i === 'string' ? o.i.slice(0, 20) : '';
  if (m[1] === 'accept') {
    const sent = S.invites.sent.find(x => x.id === iid); if (sent) sent.status = 'accepted', sent.by = f.u;
    addFriend(f, 'accept'); save(); render(); toast(`${f.n} a accepté ton invitation et rejoint tes amis.`, 6000); return true;
  }
  if (m[1] === 'hello' && S.friends[f.u]) { addFriend(f, 'update'); render(); toast(`Profil de ${f.n} mis à jour.`, 5000); return true; }
  if (S.friends[f.u]) { addFriend(f, 'update'); render(); toast(`${f.n} est déjà dans tes amis : profil mis à jour.`, 5000); return true; }
  let r = S.invites.recv.find(x => x.id === iid && x.from.u === f.u);   // l'invitation est gardée immédiatement, même si l'utilisateur ferme l'appli ensuite
  if (!r) { r = { id: iid, from: f, t: Date.now(), status: 'pending' }; S.invites.recv.unshift(r); S.invites.recv = S.invites.recv.slice(0, 60); } else r.from = f;
  save(); render(); inviteSheet(r.id, f.u); return true;
}
function personCardHtml(f, extra) {
  return `<div class="me-card"><div class="avatar">${esc((f.n || '?')[0].toUpperCase())}</div><div class="sp"><b>${esc(f.n)}</b> <span class="mut">#${esc(shortId(f.u))}</span><br>
    <span class="mut">${f.d === 'snowboard' ? 'Snowboard' : 'Ski'} · niveau ${fmt1(f.l)}/10 · ${esc(DATA.stations[f.st]?.name || '')}${f.z && DATA.stations[f.st]?.sectors[f.z] ? ' · ' + esc(DATA.stations[f.st].sectors[f.z]) : ''}</span>${extra || ''}</div></div>`;
}
function inviteSheet(iid, uid) {
  const r = S.invites.recv.find(x => x.id === iid && x.from.u === uid); if (!r) return; const f = r.from, it = intentNow(f.i), needName = !S.profile.pseudo;
  openSheet(`<h2>Invitation reçue</h2>${personCardHtml(f, it ? `<br><span class="badge">${esc(INTENT_SHORT[it.k])} · ${esc(WHENS[it.w])}</span>` : '')}
    ${f.w.length ? `<div class="mut" style="margin-top:6px">Envies : ${f.w.map(esc).join(' · ')}</div>` : ''}
    <p class="mut" style="margin:10px 0 6px">${esc(f.n)} t'invite à se retrouver sur SKIP. Cette invitation est déjà enregistrée sur ton téléphone : tu peux répondre plus tard.</p>
    ${needName ? '<div class="mut">Ton pseudo (pour que ton ami te reconnaisse)</div><input type="text" id="invname" maxlength="30" placeholder="Ton pseudo" aria-label="Ton pseudo" style="margin:4px 0 10px">' : ''}
    <div class="row" style="gap:8px"><button class="btn" data-action="invaccept" data-id="${esc(iid)}" data-u="${esc(uid)}">Accepter</button><button class="btn ghost" data-action="invlater">Plus tard</button></div>`);
}
function acceptInvite(iid, uid) {
  const r = S.invites.recv.find(x => x.id === iid && x.from.u === uid); if (!r) return;
  if (!S.profile.pseudo) { const v = ($('#invname') && $('#invname').value || '').trim(); if (!v) { toast('Indique ton pseudo pour accepter.'); return; } S.profile.pseudo = v.slice(0, 30); }
  addFriend(r.from, 'invite'); r.status = 'accepted'; save(); render();
  const url = linkOf('accept', { k: 'acc', i: iid });
  openSheet(`<h2>${esc(r.from.n)} est dans tes amis</h2><p class="mut">Pour que ${esc(r.from.n)} te retrouve aussi, envoie-lui ta réponse. Sans serveur, ${esc(r.from.n)} ne sera prévenu que lorsqu'il ouvrira ce lien.</p>${linkBoxHtml(url, `Je réponds à ton invitation SKIP : ${S.profile.pseudo}`)}`);
}
const linkBoxHtml = (url, text) => `<input type="text" id="linkbox" readonly value="${esc(url)}" aria-label="Lien" onclick="this.select()"><div class="row" style="margin-top:8px;gap:8px;flex-wrap:wrap"><button class="btn sm" data-action="linksend" data-text="${esc(text)}">📤 Envoyer</button><button class="btn sm sec" data-action="linkcopy">Copier</button></div>
  <div class="mut" id="linkmsg" style="margin-top:6px"></div>`;
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch { /* repli */ }
  try { const i = $('#linkbox') || Object.assign(document.createElement('textarea'), { value: t }); if (!i.isConnected) document.body.appendChild(i); i.select(); const ok = document.execCommand('copy'); if (!$('#linkbox')) i.remove(); return ok; } catch { return false; }
}
async function sendLink(url, text) {
  if (navigator.share) { try { await navigator.share({ title: 'SKIP', text, url }); return 'shared'; } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; /* partage indisponible (aperçu, navigateur) : repli copie */ } }
  return (await copyText(url)) ? 'copied' : 'manual';
}

/* ---------- Rencontres ---------- */
function compat(f) {
  const me = intentNow(S.intent), fi = intentNow(f.i), why = [], bad = [];
  if (f.st !== S.station) { bad.push('autre station'); }
  if (!me) bad.push('tu n\'as pas indiqué d\'intention');
  if (!fi) bad.push('pas d\'intention aujourd\'hui');
  let score = 0;
  if (me && fi) { if (me.k === fi.k) { score += 2; why.push('cherche aussi : ' + INTENT_SHORT[fi.k].toLowerCase()); } else if ([me.k, fi.k].every(k => k === 'ski' || k === 'out' || k === 'break') && (me.k === 'out' || fi.k === 'out')) { score += 1; why.push('sortie compatible'); } else bad.push('autre envie'); if ((me.when || me.w) === (fi.when || fi.w)) { score += 1; why.push('même moment'); } }
  const dl = Math.abs(f.l - S.level); if (dl <= 1.5) { score += 2; why.push('niveau proche'); } else if (dl <= 3) { score += 1; why.push('niveau un peu différent'); } else bad.push('niveau éloigné (' + fmt1(f.l) + ' vs ' + fmt1(S.level) + ')');
  const common = f.w.filter(w => S.profile.wants.includes(w)); if (common.length) { score += 1; why.push('mêmes envies : ' + common.slice(0, 2).join(', ').toLowerCase()); }
  if (f.z && S.profile.zone && f.z === S.profile.zone) { score += 1; why.push('même zone'); }
  if (f.st !== S.station || !fi || !me) return { key: 'low', label: 'Peu compatible', why, bad };
  return score >= 5 ? { key: 'good', label: 'Compatible', why, bad } : score >= 3 ? { key: 'maybe', label: 'Peut-être', why, bad } : { key: 'low', label: 'Peu compatible', why, bad };
}
const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 2 ? 'à l\'instant' : m < 60 ? `il y a ${m} min` : m < 1440 ? `il y a ${Math.round(m / 60)} h` : new Date(t).toLocaleDateString('fr-FR'); };
function peopleHtml() {
  const list = Object.values(S.friends).map(f => ({ f, it: intentNow(f.i), c: compat(f) })).sort((a, b) => (b.it ? 1 : 0) - (a.it ? 1 : 0) || ({ good: 0, maybe: 1, low: 2 }[a.c.key] - { good: 0, maybe: 1, low: 2 }[b.c.key]) || b.f.t - a.f.t);
  if (!list.length) return '<div class="card"><p class="mut" style="margin:0">Personne dans ton réseau pour l\'instant. Va dans l\'onglet Partage pour inviter un ami avec un lien.</p></div>';
  return list.map(({ f, it, c }) => `<div class="card"><div class="row" style="align-items:flex-start"><div class="sp">${personCardHtml(f)}</div><span class="badge st-${c.key === 'good' ? 'ok' : c.key === 'maybe' ? 'warn' : ''}">${c.label}</span></div>
    <div style="margin-top:8px">${it ? `<b>${esc(INTENTS[it.k])}</b> <span class="mut">· ${esc(WHENS[it.w])}${it.z && DATA.stations[f.st]?.sectors[it.z] ? ' · ' + esc(DATA.stations[f.st].sectors[it.z]) : ''}</span>` : '<span class="mut">Pas d\'intention indiquée aujourd\'hui</span>'}</div>
    ${c.why.length ? `<div class="chips" style="margin-top:6px">${c.why.map(w => `<span class="chip" style="cursor:default">✓ ${esc(w)}</span>`).join('')}</div>` : ''}${it && c.bad.length ? `<div class="mut" style="margin-top:4px">${c.bad.map(esc).join(' · ')}</div>` : ''}
    <div class="mut" style="margin-top:4px">Dernière mise à jour ${ago(f.t)} (partagée par ${esc(f.n)}, pas en direct).</div>
    ${f.w.length ? `<div class="mut">Envies : ${f.w.map(esc).join(' · ')}</div>` : ''}${f.sl && f.sl.length ? `<div class="mut">Disponible : ${f.sl.map(s => SLOTS[s]).join(', ').toLowerCase()}</div>` : ''}
    ${netLinks(f.so) ? `<div class="chips" style="margin-top:8px">${netLinks(f.so)}</div>` : ''}</div>`).join('');
}
function profileMissing() { return [!S.profile.pseudo && 'pseudo', !S.levelSet && 'niveau'].filter(Boolean); }
/* Mon profil : gestion de MON profil, dans Réglages (les profils des autres se consultent dans Rencontres) */
function profileSettingsHtml() {
  const pr = S.profile, st = station(), need = profileMissing();
  const netRows = Object.entries(NETWORKS).map(([k, n]) => {
    const h = pr.socials[k];
    if (h) return `<div class="net-row"><b class="sp">${n.name}</b><a href="${n.url(encodeURIComponent(h))}" target="_blank" rel="noopener noreferrer">@${esc(h)} ↗</a><button class="btn sm ghost" data-action="netdel" data-k="${k}">Retirer</button></div>`;
    if (netEdit === k) return `<div class="net-row" style="flex-wrap:wrap"><div class="sp mut" style="flex-basis:100%">1. <a href="${n.login}" target="_blank" rel="noopener noreferrer">Ouvre ${n.name} ↗</a> et connecte-toi. 2. Recopie ton identifiant :</div>
      <input type="text" id="nethandle" placeholder="ton identifiant" maxlength="40" aria-label="Identifiant ${n.name}" autocapitalize="off"><button class="btn sm" data-action="netsave" data-k="${k}">OK</button></div>`;
    return `<div class="net-row"><b class="sp">${n.name}</b><button class="btn sm sec" data-action="netedit" data-k="${k}">Connecter</button></div>`;
  }).join('');
  return `<div class="card"><b>👤 Mon profil</b> ${need.length ? `<span class="badge st-warn">à compléter : ${need.join(', ')}</span>` : ''}
    <div class="mut" style="margin:8px 0 4px">Pseudo <b>*</b></div><input type="text" id="pseudo" value="${esc(pr.pseudo)}" maxlength="30" placeholder="Ton pseudo" aria-label="Pseudo">
    <div class="mut" style="margin:10px 0 4px">Niveau de ski <b>*</b> : <b>${S.levelSet ? S.level + '/10' : 'non renseigné'}</b></div><input type="range" min="1" max="10" step="0.5" value="${S.level}" data-range="level2" aria-label="Mon niveau">
    <div class="mut" style="margin:10px 0 4px">Je pratique</div><div class="seg">${[['ski', '⛷ Ski'], ['snowboard', '🏂 Snowboard']].map(([k, t]) => `<button class="${pr.discipline === k ? 'on' : ''}" data-action="disc" data-k="${k}">${t}</button>`).join('')}</div>
    <div class="mut" style="margin:10px 0 4px">Ce que j'aime faire</div><div class="chips">${WANTS.map(w => `<button class="chip${pr.wants.includes(w) ? ' on' : ''}" data-action="want" data-w="${w}">${w}</button>`).join('')}</div>
    <div class="mut" style="margin:10px 0 4px">Je skie plutôt</div><div class="chips">${Object.entries(SLOTS).map(([k, t]) => `<button class="chip${(pr.slots || []).includes(k) ? ' on' : ''}" data-action="slot" data-k="${k}">${t}</button>`).join('')}</div>
    <div class="mut" style="margin:10px 0 4px">Ma zone habituelle</div><select class="f" data-bind="pzone" aria-label="Zone habituelle"><option value="">Toute la station (${esc(st.name)})</option>${Object.entries(st.sectors).map(([id, n]) => `<option value="${id}" ${pr.zone === id ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
    <div class="mut" style="margin-top:8px"><b>*</b> indispensable pour inviter et être reconnu. Mon niveau sert aussi au calcul d'itinéraire (« Mon profil »).</div>
    <details style="margin-top:8px"><summary class="mut">Mes réseaux (facultatif)</summary>${netRows}</details></div>`;
}
function findHtml() {
  const it = intentNow(S.intent) || { k: 'none', when: 'now', zone: '' }, st = station(), msgs = S.chat[chatKey()] || [];
  return `<div class="card"><b>Mon intention du moment</b> <span class="mut">· valable aujourd'hui</span>
    <div style="margin-top:8px">${Object.entries(INTENTS).map(([k, t]) => `<button class="chip${it.k === k ? ' on' : ''}" style="display:block;width:100%;text-align:left;margin-bottom:6px" data-action="intent" data-k="${k}">${t}</button>`).join('')}</div>
    ${it.k !== 'none' ? `<div class="mut">Quand ?</div><div class="chips" style="margin:4px 0 8px">${Object.entries(WHENS).map(([k, t]) => `<button class="chip${it.when === k ? ' on' : ''}" data-action="iwhen" data-k="${k}">${t}</button>`).join('')}</div>
      <div class="mut">Où ?</div><select class="f" data-bind="izone" aria-label="Zone"><option value="">Toute la station</option>${Object.entries(st.sectors).map(([id, n]) => `<option value="${id}" ${it.zone === id ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
      <button class="btn sm sec" style="margin-top:8px" data-action="sharehello">📤 Prévenir mes amis</button>` : ''}</div>
  <h3>Avec qui skier ou sortir</h3>${peopleHtml()}
  <details class="card" style="padding:10px 14px"><summary><b>💬 Chat de la station</b></summary>
    <div class="mut" style="margin:6px 0">Remis à zéro chaque jour, sur ce téléphone.</div>
    ${msgs.length ? msgs.map(m => `<div class="msg${m.me ? ' me' : ''}"><b>${esc(m.who)}</b> <span class="mut">niv. ${m.lvl} · ${esc(m.t)}</span><br>${esc(m.text)}</div>`).join('') : '<p class="mut">Aucun message aujourd\'hui.</p>'}
    <div class="row" style="margin-top:8px"><input type="text" id="chatin" placeholder="Écrire à la station…" maxlength="300" aria-label="Message"><button class="btn sm" data-action="send">Envoyer</button></div></details>`;
}
function renderMeet() {
  const v = S.meetView === 'friends' ? 'friends' : 'find', need = profileMissing(), pend = S.invites.recv.filter(r => r.status === 'pending').length;
  return `<h2>Rencontres</h2>
  <div class="seg" style="margin-bottom:10px"><button class="${v === 'find' ? 'on' : ''}" data-action="meetview" data-v="find">Skier / sortir</button><button class="${v === 'friends' ? 'on' : ''}" data-action="meetview" data-v="friends">Amis et invitations${pend ? ' (' + pend + ')' : ''}</button></div>
  ${need.length ? `<div class="warn">Complète ton profil (${need.join(', ')}) pour inviter et être reconnu. <button class="btn sm" data-action="settings">Mon profil</button></div>` : ''}
  ${v === 'find' ? findHtml() : friendsHtml()}`;
}

/* ---------- Partage ---------- */
let shareMade = null, pquery = '';
function knownPeople() {
  const m = new Map();
  Object.values(S.friends).forEach(f => m.set(f.u || f.n, { f, st: 'ami' }));
  S.invites.recv.forEach(r => { if (!m.has(r.from.u)) m.set(r.from.u, { f: r.from, st: r.status === 'pending' ? 'invitation reçue' : 'invitation ' + (r.status === 'accepted' ? 'acceptée' : 'refusée') }); });
  return [...m.values()];
}
function searchHtml() {
  const q = norm(pquery).trim(); if (!q) return '';
  const res = knownPeople().filter(({ f }) => norm(f.n).includes(q) || (f.u && norm(f.u).startsWith(q.replace(/^#/, ''))));
  const sent = S.invites.sent.filter(s => s.to && norm(s.to).includes(q));
  if (!res.length && !sent.length) return `<div class="mut" style="margin-top:8px">Aucune personne connue ne correspond à « ${esc(pquery)} ». Il n'existe pas encore d'annuaire (cela demanderait un serveur) : pour inviter quelqu'un de nouveau, crée un lien et envoie-le.</div>`;
  const dup = new Set(); const names = res.map(r => norm(r.f.n)); names.forEach((n, i) => { if (names.indexOf(n) !== i) dup.add(n); });
  return `<div style="margin-top:8px">${res.length > 1 && dup.size ? `<div class="mut">Plusieurs personnes portent le même nom : vérifie l'identifiant (#) et le niveau.</div>` : ''}
    ${res.map(({ f, st }) => `<div class="row" style="padding:6px 0;border-top:1px solid var(--line)"><div class="sp">${personCardHtml(f, `<br><span class="mut">${st}${f.addedAt ? ' · ajouté le ' + new Date(f.addedAt).toLocaleDateString('fr-FR') : ''}</span>`)}</div><button class="btn sm sec" data-action="invfor" data-n="${esc(f.n)}">Inviter</button></div>`).join('')}
    ${sent.map(s => `<div class="mut" style="padding:4px 0">Invitation envoyée « ${esc(s.to)} » le ${new Date(s.t).toLocaleDateString('fr-FR')} · ${s.status === 'accepted' ? 'acceptée' : 'en attente de réponse'}</div>`).join('')}</div>`;
}
function friendsHtml() {
  const sent = S.invites.sent, recv = S.invites.recv, friends = Object.values(S.friends).sort((a, b) => (b.addedAt || b.t) - (a.addedAt || a.t));
  const pending = recv.filter(r => r.status === 'pending');
  return `${pending.length ? `<div class="warn"><b>${pending.length} invitation(s) reçue(s) en attente.</b> ${pending.map(r => `<button class="btn sm" data-action="invopen" data-id="${esc(r.id)}" data-u="${esc(r.from.u)}">${esc(r.from.n)}</button>`).join(' ')}</div>` : ''}
  <div class="card"><b>Inviter un ami</b>
    <div class="mut" style="margin:4px 0 8px">Crée un lien lié à ton profil et envoie-le. Ton ami l'ouvre, accepte, et vous vous retrouvez dans Rencontres.</div>
    <input type="text" id="invto" maxlength="40" placeholder="Pour qui ? (facultatif, pour t'y retrouver)" aria-label="Nom de l'ami invité">
    <button class="btn" style="margin-top:8px" data-action="invmake">🔗 Créer un lien d'invitation</button>
    ${shareMade ? `<div style="margin-top:10px">${linkBoxHtml(shareMade.url, `${S.profile.pseudo || 'Un ami'} t'invite sur SKIP, l'appli des pistes d'Alpe d'Huez`)}</div>` : ''}
    ${!S.profile.pseudo ? '<div class="mut" style="margin-top:6px">Astuce : renseigne ton pseudo dans Rencontres pour que ton ami te reconnaisse.</div>' : ''}</div>
  <div class="card"><b>Chercher une personne</b>
    <input type="search" id="psearch" placeholder="Nom ou identifiant (#…)" value="${esc(pquery)}" autocomplete="off" aria-label="Rechercher une personne" style="margin-top:8px"><div id="pres">${searchHtml()}</div></div>
  <details class="card" style="padding:10px 14px" open><summary><b>Amis (${friends.length})</b></summary>${friends.length ? friends.map(f => `<div class="row" style="padding:6px 0;border-top:1px solid var(--line)"><div class="sp">${personCardHtml(f)}</div><button class="btn sm ghost" data-action="fdel" data-k="${esc(f.u || f.n.toLowerCase())}" aria-label="Retirer">✕</button></div>`).join('') : '<p class="mut">Aucun ami pour l\'instant.</p>'}</details>
  <details class="card" style="padding:10px 14px"><summary><b>Invitations envoyées (${sent.length})</b></summary>${sent.length ? sent.map(s => `<div class="row" style="padding:6px 0;border-top:1px solid var(--line)"><div class="sp"><b>${esc(s.to || 'Sans nom')}</b> <span class="mut">· ${new Date(s.t).toLocaleDateString('fr-FR')}</span></div><span class="badge st-${s.status === 'accepted' ? 'ok' : 'warn'}">${s.status === 'accepted' ? 'acceptée' : 'en attente'}</span></div>`).join('') + '<div class="mut" style="margin-top:6px">« En attente » : l\'ami n\'a pas (encore) renvoyé sa réponse. Sans serveur, tu n\'es prévenu que s\'il t\'envoie son lien de réponse.</div>' : '<p class="mut">Aucune invitation envoyée.</p>'}</details>
  <details class="card" style="padding:10px 14px"><summary><b>Invitations reçues (${recv.length})</b></summary>${recv.length ? recv.map(r => `<div class="row" style="padding:6px 0;border-top:1px solid var(--line)"><div class="sp">${personCardHtml(r.from)}</div>${r.status === 'pending' ? `<button class="btn sm" data-action="invopen" data-id="${esc(r.id)}" data-u="${esc(r.from.u)}">Répondre</button>` : `<span class="badge st-ok">${r.status === 'accepted' ? 'acceptée' : 'refusée'}</span>`}</div>`).join('') : '<p class="mut">Aucune invitation reçue.</p>'}</details>
  <details class="card" style="padding:10px 14px"><summary class="mut"><b>Partager autre chose</b></summary>
    <div class="row" style="flex-wrap:wrap;margin-top:8px"><button class="btn sm sec" data-action="share" data-k="route">🧭 Mon itinéraire</button><button class="btn sm sec" data-action="share" data-k="hearts">❤ Mes coups de cœur</button></div>
    <div class="mut" style="margin-top:10px">Message SKIP reçu (ancien format « SKIP:… ») :</div><textarea id="importtxt" rows="2" placeholder="Colle ici le message" aria-label="Message reçu" style="margin:6px 0"></textarea><button class="btn sm" data-action="import">Ajouter</button></details>`;
}

function socialAction(d) {
  switch (d.action) {
    case 'meetview': S.meetView = d.v; save(); render(); return true;
    case 'intent': S.intent = { k: d.k, when: (S.intent && S.intent.when) || 'now', zone: (S.intent && S.intent.zone) || '', day: todayKey(), t: Date.now() }; save(); render(); return true;
    case 'iwhen': S.intent = { ...(S.intent || {}), k: (S.intent && S.intent.k) || 'ski', when: d.k, day: todayKey() }; save(); render(); return true;
    case 'slot': { const sl = S.profile.slots || []; S.profile.slots = sl.includes(d.k) ? sl.filter(x => x !== d.k) : [...sl, d.k]; save(); render(); return true; }
    case 'invmake': { const to = ($('#invto') && $('#invto').value) || ''; shareMade = newInvite(to); render(); return true; }
    case 'invfor': { shareMade = newInvite(d.n); pquery = ''; render(); window.scrollTo(0, 0); return true; }
    case 'linkcopy': { const url = $('#linkbox').value; copyText(url).then(ok => { const m = $('#linkmsg'); if (m) m.textContent = ok ? 'Lien copié.' : 'Copie impossible ici : touche le lien, sélectionne-le et copie-le.'; }); return true; }
    case 'linksend': { const url = $('#linkbox').value; sendLink(url, d.text || 'SKIP').then(r => { const m = $('#linkmsg'); if (m) m.textContent = r === 'shared' ? 'Envoyé.' : r === 'copied' ? 'Le partage du téléphone n\'est pas disponible ici : lien copié, colle-le dans ta messagerie.' : r === 'manual' ? 'Ni partage ni copie automatique possibles ici : touche le lien, sélectionne-le et copie-le.' : ''; }); return true; }
    case 'sharehello': { const url = linkOf('hello', { k: 'hi' }); openSheet(`<h2>Prévenir mes amis</h2><p class="mut">Envoie ce lien : en l'ouvrant, ton ami met à jour ton profil et ton intention chez lui.</p>${linkBoxHtml(url, `${S.profile.pseudo || 'Un ami'} met à jour son profil SKIP`)}`); return true; }
    case 'invopen': inviteSheet(d.id, d.u); return true;
    case 'invaccept': acceptInvite(d.id, d.u); return true;
    case 'invlater': closeSheet(); return true;
  }
  return false;
}
