#!/bin/sh
# Kullanım: ./bump-build.sh  (js/ veya i18n/ değiştirildikten sonra, commit'ten önce çalıştırın)
# Sürüm etiketini yeniler: index.html içindeki AA_BUILD / ?v= değerleri ve version.json birlikte güncellenir.
set -e
cd "$(dirname "$0")"
OLD=$(sed -n 's/.*"build":"\([^"]*\)".*/\1/p' version.json)
NEW=$(cat js/*.js i18n/*.json | sha1sum | cut -c1-10)
if [ "$OLD" = "$NEW" ]; then echo "Sürüm değişmedi: $NEW"; exit 0; fi
sed -i "s/$OLD/$NEW/g" index.html
printf '{"build":"%s"}\n' "$NEW" > version.json
echo "Sürüm: $OLD -> $NEW"
