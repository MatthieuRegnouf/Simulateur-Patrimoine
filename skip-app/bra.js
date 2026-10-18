/* Bulletin d'avalanche (Météo-France, massif Grandes-Rousses) : information GÉNÉRALE, jamais une évaluation d'itinéraire.
   Règles d'affichage (voir docs/etude-nouvelles-fonctions.md §4) :
   - jamais de couleur « tout va bien » ni de mot « sûr » ; le niveau 1 se lit « faible », pas « sans danger » ;
   - bulletin absent, périmé ou illisible = « Information indisponible. Cela ne signifie pas qu'il n'y a pas de danger. » ;
   - toujours : massif entier, date d'émission, validité, et le renvoi vers le bulletin officiel complet ;
   - hors saison : le message de Météo-France est relayé tel quel.
   Les données viennent du relais (/bra.json) : la clé d'API reste côté serveur. Chargé avant app.js. */
let bra = null, braState = 'idle';
const BRA_TTL = 30 * 60000, BRA_SOURCE = 'https://meteofrance.com/meteo-montagne';
const braUrl = () => (window.SKIP_CONFIG || {}).braUrl || ((window.SKIP_CONFIG || {}).relay ? window.SKIP_CONFIG.relay.replace(/\/$/, '') + '/bra.json' : 'bra.json');
async function braLoad(force) {
  braState = 'loading'; let c = null; try { c = JSON.parse(localStorage.getItem('skip.bra')); } catch { /* ignore */ }
  if (!force && c && Date.now() - c.at < BRA_TTL) { bra = c.data; braState = 'ok'; return; }
  try {
    const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 9000), r = await fetch(braUrl(), { signal: ctl.signal }); clearTimeout(tm);
    if (!r.ok) throw new Error('HTTP ' + r.status); const d = await r.json(); if (d.schema !== 1) throw new Error('schéma');
    bra = d; try { localStorage.setItem('skip.bra', JSON.stringify({ at: Date.now(), data: d })); } catch { /* ignore */ }
  } catch { bra = c ? { ...c.data, stale: true } : null; }
  braState = bra ? 'ok' : 'none';
}
const RISK_WORD = { 1: 'faible', 2: 'limité', 3: 'marqué', 4: 'fort', 5: 'très fort' };
const RISK_STYLE = { 1: 'background:#e9eef6;color:#26364f', 2: 'background:#e9eef6;color:#26364f', 3: 'background:#ffe3b3;color:#6b3d00', 4: 'background:#ffc9c4;color:#8a1c14', 5: 'background:#e8b0ab;color:#5c0d08' };   // volontairement neutre pour 1-2 : pas de « vert rassurant »
/* État effectif du bulletin à l'instant t : 'bulletin' (valide), 'expired', 'off_season', 'unavailable' */
function braStatus(b, now = Date.now()) {
  if (!b) return 'unavailable';
  if (b.state === 'off_season') return 'off_season';
  if (b.state !== 'bulletin' || !b.risk) return 'unavailable';
  const until = b.validUntil ? new Date(b.validUntil + (/[zZ+]/.test(b.validUntil.slice(10)) ? '' : '+01:00')).getTime() : 0;   // heure de Paris quand le fuseau n'est pas précisé
  return until && now > until ? 'expired' : 'bulletin';
}
const braWhen = iso => iso ? new Date(iso + (/[zZ+]/.test(iso.slice(10)) ? '' : '+01:00')).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
const SLOPE_FR = { N: 'nord', NE: 'nord-est', E: 'est', SE: 'sud-est', S: 'sud', SW: 'sud-ouest', W: 'ouest', NW: 'nord-ouest' };
function braCardHtml(b = bra, now = Date.now()) {
  const st = braStatus(b, now), head = `<b>⚠︎ Risque d'avalanche</b> <span class="mut">· massif ${esc((b && b.massif && b.massif.name) || 'Grandes-Rousses')}</span>`;
  const foot = `<div class="mut" style="margin-top:8px">Information générale sur le massif entier : elle ne dit rien d'un itinéraire précis. Sur les pistes ouvertes, la station gère le risque ; hors piste, il ne s'applique à personne d'autre que toi. <a href="${BRA_SOURCE}" target="_blank" rel="noopener noreferrer">Bulletin officiel complet ↗</a></div>`;
  if (st === 'off_season') return `<div class="card">${head}<div class="mut" style="margin-top:6px">${esc(b.message || 'Pas de bulletin pour le moment.').replace(/\n/g, '<br>')}</div><div class="mut" style="margin-top:6px"><b>Pas de bulletin ne veut pas dire pas de danger.</b> Consulté le ${esc(braWhen(b.source && b.source.fetchedAt))}${b.stale ? ' (relais injoignable : dernière version connue)' : ''}.</div>${foot}</div>`;
  if (st !== 'bulletin') return `<div class="card">${head}<div style="margin-top:6px"><b>Information indisponible.</b> Cela ne signifie pas qu'il n'y a pas de danger.</div>${st === 'expired' ? `<div class="mut" style="margin-top:4px">Le dernier bulletin reçu (émis ${esc(braWhen(b.issuedAt))}) n'est plus valable.</div>` : ''}${foot}</div>`;
  const r = b.risk, m = r.max || r.r1, slopes = Object.entries(b.slopes || {}).filter(([, v]) => v).map(([k]) => SLOPE_FR[k]);
  return `<div class="card">${head}
    <div class="row" style="margin-top:8px;gap:10px"><div style="${RISK_STYLE[m]};border-radius:12px;padding:8px 14px;font-weight:800;font-size:20px;white-space:nowrap">${m}/5</div><div><b>Risque ${esc(RISK_WORD[m] || '')}</b>${r.r2 && r.altitude ? `<br><span class="mut">${r.r1}/5 sous ${r.altitude} m · ${r.r2}/5 au-dessus</span>` : ''}</div></div>
    ${r.comment ? `<div class="mut" style="margin-top:6px">${esc(r.comment)}</div>` : ''}
    ${b.warning ? `<div class="warn" style="margin-top:8px"><b>${esc(b.warning)}</b></div>` : ''}
    ${slopes.length ? `<div class="mut" style="margin-top:6px">Pentes les plus dangereuses : ${slopes.join(', ')}.</div>` : ''}
    ${b.summary ? `<details style="margin-top:6px"><summary class="mut">Résumé du bulletin</summary><div class="mut" style="margin-top:4px">${esc(b.summary).replace(/\n/g, '<br>')}</div></details>` : ''}
    <div class="mut" style="margin-top:6px">Émis ${esc(braWhen(b.issuedAt))} · valable jusqu'à ${esc(braWhen(b.validUntil))}${b.amended ? ' · amendé' : ''}${b.stale ? ' · relais injoignable : dernière version connue' : ''}.</div>${foot}</div>`;
}
/* Bandeau d'alerte (onglet Pistes) : seulement quand un bulletin VALIDE annonce un risque fort ou très fort */
function braBannerHtml(bra_ = bra) {
  if (braStatus(bra_) !== 'bulletin' || !bra_.risk || (bra_.risk.max || 0) < 4) return '';
  const bra = bra_;
  return `<div class="warn" style="background:#ffc9c4;color:#8a1c14"><b>Risque d'avalanche ${esc(RISK_WORD[bra.risk.max])} (${bra.risk.max}/5)</b> sur le massif ${esc(bra.massif.name)}. Reste sur les pistes ouvertes et balisées. <a href="${BRA_SOURCE}" target="_blank" rel="noopener noreferrer">Bulletin officiel ↗</a></div>`;
}

if (typeof module !== 'undefined') module.exports = { braStatus, braCardHtml, braBannerHtml };
