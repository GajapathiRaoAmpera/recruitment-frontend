import { getRoundProgress, listRounds, type RoundProgress } from "@/api/hiring";
import { getInterview, isScored, listInterviews } from "@/api/interviews";
import { getTestResults, type TestResults } from "@/api/results";
import { getRanking, getRoundTest, type Ranking } from "@/api/rounds";
import { buildStudents, clamp, type AiRatings, type RoundMeta, type Student, type StudentRaw, type StudentRound } from "./scoring";

export interface DriveAnalytics {
  driveId: string;
  rounds: RoundMeta[];
  students: Student[];
  /** Pieces that couldn't be read (a round's ranking, the interviews ...). The page still shows everything else. */
  warnings: string[];
}

const TIMED = new Set(["aptitude", "coding", "technical"]);
const secondsBetween = (a: string | null, b: string | null) => (a && b ? Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 1000) : null);

/**
 * Reads everything the Analytics page needs for one drive: per round the live progress (who is in it, tab switches, result),
 * the ranking (percent score and time taken) for test rounds, coding test-case results, and the AI interview ratings.
 * Every piece is optional: a failed read becomes a warning, never an empty page.
 */
export async function loadDriveAnalytics(driveId: string): Promise<DriveAnalytics> {
  const warnings: string[] = [];
  const soft = <T,>(label: string, p: Promise<T>): Promise<T | null> =>
    p.catch(() => {
      warnings.push(label);
      return null;
    });

  const all = await listRounds(driveId);
  const roundList = all.filter((r) => r.type !== "shortlist" && r.status !== "skipped").sort((a, b) => a.position - b.position);

  const perRound = await Promise.all(
    roundList.map(async (r) => {
      const timed = TIMED.has(r.type);
      const [progress, ranking, test] = await Promise.all([
        soft(`progress of round ${r.position}`, getRoundProgress(driveId, r.id)),
        timed ? soft(`ranking of round ${r.position}`, getRanking(r.id)) : Promise.resolve(null),
        timed ? soft(`test of round ${r.position}`, getRoundTest(r.id)) : Promise.resolve(null),
      ]);
      const results = r.type === "coding" && test ? await soft(`coding results of round ${r.position}`, getTestResults(test.id)) : null;
      return { r, progress: progress as RoundProgress | null, ranking: ranking as Ranking | null, durationSec: test?.durationSec ?? null, testId: test?.id ?? null, results: results as TestResults | null };
    }),
  );

  const rounds: RoundMeta[] = perRound.map(({ r, durationSec, testId }) => ({ id: r.id, type: r.type, position: r.position, status: r.status, durationSec, testId }));

  // AI interview ratings, one request per scored interview.
  const ratings = new Map<string, AiRatings>();
  if (roundList.some((r) => r.type === "ai_interview")) {
    const rows = (await soft("AI interviews", listInterviews({ driveId }))) ?? [];
    const scored = rows.filter((i) => i.scoring === "done");
    const details = await Promise.all(scored.map((i) => getInterview(i.id).catch(() => null)));
    details.forEach((d, i) => {
      if (d && isScored(d.aiScores)) {
        const s = d.aiScores;
        ratings.set(scored[i]!.candidateId, { communication: s.communication, technicalDepth: s.technicalDepth, problemSolving: s.problemSolving, culture: s.culture });
      }
    });
  }

  // A student is anyone invited to at least one round of the drive.
  const students = new Map<string, StudentRaw>();
  for (const { r, progress, ranking, durationSec, results } of perRound) {
    const rank = new Map((ranking?.candidates ?? []).map((c) => [c.candidateId, c]));
    const coding = new Map((results?.candidates ?? []).map((c) => [c.candidateId, c]));
    for (const row of progress?.candidates ?? []) {
      const rk = rank.get(row.candidateId);
      const cr = coding.get(row.candidateId);
      const passed = cr?.answers.reduce((n, a) => n + (a.passed ?? 0), 0) ?? 0;
      const total = cr?.answers.reduce((n, a) => n + (a.total ?? 0), 0) ?? 0;
      const timeSec = rk?.timeTakenSec ?? secondsBetween(row.startedAt, row.submittedAt);
      const entry: StudentRound = {
        roundId: r.id,
        type: r.type,
        status: row.status,
        percent: rk?.percent ?? null,
        codingPercent: total > 0 ? (passed / total) * 100 : null,
        timeSec,
        timeUsedPct: timeSec !== null && durationSec ? clamp((timeSec / durationSec) * 100) : null,
        tabSwitches: row.tabSwitches,
        rank: rk?.rank ?? null,
        attempted: row.attemptStatus !== null,
      };
      const s = students.get(row.candidateId) ?? { id: row.candidateId, studentId: row.studentId, name: row.fullName, rounds: [], ai: ratings.get(row.candidateId) ?? null };
      s.rounds.push(entry);
      students.set(row.candidateId, s);
    }
  }

  return { driveId, rounds, students: buildStudents([...students.values()]), warnings };
}
