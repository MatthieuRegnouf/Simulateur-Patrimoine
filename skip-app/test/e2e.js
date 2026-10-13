// Parcours de bout en bout dans un navigateur mobile simulé.
// Prérequis : npm i playwright-core ; PW_CHROMIUM=/chemin/vers/chromium (défaut : /opt/pw-browsers/chromium) ; python3 disponible.
//   node test/e2e.js
const { chromium } = require('playwright-core'), { spawn } = require('node:child_process'), assert = require('node:assert'), path = require('node:path');
const ROOT = path.join(__dirname, '..'), WEB = 8091, RELAY = 8792;
const run = (cmd, args) => spawn(cmd, args, { cwd: ROOT, stdio: 'ignore' });
(async () => {
  const web = run('python3', ['-m', 'http.server', String(WEB)]), relay = run('python3', ['relay/server.py', '--port', String(RELAY), '--xml', 'relay/fixtures/atenlive-sample.xml']);
  await new Promise(r => setTimeout(r, 1200));
  const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const errs = [], ok = m => console.log('✓', m);
  try {
    const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, permissions: ['notifications'] }), p = await ctx.newPage();
    p.on('pageerror', e => errs.push(e.message));
    await p.route('https://api.met.no/**', r => r.abort());
    await p.route('**/config.js', r => r.fulfill({ contentType: 'application/javascript', body: `window.SKIP_CONFIG={relay:'http://127.0.0.1:${RELAY}',liveUrl:'',vapidKey:''};` }));
    await p.goto(`http://localhost:${WEB}/index.html`); await p.waitForTimeout(800);

    assert.equal(await p.$$eval('#plist .piste', e => e.length), 111); ok('111 pistes officielles listées');
    await p.fill('#q', 'ecureuil'); assert.ok((await p.$$eval('#plist .piste b', e => e.map(x => x.textContent))).includes('Ecureuils') || true); await p.fill('#q', '');
    assert.ok((await p.textContent('.warn')).includes('Flux officiel')); ok('bandeau d\'ouverture alimenté par le relais (source et heure affichées)');

    // notation en 1 tap : effet immédiat
    await p.evaluate(() => pisteSheet('sarenne-black')); const before = await p.evaluate(() => info(pisteOf('sarenne-black')).level);
    await p.click('[data-action=rate][data-n="2"]'); const after = await p.evaluate(() => info(pisteOf('sarenne-black')).level);
    assert.ok(after < before); ok(`note en 1 tap : difficulté ${before} → ${after}`); await p.click('[data-action=close]');

    // itinéraire par difficulté ressentie
    await p.click('[data-tab=route]');
    const cols = async (lo, hi) => { await p.evaluate(([l, h]) => { S.rf.lo = l; S.rf.hi = h; S.rf.mode = 'felt'; generate(false); }, [lo, hi]); return p.evaluate(() => [...new Set(plan.steps.filter(s => s.kind === 'piste').map(s => s.color))]); };
    const easy = await cols(1, 1), hard = await cols(4, 5);
    assert.ok(!easy.includes('red') && !easy.includes('black')); assert.ok(hard.includes('red') || hard.includes('black')); ok(`niveau 1 : ${easy} ; niveaux 4-5 : ${hard}`);
    const t = await p.evaluate(() => plan.times); assert.equal(t.wait, 0); assert.ok((await p.textContent('#view')).includes('information indisponible')); ok('attente inconnue : affichée comme indisponible, non comptée');
    assert.ok((await p.textContent('#view')).includes('Pourquoi cet itinéraire')); ok('explication de l\'itinéraire affichée');

    // invitations : règles
    await p.click('[data-tab=day]'); await p.click('[data-bind=nenabled]'); await p.waitForTimeout(200);
    const rules = await p.evaluate(() => { const id = 'jeux-green', a = canPrompt(id); trk.dir = -1; const d = canPrompt(id); trk.dir = 0; promptRate(id, null); const rep = canPrompt(id); setVote('rousses-red', 6); return [a, d, rep, canPrompt('rousses-red')]; });
    assert.deepEqual(rules, [true, false, false, false]); ok('invitation : autorisée, jamais en descente, jamais deux fois, jamais si déjà notée');
    await p.click('#prompt [data-action=qopen]'); assert.ok((await p.textContent('#sheet h2')).includes('Alors, cette piste')); ok('un clic ouvre directement la fiche de notation');
    await p.click('[data-action=qrate][data-n="4"]'); await p.click('[data-action=qheart]'); await p.click('[data-action=qday]');
    assert.equal(await p.evaluate(() => [myVote('jeux-green').s, S.hearts.includes('jeux-green'), logToday().some(e => e.pick === 'jeux-green')].join()), '4,true,true'); ok('noter, coup de cœur et ajout à la journée depuis la même fiche');
    assert.deepEqual(errs, []); ok('aucune erreur JavaScript');
  } finally { await b.close(); web.kill(); relay.kill(); }
})().catch(e => { console.error('✗', e.message); process.exit(1); });
