/* Anestezi Asistanı — uygulama kabuğu: yönlendirme, ekran altyapısı ve genel ekranlar
 * (ana sayfa, kataloglar, ayarlar, hastalar, yasal uyarı, bilgi panelleri). */
(function () {
  'use strict';
  const AA = window.AA;
  const { T, Fmt, UI, Settings, PatientStore, Records } = AA;
  const { esc, icon, card, sectionHeader, badge, metric, tintStyle } = UI;

  const view = document.getElementById('app');
  const backdrop = document.getElementById('backdrop');

  // ================================================================ Tema
  const hostTheme = document.documentElement.getAttribute('data-theme');
  function applyTheme() {
    const root = document.documentElement;
    if (Settings.appearance === 'light' || Settings.appearance === 'dark') root.setAttribute('data-theme', Settings.appearance);
    else if (hostTheme) root.setAttribute('data-theme', hostTheme);
    else root.removeAttribute('data-theme');
  }

  // ================================================================ Hasta kartı (paylaşılan bileşen)
  const PC = { expanded: false };

  function patientSubtitle() {
    const p = PatientStore.profile;
    if (!p) return T('patient.enterWeightHeight');
    const parts = [Fmt.smart(p.totalBodyWeight) + ' kg', Fmt.smart(p.heightCm) + ' cm', T('sex.' + p.sex)];
    if (p.ageYears != null) parts.push(Fmt.smart(p.ageYears) + ' ' + T('unit.yearsShort'));
    return parts.join(' · ');
  }

  function bmiTint(v) { return v < 18.5 ? 'warning' : v < 25 ? 'success' : v < 30 ? 'warning' : 'danger'; }

  function patientMetrics() {
    const p = PatientStore.profile;
    if (!p) return '';
    return '<hr class="divider"><div class="metrics">' +
      metric({ title: T('metric.bmi'), value: Fmt.decimal(p.bmi), unit: 'kg/m²', icon: 'person-standing', tint: bmiTint(p.bmi) }) +
      metric({ title: T('metric.bsa'), value: Fmt.decimal(p.bsaMosteller, 2), unit: 'm²', icon: 'scan', tint: 'secondary' }) +
      metric({ title: T('metric.ibw'), value: Fmt.decimal(p.idealBodyWeight), unit: 'kg', icon: 'target', tint: 'info' }) +
      metric({ title: T('metric.lbw'), value: Fmt.decimal(p.leanBodyWeight), unit: 'kg', icon: 'flame', tint: 'tertiary' }) +
      '</div><div class="footnote">' + icon('info') + '<span>' + esc(T('patient.derivedSummary', {
        category: p.bmiCategory, adjusted: Fmt.decimal(p.adjustedBodyWeight), bsa: Fmt.decimal(p.bsaDuBois, 2) })) + '</span></div>';
  }

  function patientActions() {
    return '<button type="button" class="text-btn" style="--t:var(--textSecondary)" data-act="pc-sample">' + icon('wand-sparkles') + esc(T('patient.sampleAdult')) + '</button>' +
      '<span style="flex:1"></span>' +
      (PatientStore.isComplete ? '<button type="button" class="text-btn" data-act="pc-save">' + icon('user-plus') + esc(T('patient.save')) + '</button>' : '') +
      '<button type="button" class="text-btn" style="--t:var(--textTertiary)" data-act="pc-clear">' + icon('rotate-ccw') + esc(T('common.clear')) + '</button>';
  }

  function patientCard({ derived = true } = {}) {
    const pt = PatientStore.patient;
    const open = PC.expanded || !PatientStore.isComplete;
    const head = sectionHeader({
      title: T('patient.title'), subtitle: patientSubtitle(), subRegion: 'pc-sub', icon: 'id-card', tint: 'accent',
      accessory: '<button type="button" class="text-btn" data-act="pc-toggle">' + esc(open ? T('common.close') : T('common.edit')) +
        icon('chevron-down', '') + '</button>'
    });
    let editor = '';
    if (open) {
      editor = '<div class="fields">' +
        UI.numericField({ bind: 'patient.weightKg', title: T('patient.weight'), unit: 'kg', icon: 'weight', value: pt.weightKg, step: 1, min: 0.5, max: 400 }) +
        UI.numericField({ bind: 'patient.heightCm', title: T('patient.height'), unit: 'cm', icon: 'ruler', value: pt.heightCm, step: 1, min: 30, max: 250, tint: 'secondary' }) +
        UI.numericField({ bind: 'patient.ageYears', title: T('patient.age'), unit: T('unit.years'), icon: 'calendar', value: pt.ageYears, step: 1, min: 0, max: 120, tint: 'tertiary', placeholder: T('common.optional') }) +
        '<div class="nf"><span class="nf-label">' + icon('user') + '<span>' + esc(T('patient.sex')) + '</span></span>' +
        UI.segmented({ act: 'pc-sex', items: [{ value: 'male', label: T('sex.male') }, { value: 'female', label: T('sex.female') }], selected: pt.sex }) + '</div>' +
        '</div><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap" data-region="pc-actions">' + patientActions() + '</div>';
    }
    return card(head + editor + (derived ? '<div data-region="pc-metrics" style="display:flex;flex-direction:column;gap:10px">' + patientMetrics() + '</div>' : ''), { cls: 'patient-card' });
  }
  AA.patientCard = patientCard;

  const GLOBAL_REGIONS = { 'pc-sub': patientSubtitle, 'pc-metrics': patientMetrics, 'pc-actions': patientActions };

  // ================================================================ Ekran altyapısı
  const App = {
    screen: null,
    history: [],

    current() { return (location.hash || '').replace(/^#/, ''); },

    go(route) {
      const target = '#' + route;
      if (location.hash === target) { App.show(route); return; }
      try { location.hash = route; } catch (e) { App.show(route); }
    },

    back() {
      if (App.history.length > 1) { try { history.back(); return; } catch (e) { /* devam */ } }
      App.go('');
    },

    onHashChange() {
      const route = App.current();
      const h = App.history;
      const prev = h.length >= 2 ? h[h.length - 2] : null;
      let restore = null;
      if (prev && prev.route === route) { h.pop(); restore = prev.scroll; }
      else {
        if (h.length) h[h.length - 1].scroll = window.scrollY;
        h.push({ route, scroll: 0 });
      }
      App.show(route, restore);
    },

    show(route, restoreScroll) {
      UI.closeModal();
      if (App.screen && App.screen.destroy) App.screen.destroy();
      App.screen = App.resolve(route);
      App.render();
      window.scrollTo(0, restoreScroll || 0);
    },

    resolve(route) {
      if (!Settings.disclaimerAccepted) return Screens.disclaimer();
      if (!route || route === 'home') return Screens.home();
      if (route === 'anesthesia') return Screens.hub('anesthesia');
      if (route === 'icu') return Screens.hub('icu');
      if (route === 'settings') return Screens.settings();
      if (route === 'patients') return Screens.patients();
      if (route.startsWith('p-')) return Screens.patientDetail(route.slice(2));
      if (route.startsWith('ref-')) return Screens.drugReference(route.slice(4));
      if (route.startsWith('info-')) return Screens.info(route.slice(5));
      if (route.startsWith('c-')) {
        const s = AA.CalcScreens && AA.CalcScreens.make(route.slice(2));
        if (s) return s;
      }
      return Screens.notFound();
    },

    render() {
      const s = App.screen;
      if (!s) return;
      backdrop.style.setProperty('--t', UI.tintVar(s.tint || 'accent'));
      let top = '';
      if (s.title != null) {
        top = '<header class="topbar" id="topbar"><div class="left"><button type="button" class="circle-btn" data-act="back" aria-label="' + esc(T('web.back')) + '">' + icon('chevron-left') + '</button></div>' +
          '<div class="title">' + esc(s.title) + '</div><div class="right">' + (s.topRight ? s.topRight() : '') + '</div></header>';
      }
      view.innerHTML = top + '<main class="page' + (s.wide ? ' wide' : '') + (s.noAnim ? '' : ' appear') + '">' + s.body() + '</main>';
      App.renderSticky();
      if (s.afterRender) s.afterRender(view);
      App.onScroll();
    },

    renderSticky() {
      const s = App.screen;
      let el = document.getElementById('sticky');
      const html = s && s.sticky ? s.sticky() : '';
      if (!html) { if (el) el.remove(); document.body.classList.remove('has-sticky'); return; }
      if (!el) { el = document.createElement('div'); el.id = 'sticky'; document.body.appendChild(el); }
      el.innerHTML = html;
      document.body.classList.add('has-sticky');
    },

    /** Girdi değişince yalnızca sonuç bölgelerini tazeler (odak kaybolmaz). */
    refresh() {
      const s = App.screen;
      if (!s) return;
      view.querySelectorAll('[data-region]').forEach(el => {
        const name = el.getAttribute('data-region');
        const fn = (s.regions && s.regions[name]) || GLOBAL_REGIONS[name];
        if (fn) el.innerHTML = fn();
      });
      App.renderSticky();
    },

    onScroll() {
      const bar = document.getElementById('topbar');
      if (bar) bar.classList.toggle('scrolled', window.scrollY > 4);
    },

    getValue(path) {
      if (path.startsWith('patient.')) return PatientStore.patient[path.slice(8)];
      return App.screen && App.screen.get ? App.screen.get(path) : undefined;
    },

    setValue(path, value, source) {
      if (path.startsWith('patient.')) {
        const key = path.slice(8);
        const changes = {}; changes[key] = value;
        const wasComplete = PatientStore.isComplete;
        Object.assign(PatientStore.patient, changes);
        AA.Session.set('patient.v1', PatientStore.patient);
        // Kart tamamlanınca/eksilince yapı değişir; yazarken odağı korumak için yalnızca tazele.
        if (App.screen && App.screen.onPatientChange) App.screen.onPatientChange(wasComplete !== PatientStore.isComplete, source);
        else App.refresh();
        return;
      }
      const s = App.screen;
      if (!s || !s.set) return;
      const result = s.set(path, value, source);
      if (result === 'render') App.render(); else App.refresh();
    }
  };
  AA.App = App;

  // ---------------------------------------------------------------- Olaylar
  view.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el || !view.contains(el)) return;
    const act = el.getAttribute('data-act');
    switch (act) {
      case 'back': App.back(); return;
      case 'nav': App.go(el.getAttribute('data-to')); return;
      case 'toggle-warn': el.classList.toggle('open'); return;
      case 'step': {
        const bind = el.getAttribute('data-bind');
        const input = view.querySelector('input[data-bind="' + bind + '"]');
        const min = Number(input && input.getAttribute('data-min'));
        const max = Number(input && input.getAttribute('data-max'));
        const base = Number(App.getValue(bind)) || 0;
        const next = Math.round(AA.clamp(base + Number(el.getAttribute('data-delta')), isFinite(min) ? min : -Infinity, isFinite(max) ? max : Infinity) * 100) / 100;
        if (input) input.value = Fmt.input(next);
        App.setValue(bind, next, 'step');
        return;
      }
      case 'pc-toggle': PC.expanded = !(PC.expanded || !PatientStore.isComplete); App.render(); return;
      case 'pc-sex': PatientStore.update({ sex: el.getAttribute('data-value') }); App.render(); return;
      case 'pc-sample': PatientStore.setSample(); PC.expanded = false; App.render(); return;
      case 'pc-clear': PatientStore.reset(); App.render(); return;
      case 'pc-save':
        UI.ask({
          title: T('patients.namePromptTitle'), message: T('patients.savePromptMessage'), placeholder: T('patients.namePlaceholder'),
          onConfirm: name => { Records.save(name, PatientStore.patient); UI.toast(T('patients.added')); App.render(); }
        });
        return;
      default:
        if (App.screen && App.screen.act && App.screen.act[act]) App.screen.act[act](el, e);
    }
  });

  view.addEventListener('input', e => {
    const el = e.target;
    const bind = el.getAttribute && el.getAttribute('data-bind');
    if (!bind) {
      if (el.hasAttribute && el.hasAttribute('data-search') && App.screen && App.screen.onSearch) App.screen.onSearch(el.value);
      return;
    }
    if (el.type === 'checkbox') return;
    if (el.type === 'range') {
      const v = Number(el.value);
      const wrap = el.closest('[data-slider]');
      if (wrap) updateSlider(wrap, el, v);
      App.setValue(bind, v, 'slider');
      return;
    }
    App.setValue(bind, Fmt.parse(el.value), 'typing');
  });

  view.addEventListener('change', e => {
    const el = e.target;
    const bind = el.getAttribute && el.getAttribute('data-bind');
    if (bind && el.type === 'checkbox') App.setValue(bind, el.checked, 'toggle');
  });

  // Sayı alanından çıkınca, aralık dışı değeri değil, ekrandaki değeri düzenli göster.
  view.addEventListener('focusout', e => {
    const el = e.target;
    if (el.tagName === 'INPUT' && el.getAttribute('data-bind') && el.type === 'text') {
      const v = App.getValue(el.getAttribute('data-bind'));
      if (v != null && Fmt.parse(el.value) === v) el.value = Fmt.input(v);
    }
  });

  view.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type === 'text') e.target.blur();
  });

  function updateSlider(wrap, input, v) {
    const min = Number(input.min), max = Number(input.max);
    input.style.setProperty('--p', (AA.clamp((v - min) / ((max - min) || 1), 0, 1) * 100) + '%');
    const lo = Number(wrap.getAttribute('data-rlo')), hi = Number(wrap.getAttribute('data-rhi'));
    const outside = v < lo - 1e-9 || v > hi + 1e-9;
    wrap.classList.toggle('outside', outside);
    wrap.style.setProperty('--st', outside ? 'var(--warning)' : 'var(--t)');
    const val = wrap.querySelector('[data-slider-val]');
    if (val) val.textContent = (wrap._format || Fmt.smart)(v);
    const note = wrap.querySelector('[data-slider-note]');
    if (note) note.textContent = T(outside ? 'slider.outsideRange' : 'slider.insideRange', { min: Fmt.smart(lo), max: Fmt.smart(hi), unit: wrap.getAttribute('data-unit') });
    const ic = wrap.querySelector('.note .icon');
    if (ic) ic.outerHTML = icon(outside ? 'triangle-alert' : 'badge-check');
  }

  window.addEventListener('hashchange', App.onHashChange);
  window.addEventListener('scroll', App.onScroll, { passive: true });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') UI.closeModal(); });

  // ================================================================ Genel ekranlar
  const Screens = {};

  Screens.disclaimer = () => ({
    tint: 'accent', title: null, noAnim: false,
    body() {
      const points = [
        ['stethoscope', 'disclaimer.professionals'], ['sigma', 'disclaimer.data'],
        ['user-check', 'disclaimer.decision'], ['shield-check', 'disclaimer.privacy']];
      return '<div class="disclaimer-wrap"></div><div class="disc-head"><div class="d-ico">' + icon('hospital') + '</div><h1>' + esc(T('app.name')) +
        '</h1><p>' + esc(T('app.tagline')) + '</p></div>' +
        card(points.map(([ic, k]) => '<div class="disc-point">' + icon(ic) + '<div><b>' + esc(T(k + '.title')) + '</b><span>' + esc(T(k + '.body')) + '</span></div></div>').join(''), { pad: 'l' }) +
        '<button type="button" class="btn" data-act="accept">' + icon('circle-check') + esc(T('disclaimer.accept')) + '</button>' +
        '<div class="chips wrap" style="justify-content:center">' + AA.LANGUAGES.map(l =>
          '<button type="button" class="chip' + (AA.I18n.language === l.code ? ' on' : '') + '" data-act="lang" data-value="' + l.code + '">' + l.flag + ' ' + esc(l.name) + '</button>').join('') + '</div>';
    },
    act: {
      accept() { Settings.set('disclaimerAccepted', true); App.show(App.current()); },
      lang(el) { changeLanguage(el.getAttribute('data-value')); }
    }
  });

  Screens.home = () => ({
    tint: 'accent', title: null, wide: true,
    body() {
      const date = Fmt.longDate(new Date());
      const hasPatients = Records.patients.length > 0;
      const module = (key, route, ic, grad, tint, count) =>
        '<button type="button" class="card module" style="' + tintStyle(tint) + '" data-act="nav" data-to="' + route + '">' +
        '<div class="m-top"><div class="m-ico" style="background:' + grad + '">' + icon(ic) + '</div>' +
        badge(T('module.anesthesia.badge', { count }), tint) + '</div>' +
        '<div><h2>' + esc(T('module.' + key + '.title')) + '</h2><p>' + esc(T('module.' + key + '.subtitle')) + '</p></div>' +
        '<div class="tags">' + [1, 2, 3].map(i => '<span>' + esc(T('module.' + key + '.tag' + i)) + '</span>').join('') + '</div>' +
        '<span class="open">' + esc(T('web.open')) + icon('arrow-right') + '</span></button>';
      return '<div class="home-head"><div><div class="date">' + esc(date) + '</div><h1>' + esc(T('app.name')) + '</h1></div>' +
        '<div style="display:flex;gap:8px"><button type="button" class="circle-btn" data-act="nav" data-to="patients" aria-label="' + esc(T('patients.title')) + '">' + icon('users') +
        (hasPatients ? '<span class="dot"></span>' : '') + '</button>' +
        '<button type="button" class="circle-btn" data-act="nav" data-to="settings" aria-label="' + esc(T('settings.title')) + '">' + icon('settings') + '</button></div></div>' +
        patientCard({ derived: true }) +
        '<div style="display:flex;flex-direction:column;gap:16px"><div class="eyebrow">' + esc(T('home.modules')) + '</div><div class="modules">' +
        module('anesthesia', 'anesthesia', 'activity', 'var(--grad-anes)', 'accent', AA.availableCount(AA.ANESTHESIA_CATALOG)) +
        module('icu', 'icu', 'bed-double', 'var(--grad-icu)', 'secondary', AA.availableCount(AA.ICU_CATALOG)) +
        '</div></div>' + UI.footnote(T('home.footer'), 'shield-alert');
    }
  });

  Screens.hub = (which) => {
    const isAnes = which === 'anesthesia';
    const catalog = isAnes ? AA.ANESTHESIA_CATALOG : AA.ICU_CATALOG;
    const order = isAnes ? AA.ANESTHESIA_ORDER : AA.ICU_ORDER;
    const state = { query: '' };
    const groups = () => {
      const q = state.query.trim().toLocaleLowerCase(AA.I18n.locale);
      const text = e => (T('catalog.' + e.id + '.title') + ' ' + T('catalog.' + e.id + '.subtitle') + ' ' + T('catalog.' + e.id + '.keywords')).toLocaleLowerCase(AA.I18n.locale);
      const filtered = q ? catalog.filter(e => text(e).includes(q)) : catalog;
      return order.map(cat => ({ cat, entries: filtered.filter(e => e.category === cat) })).filter(g => g.entries.length);
    };
    const row = e => {
      const ok = !!e.calcId;
      return '<button type="button" class="row' + (ok ? '' : ' planned') + '" style="' + tintStyle(e.tint) + '"' + (ok ? ' data-act="nav" data-to="c-' + e.calcId + '"' : ' disabled') + '>' +
        '<span class="r-ico">' + icon(e.icon) + '</span><span class="r-t"><b>' + esc(T('catalog.' + e.id + '.title')) + '</b><span>' + esc(T('catalog.' + e.id + '.subtitle')) + '</span></span>' +
        (ok ? icon('chevron-right') : badge(T('common.comingSoon'), 'textTertiary')) + '</button>';
    };
    const catalogHTML = () => {
      const gs = groups();
      if (!gs.length) {
        return UI.emptyState({ icon: 'search', title: T('search.emptyTitle'), message: T('search.emptyMessage', { query: state.query }) });
      }
      return gs.map(g => '<div class="cat-group">' + sectionHeader({ title: T('category.' + g.cat), subtitle: T('catalog.toolCount', { count: g.entries.length }), icon: AA.CATEGORY_ICONS[g.cat], tint: 'accent' }) +
        '<div class="cat-grid">' + g.entries.map(row).join('') + '</div></div>').join('');
    };
    return {
      tint: isAnes ? 'accent' : 'secondary', title: T(isAnes ? 'module.anesthesia.title' : 'module.icu.title'), wide: true,
      body() {
        const p = PatientStore.profile;
        const hero = card('<div class="h-top"><div><h1>' + esc(T(isAnes ? 'module.anesthesia.title' : 'module.icu.title')) + '</h1><p>' +
          esc(T(isAnes ? 'module.anesthesia.hero' : 'module.icu.hero')) + '</p></div><span class="h-ico" style="' + tintStyle(isAnes ? 'accent' : 'secondary') + '">' +
          icon(isAnes ? 'activity' : 'bed-double') + '</span></div>' +
          (p ? '<div class="badges">' + badge(Fmt.smart(p.totalBodyWeight) + ' kg') + badge(Fmt.smart(p.heightCm) + ' cm', 'secondary') + badge('BMI ' + Fmt.decimal(p.bmi), 'info') + '</div>'
             : '<div class="noPatient">' + icon('triangle-alert') + esc(T('hub.noPatient')) + '</div>'), { pad: 'l', cls: 'hero' });
        return hero + '<label class="search">' + icon('search') + '<input type="search" data-search placeholder="' + esc(T('search.placeholder')) + '" value="' + esc(state.query) + '" aria-label="' + esc(T('search.placeholder')) + '"></label>' +
          '<div data-region="catalog" style="display:flex;flex-direction:column;gap:22px">' + catalogHTML() + '</div>';
      },
      regions: { catalog: catalogHTML },
      onSearch(q) { state.query = q; App.refresh(); }
    };
  };

  Screens.settings = () => ({
    tint: 'secondary', title: T('settings.title'),
    body() {
      const lang = card(sectionHeader({ title: T('settings.language'), subtitle: T('settings.languageSubtitle'), icon: 'globe' }) +
        '<div style="display:flex;flex-direction:column;gap:8px">' + AA.LANGUAGES.map(l =>
          '<button type="button" class="lang-row' + (AA.I18n.language === l.code ? ' on' : '') + '" data-act="lang" data-value="' + l.code + '"><span class="flag">' + l.flag + '</span><b>' + esc(l.name) + '</b>' +
          (AA.I18n.language === l.code ? icon('circle-check') : '') + '</button>').join('') + '</div>' +
        '<div class="footnote" style="padding:0">' + esc(T('settings.languageNote')) + '</div>');
      const opts = [['system', 'smartphone'], ['light', 'sun'], ['dark', 'moon-star']];
      const appearance = card(sectionHeader({ title: T('settings.appearance'), subtitle: T('settings.appearanceSubtitle'), icon: 'sun-moon', tint: 'tertiary' }) +
        '<div class="app-cards">' + opts.map(([k, ic]) => '<button type="button" class="app-card' + (Settings.appearance === k ? ' on' : '') + '" data-act="appearance" data-value="' + k + '">' + icon(ic) + esc(T('appearance.' + k)) + '</button>').join('') + '</div>');
      const basis = Settings.defaultBasis;
      const defaults = card(sectionHeader({ title: T('settings.defaults'), subtitle: T('settings.defaultsSubtitle'), icon: 'sliders-horizontal' }) +
        '<div style="display:flex;flex-direction:column;gap:8px"><div class="sec-sub" style="font-size:12px;font-weight:600">' + esc(T('settings.defaultDosingWeight')) + '</div>' +
        UI.segmented({ act: 'basis', items: ['total', 'lean', 'ideal', 'adjusted'].map(b => ({ value: b, label: T('basis.' + b + '.abbr') })), selected: basis }) +
        '<div class="sec-sub">' + esc(T('basis.' + basis + '.title') + ' · ' + T('basis.' + basis + '.formula')) + '</div></div><hr class="divider">' +
        '<div style="display:flex;flex-direction:column;gap:8px"><div class="sec-sub" style="font-size:12px;font-weight:600">' + esc(T('settings.dropFactor')) + '</div>' +
        UI.segmented({ act: 'drop', items: AA.DROP_FACTORS.map(f => ({ value: f, label: AA.dropFactorShort(f) })), selected: Settings.dropFactor }) +
        '<div class="sec-sub">' + esc(AA.dropFactorTitle(Settings.dropFactor)) + '</div></div>');
      const display = card(sectionHeader({ title: T('settings.display'), icon: 'sparkles', tint: 'tertiary' }) +
        '<div class="setting"><div><b>' + esc(T('settings.advancedMetrics')) + '</b><span>' + esc(T('settings.advancedMetricsCaption')) + '</span></div>' +
        UI.toggle({ bind: 'advancedMetrics', checked: Settings.advancedMetrics, label: T('settings.advancedMetrics') }) + '</div>');
      const data = card(sectionHeader({ title: T('settings.data'), subtitle: T('settings.dataSubtitle'), icon: 'shield-check', tint: 'info' }) +
        '<button type="button" class="text-btn" style="--t:var(--danger)" data-act="clear-patient">' + icon('x-circle') + esc(T('settings.clearPatient')) + '</button>' +
        '<button type="button" class="text-btn" style="--t:var(--danger)" data-act="clear-saved">' + icon('trash-2') + esc(T('web.clearSaved')) + '</button>' +
        '<div class="footnote" style="padding:0">' + esc(T('web.storageNote')) + '</div>');
      const total = AA.availableCount(AA.ANESTHESIA_CATALOG) + AA.availableCount(AA.ICU_CATALOG);
      const about = card(sectionHeader({ title: T('settings.about'), icon: 'info', tint: 'textSecondary' }) +
        '<div>' + UI.infoRow(T('settings.app'), T('app.name')) + UI.infoRow(T('settings.version'), T('web.version')) +
        UI.infoRow(T('settings.calculatorCount'), String(total)) + '</div><div class="footnote" style="padding:0">' + esc(T('settings.disclaimer')) + '</div>');
      return lang + appearance + defaults + display + data + about;
    },
    set(path, value) { if (path === 'advancedMetrics') Settings.set('advancedMetrics', !!value); return 'render'; },
    act: {
      lang(el) { changeLanguage(el.getAttribute('data-value')); },
      appearance(el) { Settings.set('appearance', el.getAttribute('data-value')); applyTheme(); App.render(); },
      basis(el) { Settings.set('defaultBasis', el.getAttribute('data-value')); App.render(); },
      drop(el) { Settings.set('dropFactor', Number(el.getAttribute('data-value'))); App.render(); },
      'clear-patient'() { PatientStore.reset(); UI.toast(T('common.clear')); },
      'clear-saved'() {
        UI.confirm({ title: T('web.clearSaved'), message: T('web.storageNote'), danger: true, confirm: T('patients.delete'),
          onConfirm: () => {
            Records.clearAll();
            try { Object.keys(localStorage).filter(k => k.startsWith('aa.state.')).forEach(k => localStorage.removeItem(k)); } catch (e) { /* yok say */ }
            UI.toast(T('web.clearSavedDone')); App.render();
          } });
      }
    }
  });

  Screens.patients = () => ({
    tint: 'accent', title: T('patients.title'),
    body() {
      if (!Records.patients.length) return UI.emptyState({ icon: 'id-card', title: T('patients.emptyTitle'), message: T('patients.emptyMessage') });
      return '<div style="display:flex;flex-direction:column;gap:10px">' + Records.patients.map(p =>
        '<button type="button" class="row" style="' + tintStyle('accent') + '" data-act="nav" data-to="p-' + esc(p.id) + '"><span class="r-ico">' + icon('user') + '</span>' +
        '<span class="r-t"><b>' + esc(p.name) + (p.id === Records.activeID ? ' ' + badge(T('patients.active'), 'success', { upper: false }) : '') + '</b>' +
        '<span>' + esc(Records.infoLine(p) || T('patients.noInfo')) + '</span><span>' + esc(T('patients.entryCount', { count: p.entries.length })) + '</span></span>' + icon('chevron-right') + '</button>').join('') + '</div>';
    }
  });

  Screens.patientDetail = (id) => ({
    tint: 'accent',
    get title() { const p = Records.find(id); return p ? p.name : T('patients.title'); },
    topRight() {
      const p = Records.find(id);
      if (!p) return '';
      return '<button type="button" class="circle-btn" data-act="rename" aria-label="' + esc(T('patients.rename')) + '">' + icon('pencil') + '</button>' +
        (p.id !== Records.activeID ? '<button type="button" class="circle-btn" data-act="activate" aria-label="' + esc(T('patients.makeActive')) + '">' + icon('circle-check') + '</button>' : '') +
        '<button type="button" class="circle-btn tinted" style="--t:var(--danger)" data-act="delete" aria-label="' + esc(T('patients.delete')) + '">' + icon('trash-2') + '</button>';
    },
    body() {
      const p = Records.find(id);
      if (!p) return UI.emptyState({ icon: 'x-circle', title: T('patients.deletedTitle'), message: T('patients.deletedMessage'), tint: 'warning' });
      const head = card(sectionHeader({ title: p.name, subtitle: Records.infoLine(p) || T('patients.noInfo'), icon: 'user',
        accessory: p.id === Records.activeID ? badge(T('patients.active'), 'success', { upper: false }) : '' }) +
        '<div class="sec-sub">' + esc(T('patients.updatedAt', { date: Fmt.dateTime(p.updatedAt) })) + '</div>');
      const entries = [...p.entries].sort((a, b) => a.addedAt < b.addedAt ? 1 : -1);
      const list = card(sectionHeader({ title: T('patients.infusionsHeader'), subtitle: T('patients.entryCount', { count: p.entries.length }), icon: 'syringe' }) +
        (entries.length ? entries.map(e => '<div class="panel" style="flex-direction:row;align-items:flex-start;gap:10px"><div style="flex:1;min-width:0"><b class="num" style="font-size:13.5px">' + esc(e.drugName) +
          '</b><div style="font-size:12.5px;color:var(--textSecondary)">' + esc(e.summary) + '</div><div class="sec-sub">' + esc(Fmt.dateTime(e.addedAt)) + '</div></div>' +
          '<button type="button" class="circle-btn" style="width:32px;height:32px" data-act="remove-entry" data-value="' + esc(e.id) + '" aria-label="' + esc(T('patients.delete')) + '">' + icon('x') + '</button></div>').join('')
          : '<p class="sec-sub" style="margin:0">' + esc(T('patients.noEntries')) + '</p>'));
      const actions = '<div class="actions"><button type="button" class="btn" data-act="copy-all">' + icon('copy') + esc(T('patients.copyAll')) + '</button>' +
        '<button type="button" class="btn" style="--t:var(--secondary)" data-act="share-all">' + icon('share') + esc(T('common.share')) + '</button></div>';
      return head + list + actions;
    },
    act: {
      rename() { const p = Records.find(id); UI.ask({ title: T('patients.renamePromptTitle'), placeholder: T('patients.namePlaceholder'), value: p.name, onConfirm: n => { Records.rename(id, n); App.render(); } }); },
      activate() { Records.setActive(id); App.render(); },
      delete() { UI.confirm({ title: T('patients.deleteConfirmTitle'), message: T('patients.deleteConfirmMessage'), confirm: T('patients.delete'), danger: true, onConfirm: () => { Records.remove(id); App.back(); } }); },
      'remove-entry'(el) { Records.removeEntry(id, el.getAttribute('data-value')); App.render(); },
      'copy-all'() { const p = Records.find(id); UI.copy(Records.summaryText(p)); },
      'share-all'() { const p = Records.find(id); UI.share(Records.summaryText(p)); }
    }
  });

  /** İlaç bilgi kartı (iOS DrugReferenceView). */
  Screens.drugReference = (drugId) => {
    const drug = AA.makeDrug(drugId);
    if (!drug) return Screens.notFound();
    const ref = drug.reference;
    const rows = (title, ic, list, tint) => card(sectionHeader({ title, icon: ic, tint }) +
      '<dl class="kv">' + list.filter(r => r.length >= 2).map(r => '<dt>' + esc(r[0]) + '</dt><dd>' + UI.rich(r[1]) + '</dd>').join('') + '</dl>');
    const bulletCard = (title, ic, items, tint) => items && items.length ? card(sectionHeader({ title, icon: ic, tint }) + UI.bullets(items, tint, true)) : '';
    return {
      tint: drug.tint, title: T('ref.navTitle', { drug: drug.name }),
      body() {
        return card('<div><h1 class="sec-title" style="font-size:22px;font-weight:900">' + esc(drug.genericName) + '</h1><p class="sec-sub" style="font-size:12px">' + esc(drug.tagline) +
          '</p></div><div class="badges">' + drug.badges.map(b => badge(b, drug.tint, { upper: false })).join('') + '</div>', { pad: 'l' }) +
          rows(T('ref.pharmacology'), 'flask-conical', ref.pharmacology, drug.tint) +
          rows(T('ref.doses'), 'chart-bar', ref.doses, 'secondary') +
          bulletCard(T('ref.adverse'), 'triangle-alert', ref.adverseEffects, 'warning') +
          bulletCard(T('ref.contraindications'), 'octagon-alert', ref.contraindications, 'danger') +
          card(sectionHeader({ title: T('ref.preparation'), icon: 'flask-conical', tint: 'info' }) +
            drug.presets.map(p => '<div class="inforow" style="justify-content:flex-start"><b class="num" style="color:var(--info);min-width:72px">' + esc(p.title) + '</b><span style="font-size:12px;color:var(--textSecondary)">' + esc(p.subtitle) + '</span></div>').join('') +
            '<p class="sec-sub" style="margin:0;font-size:11.5px">' + UI.rich(ref.preparationNote) + '</p>') +
          card(sectionHeader({ title: T('ref.incompatibilities'), subtitle: T('ref.incompatibilitiesSubtitle'), icon: 'x-circle', tint: 'danger' }) +
            '<div class="flow-chips" style="--t:var(--danger)">' + ref.incompatibilities.map(x => '<span>' + esc(x) + '</span>').join('') + '</div>' +
            (ref.incompatibilityNote ? '<p class="sec-sub" style="margin:0;font-size:11.5px;color:var(--textSecondary)">' + UI.rich(ref.incompatibilityNote) + '</p>' : '')) +
          bulletCard(T('ref.tips'), 'sparkles', ref.practicalTips, 'success') +
          card(sectionHeader({ title: T('ref.monitoring'), subtitle: T('ref.monitoringSubtitle'), icon: 'monitor-dot', tint: drug.tint }) +
            drug.indications.map(ind => '<div style="display:flex;flex-direction:column;gap:6px"><b style="font-family:var(--font);font-size:13px">' + esc(ind.title) + '</b><div class="flow-chips" style="' + tintStyle(drug.tint) + '">' +
              ind.monitoring.map(m => '<span>' + esc(m) + '</span>').join('') + '</div></div>').join('')) +
          UI.footnote(T('ref.disclaimer'));
      }
    };
  };

  /** Skor bilgi paneli (iOS ScoreInfoSheet). İçerik AA.infoFor(calcId) ile hesaplayıcı modülünden gelir. */
  Screens.info = (calcId) => {
    const info = AA.infoFor ? AA.infoFor(calcId) : null;
    if (!info) return Screens.notFound();
    return {
      tint: info.tint, title: T('info.title'),
      body() {
        const head = card('<div class="drug-head" style="' + tintStyle(info.tint) + '"><div class="d-ico">' + icon(info.icon) + '</div><div><h1>' + esc(info.title) + '</h1><p>' + esc(info.subtitle) + '</p></div></div>', { pad: 'l' });
        const about = card(sectionHeader({ title: T('info.what'), icon: 'book-text', tint: info.tint }) + '<p class="ref-text" style="margin:0">' + UI.rich(info.about) + '</p>');
        const bands = info.bands && info.bands.length ? card(sectionHeader({ title: T('info.interpretation'), subtitle: T('info.interpretationSubtitle'), icon: 'chart-column', tint: info.tint }) +
          info.bands.map(b => '<div class="band-row" style="' + tintStyle(b.tint) + '"><span class="rng">' + esc(b.range) + '</span><div class="bt"><b>' + esc(b.title) + '</b><span>' + UI.rich(b.detail) + '</span></div></div>').join('')) : '';
        const examples = info.examples && info.examples.length ? card(sectionHeader({ title: info.examplesTitle || '', icon: 'search', tint: info.tint }) +
          info.examples.map(x => '<div class="panel"><div style="display:flex;gap:8px;align-items:baseline"><span class="badge upper" style="' + tintStyle(x.tint) + '">' + esc(x.range) + '</span><b style="font-family:var(--font);font-size:12.5px">' + esc(x.title) + '</b></div><span style="font-size:11.5px;color:var(--textSecondary)">' + UI.rich(x.detail) + '</span></div>').join('')) : '';
        const notes = info.notes && info.notes.length ? card(sectionHeader({ title: T('info.limits'), icon: 'triangle-alert', tint: 'warning' }) + UI.bullets(info.notes, 'warning', true)) : '';
        const ref = card(sectionHeader({ title: T('info.source'), icon: 'book-open', tint: info.tint }) + '<p class="ref-text" style="margin:0">' + UI.rich(info.reference) + '</p>' + (info.refsHTML || '') +
          '<div class="footnote" style="padding:0">' + esc(T('info.disclaimer')) + '</div>');
        return head + about + bands + examples + notes + ref;
      }
    };
  };

  Screens.notFound = () => ({
    tint: 'warning', title: T('calc.notFoundTitle'),
    body() { return UI.emptyState({ icon: 'search', title: T('calc.notFoundTitle'), message: T('calc.notFoundMessage'), tint: 'warning' }); }
  });

  AA.Screens = Screens;

  // ================================================================ Dil değişimi ve başlatma
  async function changeLanguage(code) {
    try {
      await AA.I18n.load(code);
      Settings.set('language', code);
      // Ekran başlıkları ve ilaç metinleri dile bağlı olduğundan ekran yeniden kurulur.
      const y = window.scrollY;
      App.screen = App.resolve(App.current());
      App.render();
      window.scrollTo(0, y);
    } catch (e) {
      UI.toast(T('web.loadError'));
    }
  }
  AA.changeLanguage = changeLanguage;

  async function start() {
    applyTheme();
    if (window.matchMedia) {
      try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (Settings.appearance === 'system') applyTheme(); }); } catch (e) { /* eski tarayıcı */ }
    }
    try {
      await AA.I18n.load(Settings.language || AA.I18n.systemDefault());
    } catch (e) {
      view.innerHTML = '<div class="loading">Language files could not be loaded / Dil dosyaları yüklenemedi.</div>';
      return;
    }
    App.history = [{ route: App.current(), scroll: 0 }];
    App.show(App.current());
  }
  start();
})();
