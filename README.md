# Anestezi Asistanı

Ameliyathane ve yoğun bakımda kullanılan infüzyon doz hesaplayıcılarını, havayolu ve yoğun bakım skorlarını, sıvı–elektrolit araçlarını ve kan gazı çözümlemesini bir araya getiren web uygulaması.

**Adres:** https://eneshopan-ai.github.io/AnesteziAsistan-/

## Önemli uyarı

Bu uygulama eğitim ve araştırma amacıyla hazırlanmıştır; onaylı bir tıbbi cihaz değildir ve klinik değerlendirmenin yerini almaz. Hesaplamalar yayımlanmış kaynaklara dayanır. Her hesaplayıcının kaynakçası uygulama içindeki bilgi ekranında yer alır. Doz ve tedavi kararları, hastanın klinik durumu, kurum protokolleri ve güncel kılavuzlar gözetilerek hekim tarafından verilmelidir.

## Gizlilik

Girilen hasta bilgileri hiçbir sunucuya gönderilmez. Ayarlar ve kaydedilen hastalar yalnızca kullanılan tarayıcıda saklanır.

## Teknik bilgi

Uygulama derleme gerektirmeyen HTML, CSS ve JavaScript dosyalarından oluşur. Arayüz dilleri: Türkçe, İngilizce (ABD) ve İngilizce (Birleşik Krallık).

## Güncelleme

`js/` veya `i18n/` dosyaları değiştirildiğinde commit'ten önce `./bump-build.sh` çalıştırılır; `index.html` ve `version.json` içindeki sürüm etiketi birlikte yenilenir. Uygulama açılırken ve arka plandan dönerken `version.json`'a bakar, yeni sürüm varsa sayfayı kendiliğinden yeniler. Bu sayede iPhone ana ekranına eklenen kısayol da eski dosyalarda kalmaz.
