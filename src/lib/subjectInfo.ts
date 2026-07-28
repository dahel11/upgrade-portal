import { normalizeSubjectKey } from "./format";
import type { OfferingMapping } from "../types";

/** Draft copy — curated per subject to help the user understand what they're picking, not just
 * the frequency/price. Product/academic team should review and refine; keyed by a normalized
 * version of `offering_mapping_to_grade.subject` so edits here never require touching page logic. */
const SUBJECT_INFO: Record<string, string> = {
  matematika:
    "Belajar aljabar, geometri, statistika, dan trigonometri lewat pendekatan pemecahan masalah sehari-hari, lengkap dengan latihan soal ujian sekolah dan try out.",
  ipa: "Menjelajahi alam sekitar: materi & perubahannya, sistem organ tubuh manusia, energi & gerak, hingga ekosistem — dengan eksperimen sains yang seru dan mudah dipahami.",
  fisika:
    "Memahami gerak & gaya, listrik & magnet, gelombang & optik, serta termodinamika — dilengkapi soal-soal aplikatif dan persiapan ujian sekolah maupun UTBK.",
  kimia:
    "Mempelajari struktur atom & tabel periodik, reaksi kimia & stoikiometri, larutan asam-basa, hingga dasar-dasar kimia organik.",
  biologi:
    "Mengenal sel, genetika, sistem tubuh manusia, ekosistem, dan evolusi lewat studi kasus dari kehidupan nyata.",
  bahasaindonesia:
    "Memperkuat kemampuan membaca, menulis, dan memahami teks — termasuk sastra dan tata bahasa untuk ujian sekolah.",
  bahasainggris:
    "Mengasah grammar, vocabulary, reading comprehension, dan speaking untuk percakapan sehari-hari maupun ujian internasional.",
  ips: "Memahami kehidupan sosial, sejarah, dan ekonomi masyarakat lewat isu-isu terkini yang relevan dengan keseharian.",
  sejarah: "Menelusuri peristiwa penting dan tokoh sejarah Indonesia & dunia, serta relevansinya dengan masa kini.",
  geografi: "Mempelajari fenomena bumi, cuaca & iklim, kependudukan, dan lingkungan hidup melalui peta dan data nyata.",
  ekonomi: "Memahami konsep dasar ekonomi, keuangan, dan bisnis lewat contoh kasus yang aplikatif.",
  sosiologi: "Mengenal struktur sosial, interaksi masyarakat, dan isu-isu sosial kontemporer.",
  ppkn: "Memahami nilai kewarganegaraan, hukum, dan Pancasila lewat diskusi isu-isu aktual.",
  informatika: "Belajar dasar pemrograman, logika komputasi, dan literasi digital lewat praktik langsung.",
};

const DEFAULT_DESCRIPTION =
  "Materi disesuaikan dengan kurikulum sekolah di kelas kamu, mencakup konsep inti dan latihan soal.";

/** Short blurb on what the student will learn — shown when a user expands an offering's info
 * panel while picking subjects to add/upgrade. */
export function getSubjectInfo(offering: OfferingMapping): string {
  const key = normalizeSubjectKey(offering.subject ?? offering.name);
  return SUBJECT_INFO[key] ?? DEFAULT_DESCRIPTION;
}
