# Web Tabanlı "Kim Kiminle" Oyun Tasarım Belgesi (GDD)

## 1. Oyunun Konsepti ve Amacı

Klasik kağıt-kalem oyunu "Kim, Kiminle, Nerede, Ne Yapıyor?" eğlencesini, arkadaş gruplarının ve ailelerin farklı yerlerden veya aynı odada kendi cihazlarından bağlanarak oynayabileceği, gerçek zamanlı ve çok oyunculu (multiplayer) bir web uygulamasına dönüştürmek.

---

## 2. Hedef Kitle ve Platform

### Hedef Kitle
- **Birincil:** Arkadaş grupları (6–15 kişi) — parti ortamları, buluşmalar, online arkadaş toplantıları
- **İkincil:** Aile ortamları (4–8 kişi) — akşam yemekleri, tatil eğlenceleri

### Platform
- **Öncelik:** Mobil ve masaüstü eşit öncelikli
- Arayüz tüm ekran boyutlarında sorunsuz çalışacak şekilde **duyarlı (responsive)** tasarlanmalıdır.
- Tarayıcı desteği: Chrome, Safari, Firefox'un güncel sürümleri (uygulama kurulumu gerekmez)

---

## 3. MVP Kapsamı

Bu belge **2–4 haftalık hızlı prototip / demo** hedefini kapsamaktadır.

### MVP'ye Dahil
- Lobi kurma ve odaya katılma
- Takma adla oturum açma
- Klasik 6 soruluk oyun döngüsü + host'un özel soru ekleyebilmesi
- 35 saniyelik cevap süresi sayacı
- Sunucu taraflı sanal kağıt kaydırma algoritması
- Sıralı hikaye açılış ekranı
- Bağlantı kopma yönetimi (30 sn yeniden bağlanma süresi)
- Host devir mekanizması
- Oyun sonu "Tekrar Oyna / Çık" ekranı

### MVP Dışı (Gelecek Sürümler İçin)
- Kullanıcı hesabı / kayıt sistemi
- Liderlik tablosu / puanlama
- Özel soru paketleri (18+, sinema temalı vb.)
- Geçmiş oyunları görüntüleme
- Emoji/beğeni tepkileri

---

## 4. Oyuncu Limitleri

| Parametre | Değer |
|-----------|-------|
| Minimum oyuncu | 3 |
| Maksimum oyuncu | 8 |
| Oda kodu formatı | 4 karakter alfanumerik (örn: A7B2) |

---

## 5. Temel Mekanikler

### 5.1 Lobi Sistemi
Bir oyuncu "Oda Kur" seçeneğiyle lobi oluşturur; rastgele 4 karakterlik bir oda kodu üretilir. Diğer oyuncular "Odaya Katıl" ekranından bu kodu ve takma adlarını girerek lobiye dahil olur. Lobi ekranında bağlı tüm oyuncuların takma adları listelenir. Oyunu yalnızca host başlatabilir.

### 5.2 Tur Akışı
1. Host "Oyunu Başlat" düğmesine basar.
2. Her turda tüm oyuncuların ekranında aynı soru belirir ve **35 saniyelik geri sayım** başlar.
3. Süre dolmadan önce cevabını onaylayan oyuncular bekleme ekranına geçer; diğerlerinin süresi dolunca cevapları otomatik olarak (boş veya yazılan metin) gönderilir.
4. Tüm cevaplar alındığında sunucu bir sonraki soruya geçer.
5. Tüm sorular tamamlandığında Büyük Açılış ekranı başlar.

### 5.3 Soru Seti
Varsayılan klasik 6 soru şunlardır:

1. Kim?
2. Kiminle?
3. Nerede?
4. Ne Yapıyor?
5. Kim Görmüş?
6. Ne Demiş?

Host, lobi ekranında bu listeye dilediği kadar özel soru ekleyebilir veya mevcut soruları sıralayabilir. Özel sorular klasik sorularla birlikte aynı döngüde işlenir.

### 5.4 Dijital "Kağıt Katlama" (Sanal Kağıt Sistemi)
Klasik oyunun gizlilik mantığı sunucu taraflı bir kaydırma algoritmasıyla simüle edilir. Her oyuncunun cevabı, farklı bir "sanal kağıda" eklenerek oyuncular arasında gizlice dolaştırılır. Böylece hiçbir oyuncu kendi başlattığı cümlenin devamını göremez.

### 5.5 Büyük Açılış (Sonuç Ekranı)
Tüm sorular tamamlandığında sunucu birleşen hikayeleri tüm oyuncuların ekranına sırayla yansıtır. Her hikaye cümle cümle açılır. Okuma tamamlandığında bir sonraki hikayeye geçilir.

Oyun bitişinde tüm oyunculara iki seçenek sunulur:
- **Tekrar Oyna:** Aynı oda koduyla yeni bir tur başlatılır (host onaylar).
- **Çık:** Oyuncu lobiden ayrılır; oda kapanır.

---

## 6. Kullanıcı Akışı

```
[Giriş Ekranı]
    ├── Oda Kur → Takma Ad Gir → [Lobi Ekranı - Host]
    └── Odaya Katıl → Kod + Takma Ad Gir → [Lobi Ekranı - Oyuncu]

[Lobi Ekranı]
    └── Host "Başlat" → [Soru Ekranı]

[Soru Ekranı] (35 sn sayaç)
    └── Cevap gönder → [Bekleme] → Sonraki soru → ... → [Büyük Açılış]

[Büyük Açılış]
    └── Tüm hikayeler → [Oyun Sonu]

[Oyun Sonu]
    ├── Tekrar Oyna → [Lobi Ekranı]
    └── Çık → [Giriş Ekranı]
```

---

## 7. Hata ve Kenar Durum Yönetimi

### 7.1 Bağlantı Kopması
- Bir oyuncunun bağlantısı kesilirse sunucu **30 saniye** bekler.
- Bu süre içinde oyuncu yeniden bağlanırsa oyun kaldığı yerden devam eder.
- 30 saniye dolduğunda oyuncu odadan çıkarılmış sayılır; oyun kalan oyuncularla sürer (minimum 3 kişi kuralı aranmaz, oyun yarıda kesmez).
- Bekleme süresi tüm oyunculara ekranda gösterilir: *"[Takma Ad] yeniden bağlanmayı bekliyor... 24sn"*

### 7.2 Host Ayrılması
- Host oyundan ayrılırsa (veya bağlantısı koparsa) hostluk **rastgele başka bir oyuncuya** otomatik olarak devredilir.
- Yeni host tüm oyunculara bildirilir: *"[Takma Ad] artık host."*

### 7.3 Süre Dolması
- 35 saniye içinde cevap göndermeyen oyuncuların o tura ait cevabı **boş** olarak kaydedilir.
- Oyuncu uyarılır: *"Süren doldu, cevabın boş geçildi."*

### 7.4 Oda Geçerliliği
- Oda, oyun tamamlanana veya tüm oyuncular ayrılana kadar aktif kalır.
- Oyun bitişinde host "Tekrar Oyna" seçerse oda sıfırlanır, aynı kod geçerliliğini korur.
- Host "Çık" derse oda tamamen kapatılır ve kod geçersiz olur.

### 7.5 Minimum Oyuncu
- Oyun başladıktan sonra oyuncu sayısı 2'ye düşse bile oyun **iptal edilmez**, mevcut oyuncularla tamamlanır.
- Lobi aşamasında host, 3 kişi dolmadan oyunu başlatamaz.

---

## 8. Teknik Altyapı Mimarisi

### 8.1 Teknoloji Seçimleri (Kesinleşmiş)

| Katman | Teknoloji | Gerekçe |
|--------|-----------|---------|
| Backend | FastAPI + WebSockets | Native async WebSocket desteği, yüksek performans |
| Frontend | Vue.js 3 (Composition API) | Reaktif UI, düşük öğrenme eğrisi, Vercel uyumu |
| State Yönetimi | Sunucu Belleği (Python dict) | Prototip için yeterli, sıfır kurulum |
| Backend Deploy | Render.com | Ücretsiz tier, kalıcı WebSocket desteği |
| Frontend Deploy | Vercel | Otomatik deploy, CDN, HTTPS |

### 8.2 Backend — FastAPI + WebSockets

```
backend/
├── main.py           # FastAPI uygulaması, WebSocket endpoint'leri
├── game_manager.py   # Oda ve oyun state yönetimi (Python dict)
├── models.py         # Pydantic veri modelleri
├── requirements.txt  # fastapi, uvicorn, websockets
└── render.yaml       # Render.com deploy konfigürasyonu
```

Render.com'da çalıştırma komutu:
```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

### 8.3 Frontend — Vue.js 3

```
frontend/
├── index.html
├── package.json
├── vite.config.js        # Vite bundler (Vue 3 önerilen)
├── vercel.json           # Vercel deploy konfigürasyonu
└── src/
    ├── main.js
    ├── App.vue
    ├── socket.js         # WebSocket bağlantı yönetimi
    └── components/
        ├── HomeScreen.vue      # Giriş: Oda kur / Katıl
        ├── LobbyScreen.vue     # Lobi: Oyuncu listesi, soru düzenleme
        ├── QuestionScreen.vue  # Soru + 35sn sayaç
        ├── WaitingScreen.vue   # Diğerleri yazıyor...
        ├── RevealScreen.vue    # Büyük Açılış animasyonu
        └── EndScreen.vue       # Tekrar Oyna / Çık
```

### 8.4 Veri ve Durum Yönetimi — Sunucu Belleği

Tüm aktif oda verileri Python sözlüklerinde tutulur. Sunucu yeniden başlarsa aktif oyunlar sıfırlanır; prototip aşaması için bu kabul edilebilir. Üretime geçildiğinde Upstash Redis ile değiştirilebilir.

```python
# Sunucu belleğindeki veri yapısı örneği
rooms = {
    "A7B2": {
        "host": "ali",
        "players": ["ali", "ayse", "mehmet"],
        "state": "lobby",          # lobby | playing | reveal | ended
        "questions": [...],
        "papers": { "ali": [], "ayse": [], "mehmet": [] },
        "current_question_index": 0,
        "answers_received": {}
    }
}
```

---

## 9. WebSocket Olay Tablosu

| Olay Adı | Yön | Açıklama | Örnek Payload |
|----------|-----|----------|---------------|
| `create_room` | Client → Server | Yeni oda oluştur | `{ nickname }` |
| `join_room` | Client → Server | Odaya katıl | `{ room_code, nickname }` |
| `room_updated` | Server → Client | Oyuncu listesi değişti | `{ players: [...] }` |
| `start_game` | Client → Server | Host oyunu başlat | `{ room_code }` |
| `game_started` | Server → Client | Oyun başladı bildirimi | `{ questions: [...] }` |
| `submit_answer` | Client → Server | Cevap gönder | `{ room_code, answer }` |
| `next_question` | Server → Client | Yeni soruyu göster | `{ question, question_index, total }` |
| `timer_tick` | Server → Client | Geri sayım | `{ remaining_seconds }` |
| `waiting` | Server → Client | Cevap bekleniyor | `{ waiting_for: [...] }` |
| `reveal_results` | Server → Client | Hikayeleri göster | `{ stories: [...] }` |
| `player_disconnected` | Server → Client | Oyuncu bağlantısı koptu | `{ nickname, reconnect_timeout: 30 }` |
| `host_changed` | Server → Client | Host değişti | `{ new_host: nickname }` |
| `game_reset` | Server → Client | Tekrar oyna başlatıldı | `{}` |

---

## 10. Güvenlik ve Kötüye Kullanım Önlemleri

- Oda kodu 4 karakterli alfanumerik yapıda olup tahmin edilebilirliği düşüktür; ek olarak sunucu tarafında oluşturma sırasında çakışma kontrolü yapılır.
- Aynı IP'den aynı odaya birden fazla bağlantı (sekme açma) engellenir.
- Cevap uzunluğu maksimum 100 karakter ile sınırlandırılır.
- Takma ad uzunluğu maksimum 20 karakter ile sınırlandırılır; boş bırakılamaz.
- Sunucu tarafında rate limiting uygulanır (aynı IP'den saniyede maksimum 10 event).

---

## 11. Deploy Mimarisi

### Vercel (Frontend)
`frontend/` klasörü Vercel'e bağlanır. Her `git push` sonrası otomatik deploy tetiklenir. `vercel.json` içinde Vue Router için fallback ayarı yapılır.

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### Render.com (Backend)
`backend/` klasörü Render.com'a bağlanır. `render.yaml` ile servis tanımlanır.

```yaml
services:
  - type: web
    name: kimkiminle-backend
    env: python
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn main:app --host 0.0.0.0 --port $PORT
```

> ⚠️ **Soğuk Başlatma:** Render.com ücretsiz tier'da 15 dakika işlem olmadığında sunucu uyur. İlk bağlantı 30-40 saniye sürebilir. Bu prototip aşamasında kabul edilebilir; ücretli plana geçince çözülür.

---

## 12. Sürüm Yol Haritası

### v1.0 — MVP (2–4 Hafta)
Bu belgede tanımlanan tüm özellikler. Stack: FastAPI + Vue.js 3 + Sunucu Belleği. Deploy: Vercel + Render.com.

### v2.0 — Gelecek (Kapsam Dışı)
- Sunucu belleği → Upstash Redis geçişi (çoklu sunucu desteği)
- Özel soru paketleri (18+, sinema temalı vb.)
- Liderlik tablosu ve puanlama sistemi
- Kullanıcı hesabı ve kayıt sistemi
- Geçmiş oyunları görüntüleme
- Sonuç ekranında emoji / beğeni tepkileri
