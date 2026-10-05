/* Anestezi Asistanı — acil durum hesaplayıcıları (lokal anestezik maksimum doz, LAST lipid emülsiyonu,
 * malign hipertermi dantrolen dozu, pediatrik acil ilaç dozları) ve kaynakça (DOI / PMID) bağlantıları.
 * Metinler i18n/*.json içindedir; sayısal değerler ve kaynak kayıtları burada tanımlıdır. */
(function () {
  'use strict';
  const AA = window.AA;
  const { T, Fmt, UI, PatientStore } = AA;
  const { esc, icon, card, sectionHeader, badge, metric, tintStyle } = UI;

  // ================================================================ Kaynakça
  // Yalnızca DOI/PMID'si doğrulanmış kayıtlar bağlantı üretir; doğrulanamayan tanımlayıcı alanı boş bırakılır.
  const REFS = {
    rosenberg2004: { cite: 'Rosenberg PH, Veering BT, Urmey WF. Maximum recommended doses of local anesthetics: a multifactorial concept. Reg Anesth Pain Med. 2004;29(6):564–575.',
      doi: '10.1016/j.rapm.2004.08.003', pmid: '15635516' },
    neal2018: { cite: 'Neal JM, Barrington MJ, Fettiplace MR, Gitman M, Memtsoudis SG, Mörwald EE, Rubin DS, Weinberg G. The Third American Society of Regional Anesthesia and Pain Medicine Practice Advisory on Local Anesthetic Systemic Toxicity: Executive Summary 2017. Reg Anesth Pain Med. 2018;43(2):113.',
      doi: '10.1097/AAP.0000000000000720', pmid: '29356773' },
    rosenberg2015: { cite: 'Rosenberg H, Pollock N, Schiemann A, Bulger T, Stowell K. Malignant hyperthermia: a review. Orphanet J Rare Dis. 2015;10:93.',
      doi: '10.1186/s13023-015-0310-1', pmid: '26238698' },
    topjian2020: { cite: 'Topjian AA, Raymond TT, Atkins D, et al. Part 4: Pediatric Basic and Advanced Life Support: 2020 American Heart Association Guidelines for Cardiopulmonary Resuscitation and Emergency Cardiovascular Care. Circulation. 2020;142(16 Suppl 2):S469–S523.',
      doi: '10.1161/CIR.0000000000000901' },
    mhaus: { cite: 'Malignant Hyperthermia Association of the United States (MHAUS). Emergency Therapy for Malignant Hyperthermia (dantrolen dozu: 2,5 mg/kg).' }
  };
  const CALC_REFS = {
    localAnestheticMax: ['rosenberg2004'],
    lastLipid: ['neal2018'],
    malignantHyperthermia: ['mhaus', 'rosenberg2015'],
    pediatricEmergency: ['topjian2020']
  };
  AA.REFS = REFS;
  AA.CALC_REFS = CALC_REFS;

  const link = (href, label) => '<a href="' + esc(href) + '" target="_blank" rel="noopener noreferrer" style="color:var(--accent);font-weight:700;text-decoration:none;margin-right:12px">' + esc(label) + ' ↗</a>';
  const refsList = ids => '<div style="display:flex;flex-direction:column;gap:12px">' + ids.map(id => {
    const r = REFS[id];
    return '<div style="font-size:12px;color:var(--textSecondary);line-height:1.45">' + esc(r.cite) +
      ((r.doi || r.pmid) ? '<div style="margin-top:4px">' + (r.doi ? link('https://doi.org/' + r.doi, 'DOI: ' + r.doi) : '') +
        (r.pmid ? link('https://pubmed.ncbi.nlm.nih.gov/' + r.pmid + '/', 'PMID: ' + r.pmid) : '') + '</div>' : '') + '</div>';
  }).join('') + '</div>';
  const refsCard = (calcId, tint) => CALC_REFS[calcId]
    ? card(sectionHeader({ title: T('emg.refs.title'), subtitle: T('emg.refs.subtitle'), icon: 'book-open', tint }) + refsList(CALC_REFS[calcId])) : '';
  AA.refsHTML = calcId => CALC_REFS[calcId] ? refsList(CALC_REFS[calcId]) : '';

  // ================================================================ Ortak yardımcılar
  const region = (name, html) => '<div data-region="' + name + '">' + html + '</div>';
  const shareLines = lines => lines.concat('— ' + T('app.name') + ' · ' + T('share.disclaimer')).join('\n');
  const shareButton = (tint = 'secondary') => '<button type="button" class="btn" style="' + tintStyle(tint) + '" data-act="share">' + icon('share') + '<span>' + esc(T('common.share')) + '</span></button>';
  const iconBtn = (act, ic, label, tint) => '<button type="button" class="circle-btn tinted" style="' + tintStyle(tint) + '" data-act="' + act + '" aria-label="' + esc(label) + '">' + icon(ic) + '</button>';
  const topRight = (calcId, tint) => iconBtn('reset', 'rotate-ccw', T('common.clear'), tint) +
    '<button type="button" class="circle-btn tinted" style="' + tintStyle(tint) + '" data-act="nav" data-to="info-' + calcId + '" aria-label="' + esc(T('info.title')) + '">' + icon('info') + '</button>';
  const weight = () => { const w = PatientStore.patient.weightKg; return w > 0 ? w : null; };
  const needWeight = tint => UI.emptyState({ icon: 'user', title: T('calc.missingPatientTitle'), message: T('emg.needWeight'), tint });
  const mg = v => Fmt.smart(Math.round(v * 100) / 100);

  // ================================================================ 1) Lokal anestezik maksimum doz
  // Maksimum dozlar: mg/kg ve (varsa) mutlak üst sınır. Rosenberg 2004'e göre bu sınırlar kanıta dayalı değildir.
  const LA = {
    lidocaine: { plain: { mgPerKg: 4.5, capMg: 300 }, epi: { mgPerKg: 7, capMg: 500 }, conc: [0.5, 1, 2] },
    bupivacaine: { plain: { mgPerKg: 2.5, capMg: 175 }, epi: { mgPerKg: 3, capMg: 225 }, conc: [0.25, 0.5, 0.75] },
    ropivacaine: { plain: { mgPerKg: 3, capMg: null }, epi: null, conc: [0.2, 0.5, 0.75, 1] }
  };
  const LA_ORDER = ['lidocaine', 'bupivacaine', 'ropivacaine'];
  const pct = v => AA.I18n.language === 'tr' ? '%' + String(v).replace('.', ',') : String(v) + '%';

  function localAnestheticScreen() {
    const key = 'la.state.v1';
    const defaults = { agent: 'lidocaine', epi: false, conc: 1 };
    const s = Object.assign({}, defaults, AA.State.load(key, {}));
    if (!LA[s.agent]) s.agent = 'lidocaine';
    const persist = () => AA.State.save(key, s);
    const tint = 'warning';
    const concOf = () => LA[s.agent].conc.includes(s.conc) ? s.conc : LA[s.agent].conc[0];
    const output = () => {
      const w = weight();
      if (!w) return null;
      const a = LA[s.agent], lim = (s.epi && a.epi) ? a.epi : a.plain, c = concOf();
      const byWeight = lim.mgPerKg * w;
      const maxMg = lim.capMg != null ? Math.min(byWeight, lim.capMg) : byWeight;
      const mgPerMl = c * 10;
      return { w, lim, byWeight, maxMg, capped: lim.capMg != null && byWeight > lim.capMg, mgPerMl, maxMl: maxMg / mgPerMl, conc: c, withEpi: !!(s.epi && a.epi) };
    };
    const agentSection = () => {
      const a = LA[s.agent];
      return card(sectionHeader({ title: T('emg.la.agent'), subtitle: T('emg.la.agentSubtitle'), icon: 'syringe', tint }) +
        UI.chips({ act: 'agent', items: LA_ORDER.map(k => ({ value: k, label: T('emg.la.' + k) })), selected: s.agent, tint }) +
        (a.epi
          ? '<div class="setting"><div><b>' + esc(T('emg.la.epi')) + '</b><span>' + esc(T('emg.la.epiCaption')) + '</span></div>' + UI.toggle({ bind: 'epi', checked: s.epi, tint, label: T('emg.la.epi') }) + '</div>'
          : '<div class="sec-sub">' + esc(T('emg.la.noEpiLimit')) + '</div>') +
        '<div style="display:flex;flex-direction:column;gap:6px"><div class="sec-sub" style="font-weight:700">' + esc(T('emg.la.conc')) + '</div>' +
        UI.chips({ act: 'conc', items: a.conc.map(c => ({ value: String(c), label: pct(c) })), selected: String(concOf()), tint }) + '</div>');
    };
    const results = () => {
      const out = output();
      if (!out) return needWeight(tint);
      const perKg = Fmt.smart(out.lim.mgPerKg) + ' mg/kg';
      const warn = [];
      if (out.capped) warn.push({ severity: 1, title: T('emg.la.capTitle'), message: T('emg.la.capMessage', { cap: Fmt.smart(out.lim.capMg) }) });
      warn.push({ severity: 0, title: T('emg.la.multiTitle'), message: T('emg.la.multiMessage') });
      warn.push({ severity: 1, title: T('emg.la.lastTitle'), message: T('emg.la.lastMessage') });
      return card(sectionHeader({ title: T('result.title'), subtitle: T('emg.la.resultSubtitle'), icon: 'calculator', tint }) +
        UI.bigResult({ label: T('emg.la.maxDose'), value: mg(out.maxMg), unit: 'mg', caption: T('emg.la.caption', { agent: T('emg.la.' + s.agent), perKg, kg: Fmt.smart(out.w) }), tint }) +
        '<div class="metrics">' + metric({ title: T('emg.la.maxVolume'), value: Fmt.smart(Math.round(out.maxMl * 10) / 10), unit: 'mL', icon: 'droplet', tint }) +
        metric({ title: T('emg.la.concentration'), value: pct(out.conc), unit: '(' + Fmt.smart(out.mgPerMl) + ' mg/mL)', icon: 'flask-conical', tint: 'secondary' }) +
        metric({ title: T('emg.la.perKg'), value: Fmt.smart(out.lim.mgPerKg), unit: 'mg/kg', icon: 'weight', tint: 'info' }) +
        metric({ title: T('emg.la.absCap'), value: out.lim.capMg != null ? Fmt.smart(out.lim.capMg) : '—', unit: out.lim.capMg != null ? 'mg' : '', icon: 'octagon-alert', tint: 'danger' }) + '</div>' +
        UI.formula(T('emg.la.formula'), T('emg.la.formulaFilled', { perKg: Fmt.smart(out.lim.mgPerKg), kg: Fmt.smart(out.w), mg: mg(out.byWeight), conc: Fmt.smart(out.mgPerMl), ml: Fmt.smart(Math.round(out.maxMl * 10) / 10) }), tint)) +
        UI.warningsCard(warn) + shareButton();
    };
    const shareText = out => shareLines([T('catalog.localAnestheticMax.title'),
      T('share.patient') + ': ' + Fmt.smart(out.w) + ' kg',
      T('emg.la.' + s.agent) + (out.withEpi ? ' + ' + T('emg.la.epiShort') : '') + ' ' + pct(out.conc),
      T('emg.la.maxDose') + ': ' + mg(out.maxMg) + ' mg (' + Fmt.smart(Math.round(out.maxMl * 10) / 10) + ' mL)']);
    return {
      tint, title: T('catalog.localAnestheticMax.title'),
      topRight: () => topRight('localAnestheticMax', tint),
      body: () => AA.patientCard({ derived: false }) + region('agent', agentSection()) + '<div data-region="out" style="display:flex;flex-direction:column;gap:22px">' + results() + '</div>' + refsCard('localAnestheticMax', tint) + UI.footnote(T('emg.la.footer')),
      regions: { out: results },
      get(p) { return s[p]; },
      set(p, v) { s[p] = !!v; persist(); return 'render'; },
      act: {
        agent(el) { s.agent = el.getAttribute('data-value'); if (!LA[s.agent].epi) s.epi = false; s.conc = LA[s.agent].conc.includes(s.conc) ? s.conc : LA[s.agent].conc[Math.min(1, LA[s.agent].conc.length - 1)]; persist(); AA.App.render(); },
        conc(el) { s.conc = Number(el.getAttribute('data-value')); persist(); AA.App.render(); },
        reset() { Object.assign(s, defaults); persist(); AA.App.render(); },
        share() { const out = output(); if (out) UI.share(shareText(out)); }
      }
    };
  }

  // ================================================================ 2) LAST — lipid emülsiyonu
  // ASRA 2017: <70 kg → 1,5 mL/kg (yağsız ağırlık) %20 lipid bolusu + 0,25 mL/kg/dk; ≥70 kg → 100 mL bolus + 200–250 mL / 15–20 dk.
  // Bolus tekrarlanabilir; hemodinamik instabilite sürerse infüzyon hızı iki katına çıkarılabilir; üst sınır ≈ 12 mL/kg.
  function lastScreen() {
    const tint = 'danger';
    const output = () => {
      const total = weight();
      if (!total) return null;
      const prof = PatientStore.profile;
      const lean = prof && prof.leanBodyWeight > 0 ? Math.min(prof.leanBodyWeight, total) : null;
      const w = lean || total;
      const heavy = total >= 70;
      return { total, lean, w, heavy, usedLean: !!lean,
        bolusMl: heavy ? 100 : 1.5 * w, infusionMlPerMin: heavy ? null : 0.25 * w, infusionDoubledMlPerMin: heavy ? null : 0.5 * w,
        maxTotalMl: 12 * w };
    };
    const results = () => {
      const out = output();
      if (!out) return needWeight(tint);
      const r1 = x => Fmt.smart(Math.round(x * 10) / 10);
      const regimen = out.heavy
        ? '<div>' + UI.infoRow(T('emg.last.infusion'), T('emg.last.heavyInfusion'), { caption: T('emg.last.heavyInfusionCaption') }) + '</div>'
        : '<div>' + UI.infoRow(T('emg.last.infusion'), r1(out.infusionMlPerMin) + ' mL/' + T('unit.minuteShort'), { caption: T('emg.last.infusionCaption', { perKg: '0,25' }) }) + '<hr class="divider">' +
          UI.infoRow(T('emg.last.infusionDoubled'), r1(out.infusionDoubledMlPerMin) + ' mL/' + T('unit.minuteShort'), { caption: T('emg.last.infusionDoubledCaption') }) + '</div>';
      const warn = [
        { severity: 2, title: T('emg.last.stopTitle'), message: T('emg.last.stopMessage') },
        { severity: 1, title: T('emg.last.maxTitle'), message: T('emg.last.maxMessage', { ml: Fmt.smart(Math.round(out.maxTotalMl)) }) }
      ];
      if (out.heavy) warn.push({ severity: 0, title: T('emg.last.heavyTitle'), message: T('emg.last.heavyMessage') });
      else if (!out.usedLean) warn.push({ severity: 0, title: T('emg.last.leanTitle'), message: T('emg.last.leanMessage') });
      return card(sectionHeader({ title: T('result.title'), subtitle: T('emg.last.resultSubtitle'), icon: 'calculator', tint }) +
        UI.bigResult({ label: T('emg.last.bolus'), value: r1(out.bolusMl), unit: 'mL', caption: out.heavy ? T('emg.last.bolusCaptionHeavy') : T('emg.last.bolusCaption', { kg: Fmt.smart(Math.round(out.w * 10) / 10), basis: out.usedLean ? T('emg.last.leanBasis') : T('emg.last.totalBasis') }), tint }) +
        regimen +
        '<div class="metrics">' + metric({ title: T('emg.last.maxTotal'), value: Fmt.smart(Math.round(out.maxTotalMl)), unit: 'mL', icon: 'octagon-alert', tint: 'warning' }) +
        metric({ title: T('emg.last.emulsion'), value: AA.I18n.language === 'tr' ? '%20' : '20%', unit: '(200 mg/mL)', icon: 'flask-conical', tint: 'secondary' }) + '</div>') +
        UI.warningsCard(warn) + shareButton();
    };
    const shareText = out => shareLines([T('catalog.lastLipid.title'), T('share.patient') + ': ' + Fmt.smart(out.total) + ' kg',
      T('emg.last.bolus') + ': ' + Fmt.smart(Math.round(out.bolusMl * 10) / 10) + ' mL',
      out.heavy ? T('emg.last.infusion') + ': ' + T('emg.last.heavyInfusion') : T('emg.last.infusion') + ': ' + Fmt.smart(Math.round(out.infusionMlPerMin * 10) / 10) + ' mL/' + T('unit.minuteShort'),
      T('emg.last.maxTotal') + ': ' + Fmt.smart(Math.round(out.maxTotalMl)) + ' mL']);
    return {
      tint, title: T('catalog.lastLipid.title'),
      topRight: () => '<button type="button" class="circle-btn tinted" style="' + tintStyle(tint) + '" data-act="nav" data-to="info-lastLipid" aria-label="' + esc(T('info.title')) + '">' + icon('info') + '</button>',
      body: () => AA.patientCard({ derived: false }) + '<div data-region="out" style="display:flex;flex-direction:column;gap:22px">' + results() + '</div>' + refsCard('lastLipid', tint) + UI.footnote(T('emg.last.footer')),
      regions: { out: results },
      get() { return null; }, set() {},
      act: { share() { const out = output(); if (out) UI.share(shareText(out)); } }
    };
  }

  // ================================================================ 3) Malign hipertermi — dantrolen
  // MHAUS: 2,5 mg/kg hızlı IV; belirtiler düzelene kadar tekrar; kümülatif 10 mg/kg'a ulaşılırsa tanı yeniden değerlendirilir.
  // Kriz sonrası 1 mg/kg IV, 6 saatte bir, 24–48 saat. Her 20 mg'lık flakon 60 mL steril suyla sulandırılır.
  function mhScreen() {
    const tint = 'danger';
    const VIAL_MG = 20, VIAL_ML = 60;
    const output = () => {
      const w = weight();
      if (!w) return null;
      const initial = 2.5 * w;
      return { w, initial, vials: Math.ceil(initial / VIAL_MG), diluentMl: Math.ceil(initial / VIAL_MG) * VIAL_ML, cumulative10: 10 * w, post: 1 * w };
    };
    const results = () => {
      const out = output();
      if (!out) return needWeight(tint);
      const warn = [
        { severity: 2, title: T('emg.mh.callTitle'), message: T('emg.mh.callMessage') },
        { severity: 1, title: T('emg.mh.reassessTitle'), message: T('emg.mh.reassessMessage', { mg: mg(out.cumulative10) }) }
      ];
      return card(sectionHeader({ title: T('result.title'), subtitle: T('emg.mh.resultSubtitle'), icon: 'calculator', tint }) +
        UI.bigResult({ label: T('emg.mh.initial'), value: mg(out.initial), unit: 'mg', caption: T('emg.mh.initialCaption', { kg: Fmt.smart(out.w) }), tint }) +
        '<div class="metrics">' + metric({ title: T('emg.mh.vials'), value: Fmt.smart(out.vials), unit: T('emg.mh.vialUnit'), icon: 'pill', tint }) +
        metric({ title: T('emg.mh.diluent'), value: Fmt.smart(out.diluentMl), unit: 'mL', icon: 'droplet', tint: 'info' }) +
        metric({ title: T('emg.mh.cumulative'), value: mg(out.cumulative10), unit: 'mg', icon: 'octagon-alert', tint: 'warning' }) +
        metric({ title: T('emg.mh.postCrisis'), value: mg(out.post), unit: 'mg / ' + T('emg.mh.every6h'), icon: 'history', tint: 'secondary' }) + '</div>' +
        UI.formula(T('emg.mh.formula'), T('emg.mh.formulaFilled', { kg: Fmt.smart(out.w), mg: mg(out.initial), vials: Fmt.smart(out.vials) }), tint)) +
        UI.warningsCard(warn) + shareButton();
    };
    const shareText = out => shareLines([T('catalog.malignantHyperthermia.title'), T('share.patient') + ': ' + Fmt.smart(out.w) + ' kg',
      T('emg.mh.initial') + ': ' + mg(out.initial) + ' mg (' + Fmt.smart(out.vials) + ' ' + T('emg.mh.vialUnit') + ')',
      T('emg.mh.cumulative') + ': ' + mg(out.cumulative10) + ' mg', T('emg.mh.postCrisis') + ': ' + mg(out.post) + ' mg / ' + T('emg.mh.every6h')]);
    return {
      tint, title: T('catalog.malignantHyperthermia.title'),
      topRight: () => '<button type="button" class="circle-btn tinted" style="' + tintStyle(tint) + '" data-act="nav" data-to="info-malignantHyperthermia" aria-label="' + esc(T('info.title')) + '">' + icon('info') + '</button>',
      body: () => AA.patientCard({ derived: false }) + '<div data-region="out" style="display:flex;flex-direction:column;gap:22px">' + results() + '</div>' + refsCard('malignantHyperthermia', tint) + UI.footnote(T('emg.mh.footer')),
      regions: { out: results },
      get() { return null; }, set() {},
      act: { share() { const out = output(); if (out) UI.share(shareText(out)); } }
    };
  }

  // ================================================================ 4) Pediatrik acil ilaç dozları (AHA PALS 2020)
  const PEDS = [
    { id: 'epinephrine', icon: 'heart-pulse', tint: 'danger', mgPerKg: 0.01, unit: 'mg', volumeMlPerKg: 0.1 },
    { id: 'amiodarone', icon: 'zap', tint: 'warning', mgPerKg: 5, unit: 'mg' },
    { id: 'lidocaine', icon: 'syringe', tint: 'info', mgPerKg: 1, unit: 'mg' },
    { id: 'atropine', icon: 'activity', tint: 'secondary', mgPerKg: 0.02, unit: 'mg' },
    { id: 'adenosine1', icon: 'activity', tint: 'tertiary', mgPerKg: 0.1, unit: 'mg' },
    { id: 'adenosine2', icon: 'activity', tint: 'tertiary', mgPerKg: 0.2, unit: 'mg' },
    { id: 'bicarbonate', icon: 'flask-conical', tint: 'info', mgPerKg: 1, unit: 'mEq' },
    { id: 'glucose', icon: 'droplet', tint: 'warning', range: [0.5, 1], unit: 'g' },
    { id: 'defib', icon: 'zap', tint: 'danger', joules: [2, 4] }
  ];
  function pediatricScreen() {
    const tint = 'info';
    const rounded = v => Fmt.smart(Math.round(v * 1000) / 1000);
    const doseText = (d, w) => d.joules ? Fmt.smart(d.joules[0] * w) + ' J → ≥ ' + Fmt.smart(d.joules[1] * w) + ' J'
      : d.range ? rounded(d.range[0] * w) + '–' + rounded(d.range[1] * w) + ' ' + d.unit : rounded(d.mgPerKg * w) + ' ' + d.unit;
    const perKgText = d => d.joules ? Fmt.smart(d.joules[0]) + ' → ≥ ' + Fmt.smart(d.joules[1]) + ' J/kg' : d.range ? Fmt.smart(d.range[0]) + '–' + Fmt.smart(d.range[1]) + ' ' + d.unit + '/kg' : Fmt.smart(d.mgPerKg) + ' ' + d.unit + '/kg';
    const results = () => {
      const w = weight();
      if (!w) return needWeight(tint);
      const warn = [{ severity: 1, title: T('emg.peds.adultTitle'), message: T('emg.peds.adultMessage') }];
      if (w > 40) warn.unshift({ severity: 2, title: T('emg.peds.heavyTitle'), message: T('emg.peds.heavyMessage', { kg: Fmt.smart(w) }) });
      const rows = PEDS.map(d => '<div class="inforow" style="align-items:flex-start;gap:10px"><div class="l" style="min-width:0"><b style="font-family:var(--font)">' + esc(T('emg.peds.' + d.id)) + '</b><small>' +
        esc(T('emg.peds.' + d.id + '.note')) + (d.volumeMlPerKg ? ' · ' + esc(T('emg.peds.epinephrineVolume', { ml: rounded(d.volumeMlPerKg * w) })) : '') + '</small></div><div class="v" style="text-align:right"><b>' +
        esc(doseText(d, w)) + '</b><br><span style="font-size:11px;color:var(--textTertiary)">' + esc(perKgText(d)) + '</span></div></div>').join('<hr class="divider">');
      return card(sectionHeader({ title: T('result.title'), subtitle: T('emg.peds.resultSubtitle', { kg: Fmt.smart(w) }), icon: 'calculator', tint }) + rows) + UI.warningsCard(warn) + shareButton();
    };
    const shareText = () => {
      const w = weight();
      return shareLines([T('catalog.pediatricEmergency.title'), T('share.patient') + ': ' + Fmt.smart(w) + ' kg'].concat(PEDS.map(d => T('emg.peds.' + d.id) + ': ' + doseText(d, w))));
    };
    return {
      tint, title: T('catalog.pediatricEmergency.title'),
      topRight: () => '<button type="button" class="circle-btn tinted" style="' + tintStyle(tint) + '" data-act="nav" data-to="info-pediatricEmergency" aria-label="' + esc(T('info.title')) + '">' + icon('info') + '</button>',
      body: () => AA.patientCard({ derived: false }) + '<div data-region="out" style="display:flex;flex-direction:column;gap:22px">' + results() + '</div>' + refsCard('pediatricEmergency', tint) + UI.footnote(T('emg.peds.footer')),
      regions: { out: results },
      get() { return null; }, set() {},
      act: { share() { if (weight()) UI.share(shareText()); } }
    };
  }

  // ================================================================ Bilgi paneli
  const INFO = {
    localAnestheticMax: { icon: 'syringe', tint: 'warning', notes: 4 },
    lastLipid: { icon: 'droplet', tint: 'danger', notes: 3 },
    malignantHyperthermia: { icon: 'flame', tint: 'danger', notes: 3 },
    pediatricEmergency: { icon: 'baby', tint: 'info', notes: 3 }
  };
  const infoFor = calcId => {
    const m = INFO[calcId];
    if (!m) return null;
    return { title: T('catalog.' + calcId + '.title'), subtitle: T('catalog.' + calcId + '.subtitle'), icon: m.icon, tint: m.tint, about: T('emg.' + calcId + '.about'), bands: [],
      notes: Array.from({ length: m.notes }, (_, i) => T('emg.' + calcId + '.note' + (i + 1))), reference: T('emg.refs.intro'), refsHTML: AA.refsHTML(calcId) };
  };

  // ================================================================ Yönlendirme (screens-calc.js üzerine eklenir)
  const MAKERS = { localAnestheticMax: localAnestheticScreen, lastLipid: lastScreen, malignantHyperthermia: mhScreen, pediatricEmergency: pediatricScreen };
  const baseMake = AA.CalcScreens.make;
  AA.CalcScreens.make = id => MAKERS[id] ? MAKERS[id]() : baseMake(id);
  const baseInfo = AA.infoFor;
  AA.infoFor = calcId => INFO[calcId] ? infoFor(calcId) : baseInfo(calcId);
})();
