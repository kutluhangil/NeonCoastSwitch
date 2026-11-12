# Neon Coast Switch — Uygulama Planı

Material Studies No. 066 · WebGL2 + Web Audio · tek dosya, kütüphanesiz, İngilizce arayüz.
Kaynak: `docs/material-studies-prompts.md` ilk bölümü (satır 1–155). Durum: **Faz 0–10 uygulandı** (2026-11-12); 12 test yeşil, ses dengesi ölçüldü.

## 1. Ne yapılıyor

Yatay, hap biçimli büyük bir anahtar. İçinde 176×50 piksellik bir sahil kasabası: solda plaj, sağa doğru bulvar (CORAL oteli, MART dükkânı, diner, SUNSET kulübü), önde iki şeritli sahil yolu. Topuz, havacı gözlüğü camı gibi amber bir kapsül.

Topuzun konumu tek bir şeyi sürer: **saat (18:30 → 23:30)**. Ondan türeyenler:

| Topuz | Gökyüzü / ortam | Sokak | Müzik katmanı |
|---|---|---|---|
| sol | altın saat | her şey kapalı | sahil sesi |
| orta | magenta alacakaranlık | topuzun solunda ışıklar yanmış | pad + arp, sonra davul + bas |
| sağ | gece, ay, yıldız | tüm sokak yanık, neon, polis, helikopter, soygun | lead, sonra FM çan + tom + crash |

Belgedeki diğer ~55 prompt (Daybreak Switch, jelly serisi vb.) **kapsam dışı**. Yalnız Daybreak Switch (No. 062) sayfa düzeni için referans alınır, çünkü Neon Coast metni düzeni tarif etmiyor: küçük üst yazı, italik serif başlık, tek satır açıklama, ortada büyük anahtar, altında göstergeler, ipucu satırı, Sound düğmesi.

## 2. Nasıl çalışacak

### Kare başına boru hattı

```
girdi → simülasyon (sabit 1/60 sn) → CPU boyama → CPU ışık → 2 doku → tek fragment shader
```

1. **Boyama.** İki tampon: `albedo` (renk) ve `emission` (ışıma), 176×50. Her şekil bir maske olarak damgalanır; damga otomatik koyu kontur, açık üst satır, koyu alt satır ekler. Bir piksel boyanınca o pikselin ışıması silinir; böylece öndeki nesne arkadaki ışığı kapatır.
2. **Işık.** Piksel başına `albedo × (ortam + ışıklar) + ışıma + hale`. Işık şiddeti 4×4 Bayer eşiğiyle birkaç banda indirilir (piksel sanat görünümü buradan gelir). İki çıktı üretilir:
   - **Ray dokusu:** ışıklar yalnız topuzun solunda açık, kenar Bayer ile çözülür, topuzun arkasında parlak titrek bir kenar izi.
   - **Tam aydınlık doku:** her şey açık; yalnız camın içinde görünür.
   8.800 piksel × 2, CPU için önemsiz.
3. **Cam.** Tüm tuvali kaplayan tek WebGL2 fragment shader. Hap ve kapsül SDF ile çizilir: yumuşak gölge, kalıplanmış çerçeve (gündüz krem, gece koyu mor), `NEAREST` örneklenen sahne. Kapsülün içinde tam aydınlık doku 0,78 ölçekle örneklenir, kenarda R/G/B ayrı kırılır, Fresnel kenar, tabanda odaklanan ışık, iki parlama, üstü koyu amber gradyan. Örnekleme merkezi biraz aşağı kaydırılır ki araba tam görünsün.

> Yorum: "magnifies (0.78)" = UV ölçeği 0,78, yani ≈1,28× büyütme (Daybreak'teki "~1.28×" ile aynı sayı).

### Simülasyon

- **Topuz:** yay ile parmağı izler, hıza göre uzar, ivmeyle beslenen sönümlü yayla sallanır.
- **Araba:** ikinci bir yayla topuzu izler (yakın şerit). Hız → mph göstergesi, teker dönüşü, egzoz, hız çizgileri, fren lambası, sert yön değişiminde lastik dumanı.
- **Durum makineleri:** trafik havuzu, polis takibi, helikopter, soygun (5 aşama), 13 dokunma etkileşimi, boşta kalma. Her biri saf fonksiyon + küçük durum; test edilebilir.
- **Olay yolu:** simülasyon sesi doğrudan çağırmaz, olay yayar (`coconut:drop`, `shot:fired`). Ses ve görsel efekt buna abone olur. Ses katmanı bu sayede sonradan, sahneye dokunmadan eklenir.
- **Vuruş saati:** ses açıkken `AudioContext` zamanından, kapalıyken sayfa zamanından. SUNSET harf kovalaması, köpeğin kapıya vurması ve kedinin baş sallaması buna bağlı.

### Ses

İlk dokunuşta başlar. `müzik veri yolu (−5 dB) + efekt veri yolu → kompresör → çıkış`, yanında üretilmiş dürtü yanıtlı reverb ve noktalı sekizlik eko (100 BPM'de 0,45 sn). 16'lık ızgarada ileri bakan zamanlayıcı, 4 ölçü Am · F · C · G. Katman kazançları topuz konumuna bağlı. Takip ve soygunda bas 16'lığa çıkar, akor vuruşları eklenir. Silah seslerinde müzik kısılır. Sürekli sesler (motor, siren, pervane) konuma göre kaydırılır.

### Taslak yerleşim (Faz 1'de ayarlanır)

| x | Ne |
|---|---|
| 0–46 | güneş, deniz, kum, cankurtaran kulesi, şemsiye, sörf tahtası, palmiye, deniz duvarı |
| 50–78 | CORAL oteli |
| 80–106 | MART + direkte 24H |
| 108–132 | diner + OPEN + neon palmiye |
| 134–172 | SUNSET kulübü + neon flamingo |

| y | Ne |
|---|---|
| 0–20 | gökyüzü, uzak kuleler |
| 8–33 | binalar |
| 34–36 | kaldırım, bordür |
| 37–42 | uzak şerit (trafik, sola) |
| 43–49 | yakın şerit (üstü açık araba) |

3×5 font: SUNSET 23 px, CORAL 19, MART 15, OPEN 15, 24H 11. Sığıyor.

## 3. Dosya yapısı

```
NeonCoastSwitch/
├─ index.html              derlenmiş tek dosya (teslimat, commit edilir)
├─ README.md
├─ package.json            yalnız script; çalışma zamanı bağımlılığı yok
├─ docs/
│  ├─ PLAN.md
│  └─ material-studies-prompts.md   Notion dışa aktarımı, yeniden adlandırılmış
├─ src/
│  ├─ page.html            kabuk + CSS
│  ├─ main.js              döngü ve kablolama
│  ├─ core/                rng, yay, bayer, olay yolu, vuruş saati
│  ├─ gfx/                 tampon + damga, 3×5 font, ışık, cam shader
│  ├─ scene/               gökyüzü, plaj, bulvar, yol, neon
│  ├─ actors/              araba, trafik, polis, helikopter, soygun, dokunmalar, boşta
│  ├─ audio/               motor, müzik, ortam, efektler
│  └─ ui/                  topuz girdisi, göstergeler, sayfa teması
├─ scripts/                build.mjs, shot.mjs
└─ tests/                  saf mantık testleri (node:test)
```

Sonuç ~4.300 satır JS. Kaynak modüllere bölünür, `npm run build` (düz birleştirme, bundler yok) hepsini kütüphanesiz tek `index.html` içine gömer; çıktı okunur kalır. Tek geliştirme bağımlılığı Playwright (yalnız ekran görüntüsü, ses ve performans denetimleri); çıktıya girmez.

## 4. Fazlar

Her faz sonunda kapı: build temiz, testler yeşil, konsol hatasız, ekran görüntüsü incelenmiş. Commit ve push yalnız sen söyleyince.

| Faz | İş | Kapı |
|---|---|---|
| 0 | İskelet: klasörler, build + ekran görüntüsü script'i, sayfa kabuğu, tuval boyutlama (sahne pikseli başına tam cihaz pikseli), deneme dokusunu WebGL2'den geçirme, prompt dosyasını `docs/` altına taşıma | sayfa açılıyor, deneme deseni keskin |
| 1 | Piksel motoru + durağan sahne: tamponlar, konturlu damga, 3×5 font, gökyüzü, deniz, plaj, dört bina, palmiyeler, lambalar, yol | gündüz görüntüsü okunur |
| 2 | Işık: ortam zaman çizelgesi, Bayer kenarlı sokak ışıkları, pencereler (sıcak, pembe, soğuk, floresan, bazıları karanlık), sodyum lamba havuzları, neon açık/kapalı/titreme/hale/renk taşması, topuz kenar izi, tam aydınlık doku | 5 konumda görüntü |
| 3 | Cam + etkileşim: çerçeve, gölge, kapsül, kırılma, topuz fiziği, sürükleme, klavye, `role="slider"`, göstergeler, sayfa renkleri | sürüklenebilir, erişilebilir |
| 4 | Üstü açık araba: yay, tekerler, köpek + kedi, egzoz, hız çizgileri, fren, lastik dumanı | cam altında araba tam görünüyor |
| 5 | Sokak yaşamı: trafik, polis takibi, helikopter, farlar, kırmızı-mavi havuzlar, ışıldak | takip başlıyor ve bitiyor |
| 6 | Soygun: 5 aşama, tetikleyiciler, köpekle kedinin eğilmesi, durum satırı | baştan sona kansız oynuyor |
| 7 | 13 dokunma + üzerine gelince vurgulama + boşta davranış | her hedefin tepkisi var |
| 8 | Ses motoru + müzik: zamanlayıcı, 5 katman, takip modu, miks | çevrimdışı render ölçümü |
| 9 | Efektler: motor, siren, pervane, silah, ortam, tüm dokunma ve boşta sesleri | her olayın sesi var |
| 10 | Cila: telefon genişliği, Safari, performans, azaltılmış hareket, WebGL2 yoksa mesaj, metne karşı madde madde denetim | denetim listesi tam |

## 5. Doğrulama

- **Mantık:** `node:test` ile yaylar, saat eşlemesi, Bayer, font, isabet sırası, polis ve soygun durum geçişleri.
- **Görüntü:** kurulu Chromium ile başsız ekran görüntüleri. Sayfa bir hata ayıklama kancası açar (`window.NCS.seek`, `.trigger`); böylece gece, takip ve soygun kareleri beklemeden alınır.
- **Ses:** `OfflineAudioContext` ile render; kırpma yok, müzik efektlerin ≈5 dB altında. Kulakla son kontrol sende; benim duyamayacağım tek şey bu.

## 6. Riskler

- **Yoğunluk.** 176 piksele çok şey sığıyor. Okunmazsa önce ayrıntı azaltılır, yerleşim tablosu güncellenir.
- **Ses dengesi.** Ölçümle yaklaşılır, kulakla bitirilir.
- **Yanıp sönme.** Polis ışıkları ve namlu alevi ışığa duyarlılık riski taşır. Tam sahne parlaması düşük genlikte tutulur, `prefers-reduced-motion` açıkken kısılır.
- **Soygunun yeri.** Metin "topuzun solunda" diyor. Dükkâna erken dokunulursa topuz dükkânın üstünde olabilir; sahne o durumda topuzun sol kenarına sıkıştırılır.

## 7. Onayını bekleyen kararlar

1. Kapsam yalnız Neon Coast Switch.
2. Kaynak `src/` modüllerinde, teslimat derlenmiş tek `index.html`. Alternatif: elle yazılmış tek dosya, build yok, test yok.
3. Prompt dosyası `docs/material-studies-prompts.md` olarak taşınır.
4. Yayın yok. İstersen sonra GitHub Pages ya da Vercel.
