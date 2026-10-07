# Hesap ve eşitleme kurulumu (Firebase)

Uygulamadaki hesap özelliği `js/firebase-config.js` boş olduğu sürece kapalıdır. Aşağıdaki adımlar tamamlanıp dosya doldurulunca Ayarlar ekranında "Hesap ve eşitleme" kartı belirir.

## Ne eşitlenir, ne eşitlenmez

| Eşitlenir | Yalnızca cihazda kalır |
|---|---|
| Ayarlar (dil, görünüm, varsayılan dozlama ağırlığı, damla faktörü) | Hasta kartı |
| İnfüzyon ve vazoaktif hesaplayıcıların doz / konsantrasyon tercihleri | Kayıtlı hastalar |
| | Kan gazı, sıvı, kan kaybı, havayolu, sepsis, elektrolit hesaplayıcılarının girdileri |
| | Yasal uyarı onayı (her cihazda ayrıca verilir) |

Bulutta tutulan tek kayıt `users/{uid}/data/prefs` belgesidir. Firestore kuralları (`firestore.rules`) kullanıcının yalnızca kendi belgesine, e-postası doğrulanmışsa erişmesine izin verir.

## Kurulum adımları (Firebase konsolu)

1. https://console.firebase.google.com adresinde **Proje ekle** deyin. Ad: `anestezi-asistani`. Google Analytics'i kapatabilirsiniz.
2. **Build › Authentication › Get started › Sign-in method**: **Email/Password** ve **Google** yöntemlerini etkinleştirin (Google için destek e-postası seçin).
3. **Authentication › Settings › Authorized domains**: `eneshopan-ai.github.io` listede yoksa ekleyin.
4. **Build › Firestore Database › Create database**: **Production mode**, konum olarak Avrupa'daki bir bölge (ör. `eur3` ya da `europe-west3`) seçin. Konum sonradan değiştirilemez.
5. Firestore **Rules** sekmesine bu depodaki `firestore.rules` dosyasının içeriğini yapıştırıp **Publish** deyin.
6. **Project settings (dişli) › Your apps › Web (`</>`)** ile bir web uygulaması kaydedin. Çıkan `firebaseConfig` içindeki `apiKey`, `authDomain`, `projectId`, `appId` değerlerini `js/firebase-config.js` dosyasına yazın. Bu değerler gizli değildir; erişimi güvenlik kuralları korur.
7. İsteğe bağlı: **Authentication › Templates** bölümünde doğrulama ve şifre sıfırlama e-postalarının dilini Türkçe yapın.
8. `./bump-build.sh` çalıştırıp commit'leyin ve `main`'e gönderin.

Bu kullanım düzeyi için ücretsiz Spark planı yeterlidir.

## Notlar

- Ana ekrana eklenmiş uygulamada (iPhone) Google ile giriş açılır pencere yerine yönlendirmeyle çalışabilir ve bazı cihazlarda sorun çıkarabilir. Bu durumda e-posta ve şifre ile giriş kullanılabilir. Gerçek cihazda denenmelidir.
- E-posta ile kayıt olan kullanıcı, gelen bağlantıyla adresini doğrulayana kadar eşitleme yapamaz.
- Kullanıcı Ayarlar'dan hesabını ve bulut verisini kendisi silebilir.
- Kişisel veri (e-posta adresi) işlendiği için kurumunuzun KVKK sorumlusuyla aydınlatma metni konusunu gözden geçirmeniz önerilir.
