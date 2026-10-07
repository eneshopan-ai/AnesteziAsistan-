/* Anestezi Asistanı — nöromüsküler blok geri döndürme: sugammadeks doz hesaplayıcısı.
 * Dozlar EMA SmPC (Bridion) ve FDA etiketindeki (11/2022) onaylı değerlerdir; her iki belgede de aynıdır.
 * Metinler i18n/*.json (nmb.*) içindedir; sayısal değerler ve kaynak kayıtları (refs.js) burada/orada tanımlıdır. */
(function () {
  'use strict';
  const AA = window.AA;
  const { T, Fmt, UI, PatientStore } = AA;
  const { esc, icon, card, sectionHeader, metric, tintStyle } = UI;

  // Etiket dozları (mg/kg) ve çözelti derişimi (100 mg/mL; 200 mg/2 mL ve 500 mg/5 mL flakon).
  const SUGAMMADEX = {
    concentrationMgPerMl: 100,
    depths: [
      { id: 'moderate', mgPerKg: 2 },   // spontan düzelme T2'nin yeniden görünmesine ulaştı
      { id: 'deep', mgPerKg: 4 },       // post-tetanik sayım 1–2
      { id: 'immediate', mgPerKg: 16 }  // yalnızca rokuronyum; ≈3 dk önce 1,2 mg/kg rokuronyum
    ]
  };
  const depthOf = id => SUGAMMADEX.depths.find(d => d.id === id) || SUGAMMADEX.depths[0];

  const shareLines = lines => lines.concat('— ' + T('app.name') + ' · ' + T('share.disclaimer')).join('\n');
  const weight = () => { const w = PatientStore.patient.weightKg; return w > 0 ? w : null; };
  const W = (severity, title, message) => ({ severity, title, message });

  function sugammadexScreen() {
    const key = 'nmb.sugammadex.state.v1';
    const s = Object.assign({ depth: 'moderate' }, AA.State.load(key, {}));
    if (!SUGAMMADEX.depths.some(d => d.id === s.depth)) s.depth = 'moderate';
    const persist = () => AA.State.save(key, s);
    const tint = 'tertiary';

    const output = () => {
      const w = weight();
      if (!w) return null;
      const d = depthOf(s.depth);
      const doseMg = d.mgPerKg * w;
      return { weight: w, perKg: d.mgPerKg, doseMg, volumeMl: doseMg / SUGAMMADEX.concentrationMgPerMl, depth: d.id };
    };
    const warnings = out => {
      const r = [];
      const age = PatientStore.patient.ageYears;
      if (age != null && age < 18) r.push(W(1, T('nmb.warn.paediatric.title'), T('nmb.warn.paediatric.message')));
      if (out.depth === 'immediate') r.push(W(1, T('nmb.warn.immediate.title'), T('nmb.warn.immediate.message')));
      r.push(W(1, T('nmb.warn.bradycardia.title'), T('nmb.warn.bradycardia.message')));
      r.push(W(1, T('nmb.warn.hypersensitivity.title'), T('nmb.warn.hypersensitivity.message')));
      r.push(W(0, T('nmb.warn.renal.title'), T('nmb.warn.renal.message')));
      r.push(W(0, T('nmb.warn.contraceptive.title'), T('nmb.warn.contraceptive.message')));
      r.push(W(0, T('nmb.warn.readmin.title'), T('nmb.warn.readmin.message')));
      r.push(W(0, T('nmb.warn.recurrence.title'), T('nmb.warn.recurrence.message')));
      r.push(W(0, T('nmb.warn.weight.title'), T('nmb.warn.weight.message')));
      return AA.bySeverity(r);
    };

    const depthSection = () => card(sectionHeader({ title: T('nmb.depth.title'), subtitle: T('nmb.depth.subtitle'), icon: 'activity', tint }) +
      '<div class="opt-list">' + SUGAMMADEX.depths.map(d => '<button type="button" class="opt' + (s.depth === d.id ? ' on' : '') + '" style="' + tintStyle(tint) +
        '" data-act="depth" data-value="' + d.id + '"><span class="radio"></span><span class="ot"><b style="font-family:var(--font)">' + esc(T('nmb.depth.' + d.id + '.title')) +
        '</b><br><span style="font-size:11.5px;color:var(--textTertiary)">' + esc(T('nmb.depth.' + d.id + '.detail')) + '</span></span><span class="pts">' +
        esc(Fmt.smart(d.mgPerKg)) + ' mg/kg</span></button>').join('') + '</div>');

    const results = () => {
      const out = output();
      if (!out) return UI.emptyState({ icon: 'user', title: T('calc.missingPatientTitle'), message: T('emg.needWeight'), tint });
      const mg = Fmt.smart(Math.round(out.doseMg * 10) / 10), ml = Fmt.decimal(out.volumeMl, 2);
      const result = card(sectionHeader({ title: T('result.title'), subtitle: T('nmb.result.subtitle'), icon: 'syringe', tint }) +
        UI.bigResult({ label: T('nmb.dose'), value: mg, unit: 'mg', caption: T('nmb.result.caption', { perKg: Fmt.smart(out.perKg), kg: Fmt.smart(out.weight) }), tint }) +
        '<div class="metrics">' + metric({ title: T('nmb.volume'), value: ml, unit: 'mL', icon: 'flask-conical', tint: 'info' }) +
        metric({ title: T('nmb.perKg'), value: Fmt.smart(out.perKg), unit: 'mg/kg', icon: 'weight', tint: 'secondary' }) + '</div>' +
        '<div class="sec-sub">' + esc(T('nmb.concentration')) + '</div>' +
        UI.formula(T('nmb.formula'), T('nmb.formulaFilled', { perKg: Fmt.smart(out.perKg), kg: Fmt.smart(out.weight), mg, ml }), tint));
      return result + UI.warningsCard(warnings(out)) +
        '<button type="button" class="btn" style="' + tintStyle(tint) + '" data-act="share">' + icon('share') + '<span>' + esc(T('common.share')) + '</span></button>';
    };
    const shareText = out => shareLines([T('catalog.sugammadexReversal.title'),
      T('share.patient') + ': ' + Fmt.smart(out.weight) + ' kg',
      T('nmb.depth.' + out.depth + '.title') + ' (' + T('nmb.depth.' + out.depth + '.detail') + ')',
      T('nmb.dose') + ': ' + Fmt.smart(Math.round(out.doseMg * 10) / 10) + ' mg (' + Fmt.smart(out.perKg) + ' mg/kg)',
      T('nmb.volume') + ': ' + Fmt.decimal(out.volumeMl, 2) + ' mL (' + T('nmb.concentration') + ')']);

    return {
      tint, title: T('catalog.sugammadexReversal.title'),
      topRight: () => '<button type="button" class="circle-btn tinted" style="' + tintStyle(tint) + '" data-act="nav" data-to="info-sugammadexReversal" aria-label="' + esc(T('info.title')) + '">' + icon('info') + '</button>',
      body: () => AA.patientCard({ derived: false }) + depthSection() + '<div data-region="out" style="display:flex;flex-direction:column;gap:22px">' + results() + '</div>' +
        (AA.refsCard ? AA.refsCard('sugammadexReversal', tint) : '') + UI.footnote(T('nmb.footer'), 'book-open'),
      regions: { out: results },
      get() { return null; }, set() {},
      act: {
        depth(el) { s.depth = el.getAttribute('data-value'); persist(); AA.App.render(); },
        share() { const out = output(); if (out) UI.share(shareText(out)); }
      }
    };
  }

  // ================================================================ Bilgi paneli
  const INFO = { sugammadexReversal: { icon: 'syringe', tint: 'tertiary', notes: 3 } };
  const infoFor = calcId => {
    const m = INFO[calcId];
    return { title: T('catalog.' + calcId + '.title'), subtitle: T('catalog.' + calcId + '.subtitle'), icon: m.icon, tint: m.tint, about: T('nmb.' + calcId + '.about'), bands: [],
      notes: Array.from({ length: m.notes }, (_, i) => T('nmb.' + calcId + '.note' + (i + 1))), reference: T('emg.refs.intro'), refsHTML: AA.refsHTML ? AA.refsHTML(calcId) : '' };
  };

  // ================================================================ Yönlendirme
  const MAKERS = { sugammadexReversal: sugammadexScreen };
  const baseMake = AA.CalcScreens.make;
  AA.CalcScreens.make = id => MAKERS[id] ? MAKERS[id]() : baseMake(id);
  const baseInfo = AA.infoFor;
  AA.infoFor = calcId => INFO[calcId] ? infoFor(calcId) : baseInfo(calcId);
})();
