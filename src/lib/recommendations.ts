import type { AlertLevel, DiseaseId } from '@/types/ews';

/**
 * Rekomendasi tindakan per penyakit & level. Bersifat umum (mengacu praktik
 * kesehatan masyarakat yang lazim di Indonesia) dan BUKAN pengganti protokol resmi
 * Dinas Kesehatan. `warga` = pesan untuk masyarakat; `dinas` = langkah untuk
 * pengambil kebijakan / Puskesmas / kelurahan.
 */
export interface Recommendations {
  warga: string[];
  dinas: string[];
}

const TABLE: Record<DiseaseId, Record<AlertLevel, Recommendations>> = {
  dbd: {
    normal: {
      warga: ['Lakukan 3M Plus seminggu sekali: kuras, tutup, dan daur ulang wadah penampung air.', 'Periksa jentik di bak mandi, pot, dan talang air rumah sendiri.'],
      dinas: ['Lanjutkan pemantauan jentik rutin oleh kader Jumantik.', 'Pastikan pelaporan kasus mingguan dari Puskesmas tepat waktu.'],
    },
    waspada: {
      warga: ['Tingkatkan 3M Plus menjadi dua kali seminggu selama musim hujan.', 'Pakai losion antinyamuk, terutama pagi dan sore hari.', 'Demam tinggi mendadak lebih dari 2 hari? Segera periksa ke Puskesmas.'],
      dinas: ['Aktifkan Gerakan 1 Rumah 1 Jumantik (G1R1J) di RW dengan angka bebas jentik rendah.', 'Sebarkan pesan kewaspadaan lewat kelurahan, RT/RW, dan sekolah.', 'Cek ketersediaan larvasida dan alat tes cepat NS1 di Puskesmas.'],
    },
    siaga: {
      warga: ['Ikut kerja bakti Pemberantasan Sarang Nyamuk (PSN) di lingkungan RT/RW.', 'Kenali tanda bahaya: nyeri perut hebat, muntah terus, mimisan, lemas. Segera ke IGD.', 'Jangan menunggu bintik merah muncul untuk memeriksakan demam.'],
      dinas: ['Lakukan Penyelidikan Epidemiologi (PE) untuk setiap kasus dalam 24 jam.', 'Gelar PSN serentak dan larvasidasi di RW terdampak.', 'Siapkan fogging fokus bila PE menemukan penularan setempat.', 'Minta rumah sakit rujukan memantau kapasitas tempat tidur.'],
    },
    awas: {
      warga: ['Demam? Periksa hari itu juga, minta tes darah dan pantau trombosit.', 'Tidur memakai kelambu atau pakaian lengan panjang, terutama anak-anak.', 'Laporkan tetangga yang demam ke kader atau ketua RT.'],
      dinas: ['Tetapkan respons cepat tingkat kecamatan: PE, fogging fokus dua siklus, dan PSN massal.', 'Buka pos pelayanan demam dan tambah jam layanan Puskesmas.', 'Koordinasikan rujukan dan stok cairan infus serta trombosit dengan RS dan PMI.', 'Laporkan perkembangan harian ke Suku Dinas Kesehatan.'],
    },
  },
  muntaber: {
    normal: {
      warga: ['Cuci tangan pakai sabun sebelum makan dan setelah dari toilet.', 'Minum air yang sudah dimasak sampai mendidih.'],
      dinas: ['Lanjutkan pemantauan kualitas air dan sanitasi rutin.', 'Pastikan stok oralit dan zinc di Puskesmas dan Posyandu.'],
    },
    waspada: {
      warga: ['Masak air sampai mendidih, terutama setelah hujan lebat.', 'Tutup makanan dan hindari jajanan yang terbuka.', 'Simpan oralit di rumah untuk berjaga-jaga.'],
      dinas: ['Periksa sisa klor dan cemaran E. coli pada sumber air di titik rawan genangan.', 'Distribusikan oralit dan zinc ke Posyandu serta kader.', 'Ingatkan pengelola kantin sekolah dan pedagang makanan soal higiene.'],
    },
    siaga: {
      warga: ['Diare? Segera minum oralit setiap kali buang air besar.', 'Bawa anak ke Puskesmas bila diare lebih dari 3 kali sehari, muntah terus, atau tampak lemas.', 'Jangan memakai air sumur yang terendam banjir sebelum dijernihkan dan direbus.'],
      dinas: ['Lakukan kaporitisasi sumur dan penampungan air di wilayah terdampak genangan.', 'Aktifkan pojok oralit di Puskesmas dan pos kesehatan banjir.', 'Telusuri sumber penularan bila kasus mengelompok (air, makanan, atau kontak).', 'Sediakan air bersih darurat di lokasi pengungsian.'],
    },
    awas: {
      warga: ['Tanda dehidrasi (mata cekung, jarang kencing, sangat lemas)? Segera ke IGD.', 'Gunakan hanya air kemasan atau air yang direbus untuk minum dan menyiapkan susu bayi.', 'Pisahkan alat makan penderita dan bersihkan toilet dengan disinfektan.'],
      dinas: ['Tetapkan respons KLB: tim gerak cepat, pos rehidrasi, dan pencatatan kasus harian.', 'Ambil sampel air dan sampel tinja untuk konfirmasi laboratorium.', 'Kerahkan mobil tangki air bersih dan perbaikan sanitasi darurat.', 'Siapkan rujukan dan stok cairan infus di RS terdekat.'],
    },
  },
  influenza: {
    normal: {
      warga: ['Tutup mulut dan hidung dengan siku saat batuk atau bersin.', 'Jaga daya tahan tubuh: tidur cukup dan makan bergizi.'],
      dinas: ['Lanjutkan surveilans penyakit serupa influenza (ILI) di Puskesmas sentinel.', 'Dorong vaksinasi influenza tahunan bagi lansia dan tenaga kesehatan.'],
    },
    waspada: {
      warga: ['Pakai masker bila batuk atau pilek, terutama di angkutan umum.', 'Sering cuci tangan dan hindari menyentuh wajah.', 'Buka jendela agar udara di rumah dan kelas berganti.'],
      dinas: ['Sebarkan edukasi etika batuk di sekolah, kantor, dan stasiun.', 'Tingkatkan cakupan vaksinasi kelompok rentan: lansia, ibu hamil, dan penderita penyakit kronis.', 'Pantau proporsi kunjungan ILI terhadap total kunjungan Puskesmas.'],
    },
    siaga: {
      warga: ['Sakit? Istirahat di rumah sampai demam reda sedikitnya 24 jam.', 'Lansia, ibu hamil, dan penderita asma segera periksa bila demam disertai batuk.', 'Hindari membawa bayi dan lansia ke tempat ramai dan tertutup.'],
      dinas: ['Anjurkan sekolah memulangkan siswa bergejala dan memantau angka absensi.', 'Siapkan antivirus dan alur triase batuk-demam di Puskesmas.', 'Ambil sampel usap untuk pemantauan jenis virus yang beredar.'],
    },
    awas: {
      warga: ['Sesak napas, nyeri dada, atau demam tidak turun lebih dari 3 hari? Segera ke IGD.', 'Pakai masker di semua ruang tertutup dan tunda acara kumpul yang tidak mendesak.', 'Jauhkan anggota keluarga yang sakit dari bayi dan lansia serumah.'],
      dinas: ['Aktifkan surveilans infeksi saluran napas berat (SARI) di rumah sakit.', 'Pertimbangkan pembatasan kegiatan massal dalam ruang tertutup di wilayah terdampak.', 'Pastikan ketersediaan oksigen, ruang isolasi, dan tenaga kesehatan.', 'Koordinasikan konfirmasi laboratorium untuk mendeteksi varian tidak biasa.'],
    },
  },
};

export function getRecommendations(disease: DiseaseId, level: AlertLevel): Recommendations {
  return TABLE[disease][level];
}
