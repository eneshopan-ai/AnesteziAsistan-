/* Anestezi Asistanı — hesaplayıcı ekranları.
 * iOS'taki InfusionCalculatorView, VasoactiveCalculatorView, FluidCalculatorView,
 * BloodLossCalculatorView, AirwayScoreView, AirwayMeasurementsView, ParameterScoreView,
 * ElectrolyteCalculatorView, CrystalloidTableView ve BloodGasView ekranlarının karşılığıdır. */
(function () {
  'use strict';
  const AA = window.AA;
  const { T, Fmt, UI, Settings, PatientStore } = AA;
  const { esc, icon, card, sectionHeader, badge, metric, tintStyle } = UI;

  const region = (name, html) => '<div data-region="' + name + '">' + html + '</div>';
  const iconBtn = (act, ic, label, tint) => '<button type="button" class="circle-btn' + (tint ? ' tinted' : '') + '" style="' + (tint ? tintStyle(tint) : '') + '" data-act="' + act + '" aria-label="' + esc(label) + '">' + icon(ic) + '</button>';
  const resetBtn = tint => iconBtn('reset', 'rotate-ccw', T('common.clear'), tint);
  const infoBtn = (calcId, tint) => '<button type="button" class="circle-btn tinted" style="' + tintStyle(tint) + '" data-act="nav" data-to="info-' + calcId + '" aria-label="' + esc(T('info.title')) + '">' + icon('info') + '</button>';
  const percentText = (v, digits = 2) => AA.I18n.language === 'tr' ? '%' + Fmt.decimal(v, digits) : Fmt.decimal(v, digits) + '%';
  const shareLines = lines => lines.concat('— ' + T('app.name') + ' · ' + T('share.disclaimer')).join('\n');
  const notesCard = (title, notes, tint) => card(sectionHeader({ title, icon: 'book-text', tint }) + UI.bullets(notes, tint, true));
  const shareButton = (tint = 'secondary') => '<button type="button" class="btn" style="' + tintStyle(tint) + '" data-act="share">' + icon('share') + '<span>' + esc(T('common.share')) + '</span></button>';
  const sameNumber = (a, b) => (a == null && b == null) || (a != null && b != null && Math.abs(a - b) < 1e-9);
  const unitLabel = u => {
    if (u == null) return '';
    if (AA.unitOverrides && AA.unitOverrides[u]) return AA.unitOverrides[u]();
    return AA.unitText(u);
  };
  const scoreHeader = ({ name, subtitle, ic, tint, summary, extra = '' }) =>
    card('<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start"><div style="min-width:0"><h1 class="sec-title" style="font-size:22px;font-weight:900">' + esc(name) +
      '</h1><div class="sec-sub" style="font-size:12px;color:var(--textSecondary)">' + esc(subtitle) + '</div></div><span style="font-size:26px;' + tintStyle(tint) + 'color:var(--t)">' + icon(ic) + '</span></div>' +
      (summary ? '<p style="margin:0;font-size:12.5px;color:var(--textTertiary)">' + UI.rich(summary) + '</p>' : '') + extra);
  const rangeText = (r, max) => r.lo === r.hi ? String(r.lo) : (r.hi >= max ? '≥ ' + r.lo : r.lo + '–' + r.hi);

  // ================================================================ 1) İnfüzyon hesaplayıcısı (anestezi)
  function infusionScreen(drugId) {
    const drug = AA.makeDrug(drugId);
    if (!drug) return null;
    const stateKey = 'infusion.state.' + drugId + '.v' + (AA.DRUGS[drugId].stateVersion || 2);
    const pinKey = 'infusion.defaultPreparation.' + drugId + '.v1';
    const concUnit = AA.CONC_UNITS[drug.concUnit];
    const unitTitle = T(drug.unit.title);
    const bolusUnit = T(drug.unit.bolusTitle);
    const first = drug.indications[0];

    const prepCopy = p => ({ mode: p.mode, directConcentration: p.directConcentration ?? null, totalDrugMg: p.totalDrugMg ?? null, totalVolumeMl: p.totalVolumeMl ?? null });
    let pinned = prepCopy(AA.State.load(pinKey, null) || drug.defaultPreparation);
    const saved = AA.State.load(stateKey, null);
    const s = saved ? {
      indicationID: drug.indications.some(i => i.id === saved.indicationID) ? saved.indicationID : first.id,
      basis: saved.basis || Settings.defaultBasis, dose: saved.dose, preparation: prepCopy(saved.preparation || pinned),
      includeLoading: !!saved.includeLoading, loadingDose: saved.loadingDose
    } : {
      indicationID: first.id, basis: Settings.defaultBasis, dose: first.typicalDose, preparation: prepCopy(pinned),
      includeLoading: false, loadingDose: first.typicalLoading ?? first.doseRange.lo
    };
    const ind = () => drug.indications.find(i => i.id === s.indicationID) || first;
    const doseRange = () => { const sr = ind().sliderRange; if (sr) return { lo: sr.lo, hi: sr.hi }; const r = ind().doseRange; return { lo: Math.max(0, r.lo - r.lo * 0.5), hi: r.hi + r.hi * 0.5 }; };
    const bolusRange = () => { const r = ind().loadingRange; return r ? { lo: Math.max(0, r.lo * 0.5), hi: r.hi * 1.5 } : { lo: 0, hi: 1 }; };
    s.dose = AA.clamp(Number(s.dose) || first.typicalDose, doseRange().lo, doseRange().hi);
    if (ind().loadingRange) s.loadingDose = AA.clamp(Number(s.loadingDose) || 0, bolusRange().lo, bolusRange().hi);
    const persist = () => AA.State.save(stateKey, s);

    const concentration = () => AA.Preparation.concentrationMgPerMl(s.preparation, drug.concUnit);
    const isPinned = () => ['mode', 'directConcentration', 'totalDrugMg', 'totalVolumeMl'].every(k => k === 'mode' ? s.preparation.mode === pinned.mode : sameNumber(s.preparation[k], pinned[k]));
    const output = () => {
      const profile = PatientStore.profile;
      if (!profile) return null;
      return AA.InfusionEngine.calculate({ drug, indication: ind(), profile, basis: s.basis, dose: s.dose, preparation: s.preparation,
        includeLoadingDose: s.includeLoading, loadingDose: s.loadingDose, dropFactor: Settings.dropFactor });
    };
    const inRange = () => AA.inRange(ind().doseRange, s.dose);
    const formattedConc = mgml => AA.Preparation.formatted(mgml, drug.concUnit);

    // ---- bölümler
    const header = () => card('<div class="drug-head" style="' + tintStyle(drug.tint) + '"><div class="d-ico">' + icon(drug.icon) + '</div><div><h1>' + esc(drug.name) + '</h1><p>' +
      esc(drug.genericName + ' · ' + drug.tagline) + '</p></div></div><div class="badges">' + drug.badges.map(b => badge(b, drug.tint, { upper: false })).join('') + '</div>' +
      '<button type="button" class="link-row" style="' + tintStyle(drug.tint) + '" data-act="nav" data-to="ref-' + drugId + '">' + icon('book-text') + '<span class="grow">' + esc(T('calc.drugInfoLink')) + '</span>' + icon('chevron-right') + '</button>', { pad: 'l' });

    const indicationSection = () => {
      const i = ind();
      const multi = drug.indications.length > 1;
      let html = sectionHeader({ title: T('calc.indication'), subtitle: multi ? T('calc.indicationSubtitle') : i.subtitle, icon: 'clipboard-list', tint: drug.tint });
      html += multi ? UI.chips({ act: 'indication', items: drug.indications.map(x => ({ value: x.id, label: x.title, icon: x.icon })), selected: i.id, tint: drug.tint })
        : '<div style="display:flex;gap:8px;align-items:center;' + tintStyle(drug.tint) + '"><span style="color:var(--t)">' + icon(i.icon) + '</span><b style="font-family:var(--font);font-size:15px">' + esc(i.title) + '</b></div>';
      html += '<div class="panel">' + UI.infoRow(T('calc.recommendedInfusion'), Fmt.smart(i.doseRange.lo) + '–' + Fmt.smart(i.doseRange.hi) + ' ' + unitTitle) +
        (i.loadingRange ? '<hr class="divider">' + UI.infoRow(T('calc.loadingDose'), Fmt.smart(i.loadingRange.lo) + '–' + Fmt.smart(i.loadingRange.hi) + ' ' + bolusUnit) : '') +
        '<hr class="divider"><div style="display:flex;gap:6px;' + tintStyle(drug.tint) + '"><span style="color:var(--t);font-size:12px">' + icon('target') + '</span><div><div style="font-family:var(--font);font-size:11px;font-weight:700;color:var(--textTertiary)">' +
        esc(T('calc.titrationTarget')) + '</div><div style="font-size:12px;color:var(--textSecondary)">' + esc(i.titrationTarget) + '</div></div></div></div>';
      if (i.notes && i.notes.length) html += UI.bullets(i.notes, drug.tint);
      return card(html);
    };

    const basisSection = () => {
      const p = PatientStore.profile;
      let html = sectionHeader({ title: T('calc.dosingWeight'), subtitle: T('calc.dosingWeightSubtitle'), icon: 'weight', tint: 'secondary' });
      if (!p) return card(html + '<p style="margin:0;font-size:12px;color:var(--warning)">' + esc(T('calc.needPatient')) + '</p>');
      html += UI.chips({ act: 'basis', tint: 'secondary', selected: s.basis, items: ['total', 'lean', 'ideal', 'adjusted'].map(b => ({ value: b, label: T('basis.' + b + '.abbr'), sub: Fmt.decimal(p.weight(b)) + ' kg' })) });
      html += '<div class="panel"><div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline"><b style="font-family:var(--font);font-size:13px">' + esc(T('basis.' + s.basis + '.title')) +
        '</b><b class="num" style="font-size:17px;color:var(--secondary)">' + esc(Fmt.decimal(p.weight(s.basis))) + ' kg</b></div><div class="sec-sub" style="font-weight:600">' + esc(T('basis.' + s.basis + '.formula')) +
        '</div><div style="font-size:11.5px;color:var(--textSecondary)">' + esc(T('basis.' + s.basis + '.rationale')) + '</div></div>';
      return card(html);
    };

    const pinButton = () => {
      const on = isPinned();
      return '<button type="button" class="pill-btn" style="' + tintStyle(on ? 'success' : 'info') + '" data-act="pin">' + icon(on ? 'circle-check' : 'pin') + esc(on ? T('prep.isDefault') : T('prep.setAsDefault')) + '</button>';
    };
    const presetsHTML = () => '<div style="display:flex;flex-direction:column;gap:6px"><div class="sec-sub" style="font-weight:700">' + esc(T('prep.common')) + '</div><div class="chips" style="--t:var(--info)">' +
      drug.presets.map((p, i) => {
        const on = s.preparation.mode === 'mixture' && s.preparation.totalDrugMg === p.totalDrugMg && s.preparation.totalVolumeMl === p.totalVolumeMl;
        return '<button type="button" class="preset' + (on ? ' on' : '') + '" data-act="preset" data-value="' + i + '"><b>' + esc(p.title) + '</b><span>' + esc(p.subtitle) + '</span></button>';
      }).join('') + '</div></div>';
    const concSummary = () => {
      const c = concentration();
      if (c == null) return '<div class="slider"><div class="note" style="color:var(--warning)">' + icon('triangle-alert') + '<span>' + esc(T('prep.invalid')) + '</span></div></div>';
      const display = c * concUnit.displayFactor;
      return '<div class="metrics three">' +
        metric({ title: T('prep.concentration'), value: Fmt.smart(display), unit: T(concUnit.title), icon: 'droplet', tint: 'info', emphasized: true }) +
        metric({ title: T('prep.percent'), value: percentText(c / 10, 2), icon: 'percent', tint: 'info' }) +
        metric({ title: T('prep.perMl'), value: Fmt.smart(display), unit: T(concUnit.amountTitle), icon: 'syringe', tint: 'textSecondary' }) + '</div>';
    };
    const prepSection = () => {
      const p = s.preparation;
      let html = sectionHeader({ title: T('prep.title'), subtitle: T('prep.subtitle'), icon: 'flask-conical', tint: 'info', accessory: region('pin', pinButton()) });
      html += UI.segmented({ act: 'prep-mode', items: ['direct', 'mixture'].map(m => ({ value: m, label: T('prep.mode.' + m + '.title') })), selected: p.mode });
      html += '<div class="sec-sub">' + esc(T('prep.mode.' + p.mode + '.caption')) + '</div>';
      if (p.mode === 'direct') {
        html += '<div class="fields one">' + UI.numericField({ bind: 'prep.directConcentration', title: T('prep.concentration'), unit: T(concUnit.title), icon: 'droplet',
          value: p.directConcentration, step: drug.concUnit === 'mcgPerMl' ? 10 : 1, min: 0.1, max: 100000, tint: 'info' }) + '</div>';
      } else {
        const amt = p.totalDrugMg;
        const amtStep = amt == null ? 100 : amt <= 10 ? 1 : amt < 250 ? 50 : 100;
        html += '<div class="fields">' + UI.numericField({ bind: 'prep.totalDrugMg', title: T('prep.totalDrug'), unit: T('unit.mg'), icon: 'pill', value: p.totalDrugMg, step: amtStep, min: 0.1, max: 5000, tint: 'info' }) +
          UI.numericField({ bind: 'prep.totalVolumeMl', title: T('prep.totalVolume'), unit: 'mL', icon: 'droplet', value: p.totalVolumeMl, step: 10, min: 1, max: 1000, tint: 'info' }) + '</div>';
        html += region('presets', presetsHTML());
      }
      html += region('conc', concSummary());
      return card(html);
    };

    const doseSection = () => {
      const i = ind(), r = doseRange();
      return card(sectionHeader({ title: T('calc.infusionDose'), subtitle: i.title, icon: 'sliders-horizontal', tint: drug.tint }) +
        UI.doseSlider({ bind: 'dose', title: T('calc.targetDose'), unit: unitTitle, value: s.dose, min: r.lo, max: r.hi, step: i.titrationStep, recLo: i.doseRange.lo, recHi: i.doseRange.hi, tint: drug.tint }) +
        '<div class="quick">' + [['calc.lowerBound', i.doseRange.lo], ['calc.typical', i.typicalDose], ['calc.upperBound', i.doseRange.hi]].map(([k, v]) =>
          '<button type="button" data-act="quick-dose" data-value="' + v + '"><small>' + esc(T(k)) + '</small><b>' + esc(Fmt.smart(v)) + '</b></button>').join('') + '</div>');
    };

    const loadingTiles = () => {
      const out = output();
      if (!out || !s.includeLoading) return '';
      return '<div class="metrics">' + metric({ title: T('calc.loadingDoseShort'), value: Fmt.smart(out.loadingDoseMg), unit: T('unit.mg'), icon: 'pill', tint: 'tertiary' }) +
        metric({ title: T('calc.loadingVolume'), value: Fmt.smart(out.loadingVolumeMl), unit: 'mL', icon: 'syringe', tint: 'tertiary', emphasized: true }) + '</div>';
    };
    const loadingSection = () => {
      const i = ind();
      if (!i.loadingRange) return '';
      const br = bolusRange();
      let html = sectionHeader({ title: T('calc.loadingDose'), subtitle: T('calc.loadingSubtitle'), icon: 'syringe', tint: 'tertiary',
        accessory: UI.toggle({ bind: 'includeLoading', checked: s.includeLoading, tint: 'tertiary', label: T('calc.loadingDose') }) });
      if (s.includeLoading) {
        html += UI.doseSlider({ bind: 'loadingDose', title: T('calc.loadingDoseShort'), unit: bolusUnit, value: s.loadingDose, min: br.lo, max: br.hi,
          step: i.loadingRange.hi <= 2 ? 0.05 : 0.5, recLo: i.loadingRange.lo, recHi: i.loadingRange.hi, tint: 'tertiary' });
        html += region('loadingTiles', loadingTiles());
      } else {
        html += '<p style="margin:0;font-size:11.5px;color:var(--textTertiary)">' + esc(T('calc.loadingOff')) + '</p>';
      }
      return card(html);
    };

    const resultSection = () => {
      const out = output();
      if (!out) {
        return PatientStore.isComplete
          ? UI.emptyState({ icon: 'flask-conical', title: T('calc.missingPrepTitle'), message: T('calc.missingPrepMessage'), tint: 'warning' })
          : UI.emptyState({ icon: 'user', title: T('calc.missingPatientTitle'), message: T('calc.missingPatientMessage'), tint: 'warning' });
      }
      const i = ind(), ok = inRange();
      const prog = (s.dose - i.doseRange.lo) / ((i.doseRange.hi - i.doseRange.lo) || 1);
      const weight = Fmt.decimal(out.dosingWeightKg), dose = Fmt.smart(s.dose), rate = Fmt.decimal(out.rateMlPerHour, 2);
      const mcgDoseMgConc = drug.doseUnit === 'mcgPerKgPerMinute' && drug.concUnit === 'mgPerMl';
      const sub = drug.doseUnit === 'mgPerKgPerHour'
        ? '= (' + dose + ' × ' + weight + ') ÷ ' + Fmt.smart(out.concentrationMgPerMl) + ' = ' + rate + ' ' + T('unit.mlPerHour')
        : mcgDoseMgConc
          ? '= (' + dose + ' × ' + weight + ' × 60 ÷ 1000) ÷ ' + Fmt.smart(out.concentrationMgPerMl) + ' = ' + rate + ' ' + T('unit.mlPerHour')
          : '= (' + dose + ' × ' + weight + ' × 60) ÷ ' + Fmt.smart(out.concentrationMgPerMl * concUnit.displayFactor) + ' = ' + rate + ' ' + T('unit.mlPerHour');
      let html = sectionHeader({ title: T('result.title'), subtitle: T('result.subtitle'), icon: 'activity', tint: drug.tint,
        accessory: badge(ok ? T('result.inRange') : T('result.outOfRange'), ok ? 'success' : 'warning', { filled: true }) });
      html += UI.gauge({ rate: out.rateMlPerHour, progress: prog, inRange: ok, secondary: Fmt.smart(out.mgPerHour) + ' ' + T('unit.mgPerHour'),
        caption: dose + ' ' + unitTitle + ' × ' + weight + ' kg ÷ ' + formattedConc(out.concentrationMgPerMl) });
      html += UI.formula(T(drug.doseUnit === 'mgPerKgPerHour' ? 'result.formulaMgKgH' : mcgDoseMgConc ? 'result.formulaMcgKgMinMg' : 'result.formulaMcgKgMin'), sub, drug.tint);
      html += '<div class="metrics three">' + metric({ title: T('result.mgPerHour'), value: Fmt.smart(out.mgPerHour), unit: T('unit.mg'), tint: drug.tint }) +
        metric({ title: T('result.mgPerMinute'), value: Fmt.decimal(out.mgPerMinute, 2), unit: T('unit.mg'), tint: drug.tint }) +
        metric({ title: T('result.mlPerMinute'), value: Fmt.decimal(out.rateMlPerMinute, 2), unit: 'mL', tint: drug.tint }) + '</div>';
      if (Settings.advancedMetrics) {
        const mgkgh = drug.doseUnit === 'mgPerKgPerHour';
        html += '<div class="metrics">' + metric({ title: T(mgkgh ? 'result.mcgPerKgPerMinute' : 'result.mgPerKgPerHour'), value: Fmt.smart(mgkgh ? out.mcgPerKgPerMinute : out.mgPerKgPerHour),
          unit: T(mgkgh ? 'unit.mcg' : 'unit.mg'), icon: 'arrow-left-right', tint: 'secondary' }) +
          metric({ title: T('result.dropsPerMinute', { factor: AA.dropFactorShort(Settings.dropFactor) }), value: Fmt.smart(out.dropsPerMinute), unit: T('unit.drops'), icon: 'droplet', tint: 'secondary' }) + '</div>';
        if (out.reservoirDurationHours) {
          html += '<div class="panel" style="flex-direction:row;align-items:center;gap:8px;background:color-mix(in srgb,var(--info) 8%,transparent)"><span style="color:var(--info)">' + icon('hourglass') + '</span><span style="font-size:12.5px;color:var(--textSecondary)">' +
            UI.rich(T('result.reservoir', { volume: Fmt.smart(s.preparation.totalVolumeMl || 0), duration: Fmt.duration(out.reservoirDurationHours) })) + '</span></div>';
        }
        html += '<div class="panel faint"><div class="eyebrow" style="font-size:9.5px;padding:0">' + esc(T('result.cumulative')) + '</div><table class="tbl"><thead><tr><th>' + esc(T('result.duration')) +
          '</th><th>' + esc(T('result.drugMg')) + '</th><th>' + esc(T('result.volumeMl')) + '</th></tr></thead><tbody>' +
          out.cumulative.map(c => '<tr><td>' + esc(Fmt.duration(c.hours)) + '</td><td class="strong">' + esc(Fmt.smart(c.mg)) + '</td><td class="strong">' + esc(Fmt.smart(c.ml)) + '</td></tr>').join('') + '</tbody></table></div>';
      }
      return card(html, { pad: 'l', tinted: true, tint: drug.tint });
    };

    const titrationSection = () => {
      const out = output();
      if (!out) return '';
      const i = ind();
      return card(sectionHeader({ title: T('titration.title'), subtitle: T('titration.subtitle', { indication: i.title, step: Fmt.smart(i.titrationStep), unit: unitTitle }), icon: 'table', tint: 'tertiary' }) +
        '<div class="tbl-wrap" style="' + tintStyle(drug.tint) + '"><table class="tbl"><thead><tr><th>' + esc(T('titration.doseColumn', { unit: unitTitle })) + '</th><th>' + esc(T('unit.mgPerHour')) + '</th><th>' + esc(T('unit.mlPerHour')) + '</th></tr></thead><tbody>' +
        out.titrationRows.map(r => '<tr class="' + (r.isCurrent ? 'cur' : '') + '"><td>' + esc(Fmt.smart(r.dose)) + (r.isCurrent ? ' ' + badge(T('titration.selected'), drug.tint) : r.isOutOfRange ? '<span class="mini-warn">' + icon('triangle-alert') + '</span>' : '') +
          '</td><td>' + esc(Fmt.smart(r.mgPerHour)) + '</td><td class="strong">' + esc(Fmt.smart(r.rate)) + '</td></tr>').join('') + '</tbody></table></div>' +
        '<div class="sec-sub">' + esc(T('titration.footer', { weight: Fmt.decimal(out.dosingWeightKg), concentration: formattedConc(out.concentrationMgPerMl) })) + '</div>');
    };

    const shareText = out => {
      const pt = PatientStore.patient;
      const lines = [drug.name + ' — ' + ind().title,
        T('share.patient') + ': ' + Fmt.smart(pt.weightKg || 0) + ' kg, ' + Fmt.smart(pt.heightCm || 0) + ' cm, ' + T('sex.' + pt.sex) + (pt.ageYears != null ? ', ' + Fmt.smart(pt.ageYears) + ' ' + T('unit.yearsShort') : ''),
        T('share.dosingWeight') + ': ' + Fmt.decimal(out.dosingWeightKg) + ' kg (' + T('basis.' + s.basis + '.abbr') + ')',
        T('share.preparation') + ': ' + AA.Preparation.summary(s.preparation, drug.concUnit),
        T('share.dose') + ': ' + Fmt.smart(s.dose) + ' ' + unitTitle + ' = ' + Fmt.smart(out.mgPerHour) + ' ' + T('unit.mgPerHour'),
        T('share.rate').toLocaleUpperCase(AA.I18n.locale) + ': ' + Fmt.smart(out.rateMlPerHour) + ' ' + T('unit.mlPerHour')];
      if (s.includeLoading && out.loadingDoseMg > 0) lines.push(T('share.loading') + ': ' + Fmt.smart(out.loadingDoseMg) + ' mg = ' + Fmt.smart(out.loadingVolumeMl) + ' mL');
      return shareLines(lines);
    };
    const actions = () => output() ? '<div class="actions">' + shareButton() + UI.addToPatientButton(drug.tint) + '</div>' : '';
    const warnings = () => { const out = output(); return out ? UI.warningsCard(out.warnings) : ''; };

    return {
      tint: drug.tint, title: drug.name,
      topRight: () => resetBtn(drug.tint) + iconBtn('nav', 'book-open', T('calc.drugInfoLink'), drug.tint).replace('data-act="nav"', 'data-act="nav" data-to="ref-' + drugId + '"'),
      body: () => header() + AA.patientCard({ derived: true }) + indicationSection() + region('basis', basisSection()) + prepSection() + doseSection() + loadingSection() +
        region('result', resultSection()) + region('titration', titrationSection()) + region('warnings', warnings()) + region('actions', actions()) + UI.footnote(T('calc.sourcesFooter')),
      regions: { basis: basisSection, pin: pinButton, presets: presetsHTML, conc: concSummary, loadingTiles, result: resultSection, titration: titrationSection, warnings, actions },
      sticky() {
        const out = output();
        if (!out) return '';
        return '<div class="sticky-sum" style="' + tintStyle(drug.tint) + '"><div class="in"><div><div class="k">' + esc(T('calc.pumpRate')) + '</div><div class="vv"><b>' + esc(Fmt.smart(out.rateMlPerHour)) + '</b><span>' + esc(T('unit.mlPerHour')) +
          '</span></div></div><div class="sep"></div><div class="d">' + esc(Fmt.smart(s.dose) + ' ' + unitTitle + ' · ' + Fmt.decimal(out.dosingWeightKg) + ' kg (' + T('basis.' + s.basis + '.abbr') + ')') +
          '<small>' + esc(T('calc.solution', { concentration: formattedConc(out.concentrationMgPerMl) })) + '</small></div></div></div>';
      },
      get(path) {
        if (path === 'dose') return s.dose;
        if (path === 'loadingDose') return s.loadingDose;
        if (path.startsWith('prep.')) return s.preparation[path.slice(5)];
        return undefined;
      },
      set(path, value) {
        if (path === 'dose') s.dose = value;
        else if (path === 'loadingDose') s.loadingDose = value;
        else if (path === 'includeLoading') { s.includeLoading = !!value; persist(); return 'render'; }
        else if (path.startsWith('prep.')) {
          const key = path.slice(5);
          s.preparation[key] = value;
          if (key === 'directConcentration' && value == null) s.preparation[key] = null;
        }
        persist();
      },
      act: {
        indication(el) {
          const id = el.getAttribute('data-value');
          if (id === s.indicationID) return;
          s.indicationID = id;
          const i = ind();
          s.dose = i.typicalDose;
          s.loadingDose = i.typicalLoading ?? s.loadingDose;
          persist(); AA.App.render();
        },
        basis(el) { s.basis = el.getAttribute('data-value'); persist(); AA.App.refresh(); },
        'prep-mode'(el) { s.preparation.mode = el.getAttribute('data-value'); persist(); AA.App.render(); },
        preset(el) {
          const p = drug.presets[Number(el.getAttribute('data-value'))];
          Object.assign(s.preparation, { mode: 'mixture', totalDrugMg: p.totalDrugMg, totalVolumeMl: p.totalVolumeMl, directConcentration: p.concentration * concUnit.displayFactor });
          persist(); AA.App.render();
        },
        pin() { if (isPinned()) return; pinned = prepCopy(s.preparation); AA.State.save(pinKey, pinned); AA.App.refresh(); },
        'quick-dose'(el) { s.dose = Number(el.getAttribute('data-value')); persist(); AA.App.render(); },
        reset() {
          s.indicationID = first.id; s.basis = Settings.defaultBasis; s.dose = first.typicalDose; s.preparation = prepCopy(pinned);
          s.includeLoading = false; s.loadingDose = first.typicalLoading ?? first.doseRange.lo; persist(); AA.App.render();
        },
        share() { const out = output(); if (out) UI.share(shareText(out)); },
        'add-to-patient'(el) { const out = output(); if (out) UI.addToPatient(drug.name, Fmt.smart(s.dose) + ' ' + unitTitle + ' = ' + Fmt.smart(out.rateMlPerHour) + ' ' + T('unit.mlPerHour'), el); }
      }
    };
  }

  // ================================================================ 2) Vazoaktif infüzyon (yoğun bakım)
  function vasoactiveScreen(id) {
    const drug = AA.VASO[id];
    const stateKey = 'vasoactive.state.' + id + '.v1';
    const pinKey = 'vasoactive.defaultPreparation.' + id + '.v1';
    const builtIn = drug.presets.find(p => p.index === drug.defaultPreset) || drug.presets[0];
    let pinned = AA.State.load(pinKey, null) || { totalAmount: builtIn.totalAmount, totalVolumeMl: builtIn.totalVolumeMl };
    const saved = AA.State.load(stateKey, null);
    const s = saved ? {
      direction: saved.direction === 'doseToRate' ? 'doseToRate' : 'rateToDose',
      totalAmount: saved.totalAmount ?? pinned.totalAmount, totalVolumeMl: saved.totalVolumeMl ?? pinned.totalVolumeMl,
      rate: saved.rate ?? 5, dose: saved.dose ?? drug.typicalDose
    } : { direction: 'rateToDose', totalAmount: pinned.totalAmount, totalVolumeMl: pinned.totalVolumeMl, rate: 5, dose: drug.typicalDose };
    const persist = () => AA.State.save(stateKey, s);
    const name = T('vaso.' + drug.key + '.name');
    const unit = T('unit.' + drug.doseUnit);
    const concTitle = T(drug.amount.concTitle);
    const conc = () => (s.totalAmount > 0 && s.totalVolumeMl > 0) ? s.totalAmount * drug.amount.entryToBase / s.totalVolumeMl : null;
    const weight = () => PatientStore.patient.weightKg;
    const needsWeight = () => drug.unit.weightBased && !(weight() > 0);
    const output = () => conc() == null ? null : AA.VasoactiveEngine.calculate({ drug, weightKg: weight(), concentration: conc(), direction: s.direction, rateMlPerHour: s.rate || 0, dose: s.dose });
    const isPinned = () => sameNumber(s.totalAmount, pinned.totalAmount) && sameNumber(s.totalVolumeMl, pinned.totalVolumeMl);
    const presetIndex = () => { const p = drug.presets.find(x => x.totalAmount === s.totalAmount && x.totalVolumeMl === s.totalVolumeMl); return p ? p.index : null; };
    const amountStep = drug.unit.amount === 'unit' ? 5 : (id === 'dopamineInfusion' || id === 'dobutamineInfusion') ? 50 : id === 'dexmedetomidineInfusion' ? 0.1 : 1;

    const header = () => card('<div style="display:flex;justify-content:space-between;gap:12px"><div><h1 class="sec-title" style="font-size:22px;font-weight:900">' + esc(name) + '</h1><div class="sec-sub" style="font-size:12px;color:var(--textSecondary)">' +
      esc(T('vaso.' + drug.key + '.generic')) + '</div></div><span style="font-size:26px;' + tintStyle(drug.tint) + 'color:var(--t)">' + icon(drug.icon) + '</span></div>' +
      '<p style="margin:0;font-size:12px;color:var(--textTertiary)">' + esc(T('vaso.' + drug.key + '.tagline')) + '</p><div class="badges">' + [1, 2, 3].map(n => badge(T('vaso.' + drug.key + '.badge' + n), drug.tint)).join('') + '</div>');

    const directionSection = () => card(sectionHeader({ title: T('vaso.directionTitle'), subtitle: T('vaso.direction.' + s.direction + '.caption'), icon: 'arrow-left-right', tint: drug.tint }) +
      '<div class="actions">' + ['rateToDose', 'doseToRate'].map(d => '<button type="button" class="check-row' + (s.direction === d ? ' on' : '') + '" style="' + tintStyle(drug.tint) + 'flex-direction:column;align-items:center;gap:6px;text-align:center" data-act="direction" data-value="' + d + '">' +
        '<span style="font-size:18px;color:' + (s.direction === d ? 'var(--t)' : 'var(--textTertiary)') + '">' + icon(d === 'rateToDose' ? 'arrow-right' : 'arrow-left') + '</span><b style="font-family:var(--font);font-size:13px">' + esc(T('vaso.direction.' + d)) + '</b></button>').join('') + '</div>');

    const pinButton = () => { const on = isPinned(); return '<button type="button" class="pill-btn" style="' + tintStyle(on ? 'success' : 'info') + '" data-act="pin">' + icon(on ? 'circle-check' : 'pin') + esc(on ? T('prep.isDefault') : T('prep.setAsDefault')) + '</button>'; };
    const presetsHTML = () => '<div class="chips" style="' + tintStyle(drug.tint) + '">' + drug.presets.map(p => '<button type="button" class="preset' + (presetIndex() === p.index ? ' on' : '') + '" style="' + tintStyle(drug.tint) + '" data-act="preset" data-value="' + p.index + '"><b>' +
      esc(Fmt.smart(p.totalAmount) + ' ' + T(drug.amount.entryTitle) + ' / ' + Fmt.smart(p.totalVolumeMl) + ' mL') + '</b><span>' + esc(Fmt.smart(p.totalAmount * drug.amount.entryToBase / p.totalVolumeMl) + ' ' + concTitle) + '</span></button>').join('') + '</div>';
    const concLine = () => conc() == null ? '' : '<div style="display:flex;gap:6px;align-items:center;font-size:12.5px;color:var(--textSecondary);' + tintStyle(drug.tint) + '"><span style="color:var(--t)">' + icon('circle-check') + '</span>' +
      UI.rich(T('vaso.concentrationLine', { concentration: Fmt.smart(conc()), unit: concTitle })) + '</div>';
    const prepSection = () => card(sectionHeader({ title: T('prep.title'), subtitle: T('vaso.prepSubtitle'), icon: 'flask-conical', tint: drug.tint, accessory: region('pin', pinButton()) }) +
      '<div class="fields">' + UI.numericField({ bind: 'totalAmount', title: T('prep.totalDrug'), unit: T(drug.amount.entryTitle), icon: 'pill', value: s.totalAmount, step: amountStep, min: 0, max: 5000, tint: drug.tint }) +
      UI.numericField({ bind: 'totalVolumeMl', title: T('prep.totalVolume'), unit: 'mL', icon: 'droplet', value: s.totalVolumeMl, step: 10, min: 1, max: 1000, tint: 'info' }) + '</div>' +
      region('presets', presetsHTML()) + region('concLine', concLine()));

    const inputSection = () => {
      if (s.direction === 'rateToDose') {
        return card(sectionHeader({ title: T('vaso.pumpRateInput'), subtitle: T('vaso.pumpRateInputSubtitle'), icon: 'gauge', tint: drug.tint }) +
          '<div class="fields one">' + UI.numericField({ bind: 'rate', title: T('vaso.pumpRateInput'), unit: T('unit.mlPerHour'), icon: 'gauge', value: s.rate, step: 0.5, min: 0, max: 200, tint: drug.tint }) + '</div>' +
          region('quickRates', quickRates()));
      }
      return card(sectionHeader({ title: T('vaso.doseInput'), subtitle: T('vaso.doseInputSubtitle'), icon: 'sliders-horizontal', tint: drug.tint }) +
        UI.doseSlider({ bind: 'dose', title: T('calc.targetDose'), unit, value: s.dose, min: drug.sliderRange.lo, max: drug.sliderRange.hi, step: drug.doseStep, recLo: drug.doseRange.lo, recHi: drug.doseRange.hi, tint: drug.tint, format: Fmt.dose }));
    };
    const quickRates = () => '<div class="chips" style="' + tintStyle(drug.tint) + '">' + [1, 2, 5, 10, 20].map(v => '<button type="button" class="chip' + (s.rate === v ? ' on' : '') + '" data-act="quick-rate" data-value="' + v + '">' + esc(Fmt.smart(v)) + '</button>').join('') + '</div>';

    const results = () => {
      if (needsWeight()) return UI.emptyState({ icon: 'weight', title: T('calc.missingPatientTitle'), message: T('vaso.needWeight'), tint: drug.tint });
      const out = output();
      if (!out) return UI.emptyState({ icon: 'flask-conical', title: T('calc.missingPrepTitle'), message: T('vaso.needPreparation'), tint: drug.tint });
      const r2d = s.direction === 'rateToDose';
      const band = drug.bands.find(b => b.id === out.bandID);
      const bandTitle = band ? T('vaso.' + drug.key + '.band.' + band.id + '.title') : '';
      const w = weight();
      const c = Fmt.smart(conc());
      let formulaDesc, formulaSub;
      if (drug.unit.weightBased) formulaDesc = T(r2d ? 'vaso.formula.rateToDoseWeight' : 'vaso.formula.doseToRateWeight');
      else formulaDesc = T(r2d ? 'vaso.formula.rateToDose' : 'vaso.formula.doseToRate');
      const wt = Fmt.smart(w || 0);
      if (r2d) formulaSub = drug.unit.weightBased ? '= (' + Fmt.smart(out.rateMlPerHour) + ' × ' + c + ') ÷ (60 × ' + wt + ') = ' + Fmt.dose(out.dose) + ' ' + unit
        : '= (' + Fmt.smart(out.rateMlPerHour) + ' × ' + c + ') ÷ 60 = ' + Fmt.dose(out.dose) + ' ' + unit;
      else formulaSub = drug.unit.weightBased ? '= (' + Fmt.dose(out.dose) + ' × 60 × ' + wt + ') ÷ ' + c + ' = ' + Fmt.dose(out.rateMlPerHour) + ' ' + T('unit.mlPerHour')
        : '= (' + Fmt.dose(out.dose) + ' × 60) ÷ ' + c + ' = ' + Fmt.dose(out.rateMlPerHour) + ' ' + T('unit.mlPerHour');
      // Not: iOS'ta ağırlığa bağlı olmayan saatlik birimlerde de aynı formül metni kullanılır.
      let tiles = metric({ title: T('vaso.perMinute'), value: Fmt.dose(out.amountPerMinute), unit: T(drug.amount.baseTitle), icon: 'clock', tint: drug.tint }) +
        metric({ title: T('vaso.perHour'), value: Fmt.dose(out.amountPerHour), unit: T(drug.amount.baseTitle), icon: 'history', tint: drug.tint });
      if (!drug.unit.weightBased && drug.unit.amount === 'microgram' && out.perKgPerMinute != null) tiles += metric({ title: T('unit.mcgPerKgPerMinute'), value: Fmt.dose(out.perKgPerMinute), unit: T('unit.mcg'), icon: 'weight', tint: 'info' });
      if (out.milligramPerHour != null) tiles += metric({ title: T('unit.mgPerHour'), value: Fmt.dose(out.milligramPerHour), unit: T('unit.mg'), icon: 'pill', tint: 'secondary' });
      tiles += metric({ title: T('calc.pumpRate'), value: Fmt.dose(out.rateMlPerHour), unit: T('unit.mlPerHour'), icon: 'gauge', tint: 'warning' });

      const result = card(sectionHeader({ title: T('result.title'), subtitle: T(r2d ? 'vaso.resultDoseSubtitle' : 'vaso.resultRateSubtitle'), icon: 'activity', tint: drug.tint, accessory: band ? badge(bandTitle, band.tint) : '' }) +
        UI.bigResult({ label: T(r2d ? 'vaso.deliveredDose' : 'calc.pumpRate'), value: r2d ? Fmt.dose(out.dose) : Fmt.dose(out.rateMlPerHour), unit: r2d ? unit : T('unit.mlPerHour'),
          caption: r2d ? T('vaso.resultCaptionDose', { rate: Fmt.dose(out.rateMlPerHour) }) : T('vaso.resultCaptionRate', { dose: Fmt.dose(out.dose), unit }), tint: drug.tint }) +
        (band ? '<div class="verdict" style="' + tintStyle(band.tint) + '"><b>' + esc(bandTitle) + '</b><p>' + UI.rich(T('vaso.' + drug.key + '.band.' + band.id + '.detail')) + '</p></div>' : '') +
        '<div class="metrics">' + tiles + '</div>' + UI.formula(formulaDesc, formulaSub, drug.tint));
      const table = card(sectionHeader({ title: T('vaso.tableTitle'), subtitle: T('vaso.tableSubtitle', { concentration: c + ' ' + concTitle }), icon: 'table', tint: 'secondary' }) +
        '<div class="tbl-wrap" style="' + tintStyle(drug.tint) + '"><table class="tbl"><thead><tr><th>' + esc(T('unit.mlPerHour')) + '</th><th>' + esc(unit) + '</th></tr></thead><tbody>' +
        out.rows.map(r => '<tr class="' + (r.isCurrent ? 'cur' : '') + '"><td>' + esc(Fmt.smart(r.rate)) + '</td><td class="strong">' + esc(Fmt.dose(r.dose)) + '</td></tr>').join('') + '</tbody></table></div>' +
        '<div class="sec-sub">' + esc(drug.unit.weightBased ? T('vaso.tableFooter', { weight: Fmt.smart(w || 0) }) : T('vaso.tableFooterFixed')) + '</div>');
      const notes = notesCard(T('vaso.notesTitle'), [1, 2, 3, 4].slice(0, drug.noteCount).map(n => T('vaso.' + drug.key + '.note' + n)), drug.tint);
      return result + table + notes + UI.warningsCard(out.warnings) + '<div class="actions">' + shareButton() + UI.addToPatientButton(drug.tint) + '</div>';
    };

    const shareText = out => {
      const lines = [name];
      if (weight() > 0) lines.push(T('share.patient') + ': ' + Fmt.smart(weight()) + ' kg');
      lines.push(T('share.preparation') + ': ' + Fmt.smart(s.totalAmount || 0) + ' ' + T(drug.amount.entryTitle) + ' / ' + Fmt.smart(s.totalVolumeMl || 0) + ' mL = ' + Fmt.smart(conc() || 0) + ' ' + concTitle);
      lines.push(T('calc.pumpRate') + ': ' + Fmt.dose(out.rateMlPerHour) + ' ' + T('unit.mlPerHour'));
      lines.push(T('vaso.deliveredDose') + ': ' + Fmt.dose(out.dose) + ' ' + unit);
      return shareLines(lines);
    };

    return {
      tint: drug.tint, title: name,
      topRight: () => resetBtn(drug.tint),
      body: () => header() + (drug.unit.weightBased ? AA.patientCard({ derived: false }) : '') + directionSection() + prepSection() + inputSection() +
        '<div data-region="out" style="display:flex;flex-direction:column;gap:22px">' + results() + '</div>' + UI.footnote(T('vaso.footer')),
      regions: { pin: pinButton, presets: presetsHTML, concLine, out: results, quickRates },
      get(path) { return { totalAmount: s.totalAmount, totalVolumeMl: s.totalVolumeMl, rate: s.rate, dose: s.dose }[path]; },
      set(path, value) { s[path] = value; persist(); },
      act: {
        direction(el) { s.direction = el.getAttribute('data-value'); persist(); AA.App.render(); },
        preset(el) { const p = drug.presets.find(x => x.index === Number(el.getAttribute('data-value'))); s.totalAmount = p.totalAmount; s.totalVolumeMl = p.totalVolumeMl; persist(); AA.App.render(); },
        pin() { if (isPinned() || !(s.totalAmount > 0 && s.totalVolumeMl > 0)) return; pinned = { totalAmount: s.totalAmount, totalVolumeMl: s.totalVolumeMl }; AA.State.save(pinKey, pinned); AA.App.refresh(); },
        'quick-rate'(el) { s.rate = Number(el.getAttribute('data-value')); persist(); AA.App.render(); },
        reset() { s.direction = 'rateToDose'; s.totalAmount = pinned.totalAmount; s.totalVolumeMl = pinned.totalVolumeMl; s.rate = 5; s.dose = drug.typicalDose; persist(); AA.App.render(); },
        share() { const out = output(); if (out && !needsWeight()) UI.share(shareText(out)); },
        'add-to-patient'(el) { const out = output(); if (out) UI.addToPatient(name, Fmt.dose(out.dose) + ' ' + unit + ' = ' + Fmt.dose(out.rateMlPerHour) + ' ' + T('unit.mlPerHour'), el); }
      }
    };
  }

  // ================================================================ 3) İdame sıvı + açık kaybı
  function fluidScreen() {
    const key = 'fluid.state.v1';
    const s = Object.assign({ npoHours: 8, includeDeficit: true, traumaLevel: 3 }, AA.State.load(key, {}));
    const persist = () => AA.State.save(key, s);
    const tint = 'info';
    const output = () => {
      const w = PatientStore.patient.weightKg;
      if (!(w > 0)) return null;
      return AA.FluidEngine.calculate({ weightKg: w, npoHours: s.npoHours || 0, traumaLevel: s.traumaLevel, includeDeficit: s.includeDeficit, profile: PatientStore.profile });
    };
    const fasting = () => {
      let html = sectionHeader({ title: T('fluid.fasting'), subtitle: T('fluid.fastingSubtitle'), icon: 'clock', tint }) +
        '<div class="setting"><div><b>' + esc(T('fluid.includeDeficit')) + '</b><span>' + esc(T('fluid.includeDeficitCaption')) + '</span></div>' + UI.toggle({ bind: 'includeDeficit', checked: s.includeDeficit, tint, label: T('fluid.includeDeficit') }) + '</div>';
      if (s.includeDeficit) {
        html += '<div class="fields one">' + UI.numericField({ bind: 'npoHours', title: T('fluid.npoHours'), unit: T('unit.hourShort'), icon: 'moon-star', value: s.npoHours, step: 1, min: 0, max: 48, tint }) + '</div>' +
          '<div class="chips" style="' + tintStyle(tint) + '">' + [6, 8, 10, 12].map(h => '<button type="button" class="chip' + (s.npoHours === h ? ' on' : '') + '" data-act="npo" data-value="' + h + '">' + esc(Fmt.smart(h) + ' ' + T('unit.hourShort')) + '</button>').join('') + '</div>';
      }
      return card(html);
    };
    const trauma = () => {
      const lv = s.traumaLevel, lt = AA.traumaTint(lv);
      return card(sectionHeader({ title: T('fluid.surgicalLoss'), subtitle: T('fluid.surgicalLossSubtitle'), icon: 'scan', tint: lt }) +
        '<div class="chips">' + Array.from({ length: 10 }, (_, i) => i + 1).map(n => '<button type="button" class="chip' + (lv === n ? ' on' : '') + '" style="' + tintStyle(AA.traumaTint(n)) + 'min-width:42px;justify-content:center" data-act="trauma" data-value="' + n + '">' + n + '</button>').join('') + '</div>' +
        '<div class="panel" style="' + tintStyle(lt) + '"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b style="font-family:var(--font);font-size:14px">' + esc(T('fluid.trauma.' + lv + '.title')) + '</b>' + badge(AA.traumaSeverity(lv), lt) + '</div>' +
        '<div style="font-size:12px;color:var(--textSecondary)">' + esc(T('fluid.trauma.' + lv + '.examples')) + '</div><div class="sec-sub" style="display:flex;gap:5px;align-items:center">' + icon('sigma') + esc(T('fluid.coefficientValue', { value: Fmt.smart(lv) })) + '</div></div>');
    };
    const results = () => {
      const out = output();
      if (!out) return UI.emptyState({ icon: 'user', title: T('calc.missingPatientTitle'), message: T('fluid.needWeight'), tint });
      const result = card(sectionHeader({ title: T('result.title'), subtitle: T('fluid.resultSubtitle'), icon: 'droplet', tint }) +
        UI.bigResult({ label: T('fluid.firstHour'), value: Fmt.smart(out.hour1Total), unit: T('unit.mlPerHour'),
          caption: T('fluid.firstHourCaption', { maintenance: Fmt.smart(out.maintenancePerHour), surgical: Fmt.smart(out.surgicalLossPerHour), deficit: Fmt.smart(out.deficitHour1) }), tint }) +
        '<div class="metrics">' + metric({ title: T('fluid.maintenance'), value: Fmt.smart(out.maintenancePerHour), unit: T('unit.mlPerHour'), icon: 'droplet', tint }) +
        metric({ title: T('fluid.surgicalLossShort'), value: Fmt.smart(out.surgicalLossPerHour), unit: T('unit.mlPerHour'), icon: 'scan', tint: AA.traumaTint(s.traumaLevel) }) +
        metric({ title: T('fluid.deficitTotal'), value: Fmt.smart(out.deficitTotal), unit: 'mL', icon: 'history', tint: 'warning' }) +
        metric({ title: T('fluid.dailyMaintenance'), value: Fmt.smart(out.maintenancePerDay), unit: 'mL', icon: 'calendar', tint: 'secondary' }) + '</div>' +
        UI.formula(T('fluid.formulaMaintenance'), T('fluid.formulaTotal'), tint));
      const row = (label, d, t, cur) => '<tr class="' + (cur ? 'cur' : '') + '"><td>' + esc(label) + '</td><td>' + esc(d) + '</td><td class="strong">' + esc(t) + '</td></tr>';
      const plan = card(sectionHeader({ title: T('fluid.planTitle'), subtitle: T('fluid.planSubtitle'), icon: 'list-ordered', tint: 'secondary' }) +
        '<div class="tbl-wrap" style="' + tintStyle(tint) + '"><table class="tbl"><thead><tr><th>' + esc(T('fluid.planColumnHour')) + '</th><th>' + esc(T('fluid.planColumnDeficit')) + '</th><th>' + esc(T('fluid.planColumnTotal')) + '</th></tr></thead><tbody>' +
        row(T('fluid.hour1'), Fmt.smart(out.deficitHour1), Fmt.smart(out.hour1Total), true) + row(T('fluid.hour2'), Fmt.smart(out.deficitHour2), Fmt.smart(out.hour2Total)) +
        row(T('fluid.hour3'), Fmt.smart(out.deficitHour3), Fmt.smart(out.hour3Total)) + row(T('fluid.hourNext'), '—', Fmt.smart(out.steadyStatePerHour)) + '</tbody></table></div>' +
        '<div class="sec-sub">' + esc(T('fluid.planFooter')) + '</div>');
      return result + plan + UI.warningsCard(out.warnings) + shareButton();
    };
    const shareText = out => shareLines([T('catalog.maintenanceFluid.title'),
      T('share.patient') + ': ' + Fmt.smart(PatientStore.patient.weightKg || 0) + ' kg',
      T('fluid.maintenance') + ': ' + Fmt.smart(out.maintenancePerHour) + ' ' + T('unit.mlPerHour'),
      T('fluid.surgicalLossShort') + ' (' + Fmt.smart(s.traumaLevel) + ' mL/kg/' + T('unit.hourShort') + '): ' + Fmt.smart(out.surgicalLossPerHour) + ' ' + T('unit.mlPerHour'),
      T('fluid.deficitTotal') + ': ' + Fmt.smart(out.deficitTotal) + ' mL',
      T('fluid.hour1') + ': ' + Fmt.smart(out.hour1Total) + ' ' + T('unit.mlPerHour'),
      T('fluid.hour2') + ' / ' + T('fluid.hour3') + ': ' + Fmt.smart(out.hour2Total) + ' ' + T('unit.mlPerHour'),
      T('fluid.hourNext') + ': ' + Fmt.smart(out.steadyStatePerHour) + ' ' + T('unit.mlPerHour')]);
    return {
      tint, title: T('catalog.maintenanceFluid.title'),
      topRight: () => resetBtn(tint),
      body: () => AA.patientCard({ derived: false }) + fasting() + trauma() + '<div data-region="out" style="display:flex;flex-direction:column;gap:22px">' + results() + '</div>' + UI.footnote(T('fluid.footer')),
      regions: { out: results },
      get(p) { return s[p]; },
      set(p, v) { s[p] = p === 'includeDeficit' ? !!v : v; persist(); if (p === 'includeDeficit') return 'render'; },
      act: {
        npo(el) { s.npoHours = Number(el.getAttribute('data-value')); persist(); AA.App.render(); },
        trauma(el) { s.traumaLevel = Number(el.getAttribute('data-value')); persist(); AA.App.render(); },
        reset() { Object.assign(s, { npoHours: 8, includeDeficit: true, traumaLevel: 3 }); persist(); AA.App.render(); },
        share() { const out = output(); if (out) UI.share(shareText(out)); }
      }
    };
  }

  // ================================================================ 4) İzin verilen kan kaybı
  function bloodLossScreen() {
    const key = 'bloodLoss.state.v1';
    const s = Object.assign({ group: 'adult', sex: PatientStore.patient.sex || 'male', initialHct: 40, targetHct: 30 }, AA.State.load(key, {}));
    const persist = () => AA.State.save(key, s);
    const tint = 'danger';
    const E = AA.BloodVolumeEngine;
    const output = () => {
      const w = PatientStore.patient.weightKg;
      if (!(w > 0) || s.initialHct == null || s.targetHct == null) return null;
      return E.calculate({ weightKg: w, group: s.group, sex: s.sex, initialHct: s.initialHct, targetHct: s.targetHct });
    };
    const groupSection = () => card(sectionHeader({ title: T('blood.group'), subtitle: T('blood.groupSubtitle'), icon: 'users', tint }) +
      '<div class="opt-list">' + E.groups.map(g => '<button type="button" class="opt' + (s.group === g ? ' on' : '') + '" style="' + tintStyle(tint) + '" data-act="group" data-value="' + g + '"><span class="radio"></span><span class="ot"><b style="font-family:var(--font)">' +
        esc(T('blood.group.' + g + '.title')) + '</b><br><span style="font-size:11.5px;color:var(--textTertiary)">' + esc(T('blood.group.' + g + '.subtitle')) + '</span></span><span class="pts">' + esc(Fmt.smart(E.mlPerKg(g, s.sex))) + ' mL/kg</span></button>').join('') + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:6px"><div class="sec-sub" style="font-weight:700">' + esc(T('patient.sex')) + '</div>' +
      UI.segmented({ act: 'sex', items: [{ value: 'male', label: T('sex.male') }, { value: 'female', label: T('sex.female') }], selected: s.sex }) +
      '<div class="sec-sub">' + esc(T(s.group === 'adult' ? 'blood.sexAffects' : 'blood.sexNoEffect')) + '</div></div>');
    const hctSection = () => card(sectionHeader({ title: T('blood.hematocrit'), subtitle: T('blood.hematocritSubtitle'), icon: 'droplets', tint }) +
      '<div class="fields">' + UI.numericField({ bind: 'initialHct', title: T('blood.initialHct'), unit: '%', icon: 'arrow-up-right', value: s.initialHct, step: 1, min: 5, max: 65, tint: 'info' }) +
      UI.numericField({ bind: 'targetHct', title: T('blood.targetHct'), unit: '%', icon: 'target', value: s.targetHct, step: 1, min: 15, max: 45, tint }) + '</div>' +
      region('hctQuick', hctQuick()));
    const hctQuick = () => '<div class="quick" style="grid-template-columns:repeat(4,1fr)">' + [21, 24, 27, 30].map(v => '<button type="button" data-act="target" data-value="' + v + '" style="' + (s.targetHct === v ? 'border-color:color-mix(in srgb,var(--danger) 60%,transparent);background:color-mix(in srgb,var(--danger) 12%,transparent)' : '') + '"><b>' +
      esc(percentText(v, 0)) + '</b><small>Hb ' + esc(Fmt.decimal(v / 3)) + '</small></button>').join('') + '</div>';
    const results = () => {
      const out = output();
      if (!out) return UI.emptyState({ icon: 'user', title: T('calc.missingPatientTitle'), message: T('blood.needData'), tint });
      const result = card(sectionHeader({ title: T('result.title'), subtitle: T('blood.resultSubtitle'), icon: 'droplet', tint }) +
        UI.bigResult({ label: T('blood.allowableLoss'), value: Fmt.smart(out.allowableLoss), unit: 'mL', caption: T('blood.allowableCaption', { percent: Fmt.smart(out.allowableLossPercent), ebv: Fmt.smart(out.estimatedBloodVolume) }), tint }) +
        '<div class="metrics">' + metric({ title: T('blood.ebv'), value: Fmt.smart(out.estimatedBloodVolume), unit: 'mL', icon: 'heart', tint: 'info' }) +
        metric({ title: T('blood.ebvFactor'), value: Fmt.smart(out.mlPerKg), unit: 'mL/kg', icon: 'weight', tint: 'secondary' }) +
        metric({ title: T('blood.targetHb'), value: Fmt.decimal(out.targetHemoglobin), unit: 'g/dL', icon: 'target', tint }) +
        metric({ title: T('blood.averageMethod'), value: Fmt.smart(out.allowableLossAverageHct), unit: 'mL', icon: 'sigma', tint: 'warning' }) + '</div>' +
        '<div>' + UI.infoRow(T('blood.crystalloid'), Fmt.smart(out.crystalloidReplacement) + ' mL', { caption: T('blood.crystalloidCaption') }) + '<hr class="divider">' +
        UI.infoRow(T('blood.colloid'), Fmt.smart(out.colloidReplacement) + ' mL', { caption: T('blood.colloidCaption') }) + '</div>' +
        UI.formula(T('blood.formula'), T('blood.formulaFilled', { ebv: Fmt.smart(out.estimatedBloodVolume), initial: Fmt.smart(s.initialHct || 0), target: Fmt.smart(s.targetHct || 0), result: Fmt.smart(out.allowableLoss) }), tint));
      const cls = card(sectionHeader({ title: T('blood.classTitle'), subtitle: T('blood.classSubtitle'), icon: 'chart-bar', tint: 'warning' }) +
        '<div class="tbl-wrap" style="--t:var(--warning)"><table class="tbl"><thead><tr><th>' + esc(T('blood.classColumn')) + '</th><th>' + esc(T('blood.classPercent')) + '</th><th>' + esc(T('blood.classVolume')) + '</th></tr></thead><tbody>' +
        out.classThresholds.map(r => '<tr class="' + (r.classNumber === 2 ? 'cur' : '') + '"><td>' + esc(T('blood.class' + r.classNumber)) + '</td><td>' + esc(r.percentText) + '</td><td class="strong">' + esc((r.classNumber === 4 ? '> ' : '') + Fmt.smart(r.volume)) + '</td></tr>').join('') +
        '</tbody></table></div><div class="sec-sub">' + esc(T('blood.classFooter')) + '</div>');
      return result + cls + UI.warningsCard(out.warnings) + shareButton();
    };
    const shareText = out => shareLines([T('catalog.allowableBloodLoss.title'),
      T('share.patient') + ': ' + Fmt.smart(PatientStore.patient.weightKg || 0) + ' kg · ' + T('blood.group.' + s.group + '.title') + ' · ' + T('sex.' + s.sex),
      T('blood.ebv') + ': ' + Fmt.smart(out.estimatedBloodVolume) + ' mL (' + Fmt.smart(out.mlPerKg) + ' mL/kg)',
      'Hct: ' + percentText(s.initialHct || 0, 1) + ' → ' + percentText(s.targetHct || 0, 1),
      T('blood.allowableLoss') + ': ' + Fmt.smart(out.allowableLoss) + ' mL (' + percentText(out.allowableLossPercent, 1) + ')',
      T('blood.crystalloid') + ': ' + Fmt.smart(out.crystalloidReplacement) + ' mL']);
    return {
      tint, title: T('catalog.allowableBloodLoss.title'),
      topRight: () => resetBtn(tint),
      body: () => AA.patientCard({ derived: false }) + groupSection() + hctSection() + '<div data-region="out" style="display:flex;flex-direction:column;gap:22px">' + results() + '</div>' + UI.footnote(T('blood.footer')),
      regions: { out: results, hctQuick },
      get(p) { return s[p]; },
      set(p, v) { s[p] = v; persist(); },
      act: {
        group(el) { s.group = el.getAttribute('data-value'); persist(); AA.App.render(); },
        sex(el) { s.sex = el.getAttribute('data-value'); persist(); AA.App.render(); },
        target(el) { s.targetHct = Number(el.getAttribute('data-value')); persist(); AA.App.render(); },
        reset() { Object.assign(s, { group: 'adult', sex: PatientStore.patient.sex || 'male', initialHct: 40, targetHct: 30 }); persist(); AA.App.render(); },
        share() { const out = output(); if (out) UI.share(shareText(out)); }
      }
    };
  }

  // ================================================================ 5) Zor havayolu skorları
  function airwayScoreScreen(id) {
    const score = AA.AIRWAY[id];
    const key = 'airway.state.' + id + '.v1';
    const defaults = () => Object.fromEntries(score.items.map(i => [i.key, 0]));
    const sel = Object.assign(defaults(), AA.State.load(key, {}));
    const persist = () => AA.State.save(key, sel);
    const k = score.key;
    const name = T('airway.' + k + '.name');
    const idx = it => AA.clamp(sel[it.key] ?? 0, 0, it.options.length - 1);
    const output = () => AA.AirwayScoreEngine.calculate(score, sel);
    const bandOf = out => score.bands.find(b => b.key === out.bandKey);

    const items = () => {
      const cls = score.kind === 'classification';
      let html = sectionHeader({ title: T(cls ? 'airway.selectClass' : 'airway.criteria'), subtitle: cls ? null : T('airway.criteriaSubtitle'), icon: 'list-checks', tint: score.tint });
      for (const it of score.items) {
        if (cls) {
          html += '<div class="opt-list">' + it.options.map((o, i) => '<button type="button" class="opt' + (idx(it) === i ? ' on' : '') + '" style="' + tintStyle(score.tint) + 'align-items:flex-start" data-act="pick" data-item="' + it.key + '" data-value="' + i + '"><span class="radio" style="margin-top:2px"></span><span class="ot"><b style="font-family:var(--font)">' +
            esc(T('airway.' + k + '.option.' + o.key)) + '</b><br><span style="font-size:11.5px;color:var(--textTertiary)">' + esc(T('airway.' + k + '.optionDetail.' + o.key)) + '</span></span></button>').join('') + '</div>';
        } else if (score.usesCheckboxes) {
          const on = idx(it) === 1;
          html += '<button type="button" class="check-row' + (on ? ' on' : '') + '" style="' + tintStyle(score.tint) + '" data-act="pick" data-item="' + it.key + '" data-value="' + (on ? 0 : 1) + '"><span class="box">' + (on ? icon('check') : '') + '</span><span class="ct"><b>' +
            esc(T('airway.' + k + '.item.' + it.key)) + '</b><span>' + esc(T('airway.' + k + '.hint.' + it.key)) + '</span></span><span class="pts">+' + it.options[1].points + '</span></button>';
        } else {
          html += '<div style="display:flex;flex-direction:column;gap:8px"><div><b style="font-family:var(--font);font-size:13.5px">' + esc(T('airway.' + k + '.item.' + it.key)) + '</b><div class="sec-sub">' + esc(T('airway.' + k + '.hint.' + it.key)) + '</div></div>' +
            '<div class="quick" style="grid-template-columns:repeat(' + it.options.length + ',1fr);' + tintStyle(score.tint) + '">' + it.options.map((o, i) => '<button type="button" data-act="pick" data-item="' + it.key + '" data-value="' + i + '" style="' +
              (idx(it) === i ? 'border-color:color-mix(in srgb,var(--t) 70%,transparent);background:color-mix(in srgb,var(--t) 15%,transparent)' : '') + '"><b style="font-size:12px;' + (idx(it) === i ? 'color:var(--t)' : '') + '">' + esc(T('airway.' + k + '.option.' + o.key)) + '</b><small>+' + o.points + '</small></button>').join('') + '</div></div>';
        }
      }
      return card(html);
    };
    const result = () => {
      const out = output(), band = bandOf(out);
      let big;
      if (score.kind === 'classification') {
        const it = score.items[0], o = it.options[idx(it)];
        big = UI.bigResult({ label: T('airway.resultClass'), value: T('airway.' + k + '.option.' + o.key), unit: '', caption: band ? T('airway.' + k + '.band.' + band.key + '.detail') : '', tint: band ? band.tint : score.tint });
      } else {
        big = UI.bigResult({ label: T('airway.totalScore'), value: String(out.total), unit: '/ ' + score.maxPoints, caption: band ? T('airway.' + k + '.band.' + band.key + '.detail') : '', tint: band ? band.tint : score.tint });
      }
      return card(sectionHeader({ title: T('result.title'), subtitle: T(score.kind === 'classification' ? 'airway.resultClass' : 'airway.resultScore'), icon: 'activity', tint: score.tint,
        accessory: band ? badge(T('airway.' + k + '.band.' + band.key + '.title'), band.tint) : '' }) + big +
        (band ? '<div class="verdict" style="' + tintStyle(band.tint) + '"><b>' + esc(T('airway.' + k + '.band.' + band.key + '.title')) + '</b><p>' + UI.rich(T('airway.' + k + '.band.' + band.key + '.detail')) + '</p></div>' : ''));
    };
    const shareText = () => {
      const out = output(), band = bandOf(out);
      const lines = [name];
      for (const it of score.items) {
        const o = it.options[idx(it)];
        lines.push(score.kind === 'classification' ? T('airway.' + k + '.option.' + o.key) : T('airway.' + k + '.item.' + it.key) + ': ' + T('airway.' + k + '.option.' + o.key) + ' (+' + o.points + ')');
      }
      if (score.kind === 'sum') lines.push(T('airway.totalScore') + ': ' + out.total + ' / ' + score.maxPoints);
      if (band) lines.push(T('airway.' + k + '.band.' + band.key + '.title'));
      return shareLines(lines);
    };
    const notes = Array.from({ length: score.noteCount }, (_, i) => T('airway.' + k + '.note' + (i + 1)));
    return {
      tint: score.tint, title: name,
      topRight: () => resetBtn(score.tint) + infoBtn(id, score.tint),
      body: () => scoreHeader({ name, subtitle: T('airway.' + k + '.subtitle'), ic: score.icon, tint: score.tint, summary: T('airway.' + k + '.summary'),
          extra: score.threshold != null && score.kind === 'sum' ? '<div>' + badge(T('airway.thresholdBadge', { threshold: score.threshold, max: score.maxPoints }), score.tint) + '</div>' : '' }) +
        items() + result() + notesCard(T('airway.notesTitle'), notes, score.tint) + UI.warningsCard(output().warnings) + shareButton() + UI.footnote(T('airway.' + k + '.reference'), 'book-open'),
      act: {
        pick(el) { sel[el.getAttribute('data-item')] = Number(el.getAttribute('data-value')); persist(); AA.App.render(); },
        reset() { Object.assign(sel, defaults()); persist(); AA.App.render(); },
        share() { UI.share(shareText()); }
      }
    };
  }

  // ================================================================ 6) Havayolu ölçümleri
  function airwayMeasurementsScreen() {
    const key = 'airwayMeasurements.state.v1';
    const s = Object.assign({ thyromental: 6.5, sternomental: 13, interincisor: 4, neck: null, ulbt: 0 }, AA.State.load(key, {}));
    const persist = () => AA.State.save(key, s);
    const tint = 'success';
    const output = () => AA.AirwayMeasurementEngine.calculate({ thyromentalCm: s.thyromental, sternomentalCm: s.sternomental, interincisorCm: s.interincisor,
      neckCircumferenceCm: s.neck, heightCm: PatientStore.patient.heightCm, upperLipBiteIndex: s.ulbt });
    const statusTint = k => k === 'normal' ? 'success' : k === 'borderline' ? 'warning' : 'danger';
    const results = () => {
      const out = output();
      const rc = out.riskCount;
      return card(sectionHeader({ title: T('result.title'), subtitle: T('airwayMeasure.resultSubtitle'), icon: 'clipboard-check', tint: rc > 0 ? 'warning' : tint,
        accessory: badge(T('airwayMeasure.riskCount', { count: rc }), rc >= 2 ? 'danger' : rc === 1 ? 'warning' : 'success') }) +
        (out.findings.length ? out.findings.map(f => '<div style="display:flex;gap:10px;align-items:center;' + tintStyle(statusTint(f.statusKey)) + '"><span style="color:var(--t)">' + icon(f.isRisk ? 'triangle-alert' : 'circle-check') + '</span>' +
          '<div style="flex:1;min-width:0"><b style="font-family:var(--font);font-size:13px">' + esc(T('airwayMeasure.finding.' + f.key)) + '</b><div class="sec-sub">' + esc(T('airwayMeasure.threshold.' + f.key)) + '</div></div>' +
          '<div style="text-align:right"><b class="num" style="font-size:15px">' + esc(f.value) + '</b><div style="font-family:var(--font);font-size:11px;font-weight:700;color:var(--t)">' + esc(T('airwayMeasure.status.' + f.statusKey)) + '</div></div></div>').join('<hr class="divider">')
          : '<p class="sec-sub" style="margin:0">' + esc(T('airwayMeasure.empty')) + '</p>')) + UI.warningsCard(out.warnings);
    };
    return {
      tint, title: T('catalog.airwayMeasurements.title'),
      topRight: () => resetBtn(tint),
      body: () => AA.patientCard({ derived: false }) +
        card(sectionHeader({ title: T('airwayMeasure.title'), subtitle: T('airwayMeasure.subtitle'), icon: 'ruler', tint }) +
          '<div class="fields">' + UI.numericField({ bind: 'thyromental', title: T('airwayMeasure.thyromental'), unit: 'cm', icon: 'arrow-up-down', value: s.thyromental, step: 0.5, min: 0, max: 20, tint }) +
          UI.numericField({ bind: 'sternomental', title: T('airwayMeasure.sternomental'), unit: 'cm', icon: 'arrow-up-down', value: s.sternomental, step: 0.5, min: 0, max: 30, tint: 'info' }) +
          UI.numericField({ bind: 'interincisor', title: T('airwayMeasure.interincisor'), unit: 'cm', icon: 'arrow-left-right', value: s.interincisor, step: 0.5, min: 0, max: 10, tint: 'secondary' }) +
          UI.numericField({ bind: 'neck', title: T('airwayMeasure.neck'), unit: 'cm', icon: 'circle-dot', value: s.neck, step: 1, min: 0, max: 80, tint: 'warning' }) + '</div>') +
        card(sectionHeader({ title: T('airwayMeasure.ulbtTitle'), subtitle: T('airwayMeasure.ulbtSubtitle'), icon: 'mouth', tint }) +
          '<div class="opt-list">' + [0, 1, 2].map(i => '<button type="button" class="opt' + (s.ulbt === i ? ' on' : '') + '" style="' + tintStyle(tint) + 'align-items:flex-start" data-act="ulbt" data-value="' + i + '"><span class="radio" style="margin-top:2px"></span><span class="ot"><b style="font-family:var(--font)">' +
            esc(T('airwayMeasure.ulbt.' + i)) + '</b><br><span style="font-size:11.5px;color:var(--textTertiary)">' + esc(T('airwayMeasure.ulbtDetail.' + i)) + '</span></span></button>').join('') + '</div>') +
        '<div data-region="out" style="display:flex;flex-direction:column;gap:22px">' + results() + '</div>' + UI.footnote(T('airwayMeasure.reference'), 'book-open'),
      regions: { out: results },
      get(p) { return s[p]; },
      set(p, v) { s[p] = v; persist(); },
      act: {
        ulbt(el) { s.ulbt = Number(el.getAttribute('data-value')); persist(); AA.App.render(); },
        reset() { Object.assign(s, { thyromental: 6.5, sternomental: 13, interincisor: 4, neck: null, ulbt: 0 }); persist(); AA.App.render(); }
      }
    };
  }

  // ================================================================ 7) Parametre tabanlı skorlar (sepsis ve yoğun bakım)
  function parameterScoreScreen(id) {
    const score = AA.SCORES[id];
    const E = AA.ParameterScoreEngine;
    const key = 'sepsis.state.' + id + '.v1';
    const defaults = () => Object.fromEntries(score.items.map(i => [i.key, E.defaultValue(i)]));
    const values = Object.assign(defaults(), AA.State.load(key, {}));
    const persist = () => AA.State.save(key, values);
    const k = score.key;
    const name = T('sepsis.' + k + '.name');
    const output = () => E.calculate(score, values);
    const bandOf = out => score.bands.find(b => b.key === out.bandKey);
    const val = it => values[it.key] ?? E.defaultValue(it);
    const resultLabel = () => T(score.logic === 'sum' ? 'airway.totalScore' : score.logic === 'camICU' ? 'sepsis.result.assessment' : 'sepsis.result.risk');
    const resultValue = out => score.logic === 'camICU' ? T('sepsis.camicu.result.' + (out.algorithmicResultKey || 'negative')) : String(out.total);
    const resultUnit = () => score.logic === 'sum' ? '/ ' + score.maxPoints : score.logic === 'camICU' ? '' : '%';

    const pointsText = it => '+' + (output().itemPoints[it.key] ?? 0);
    const params = () => {
      let html = sectionHeader({ title: T('sepsis.parameters'), subtitle: T(score.showsPoints ? 'sepsis.parametersSubtitle' : 'sepsis.parametersSubtitleAlgorithm'), icon: 'sliders-horizontal', tint: score.tint });
      for (const it of score.items) {
        const inp = it.input;
        if (inp.type === 'numeric') {
          html += '<div style="display:flex;flex-direction:column;gap:6px"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px"><b style="font-family:var(--font);font-size:13.5px">' + esc(T('sepsis.' + k + '.item.' + it.key)) + '</b>' +
            (score.showsPoints ? '<b class="num" style="font-size:13px;' + tintStyle(score.tint) + 'color:var(--t)" data-region="pts-' + it.key + '">' + esc(pointsText(it)) + '</b>' : '') + '</div>' +
            UI.numericField({ bind: it.key, title: T('sepsis.' + k + '.hint.' + it.key), unit: unitLabel(inp.unit), value: val(it), step: inp.step, min: inp.range.lo, max: inp.range.hi, tint: score.tint, compact: true }) + '</div>';
        } else if (inp.type === 'choice') {
          const cur = Math.trunc(val(it));
          html += '<div style="display:flex;flex-direction:column;gap:8px"><div><b style="font-family:var(--font);font-size:13.5px">' + esc(T('sepsis.' + k + '.item.' + it.key)) + '</b><div class="sec-sub">' + esc(T('sepsis.' + k + '.hint.' + it.key)) + '</div></div>' +
            '<div class="opt-list">' + inp.options.map((o, i) => '<button type="button" class="opt' + (cur === i ? ' on' : '') + '" style="' + tintStyle(score.tint) + '" data-act="pick" data-item="' + it.key + '" data-value="' + i + '"><span class="radio"></span><span class="ot">' +
              esc(T('sepsis.' + k + '.option.' + o.key)) + '</span>' + (score.showsPoints ? '<span class="pts">+' + o.points + '</span>' : '') + '</button>').join('') + '</div></div>';
        } else {
          const on = val(it) > 0;
          html += '<button type="button" class="check-row' + (on ? ' on' : '') + '" style="' + tintStyle(score.tint) + '" data-act="pick" data-item="' + it.key + '" data-value="' + (on ? 0 : 1) + '"><span class="box">' + (on ? icon('check') : '') + '</span><span class="ct"><b>' +
            esc(T('sepsis.' + k + '.item.' + it.key)) + '</b><span>' + esc(T('sepsis.' + k + '.hint.' + it.key)) + '</span></span>' + (score.showsPoints ? '<span class="pts">' + (inp.doubles ? '×2' : '+' + inp.points) + '</span>' : '') + '</button>';
        }
      }
      return card(html);
    };
    const result = () => {
      const out = output(), band = bandOf(out);
      let html = sectionHeader({ title: T('result.title'), subtitle: score.showsPoints ? T('airway.resultScore') : resultLabel(), icon: 'sigma', tint: score.tint,
        accessory: band ? badge(T('sepsis.' + k + '.band.' + band.key + '.title'), band.tint) : '' });
      html += UI.bigResult({ label: resultLabel(), value: resultValue(out), unit: resultUnit(), caption: band ? T('sepsis.' + k + '.band.' + band.key + '.detail') : '', tint: band ? band.tint : score.tint });
      if (band) html += '<div class="verdict" style="' + tintStyle(band.tint) + '"><b>' + esc(T('sepsis.' + k + '.band.' + band.key + '.title')) + '</b><p>' + UI.rich(T('sepsis.' + k + '.band.' + band.key + '.detail')) + '</p></div>';
      if (score.showsPoints) {
        html += '<div class="panel faint" style="gap:2px">' + score.items.map(it => '<div class="inforow" style="padding:3px 0"><span class="l" style="font-size:12px">' + esc(T('sepsis.' + k + '.item.' + it.key)) + '</span><span class="v" style="font-size:13px;' + ((out.itemPoints[it.key] || 0) > 0 ? '--vt:' + UI.tintVar(score.tint) : '--vt:var(--textTertiary)') + '">+' + (out.itemPoints[it.key] || 0) + '</span></div>').join('') + '</div>';
      }
      return card(html);
    };
    const regions = { result, warnings: () => UI.warningsCard(output().warnings) };
    score.items.forEach(it => { if (it.input.type === 'numeric' && score.showsPoints) regions['pts-' + it.key] = () => esc(pointsText(it)); });
    const shareText = () => {
      const out = output(), band = bandOf(out);
      const lines = [name];
      if (score.showsPoints) score.items.forEach(it => lines.push(T('sepsis.' + k + '.item.' + it.key) + ': +' + (out.itemPoints[it.key] || 0)));
      lines.push(resultLabel() + ': ' + resultValue(out) + (resultUnit() ? ' ' + resultUnit() : ''));
      if (band) lines.push(T('sepsis.' + k + '.band.' + band.key + '.title'));
      return shareLines(lines);
    };
    const notes = Array.from({ length: score.noteCount }, (_, i) => T('sepsis.' + k + '.note' + (i + 1)));
    return {
      tint: score.tint, title: name,
      topRight: () => resetBtn(score.tint) + infoBtn(id, score.tint),
      body: () => scoreHeader({ name, subtitle: T('sepsis.' + k + '.subtitle'), ic: score.icon, tint: score.tint, summary: T('sepsis.' + k + '.summary'),
          extra: score.threshold != null && score.showsPoints ? '<div>' + badge(T('airway.thresholdBadge', { threshold: score.threshold, max: score.maxPoints }), score.tint) + '</div>' : '' }) +
        params() + region('result', result()) + notesCard(T('airway.notesTitle'), notes, score.tint) + region('warnings', regions.warnings()) + shareButton() + UI.footnote(T('sepsis.' + k + '.reference'), 'book-open'),
      regions,
      get(p) { return values[p]; },
      set(p, v) { values[p] = v == null ? 0 : v; persist(); },
      act: {
        pick(el) { values[el.getAttribute('data-item')] = Number(el.getAttribute('data-value')); persist(); AA.App.render(); },
        reset() { Object.assign(values, defaults()); persist(); AA.App.render(); },
        share() { UI.share(shareText()); }
      }
    };
  }

  // ================================================================ 8) Sıvı ve elektrolit araçları
  function electrolyteScreen(id) {
    const tool = AA.ELECTRO[id];
    const E = AA.ElectrolyteEngine;
    const key = 'electro.state.' + id + '.v1';
    const defaults = () => Object.fromEntries(tool.fields.map(f => [f.key, E.defaultValue(f)]));
    const stored = AA.State.load(key, null);
    const values = Object.assign(defaults(), stored || {});
    // Hasta kartında kilo varsa ve kullanıcı henüz değiştirmediyse onu kullan.
    if (!stored && tool.fields.some(f => f.key === 'weight') && PatientStore.patient.weightKg > 0) values.weight = PatientStore.patient.weightKg;
    const persist = () => AA.State.save(key, values);
    const k = tool.key;
    const name = T('electro.' + k + '.name');
    const output = () => E.calculate(tool, values);
    const inputs = () => {
      let html = sectionHeader({ title: T('electro.inputs'), subtitle: T('electro.inputsSubtitle'), icon: 'pencil', tint: tool.tint });
      for (const f of tool.fields) {
        const inp = f.input;
        if (inp.type === 'numeric') {
          html += '<div style="display:flex;flex-direction:column;gap:6px"><b style="font-family:var(--font);font-size:13.5px">' + esc(T('electro.' + k + '.field.' + f.key)) + '</b>' +
            UI.numericField({ bind: f.key, title: T('electro.' + k + '.hint.' + f.key), unit: unitLabel(inp.unit), value: values[f.key], step: inp.step, min: inp.range.lo, max: inp.range.hi, tint: tool.tint, compact: true }) + '</div>';
        } else if (inp.type === 'choice') {
          const cur = Math.trunc(values[f.key] || 0);
          html += '<div style="display:flex;flex-direction:column;gap:8px"><div><b style="font-family:var(--font);font-size:13.5px">' + esc(T('electro.' + k + '.field.' + f.key)) + '</b><div class="sec-sub">' + esc(T('electro.' + k + '.hint.' + f.key)) + '</div></div>' +
            '<div class="opt-list">' + inp.options.map((o, i) => '<button type="button" class="opt' + (cur === i ? ' on' : '') + '" style="' + tintStyle(tool.tint) + '" data-act="pick" data-item="' + f.key + '" data-value="' + i + '"><span class="radio"></span><span class="ot">' + esc(T('electro.' + k + '.option.' + o.key)) + '</span></button>').join('') + '</div></div>';
        } else {
          const on = (values[f.key] || 0) > 0;
          html += '<button type="button" class="check-row' + (on ? ' on' : '') + '" style="' + tintStyle(tool.tint) + '" data-act="pick" data-item="' + f.key + '" data-value="' + (on ? 0 : 1) + '"><span class="box">' + (on ? icon('check') : '') + '</span><span class="ct"><b>' +
            esc(T('electro.' + k + '.field.' + f.key)) + '</b><span>' + esc(T('electro.' + k + '.hint.' + f.key)) + '</span></span></button>';
        }
      }
      return card(html);
    };
    const results = () => {
      const out = output();
      return card(sectionHeader({ title: T('result.title'), subtitle: T('electro.' + k + '.result.' + out.primaryKey), icon: 'sigma', tint: tool.tint }) +
        UI.bigResult({ label: T('electro.' + k + '.result.' + out.primaryKey), value: out.primaryValue, unit: out.primaryUnit, caption: out.verdictKey ? T('electro.' + k + '.verdict.' + out.verdictKey) : '', tint: out.verdictTint }) +
        '<div>' + out.rows.map(r => UI.infoRow(T('electro.' + k + '.result.' + r.key), r.unit ? r.value + ' ' + r.unit : r.value)).join('') + '</div>') + UI.warningsCard(out.warnings);
    };
    const shareText = () => {
      const out = output();
      const lines = [name, T('electro.' + k + '.result.' + out.primaryKey) + ': ' + out.primaryValue + ' ' + out.primaryUnit];
      out.rows.forEach(r => lines.push(T('electro.' + k + '.result.' + r.key) + ': ' + r.value + ' ' + (r.unit || '')));
      if (out.verdictKey) lines.push(T('electro.' + k + '.verdict.' + out.verdictKey));
      return shareLines(lines);
    };
    const notes = Array.from({ length: tool.noteCount }, (_, i) => T('electro.' + k + '.note' + (i + 1)));
    return {
      tint: tool.tint, title: name,
      topRight: () => resetBtn(tool.tint) + infoBtn(id, tool.tint),
      body: () => scoreHeader({ name, subtitle: T('electro.' + k + '.subtitle'), ic: tool.icon, tint: tool.tint, summary: T('electro.' + k + '.summary') }) +
        inputs() + '<div data-region="out" style="display:flex;flex-direction:column;gap:22px">' + results() + '</div>' + notesCard(T('airway.notesTitle'), notes, tool.tint) + shareButton() + UI.footnote(T('electro.' + k + '.reference'), 'book-open'),
      regions: { out: results },
      get(p) { return values[p]; },
      set(p, v) { values[p] = v == null ? 0 : v; persist(); },
      act: {
        pick(el) { values[el.getAttribute('data-item')] = Number(el.getAttribute('data-value')); persist(); AA.App.render(); },
        reset() { Object.assign(values, defaults()); persist(); AA.App.render(); },
        share() { UI.share(shareText()); }
      }
    };
  }

  // ================================================================ 9) Kristalloid içerik tablosu
  function crystalloidScreen() {
    const tint = 'info';
    return {
      tint, title: T('electro.crystalloids.name'),
      topRight: () => infoBtn('crystalloidTable', tint),
      body: () => scoreHeader({ name: T('electro.crystalloids.name'), subtitle: T('electro.crystalloids.subtitle'), ic: 'flask-conical', tint, summary: T('electro.crystalloids.summary') }) +
        card(sectionHeader({ title: T('electro.crystalloids.tableTitle'), subtitle: T('electro.crystalloids.tableSubtitle'), icon: 'table', tint }) +
          '<div class="tbl-wrap"><table class="tbl" style="min-width:560px"><thead><tr><th>' + esc(T('electro.crystalloids.col.name')) + '</th><th>Na⁺</th><th>Cl⁻</th><th>K⁺</th><th style="text-align:left">' + esc(T('electro.crystalloids.col.buffer')) + '</th><th>' + esc(T('electro.crystalloids.col.osm')) + '</th></tr></thead><tbody>' +
          AA.CRYSTALLOIDS.map(c => '<tr><td style="color:var(--text);font-weight:700">' + esc(T('electro.crystalloids.' + c.key + '.name')) + '</td><td>' + c.sodium + '</td><td>' + c.chloride + '</td><td>' + esc(Fmt.decimal(c.potassium, 0)) + '</td><td style="text-align:left;font-size:12px">' +
            esc(T('electro.crystalloids.buffer.' + c.bufferKey)) + '</td><td class="strong">' + c.osmolarity + '</td></tr>').join('') + '</tbody></table></div><div class="sec-sub">' + esc(T('electro.crystalloids.units')) + '</div>') +
        notesCard(T('airway.notesTitle'), [1, 2, 3, 4, 5].map(n => T('electro.crystalloids.note' + n)), tint) + UI.footnote(T('electro.crystalloids.reference'), 'book-open')
    };
  }

  // ================================================================ 10) Arter kan gazı
  function bloodGasScreen() {
    const key = 'bloodgas.state.v1';
    const E = AA.BloodGasEngine;
    const values = Object.assign(E.defaults(), AA.State.load(key, {}));
    const ui = { advanced: false };
    const persist = () => AA.State.save(key, values);
    const tint = 'tertiary';
    const output = () => E.analyze(values);
    const fieldRow = f => {
      const inp = f.input;
      if (inp.type === 'numeric') {
        return '<div style="display:flex;flex-direction:column;gap:6px"><b style="font-family:var(--font);font-size:13.5px">' + esc(T('bg.field.' + f.key)) + '</b>' +
          UI.numericField({ bind: f.key, title: T('bg.hint.' + f.key), unit: inp.unit || '', value: values[f.key], step: inp.step, min: inp.range.lo, max: inp.range.hi, tint, compact: true }) + '</div>';
      }
      const cur = Math.trunc(values[f.key] || 0);
      return '<div style="display:flex;flex-direction:column;gap:8px"><div><b style="font-family:var(--font);font-size:13.5px">' + esc(T('bg.field.' + f.key)) + '</b><div class="sec-sub">' + esc(T('bg.hint.' + f.key)) + '</div></div>' +
        '<div class="opt-list">' + inp.options.map((o, i) => '<button type="button" class="opt' + (cur === i ? ' on' : '') + '" style="' + tintStyle(tint) + '" data-act="pick" data-item="' + f.key + '" data-value="' + i + '"><span class="radio"></span><span class="ot">' + esc(T('bg.option.' + o.key)) + '</span></button>').join('') + '</div></div>';
    };
    const inputs = () => {
      const basic = AA.BLOODGAS_FIELDS.filter(f => !AA.BLOODGAS_ADVANCED.has(f.key));
      const adv = AA.BLOODGAS_FIELDS.filter(f => AA.BLOODGAS_ADVANCED.has(f.key));
      return card(sectionHeader({ title: T('electro.inputs'), subtitle: T('bg.inputsSubtitle'), icon: 'pencil', tint }) + basic.map(fieldRow).join('') +
        '<button type="button" class="link-row" style="' + tintStyle(tint) + '" data-act="advanced"><span class="grow">' + esc(T('bg.advancedInputs')) + '</span><span style="display:inline-flex;transform:rotate(' + (ui.advanced ? 180 : 0) + 'deg)">' + icon('chevron-down') + '</span></button>' +
        (ui.advanced ? adv.map(fieldRow).join('') : ''));
    };
    const results = () => {
      const out = output();
      const steps = card(sectionHeader({ title: T('bg.stepsTitle'), subtitle: T('bg.stepsSubtitle'), icon: 'list-ordered', tint }) +
        '<div class="steps-list">' + out.steps.map(st => '<div class="gstep" style="' + tintStyle(st.tint) + '"><span class="n">' + st.index + '</span><div class="gt"><small>' + esc(T('bg.step' + st.index + '.title')) + '</small><b>' + esc(st.summary) + '</b><span>' + esc(st.detail) + '</span></div></div>').join('') + '</div>' +
        '<div>' + out.rows.map(r => UI.infoRow(T('bg.result.' + r.key), r.unit ? r.value + ' ' + r.unit : r.value)).join('') + '</div>');
      const etiology = out.etiologies.length ? card(sectionHeader({ title: T('bg.etiologyTitle'), subtitle: T('bg.etiologySubtitle'), icon: 'search', tint: 'warning' }) + UI.bullets(out.etiologies, 'warning', true)) : '';
      const advanced = card(sectionHeader({ title: T('bg.advancedTitle'), subtitle: T('bg.advancedSubtitle'), icon: 'sigma', tint: 'info' }) +
        '<div>' + out.advancedRows.map(r => UI.infoRow(T('bg.result.' + r.key), r.unit ? r.value + ' ' + r.unit : r.value, { caption: T('bg.caption.' + r.key) })).join('') + '</div>');
      return steps + etiology + advanced;
    };
    const shareText = () => {
      const out = output();
      const lines = [T('bg.name')];
      out.steps.forEach(st => lines.push(st.index + '. ' + st.summary + ' — ' + st.detail));
      out.rows.forEach(r => lines.push(T('bg.result.' + r.key) + ': ' + r.value + ' ' + (r.unit || '')));
      return shareLines(lines);
    };
    return {
      tint, title: T('bg.name'),
      topRight: () => resetBtn(tint) + infoBtn('bloodGasAnalysis', tint),
      body: () => scoreHeader({ name: T('bg.name'), subtitle: T('bg.subtitle'), ic: 'lungs', tint, summary: T('bg.summary'),
          extra: '<div class="badges">' + badge(T('bg.normalPh'), tint) + badge(T('bg.normalPaco2'), tint) + badge(T('bg.normalHco3'), tint) + '</div>' }) +
        inputs() + '<div data-region="out" style="display:flex;flex-direction:column;gap:22px">' + results() + '</div>' +
        card(sectionHeader({ title: T('bg.checklistTitle'), icon: 'list-checks', tint }) + '<div style="display:flex;flex-direction:column;gap:8px">' + [1, 2, 3, 4, 5].map(n => '<div style="display:flex;gap:8px;font-size:12.5px;color:var(--textSecondary)"><span style="color:var(--textTertiary)">' + icon('clipboard-check') + '</span><span>' + esc(T('bg.check' + n)) + '</span></div>').join('') + '</div>') +
        region('warnings', UI.warningsCard(output().warnings)) + shareButton() + UI.footnote(T('bg.reference'), 'book-open'),
      regions: { out: results, warnings: () => UI.warningsCard(output().warnings) },
      get(p) { return values[p]; },
      set(p, v) { values[p] = v == null ? 0 : v; persist(); },
      act: {
        pick(el) { values[el.getAttribute('data-item')] = Number(el.getAttribute('data-value')); persist(); AA.App.render(); },
        advanced() { ui.advanced = !ui.advanced; AA.App.render(); },
        reset() { Object.assign(values, E.defaults()); persist(); AA.App.render(); },
        share() { UI.share(shareText()); }
      }
    };
  }

  // ================================================================ Bilgi paneli içerikleri (iOS ScoreInfo)
  AA.infoFor = function (calcId) {
    if (AA.AIRWAY[calcId]) {
      const s = AA.AIRWAY[calcId], k = s.key;
      return { title: T('airway.' + k + '.name'), subtitle: T('airway.' + k + '.subtitle'), icon: s.icon, tint: s.tint, about: T('airway.' + k + '.about'),
        bands: s.bands.map(b => ({ range: rangeText(b.range, s.maxPoints), title: T('airway.' + k + '.band.' + b.key + '.title'), detail: T('airway.' + k + '.band.' + b.key + '.detail'), tint: b.tint })),
        notes: Array.from({ length: s.noteCount }, (_, i) => T('airway.' + k + '.note' + (i + 1))), reference: T('airway.' + k + '.reference') };
    }
    if (AA.SCORES[calcId]) {
      const s = AA.SCORES[calcId], k = s.key;
      return { title: T('sepsis.' + k + '.name'), subtitle: T('sepsis.' + k + '.subtitle'), icon: s.icon, tint: s.tint, about: T('sepsis.' + k + '.about'),
        bands: s.bands.map(b => ({ range: rangeText(b.range, s.maxPoints), title: T('sepsis.' + k + '.band.' + b.key + '.title'), detail: T('sepsis.' + k + '.band.' + b.key + '.detail'), tint: b.tint })),
        notes: Array.from({ length: s.noteCount }, (_, i) => T('sepsis.' + k + '.note' + (i + 1))), reference: T('sepsis.' + k + '.reference') };
    }
    if (AA.ELECTRO[calcId]) {
      const t = AA.ELECTRO[calcId], k = t.key;
      return { title: T('electro.' + k + '.name'), subtitle: T('electro.' + k + '.subtitle'), icon: t.icon, tint: t.tint, about: T('electro.' + k + '.about'), bands: [],
        notes: Array.from({ length: t.noteCount }, (_, i) => T('electro.' + k + '.note' + (i + 1))), reference: T('electro.' + k + '.reference') };
    }
    if (calcId === 'crystalloidTable') {
      return { title: T('electro.crystalloids.name'), subtitle: T('electro.crystalloids.subtitle'), icon: 'flask-conical', tint: 'info', about: T('electro.crystalloids.about'), bands: [],
        notes: [1, 2, 3, 4, 5].map(n => T('electro.crystalloids.note' + n)), reference: T('electro.crystalloids.reference') };
    }
    if (calcId === 'bloodGasAnalysis') {
      return { title: T('bg.name'), subtitle: T('bg.subtitle'), icon: 'lungs', tint: 'tertiary', about: T('bg.about'), bands: [],
        notes: [1, 2, 3, 4, 5, 6].map(n => T('bg.note' + n)), reference: T('bg.reference'), examplesTitle: T('bg.examplesTitle'),
        examples: [1, 2, 3].map(n => ({ range: T('bg.case' + n + '.label'), title: T('bg.case' + n + '.title'), detail: T('bg.case' + n + '.detail'), tint: 'tertiary' })) };
    }
    return null;
  };

  // ================================================================ Yönlendirme
  AA.CalcScreens = {
    make(id) {
      if (AA.DRUGS[id]) return infusionScreen(id);
      if (AA.VASO[id]) return vasoactiveScreen(id);
      if (AA.AIRWAY[id]) return airwayScoreScreen(id);
      if (AA.SCORES[id]) return parameterScoreScreen(id);
      if (AA.ELECTRO[id]) return electrolyteScreen(id);
      switch (id) {
        case 'maintenanceFluid': return fluidScreen();
        case 'allowableBloodLoss': return bloodLossScreen();
        case 'airwayMeasurements': return airwayMeasurementsScreen();
        case 'crystalloidTable': return crystalloidScreen();
        case 'bloodGasAnalysis': return bloodGasScreen();
        default: return null;
      }
    }
  };
})();
