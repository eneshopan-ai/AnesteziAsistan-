/* Anestezi Asistanı — web sürümü.
 * Çekirdek: kalıcı depolama, dil, sayı biçimi, antropometri, ayarlar ve hasta depoları.
 * iOS sürümündeki Core/ katmanının birebir karşılığıdır. */
(function () {
  'use strict';
  const AA = (window.AA = window.AA || {});

  // ---------------------------------------------------------------- Depolama
  // localStorage yalnızca bu tarayıcıda kalır; erişilemezse uygulama yine çalışır.
  const Store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem('aa.' + key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('aa.' + key, JSON.stringify(value)); } catch (e) { /* özel pencere vb. */ }
    },
    remove(key) {
      try { localStorage.removeItem('aa.' + key); } catch (e) { /* yok say */ }
    }
  };
  // Oturum deposu: sekme kapanınca silinir (hasta kartı için).
  const Session = {
    get(key, fallback) {
      try {
        const raw = sessionStorage.getItem('aa.' + key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { sessionStorage.setItem('aa.' + key, JSON.stringify(value)); } catch (e) { /* yok say */ }
    },
    remove(key) {
      try { sessionStorage.removeItem('aa.' + key); } catch (e) { /* yok say */ }
    }
  };
  AA.Store = Store;
  AA.Session = Session;

  // ---------------------------------------------------------------- Dil
  const LANGUAGES = [
    { code: 'tr', name: 'Türkçe', flag: '🇹🇷', locale: 'tr-TR' },
    { code: 'en-US', name: 'English (US)', flag: '🇺🇸', locale: 'en-US' },
    { code: 'en-GB', name: 'English (UK)', flag: '🇬🇧', locale: 'en-GB' }
  ];

  // Web sürümüne özgü metinler ve web'de davranışı farklı olan birkaç metnin düzeltmesi.
  // (iOS'ta hasta kartı yalnızca bellekte; web'de sekme oturumunda tutulur. Kaydedilen
  // hastalar her iki sürümde de yalnızca cihazda/tarayıcıda saklanır.)
  const WEB_TEXT = {
    tr: {
      'web.open': 'Aç',
      'web.back': 'Geri',
      'web.copy': 'Kopyala',
      'web.copied': 'Panoya kopyalandı',
      'web.copyFailed': 'Kopyalanamadı — metni seçip elle kopyalayın.',
      'web.version': 'Web 1.0 · iOS 1.0 ile aynı içerik',
      'web.loading': 'Yükleniyor…',
      'web.loadError': 'Dil dosyası yüklenemedi. Sayfayı yenileyin.',
      'web.toTop': 'Başa dön',
      'web.storageNote': 'Ayarlar ve kaydettiğiniz hastalar yalnızca bu tarayıcının yerel deposunda tutulur.',
      'web.clearSaved': 'Kayıtlı hastaları ve ayarları sil',
      'web.clearSavedDone': 'Bu tarayıcıdaki kayıtlar silindi',
      'web.confirm': 'Onayla',
      'disclaimer.privacy.title': 'Hasta verisi sunucuya gitmez',
      'disclaimer.privacy.body': 'Hasta kartına girdiğiniz bilgiler yalnızca bu sekme açıkken tutulur. Yalnızca "Hastayı kaydet" ile açıkça kaydettiğiniz hastalar bu tarayıcının yerel deposunda saklanır; hiçbir veri bir sunucuya gönderilmez.',
      'settings.dataSubtitle': 'Hasta kartı sekme kapanınca silinir; kayıtlı hastalar yalnızca bu tarayıcıda durur',
      'settings.calculatorCount': 'Hesaplayıcı sayısı'
    },
    en: {
      'web.open': 'Open',
      'web.back': 'Back',
      'web.copy': 'Copy',
      'web.copied': 'Copied to clipboard',
      'web.copyFailed': 'Could not copy — select the text and copy it manually.',
      'web.version': 'Web 1.0 · same content as iOS 1.0',
      'web.loading': 'Loading…',
      'web.loadError': 'The language file could not be loaded. Reload the page.',
      'web.toTop': 'Back to top',
      'web.storageNote': 'Settings and the patients you save are kept only in this browser’s local storage.',
      'web.clearSaved': 'Delete saved patients and settings',
      'web.clearSavedDone': 'Records in this browser were deleted',
      'web.confirm': 'Confirm',
      'disclaimer.privacy.title': 'Patient data never leaves the device',
      'disclaimer.privacy.body': 'Details entered on the patient card are kept only while this tab is open. Only patients you explicitly save with "Save patient" are stored, in this browser’s local storage; nothing is sent to a server.',
      'settings.dataSubtitle': 'The patient card clears when the tab closes; saved patients stay in this browser only',
      'settings.calculatorCount': 'Calculators available'
    }
  };

  const I18n = {
    language: 'tr',
    table: {},
    fallback: {},
    drugs: {},
    fallbackDrugs: {},
    cache: {},

    systemDefault() {
      const pref = (navigator.languages && navigator.languages[0]) || navigator.language || 'tr';
      if (/^tr/i.test(pref)) return 'tr';
      if (/^en/i.test(pref)) return /GB|IE|AU|NZ/i.test(pref) ? 'en-GB' : 'en-US';
      return 'tr';
    },

    async fetchTable(code) {
      if (this.cache[code]) return this.cache[code];
      // Bağımsız yayında (GitHub Pages) sürüm etiketi eski çevirilerin önbellekte kalmasını önler
      const version = window.AA_BUILD ? '?v=' + window.AA_BUILD : '';
      const res = await fetch('i18n/' + code + '.json' + version, { cache: 'force-cache' });
      if (!res.ok) throw new Error('i18n ' + code + ' ' + res.status);
      const json = await res.json();
      this.cache[code] = json;
      return json;
    },

    async load(code) {
      if (!LANGUAGES.some(l => l.code === code)) code = 'tr';
      const [table, fallback] = await Promise.all([this.fetchTable(code), this.fetchTable('en-US')]);
      this.language = code;
      this.table = table.ui || {};
      this.drugs = table.drugs || {};
      this.fallback = fallback.ui || {};
      this.fallbackDrugs = fallback.drugs || {};
      document.documentElement.lang = code === 'tr' ? 'tr' : code;
    },

    get info() { return LANGUAGES.find(l => l.code === this.language) || LANGUAGES[0]; },
    get locale() { return this.info.locale; },

    web(key) {
      const pack = this.language === 'tr' ? WEB_TEXT.tr : WEB_TEXT.en;
      return pack[key];
    },

    text(key) {
      const w = this.web(key);
      if (w !== undefined) return w;
      if (Object.prototype.hasOwnProperty.call(this.table, key)) return this.table[key];
      if (Object.prototype.hasOwnProperty.call(this.fallback, key)) return this.fallback[key];
      return key;
    },

    drug(id) { return this.drugs[id] || this.fallbackDrugs[id] || null; }
  };

  function format(template, values) {
    let result = String(template);
    if (values) {
      for (const k of Object.keys(values)) result = result.split('{' + k + '}').join(String(values[k]));
    }
    return result;
  }

  /** Kısa erişim: T("home.title"), T("calc.noteCount", {count: 3}) */
  function T(key, values) { return format(I18n.text(key), values); }

  /** "unit.perMin" gibi anahtar biçimindeki birimleri çevirir; düz birimleri olduğu gibi bırakır. */
  function unitText(unit) {
    if (unit == null) return '';
    return /^unit\./.test(unit) ? T(unit) : unit;
  }

  AA.LANGUAGES = LANGUAGES;
  AA.I18n = I18n;
  AA.T = T;
  AA.format = format;
  AA.unitText = unitText;

  // ---------------------------------------------------------------- Sayı biçimi
  const formatterCache = new Map();
  function nf(min, max) {
    const key = I18n.locale + '|' + min + '|' + max;
    let f = formatterCache.get(key);
    if (!f) {
      f = new Intl.NumberFormat(I18n.locale, { minimumFractionDigits: min, maximumFractionDigits: max });
      formatterCache.set(key, f);
    }
    return f;
  }
  const isNum = v => typeof v === 'number' && isFinite(v);

  const Fmt = {
    /** Büyüklüğe göre otomatik ondalık: 0.05 → "0,05", 12.4 → "12,4", 250 → "250" */
    smart(value) {
      if (!isNum(value)) return '—';
      const m = Math.abs(value);
      const digits = m === 0 ? 0 : m < 1 ? 3 : m < 10 ? 2 : m < 100 ? 1 : 0;
      return nf(0, digits).format(value);
    },
    /** İnfüzyon dozları için hassas gösterim: 0,015 · 0,08 · 4,5 · 120 */
    dose(value) {
      if (!isNum(value)) return '—';
      const m = Math.abs(value);
      if (m === 0) return '0';
      if (m < 0.1) return nf(0, 3).format(value);
      if (m < 1) return nf(0, 2).format(value);
      if (m < 100) return nf(0, 1).format(value);
      return nf(0, 0).format(value);
    },
    decimal(value, digits = 1) {
      if (!isNum(value)) return '—';
      return nf(0, digits).format(value);
    },
    fixed(value, digits) {
      if (!isNum(value)) return '—';
      return nf(digits, digits).format(value);
    },
    /** 1.5 saat → "1 sa 30 dk" */
    duration(hours) {
      if (!isNum(hours) || hours <= 0) return '—';
      if (hours >= 48) return Fmt.decimal(hours / 24, 1) + ' ' + T('unit.dayShort');
      const total = Math.round(hours * 60);
      const h = Math.floor(total / 60), m = total % 60;
      if (h === 0) return m + ' ' + T('unit.minuteShort');
      if (m === 0) return h + ' ' + T('unit.hourShort');
      return h + ' ' + T('unit.hourShort') + ' ' + m + ' ' + T('unit.minuteShort');
    },
    /** Metin girişini sayıya çevirir; hem "7,5" hem "7.5" kabul eder. */
    parse(text) {
      if (text == null) return null;
      const cleaned = String(text).trim().replace(/\s/g, '').replace(',', '.');
      if (!cleaned || !/^[-+]?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return null;
      const v = Number(cleaned);
      return isFinite(v) ? v : null;
    },
    /** Düzenlenebilir alanların metni; kayan nokta artıkları gösterilmez. */
    input(value) {
      if (!isNum(value)) return '';
      const rounded = Math.round(value * 10000) / 10000;
      const sep = I18n.language === 'tr' ? ',' : '.';
      return String(rounded).replace('.', sep);
    },
    dateTime(date) {
      try {
        return new Intl.DateTimeFormat(I18n.locale, {
          day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        }).format(new Date(date));
      } catch (e) { return String(date); }
    },
    longDate(date) {
      try {
        return new Intl.DateTimeFormat(I18n.locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
      } catch (e) { return ''; }
    }
  };
  AA.Fmt = Fmt;
  AA.isNum = isNum;

  // ---------------------------------------------------------------- Antropometri
  const SEX = {
    male: { devineBase: 50.0, jan: [9270, 6680, 216] },
    female: { devineBase: 45.5, jan: [9270, 8780, 244] }
  };

  const Anthropometry = {
    /** kg / m² */
    bmi(w, h) { if (!(h > 0)) return 0; const m = h / 100; return w / (m * m); },
    /** Mosteller (1987): √(cm × kg / 3600) */
    bsaMosteller(w, h) { return w > 0 && h > 0 ? Math.sqrt(h * w / 3600) : 0; },
    /** Du Bois (1916): 0,007184 × cm^0,725 × kg^0,425 */
    bsaDuBois(w, h) { return w > 0 && h > 0 ? 0.007184 * Math.pow(h, 0.725) * Math.pow(w, 0.425) : 0; },
    /** Devine (1974): 50 / 45,5 kg + 152,4 cm üzerindeki her inç için 2,3 kg */
    ibw(h, sex) {
      const inches = Math.max(0, (h - 152.4) / 2.54);
      return SEX[sex].devineBase + 2.3 * inches;
    },
    /** Janmahasatian (2005) */
    lbw(w, h, sex) {
      const b = Anthropometry.bmi(w, h);
      const c = SEX[sex].jan;
      const d = c[1] + c[2] * b;
      return d > 0 ? (c[0] * w) / d : w;
    },
    /** İVA + 0,4 × (TVA − İVA) */
    adjusted(w, h, sex, factor = 0.4) {
      const ibw = Anthropometry.ibw(h, sex);
      return w > ibw ? ibw + factor * (w - ibw) : w;
    },
    /** WHO sınıflaması */
    bmiCategory(v) {
      if (v < 16) return T('bmi.severeUnderweight');
      if (v < 18.5) return T('bmi.underweight');
      if (v < 25) return T('bmi.normal');
      if (v < 30) return T('bmi.overweight');
      if (v < 35) return T('bmi.obese1');
      if (v < 40) return T('bmi.obese2');
      return T('bmi.obese3');
    }
  };

  /** Hastanın türetilmiş değerleri; kilo veya boy yoksa null. */
  function makeProfile(p) {
    if (!p || !(p.weightKg > 0) || !(p.heightCm > 0)) return null;
    const w = p.weightKg, h = p.heightCm, sex = p.sex === 'female' ? 'female' : 'male';
    const prof = {
      totalBodyWeight: w, heightCm: h, sex, ageYears: isNum(p.ageYears) ? p.ageYears : null,
      bmi: Anthropometry.bmi(w, h),
      bsaMosteller: Anthropometry.bsaMosteller(w, h),
      bsaDuBois: Anthropometry.bsaDuBois(w, h),
      idealBodyWeight: Anthropometry.ibw(h, sex),
      leanBodyWeight: Anthropometry.lbw(w, h, sex),
      adjustedBodyWeight: Anthropometry.adjusted(w, h, sex)
    };
    prof.isObese = prof.bmi >= 30;
    prof.isUnderweight = prof.bmi < 18.5;
    prof.bmiCategory = Anthropometry.bmiCategory(prof.bmi);
    prof.weight = basis => ({
      total: prof.totalBodyWeight, ideal: prof.idealBodyWeight,
      lean: prof.leanBodyWeight, adjusted: prof.adjustedBodyWeight
    })[basis] ?? prof.totalBodyWeight;
    return prof;
  }

  AA.Anthropometry = Anthropometry;
  AA.makeProfile = makeProfile;

  // ---------------------------------------------------------------- Olay yayını
  const listeners = new Set();
  AA.onChange = fn => { listeners.add(fn); return () => listeners.delete(fn); };
  AA.emit = topic => listeners.forEach(fn => { try { fn(topic); } catch (e) { console.error(e); } });

  // ---------------------------------------------------------------- Ayarlar
  const SETTINGS_DEFAULTS = {
    language: null,
    appearance: 'system',
    defaultBasis: 'total',
    dropFactor: 20,
    advancedMetrics: true,
    disclaimerAccepted: false
  };
  const Settings = Object.assign({}, SETTINGS_DEFAULTS, Store.get('settings.v1', {}));
  Settings.save = function () {
    const data = {};
    for (const k of Object.keys(SETTINGS_DEFAULTS)) data[k] = Settings[k];
    Store.set('settings.v1', data);
  };
  Settings.set = function (key, value) {
    Settings[key] = value;
    Settings.save();
    AA.emit('settings');
  };
  AA.Settings = Settings;

  AA.DROP_FACTORS = [20, 15, 60];
  AA.dropFactorTitle = f => T(f === 15 ? 'dropFactor.macro15' : f === 60 ? 'dropFactor.micro60' : 'dropFactor.macro20');
  AA.dropFactorShort = f => f + ' ' + T('unit.dropsPerMlShort');

  // ---------------------------------------------------------------- Hasta kartı (oturum)
  const EMPTY_PATIENT = { weightKg: null, heightCm: null, ageYears: null, sex: 'male' };
  const PatientStore = {
    patient: Object.assign({}, EMPTY_PATIENT, Session.get('patient.v1', {})),
    get profile() { return makeProfile(this.patient); },
    get isComplete() { return this.patient.weightKg > 0 && this.patient.heightCm > 0; },
    update(changes) {
      Object.assign(this.patient, changes);
      Session.set('patient.v1', this.patient);
      AA.emit('patient');
    },
    setSample() { this.update({ weightKg: 70, heightCm: 170, ageYears: 40, sex: 'male' }); },
    reset() { this.patient = Object.assign({}, EMPTY_PATIENT); Session.remove('patient.v1'); AA.emit('patient'); }
  };
  AA.PatientStore = PatientStore;

  // ---------------------------------------------------------------- Kayıtlı hastalar (tarayıcıda kalıcı)
  function uuid() {
    try { if (crypto.randomUUID) return crypto.randomUUID(); } catch (e) { /* eski tarayıcı */ }
    return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  const Records = {
    patients: Store.get('patients.saved.v1', []),
    activeID: Store.get('patients.active.v1', null),
    persist() {
      Store.set('patients.saved.v1', this.patients);
      if (this.activeID) Store.set('patients.active.v1', this.activeID); else Store.remove('patients.active.v1');
      AA.emit('records');
    },
    get active() { return this.patients.find(p => p.id === this.activeID) || null; },
    find(id) { return this.patients.find(p => p.id === id) || null; },
    save(name, p) {
      const now = new Date().toISOString();
      const rec = {
        id: uuid(), name, createdAt: now, updatedAt: now,
        weightKg: p.weightKg ?? null, heightCm: p.heightCm ?? null, ageYears: p.ageYears ?? null,
        sex: p.sex || null, entries: []
      };
      this.patients.unshift(rec);
      this.activeID = rec.id;
      this.persist();
      return rec;
    },
    addEntry(patientID, drugName, summary) {
      const rec = this.find(patientID);
      if (!rec) return;
      rec.entries.unshift({ id: uuid(), addedAt: new Date().toISOString(), drugName, summary });
      rec.updatedAt = new Date().toISOString();
      this.persist();
    },
    removeEntry(patientID, entryID) {
      const rec = this.find(patientID);
      if (!rec) return;
      rec.entries = rec.entries.filter(e => e.id !== entryID);
      rec.updatedAt = new Date().toISOString();
      this.persist();
    },
    rename(patientID, name) {
      const rec = this.find(patientID);
      const trimmed = (name || '').trim();
      if (!rec || !trimmed) return;
      rec.name = trimmed;
      rec.updatedAt = new Date().toISOString();
      this.persist();
    },
    remove(patientID) {
      this.patients = this.patients.filter(p => p.id !== patientID);
      if (this.activeID === patientID) this.activeID = null;
      this.persist();
    },
    setActive(id) { this.activeID = id; this.persist(); },
    clearAll() { this.patients = []; this.activeID = null; this.persist(); },
    infoLine(p) {
      const parts = [];
      if (isNum(p.weightKg)) parts.push(Fmt.smart(p.weightKg) + ' kg');
      if (isNum(p.heightCm)) parts.push(Fmt.smart(p.heightCm) + ' cm');
      if (isNum(p.ageYears)) parts.push(Fmt.smart(p.ageYears) + ' ' + T('unit.yearsShort'));
      if (p.sex) parts.push(T('sex.' + p.sex));
      return parts.join(' · ');
    },
    summaryText(p) {
      const lines = [p.name];
      const info = this.infoLine(p);
      if (info) lines.push(info);
      if (p.entries.length) {
        lines.push('');
        lines.push(T('patients.infusionsHeader').toLocaleUpperCase(I18n.locale));
        [...p.entries].sort((a, b) => a.addedAt < b.addedAt ? -1 : 1)
          .forEach(e => lines.push('• ' + e.drugName + ': ' + e.summary));
      }
      lines.push('');
      lines.push('— ' + T('app.name') + ' · ' + Fmt.dateTime(p.updatedAt) + ' · ' + T('share.disclaimer'));
      return lines.join('\n');
    }
  };
  AA.Records = Records;

  /** Hesaplayıcıların son kullanılan ayarlarını saklar (iOS'taki UserDefaults anahtarlarıyla aynı adlar). */
  AA.State = {
    load(key, fallback) { return Store.get('state.' + key, fallback); },
    save(key, value) { Store.set('state.' + key, value); },
    remove(key) { Store.remove('state.' + key); }
  };

  AA.clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
})();
