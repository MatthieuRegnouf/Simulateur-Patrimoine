// Organisation de l'appli : onglets, pistes, échelle 1–10, rencontres, invitations, sortie enregistrée.
// Prérequis : npm i playwright-core ; PW_CHROMIUM ; python3.   node test/e2e-app.js
// La position GPS (y compris l'altitude) est simulée par le protocole de débogage du navigateur : ce sont de vrais événements « geolocation », pas un récepteur réel.
const { chromium } = require('playwright-core'), { spawn } = require('node:child_process'), assert = require('node:assert'), path = require('node:path');
const ROOT = path.join(__dirname, '..'), PORT = 8094, URL = `http://localhost:${PORT}/index.html`, sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const web = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' }); await sleep(1200);
  const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const errs = [], ok = m => console.log('✓', m);
  const open = async (opts = {}, setup, url = URL) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, ...opts }), p = await ctx.newPage();
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && !/404|ERR_|Failed to load|net::/.test(m.text()) && errs.push(m.text()));
    await p.route('https://api.met.no/**', r => r.abort()); if (setup) await setup(p, ctx);
    await p.goto(url); await p.waitForTimeout(500); return { ctx, p };
  };
  const base = URL;
  try {
    /* ---- 1. onglets ---- */
    {
      const { ctx, p } = await open();
      assert.deepEqual(await p.$$eval('#tabs button', e => e.map(x => x.lastChild.textContent.trim())), ['Pistes', 'Itinéraire', 'Ma journée', 'Rencontres', 'Météo']);
      ok('onglets : Pistes, Itinéraire, Ma journée, Rencontres, Météo (5e) ; plus d\'onglet SKIP ni Partage');
      await p.click('[data-action=settings]'); const t = await p.textContent('#sheet'); assert.ok(/Invitations à noter/.test(t) && /OpenStreetMap/.test(t) && /Réinitialiser/.test(t)); ok('ce qui était utile dans l\'ancien onglet (sources, notifications, réinitialisation) est dans Réglages ⚙︎'); await p.click('[data-action=close]');
      await p.evaluate(() => { S.tab = 'about'; save(); }); await p.reload(); await p.waitForTimeout(500); assert.equal(await p.evaluate(() => S.tab), 'pistes'); ok('un ancien onglet « SKIP » enregistré ne casse rien');
      await ctx.close();
    }
    /* ---- 2. pistes : filtre par couleur, bulle /10, message vide, notation rapide ---- */
    {
      const { ctx, p } = await open();
      const total = await p.$$eval('#plist .piste', e => e.length); assert.equal(total, 111);
      const green = await p.evaluate(() => station().pistes.filter(x => x.color === 'green').length);
      await p.click('[data-action=color][data-c=green]'); const rows = await p.$$eval('#plist .piste .sq', e => e.map(x => x.className)); assert.equal(rows.length, green); assert.ok(rows.every(c => /green/.test(c))); ok(`un clic sur « verte » affiche directement les ${green} pistes vertes`);
      assert.match(await p.textContent('#view'), /Filtre : pistes vertes/); await p.click('[data-action=allcolors]:has-text("Retirer")'); assert.equal(await p.$$eval('#plist .piste', e => e.length), 111); ok('filtre visible et retirable en un clic');
      await p.click('[data-action=color][data-c=black]'); await p.fill('#q', 'zzzz'); await p.waitForTimeout(200);
      assert.match(await p.textContent('#plist'), /Aucune piste .* ne correspond/); await p.click('[data-action=clearfilters]'); assert.equal(await p.$$eval('#plist .piste', e => e.length), 111); ok('aucun résultat : message clair et bouton « Retirer les filtres »');
      // bulle sur 10 + avis discrets, notation rapide dans une seule fiche
      await p.evaluate(() => { setVote('sarenne-black', 8); setVote('sarenne-black', 8); render(); });
      const bubble = await p.$eval('#plist .piste[data-id="sarenne-black"] .score', e => e.textContent); assert.match(bubble, /\d.*1 avis/); ok('liste : nom, couleur, difficulté sur 10 et nombre d\'avis discret');
      await p.click('#plist .piste[data-id="sarenne-black"]'); assert.ok(await p.$('#sheet .rate [data-n="10"]') && await p.$('#sheet [data-action=heart]') && await p.$('#sheet [data-action=skied]')); ok('fiche : noter, coup de cœur et « Ma journée » dans le même écran');
      await p.click('#sheet [data-action=rate][data-n="3"]'); await p.click('#sheet [data-action=heart]'); await p.click('#sheet [data-action=skied]');
      assert.equal(await p.evaluate(() => [myVote('sarenne-black').s, S.hearts.includes('sarenne-black'), logToday().some(e => e.pick === 'sarenne-black')].join()), '3,true,true'); ok('notation rapide : trois actions, sans changer d\'écran');
      await ctx.close();
    }
    /* ---- 3. échelle 1–10 : filtre, profil, migration explicite ---- */
    {
      const { ctx, p } = await open({}, async pg => pg.addInitScript(() => { if (!localStorage.getItem('skip.v2')) localStorage.setItem('skip.v2', JSON.stringify({ rf: { start: '', end: '', budget: 120, speed: 'medium', mode: 'felt', lo: 2, hi: 3, colors: ['green'], walk: true }, level: 7, vlog: [{ id: 'sarenne-black', s: 9, t: 1.7e12, tags: [] }] })); }));
      await p.click('[data-tab=route]');
      assert.match(await p.textContent('.warn'), /sur 5 .*converti sur 10/); const sc = await p.evaluate(() => [S.rf.lo, S.rf.hi, S.rf.scale, S.vlog[0].s]); assert.deepEqual(sc, [2, 6, 10, 9]); ok('ancien réglage sur 5 (2 à 3) converti explicitement en 2 à 6 sur 10, annoncé ; la note de piste (9/10) est intacte');
      await p.click('[data-action=scaleok]'); assert.ok(!(await p.textContent('#view')).includes('converti sur 10'));
      await p.click('[data-action=rf][data-v=felt]'); assert.match(await p.textContent('#view'), /sur 10/); assert.ok(!(await p.textContent('#view')).includes('sur 5')); ok('filtre de difficulté : curseurs de 1 à 10, plus aucune mention « sur 5 »');
      assert.deepEqual(await p.evaluate(() => { const c = Nav.profileCriteria(Engine, { level: 7, levelSet: true, wants: [], discipline: 'ski' }); return [c.lo, c.hi]; }), [1, 7]); ok('profil personnel : critères en difficulté sur 10 (niveau 7 → pistes jusqu\'à 7/10)');
      await ctx.close();
    }
    /* ---- 4. itinéraire : un seul « Créer mon itinéraire », parcours principal, pas de coches parasites ---- */
    {
      const { ctx, p } = await open({ permissions: ['geolocation'], geolocation: { latitude: 45.0917, longitude: 6.07, accuracy: 10 } });
      await p.click('[data-tab=route]'); const txt0 = await p.textContent('#view'); assert.ok(!/Me proposer|Proposer un itinéraire|Suggestions/.test(txt0)); assert.equal(await p.$$eval('[data-action=plan]:not([data-next])', e => e.length), 1); ok('une seule action de calcul : « Créer mon itinéraire » (les suggestions séparées ont été fusionnées)');
      await p.evaluate(() => { S.level = 5; S.levelSet = true; save(); render(); }); await p.click('[data-action=plan]:not([data-next])'); await p.waitForSelector('#pvmap canvas');
      assert.ok(await p.$('#planres .btn.gps') && /Ouvrir le GPS/.test(await p.textContent('#planres'))); const off = await p.textContent('#offcard'); assert.ok(!/[✅❌]/.test(await p.textContent('#view'))); assert.match(off, /Télécharger hors ligne/); ok('parcours : critères → Créer → résumé + « Ouvrir le GPS » ; téléchargement hors ligne en action secondaire, sans coches ni croix');
      await p.click('.btn.gps'); await p.waitForSelector('#ntop'); assert.ok(await p.$('#nmap canvas')); ok('« Ouvrir le GPS » ouvre toujours la navigation');
      await p.click('[data-action=nquit]'); await ctx.close();
    }
    /* ---- 5. invitations de bout en bout (deux téléphones) ---- */
    {
      const A = await open({}, async pg => pg.addInitScript(() => { navigator.share = () => Promise.reject(Object.assign(new Error('blocked'), { name: 'NotAllowedError' })); }));
      await A.p.click('[data-tab=meet]'); assert.match(await A.p.textContent('#view'), /Complète ton profil/); await A.p.click('[data-action=settings]'); await A.p.fill('#pseudo', 'Marie'); await A.p.dispatchEvent('#pseudo', 'change'); await A.p.evaluate(() => { S.level = 6; S.levelSet = true; save(); }); await A.p.click('[data-action=close]');
      await A.p.click('[data-tab=meet]'); await A.p.click('[data-action=meetview][data-v=friends]'); await A.p.fill('#invto', 'Paul'); await A.p.click('[data-action=invmake]');
      const link = await A.p.inputValue('#linkbox'); assert.ok(/#invite=/.test(link)); ok('le lien d\'invitation est réellement créé : ' + link.slice(0, 60) + '…');
      await A.p.click('[data-action=linksend]'); await A.p.waitForTimeout(300); assert.match(await A.p.textContent('#linkmsg'), /copié|copie|sélectionne/); ok('partage natif refusé : repli explicite (copie), plus de bouton muet');
      assert.match(await A.p.textContent('#view'), /Invitations envoyées \(1\)/);
      // le destinataire ouvre le lien
      const B = await open({}, null, link.replace(/^https?:\/\/[^/]+/, `http://localhost:${PORT}`));
      assert.match(await B.p.textContent('#sheet'), /Invitation reçue/); assert.match(await B.p.textContent('#sheet'), /Marie/); ok('ouverture du lien : le profil de l\'invitant est identifié (pseudo, #identifiant, niveau)');
      await B.p.reload(); await B.p.waitForTimeout(500); await B.p.click('[data-tab=meet]'); await B.p.click('[data-action=meetview][data-v=friends]'); assert.match(await B.p.textContent('#view'), /invitation\(s\) reçue\(s\) en attente/); ok('l\'invitation est conservée si le destinataire quitte ou recharge avant de répondre');
      await B.p.click('[data-action=invopen]'); await B.p.fill('#invname', 'Paul'); await B.p.click('[data-action=invaccept]');
      assert.match(await B.p.textContent('#sheet'), /Marie est dans tes amis/); const reply = await B.p.inputValue('#linkbox'); assert.ok(/#accept=/.test(reply)); assert.equal(await B.p.evaluate(() => Object.values(S.friends).map(f => f.n).join()), 'Marie'); ok('acceptation : l\'invitant rejoint les amis, un lien de réponse est généré');
      // l'invitant ouvre la réponse
      await A.p.goto(reply.replace(/^https?:\/\/[^/]+/, `http://localhost:${PORT}`)); await A.p.waitForTimeout(600);
      assert.equal(await A.p.evaluate(() => S.invites.sent[0].status), 'accepted'); assert.equal(await A.p.evaluate(() => Object.values(S.friends).map(f => f.n).join()), 'Paul'); ok('la réponse est ouverte par l\'invitant : invitation « acceptée », le destinataire rejoint ses amis');
      // son propre lien, lien illisible
      await A.p.goto(link.replace(/^https?:\/\/[^/]+/, `http://localhost:${PORT}`)); await A.p.waitForTimeout(500); assert.match(await A.p.textContent('#toast'), /propre lien|déjà dans tes amis/); ok('un lien déjà utilisé ou son propre lien ne crée pas de doublon');
      await A.p.goto(`http://localhost:${PORT}/index.html#invite=%%%`); await A.p.waitForTimeout(300); await A.ctx.close(); await B.ctx.close();
    }
    /* ---- 6. recherche d'amis (homonymes) et intentions ---- */
    {
      const { ctx, p } = await open();
      await p.evaluate(() => { S.profile.pseudo = 'Moi'; S.level = 5; S.levelSet = true; S.intent = { k: 'ski', when: 'am', zone: '', day: todayKey(), t: Date.now() };
        const mk = (u, n, l, i) => cleanProfile({ u, n, l, d: 'ski', w: ['Balade'], st: 'alpe', i, t: Date.now() });
        addFriend(mk('abc123', 'Marie', 5.5, { k: 'ski', w: 'am', z: '', day: todayKey() }), 'test'); addFriend(mk('xyz789', 'Marie', 9, { k: 'none', w: 'now', day: todayKey() }), 'test'); addFriend(mk('qrs456', 'Léo', 5, { k: 'break', w: 'pm', day: todayKey() }), 'test'); save(); });
      await p.click('[data-tab=meet]'); await p.click('[data-action=meetview][data-v=friends]'); await p.fill('#psearch', 'marie'); const res = await p.textContent('#pres'); assert.ok(/#ABC1/.test(res) && /#XYZ7/.test(res) && /même nom/.test(res)); ok('deux « Marie » : identifiant #, niveau et statut affichés pour choisir la bonne avant d\'inviter');
      await p.fill('#psearch', 'inconnu'); assert.match(await p.textContent('#pres'), /Il n'existe pas encore d'annuaire/); ok('recherche sans résultat : explication honnête (pas d\'annuaire sans serveur)');
      await p.click('[data-action=meetview][data-v=find]'); const cards = await p.$$eval('#view > .card', e => e.map(x => x.textContent)); const marie1 = cards.find(c => /#ABC1/.test(c)), marie2 = cards.find(c => /#XYZ7/.test(c));
      assert.match(marie1, /Compatible/); assert.match(marie1, /cherche aussi/); assert.match(marie2, /Peu compatible/); assert.match(marie2, /Pas d'intention|autre envie|niveau éloigné/); ok('Rencontres : l\'intention et la compatibilité (niveau, envie, moment) se lisent d\'un coup d\'œil');
      assert.match(await p.textContent('#view'), /Cherche des personnes pour skier/); assert.equal(await p.evaluate(() => { S.intent.day = '2000-01-01'; return !!intentNow(S.intent); }), false); ok('l\'intention du moment expire le jour même ; elle est distincte du profil permanent');
      await ctx.close();
    }
    /* ---- 6b. Partage intégré à Rencontres ; profil dans Réglages ; hors ligne ; SOS ---- */
    {
      const { ctx, p } = await open({ serviceWorkers: 'block' });
      await p.click('[data-tab=meet]'); assert.ok(!(await p.$('[data-tab=share]'))); assert.equal(await p.$$eval('#view > .seg button', e => e.map(x => x.textContent.replace(/\s*\(\d+\)/, '').trim()).join('|')), 'Skier / sortir|Amis et invitations');
      assert.ok(!(await p.textContent('#view')).includes('Mon profil</b>') && !(await p.$('#pseudo'))); ok('Rencontres : deux vues (skier/sortir · amis et invitations) ; plus d\'onglet Partage ni de formulaire de profil');
      await p.click('[data-action=meetview][data-v=friends]'); assert.ok(await p.$('[data-action=invmake]') && await p.$('#psearch') && /Amis \(0\)/.test(await p.textContent('#view'))); ok('Amis et invitations : lien (créer, copier, envoyer), recherche, invitations reçues/envoyées, amis');
      await p.click('[data-action=settings]'); assert.match(await p.textContent('#sheet'), /Mon profil/); await p.fill('#pseudo', 'Zoé'); await p.dispatchEvent('#pseudo', 'change'); await p.click('[data-action=disc][data-k=snowboard]'); await p.click('[data-action=want][data-w="Balade"]'); await p.click('[data-action=slot][data-k=pm]');
      assert.deepEqual(await p.evaluate(() => [S.profile.pseudo, S.profile.discipline, S.profile.wants, S.profile.slots]), ['Zoé', 'snowboard', ['Balade'], ['pm']]); assert.ok(await p.$eval('#sheet [data-action=disc][data-k=snowboard]', e => e.classList.contains('on'))); ok('Réglages › Mon profil : pseudo, niveau, discipline, envies, disponibilités modifiables (la feuille se met à jour)');
      await p.click('[data-action=close]'); await p.click('[data-tab=route]'); await p.evaluate(() => { S.levelSet = true; S.rf.mode = 'profile'; save(); render(); }); assert.match(await p.textContent('.inset'), /Snowboard/); ok('le profil personnel sert toujours au calcul d\'itinéraire (snowboard pris en compte)');
      await p.evaluate(() => { S.rf.tmp = { walk: true }; save(); render(); }); await p.click('[data-action=plan]:not([data-next])'); await p.waitForSelector('#planres'); await p.waitForTimeout(4600);
      assert.match(await p.textContent('#offcard'), /Disponible en ligne uniquement\./); assert.ok(!(await p.$('[data-action=dlstart]'))); assert.ok(!/octets|cache|service worker|OpenStreetMap|PMTiles/i.test(await p.textContent('#offcard'))); ok('hors ligne non disponible (aperçu / sans service worker) : « Disponible en ligne uniquement. », aucun bouton, aucun détail technique');
      await ctx.close();
      const m = await open({ isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36' });
      await m.p.click('[data-action=sos]'); const hrefs = await m.p.$$eval('#sheet a[href^="tel:"]', e => e.map(x => x.getAttribute('href'))); assert.deepEqual(hrefs, ['tel:+33476803738', 'tel:112']);
      const sh = await m.p.textContent('#sheet'); assert.ok(/04 76 80 37 38/.test(sh) && /Secours sur les pistes/.test(sh) && /112/.test(sh) && /à revérifier chaque saison/.test(sh)); assert.ok(!/ne semble pas pouvoir passer d'appel/.test(sh)); ok('SOS : service nommé, numéro affiché (04 76 80 37 38), liens tel: vers les secours du domaine et le 112, sans appel déclenché');
      await m.p.click('[data-action=soscopy]'); await m.p.waitForTimeout(400); assert.ok(await m.p.textContent('#toast')); await m.ctx.close();
      const dsk = await open(); await dsk.p.click('[data-action=sos]'); assert.match(await dsk.p.textContent('#sheet'), /ne semble pas pouvoir passer d'appel/); assert.match(await dsk.p.textContent('#sheet'), /04 76 80 37 38/); ok('appareil sans téléphonie : numéro lisible pour le composer ailleurs + conseil alternatif');
      await dsk.ctx.close();
    }
    /* ---- 7. sortie enregistrée : démarrage, descente par le tracé GPS, pause, arrêt, bilan, rattachement à Ma journée ---- */
    {
      const { ctx, p } = await open({ permissions: ['geolocation'], geolocation: { latitude: 45.0917, longitude: 6.07, accuracy: 8 } });
      const cdp = await ctx.newCDPSession(p), set = (lat, lng, alt) => cdp.send('Emulation.setGeolocationOverride', { latitude: lat, longitude: lng, accuracy: 8, altitude: alt, altitudeAccuracy: 8 });
      const piste = await p.evaluate(() => { const D = station().pistes, idx = Nav.indexNet(NET); for (const e of idx) { const x = e.o && D.find(q => q.id === e.o); if (x && e.k === 'piste' && x.altFrom && x.altTo && x.altFrom - x.altTo > 250 && x.km && Math.abs(e.g.reduce((s, q, i) => i ? s + Nav.dist(e.g[i - 1], q) : 0, 0) - x.km * 1000) < x.km * 1000 * 0.15) return { id: x.id, name: x.name, g: e.g, a0: x.altFrom, a1: x.altTo }; } return null; });
      assert.ok(piste, 'piste de test'); await p.click('[data-tab=day]'); assert.ok(!/Temps d'écran/.test(await p.textContent('#view'))); ok('« Temps d\'écran » supprimé de Ma journée');
      await set(piste.g[0][0], piste.g[0][1], piste.a0 + 5); await p.click('[data-action=ostart]'); assert.ok(await p.evaluate(() => !!S.outing && S.outing.status === 'rec')); await p.waitForTimeout(800); ok('démarrer ma sortie : enregistrement actif');
      const N = 36; for (let i = 0; i < N; i++) { const t = i / (N - 1) * (piste.g.length - 1), j = Math.min(piste.g.length - 2, Math.floor(t)), f = t - j; await set(piste.g[j][0] + (piste.g[j + 1][0] - piste.g[j][0]) * f, piste.g[j][1] + (piste.g[j + 1][1] - piste.g[j][1]) * f, piste.a0 - (piste.a0 - piste.a1) * i / (N - 1)); await sleep(260);
        if (i === 12) { await p.click('[data-action=opause]'); const n1 = await p.evaluate(() => S.outing.pts.length); await set(45.2, 6.2, 3000); await sleep(600); assert.equal(await p.evaluate(() => S.outing.pts.length), n1); await p.click('[data-action=oresume]'); await set(piste.g[j][0], piste.g[j][1], piste.a0 - (piste.a0 - piste.a1) * i / (N - 1)); ok('pause : aucune position enregistrée pendant la pause, reprise possible'); } }
      for (let k = 1; k <= 6; k++) { await set(piste.g[piste.g.length - 1][0] + k * 2e-5, piste.g[piste.g.length - 1][1], piste.a1 + k * 12); await sleep(300); }   // remontée au pied de la piste (le déplacement de quelques mètres déclenche l'événement, comme un vrai GPS)
      const st = await p.evaluate(() => ({ pts: S.outing.pts.length, log: logToday().map(e => ({ t: e.type, pick: e.pick, cands: e.cands, conf: e.conf })) })); assert.ok(st.pts > 15, JSON.stringify(st));
      const d = st.log.find(e => e.t === 'piste'); assert.ok(d, 'descente détectée : ' + JSON.stringify(st.log) + ' ' + JSON.stringify(await p.evaluate(() => ({ alts: S.outing.pts.map(q => q[2]), trk: { dir: trk.dir, ext: trk.ext, alt: trk.alt } })))); ok(`descente détectée et enregistrée automatiquement (${d.pick ? 'identifiée par le tracé : ' + d.pick : 'candidats à confirmer : ' + d.cands.join(', ')})`);
      if (d.pick) assert.equal(d.conf, 'track'); else assert.ok(d.cands.length >= 1);
      await p.evaluate(() => { window.confirm = () => true; }); await p.click('[data-action=ostop]'); await p.waitForSelector('#recmap canvas'); const rec = await p.textContent('#sheet');
      assert.match(rec, /Bilan de ma sortie/); assert.ok(/durée/.test(rec) && /km \(GPS\)/.test(rec) && /Pistes parcourues/.test(rec)); ok('bilan à l\'arrêt : carte du parcours enregistré, durée, distance, descentes, pistes');
      if (d.pick) assert.ok(rec.includes(piste.name)); else assert.match(rec, /non identifiée|Aucune piste identifiée/); ok(d.pick ? 'la piste identifiée par le tracé figure dans « Pistes parcourues »' : 'piste non identifiée avec certitude : non comptée comme parcourue');
      await p.click('[data-action=close]'); assert.match(await p.textContent('#view'), /Mes sorties/); assert.equal(await p.evaluate(() => Object.values(S.days).flat().length), 1); assert.equal(await p.evaluate(() => S.outing), null); ok('la sortie est rattachée automatiquement à « Ma journée » (aucune recopie)');
      assert.ok(await p.evaluate(() => Object.values(S.days).flat()[0].pts.length > 15)); await ctx.close();
    }
    assert.deepEqual(errs, [], errs.join('\n')); ok('aucune erreur JavaScript');
  } catch (e) { console.error('✗', e.message || e); process.exitCode = 1; }
  finally { await b.close(); web.kill(); }
})();
