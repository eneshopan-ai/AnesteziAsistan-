/* Anestezi Asistanı — veri kütüphaneleri.
 * iOS sürümündeki DrugBlueprints, VasoactiveLibrary, AirwayScoreLibrary, SepsisScoreLibrary,
 * IntensiveCareScoreLibrary, ElectrolyteLibrary, CrystalloidLibrary, BloodGasInputs ve
 * katalogların birebir karşılığıdır. Sayısal değerler değiştirilmeden aktarılmıştır;
 * tüm metinler dil dosyalarından (i18n/*.json) gelir. */
(function () {
  'use strict';
  const AA = window.AA;
  const Fmt = AA.Fmt;

  // Aralık yardımcıları
  const R = (lo, hi) => ({ lo, hi });
  const inRange = (r, v) => v >= r.lo && v <= r.hi;
  AA.inRange = inRange;

  // ================================================================ İnfüzyon ilaçları (anestezi)
  // doseUnit: 'mgPerKgPerHour' | 'mcgPerKgPerMinute' ; concentrationUnit: 'mgPerMl' | 'mcgPerMl'
  const DRUGS = {
    pentothalInfusion: {
      id: 'pentothalInfusion', icon: 'droplet', tint: 'accent',
      doseUnit: 'mgPerKgPerHour', concentrationUnit: 'mgPerMl',
      stateVersion: 4,
      indications: [
        { id: 'anesthesiaMaintenance', icon: 'activity', doseRange: R(3, 5), typicalDose: 4, titrationStep: 0.5, loadingRange: R(3, 5), typicalLoading: 4 },
        { id: 'statusEpilepticus', icon: 'heart-pulse', doseRange: R(1, 5), typicalDose: 3, titrationStep: 0.5, loadingRange: R(3, 5), typicalLoading: 4 },
        { id: 'sedation', icon: 'moon-star', doseRange: R(0.5, 3), typicalDose: 1.5, titrationStep: 0.25, loadingRange: R(1, 3), typicalLoading: 2 },
        { id: 'barbiturateComa', icon: 'brain', doseRange: R(1, 5), typicalDose: 3, titrationStep: 0.5, loadingRange: R(5, 10), typicalLoading: 5 }
      ],
      presets: [[1000, 50], [500, 25], [500, 20], [1000, 100], [1000, 250], [1000, 500]],
      defaultPreparation: { mode: 'direct', directConcentration: 20, totalDrugMg: 1000, totalVolumeMl: 50 },
      limits: { minimumUseful: 1, peripheralMaximum: 25, absoluteMaximum: 50 },
      standingSeverities: [0, 0],
      rules: [
        { key: 'cumulative24h', severity: 1, evaluate: e => e.mgPer24Hours > 6000
          ? { mg: Fmt.smart(e.mgPer24Hours), g: Fmt.smart(e.mgPer24Hours / 1000) } : null }
      ]
    },
    propofolInfusion: {
      id: 'propofolInfusion', icon: 'droplets', tint: 'secondary',
      // İdame dozu mcg/kg/dk (50–200); konsantrasyon mg/mL kalır, yükleme dozu mg/kg kalır.
      doseUnit: 'mcgPerKgPerMinute', concentrationUnit: 'mgPerMl',
      loadingUnit: { bolusTitle: 'unit.mgPerKg', bolusMgFactor: 1 },
      stateVersion: 3,
      indications: [
        { id: 'anesthesiaMaintenance', icon: 'activity', doseRange: R(50, 200), typicalDose: 100, titrationStep: 10, sliderRange: R(30, 300), loadingRange: R(1, 2.5), typicalLoading: 2 }
      ],
      presets: [[500, 50], [200, 20], [1000, 100], [1000, 50]],
      defaultPreparation: { mode: 'direct', directConcentration: 10, totalDrugMg: 500, totalVolumeMl: 50 },
      limits: { minimumUseful: 2, peripheralMaximum: null, absoluteMaximum: 20 },
      standingSeverities: [0, 0, 0],
      rules: [
        { key: 'pris', severity: 1, evaluate: e => e.dose * 0.06 > 4 ? { dose: Fmt.smart(e.dose) } : null },
        { key: 'lipidLoad', severity: 0, evaluate: e => {
          const mlPerDay = e.rateMlPerHour * 24;
          if (!(mlPerDay > 0)) return null;
          return { ml: Fmt.smart(mlPerDay), percent: Fmt.decimal(e.concentrationMgPerMl / 10, 1),
                   fat: Fmt.smart(mlPerDay * 0.1), kcal: Fmt.smart(mlPerDay * 1.1) };
        } },
        { key: 'obesityDosingWeight', severity: 1, evaluate: e => (e.profile.isObese && e.basis === 'total')
          ? { adjusted: Fmt.decimal(e.profile.adjustedBodyWeight) } : null }
      ]
    },
    remifentanilInfusion: {
      id: 'remifentanilInfusion', icon: 'audio-waveform', tint: 'tertiary',
      doseUnit: 'mcgPerKgPerMinute', concentrationUnit: 'mcgPerMl',
      indications: [
        { id: 'anesthesiaAnalgesia', icon: 'activity', doseRange: R(0.1, 0.3), typicalDose: 0.2, titrationStep: 0.025, loadingRange: R(0.5, 1.0), typicalLoading: 0.5 }
      ],
      presets: [[2, 40], [1, 50], [2, 100], [5, 100], [5, 50]],
      defaultPreparation: { mode: 'direct', directConcentration: 50, totalDrugMg: 2, totalVolumeMl: 40 },
      limits: { minimumUseful: 0.01, peripheralMaximum: null, absoluteMaximum: 0.25 },
      standingSeverities: [1, 0, 0],
      rules: [
        { key: 'obesityLeanWeight', severity: 2, evaluate: e => (e.profile.isObese && e.basis === 'total')
          ? { lean: Fmt.decimal(e.profile.leanBodyWeight), ideal: Fmt.decimal(e.profile.idealBodyWeight),
              total: Fmt.decimal(e.profile.totalBodyWeight) } : null },
        { key: 'slowBolus', severity: 1, evaluate: e => e.includesLoadingDose ? { bolus: Fmt.smart(e.loadingDose) } : null },
        { key: 'highDose', severity: 0, evaluate: e => e.dose >= 0.3 ? {} : null }
      ]
    },
    ketamineInfusion: {
      id: 'ketamineInfusion', icon: 'brain', tint: 'warning',
      doseUnit: 'mgPerKgPerHour', concentrationUnit: 'mgPerMl',
      indications: [
        { id: 'anesthesiaMaintenance', icon: 'activity', doseRange: R(1, 3), typicalDose: 2, titrationStep: 0.25, loadingRange: R(1, 2), typicalLoading: 1.5 }
      ],
      presets: [[500, 100], [250, 50], [500, 50], [200, 100], [500, 10]],
      defaultPreparation: { mode: 'direct', directConcentration: 5, totalDrugMg: 500, totalVolumeMl: 100 },
      limits: { minimumUseful: 1, peripheralMaximum: null, absoluteMaximum: 50 },
      standingSeverities: [0, 0, 0],
      rules: [
        { key: 'highMaintenance', severity: 1, evaluate: e => e.dose > 2 ? { dose: Fmt.smart(e.dose) } : null },
        { key: 'undiluted', severity: 1, evaluate: e => e.concentrationMgPerMl >= 50 ? { rate: Fmt.smart(e.rateMlPerHour) } : null },
        { key: 'obesityDosingWeight', severity: 1, evaluate: e => (e.profile.isObese && e.basis === 'total')
          ? { lean: Fmt.decimal(e.profile.leanBodyWeight), adjusted: Fmt.decimal(e.profile.adjustedBodyWeight) } : null }
      ]
    }
  };

  const DOSE_UNITS = {
    mgPerKgPerHour: { title: 'unit.mgPerKgPerHour', mgPerHourFactor: 1, bolusTitle: 'unit.mgPerKg', bolusMgFactor: 1 },
    mcgPerKgPerMinute: { title: 'unit.mcgPerKgPerMinute', mgPerHourFactor: 60 / 1000, bolusTitle: 'unit.mcgPerKg', bolusMgFactor: 0.001 }
  };
  const CONC_UNITS = {
    mgPerMl: { title: 'unit.mgPerMl', amountTitle: 'unit.mg', displayFactor: 1 },
    mcgPerMl: { title: 'unit.mcgPerMl', amountTitle: 'unit.mcg', displayFactor: 1000 }
  };

  AA.DRUGS = DRUGS;
  AA.DOSE_UNITS = DOSE_UNITS;
  AA.CONC_UNITS = CONC_UNITS;

  // ================================================================ Vazoaktif infüzyonlar (yoğun bakım)
  // doseUnit: mcgPerKgPerMinute | mcgPerKgPerHour | mcgPerMinute | unitsPerMinute | unitsPerHour
  const VASO_UNITS = {
    mcgPerKgPerMinute: { weightBased: true, amount: 'microgram', perHour: 60 },
    mcgPerKgPerHour: { weightBased: true, amount: 'microgram', perHour: 1 },
    mcgPerMinute: { weightBased: false, amount: 'microgram', perHour: 60 },
    unitsPerMinute: { weightBased: false, amount: 'unit', perHour: 60 },
    unitsPerHour: { weightBased: false, amount: 'unit', perHour: 1 }
  };
  const AMOUNT_UNITS = {
    microgram: { entryTitle: 'unit.mg', baseTitle: 'unit.mcg', entryToBase: 1000, concTitle: 'unit.mcgPerMl' },
    unit: { entryTitle: 'unit.units', baseTitle: 'unit.units', entryToBase: 1, concTitle: 'unit.unitsPerMl' }
  };
  const band = (id, lo, hi, tint) => ({ id, range: R(lo, hi), tint });
  const VASO = {
    norepinephrineInfusion: {
      id: 'norepinephrineInfusion', key: 'norepinephrine', icon: 'heart-plus', tint: 'blue',
      doseUnit: 'mcgPerKgPerMinute', doseRange: R(0.01, 1.0), sliderRange: R(0, 3), doseStep: 0.01,
      typicalDose: 0.1, maximumDose: 3.0,
      bands: [band('low', 0, 0.05, 'success'), band('moderate', 0.05, 0.3, 'info'), band('high', 0.3, 1.0, 'warning'), band('veryHigh', 1.0, 5.0, 'danger')],
      presets: [[1, 4, 50], [2, 8, 50], [3, 4, 100], [4, 16, 100]], defaultPreset: 1, noteCount: 4, warningCount: 3
    },
    epinephrineInfusion: {
      id: 'epinephrineInfusion', key: 'epinephrine', icon: 'heart-pulse', tint: 'pink',
      doseUnit: 'mcgPerKgPerMinute', doseRange: R(0.01, 0.5), sliderRange: R(0, 2), doseStep: 0.01,
      typicalDose: 0.05, maximumDose: 1.0,
      bands: [band('beta', 0, 0.05, 'success'), band('mixed', 0.05, 0.2, 'info'), band('alpha', 0.2, 0.5, 'warning'), band('veryHigh', 0.5, 3.0, 'danger')],
      presets: [[1, 4, 50], [2, 5, 50], [3, 1, 50], [4, 1, 100]], defaultPreset: 1, noteCount: 4, warningCount: 3
    },
    dopamineInfusion: {
      id: 'dopamineInfusion', key: 'dopamine', icon: 'activity', tint: 'success',
      doseUnit: 'mcgPerKgPerMinute', doseRange: R(2, 20), sliderRange: R(0, 30), doseStep: 0.5,
      typicalDose: 5, maximumDose: 20,
      bands: [band('dopaminergic', 0, 3, 'textSecondary'), band('beta', 3, 10, 'success'), band('alpha', 10, 20, 'warning'), band('excessive', 20, 40, 'danger')],
      presets: [[1, 400, 100], [2, 200, 50], [3, 400, 250], [4, 800, 250]], defaultPreset: 1, noteCount: 4, warningCount: 3
    },
    vasopressinInfusion: {
      id: 'vasopressinInfusion', key: 'vasopressin', icon: 'droplet', tint: 'tertiary',
      doseUnit: 'unitsPerMinute', doseRange: R(0.01, 0.04), sliderRange: R(0, 0.1), doseStep: 0.005,
      typicalDose: 0.03, maximumDose: 0.04,
      bands: [band('standard', 0, 0.03, 'success'), band('upper', 0.03, 0.04, 'warning'), band('excessive', 0.04, 0.2, 'danger')],
      presets: [[1, 20, 100], [2, 20, 50], [3, 40, 100], [4, 50, 250]], defaultPreset: 1, noteCount: 4, warningCount: 3
    },
    isoprenalineInfusion: {
      id: 'isoprenalineInfusion', key: 'isoprenaline', icon: 'heart', tint: 'warning',
      doseUnit: 'mcgPerMinute', doseRange: R(0.5, 10), sliderRange: R(0, 20), doseStep: 0.5,
      typicalDose: 2, maximumDose: 20,
      bands: [band('start', 0, 2, 'success'), band('maintenance', 2, 10, 'info'), band('high', 10, 30, 'danger')],
      presets: [[1, 1, 50], [2, 1, 100], [3, 2, 500], [4, 2, 50]], defaultPreset: 1, noteCount: 4, warningCount: 3
    },
    dexmedetomidineInfusion: {
      id: 'dexmedetomidineInfusion', key: 'dexmedetomidine', icon: 'moon-star', tint: 'cyan',
      doseUnit: 'mcgPerKgPerHour', doseRange: R(0.2, 1.4), sliderRange: R(0, 2), doseStep: 0.1,
      typicalDose: 0.4, maximumDose: 1.5,
      bands: [band('light', 0, 0.4, 'success'), band('standard', 0.4, 0.7, 'info'), band('offLabel', 0.7, 1.4, 'warning'), band('excessive', 1.4, 3.0, 'danger')],
      presets: [[1, 0.2, 50], [2, 0.4, 100], [3, 0.2, 20], [4, 1, 250]], defaultPreset: 1, noteCount: 4, warningCount: 3
    },
    dobutamineInfusion: {
      id: 'dobutamineInfusion', key: 'dobutamine', icon: 'heart', tint: 'indigo',
      doseUnit: 'mcgPerKgPerMinute', doseRange: R(2, 20), sliderRange: R(0, 40), doseStep: 0.5,
      typicalDose: 5, maximumDose: 20,
      bands: [band('low', 0, 5, 'success'), band('standard', 5, 10, 'info'), band('high', 10, 20, 'warning'), band('excessive', 20, 40, 'danger')],
      presets: [[1, 250, 250], [2, 250, 500], [3, 500, 250], [4, 500, 500]], defaultPreset: 1, noteCount: 4, warningCount: 3
    }
  };
  for (const d of Object.values(VASO)) {
    d.presets = d.presets.map(([index, totalAmount, totalVolumeMl]) => ({ index, totalAmount, totalVolumeMl }));
    d.unit = VASO_UNITS[d.doseUnit];
    d.amount = AMOUNT_UNITS[d.unit.amount];
    /** Doz bandı: aralık içindeki ilk bant; en üst bandın üzerindeyse o bant. */
    d.bandFor = dose => d.bands.find(b => inRange(b.range, dose)) ||
      (dose > d.bands[d.bands.length - 1].range.hi ? d.bands[d.bands.length - 1] : null);
  }
  AA.VASO = VASO;

  // ================================================================ Zor havayolu skorları
  const opt = (key, points) => ({ key, points });
  const yesNo = (yesPoints = 1) => [opt('no', 0), opt('yes', yesPoints)];
  const sband = (key, lo, hi, tint) => ({ key, range: R(lo, hi), tint });

  const AIRWAY = {
    mallampatiScore: {
      id: 'mallampatiScore', key: 'mallampati', icon: 'mouth', tint: 'accent', kind: 'classification',
      items: [{ key: 'class', options: [opt('i', 1), opt('ii', 2), opt('iii', 3), opt('iv', 4)] }],
      bands: [sband('low', 1, 2, 'success'), sband('high', 3, 4, 'warning')],
      maxPoints: 4, threshold: 3, noteCount: 4
    },
    cormackLehaneScore: {
      id: 'cormackLehaneScore', key: 'cormack', icon: 'eye', tint: 'secondary', kind: 'classification',
      items: [{ key: 'grade', options: [opt('g1', 1), opt('g2a', 2), opt('g2b', 3), opt('g3', 4), opt('g4', 5)] }],
      bands: [sband('easy', 1, 2, 'success'), sband('restricted', 3, 3, 'warning'), sband('difficult', 4, 5, 'danger')],
      maxPoints: 5, threshold: 3, noteCount: 4
    },
    wilsonScore: {
      id: 'wilsonScore', key: 'wilson', icon: 'list-ordered', tint: 'info', kind: 'sum',
      items: [
        { key: 'weight', options: [opt('under90', 0), opt('90to110', 1), opt('over110', 2)] },
        { key: 'headNeck', options: [opt('angleOver90', 0), opt('angleAbout90', 1), opt('angleUnder90', 2)] },
        { key: 'jaw', options: [opt('good', 0), opt('limited', 1), opt('poor', 2)] },
        { key: 'mandible', options: [opt('normal', 0), opt('moderate', 1), opt('severe', 2)] },
        { key: 'teeth', options: [opt('normal', 0), opt('moderate', 1), opt('severe', 2)] }
      ],
      bands: [sband('low', 0, 1, 'success'), sband('high', 2, 10, 'warning')],
      maxPoints: 10, threshold: 2, noteCount: 4
    },
    elGanzouriScore: {
      id: 'elGanzouriScore', key: 'sari', icon: 'chart-bar', tint: 'tertiary', kind: 'sum',
      items: [
        { key: 'mouthOpening', options: [opt('over4', 0), opt('under4', 1)] },
        { key: 'thyromental', options: [opt('over65', 0), opt('60to65', 1), opt('under60', 2)] },
        { key: 'mallampati', options: [opt('i', 0), opt('ii', 1), opt('iiiOrIv', 2)] },
        { key: 'neck', options: [opt('over90', 0), opt('80to90', 1), opt('under80', 2)] },
        { key: 'prognathism', options: [opt('present', 0), opt('absent', 1)] },
        { key: 'weight', options: [opt('under90', 0), opt('90to110', 1), opt('over110', 2)] },
        { key: 'history', options: [opt('none', 0), opt('questionable', 1), opt('definite', 2)] }
      ],
      bands: [sband('low', 0, 3, 'success'), sband('high', 4, 12, 'danger')],
      maxPoints: 12, threshold: 4, noteCount: 4
    },
    lemonScore: {
      id: 'lemonScore', key: 'lemon', icon: 'list-checks', tint: 'warning', kind: 'sum', usesCheckboxes: true,
      items: ['look', 'interincisor', 'hyomental', 'thyrofloor', 'mallampati', 'obstruction', 'neck'].map(key => ({ key, options: yesNo(1) })),
      bands: [sband('low', 0, 0, 'success'), sband('moderate', 1, 2, 'warning'), sband('high', 3, 7, 'danger')],
      maxPoints: 7, threshold: 1, noteCount: 4
    },
    macochaScore: {
      id: 'macochaScore', key: 'macocha', icon: 'bed-double', tint: 'danger', kind: 'sum', usesCheckboxes: true,
      items: [
        { key: 'mallampati', options: yesNo(5) }, { key: 'osa', options: yesNo(2) },
        { key: 'cervical', options: yesNo(1) }, { key: 'mouthOpening', options: yesNo(1) },
        { key: 'coma', options: yesNo(1) }, { key: 'hypoxemia', options: yesNo(1) },
        { key: 'operator', options: yesNo(1) }
      ],
      bands: [sband('low', 0, 2, 'success'), sband('high', 3, 12, 'danger')],
      maxPoints: 12, threshold: 3, noteCount: 4
    }
  };
  AA.AIRWAY = AIRWAY;

  // ================================================================ Parametre tabanlı skorlar (sepsis ve yoğun bakım)
  const br = (lower, upper, points) => ({ lower, upper, points });
  const num = (unit, defaultValue, lo, hi, step, brackets) => ({ type: 'numeric', unit, defaultValue, range: R(lo, hi), step, brackets });
  const choice = (...options) => ({ type: 'choice', options });
  const toggle = points => ({ type: 'toggle', points });
  const item = (key, input) => ({ key, input });
  const N = null;

  const SCORES = {
    // SOFA (Vincent 1996 · Sepsis-3'ün temeli)
    sofaScore: {
      id: 'sofaScore', key: 'sofa', icon: 'activity-square', tint: 'danger',
      items: [
        item('respiration', choice(opt('pf400', 0), opt('pf400less', 1), opt('pf300', 2), opt('pf200', 3), opt('pf100', 4))),
        item('platelets', num('×10³/µL', 250, 0, 800, 10, [br(N, 20, 4), br(20, 50, 3), br(50, 100, 2), br(100, 150, 1), br(150, N, 0)])),
        item('bilirubin', num('mg/dL', 0.8, 0, 40, 0.1, [br(N, 1.2, 0), br(1.2, 2.0, 1), br(2.0, 6.0, 2), br(6.0, 12.0, 3), br(12.0, N, 4)])),
        item('cardiovascular', choice(opt('map70', 0), opt('mapUnder70', 1), opt('lowDose', 2), opt('midDose', 3), opt('highDose', 4))),
        item('gcs', num(N, 15, 3, 15, 1, [br(N, 6, 4), br(6, 10, 3), br(10, 13, 2), br(13, 15, 1), br(15, N, 0)])),
        item('creatinine', num('mg/dL', 0.9, 0, 15, 0.1, [br(N, 1.2, 0), br(1.2, 2.0, 1), br(2.0, 3.5, 2), br(3.5, 5.0, 3), br(5.0, N, 4)]))
      ],
      bands: [sband('b0', 0, 6, 'success'), sband('b7', 7, 9, 'info'), sband('b10', 10, 12, 'warning'), sband('b13', 13, 14, 'danger'), sband('b15', 15, 24, 'danger')],
      maxPoints: 24, threshold: 2, noteCount: 4
    },
    // qSOFA (Singer 2016)
    qsofaScore: {
      id: 'qsofaScore', key: 'qsofa', icon: 'zap', tint: 'warning',
      items: [item('respiratoryRate', toggle(1)), item('mentation', toggle(1)), item('systolic', toggle(1))],
      bands: [sband('low', 0, 1, 'success'), sband('high', 2, 3, 'danger')],
      maxPoints: 3, threshold: 2, noteCount: 4
    },
    // NEWS2 (Royal College of Physicians 2017)
    news2Score: {
      id: 'news2Score', key: 'news2', icon: 'monitor-dot', tint: 'secondary',
      items: [
        item('respiratoryRate', num('unit.perMin', 16, 0, 60, 1, [br(N, 9, 3), br(9, 12, 1), br(12, 21, 0), br(21, 25, 2), br(25, N, 3)])),
        item('spo2', num('%', 97, 50, 100, 1, [br(N, 92, 3), br(92, 94, 2), br(94, 96, 1), br(96, N, 0)])),
        item('oxygen', choice(opt('air', 0), opt('supplemental', 2))),
        item('systolic', num('mmHg', 120, 40, 260, 5, [br(N, 91, 3), br(91, 101, 2), br(101, 111, 1), br(111, 220, 0), br(220, N, 3)])),
        item('heartRate', num('unit.perMin', 80, 20, 220, 5, [br(N, 41, 3), br(41, 51, 1), br(51, 91, 0), br(91, 111, 1), br(111, 131, 2), br(131, N, 3)])),
        item('consciousness', choice(opt('alert', 0), opt('cvpu', 3))),
        item('temperature', num('°C', 36.8, 30, 43, 0.1, [br(N, 35.1, 3), br(35.1, 36.1, 1), br(36.1, 38.1, 0), br(38.1, 39.1, 1), br(39.1, N, 2)]))
      ],
      bands: [sband('routine', 0, 0, 'success'), sband('low', 1, 4, 'info'), sband('medium', 5, 6, 'warning'), sband('high', 7, 20, 'danger')],
      maxPoints: 20, threshold: 5, noteCount: 4, singleParameterAlert: 3
    },
    // APACHE II (Knaus 1985)
    apacheIIScore: {
      id: 'apacheIIScore', key: 'apache2', icon: 'chart-column', tint: 'tertiary',
      items: [
        item('temperature', num('°C', 37, 25, 45, 0.1, [br(N, 30, 4), br(30, 32, 3), br(32, 34, 2), br(34, 36, 1), br(36, 38.5, 0), br(38.5, 39, 1), br(39, 41, 3), br(41, N, 4)])),
        item('map', num('mmHg', 85, 20, 200, 5, [br(N, 50, 4), br(50, 70, 2), br(70, 110, 0), br(110, 130, 2), br(130, 160, 3), br(160, N, 4)])),
        item('heartRate', num('unit.perMin', 80, 20, 220, 5, [br(N, 40, 4), br(40, 55, 3), br(55, 70, 2), br(70, 110, 0), br(110, 140, 2), br(140, 180, 3), br(180, N, 4)])),
        item('respiratoryRate', num('unit.perMin', 16, 0, 60, 1, [br(N, 6, 4), br(6, 10, 2), br(10, 12, 1), br(12, 25, 0), br(25, 35, 1), br(35, 50, 3), br(50, N, 4)])),
        item('oxygenation', choice(opt('normal', 0), opt('pao261', 1), opt('aado200', 2), opt('aado350', 3), opt('aado500', 4))),
        item('ph', num(N, 7.4, 6.8, 7.9, 0.01, [br(N, 7.15, 4), br(7.15, 7.25, 3), br(7.25, 7.33, 2), br(7.33, 7.5, 0), br(7.5, 7.6, 1), br(7.6, 7.7, 3), br(7.7, N, 4)])),
        item('sodium', num('mmol/L', 140, 90, 200, 1, [br(N, 111, 4), br(111, 120, 3), br(120, 130, 2), br(130, 150, 0), br(150, 155, 1), br(155, 160, 2), br(160, 180, 3), br(180, N, 4)])),
        item('potassium', num('mmol/L', 4.2, 1, 9, 0.1, [br(N, 2.5, 4), br(2.5, 3.0, 2), br(3.0, 3.5, 1), br(3.5, 5.5, 0), br(5.5, 6.0, 1), br(6.0, 7.0, 3), br(7.0, N, 4)])),
        item('creatinine', num('mg/dL', 0.9, 0, 15, 0.1, [br(N, 0.6, 2), br(0.6, 1.5, 0), br(1.5, 2.0, 2), br(2.0, 3.5, 3), br(3.5, N, 4)])),
        // Akut böbrek yetmezliğinde kreatinin puanı iki kez sayılır (Knaus 1985); en yüksek toplam 71 buna göredir
        item('arf', { type: 'toggle', points: 0, doubles: 'creatinine' }),
        item('hematocrit', num('%', 40, 10, 70, 1, [br(N, 20, 4), br(20, 30, 2), br(30, 46, 0), br(46, 50, 1), br(50, 60, 2), br(60, N, 4)])),
        item('leukocytes', num('×10³/µL', 8, 0, 80, 0.5, [br(N, 1, 4), br(1, 3, 2), br(3, 15, 0), br(15, 20, 1), br(20, 40, 2), br(40, N, 4)])),
        item('gcs', num(N, 15, 3, 15, 1, [br(N, 4, 12), br(4, 5, 11), br(5, 6, 10), br(6, 7, 9), br(7, 8, 8), br(8, 9, 7), br(9, 10, 6), br(10, 11, 5), br(11, 12, 4), br(12, 13, 3), br(13, 14, 2), br(14, 15, 1), br(15, N, 0)])),
        item('age', num(N, 45, 0, 120, 1, [br(N, 45, 0), br(45, 55, 2), br(55, 65, 3), br(65, 75, 5), br(75, N, 6)])),
        item('chronicHealth', choice(opt('none', 0), opt('elective', 2), opt('emergency', 5)))
      ],
      bands: [sband('b0', 0, 4, 'success'), sband('b5', 5, 9, 'success'), sband('b10', 10, 14, 'info'), sband('b15', 15, 19, 'warning'),
              sband('b20', 20, 24, 'warning'), sband('b25', 25, 29, 'danger'), sband('b30', 30, 34, 'danger'), sband('b35', 35, 71, 'danger')],
      maxPoints: 71, threshold: null, noteCount: 4
    },
    // MEWS (Subbe 2001)
    mewsScore: {
      id: 'mewsScore', key: 'mews', icon: 'gauge', tint: 'info',
      items: [
        item('systolic', num('mmHg', 120, 40, 260, 5, [br(N, 71, 3), br(71, 81, 2), br(81, 101, 1), br(101, 200, 0), br(200, N, 2)])),
        item('heartRate', num('unit.perMin', 80, 20, 220, 5, [br(N, 41, 2), br(41, 51, 1), br(51, 101, 0), br(101, 111, 1), br(111, 130, 2), br(130, N, 3)])),
        item('respiratoryRate', num('unit.perMin', 16, 0, 60, 1, [br(N, 9, 2), br(9, 15, 0), br(15, 21, 1), br(21, 30, 2), br(30, N, 3)])),
        item('temperature', num('°C', 36.8, 30, 43, 0.1, [br(N, 35, 2), br(35, 38.5, 0), br(38.5, N, 2)])),
        item('avpu', choice(opt('alert', 0), opt('voice', 1), opt('pain', 2), opt('unresponsive', 3)))
      ],
      bands: [sband('low', 0, 2, 'success'), sband('moderate', 3, 4, 'warning'), sband('high', 5, 14, 'danger')],
      maxPoints: 14, threshold: 5, noteCount: 4
    },
    // SIC — sepsise bağlı koagülopati (ISTH 2017)
    sicScore: {
      id: 'sicScore', key: 'sic', icon: 'droplets', tint: 'info',
      items: [
        item('platelets', num('×10³/µL', 200, 0, 800, 10, [br(N, 100, 2), br(100, 150, 1), br(150, N, 0)])),
        item('inr', num(N, 1.0, 0.8, 6, 0.05, [br(N, 1.21, 0), br(1.21, 1.41, 1), br(1.41, N, 2)])),
        item('sofa', choice(opt('zero', 0), opt('one', 1), opt('twoPlus', 2)))
      ],
      bands: [sband('negative', 0, 3, 'success'), sband('positive', 4, 6, 'danger')],
      maxPoints: 6, threshold: 4, noteCount: 4
    },
    // ISTH aşikâr DIC (Taylor 2001)
    dicScore: {
      id: 'dicScore', key: 'dic', icon: 'bandage', tint: 'danger',
      items: [
        item('platelets', num('×10³/µL', 200, 0, 800, 10, [br(N, 50, 2), br(50, 100, 1), br(100, N, 0)])),
        item('fibrinMarker', choice(opt('none', 0), opt('moderate', 2), opt('strong', 3))),
        item('ptProlongation', num('unit.seconds', 1, 0, 30, 0.5, [br(N, 3, 0), br(3, 6, 1), br(6, N, 2)])),
        item('fibrinogen', num('g/L', 3, 0, 10, 0.1, [br(N, 1, 1), br(1, N, 0)]))
      ],
      bands: [sband('negative', 0, 4, 'success'), sband('positive', 5, 8, 'danger')],
      maxPoints: 8, threshold: 5, noteCount: 4
    },
    // SOFA-2 (Ranzani, Singer, Salluh ve ark., JAMA 2025)
    sofa2Score: {
      id: 'sofa2Score', key: 'sofa2', icon: 'layers', tint: 'danger',
      items: [
        item('respiration', choice(opt('over300', 0), opt('under300', 1), opt('under225', 2), opt('under150', 3), opt('under75', 4))),
        item('cardiovascular', choice(opt('map70', 0), opt('mapUnder70', 1), opt('lowDose', 2), opt('midDose', 3), opt('highDose', 4))),
        item('brain', choice(opt('gcs15', 0), opt('gcs1314', 1), opt('gcs912', 2), opt('gcs68', 3), opt('gcs35', 4))),
        item('kidney', choice(opt('cr120', 0), opt('cr200', 1), opt('cr350', 2), opt('crOver350', 3), opt('rrt', 4))),
        item('bilirubin', num('mg/dL', 0.8, 0, 40, 0.1, [br(N, 1.205, 0), br(1.205, 3.005, 1), br(3.005, 6.005, 2), br(6.005, 12.005, 3), br(12.005, N, 4)])),
        item('platelets', num('×10³/µL', 250, 0, 800, 10, [br(N, 50.5, 4), br(50.5, 80.5, 3), br(80.5, 100.5, 2), br(100.5, 150.5, 1), br(150.5, N, 0)]))
      ],
      bands: [sband('b0', 0, 1, 'success'), sband('b2', 2, 6, 'info'), sband('b7', 7, 11, 'warning'), sband('b12', 12, 24, 'danger')],
      maxPoints: 24, threshold: 2, noteCount: 5
    },
    // CAM-ICU (Ely 2001)
    camICUScore: {
      id: 'camICUScore', key: 'camicu', icon: 'brain', tint: 'tertiary',
      items: [
        item('sedation', choice(opt('assessable', 0), opt('deeplySedated', 0))),
        item('acuteChange', toggle(1)), item('inattention', toggle(1)),
        item('consciousness', toggle(1)), item('disorganized', toggle(1))
      ],
      bands: [sband('negative', 0, 0, 'success'), sband('positive', 1, 1, 'danger'), sband('unassessable', 2, 2, 'warning')],
      maxPoints: 4, threshold: null, noteCount: 5, logic: 'camICU', showsSepsisWarnings: false
    },
    // PRE-DELIRIC (van den Boogaard, BMJ 2012)
    preDelericScore: {
      id: 'preDelericScore', key: 'prediliric', icon: 'chart-line', tint: 'secondary',
      items: [
        item('age', num(N, 65, 16, 110, 1, [])),
        item('apache', num(N, 15, 0, 71, 1, [])),
        item('urea', num('mmol/L', 6, 0, 60, 0.5, [])),
        item('admission', choice(opt('surgical', 0), opt('medical', 0), opt('trauma', 0), opt('neuro', 0))),
        item('coma', choice(opt('comaNone', 0), opt('comaDrug', 0), opt('comaMisc', 0), opt('comaCombined', 0))),
        item('morphine', choice(opt('morphineNone', 0), opt('morphineLow', 0), opt('morphineMid', 0), opt('morphineHigh', 0))),
        item('infection', toggle(0)), item('acidosis', toggle(0)), item('sedatives', toggle(0)), item('urgent', toggle(0))
      ],
      bands: [sband('low', 0, 19, 'success'), sband('moderate', 20, 49, 'warning'), sband('high', 50, 100, 'danger')],
      maxPoints: 100, threshold: 50, noteCount: 5, logic: 'preDeliric', showsSepsisWarnings: false
    },
    // CPOT (Gélinas 2006)
    cpotScore: {
      id: 'cpotScore', key: 'cpot', icon: 'scan-face', tint: 'warning',
      items: [
        item('face', choice(opt('faceRelaxed', 0), opt('faceTense', 1), opt('faceGrimacing', 2))),
        item('movements', choice(opt('absence', 0), opt('protection', 1), opt('restlessness', 2))),
        item('tension', choice(opt('tensionRelaxed', 0), opt('tensionTense', 1), opt('tensionVeryTense', 2))),
        item('ventilator', choice(opt('tolerating', 0), opt('coughing', 1), opt('fighting', 2)))
      ],
      bands: [sband('low', 0, 2, 'success'), sband('high', 3, 8, 'danger')],
      maxPoints: 8, threshold: 3, noteCount: 5, showsSepsisWarnings: false
    },
    // Klinik Kırılganlık Ölçeği (Rockwood 2005; CFS 2.0, 2020)
    clinicalFrailtyScale: {
      id: 'clinicalFrailtyScale', key: 'cfs', icon: 'footprints', tint: 'info',
      items: [item('level', choice(...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => opt('l' + n, n))))],
      bands: [sband('fit', 1, 3, 'success'), sband('vulnerable', 4, 4, 'info'), sband('frail', 5, 6, 'warning'), sband('severe', 7, 9, 'danger')],
      maxPoints: 9, threshold: 5, noteCount: 5, showsSepsisWarnings: false
    },
    // mNUTRIC (Heyland 2011 · Rahman 2016)
    mNutricScore: {
      id: 'mNutricScore', key: 'mnutric', icon: 'utensils', tint: 'success',
      items: [
        item('age', num(N, 60, 16, 110, 1, [br(N, 50, 0), br(50, 75, 1), br(75, N, 2)])),
        item('apache', num(N, 15, 0, 71, 1, [br(N, 15, 0), br(15, 20, 1), br(20, 28, 2), br(28, N, 3)])),
        item('sofa', num(N, 6, 0, 24, 1, [br(N, 6, 0), br(6, 10, 1), br(10, N, 2)])),
        item('comorbidities', num(N, 1, 0, 15, 1, [br(N, 2, 0), br(2, N, 1)])),
        item('daysToICU', num(N, 0, 0, 60, 1, [br(N, 1, 0), br(1, N, 1)]))
      ],
      bands: [sband('low', 0, 4, 'success'), sband('high', 5, 9, 'danger')],
      maxPoints: 9, threshold: 5, noteCount: 5, showsSepsisWarnings: false
    },
    // Charlson (1987 · yaş düzeltmesi 1994)
    charlsonIndex: {
      id: 'charlsonIndex', key: 'charlson', icon: 'clipboard-list', tint: 'tertiary',
      items: [
        item('age', num(N, 60, 16, 110, 1, [br(N, 50, 0), br(50, 60, 1), br(60, 70, 2), br(70, 80, 3), br(80, 90, 4), br(90, N, 5)])),
        item('mi', toggle(1)), item('chf', toggle(1)), item('pvd', toggle(1)), item('cvd', toggle(1)),
        item('dementia', toggle(1)), item('copd', toggle(1)), item('connective', toggle(1)), item('ulcer', toggle(1)),
        item('diabetes', choice(opt('dmNone', 0), opt('dmUncomplicated', 1), opt('dmEndOrgan', 2))),
        item('liver', choice(opt('liverNone', 0), opt('liverMild', 1), opt('liverModerate', 3))),
        item('hemiplegia', toggle(2)), item('renal', toggle(2)), item('leukemia', toggle(2)), item('lymphoma', toggle(2)),
        item('tumor', choice(opt('tumorNone', 0), opt('tumorLocalized', 2), opt('tumorMetastatic', 6))),
        item('aids', toggle(6))
      ],
      bands: [sband('b0', 0, 0, 'success'), sband('b1', 1, 2, 'info'), sband('b3', 3, 4, 'warning'), sband('b5', 5, 38, 'danger')],
      maxPoints: 38, threshold: null, noteCount: 5, showsSepsisWarnings: false
    },
    // CPIS (Pugin 1991)
    cpisScore: {
      id: 'cpisScore', key: 'cpis', icon: 'lungs', tint: 'warning',
      items: [
        // Pugin 1991 / Singh 2000: ≤ 36,0 °C → 2; kaynakta tanımsız 36,1–36,4 °C aralığı 0 puan sayılır
        item('temperature', num('°C', 37, 30, 43, 0.1, [br(N, 36.05, 2), br(36.05, 38.5, 0), br(38.5, 39.0, 1), br(39.0, N, 2)])),
        item('leukocytes', choice(opt('wbcNormal', 0), opt('wbcAbnormal', 1), opt('wbcAbnormalBands', 2))),
        item('secretions', choice(opt('secNone', 0), opt('secNonPurulent', 1), opt('secPurulent', 2))),
        item('oxygenation', choice(opt('pfOver240', 0), opt('pfUnder240', 2))),
        item('radiograph', choice(opt('xrNone', 0), opt('xrDiffuse', 1), opt('xrLocalized', 2))),
        item('progression', choice(opt('progNo', 0), opt('progYes', 2))),
        item('culture', choice(opt('cultNone', 0), opt('cultModerate', 1), opt('cultModerateGram', 2)))
      ],
      // Yedi maddenin aritmetik toplamı 14'e ulaşabilir (Pugin'in altı maddesi + Singh 2000'in infiltrat ilerlemesi)
      bands: [sband('low', 0, 6, 'success'), sband('high', 7, 14, 'danger')],
      maxPoints: 14, threshold: 7, noteCount: 5
    }
  };
  for (const s of Object.values(SCORES)) {
    s.logic = s.logic || 'sum';
    if (s.showsSepsisWarnings === undefined) s.showsSepsisWarnings = true;
    s.showsPoints = s.logic === 'sum';
    s.bandFor = total => s.bands.find(b => inRange(b.range, total)) || s.bands[s.bands.length - 1];
  }
  for (const a of Object.values(AIRWAY)) {
    a.bandFor = total => a.bands.find(b => inRange(b.range, total)) || a.bands[a.bands.length - 1];
  }
  AA.SCORES = SCORES;

  // ================================================================ Sıvı ve elektrolit araçları
  const tnum = (unit, defaultValue, lo, hi, step) => ({ type: 'numeric', unit, defaultValue, range: R(lo, hi), step });
  const tchoice = (...options) => ({ type: 'choice', options });
  const topt = (key, value = 0) => ({ key, value });
  const ttoggle = () => ({ type: 'toggle' });
  const field = (key, input) => ({ key, input });
  const TBW = [topt('maleAdult', 0.6), topt('femaleAdult', 0.5), topt('maleElderly', 0.5), topt('femaleElderly', 0.45)];

  const ELECTRO = {
    hyponatremiaCorrection: {
      id: 'hyponatremiaCorrection', key: 'hyponatremia', icon: 'droplets', tint: 'blue', calc: 'hyponatremia',
      fields: [
        field('weight', tnum('kg', 70, 3, 250, 1)), field('tbw', tchoice(...TBW)),
        field('sodium', tnum('mmol/L', 120, 100, 135, 1)), field('target', tnum('mmol/L', 8, 4, 10, 1)),
        field('fluid', tchoice(topt('saline3', 513), topt('saline09', 154), topt('ringer', 130), topt('saline045', 77))),
        field('highRisk', ttoggle())
      ], noteCount: 5
    },
    hypernatremiaCorrection: {
      id: 'hypernatremiaCorrection', key: 'hypernatremia', icon: 'triangle-alert', tint: 'warning', calc: 'hypernatremia',
      fields: [
        field('weight', tnum('kg', 70, 3, 250, 1)), field('tbw', tchoice(...TBW)),
        field('sodium', tnum('mmol/L', 160, 145, 200, 1)), field('target', tnum('mmol/L', 145, 135, 160, 1)),
        field('hours', tnum('unit.hourShort', 48, 6, 96, 6)), field('losses', tnum('mL', 1000, 0, 6000, 100)),
        field('acute', ttoggle())
      ], noteCount: 5
    },
    potassiumReplacement: {
      id: 'potassiumReplacement', key: 'potassium', icon: 'heart-pulse', tint: 'tertiary', calc: 'potassium',
      fields: [
        field('potassium', tnum('mmol/L', 3.0, 1.5, 5.5, 0.1)), field('target', tnum('mmol/L', 4.0, 3.5, 5.0, 0.1)),
        field('route', tchoice(topt('peripheral', 10), topt('central', 20))),
        field('dose', tnum('mmol', 40, 10, 120, 10)), field('renal', ttoggle())
      ], noteCount: 5
    },
    anionGapPanel: {
      id: 'anionGapPanel', key: 'aniongap', icon: 'diff', tint: 'info', calc: 'anionGap',
      fields: [
        field('sodium', tnum('mmol/L', 140, 100, 180, 1)), field('chloride', tnum('mmol/L', 104, 60, 140, 1)),
        field('bicarbonate', tnum('mmol/L', 24, 2, 50, 1)), field('albumin', tnum('g/dL', 4.0, 0.5, 6, 0.1)),
        field('paco2', tnum('mmHg', 40, 10, 120, 1))
      ], noteCount: 5
    },
    cumulativeFluidBalance: {
      id: 'cumulativeFluidBalance', key: 'fluidbalance', icon: 'arrow-up-down', tint: 'secondary', calc: 'fluidBalance',
      fields: [
        field('weight', tnum('kg', 70, 3, 250, 1)), field('intake', tnum('L', 12, 0, 80, 0.5)),
        field('output', tnum('L', 8, 0, 80, 0.5)), field('days', tnum(null, 3, 1, 30, 1))
      ], noteCount: 4
    },
    kdigoStaging: {
      id: 'kdigoStaging', key: 'kdigo', icon: 'bean', tint: 'danger', calc: 'kdigo',
      fields: [
        field('baseline', tnum('mg/dL', 0.9, 0.2, 12, 0.1)), field('current', tnum('mg/dL', 1.5, 0.2, 20, 0.1)),
        field('urine', tnum('mL/kg/h', 0.6, 0, 3, 0.1)),
        field('duration', tchoice(topt('under6', 0), topt('h6to12', 1), topt('h12to24', 2), topt('over24', 3))),
        field('anuria', ttoggle()), field('rrt', ttoggle())
      ], noteCount: 5
    },
    electrolyteCorrections: {
      id: 'electrolyteCorrections', key: 'corrections', icon: 'sliders-horizontal', tint: 'success', calc: 'corrections',
      fields: [
        field('sodium', tnum('mmol/L', 130, 100, 180, 1)), field('glucose', tnum('mg/dL', 400, 50, 1200, 10)),
        field('factor', tchoice(topt('katz', 1.6), topt('hillier', 2.4))),
        field('calcium', tnum('mg/dL', 8.0, 4, 16, 0.1)), field('albumin', tnum('g/dL', 2.5, 0.5, 6, 0.1))
      ], noteCount: 4
    },
    fractionalExcretion: {
      id: 'fractionalExcretion', key: 'fena', icon: 'percent', tint: 'accent', calc: 'fena',
      fields: [
        field('serumNa', tnum('mmol/L', 140, 100, 180, 1)), field('urineNa', tnum('mmol/L', 20, 1, 300, 1)),
        field('serumCr', tnum('mg/dL', 2.0, 0.2, 20, 0.1)), field('urineCr', tnum('mg/dL', 100, 5, 400, 5)),
        field('serumUrea', tnum('mg/dL', 60, 5, 300, 5)), field('urineUrea', tnum('mg/dL', 900, 50, 5000, 50))
      ], noteCount: 5
    }
  };
  AA.ELECTRO = ELECTRO;

  // KDIGO idrar alanının iOS'taki birimi "mL/kg/sa" idi; web'de dile göre gösterilir.
  AA.unitOverrides = { 'mL/kg/h': () => 'mL/kg/' + AA.T('unit.hourShort') };

  /** Kristalloid içerik tablosu — üreticilerin ürün bilgilerindeki nominal içerikler. */
  AA.CRYSTALLOIDS = [
    { key: 'nacl09', sodium: 154, chloride: 154, potassium: 0, bufferKey: 'none', osmolarity: 308 },
    { key: 'ringerLactate', sodium: 130, chloride: 109, potassium: 4, bufferKey: 'lactate28', osmolarity: 273 },
    { key: 'plasmalyte', sodium: 140, chloride: 98, potassium: 5, bufferKey: 'acetateGluconate', osmolarity: 295 },
    { key: 'nacl045', sodium: 77, chloride: 77, potassium: 0, bufferKey: 'none', osmolarity: 154 },
    { key: 'nacl3', sodium: 513, chloride: 513, potassium: 0, bufferKey: 'none', osmolarity: 1027 },
    { key: 'dextrose5', sodium: 0, chloride: 0, potassium: 0, bufferKey: 'none', osmolarity: 278 }
  ];

  // ================================================================ Kan gazı girdileri
  AA.BLOODGAS_FIELDS = [
    field('ph', tnum(null, 7.40, 6.60, 7.80, 0.01)),
    field('paco2', tnum('mmHg', 40, 10, 140, 1)),
    field('hco3', tnum('mEq/L', 24, 1, 60, 0.5)),
    field('sodium', tnum('mEq/L', 140, 100, 180, 1)),
    field('chloride', tnum('mEq/L', 104, 60, 140, 1)),
    field('albumin', tnum('g/dL', 4.0, 0.5, 6.0, 0.1)),
    field('lactate', tnum('mmol/L', 1.0, 0, 30, 0.1)),
    field('chronicity', tchoice(topt('acute', 0), topt('chronic', 1))),
    field('sbe', tnum('mEq/L', 0, -40, 40, 0.5)),
    field('phosphate', tnum('mmol/L', 1.1, 0.1, 5.0, 0.1))
  ];
  AA.BLOODGAS_ADVANCED = new Set(['sbe', 'phosphate']);

  // ================================================================ Kataloglar
  const entry = (id, icon, tint, category, calcId) => ({ id, icon, tint, category, calcId });
  AA.ANESTHESIA_CATALOG = [
    entry('pentothal', 'droplet', 'accent', 'infusion', 'pentothalInfusion'),
    entry('propofol', 'droplets', 'secondary', 'infusion', 'propofolInfusion'),
    entry('remifentanil', 'audio-waveform', 'tertiary', 'infusion', 'remifentanilInfusion'),
    entry('ketamine', 'brain', 'warning', 'infusion', 'ketamineInfusion'),
    entry('localAnestheticMax', 'syringe', 'warning', 'emergency', 'localAnestheticMax'),
    entry('lastLipid', 'droplet', 'danger', 'emergency', 'lastLipid'),
    entry('malignantHyperthermia', 'flame', 'danger', 'emergency', 'malignantHyperthermia'),
    entry('pediatricEmergency', 'baby', 'info', 'emergency', 'pediatricEmergency'),
    entry('sugammadexReversal', 'syringe', 'tertiary', 'neuromuscular', 'sugammadexReversal'),
    entry('maintenanceFluid', 'thermometer', 'info', 'fluids', 'maintenanceFluid'),
    entry('allowableBloodLoss', 'droplet', 'danger', 'fluids', 'allowableBloodLoss'),
    entry('mallampati', 'mouth', 'accent', 'airway', 'mallampatiScore'),
    entry('cormack', 'eye', 'secondary', 'airway', 'cormackLehaneScore'),
    entry('airwayMeasurements', 'ruler', 'success', 'airway', 'airwayMeasurements'),
    entry('wilson', 'list-ordered', 'info', 'scores', 'wilsonScore'),
    entry('sari', 'chart-bar', 'tertiary', 'scores', 'elGanzouriScore'),
    entry('lemon', 'list-checks', 'warning', 'scores', 'lemonScore'),
    entry('macocha', 'bed-double', 'danger', 'scores', 'macochaScore'),
    entry('tubeSize', 'lungs', 'success', 'airway', null),
    entry('tidalVolume', 'wind', 'accentSoft', 'airway', null),
    entry('apfel', 'list-ordered', 'tertiary', 'scores', null)
  ];
  AA.ANESTHESIA_ORDER = ['infusion', 'emergency', 'neuromuscular', 'vasoactive', 'fluids', 'airway', 'renal', 'sepsis', 'scores', 'electrolyte', 'bloodGas'];

  AA.ICU_CATALOG = [
    entry('norepinephrine', 'heart-plus', 'blue', 'vasoactive', 'norepinephrineInfusion'),
    entry('epinephrine', 'heart-pulse', 'pink', 'vasoactive', 'epinephrineInfusion'),
    entry('dopamine', 'activity', 'success', 'vasoactive', 'dopamineInfusion'),
    entry('vasopressin', 'droplet', 'tertiary', 'vasoactive', 'vasopressinInfusion'),
    entry('isoprenaline', 'heart', 'warning', 'vasoactive', 'isoprenalineInfusion'),
    entry('dexmedetomidine', 'moon-star', 'cyan', 'vasoactive', 'dexmedetomidineInfusion'),
    entry('dobutamine', 'heart', 'indigo', 'vasoactive', 'dobutamineInfusion'),
    entry('icuSedation', 'pill', 'secondary', 'infusion', null),
    entry('sofa', 'activity-square', 'danger', 'sepsis', 'sofaScore'),
    entry('sofa2', 'layers', 'danger', 'sepsis', 'sofa2Score'),
    entry('qsofa', 'zap', 'warning', 'sepsis', 'qsofaScore'),
    entry('news2', 'monitor-dot', 'secondary', 'sepsis', 'news2Score'),
    entry('mews', 'gauge', 'info', 'sepsis', 'mewsScore'),
    entry('apache', 'chart-column', 'tertiary', 'sepsis', 'apacheIIScore'),
    entry('sic', 'droplets', 'info', 'sepsis', 'sicScore'),
    entry('dic', 'bandage', 'danger', 'sepsis', 'dicScore'),
    entry('cpis', 'lungs', 'warning', 'sepsis', 'cpisScore'),
    entry('camicu', 'brain', 'tertiary', 'sepsis', 'camICUScore'),
    entry('prediliric', 'chart-line', 'secondary', 'sepsis', 'preDelericScore'),
    entry('cpot', 'scan-face', 'warning', 'sepsis', 'cpotScore'),
    entry('cfs', 'footprints', 'info', 'sepsis', 'clinicalFrailtyScale'),
    entry('mnutric', 'utensils', 'success', 'sepsis', 'mNutricScore'),
    entry('charlson', 'clipboard-list', 'tertiary', 'sepsis', 'charlsonIndex'),
    entry('icuVentilation', 'lungs', 'info', 'airway', null),
    entry('bloodgas', 'lungs', 'tertiary', 'bloodGas', 'bloodGasAnalysis'),
    entry('hyponatremia', 'droplets', 'blue', 'electrolyte', 'hyponatremiaCorrection'),
    entry('hypernatremia', 'triangle-alert', 'warning', 'electrolyte', 'hypernatremiaCorrection'),
    entry('potassium', 'heart-pulse', 'tertiary', 'electrolyte', 'potassiumReplacement'),
    entry('corrections', 'sliders-horizontal', 'success', 'electrolyte', 'electrolyteCorrections'),
    entry('aniongap', 'diff', 'info', 'electrolyte', 'anionGapPanel'),
    entry('fluidbalance', 'arrow-up-down', 'secondary', 'electrolyte', 'cumulativeFluidBalance'),
    entry('kdigo', 'bean', 'danger', 'electrolyte', 'kdigoStaging'),
    entry('fena', 'percent', 'accent', 'electrolyte', 'fractionalExcretion'),
    entry('crystalloids', 'flask-conical', 'info', 'electrolyte', 'crystalloidTable'),
    entry('icuCrrt', 'bean', 'danger', 'renal', null)
  ];
  AA.ICU_ORDER = ['vasoactive', 'infusion', 'bloodGas', 'electrolyte', 'sepsis', 'airway', 'renal', 'fluids'];

  AA.CATEGORY_ICONS = {
    infusion: 'syringe', emergency: 'siren', neuromuscular: 'activity', vasoactive: 'heart-plus', renal: 'bean', sepsis: 'hospital', fluids: 'droplets',
    airway: 'lungs', scores: 'list-ordered', electrolyte: 'droplet', bloodGas: 'lungs'
  };

  AA.availableCount = list => list.filter(e => e.calcId).length;
})();
