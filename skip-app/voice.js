/* Guidage vocal : choix de la voix, réglages, et décision de ce qu'il faut dire (logique pure, testée dans test/voice.test.js).
   La synthèse vocale est celle du téléphone (Web Speech API) : gratuite, sans compte, mais la qualité dépend des voix installées sur l'appareil.
   Une voix « locale » fonctionne sans réseau ; une voix « en ligne » (ex. certaines voix Google) exige une connexion. */
const Voice = (() => {
  const GOOD = /natural|neural|enhanced|am[ée]lior|premium|siri|am[ée]lie|aur[ée]lie|audrey|thomas|marie|denise|henri|vivienne|remy|google fran/i;
  const isFr = v => /^fr([-_]|$)/i.test(v.lang || '');
  const DEFAULTS = { name: '', rate: 0.95, volume: 1 };

  /* Voix françaises triées : les plus naturelles d'abord ; hors ligne, seules les voix locales sont proposées en premier */
  function list(voices, online = true) {
    return (voices || []).filter(isFr).map(v => ({ name: v.name, lang: v.lang, local: !!v.localService, score: (GOOD.test(v.name) ? 10 : 0) + (/fr[-_]FR/i.test(v.lang) ? 3 : 0) + (online ? 0 : v.localService ? 20 : -20) + (/compact/i.test(v.name) ? -4 : 0) }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  }
  const pick = (voices, name, online = true) => { const l = list(voices, online); return l.find(v => v.name === name && (online || v.local)) || l[0] || null; };

  const round50 = m => Math.max(50, Math.round(m / 50) * 50);
  const lc = s => s.charAt(0).toLowerCase() + s.slice(1);
  /* Ce qu'on dit à l'instant courant. ctx : { st (état Nav), plan, instr(plan, i) -> {main}, mem (objet persistant pour ne rien répéter) }. Renvoie une liste de phrases courtes. */
  function decide(ctx) {
    const { st, plan, mem } = ctx, out = [], say = (k, t) => { if (!mem[k]) { mem[k] = 1; out.push(t); } };
    if (!st) return out;
    const lostNow = st.q === 'stale' || (!st.fix && st.geo === 'timeout');
    if (lostNow) { say('lost' + (mem.lostN || 0), 'Position perdue.'); mem.wasLost = 1; return out; }
    if (mem.wasLost && (st.q === 'good' || st.q === 'fair')) { mem.wasLost = 0; mem.lostN = (mem.lostN || 0) + 1; out.push('Position retrouvée.'); }
    if (st.q === 'poor' || !st.started) return out;                 // position imprécise ou pas encore sur le tracé : on ne guide pas
    const i = st.step, s = plan.steps[i]; if (!s) return out;
    if (st.off) { say('off' + (mem.offN || 0), 'Tu t\'es écarté de l\'itinéraire.'); mem.wasOff = 1; return out; }
    if (mem.wasOff) { mem.wasOff = 0; mem.offN = (mem.offN || 0) + 1; }
    const nowMain = ctx.instr(plan, i).main;
    if (st.s > 0 && i === plan.steps.length - 1 && st.route.total - st.s < 25) { say('end', 'Vous êtes arrivé.'); return out; }
    say('step' + i + ':' + (plan.recalc ? plan.recalc.at : 0), nowMain + '.');
    const rem = st.route.ranges[i].s1 - st.s, len = st.route.ranges[i].s1 - st.route.ranges[i].s0, nx = plan.steps[i + 1];
    if (nx && len > 350 && rem <= (s.kind === 'lift' ? 120 : 200) && rem > 25) say('appr' + i, `Dans ${round50(rem)} mètres, ${lc(ctx.instr(plan, i + 1).main)}.`);
    return out;
  }

  /* Prononce un texte avec les réglages. Renvoie false si la synthèse est indisponible. */
  function say(text, set, voices, online = true) {
    if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') return false;
    try {
      const u = new SpeechSynthesisUtterance(text), v = pick(voices || speechSynthesis.getVoices(), set && set.name, online), d = { ...DEFAULTS, ...set };
      u.lang = 'fr-FR'; if (v) { const real = (voices || speechSynthesis.getVoices()).find(x => x.name === v.name); if (real) u.voice = real; }
      u.rate = d.rate; u.volume = d.volume; u.pitch = 1;
      speechSynthesis.cancel(); speechSynthesis.speak(u); return true;
    } catch { return false; }
  }
  return { list, pick, decide, say, isFr, DEFAULTS, round50 };
})();
if (typeof module !== 'undefined') module.exports = Voice;
