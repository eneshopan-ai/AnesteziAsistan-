/* Firebase web yapılandırması (isteğe bağlı hesap ve eşitleme).
 * Boş bırakılırsa hesap özelliği tamamen kapalıdır; uygulama eskisi gibi yalnızca yerel çalışır.
 * Bu değerler gizli anahtar değildir (web uygulamasında herkese açıktır); erişimi firestore.rules korur.
 * Doldurma adımları için FIREBASE-KURULUM.md dosyasına bakın. */
window.AA_FIREBASE = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  appId: ''
};
