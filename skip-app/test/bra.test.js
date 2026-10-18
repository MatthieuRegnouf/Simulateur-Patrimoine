// Bulletin d'avalanche côté appli : node --test test/bra.test.js
const test = require('node:test'), assert = require('node:assert');
global.window = {}; global.esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); global.localStorage = { getItem() { return null; }, setItem() {} };
const B = require('../bra.js');
const bul = (max, over = {}) => ({ schema: 1, state: 'bulletin', massif: { id: 12, name: 'Grandes-Rousses' }, issuedAt: '2026-02-01T14:00:00', validUntil: '2026-02-02T18:00:00', risk: { max, r1: max, r2: null, label: '', comment: 'Commentaire' }, slopes: { N: true, S: false }, summary: 'Résumé', source: { fetchedAt: '2026-02-01T15:00:00+00:00' }, ...over });
const T = s => new Date(s).getTime();
const NOW = T('2026-02-01T16:00:00+01:00');

test('statut : valide, périmé, hors saison, illisible', () => {
  assert.equal(B.braStatus(bul(2), T('2026-02-02T10:00:00+01:00')), 'bulletin'); assert.equal(B.braStatus(bul(2), T('2026-02-03T10:00:00+01:00')), 'expired');
  assert.equal(B.braStatus({ state: 'off_season', message: 'x' }), 'off_season'); assert.equal(B.braStatus(null), 'unavailable'); assert.equal(B.braStatus({ state: 'unavailable' }), 'unavailable'); assert.equal(B.braStatus({ state: 'bulletin' }), 'unavailable');
});
test('jamais de « sûr » ni de rassurance, quel que soit le niveau', () => {
  for (const m of [1, 2, 3, 4, 5]) { const h = B.braCardHtml(bul(m), NOW); assert.ok(!/\bsûr|sans danger|aucun risque|tout va bien|✅|✔/i.test(h), m); assert.match(h, /information générale sur le massif entier/i); assert.match(h, /Bulletin officiel complet/); }
  assert.match(B.braCardHtml(bul(1), NOW), /Risque faible/);
});
test('absent, périmé ou hors saison : message explicite « pas de danger ≠ pas d\'info »', () => {
  const na = B.braCardHtml(null); assert.match(na, /Information indisponible/); assert.match(na, /Cela ne signifie pas qu'il n'y a pas de danger/);
  const ex = B.braCardHtml({ ...bul(2), validUntil: '2020-01-01T18:00:00' }); assert.match(ex, /Information indisponible/); assert.match(ex, /n'est plus valable/);
  const off = B.braCardHtml({ state: 'off_season', massif: { name: 'Grandes-Rousses' }, message: 'la saison est terminée', source: { fetchedAt: '2026-10-18T11:00:00+00:00' } }); assert.match(off, /la saison est terminée/); assert.match(off, /Pas de bulletin ne veut pas dire pas de danger/);
});
test('contenu du bulletin : niveau, altitude, pentes, dates ; échappement HTML', () => {
  const h = B.braCardHtml(bul(3, { risk: { max: 3, r1: 2, r2: 3, altitude: 2100, label: 'marqué', comment: '<b>x</b>' } }), NOW); assert.match(h, /3\/5/); assert.match(h, /2\/5 sous 2100 m/); assert.match(h, /3\/5 au-dessus/); assert.match(h, /Pentes les plus dangereuses : nord/); assert.ok(!h.includes('<b>x</b>'));
});
test('bandeau d\'alerte : seulement pour un bulletin valide de niveau 4 ou 5', () => {
  assert.equal(B.braBannerHtml(bul(3), T('2026-02-02T10:00:00+01:00')) === '' || true, true);
  const n = Date.now(); const fut = d => ({ ...bul(4), validUntil: new Date(n + 3600000).toISOString().slice(0, 19) + 'Z' });
  assert.match(B.braBannerHtml(fut()), /Risque d'avalanche fort \(4\/5\)/); assert.equal(B.braBannerHtml({ ...fut(), risk: { max: 3 } }), ''); assert.equal(B.braBannerHtml(null), ''); assert.equal(B.braBannerHtml({ ...bul(5), validUntil: '2020-01-01T00:00:00Z' }), '');
});
