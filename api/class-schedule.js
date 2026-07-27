// Vercel function for the NEW upgrade portal only — deliberately a separate file from
// api/schedule.js (which stays untouched for whatever depends on it, e.g. the legacy portal).
//
// Proxies the same AWS API Gateway class-schedule endpoint api/schedule.js does, with the same
// fixed year/curriculum (sem=1 — confirmed correct against real data, unlike sem=2 which returned
// an empty array for every kelas/subject combination) — the `subject` param here comes straight
// from `offering_mapping_to_grade.subject` (not a regex-derived bare subject), no `frequency`
// param.
const SCHEDULE_BASE_URL = "https://e2oc2ege54.execute-api.ap-southeast-1.amazonaws.com/slotschedule";

export default async function handler(req, res) {
  const { kelas, subject } = req.query;

  const url = `${SCHEDULE_BASE_URL}?kelas=${encodeURIComponent(kelas)}&sem=1&year=2026&curriculum=Kurikulum%20Merdeka&subject=${encodeURIComponent(subject)}`;

  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const response = await fetch(url);
    const raw = await response.json();

    // `course_id` identifies the course/subject, NOT a specific schedule slot — every slot under
    // the same subject shares one course_id. Using it alone as slot_label made every slot look
    // identical, so selecting one visually selected all of them. day+time+teacher (+ course_id as
    // a tie-breaker) is what's actually unique per slot.
    const slots = (Array.isArray(raw) ? raw : []).map((item) => {
      const day = item.days ?? item.day ?? "";
      const time = item.time ?? item.session_time ?? "";
      const teacher = item.teacher ?? item.teacher_name ?? "";
      return {
        day,
        time,
        teacher,
        seats_remaining: Number(item.seatsLeft ?? item.sisa_kursi ?? item.seats_remaining ?? 0),
        slot_label: item.slotName ?? item.slot_name ?? `${day}-${time}-${teacher}-${item.course_id ?? ""}`,
      };
    });

    res.status(200).json(slots);
  } catch (error) {
    res.status(500).json({ error: "proxy failed" });
  }
}
