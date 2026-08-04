// Vercel function for the NEW upgrade portal only — deliberately a separate file from
// api/schedule.js (which stays untouched for whatever depends on it, e.g. the legacy portal).
//
// Proxies the same AWS API Gateway class-schedule endpoint api/schedule.js does, with the same
// fixed year/curriculum (sem=1 — confirmed correct against real data, unlike sem=2 which returned
// an empty array for every kelas/subject combination) — the `subject` param here comes straight
// from `offering_mapping_to_grade.subject` (not a regex-derived bare subject), no `frequency`
// param.
const SCHEDULE_BASE_URL = "https://e2oc2ege54.execute-api.ap-southeast-1.amazonaws.com/slotschedule";

// The AWS feed above never returns a real per-slot id/name — only a `course_id` shared by every
// slot of a course. The colearn.id public schedule site publishes a richer, per-grade JSON dump
// that does have a real `slot_id` + `slot_name` (e.g. "Matematika 4 (2x)"), confirmed to describe
// the exact same underlying slots (matching course_id, slot_start_date, UTC+7 time offset, and
// seat math against the AWS feed). We cross-reference it here, best-effort, to enrich slot_label.
const MEDIA_SESSIONS_BASE_URL = process.env.MEDIA_SESSIONS_URL || "https://media.sessions.colearn.id";

function normalizeTeacherKey(teacher) {
  return String(teacher ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeDaysKey(daysInput) {
  const tokens = Array.isArray(daysInput) ? daysInput : String(daysInput ?? "").split(",");
  return tokens
    .map((token) => String(token).trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join("|");
}

function matchKey(courseId, teacher, days) {
  return `${String(courseId ?? "").toLowerCase()}::${normalizeTeacherKey(teacher)}::${normalizeDaysKey(days)}`;
}

// Converts a UTC "HH:MM"-"HH:MM" pair from the media-sessions feed into WIB (UTC+7), formatted
// the same way the AWS feed's `time` field already is — used only to disambiguate the rare case
// of multiple media-sessions entries sharing the same course/teacher/days key.
function toWibTimeRange(startHHMM, endHHMM) {
  const toWib = (hhmm) => {
    const [h, m] = String(hhmm ?? "").split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    const wibHour = (h + 7) % 24;
    return `${String(wibHour).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };
  const start = toWib(startHHMM);
  const end = toWib(endHHMM);
  if (!start || !end) return null;
  return `${start} - ${end}`;
}

// Never throws — media-sessions is an enrichment source, not the source of truth. Any failure
// (network error, non-2xx, bad JSON, timeout) must fall back to an empty lookup so the endpoint
// keeps working exactly as it does today, just without the slot_id/slot_name enrichment.
async function fetchMediaSessionsSchedule(kelas) {
  const url = `${MEDIA_SESSIONS_BASE_URL}/assets/other/schedule/${encodeURIComponent(kelas)}-schedule.json`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) {
      console.warn(`[class-schedule] media-sessions fetch returned ${response.status}, continuing without it`);
      return [];
    }
    const json = await response.json();
    // The feed wraps the slot array as `{ data: [...], updatedAt }`, not a bare array.
    if (Array.isArray(json)) return json;
    return Array.isArray(json?.data) ? json.data : [];
  } catch (error) {
    console.warn("[class-schedule] media-sessions fetch failed, continuing without it:", error);
    return [];
  }
}

function buildMediaSessionsLookup(entries) {
  const lookup = new Map();
  for (const entry of entries) {
    if (entry?.slot_status !== "published") continue;
    if (String(entry?.curriculum ?? "").trim().toLowerCase() !== "kurikulum merdeka") continue;

    const key = matchKey(entry.course_id, entry.slot_teacher_name, entry.slot_days);
    const bucket = lookup.get(key);
    if (bucket) bucket.push(entry);
    else lookup.set(key, [entry]);
  }
  return lookup;
}

// Returns the matching media-sessions entry for an AWS slot, or `null` if none/ambiguous — never
// guesses, since a wrong slot_id would be worse than falling back to the legacy label.
function matchMediaSession(lookup, courseId, teacher, days, time) {
  const candidates = lookup.get(matchKey(courseId, teacher, days)) ?? [];
  if (candidates.length === 1) return candidates[0];
  if (candidates.length === 0) return null;

  const exact = candidates.filter(
    (candidate) => toWibTimeRange(candidate.slot_start_time, candidate.slot_end_time) === time,
  );
  return exact.length === 1 ? exact[0] : null;
}

function buildSlotLabel({ slot_id, slot_name, days, time }) {
  return `ID: ${slot_id}\nName: ${slot_name}\nDays: ${days}\nTime: ${time}`;
}

export default async function handler(req, res) {
  const { kelas, subject } = req.query;

  const url = `${SCHEDULE_BASE_URL}?kelas=${encodeURIComponent(kelas)}&sem=1&year=2026&curriculum=Kurikulum%20Merdeka&subject=${encodeURIComponent(subject)}`;

  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const [response, mediaEntries] = await Promise.all([fetch(url), fetchMediaSessionsSchedule(kelas)]);
    const raw = await response.json();
    const lookup = buildMediaSessionsLookup(mediaEntries);

    // `course_id` identifies the course/subject, NOT a specific schedule slot — every slot under
    // the same subject shares one course_id. Using it alone as slot_label made every slot look
    // identical, so selecting one visually selected all of them. day+time+teacher (+ course_id as
    // a tie-breaker) is what's actually unique per slot.
    const slots = (Array.isArray(raw) ? raw : []).map((item) => {
      const day = item.days ?? item.day ?? "";
      const time = item.time ?? item.session_time ?? "";
      const teacher = item.teacher ?? item.teacher_name ?? "";
      const match = matchMediaSession(lookup, item.course_id, teacher, day, time);

      return {
        day,
        time,
        teacher,
        seats_remaining: Number(item.seatsLeft ?? item.sisa_kursi ?? item.seats_remaining ?? 0),
        slot_id: match?.slot_id,
        slot_name: match?.slot_name,
        slot_label: match
          ? buildSlotLabel({ slot_id: match.slot_id, slot_name: match.slot_name, days: match.slot_days.join(","), time })
          : (item.slotName ?? item.slot_name ?? `${day}-${time}-${teacher}-${item.course_id ?? ""}`),
        // "YYYY-MM-DD" — when this slot's class actually starts. Used to badge whether it's
        // already running, starts today, or starts on a future date (see classStartLabel in
        // src/lib/format.ts). Not `item.classStarted` directly: that's the upstream's own
        // today-relative boolean, which can't distinguish "starts today" from "starts in future".
        slot_start_date: item.slot_start_date ?? null,
      };
    });

    res.status(200).json(slots);
  } catch (error) {
    res.status(500).json({ error: "proxy failed" });
  }
}
