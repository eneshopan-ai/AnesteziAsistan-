/* Anestezi Asistanı — isteğe bağlı hesap ve eşitleme (Firebase Authentication + Firestore).
 *
 * Kapsam (bilinçli olarak dar):
 *   - Eşitlenir: ayarlar (yasal uyarı onayı hariç) ve infüzyon / vazoaktif hesaplayıcıların
 *     doz-konsantrasyon tercihleri.
 *   - Eşitlenmez: hasta kartı, kayıtlı hastalar, kan gazı / sıvı / havayolu / sepsis /
 *     elektrolit gibi hastaya özgü değer içeren hesaplayıcı durumları. Bunlar yalnızca cihazda kalır.
 * js/firebase-config.js boşsa bu modül hiçbir şey yapmaz ve arayüzde görünmez. */
(function () {
  'use strict';
  const AA = window.AA;
  const { Store, UI } = AA;
  const { esc, icon } = UI;
  const cfg = window.AA_FIREBASE || {};
  const enabled = !!(cfg.apiKey && cfg.authDomain && cfg.projectId && cfg.appId);
  const SDK = 'https://www.gstatic.com/firebasejs/10.14.1/';

  // ---------------------------------------------------------------- Metinler
  const TX = {
    tr: {
      title: 'Hesap ve eşitleme',
      subtitle: 'İsteğe bağlı · ayarlarınızı cihazlar arasında eşitler',
      desc: 'Giriş yaparsanız yalnızca ayarlarınız ve hesaplayıcı tercihleriniz (doz, konsantrasyon gibi) hesabınıza kaydedilir. Hasta kartı ve kayıtlı hastalar buluta gönderilmez; yalnızca bu cihazda kalır.',
      open: 'Giriş yap / Hesap oluştur',
      email: 'E-posta', status: 'Durum',
      loading: 'Oturum kontrol ediliyor…', offline: 'Bağlantı yok — oturum denetlenemedi',
      syncing: 'Eşitleniyor…', ok: 'Eşitlendi · {time}', error: 'Eşitlenemedi', unverified: 'E-posta doğrulaması bekleniyor',
      conflict: 'Seçiminiz bekleniyor',
      syncNow: 'Şimdi eşitle', signOut: 'Çıkış yap', deleteAcct: 'Hesabı ve bulut verilerini sil',
      unverifiedMsg: 'Doğrulama bağlantısı {email} adresine gönderildi. Bağlantıya tıkladıktan sonra "Doğruladım" düğmesine basın. Doğrulanana kadar eşitleme yapılmaz.',
      resend: 'Bağlantıyı tekrar gönder', verified: 'Doğruladım', resent: 'Doğrulama e-postası gönderildi', notYet: 'E-posta henüz doğrulanmamış',
      retry: 'Tekrar dene',
      authTitle: 'Hesabınıza giriş yapın',
      authDesc: 'Ayarlarınız ve hesaplayıcı tercihleriniz Google Firebase üzerinde, hesabınıza bağlı olarak saklanır. Hasta bilgisi gönderilmez.',
      google: 'Google ile devam et', or: 'veya',
      emailPh: 'E-posta', pwPh: 'Şifre (en az 6 karakter)',
      signin: 'Giriş yap', signup: 'Hesap oluştur', forgot: 'Şifremi unuttum', close: 'Kapat',
      resetSent: 'Şifre sıfırlama bağlantısı gönderildi', needEmail: 'E-posta adresini yazın', needPw: 'Şifreyi yazın',
      signedIn: 'Giriş yapıldı', signedOut: 'Çıkış yapıldı',
      confTitle: 'Hangi veriler kullanılsın?',
      confBody: 'Hesabınızdaki ayarlar bu cihazdakilerden farklı. Seçmediğiniz taraf üzerine yazılır.',
      confLocal: 'Bu cihazdakileri kullan', confRemote: 'Hesaptakileri kullan', later: 'Daha sonra',
      delTitle: 'Hesap silinsin mi?',
      delBody: 'Hesabınız ve buluttaki ayarlarınız kalıcı olarak silinir. Bu cihazdaki veriler silinmez.',
      delDone: 'Hesap silindi',
      delRecent: 'Güvenlik için çıkış yapıp yeniden giriş yaparak tekrar deneyin.',
      eCred: 'E-posta veya şifre hatalı', eExists: 'Bu e-posta ile zaten bir hesap var', eWeak: 'Şifre en az 6 karakter olmalı',
      eEmail: 'E-posta adresi geçersiz', eMany: 'Çok fazla deneme. Biraz bekleyip tekrar deneyin', eNet: 'Bağlantı hatası. İnternetinizi kontrol edin',
      eDomain: 'Bu alan adı Firebase\'de yetkilendirilmemiş (Authentication › Settings › Authorized domains)',
      ePerm: 'Erişim reddedildi. E-postanızı doğruladığınızdan emin olun', eMethod: 'Bu giriş yöntemi Firebase\'de etkin değil',
      eGeneric: 'İşlem tamamlanamadı ({code})',
      pTitle: 'Hasta verisi sunucuya gitmez',
      pBody: 'Hasta kartına girdiğiniz bilgiler yalnızca bu sekme açıkken tutulur. "Hastayı kaydet" ile kaydettiğiniz hastalar yalnızca bu tarayıcının yerel deposunda saklanır ve hiçbir sunucuya gönderilmez. İsteğe bağlı hesap açarsanız yalnızca ayarlarınız ve hesaplayıcı tercihleriniz (doz, konsantrasyon gibi) hesabınıza eşitlenir.',
      pSub: 'Hasta kartı sekme kapanınca silinir; kayıtlı hastalar yalnızca bu tarayıcıda durur',
      pNote: 'Kayıtlı hastalar yalnızca bu tarayıcıda tutulur. Hesap açtıysanız yalnızca ayarlarınız ve hesaplayıcı tercihleriniz buluta eşitlenir.'
    },
    en: {
      title: 'Account & sync',
      subtitle: 'Optional · syncs your settings across devices',
      desc: 'If you sign in, only your settings and calculator preferences (such as dose and concentration) are saved to your account. The patient card and saved patients are never sent to the cloud; they stay on this device.',
      open: 'Sign in / Create account',
      email: 'Email', status: 'Status',
      loading: 'Checking session…', offline: 'Offline — could not check the session',
      syncing: 'Syncing…', ok: 'Synced · {time}', error: 'Sync failed', unverified: 'Waiting for email verification',
      conflict: 'Waiting for your choice',
      syncNow: 'Sync now', signOut: 'Sign out', deleteAcct: 'Delete account and cloud data',
      unverifiedMsg: 'A verification link was sent to {email}. After opening it, tap "I verified". Nothing is synced until the address is verified.',
      resend: 'Resend link', verified: 'I verified', resent: 'Verification email sent', notYet: 'Email is not verified yet',
      retry: 'Try again',
      authTitle: 'Sign in to your account',
      authDesc: 'Your settings and calculator preferences are stored with Google Firebase, linked to your account. No patient information is sent.',
      google: 'Continue with Google', or: 'or',
      emailPh: 'Email', pwPh: 'Password (at least 6 characters)',
      signin: 'Sign in', signup: 'Create account', forgot: 'Forgot password', close: 'Close',
      resetSent: 'Password reset link sent', needEmail: 'Enter your email address', needPw: 'Enter your password',
      signedIn: 'Signed in', signedOut: 'Signed out',
      confTitle: 'Which data should be used?',
      confBody: 'The settings in your account differ from the ones on this device. The side you do not choose is overwritten.',
      confLocal: 'Use this device', confRemote: 'Use my account', later: 'Later',
      delTitle: 'Delete account?',
      delBody: 'Your account and the settings stored in the cloud are permanently deleted. Data on this device is kept.',
      delDone: 'Account deleted',
      delRecent: 'For security, sign out, sign in again and retry.',
      eCred: 'Wrong email or password', eExists: 'An account with this email already exists', eWeak: 'Password must be at least 6 characters',
      eEmail: 'Invalid email address', eMany: 'Too many attempts. Wait a moment and try again', eNet: 'Network error. Check your connection',
      eDomain: 'This domain is not authorized in Firebase (Authentication › Settings › Authorized domains)',
      ePerm: 'Access denied. Make sure your email is verified', eMethod: 'This sign-in method is not enabled in Firebase',
      eGeneric: 'Could not complete the action ({code})',
      pTitle: 'Patient data never leaves the device',
      pBody: 'Details entered on the patient card are kept only while this tab is open. Patients you explicitly save with "Save patient" are stored only in this browser’s local storage and are never sent to a server. If you create an optional account, only your settings and calculator preferences (such as dose and concentration) are synced to it.',
      pSub: 'The patient card clears when the tab closes; saved patients stay in this browser only',
      pNote: 'Saved patients are kept only in this browser. If you have an account, only your settings and calculator preferences are synced to the cloud.'
    }
  };
  const L = () => (AA.I18n && AA.I18n.language === 'tr' ? 'tr' : 'en');
  const tx = (k, p) => {
    let s = TX[L()][k];
    if (s == null) s = TX.en[k] != null ? TX.en[k] : k;
    if (p) for (const n of Object.keys(p)) s = s.split('{' + n + '}').join(p[n]);
    return s;
  };

  const Account = { available: enabled, user: null, status: 'out', lastSync: Store.get('sync.last', null), acts: {}, card() { return ''; } };
  AA.Account = Account;
  if (!enabled) return;

  // Gizlilik metinleri: hesap özelliği etkinse gerçeği doğru yansıtsın.
  const webOverride = { 'disclaimer.privacy.title': 'pTitle', 'disclaimer.privacy.body': 'pBody', 'settings.dataSubtitle': 'pSub', 'web.storageNote': 'pNote' };
  const origWeb = AA.I18n.web.bind(AA.I18n);
  AA.I18n.web = key => (webOverride[key] ? tx(webOverride[key]) : origWeb(key));

  // ---------------------------------------------------------------- Eşitlenecek anahtarlar
  const isSynced = key => key === 'settings.v1' || key.indexOf('state.infusion.') === 0 || key.indexOf('state.vasoactive.') === 0;
  function stateKeys() {
    const out = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf('aa.') === 0) { const key = k.slice(3); if (key !== 'settings.v1' && isSynced(key)) out.push(key); }
      }
    } catch (e) { /* yok say */ }
    return out.sort();
  }
  function collect() {
    const settings = JSON.parse(JSON.stringify(Store.get('settings.v1', {})));
    delete settings.disclaimerAccepted; // yasal uyarı onayı her cihazda ayrıca verilir
    const state = {};
    stateKeys().forEach(k => { try { state[k] = localStorage.getItem('aa.' + k); } catch (e) { /* yok say */ } });
    return { settings, stateJson: JSON.stringify(state) };
  }
  const stable = o => JSON.stringify(Object.keys(o || {}).sort().map(k => [k, o[k]]));
  const sameContent = (a, b) => stable(a.settings) === stable(b.settings) && a.stateJson === (b.stateJson || '{}');

  // Yerel değişiklikleri izle (yalnızca eşitlenen anahtarlar).
  let applying = false;
  let timer = null;
  const origSet = Store.set.bind(Store), origRemove = Store.remove.bind(Store);
  function touched(key) {
    if (applying || !isSynced(key)) return;
    origSet('sync.localAt', Date.now());
    if (Account.user && Account.user.emailVerified) { clearTimeout(timer); timer = setTimeout(() => syncNow(), 2000); }
  }
  Store.set = (k, v) => { origSet(k, v); touched(k); };
  Store.remove = k => { origRemove(k); touched(k); };

  // ---------------------------------------------------------------- Firebase SDK (gerektiğinde yüklenir)
  let sdkPromise = null;
  function sdk() {
    if (!sdkPromise) {
      sdkPromise = Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-firestore.js')])
        .then(([app, auth, fs]) => {
          const fb = app.initializeApp(cfg);
          return { auth, fs, a: auth.getAuth(fb), db: fs.getFirestore(fb) };
        })
        .catch(e => { sdkPromise = null; throw e; });
    }
    return sdkPromise;
  }
  let attached = false;
  async function attach() {
    if (attached) return;
    attached = true;
    try {
      const S = await sdk();
      S.auth.onAuthStateChanged(S.a, onUser);
    } catch (e) { attached = false; throw e; }
  }

  function refresh() {
    try { if (AA.App && AA.App.screen && AA.App.current() === 'settings') AA.App.render(); } catch (e) { /* yok say */ }
  }

  // ---------------------------------------------------------------- Oturum durumu
  async function onUser(user) {
    Account.user = user;
    if (!user) { Account.status = 'out'; origRemove('sync.hint'); refresh(); return; }
    origSet('sync.hint', true);
    if (Store.get('sync.uid', null) !== user.uid) { origSet('sync.uid', user.uid); origSet('sync.baseAt', 0); }
    if (!user.emailVerified) { Account.status = 'unverified'; refresh(); return; }
    await syncNow();
  }

  // ---------------------------------------------------------------- Eşitleme
  let busy = false;
  const docRef = S => S.fs.doc(S.db, 'users', Account.user.uid, 'data', 'prefs');
  function markSynced(at) { origSet('sync.baseAt', at); origSet('sync.localAt', at); }

  async function push(S, ref, local) {
    const at = Date.now();
    await S.fs.setDoc(ref, { v: 1, clientUpdatedAt: at, settings: local.settings, stateJson: local.stateJson });
    markSynced(at);
  }

  function applyRemote(remote) {
    applying = true;
    try {
      const cur = Store.get('settings.v1', {});
      const next = Object.assign({}, remote.settings || {});
      next.disclaimerAccepted = !!cur.disclaimerAccepted;
      origSet('settings.v1', next);
      stateKeys().forEach(k => origRemove(k));
      let st = {};
      try { st = JSON.parse(remote.stateJson || '{}'); } catch (e) { st = {}; }
      Object.keys(st).forEach(k => {
        if (!isSynced(k) || k === 'settings.v1' || typeof st[k] !== 'string' || st[k].length > 100000) return;
        try { JSON.parse(st[k]); localStorage.setItem('aa.' + k, st[k]); } catch (e) { /* bozuk kaydı atla */ }
      });
      markSynced(remote.clientUpdatedAt || Date.now());
    } finally { applying = false; }
    location.reload();
  }

  function conflictDialog(S, ref, remote) {
    Account.status = 'conflict';
    const m = UI.modal('<h3>' + esc(tx('confTitle')) + '</h3><p>' + esc(tx('confBody')) + '</p>' +
      '<div class="m-actions" style="flex-direction:column">' +
      '<button class="btn" data-c="local">' + esc(tx('confLocal')) + '</button>' +
      '<button class="btn" data-c="remote">' + esc(tx('confRemote')) + '</button>' +
      '<button class="btn ghost" data-act="modal-close">' + esc(tx('later')) + '</button></div>');
    m.querySelector('[data-c="local"]').addEventListener('click', async () => {
      UI.closeModal();
      try { await push(S, ref, collect()); Account.status = 'ok'; Account.lastSync = Date.now(); origSet('sync.last', Account.lastSync); }
      catch (e) { Account.status = 'error'; UI.toast(errText(e)); }
      refresh();
    });
    m.querySelector('[data-c="remote"]').addEventListener('click', () => { UI.closeModal(); applyRemote(remote); });
  }

  async function syncNow() {
    if (!Account.user || !Account.user.emailVerified || busy) return;
    busy = true;
    Account.status = 'syncing';
    refresh();
    try {
      const S = await sdk();
      const ref = docRef(S);
      const snap = await S.fs.getDoc(ref);
      const local = collect();
      const dirty = Store.get('sync.localAt', 0) > Store.get('sync.baseAt', 0);
      if (!snap.exists()) {
        await push(S, ref, local);
      } else {
        const remote = snap.data();
        if (sameContent(local, remote)) markSynced(remote.clientUpdatedAt || Date.now());
        else if (remote.clientUpdatedAt === Store.get('sync.baseAt', 0)) { if (dirty) await push(S, ref, local); }
        else if (!dirty) { applyRemote(remote); return; }
        else { conflictDialog(S, ref, remote); return; }
      }
      Account.status = 'ok';
      Account.lastSync = Date.now();
      origSet('sync.last', Account.lastSync);
    } catch (e) {
      Account.status = 'error';
      Account.message = errText(e);
    } finally {
      busy = false;
      refresh();
    }
  }

  let lastAuto = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !Account.user || !Account.user.emailVerified) return;
    if (Date.now() - lastAuto < 60000) return;
    lastAuto = Date.now();
    syncNow();
  });

  // ---------------------------------------------------------------- Hatalar
  function errText(e) {
    const c = (e && e.code) || '';
    if (c === 'auth/invalid-credential' || c === 'auth/wrong-password' || c === 'auth/user-not-found' || c === 'auth/invalid-login-credentials') return tx('eCred');
    if (c === 'auth/email-already-in-use') return tx('eExists');
    if (c === 'auth/weak-password') return tx('eWeak');
    if (c === 'auth/invalid-email' || c === 'auth/missing-email') return tx('eEmail');
    if (c === 'auth/too-many-requests') return tx('eMany');
    if (c === 'auth/network-request-failed' || c === 'unavailable') return tx('eNet');
    if (c === 'auth/unauthorized-domain') return tx('eDomain');
    if (c === 'auth/operation-not-allowed' || c === 'auth/configuration-not-found') return tx('eMethod');
    if (c === 'permission-denied') return tx('ePerm');
    return tx('eGeneric', { code: c || (e && e.message) || '?' });
  }

  // ---------------------------------------------------------------- Giriş kipi
  function openAuth() {
    attach().catch(() => {});
    const m = UI.modal('<h3>' + esc(tx('authTitle')) + '</h3><p>' + esc(tx('authDesc')) + '</p>' +
      '<button class="btn" data-a="google">' + icon('user-check') + '<span>' + esc(tx('google')) + '</span></button>' +
      '<div style="text-align:center;font-size:12px;color:var(--textTertiary)">' + esc(tx('or')) + '</div>' +
      '<input class="text-input" type="email" inputmode="email" autocomplete="email" autocapitalize="none" autocorrect="off" data-f="email" placeholder="' + esc(tx('emailPh')) + '">' +
      '<input class="text-input" type="password" autocomplete="current-password" data-f="pw" placeholder="' + esc(tx('pwPh')) + '">' +
      '<p data-msg role="alert" style="color:var(--danger);min-height:1em"></p>' +
      '<div class="m-actions"><button class="btn" data-a="signin">' + esc(tx('signin')) + '</button>' +
      '<button class="btn ghost" data-a="signup">' + esc(tx('signup')) + '</button></div>' +
      '<div class="m-actions" style="justify-content:space-between"><button class="text-btn" data-a="reset">' + esc(tx('forgot')) + '</button>' +
      '<button class="text-btn" data-act="modal-close">' + esc(tx('close')) + '</button></div>');
    const msg = m.querySelector('[data-msg]');
    const email = m.querySelector('[data-f="email"]'), pw = m.querySelector('[data-f="pw"]');
    const buttons = m.querySelectorAll('[data-a]');
    const setBusy = b => buttons.forEach(x => { x.disabled = b; });
    const say = (t, ok) => { msg.textContent = t || ''; msg.style.color = ok ? 'var(--success)' : 'var(--danger)'; };

    async function run(fn, after) {
      say('');
      setBusy(true);
      try { await attach(); const S = await sdk(); await fn(S); if (after) after(); }
      catch (e) {
        if (e && (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request')) { if (!Account.user) origRemove('sync.hint'); }
        else say(errText(e));
      }
      setBusy(false);
    }
    const creds = () => {
      const e = email.value.trim(), p = pw.value;
      if (!e) { say(tx('needEmail')); email.focus(); return null; }
      return { e, p };
    };
    const done = () => { UI.closeModal(); UI.toast(tx('signedIn')); };

    m.querySelector('[data-a="google"]').addEventListener('click', () => run(async S => {
      const provider = new S.auth.GoogleAuthProvider();
      origSet('sync.hint', true);
      try { await S.auth.signInWithPopup(S.a, provider); }
      catch (e) {
        // Ana ekran kısayolu gibi açılır pencerenin engellendiği ortamlarda yönlendirmeye geç.
        if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) { await S.auth.signInWithRedirect(S.a, provider); return; }
        throw e;
      }
    }, done));
    m.querySelector('[data-a="signin"]').addEventListener('click', () => {
      const c = creds(); if (!c) return;
      if (!c.p) { say(tx('needPw')); pw.focus(); return; }
      run(S => S.auth.signInWithEmailAndPassword(S.a, c.e, c.p), done);
    });
    m.querySelector('[data-a="signup"]').addEventListener('click', () => {
      const c = creds(); if (!c) return;
      if (!c.p) { say(tx('needPw')); pw.focus(); return; }
      run(async S => {
        const cred = await S.auth.createUserWithEmailAndPassword(S.a, c.e, c.p);
        try { await S.auth.sendEmailVerification(cred.user); } catch (e) { /* kullanıcı sonra tekrar gönderebilir */ }
      }, () => { UI.closeModal(); UI.toast(tx('resent')); });
    });
    m.querySelector('[data-a="reset"]').addEventListener('click', () => {
      const c = creds(); if (!c) return;
      run(S => S.auth.sendPasswordResetEmail(S.a, c.e), () => say(tx('resetSent'), true));
    });
    pw.addEventListener('keydown', e => { if (e.key === 'Enter') m.querySelector('[data-a="signin"]').click(); });
  }

  // ---------------------------------------------------------------- Ayarlar ekranı kartı
  function statusText() {
    switch (Account.status) {
      case 'ok': return tx('ok', { time: Account.lastSync ? AA.Fmt.dateTime(new Date(Account.lastSync).toISOString()) : '' });
      case 'error': return Account.message ? tx('error') + ' — ' + Account.message : tx('error');
      default: return tx(Account.status);
    }
  }

  Account.card = function () {
    const { card, sectionHeader, infoRow } = UI;
    const head = sectionHeader({ title: tx('title'), subtitle: tx('subtitle'), icon: 'shield-check', tint: 'info' });
    let body;
    if (Account.status === 'loading') {
      body = '<div class="sec-sub" style="padding:0">' + esc(tx('loading')) + '</div>';
    } else if (Account.status === 'offline') {
      body = '<div class="sec-sub" style="padding:0">' + esc(tx('offline')) + '</div>' +
        '<button type="button" class="btn ghost" data-act="acct-retry"><span>' + esc(tx('retry')) + '</span></button>';
    } else if (!Account.user) {
      body = '<div class="sec-sub" style="padding:0">' + esc(tx('desc')) + '</div>' +
        '<button type="button" class="btn" data-act="acct-open">' + icon('user-check') + '<span>' + esc(tx('open')) + '</span></button>';
    } else {
      body = infoRow(tx('email'), Account.user.email || '—') + infoRow(tx('status'), statusText());
      if (Account.status === 'unverified') {
        body += '<div class="sec-sub" style="padding:0">' + esc(tx('unverifiedMsg', { email: Account.user.email || '' })) + '</div>' +
          '<button type="button" class="btn" data-act="acct-verified">' + esc(tx('verified')) + '</button>' +
          '<button type="button" class="text-btn" data-act="acct-resend">' + esc(tx('resend')) + '</button>';
      } else {
        body += '<button type="button" class="btn ghost" data-act="acct-sync"><span>' + esc(tx('syncNow')) + '</span></button>';
      }
      body += '<button type="button" class="text-btn" data-act="acct-out">' + esc(tx('signOut')) + '</button>' +
        '<button type="button" class="text-btn" style="--t:var(--danger)" data-act="acct-delete">' + icon('trash-2') + esc(tx('deleteAcct')) + '</button>';
    }
    return card(head + '<div style="display:flex;flex-direction:column;gap:10px">' + body + '</div>');
  };

  Account.acts = {
    'acct-open'() { openAuth(); },
    'acct-retry'() { Account.status = 'loading'; refresh(); attach().catch(() => { Account.status = 'offline'; refresh(); }); },
    'acct-sync'() { lastAuto = Date.now(); syncNow(); },
    async 'acct-out'() {
      try { const S = await sdk(); await S.auth.signOut(S.a); UI.toast(tx('signedOut')); } catch (e) { UI.toast(errText(e)); }
    },
    async 'acct-resend'() {
      try { const S = await sdk(); await S.auth.sendEmailVerification(S.a.currentUser); UI.toast(tx('resent')); } catch (e) { UI.toast(errText(e)); }
    },
    async 'acct-verified'() {
      try {
        const S = await sdk();
        await S.a.currentUser.reload();
        await S.a.currentUser.getIdToken(true); // e-posta doğrulama bilgisi yeni belirteçle gelir
        if (S.a.currentUser.emailVerified) { Account.user = S.a.currentUser; await syncNow(); }
        else UI.toast(tx('notYet'));
      } catch (e) { UI.toast(errText(e)); }
    },
    'acct-delete'() {
      UI.confirm({ title: tx('delTitle'), message: tx('delBody'), danger: true, confirm: tx('deleteAcct'), onConfirm: async () => {
        try {
          const S = await sdk();
          const user = S.a.currentUser;
          if (user.emailVerified) await S.fs.deleteDoc(docRef(S));
          await S.auth.deleteUser(user);
          ['sync.hint', 'sync.uid', 'sync.baseAt', 'sync.localAt', 'sync.last'].forEach(origRemove);
          UI.toast(tx('delDone'));
        } catch (e) {
          UI.toast(e && e.code === 'auth/requires-recent-login' ? tx('delRecent') : errText(e));
        }
      } });
    }
  };

  // ---------------------------------------------------------------- Başlangıç
  if (Store.get('sync.hint', false)) {
    Account.status = 'loading';
    attach().catch(() => { Account.status = 'offline'; refresh(); });
  }
})();
