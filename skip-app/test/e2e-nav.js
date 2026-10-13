// Navigation, hors ligne et profil personnel, de bout en bout dans un navigateur mobile simulé.
// Prérequis : npm i playwright-core ; PW_CHROMIUM=/chemin/vers/chromium (défaut : /opt/pw-browsers/chromium) ; python3.
//   node test/e2e-nav.js
// La position GPS est simulée par Playwright (setGeolocation) : ce sont de vrais événements « geolocation » du navigateur, mais pas un vrai récepteur GPS.
const { chromium } = require('playwright-core'), { spawn } = require('node:child_process'), assert = require('node:assert'), path = require('node:path');
const ROOT = path.join(__dirname, '..'), PORT = 8093, URL = `http://localhost:${PORT}/index.html`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const web = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' }); await sleep(1200);
  const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const errs = [], ok = m => console.log('✓', m);
  const open = async (opts = {}, setup) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'allow', ...opts }), p = await ctx.newPage();
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && !/404|ERR_|Failed to load|net::/.test(m.text()) && errs.push(m.text()));
    await p.route('https://api.met.no/**', r => r.abort()); if (setup) await setup(p, ctx);
    await p.goto(URL); await p.waitForTimeout(500); return { ctx, p };
  };
  const plan = async p => { await p.click('[data-tab=route]'); await p.click('[data-action=plan]:not([data-next])'); await p.waitForSelector('#pvmap canvas'); await p.waitForTimeout(800); };
  const pointOn = (p, k, frac = .5) => p.evaluate(([k, f]) => { const R = Nav.build(plan), r = R.ranges[k], j = Math.floor(r.p0 + (r.p1 - r.p0) * f); return R.pts[j].p; }, [k, frac]);
  const GEO = { permissions: ['geolocation'], geolocation: { latitude: 45.0917, longitude: 6.07, accuracy: 10 } };
  try {
    /* ---- 1. carte d'aperçu : fond vectoriel, tracé, mise en évidence d'une étape ---- */
    {
      const { ctx, p } = await open(GEO); await plan(p);
      const st = await p.evaluate(() => pvMap.stats()); assert.ok(st.base && st.tiles > 0 && st.errors === 0, JSON.stringify(st)); ok(`fond de carte lu et décodé (${st.tiles} tuiles, aucune erreur)`);
      await p.click('#stepslist .step[data-i="2"]'); assert.equal(await p.evaluate(() => pvMap.hi), 2); assert.ok(await p.$eval('#stepslist .step[data-i="2"]', e => e.classList.contains('sel')));
      await p.click('#stepslist .step[data-i="2"]'); assert.equal(await p.evaluate(() => pvMap.hi), null); ok('toucher une étape la met en évidence sur la carte (et la désélectionne)');
      const c = await p.evaluate(() => { const c = consistency(plan); return { gaps: c.gaps.length, diffs: c.diffs.length }; }); assert.equal(c.diffs, 0, 'distances écrites et dessinées cohérentes'); ok(`consignes et tracé cohérents (raccords > 40 m : ${c.gaps})`);
      await ctx.close();
    }
    /* ---- 2. navigation avec position : progression, étape courante, imprécision, signal ancien, sortie de parcours ---- */
    {
      const { ctx, p } = await open(GEO); await plan(p); await p.click('[data-action=nstart]'); await p.waitForTimeout(1200);
      assert.match(await p.textContent('#ntop'), /Rejoins le départ|pas encore sur l'itinéraire/); ok('avant d\'être sur le tracé : « Rejoins le départ », aucune progression inventée');
      let pt = await pointOn(p, 1, .5); await ctx.setGeolocation({ latitude: pt[0], longitude: pt[1], accuracy: 10 }); await p.waitForTimeout(1800);
      let s = await p.evaluate(() => ({ s: nv.st.s, step: nv.st.step, on: nv.st.onRoute })); assert.equal(s.on, true); assert.equal(s.step, 1); ok(`position sur le tracé : étape ${s.step + 1}, ${Math.round(s.s)} m parcourus`);
      assert.match(await p.textContent('#ntop'), /Descendez/); assert.match(await p.textContent('#nbot'), /Parcouru/);
      // imprécise
      const s0 = s.s; pt = await pointOn(p, 1, .8); await ctx.setGeolocation({ latitude: pt[0], longitude: pt[1], accuracy: 200 }); await p.waitForTimeout(1800);
      assert.match(await p.textContent('#ntop'), /imprécise/); assert.equal(await p.evaluate(() => nv.st.s), s0); ok('position imprécise (± 200 m) : signalée, progression gelée');
      // signal ancien
      await p.evaluate(() => { nv.st.fix.t -= 60000; }); await p.waitForTimeout(1500); assert.match(await p.textContent('#ntop'), /Pas de nouvelle position|interrompu/); ok('signal interrompu : signalé');
      // retour précis, puis sortie de parcours (4 points hors couloir sur 9 s)
      pt = await pointOn(p, 1, .8); await ctx.setGeolocation({ latitude: pt[0], longitude: pt[1], accuracy: 8 }); await p.waitForTimeout(1500); assert.ok(await p.evaluate(() => nv.st.onRoute));
      for (let i = 0; i < 5; i++) { await ctx.setGeolocation({ latitude: pt[0] + 0.0031 + i * 1e-5, longitude: pt[1] + 0.0031, accuracy: 8 }); await p.waitForTimeout(2300); }
      assert.ok(await p.evaluate(() => nv.st.off), 'sortie de parcours confirmée'); assert.match(await p.textContent('#ntop'), /plus sur l'itinéraire/);
      assert.ok(await p.$('[data-action=nrecalc]') && await p.$('[data-action=nrejoin]') && await p.$('[data-action=nignore]')); ok('sortie de parcours : 3 choix proposés (recalcul, revenir au tracé, ignorer), rien n\'est recalculé tout seul');
      assert.equal(await p.evaluate(() => nv.st.off && plan.recalc), undefined);
      // recalcul impossible loin du réseau
      await p.click('[data-action=nrecalc]'); await p.waitForTimeout(300); assert.match(await p.textContent('#toast'), /Pas de recalcul possible/); ok('recalcul refusé quand aucun point connu à moins de 150 m (aucun itinéraire inventé)');
      // suivi manuel
      await p.click('[data-action=nnext]'); assert.equal(await p.evaluate(() => nv.st.step), 2); await p.click('[data-action=nprev]'); assert.equal(await p.evaluate(() => nv.st.step), 1); ok('boutons étape précédente / suivante');
      await p.click('[data-action=nquit]'); assert.equal(await p.evaluate(() => nv), null); ok('quitter la navigation libère la localisation');
      await ctx.close();
    }
    /* ---- 3. localisation refusée / indisponible : l'écran le dit et le suivi manuel reste possible ---- */
    {
      const { ctx, p } = await open({}, async pg => pg.addInitScript(() => { navigator.geolocation.watchPosition = (ok, ko) => { setTimeout(() => ko({ code: 1, message: 'denied' }), 50); return 1; }; navigator.geolocation.clearWatch = () => {}; }));
      await plan(p); await p.click('[data-action=nstart]'); await p.waitForTimeout(900);
      assert.match(await p.textContent('#ntop'), /Localisation refusée/); await p.click('[data-action=nnext]'); await p.click('[data-action=nnext]'); assert.ok((await p.evaluate(() => nv.st.step)) >= 1); ok('localisation refusée : message explicite, suivi manuel opérationnel');
      assert.ok(await p.$eval('[data-action=nfollow]', e => e.disabled)); ok('bouton « recentrer » désactivé sans position');
      await ctx.close();
      const x = await open({}, async pg => pg.addInitScript(() => { Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true }); }));
      await plan(x.p); await x.p.click('[data-action=nstart]'); await x.p.waitForTimeout(600); assert.match(await x.p.textContent('#ntop'), /Localisation indisponible/); ok('localisation indisponible sur l\'appareil : message explicite'); await x.ctx.close();
    }
    /* ---- 4. téléchargement hors ligne puis utilisation sans réseau (rechargement compris), recalcul hors ligne ---- */
    {
      const { ctx, p } = await open(GEO); await plan(p);
      await p.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller || true); await p.evaluate(() => navigator.serviceWorker.ready); await p.waitForTimeout(800);
      assert.match(await p.textContent('#offcard'), /Télécharger pour une utilisation hors ligne/);
      await p.click('[data-action=dlstart]'); await p.waitForFunction(() => !dl.run, null, { timeout: 30000 });
      const rec = await p.evaluate(() => ({ v: S.route.verdict, items: S.route.items.map(i => [i.key, i.ok]), at: S.route.savedAt }));
      assert.ok(rec.items.find(i => i[0] === 'map')[1] && rec.items.find(i => i[0] === 'app')[1] && rec.items.find(i => i[0] === 'route')[1], JSON.stringify(rec)); ok(`téléchargement terminé (${rec.v}) : ${rec.items.map(i => i[0] + (i[1] ? ' ✓' : ' ✗')).join(', ')}`);
      assert.ok(['complet', 'complet-avertissements'].includes(rec.v)); assert.match(await p.textContent('#offcard'), /pas du direct|Ouverture des pistes/); ok('statut hors ligne, date et mention « pas du direct » affichés');
      const bi = await p.evaluate(() => Offline.basemapInfo()); assert.ok(bi.stored && bi.bytes > 4e6); ok(`fond de carte stocké sur l'appareil (${(bi.bytes / 1e6).toFixed(1)} Mo)`);
      // plus de réseau du tout : on recharge
      await ctx.setOffline(true); await p.waitForTimeout(300); await p.reload({ timeout: 15000 }); await p.waitForTimeout(1500);
      await p.waitForFunction(() => document.querySelector('#net') && !document.querySelector('#net').hidden, null, { timeout: 15000 }).catch(async e => { const d = await p.evaluate(() => ({ on: navigator.onLine, b: document.body.innerText.slice(0, 100) })).catch(x => String(x)); throw new Error(e.message + ' | ' + JSON.stringify(d) + ' | ' + errs.slice(-3).join(' ; ')); });
      await p.click('[data-tab=route]'); assert.match(await p.textContent('#offcard'), /gardé sur ton téléphone/);
      await p.click('[data-action=loadsaved]'); await p.waitForSelector('#pvmap canvas'); await p.waitForTimeout(1500);
      let st = await p.evaluate(() => ({ from: bm.from, st: pvMap.stats() })); assert.equal(st.from, 'device'); assert.ok(st.st.tiles > 0 && st.st.errors === 0, JSON.stringify(st)); ok('hors ligne après rechargement : application, tracé et fond de carte lus depuis le téléphone');
      await p.click('[data-action=nstart]'); await p.waitForTimeout(1200); assert.match(await p.textContent('#ntop'), /Hors ligne/); ok('navigation hors ligne : bandeau « données enregistrées, pas du direct »');
      let pt = await pointOn(p, 1, .5); await ctx.setGeolocation({ latitude: pt[0], longitude: pt[1], accuracy: 9 }); await p.waitForTimeout(1800); assert.ok(await p.evaluate(() => nv.st.onRoute)); ok('position GPS et progression sans réseau');
      // hors parcours, près d'un point connu du réseau : recalcul hors ligne
      const alt = await p.evaluate(() => { const R = nv.st.route, req = plan.req, mins = Math.max(30, remainMin(plan, nv.st) + 10);
        for (let i = 0; i < NET.nodes.length; i++) { const n = NET.nodes[i]; if (!(n.alt > 0) || !n.out || !n.out.length) continue;
          const d = Math.min(...R.pts.map(q => Nav.dist(q.p, [n.lat, n.lng]))); if (d < 120 || d > 900) continue;
          if (!computePlan({ ...req, start: i, end: plan.opt.end, budget: mins, variant: 0 }).error) return [n.lat, n.lng]; }
        return null; });
      assert.ok(alt, 'un nœud hors parcours existe');
      for (let i = 0; i < 5; i++) { await ctx.setGeolocation({ latitude: alt[0], longitude: alt[1], accuracy: 8 }); await p.waitForTimeout(2300); }
      assert.ok(await p.evaluate(() => nv.st.off)); const before = await p.evaluate(() => planId(plan)); await p.click('[data-action=nrecalc]'); await p.waitForTimeout(800);
      const after = await p.evaluate(() => ({ id: planId(plan), rc: !!plan.recalc, first: plan.steps[0].fromName, toast: document.querySelector('#toast').textContent })); assert.ok(after.rc && after.id !== before, JSON.stringify(after)); ok(`recalcul d'itinéraire hors ligne depuis la position (nouveau départ : ${after.first})`);
      assert.match(await p.textContent('#ntop'), /recalculé/); await ctx.close();
    }
    /* ---- 5. téléchargement incomplet : coupure réseau pendant le fond de carte ---- */
    {
      const { ctx, p } = await open(GEO, async pg => { await pg.route('**/basemap/alpe.pmtiles', r => r.fulfill({ status: 200, headers: { 'content-length': '5431935', 'content-type': 'application/octet-stream' }, body: Buffer.alloc(100000, 1) })); });
      await plan(p); await p.click('[data-action=dlstart]'); await p.waitForFunction(() => !dl.run, null, { timeout: 30000 });
      const r = await p.evaluate(() => ({ v: S.route && S.route.verdict, map: S.route && S.route.items.find(i => i.key === 'map') }));
      assert.ok(r.v === 'partiel' && !r.map.ok && r.map.detail.length > 10, JSON.stringify(r)); assert.match(await p.textContent('#offcard'), /Incomplet/); assert.match(await p.textContent('#offcard'), /❌/); ok(`téléchargement incomplet détecté et expliqué : « ${r.map.detail} »`);
      assert.equal((await p.evaluate(() => Offline.basemapInfo())).stored, false); ok('un fond de carte incomplet n\'est jamais gardé');
      await p.click('[data-action=nstart]'); await p.waitForTimeout(900); assert.ok(await p.$('#ntop')); assert.match(await p.textContent('#ntop'), /Rejoins|écart|Recherche|pas encore/); ok('la navigation reste utilisable sans fond de carte (tracé seul)');
      await ctx.close();
    }
    /* ---- 6. profil personnel : absent / incomplet / complet, ajustement temporaire sans toucher au profil ---- */
    {
      const { ctx, p } = await open({}); await p.click('[data-tab=route]'); await p.click('[data-action=rf][data-v=profile]');
      assert.match(await p.textContent('.inset'), /Une seule information manque : ton niveau/); ok('profil absent : seule la question du niveau est posée');
      await p.click('[data-action=plan]:not([data-next])'); assert.match(await p.textContent('#view > .warn'), /indique ton niveau/); ok('aucun calcul tant que le niveau manque (ou un autre mode)');
      const prof0 = await p.evaluate(() => JSON.stringify([S.level, S.levelSet, S.profile]));
      await p.click('[data-action=plvtmp]'); assert.equal(await p.evaluate(() => JSON.stringify([S.level, S.levelSet, S.profile])), prof0); await p.click('[data-action=plan]:not([data-next])'); await p.waitForSelector('#pvmap canvas');
      assert.ok(await p.evaluate(() => !!plan.opt.profile)); assert.match(await p.textContent('.card:has(#stepslist)').catch(() => ''), /./); ok('niveau utilisé seulement pour ce trajet : le profil enregistré n\'a pas changé');
      // profil complet
      await p.evaluate(() => { S.level = 6; S.levelSet = true; S.profile.wants = ['Progresser', 'Photos']; S.profile.discipline = 'ski'; S.rf.tmp = {}; save(); render(); });
      const crit = await p.evaluate(() => { const c = profCrit(); return { lo: c.lo, hi: c.hi, ign: c.ignored.map(i => i.label) }; }); assert.ok(crit.hi >= 3); assert.ok(crit.ign.some(x => /photos/.test(x))); assert.match(await p.textContent('.inset'), /Niveau 6\/10/); assert.match(await p.textContent('.inset'), /Non pris en compte/); ok(`profil complet : critères (paliers ${crit.lo}-${crit.hi}) et champs ignorés affichés`);
      await p.click('[data-action=plan]:not([data-next])'); await p.waitForSelector('#pvmap canvas'); const hi = await p.evaluate(() => plan.opt.hiL); assert.equal(hi, crit.hi); assert.match(await p.textContent('body'), /Calculée avec ton profil/); ok('l\'itinéraire est calculé avec ces critères et l\'explique');
      // ajustement temporaire
      const snap = await p.evaluate(() => JSON.stringify([S.level, S.levelSet, S.profile, S.hearts]));
      await p.click('summary:has-text("Ajuster pour cet itinéraire")').catch(() => {}); await p.click('[data-action=plvl][data-d="-0.5"]'); await p.click('[data-action=plvl][data-d="-0.5"]'); await p.click('[data-action=plvl][data-d="-0.5"]'); await p.click('[data-action=plvl][data-d="-0.5"]');
      assert.match(await p.textContent('.inset'), /ajusté, profil inchangé/); assert.equal(await p.evaluate(() => JSON.stringify([S.level, S.levelSet, S.profile, S.hearts])), snap);
      const hi2 = await p.evaluate(() => profCrit().hi); assert.ok(hi2 <= crit.hi);
      await p.click('[data-action=pwant][data-w="Famille"]'); assert.equal(await p.evaluate(() => JSON.stringify([S.level, S.levelSet, S.profile, S.hearts])), snap); ok('ajustements temporaires (niveau, envies) : profil enregistré inchangé');
      await p.click('[data-action=preset]'); assert.equal(await p.evaluate(() => JSON.stringify(S.rf.tmp)), '{}'); ok('« Revenir à mon profil » efface les ajustements');
      await p.click('summary:has-text("Ajuster pour cet itinéraire")'); await p.click('[data-action=plvl][data-d="0.5"]'); await p.click('[data-action=psave]'); assert.equal(await p.evaluate(() => S.level), 6.5); ok('« Enregistrer » modifie le profil seulement sur demande explicite');
      // snowboard : pas de chemin à pied par défaut, réactivable pour le trajet
      await p.evaluate(() => { S.profile.discipline = 'snowboard'; S.rf.tmp = {}; save(); render(); }); assert.equal(await p.evaluate(() => effectiveForm().walk), false);
      await p.evaluate(() => { S.rf.tmp = { walk: true }; }); assert.equal(await p.evaluate(() => effectiveForm().walk), true); ok('snowboard : chemins à pied évités, réactivables pour le trajet');
      await ctx.close();
    }
    assert.deepEqual(errs, [], errs.join('\n')); ok('aucune erreur JavaScript');
  } catch (e) { console.error('✗', e.message || e); process.exitCode = 1; }
  finally { await b.close(); web.kill(); }
})();
