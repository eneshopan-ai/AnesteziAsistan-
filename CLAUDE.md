# Anestezi Asistanı — proje notları

Anestezi ve yoğun bakım doz hesaplayıcıları. Derleme gerektirmeyen statik web uygulaması (HTML, CSS, vanilla JS), hash yönlendirmeli. GitHub Pages'te yayında: https://eneshopan-ai.github.io/AnesteziAsistan-/

Sahibi: Enes (anestezi ve yoğun bakım hekimi, Trabzon). Yanıtlar Türkçe verilir. Tıbbi içerik yalnızca gerçek, doğrulanabilir akademik kaynaklara (textbook, hakemli makale) dayanır; kaynak uydurulmaz, bulunamayan kaynak "bulunamadı" diye belirtilir.

## Yapı

- `index.html` — giriş, `window.AA_BUILD`, sürüm denetleyici betik
- `js/data.js` — ilaç/endikasyon tanımları, uyarı kuralları (ör. PRIS)
- `js/engines.js` — infüzyon hesap motoru (`makeDrug`, birim dönüşümleri)
- `js/screens-calc.js` — hesaplayıcı ekranı, formül gösterimi, kayıtlı durum
- `js/screens-emergency.js` — acil durum hesaplayıcıları (lokal anestezik maks. doz, LAST lipid, dantrolen, pediatrik acil) ve kaynakça (`REFS`, `CALC_REFS`: DOI/PMID bağlantıları)
- `i18n/tr.json`, `en-US.json`, `en-GB.json` — metinler (minify yazılır, `ensure_ascii=False`)
- `version.json`, `bump-build.sh` — sürüm etiketi

## Birim kuralları

- Doz birimleri: `DOSE_UNITS.mgPerKgPerHour`, `DOSE_UNITS.mcgPerKgPerMinute`. Konsantrasyon: `mgPerMl` / `mcgPerMl`.
- Propofol idame: **mcg/kg/dk**, önerilen aralık 50–200 (tipik 100), konsantrasyon mg/mL, yükleme dozu mg/kg kalır.
- Formül (mcg doz, mg/mL konsantrasyon): mL/sa = (doz × kg × 60 ÷ 1000) ÷ konsantrasyon. Örnek: 70 kg × 100 mcg/kg/dk, 10 mg/mL → 42 mL/sa.
- PRIS uyarısı 4 mg/kg/sa (≈ 67 mcg/kg/dk) üzerinde tetiklenir.
- Hesaplayıcı durumu `infusion.state.<drugId>.v<stateVersion>` anahtarıyla saklanır; bir ilacın birimi/aralığı değişirse `stateVersion` artırılır (eski kayıtlı durum geçersiz olur).

## Kaynakça kuralı

- Kaynakçaya yalnızca DOI/PMID'si doğrulanmış kayıt eklenir; doğrulanamayan tanımlayıcı alanı boş bırakılır (bağlantı üretilmez). `REFS` kaydına `doi` ve/veya `pmid` yazılır, hesaplayıcı `CALC_REFS` ile eşlenir.

## Güncelleme akışı

1. `js/` veya `i18n/` değiştir.
2. Commit'ten önce `./bump-build.sh` çalıştır (`index.html` içindeki `AA_BUILD` / `?v=` değerleri ve `version.json` birlikte güncellenir).
3. Commit ve `main`'e push; Pages birkaç dakikada yayınlar.

Uygulama açılırken ve arka plandan dönerken `version.json`'a bakar; yeni sürüm varsa sayfayı kendiliğinden yeniler (iPhone ana ekran kısayolu önbelleği için). Metin değişikliklerinde üç dil dosyasını birlikte güncelle.

## Dikkat

- Claude.ai'daki artifact kopyasının `index.html` ve `core.js` dosyaları bu depodakilerden farklıdır; depoya kopyalanmaz. Artifact'tan yalnızca değişen `js/` ve `i18n/` dosyaları taşınır.
- Commit mesajı sonuna şu satırlar eklenir:
  `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_0159eYqn5fs7mzR1zxG8Fiw8`
