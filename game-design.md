# Web Tabanlı "Kim Kiminle" Oyun Tasarım Belgesi (GDD v2 - Güncel Durum)

## 1. Oyunun Konsepti ve Amacı

Klasik kağıt-kalem oyunu "Kim, Kiminle, Nerede, Ne Yapıyor?" eğlencesini, arkadaş gruplarının ve ailelerin farklı yerlerden veya aynı odada kendi cihazlarından bağlanarak oynayabileceği, gerçek zamanlı ve çok oyunculu (multiplayer) bir web uygulamasına dönüştürmek.

---

## 2. Hedef Kitle ve Platform

### Hedef Kitle
- **Birincil:** Arkadaş grupları (6–15 kişi) — parti ortamları, buluşmalar, online arkadaş toplantıları
- **İkincil:** Aile ortamları (4–8 kişi) — akşam yemekleri, tatil eğlenceleri

### Platform
- **Öncelik:** Mobil ve masaüstü eşit öncelikli.
- Arayüz tüm ekran boyutlarında sorunsuz çalışacak şekilde **duyarlı (responsive)** tasarlanmıştır.
- Tarayıcı desteği: Chrome, Safari, Firefox'un güncel sürümleri (uygulama kurulumu gerekmez).

---

## 3. Özellik Kapsamı (Mevcut Durum)

Oyun MVP kapsamını karşılamakta ve aşağıdaki özellikleri içermektedir:
- Lobi kurma ve odaya katılma (4 haneli kod ile)
- Takma adla oturum açma
- 7 sabit oyun sorusu.
- Soru başına 35 saniyelik geri sayım sayacı.
- Sunucu taraflı sanal kağıt kaydırma (paper folding) algoritması.
- Oyun sonunda hikayelerin ekranda adım adım gösterildiği Büyük Açılış (Reveal) ekranı.
- Bağlantı kopmalarına karşı 30 saniyelik tolerans ve otomatik host devri mekanizması.
- Oyun sonu "Tekrar Oyna / Çık" fonksiyonları.

---

## 4. Oyuncu Limitleri

| Parametre | Değer |
|-----------|-------|
| Minimum oyuncu | 2 |
| Maksimum oyuncu | 8 |
| Oda kodu formatı | 4 karakter alfanumerik (Harf ve Rakam, örn: A7B2) |

---

## 5. Temel Mekanikler

### 5.1 Lobi Sistemi
Oyuncular rastgele üretilen 4 karakterli oda kodu ile katılır. Lobi ekranında odaya bağlı oyuncular listelenir. Oyunu yalnızca host başlatabilir. Host, lobideyken soru ekleyebilir veya listeyi düzenleyebilir. Host oyundan düşerse veya çıkarsa hostluk otomatik olarak rastgele bir oyuncuya devredilerek oyun kesintiye uğramaz.

### 5.2 Tur Akışı
1. Host "Oyunu Başlat" düğmesine basar.
2. 35 saniyelik ilk döngü sorusu başlar.
3. Herkes cevabını gönderir. Süresi dolan ve cevap vermeyen oyuncular "-" karakterini boş cevap olarak yollamış sayılır.
4. Tüm oyuncuların cevapları sunucuya ulaşınca bir sonraki soruya geçilir.
5. Tüm turlar bitene kadar döngü tekrarlanır (7 sabit soru).
6. Tüm turlar bitince Büyük Açılış aşamasına geçilir.

### 5.3 Soru Seti
Sabit 7 soru şunlardır:
1. Kim?
2. Kiminle?
3. Nerede?
4. Ne zaman?
5. Ne Yapıyor?
6. Kim Görmüş?
7. Ne Demiş?

### 5.4 Dijital "Kağıt Katlama"
Klasik oyunun sır tutma mantığı backend'de çalışan kaydırma algoritması ile korunur. Her oyuncunun cevabı bir sonraki oyuncunun hikayesine kaydırılarak eklenir. Böylece kimse kendi cümlesinin sonunu göremez ve oyun sürpriz yapısını korur.

### 5.5 Büyük Açılış ve Oyun Sonu
Büyük Açılışta oyunculardan toplanan hikayeler bir araya getirilerek herkesin ekranına sunulur. Hikayeler arasında "Önceki" ve "Sonraki" butonlarıyla geçiş yapılır. Bütün hikayeler görüntülendikten sonra Host, dilerse "Tekrar Oyna" diyerek mevcut oyuncu grubuyla lobiyi yeniden başlatabilir veya herkes "Çık" seçeneğiyle çıkış yapabilir.

---

## 6. Teknik Altyapı Mimarisi (Mevcut Mimari)

Önceki GDD (game-design.md) belgesinin aksine, uygulamanın frontend kısmı bir SPA framework (Vue.js vb.) olmadan doğrudan Vanilla JS, HTML ve CSS ile daha hafif bir yapıda geliştirilmiş ve FastAPI tarafından tek parça halinde sunulacak şekilde statik olarak derlenmiştir.

| Katman | Teknoloji / Yapı | Gerekçe |
|--------|-----------|---------|
| **Backend** | API (Python 3), FastAPI, WebSockets | Native async desteği, hız, websocket kolaylığı |
| **Frontend** | Vanilla HTML5, CSS3, JavaScript (`app.js`) | Kütüphanesiz hafif yapı, statik render |
| **State Yönetimi**| Sunucu Belleği (Python dictionary) | Prototip / MVP için yeterli ve kurulumsuz |
| **Sunucu Dağıtımı**| Render.com / Standalone (Tekli Container) | Vercel+Render dağınıklığını ortadan kaldırma |

### Proje Dizini Yapısı

```text
kimkimle/
├── main.py             # FastAPI WebSocket sunucusu, Oyun mantığı ve Statik HTML sunumu
├── requirements.txt    # fastapi, uvicorn, websockets, pydantic vb.
├── render.yaml         # Render.com auto-deployment ayarları
├── game-design.md      # Eski Tasarım Belgesi
├── game-design-2.md    # Güncel Tasarım Belgesi (Bu dosya)
└── static/
    ├── index.html      # Tek sayfalık arayüz (SPA benzeri modüler UI)
    ├── style.css       # Özelleştirilmiş oyun stiline uygun CSS
    └── app.js          # WebSocket istemcisi ve Modüler Ekran Yöneticisi
```

### Dağıtım Modeli Değişiklikleri
- Vercel (Frontend) ve Render (Backend) şeklinde bölünmüş yapıdan vazgeçilmiş olup Frontend statik dosyaları doğrudan Backend'in `static/` klasörüne dahil edilmiştir.
- FastAPI'nin statik dosya sunucusu özelliği kullanılarak (`@app.get("/")`, `StaticFiles(directory="static")`) tüm oyun tek bir sunucudan (örn: `uvicorn main:app`) ile ayağa kaldırılabilir hale getirilmiştir.

---

## 7. WebSocket Olayları Tablosu

Sistem, HTTP yerine tamamen asenkron çift yönlü iletişim (WebSocket - `ws://`/`wss://`) üzerinden tasarlanmıştır. Beklenen ve kodlanan event'ler (olaylar) aşağıdakilerdir:

| Olay Adı (Event) | Yön | Anlamı ve İşlevi |
|------------------|-----|------------------|
| `create_room` | İstemci → Sunucu | Host takma adıyla birlikte odayı kurar |
| `join_room` | İstemci → Sunucu | Oda koduna göre varolan oyun lobisine bağlanır |
| `room_created` | Sunucu → İstemci | Kurulum başarılı, oda bilgilerini client'a iletir |
| `room_joined`, `room_updated`| Sunucu → İstemci | Katılım onayı ve oyuncu listesindeki değişimleri iletir |

| `start_game`, `game_started` | Çift Yönlü | Host başlat komutunu yollar, sunucu onaylar |
| `next_question`, `submit_answer` | Çift Yönlü | Sunucu yeni soruyu gönderir, oyuncu cevabını yollar |
| `timer_tick`, `waiting` | Sunucu → İstemci | 35sn sayacını ve "Cevaplar bekleniyor" uyarılarını günceller |
| `reveal_results` | Sunucu → İstemci | Bütünleşik hikayeleri gösterim ekranına yansıtır |
| `player_disconnected` | Sunucu → İstemci | Bağlantı koptu uyarısı verir, 30 saniyelik sayacı başlatır |
| `player_reconnected` | Sunucu → İstemci | Oyuncu zamanında dönerse oyuna devam edilmesini sağlar |
| `host_changed`, `player_left` | Sunucu → İstemci | Kopmalar sonrası host transferi veya oyuncu eksilmelerini günceller |
| `play_again`, `game_reset` | Çift Yönlü | Aynı hostun aynı grupla tekrar turu başlatmasını ayarlar |

---

## 8. Hata Durumu ve Spesifik Senaryo Yönetimi

- **Bağlantı Kopması Süreci:** Sunucuya websocket bağlantısı kopan oyuncu 30 saniye boyunca "player_disconnected" durumunda kalır. Bu sürede (Örn: İnternet gidip gelmesi, Refresh vb.) tekrar katılırsa id üzerinden bağlantısını alır. Dönemezse tamamen dışarı alınır.
- **Host Ayrılması (Host Devri):** Host pozisyonundaki kurucu odadan çıkarsa oyun kitlenmez, hostluk içeride kalan oyuncular arasından rastgele birine devredilerek lobinin veya oyunun sürmesi garanti altına alınır.
- **Güvenlik / Spesifik İşlemler:**
  - Aynı IP adresinden gelen asenkron olay bağlantı isteklerine kısıt konmuş olmakla birlikte geliştirme sürecindeki testler için saniyede 50 rate limit (olay istek limiti) esnetilerek kullanılmaktadır.
  - Cevap içerikleri **100 karakter**, isimler **20 karakter** limitli olup spam koruması sağlanmıştır.
  - Oyun başladıktan sonra oyuncu sayısı 2 kişiye düşse bile mevcut prototipte oyun otomatik iptal olmaz. Oyunda bir kişi kalsa dahi mevcut cycle bitene veya o da çıkana kadar çalışabilir durumdadır.
