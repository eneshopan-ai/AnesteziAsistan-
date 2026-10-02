/* Anestezi Asistanı — arayüz bileşenleri (iOS DesignSystem karşılığı).
 * Bileşenler HTML metni üretir; olaylar ekran düzeyinde `data-act` öznitelikleriyle yakalanır. */
(function () {
  'use strict';
  const AA = window.AA;
  const { T, Fmt } = AA;

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  /** **kalın** biçimini destekleyen güvenli metin. */
  const rich = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const tintVar = t => t ? (t.startsWith('var(') ? t : 'var(--' + t + ')') : 'var(--accent)';
  const tintStyle = t => '--t:' + tintVar(t) + ';';

  function icon(name, extra = '') {
    const body = (window.AA_ICONS || {})[name] || (window.AA_ICONS || {}).info || '';
    return '<svg class="icon ' + extra + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
  }

  const UI = {
    esc, rich, icon, tintVar, tintStyle,

    card(inner, opts = {}) {
      const cls = ['card', opts.pad === 'l' ? 'pad-l' : '', opts.tinted ? 'tinted' : '', opts.cls || ''].join(' ');
      return '<section class="' + cls + '" style="' + (opts.tint ? tintStyle(opts.tint) : '') + (opts.style || '') + '"' +
        (opts.id ? ' id="' + opts.id + '"' : '') + (opts.region ? ' data-region="' + opts.region + '"' : '') + '>' + inner + '</section>';
    },

    sectionHeader({ title, subtitle, icon: ic, tint = 'accent', accessory = '', subRegion = '' }) {
      const sub = subRegion
        ? '<div class="sec-sub" data-region="' + subRegion + '">' + esc(subtitle || '') + '</div>'
        : (subtitle ? '<div class="sec-sub">' + esc(subtitle) + '</div>' : '');
      return '<div class="sec-head" style="' + tintStyle(tint) + '"><div class="sec-ico">' + icon(ic || 'info') + '</div>' +
        '<div class="sec-text"><div class="sec-title">' + esc(title) + '</div>' + sub + '</div>' + accessory + '</div>';
    },

    badge(text, tint = 'accent', opts = {}) {
      return '<span class="badge' + (opts.upper === false ? '' : ' upper') + (opts.filled ? ' filled' : '') + '" style="' + tintStyle(tint) + '">' + esc(text) + '</span>';
    },

    metric({ title, value, unit, icon: ic, tint = 'accent', emphasized = false }) {
      return '<div class="metric' + (emphasized ? ' emph' : '') + '" style="' + tintStyle(tint) + '">' +
        '<div class="m-title">' + (ic ? icon(ic) : '') + '<span>' + esc(title) + '</span></div>' +
        '<div class="m-val"><b>' + esc(value) + '</b>' + (unit ? '<span>' + esc(unit) + '</span>' : '') + '</div></div>';
    },

    infoRow(label, value, opts = {}) {
      return '<div class="inforow"><div class="l">' + esc(label) + (opts.caption ? '<small>' + esc(opts.caption) + '</small>' : '') +
        '</div><div class="v" style="' + (opts.tint ? '--vt:' + tintVar(opts.tint) : '') + '">' + esc(value) + '</div></div>';
    },

    bigResult({ label, value, unit, caption, tint = 'accent' }) {
      return '<div class="big-result" style="' + tintStyle(tint) + '"><div class="lbl">' + esc(label) + '</div>' +
        '<div class="val"><b>' + esc(value) + '</b><span>' + esc(unit) + '</span></div>' +
        (caption ? '<div class="cap">' + esc(caption) + '</div>' : '') + '</div>';
    },

    /** Sayı girişi. `bind` ekranın durum yoludur. */
    numericField({ bind, title, unit = '', icon: ic, value, step = 1, min = 0, max = 100000, tint = 'accent', placeholder = '—', hint = '', compact = false }) {
      return '<label class="nf' + (compact ? ' compact' : '') + '" style="' + tintStyle(tint) + '">' +
        '<span class="nf-label">' + (ic ? icon(ic) : '') + '<span>' + esc(title) + '</span>' + (hint ? '<span class="hint">' + esc(hint) + '</span>' : '') + '</span>' +
        '<span class="nf-row"><input type="text" inputmode="decimal" autocomplete="off" enterkeyhint="done" data-bind="' + esc(bind) + '" ' +
        'data-min="' + min + '" data-max="' + max + '" value="' + esc(Fmt.input(value)) + '" placeholder="' + esc(placeholder) + '" aria-label="' + esc(title) + '">' +
        (unit ? '<span class="unit">' + esc(unit) + '</span>' : '') +
        '<span class="steps"><button type="button" class="step-btn" data-act="step" data-bind="' + esc(bind) + '" data-delta="' + (-step) + '" aria-label="−">' + icon('minus') + '</button>' +
        '<button type="button" class="step-btn" data-act="step" data-bind="' + esc(bind) + '" data-delta="' + step + '" aria-label="+">' + icon('plus') + '</button></span>' +
        '</span></label>';
    },

    /** Çip satırı: items = [{value, label, sub}] */
    chips({ act, items, selected, tint = 'accent', wrap = false, extra = '' }) {
      return '<div class="chips' + (wrap ? ' wrap' : '') + '" style="' + tintStyle(tint) + '">' + items.map(it =>
        '<button type="button" class="chip' + (String(it.value) === String(selected) ? ' on' : '') + '" data-act="' + act + '" data-value="' + esc(it.value) + '"' + extra + '>' +
        (it.icon ? icon(it.icon) : '') + '<span>' + esc(it.label) + '</span>' + (it.sub ? '<small>' + esc(it.sub) + '</small>' : '') + '</button>').join('') + '</div>';
    },

    segmented({ act, items, selected }) {
      return '<div class="seg" role="tablist">' + items.map(it =>
        '<button type="button" role="tab" aria-selected="' + (String(it.value) === String(selected)) + '" class="' + (String(it.value) === String(selected) ? 'on' : '') +
        '" data-act="' + act + '" data-value="' + esc(it.value) + '">' + esc(it.label) + '</button>').join('') + '</div>';
    },

    /** Önerilen aralık bandı ve anlık değeriyle doz kaydırıcısı. */
    doseSlider({ bind, title, unit, value, min, max, step, recLo, recHi, tint = 'accent', format = Fmt.smart }) {
      const span = max - min || 1;
      const p = AA.clamp((value - min) / span, 0, 1) * 100;
      const bandL = AA.clamp((recLo - min) / span, 0, 1) * 100;
      const bandW = AA.clamp((recHi - recLo) / span, 0, 1) * 100;
      const outside = value < recLo - 1e-9 || value > recHi + 1e-9;
      const note = T(outside ? 'slider.outsideRange' : 'slider.insideRange', { min: Fmt.smart(recLo), max: Fmt.smart(recHi), unit });
      return '<div class="slider' + (outside ? ' outside' : '') + '" style="' + tintStyle(tint) + '--st:' + (outside ? 'var(--warning)' : tintVar(tint)) + ';" data-slider="' + esc(bind) + '" data-rlo="' + recLo + '" data-rhi="' + recHi + '" data-unit="' + esc(unit) + '">' +
        '<div class="s-head"><span class="l">' + esc(title) + '</span><span class="v"><b data-slider-val>' + esc(format(value)) + '</b><span>' + esc(unit) + '</span></span></div>' +
        '<div class="track-wrap"><span class="band" style="left:' + bandL + '%;width:' + bandW + '%"></span>' +
        '<input type="range" data-bind="' + esc(bind) + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '" style="--p:' + p + '%" aria-label="' + esc(title) + '"></div>' +
        '<div class="ends"><span>' + esc(Fmt.smart(min)) + '</span><span>' + esc(Fmt.smart(max)) + '</span></div>' +
        '<div class="note">' + icon(outside ? 'triangle-alert' : 'badge-check') + '<span data-slider-note>' + esc(note) + '</span></div></div>';
    },

    toggle({ bind, checked, tint = 'accent', label = '' }) {
      return '<span class="switch" style="' + tintStyle(tint) + '"><input type="checkbox" role="switch" data-bind="' + esc(bind) + '"' + (checked ? ' checked' : '') +
        ' aria-label="' + esc(label) + '"><span></span></span>';
    },

    warningRow(w) {
      const map = [['info', 'info'], ['caution', 'triangle-alert'], ['critical', 'octagon-alert']];
      const tint = ['info', 'warning', 'danger'][w.severity] || 'info';
      return '<button type="button" class="warn" data-act="toggle-warn" style="' + tintStyle(tint) + '" aria-label="' + esc(T('severity.' + map[w.severity][0])) + '">' +
        icon(map[w.severity][1]) + '<span class="wt"><b><span>' + esc(w.title) + '</span>' + icon('chevron-down') + '</b><p>' + rich(w.message) + '</p></span></button>';
    },

    warningsCard(warnings) {
      return UI.card(UI.sectionHeader({ title: T('calc.checklist'), subtitle: T('calc.noteCount', { count: warnings.length }), icon: 'shield-alert', tint: 'warning' }) +
        '<div style="display:flex;flex-direction:column;gap:8px">' + warnings.map(UI.warningRow).join('') + '</div>');
    },

    emptyState({ icon: ic, title, message, tint = 'accent', action = '' }) {
      return UI.card('<div class="e-ico">' + icon(ic) + '</div><h3>' + esc(title) + '</h3><p>' + esc(message) + '</p>' + action,
        { cls: 'empty', tint, pad: 'l' });
    },

    footnote(text, ic = 'info') {
      return '<div class="footnote">' + icon(ic) + '<span>' + esc(text) + '</span></div>';
    },

    bullets(items, tint = 'accent', strong = false) {
      return '<ul class="bullets' + (strong ? ' strong' : '') + '" style="' + tintStyle(tint) + '">' + items.map(s => '<li><span>' + rich(s) + '</span></li>').join('') + '</ul>';
    },

    formula(desc, sub, tint = 'accent') {
      return '<div class="formula" style="' + tintStyle(tint) + '"><div class="f-l">' + esc(T('result.formula')) + '</div>' +
        '<code>' + esc(desc) + '</code>' + (sub ? '<code class="sub">' + esc(sub) + '</code>' : '') + '</div>';
    },

    /** İnfüzyon sonucunun dairesel göstergesi (RateGauge). */
    gauge({ rate, progress, inRange, secondary, caption }) {
      const tint = inRange ? 'var(--accent)' : 'var(--warning)';
      const r = 110, c = 2 * Math.PI * r;
      const arc = c * 0.75, fill = arc * AA.clamp(progress, 0, 1);
      const gid = 'gg' + Math.random().toString(36).slice(2, 8);
      return '<div class="gauge" style="--gt:' + tint + '"><svg viewBox="0 0 236 236" aria-hidden="true">' +
        '<defs><linearGradient id="' + gid + '" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="' + tint + '" stop-opacity=".55"/><stop offset=".6" stop-color="' + tint + '"/><stop offset="1" stop-color="var(--secondary)"/></linearGradient></defs>' +
        '<circle cx="118" cy="118" r="' + r + '" fill="none" stroke="var(--fill-medium)" stroke-width="16"/>' +
        '<circle cx="118" cy="118" r="' + r + '" fill="none" stroke="var(--fill-subtle)" stroke-width="16" stroke-linecap="round" stroke-dasharray="' + arc + ' ' + c + '" transform="rotate(135 118 118)"/>' +
        '<circle cx="118" cy="118" r="' + r + '" fill="none" stroke="url(#' + gid + ')" stroke-width="16" stroke-linecap="round" stroke-dasharray="' + fill + ' ' + c + '" transform="rotate(135 118 118)" style="filter:drop-shadow(0 0 8px ' + tint + ')"/>' +
        '</svg><div class="g-in"><div class="g-l">' + esc(T('gauge.infusionRate')) + '</div>' +
        '<div class="g-v"><b>' + esc(Fmt.smart(rate)) + '</b><span>' + esc(T('unit.mlPerHour')) + '</span></div>' +
        '<div class="g-s">' + esc(secondary) + '</div><div class="g-c">' + esc(caption) + '</div></div></div>';
    },

    // ------------------------------------------------------------ Kipler (modal), bildirim, pano
    modal(html, { onClose } = {}) {
      UI.closeModal();
      const back = document.createElement('div');
      back.className = 'modal-back';
      back.innerHTML = '<div class="modal" role="dialog" aria-modal="true">' + html + '</div>';
      back.addEventListener('click', e => {
        if (e.target === back || e.target.closest('[data-act="modal-close"]')) { UI.closeModal(); if (onClose) onClose(); }
      });
      document.body.appendChild(back);
      UI._modal = back;
      const first = back.querySelector('input, button');
      if (first) setTimeout(() => first.focus(), 30);
      return back.querySelector('.modal');
    },
    closeModal() { if (UI._modal) { UI._modal.remove(); UI._modal = null; } },

    toast(text) {
      document.querySelectorAll('.toast').forEach(t => t.remove());
      const el = document.createElement('div');
      el.className = 'toast';
      el.setAttribute('role', 'status');
      el.textContent = text;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 2200);
    },

    async copy(text, preEl) {
      try {
        await navigator.clipboard.writeText(text);
        UI.toast(T('web.copied'));
        return true;
      } catch (e) {
        if (preEl) {
          const range = document.createRange();
          range.selectNodeContents(preEl);
          const sel = window.getSelection();
          sel.removeAllRanges(); sel.addRange(range);
        }
        UI.toast(T('web.copyFailed'));
        return false;
      }
    },

    /** "Paylaş" — web'de paylaşım menüsü yok; metni gösterip panoya kopyalama sunar. */
    share(text) {
      const m = UI.modal('<h3>' + esc(T('common.share')) + '</h3><pre data-share>' + esc(text) + '</pre>' +
        '<div class="m-actions"><button class="btn" data-act="do-copy">' + icon('copy') + esc(T('web.copy')) + '</button>' +
        '<button class="btn ghost" data-act="modal-close">' + esc(T('common.close')) + '</button></div>');
      m.querySelector('[data-act="do-copy"]').addEventListener('click', () => UI.copy(text, m.querySelector('[data-share]')));
    },

    /** Metin isteyen kip (prompt yerine). */
    ask({ title, message, placeholder = '', value = '', confirm, onConfirm }) {
      const m = UI.modal('<h3>' + esc(title) + '</h3>' + (message ? '<p>' + esc(message) + '</p>' : '') +
        '<input class="text-input" type="text" data-ask value="' + esc(value) + '" placeholder="' + esc(placeholder) + '" autocapitalize="words">' +
        '<div class="m-actions"><button class="btn ghost" data-act="modal-close">' + esc(T('common.cancel')) + '</button>' +
        '<button class="btn" data-act="ask-ok">' + esc(confirm || T('common.save')) + '</button></div>');
      const input = m.querySelector('[data-ask]');
      const ok = () => { const v = input.value.trim(); if (!v) { input.focus(); return; } UI.closeModal(); onConfirm(v); };
      m.querySelector('[data-act="ask-ok"]').addEventListener('click', ok);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
      setTimeout(() => input.focus(), 40);
    },

    /** Onay kipi (confirm() yerine). */
    confirm({ title, message, confirm, danger = false, onConfirm }) {
      const m = UI.modal('<h3>' + esc(title) + '</h3>' + (message ? '<p>' + esc(message) + '</p>' : '') +
        '<div class="m-actions"><button class="btn ghost" data-act="modal-close">' + esc(T('common.cancel')) + '</button>' +
        '<button class="btn' + (danger ? ' danger' : '') + '" data-act="confirm-ok">' + esc(confirm || T('web.confirm')) + '</button></div>');
      m.querySelector('[data-act="confirm-ok"]').addEventListener('click', () => { UI.closeModal(); onConfirm(); });
    }
  };

  /** "Bu hastaya ekle" düğmesi ve davranışı (iOS AddToPatientButton). */
  UI.addToPatientButton = (tint = 'accent') =>
    '<button type="button" class="btn" style="' + tintStyle(tint) + '" data-act="add-to-patient">' + icon('user-plus') + '<span>' + esc(T('patients.addToPatient')) + '</span></button>';

  UI.addToPatient = (drugName, summary, button) => {
    const R = AA.Records;
    const done = () => {
      if (button) {
        button.classList.add('ok');
        const span = button.querySelector('span');
        const old = span ? span.textContent : '';
        if (span) span.textContent = T('patients.added');
        setTimeout(() => { button.classList.remove('ok'); if (span) span.textContent = old; }, 1600);
      }
      UI.toast(T('patients.added'));
    };
    const active = R.active;
    if (active) { R.addEntry(active.id, drugName, summary); done(); return; }
    UI.ask({
      title: T('patients.namePromptTitle'), message: T('patients.namePromptMessage'),
      placeholder: T('patients.namePlaceholder'), confirm: T('patients.createAndAdd'),
      onConfirm: name => { const rec = R.save(name, AA.PatientStore.patient); R.addEntry(rec.id, drugName, summary); done(); }
    });
  };

  AA.UI = UI;
})();
