# Siaga Musim — Prototype EWS Penyakit Berbasis Cuaca (Jakarta Timur)

Prototype **frontend-only** sistem peringatan dini (Early Warning System) yang menghubungkan **curah hujan** dengan potensi lonjakan **DBD, muntaber, dan influenza** per kelurahan di Jakarta Timur.

> **Semua angka adalah data simulasi.** Kasus, curah hujan, dan jumlah penduduk dibuat secara sintetis oleh `scripts/generate-dummy-data.mjs`. Yang asli hanya batas wilayah (© kontributor OpenStreetMap, ODbL). Jangan dipakai untuk keputusan kesehatan yang sebenarnya.

Proyek ini memakai arsitektur dan struktur proyek **RadarPangan-FE** (Next.js App Router, dua lensa publik/dasbor, MapLibre, mesin analisis deterministik di `src/lib/engines/`), dengan domain, data, dan UI/UX yang dirombak total.

---

## 1. Menjalankan

```bash
npm install        # sekaligus menyalin aset MapLibre ke /public
npm run dev        # http://localhost:3000
npm run build && npm run start   # build produksi
```

| Perintah | Fungsi |
|---|---|
| `npm run data:generate` | Membuat ulang kedua CSV dummy (deterministik, seed tetap) |
| `npx tsx scripts/check-engine.ts` | Mencetak sebaran level, korelasi jeda, dan proyeksi ke konsol untuk memeriksa mesin risiko |

**Stack:** Next.js 16.4.5 · React 19 · TypeScript (strict) · Tailwind CSS v3 + token CSS · MapLibre GL JS 6 · grafik SVG buatan sendiri (d3-scale/shape/array) · font Plus Jakarta Sans & JetBrains Mono (self-hosted).

---

## 2. Analisis kebutuhan dan keputusan desain

### Siapa penggunanya dan apa yang mereka butuhkan

| Pengguna | Pertanyaan yang harus terjawab | Jawaban di aplikasi |
|---|---|---|
| **Warga** | "Kelurahan saya aman? Saya harus apa?" | Halaman publik `/`: cari kelurahan → level tiga penyakit + tindakan untuk warga |
| **Pengambil kebijakan** (Sudin Kesehatan, Puskesmas, kecamatan/kelurahan) | "Di mana harus bertindak minggu ini, untuk penyakit apa, dan mengapa?" | Dasbor: peta risiko, daftar prioritas, rincian pemicu, proyeksi 4 minggu, tindakan untuk dinas |

### Mengapa curah hujan bisa menjadi peringatan dini

Hujan **mendahului** kasus dengan jeda yang berbeda per penyakit. Jeda inilah yang memberi waktu untuk bertindak.

| Penyakit | Mekanisme | Jeda hujan → kasus |
|---|---|---|
| **DBD** | Genangan → nyamuk *Aedes* berkembang biak (1–2 minggu) → virus matang di nyamuk (8–12 hari) → masa inkubasi manusia (4–7 hari) | **4–9 minggu** |
| **Muntaber** | Hujan ekstrem/genangan mencemari air dan makanan; inkubasi 1–3 hari | **0–2 minggu** |
| **Influenza** | Musim hujan: udara lembap, orang berkumpul di ruang tertutup | **1–3 minggu** |

### Keputusan utama

1. **Satuan waktu mingguan**, bukan harian. Surveilans penyakit menular dilaporkan per minggu epidemiologi, dan hitungan harian per kelurahan (0–2 kasus) terlalu kecil untuk dibaca polanya.
2. **Unit analisis kelurahan**, dengan agregasi kecamatan dan kota. Kasus dijumlahkan; hujan dirata-rata tertimbang luas. Perbandingan antarwilayah memakai **insidensi per 100.000 penduduk**, bukan jumlah mentah.
3. **Empat level** yang sudah akrab di Indonesia: **Normal → Waspada → Siaga → Awas**. Level selalu tampil dengan ikon dan label, tidak pernah warna saja.
4. **Mesin risiko deterministik dan bisa dijelaskan** (lihat bagian 4), bukan model "kotak hitam".
5. **Cuaca saja tidak bisa memicu Siaga/Awas.** Hujan lebat menaikkan status paling tinggi ke Waspada; Siaga dan Awas mensyaratkan kasus teramati di atas pola normal. Ini mencegah alarm palsu setiap musim hujan.
6. **Tanpa login.** Prototype ini frontend-only; gerbang SSO tiruan pada proyek acuan tidak dibawa.

---

## 3. Dataset dummy

Berkas di `public/data/` dibaca langsung oleh peramban. Mengganti kedua CSV dengan struktur kolom yang sama akan memperbarui seluruh tampilan.

**`ews_jakarta_timur_mingguan.csv`** — 9.620 baris = 65 kelurahan × 148 minggu (1 Jan 2024 – 1 Nov 2026)

| Kolom | Keterangan |
|---|---|
| `tanggal` | Senin awal minggu (YYYY-MM-DD) |
| `tahun`, `minggu_epi` | Tahun dan nomor minggu ISO 8601 |
| `kota`, `kecamatan`, `kelurahan` | Jakarta Timur · 10 kecamatan · 65 kelurahan |
| `curah_hujan_mm` | Akumulasi hujan 7 hari (mm) |
| `insiden_dbd`, `insiden_muntaber`, `insiden_influenza` | Jumlah kasus baru minggu itu |

**`wilayah_jakarta_timur.csv`** — `id_kelurahan, kota, kecamatan, kelurahan, penduduk, luas_km2, lat, lon`

Pola yang sengaja ditanam di generator, supaya logika peringatan dini bisa diuji:

- Hujan mengikuti klimatologi monsun Jakarta (puncak Jan–Feb, kering Jul–Agu); wilayah selatan lebih basah.
- DBD mengikuti hujan 4–9 minggu sebelumnya; muntaber melonjak 0–2 minggu setelah hujan ekstrem, terutama di kelurahan bantaran sungai; influenza mengikuti musim hujan dengan jeda 1–3 minggu.
- Beberapa kejadian: banjir besar Maret 2025, "kemarau basah" 2025, dan **awal musim hujan yang maju pada Oktober 2026** (termasuk satu minggu hujan ekstrem). Akibatnya pada minggu terakhir data: muntaber Awas, dan DBD masih Waspada tetapi proyeksinya melampaui ambang dalam beberapa minggu.

Korelasi silang pada data yang dihasilkan memuncak di jeda ±6–7 minggu (DBD), 1 minggu (muntaber), dan 2–3 minggu (influenza).

---

## 4. Mesin risiko (`src/lib/engines/`)

Untuk tiap wilayah, penyakit, dan minggu dihitung tiga sinyal berskala 0–100:

| Sinyal | Bobot | Cara hitung |
|---|---|---|
| **Kasus** | 50% | Rata-rata kasus 2 minggu terakhir dibanding **kasus harapan μ** (rata-rata minggu kalender yang sama ±2 minggu pada tahun lain) dan simpangan bakunya σ. Skor = 20 + 27,5·z. **Ambang = μ + 2σ.** |
| **Cuaca** | 30% | Rata-rata tertimbang hujan beberapa minggu terakhir (bobot mengikuti jeda penyakit), dinyatakan sebagai persentil terhadap seluruh riwayat wilayah. Indikator pendahulu. |
| **Tren** | 20% | Perubahan kasus 3 minggu terakhir dibanding 3 minggu sebelumnya, diredam untuk angka kecil. |

**Skor = 0,5·Kasus + 0,3·Cuaca + 0,2·Tren** → Normal < 40 · Waspada 40–59 · Siaga 60–79 · Awas ≥ 80

Aturan bukti kasus:

- Tanpa kasus di atas rata-rata (z ≥ 1), atau bila kasus minggu berjalan sudah kembali ke rata-rata historis, level ditahan di **Waspada**.
- **Awas** mensyaratkan kasus melampaui ambang.
- Kasus di atas ambang ≥ 2 minggu berturut-turut → minimal **Siaga**.

**Proyeksi indikatif 4 minggu** (`forecast.ts`): kasus harapan historis pada minggu target × campuran kondisi kasus saat ini dan paparan hujan yang sudah turun. Untuk DBD, seluruh hujan pemicu kasus 4 minggu ke depan sudah teramati; di situlah nilai peringatan dininya.

**Korelasi jeda** (`lag.ts`): korelasi hujan(t−k) dengan kasus(t) untuk k = 0–12 minggu.

Keterbatasan yang perlu diketahui: baseline hanya memakai 2 tahun pembanding; ambang belum divalidasi terhadap kejadian nyata; proyeksi bukan model prediksi tervalidasi; faktor lain (suhu, kelembapan, mobilitas, cakupan PSN) belum masuk.

---

## 5. Struktur halaman

```text
Siaga Musim
├── Lensa publik
│   ├── /                        Status terkini, cek kelurahan, peta ringkas, tindakan untuk warga
│   └── /metodologi              Penjelasan logika, rumus, sumber, dan keterbatasan
└── Dasbor (pengambil kebijakan) — filter global: penyakit + minggu ("mesin waktu")
    ├── /dashboard               Ringkasan: status 3 penyakit, peta, kelurahan prioritas, tren kota
    ├── /dashboard/peta          Peta risiko: level / insidensi / hujan, pemutar waktu, panel detail
    ├── /dashboard/tren          Hujan vs kasus, ambang, proyeksi, korelasi jeda, perbandingan antartahun
    ├── /dashboard/wilayah       Tabel 65 kelurahan (urut, saring, cari)
    ├── /dashboard/wilayah/[id]  Profil satu kelurahan: 3 penyakit, pemicu, rekomendasi
    └── /dashboard/data          Kamus data, pratinjau, unduh CSV
```

Tautan dalam yang didukung: `/dashboard?penyakit=dbd|muntaber|influenza` (memilih penyakit) dan `/dashboard/tren?wilayah=<id>` (memilih wilayah, mis. `kec-ciracas` atau `kampung-melayu`).

## 6. Struktur kode

```text
public/
  data/                  CSV dummy (deret waktu + wilayah)
  geo/                   Batas kelurahan & kecamatan (GeoJSON, dari OpenStreetMap)
scripts/
  generate-dummy-data.mjs   Generator dataset (deterministik)
  check-engine.ts           Pemeriksaan mesin risiko di konsol
  copy-maplibre-assets.mjs  Menyalin CSS + worker MapLibre ke /public (postinstall)
src/
  app/
    (public)/            Halaman publik
    (dashboard)/         Halaman dasbor
    tokens.css           Token desain (warna, radius, bayangan)
  components/
    shell/               Sidebar, bilah filter, header/footer publik
    ui/                  LevelBadge, DiseaseTag, Card, DataGate, SignalBreakdown, …
    charts/              Kit grafik SVG (RainCaseChart, Sparkline, LagCorrelationChart, …)
    map/                 RiskMap (MapLibre) + legenda
    dashboard/, public/  Komponen per halaman
  lib/
    config.ts            Penyakit (warna, jeda), level (ambang skor, warna), hujan
    data/                Parser CSV, penyusun Dataset, EwsDataProvider
    engines/             risk.ts · forecast.ts · lag.ts · stats.ts
    summary.ts           Ringkasan & kalimat siap tampil
    recommendations.ts   Tindakan per penyakit × level (warga & dinas)
    state/filters.tsx    Filter global dasbor
  types/ews.ts           Kontrak tipe
```

## 7. Sumber dan lisensi

- **Batas wilayah:** OpenStreetMap, © kontributor OpenStreetMap, lisensi ODbL. Poligon disederhanakan; area TMII digabung ke Kelurahan Ceger.
- **Peta dasar:** Esri Light Gray Canvas (ubin daring; peta tetap tampil tanpa ubin).
- **Data kasus, hujan, penduduk:** simulasi.
