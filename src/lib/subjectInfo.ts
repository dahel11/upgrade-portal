import type { OfferingMapping } from "../types";

// Draft copy — curated per subject to help the user understand what they're picking, not just
// the frequency/price. Temporarily disabled (2026-07-30, per direct request) since this copy
// hasn't been reviewed by product/academic yet — getSubjectInfo below returns placeholder Lorem
// Ipsum text instead. Restore by un-commenting this map + DEFAULT_DESCRIPTION and reverting
// getSubjectInfo to `SUBJECT_INFO[normalizeSubjectKey(offering.subject ?? offering.name)] ?? DEFAULT_DESCRIPTION`.
//
// const SUBJECT_INFO: Record<string, string> = {
//   matematika:
//     "Belajar aljabar, geometri, statistika, dan trigonometri lewat pendekatan pemecahan masalah sehari-hari, lengkap dengan latihan soal ujian sekolah dan try out.",
//   ipa: "Menjelajahi alam sekitar: materi & perubahannya, sistem organ tubuh manusia, energi & gerak, hingga ekosistem — dengan eksperimen sains yang seru dan mudah dipahami.",
//   fisika:
//     "Memahami gerak & gaya, listrik & magnet, gelombang & optik, serta termodinamika — dilengkapi soal-soal aplikatif dan persiapan ujian sekolah maupun UTBK.",
//   kimia:
//     "Mempelajari struktur atom & tabel periodik, reaksi kimia & stoikiometri, larutan asam-basa, hingga dasar-dasar kimia organik.",
//   biologi:
//     "Mengenal sel, genetika, sistem tubuh manusia, ekosistem, dan evolusi lewat studi kasus dari kehidupan nyata.",
//   bahasaindonesia:
//     "Memperkuat kemampuan membaca, menulis, dan memahami teks — termasuk sastra dan tata bahasa untuk ujian sekolah.",
//   bahasainggris:
//     "Mengasah grammar, vocabulary, reading comprehension, dan speaking untuk percakapan sehari-hari maupun ujian internasional.",
//   ips: "Memahami kehidupan sosial, sejarah, dan ekonomi masyarakat lewat isu-isu terkini yang relevan dengan keseharian.",
//   sejarah: "Menelusuri peristiwa penting dan tokoh sejarah Indonesia & dunia, serta relevansinya dengan masa kini.",
//   geografi: "Mempelajari fenomena bumi, cuaca & iklim, kependudukan, dan lingkungan hidup melalui peta dan data nyata.",
//   ekonomi: "Memahami konsep dasar ekonomi, keuangan, dan bisnis lewat contoh kasus yang aplikatif.",
//   sosiologi: "Mengenal struktur sosial, interaksi masyarakat, dan isu-isu sosial kontemporer.",
//   ppkn: "Memahami nilai kewarganegaraan, hukum, dan Pancasila lewat diskusi isu-isu aktual.",
//   informatika: "Belajar dasar pemrograman, logika komputasi, dan literasi digital lewat praktik langsung.",
// };
//
// const DEFAULT_DESCRIPTION =
//   "Materi disesuaikan dengan kurikulum sekolah di kelas kamu, mencakup konsep inti dan latihan soal.";

const PLACEHOLDER_DESCRIPTION =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";

/** Short blurb on what the student will learn — shown when a user expands an offering's info
 * panel while picking subjects to add/upgrade. Temporarily placeholder text for every subject —
 * see the commented-out SUBJECT_INFO map above for why. The "Teman-teman & guru akan berganti"
 * warning is unaffected — that's rendered separately in AddSubjectSelectPage, driven by
 * isFrequencyUpgrade, not by this function. */
export function getSubjectInfo(_offering: OfferingMapping): string {
  return PLACEHOLDER_DESCRIPTION;
}
