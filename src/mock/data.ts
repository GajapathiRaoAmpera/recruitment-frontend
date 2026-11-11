// Demo data — clearly fictional. Deterministic (seeded) so screenshots and tests are stable.
import type {
  AiPrompt,
  AuditLog,
  Candidate,
  College,
  Drive,
  EmailLog,
  Interview,
  Question,
  Round,
  RoundResult,
  StaffUser,
  VerificationLog,
  Violation,
} from "./types";

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const NAMES = [
  "Aarav Sharma", "Ananya Patel", "Vikram Kulkarni", "Devansh Gupta", "Sneha Roy", "Rohan Mehta",
  "Ishita Verma", "Karan Singh", "Meera Nambiar", "Aditya Rao", "Priya Iyer", "Siddharth Nair",
  "Tanvi Kulkarni", "Arjun Reddy", "Kavya Menon", "Rahul Joshi", "Neha Bhat", "Varun Malhotra",
  "Pooja Desai", "Nikhil Chawla", "Riya Kapoor", "Harsh Vardhan", "Diya Banerjee", "Kabir Shetty",
];
const BRANCHES = ["B.Tech CSE", "B.Tech IT", "B.Tech ECE", "B.Tech Data Science"];
const SKILLS = ["Python", "Java", "C++", "Go", "SQL", "React", "Node.js", "Docker", "DSA", "FastAPI", "Spring", "Git", "Linux", "AWS"];

export const DEMO_STUDENT = { studentId: "ABC23CS014", dob: "2004-05-14" };

export const staff: StaffUser[] = [
  { id: "u1", name: "Priya Sharma", email: "priya.sharma@ampera.tech", title: "Campus Talent Lead", role: "HR", active: true, lastLogin: "Today, 09:42" },
  { id: "u2", name: "Alex Chen", email: "alex.chen@ampera.tech", title: "Platform Owner", role: "SUPER_ADMIN", active: true, lastLogin: "Today, 08:15" },
  { id: "u3", name: "Sneha Rao", email: "sneha.rao@ampera.tech", title: "Campus Relations", role: "HR", active: true, lastLogin: "Yesterday, 16:15" },
  { id: "u4", name: "Anita Deshmukh", email: "anita.d@ampera.tech", title: "Sourcing Specialist", role: "HR", active: false, lastLogin: "14 days ago" },
];

export const drives: Drive[] = [
  {
    id: "d1", company: "Ampera Technologies", campus: "ABC Engineering College", roleTitle: "Software Engineer – Campus 2027",
    jd: "Build backend services in Python/Go, design REST APIs and work with SQL databases. Strong DSA required.",
    status: "active", window: "Mar 25 – Apr 04", ownerId: "u1",
  },
  {
    id: "d2", company: "Ampera Technologies", campus: "BITS Pilani", roleTitle: "Full Stack Engineer – 2027 Batch",
    jd: "Ship React frontends and Node/Java services end to end. Good grasp of system design basics.",
    status: "active", window: "Mar 10 – Mar 29", ownerId: "u1",
  },
  {
    id: "d3", company: "Ampera Technologies", campus: "IIIT Hyderabad", roleTitle: "Data & AI Engineer Intern",
    jd: "Python, SQL, data pipelines and ML fundamentals. Exposure to FastAPI is a plus.",
    status: "draft", window: "Apr 08 – Apr 18", ownerId: "u3",
  },
];

const roundTitle: Record<Round["type"], string> = {
  shortlist: "Resume shortlist",
  aptitude: "Round 1 · Aptitude & technical",
  coding: "Round 2 · Coding",
  ai_interview: "Round 3 · AI interview",
  technical: "Extra technical round",
  final: "Final interview",
};

function makeRounds(driveId: string, statuses: Round["status"][]): Round[] {
  const types: Round["type"][] = ["shortlist", "aptitude", "coding", "ai_interview", "final"];
  return types.map((type, i) => ({
    id: `${driveId}-r${i}`,
    driveId,
    position: i,
    type,
    title: roundTitle[type],
    mode: type === "ai_interview" ? "ai" : type === "final" ? "manual" : "auto",
    status: statuses[i]!,
    threshold: type === "aptitude" ? 60 : type === "coding" ? 50 : undefined,
    durationMin: type === "aptitude" ? 30 : type === "coding" ? 60 : type === "ai_interview" ? 20 : undefined,
    questionIds: type === "aptitude" ? MCQ_IDS : type === "coding" ? CODING_IDS : undefined,
  }));
}

export { roundTitle };

export const questions: Question[] = [
  { id: "q1", kind: "mcq", title: "Train speed", body: "A train 150 m long passes a pole in 15 s. What is its speed in km/h?", options: ["30", "36", "40", "45"], answer: 1, tags: ["quant"], difficulty: "easy", marks: 1, aiGenerated: true, approved: true },
  { id: "q2", kind: "mcq", title: "Work rate", body: "A can finish a job in 12 days and B in 18 days. Working together, how many days do they need?", options: ["6.6", "7.2", "8", "9"], answer: 1, tags: ["quant"], difficulty: "medium", marks: 1, aiGenerated: true, approved: true },
  { id: "q3", kind: "mcq", title: "Series", body: "Find the next number: 2, 6, 12, 20, 30, ?", options: ["40", "42", "44", "48"], answer: 1, tags: ["reasoning"], difficulty: "easy", marks: 1, aiGenerated: true, approved: true },
  { id: "q4", kind: "mcq", title: "Syllogism", body: "All coders are thinkers. Some thinkers are artists. Which conclusion definitely follows?", options: ["All coders are artists", "Some artists are coders", "No conclusion follows", "All artists are thinkers"], answer: 2, tags: ["reasoning"], difficulty: "medium", marks: 1, aiGenerated: false, approved: true },
  { id: "q5", kind: "mcq", title: "Binary search", body: "What is the worst-case time complexity of binary search on a sorted array of n elements?", options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"], answer: 1, tags: ["technical", "dsa"], difficulty: "easy", marks: 1, aiGenerated: true, approved: true },
  { id: "q6", kind: "mcq", title: "SQL join", body: "Which join returns all rows from the left table and matching rows from the right table?", options: ["INNER JOIN", "LEFT JOIN", "RIGHT JOIN", "CROSS JOIN"], answer: 1, tags: ["technical", "sql"], difficulty: "easy", marks: 1, aiGenerated: true, approved: true },
  { id: "q7", kind: "mcq", title: "Stack", body: "Which data structure is used to evaluate a postfix expression?", options: ["Queue", "Stack", "Heap", "Graph"], answer: 1, tags: ["technical", "dsa"], difficulty: "easy", marks: 1, aiGenerated: true, approved: true },
  { id: "q8", kind: "mcq", title: "HTTP status", body: "Which HTTP status code means the client is authenticated but not allowed to access the resource?", options: ["401", "403", "404", "409"], answer: 1, tags: ["technical", "web"], difficulty: "medium", marks: 1, aiGenerated: true, approved: true },
  { id: "q9", kind: "mcq", title: "Percentages", body: "A price rises by 20% and then falls by 20%. The net change is:", options: ["0%", "4% decrease", "4% increase", "2% decrease"], answer: 1, tags: ["quant"], difficulty: "medium", marks: 1, aiGenerated: true, approved: true },
  { id: "q10", kind: "mcq", title: "Hashing", body: "Average time complexity of lookup in a hash table with a good hash function is:", options: ["O(1)", "O(log n)", "O(n)", "O(n²)"], answer: 0, tags: ["technical", "dsa"], difficulty: "easy", marks: 1, aiGenerated: true, approved: true },
  {
    id: "c1", kind: "coding", title: "Two Sum", tags: ["arrays", "hashing"], difficulty: "easy", marks: 10, aiGenerated: false, approved: true, hiddenCount: 15,
    body: "Given an array of integers and a target, print the indices (0-based, ascending) of the two numbers that add up to the target. Input: first line n and target, second line n integers.",
    samples: [
      { input: "4 9\n2 7 11 15", expected: "0 1" },
      { input: "3 6\n3 2 4", expected: "1 2" },
      { input: "2 6\n3 3", expected: "0 1" },
    ],
  },
  {
    id: "c2", kind: "coding", title: "Valid Brackets", tags: ["stack", "strings"], difficulty: "medium", marks: 15, aiGenerated: true, approved: true, hiddenCount: 15,
    body: "Given a string of brackets ()[]{} print YES if every bracket is closed in the correct order, otherwise NO.",
    samples: [
      { input: "()[]{}", expected: "YES" },
      { input: "([)]", expected: "NO" },
      { input: "{[]}", expected: "YES" },
    ],
  },
  {
    id: "c3", kind: "coding", title: "Top Earners (SQL)", tags: ["sql"], difficulty: "advanced", marks: 20, aiGenerated: true, approved: true, hiddenCount: 15,
    body: "Table employees(id, name, dept, salary). Return name and dept of the highest-paid employee in each department, ordered by dept.",
    samples: [
      { input: "3 rows, 2 depts", expected: "Asha|Eng\nRavi|Sales" },
      { input: "1 row", expected: "Mina|Ops" },
      { input: "ties", expected: "Kiran|Eng\nLeela|Eng" },
    ],
  },
  { id: "q11", kind: "mcq", title: "Deadlock", body: "Which condition is NOT required for a deadlock?", options: ["Mutual exclusion", "Hold and wait", "Preemption", "Circular wait"], answer: 2, tags: ["technical", "os"], difficulty: "medium", marks: 1, aiGenerated: true, approved: false },
  { id: "q12", kind: "mcq", title: "Clock angle", body: "What is the angle between the hands of a clock at 3:15?", options: ["0°", "7.5°", "15°", "22.5°"], answer: 1, tags: ["quant"], difficulty: "advanced", marks: 1, aiGenerated: true, approved: false },
];

const MCQ_IDS = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9", "q10"];
const CODING_IDS = ["c1", "c2", "c3"];

function makeCandidates(driveId: string, prefix: string, count: number, seed: number): Candidate[] {
  const r = rng(seed);
  return Array.from({ length: count }, (_, i) => {
    const name = NAMES[(i + seed) % NAMES.length]!;
    const skills = SKILLS.filter(() => r() < 0.3).slice(0, 4);
    return {
      id: `${driveId}-c${i}`,
      driveId,
      studentId: `${prefix}${String(i + 1).padStart(3, "0")}`,
      dob: `200${3 + (i % 3)}-0${1 + (i % 9)}-1${i % 9}`,
      name,
      email: `${name.split(" ")[0]!.toLowerCase()}.${i}@student.example.edu`,
      branch: BRANCHES[i % BRANCHES.length]!,
      cgpa: Math.round((6.5 + r() * 3.3) * 10) / 10,
      skills: skills.length ? skills : ["Python", "SQL"],
      jdMatch: Math.round(48 + r() * 50),
      parseStatus: r() < 0.06 ? "failed" : "ok",
      shortlisted: null,
    };
  });
}

// Drive A: shortlist done, Round 1 live. The demo student (Aarav) is invited and has not started.
const d1Candidates = makeCandidates("d1", "ABC23CS", 24, 0).map((c, i) =>
  i === 0 ? { ...c, studentId: DEMO_STUDENT.studentId, dob: DEMO_STUDENT.dob, name: "Aarav Sharma", email: "aarav.sharma@student.example.edu", cgpa: 9.4, jdMatch: 96, skills: ["Python", "Go", "SQL", "DSA"], parseStatus: "ok" as const } : c,
);
d1Candidates.forEach((c, i) => (c.shortlisted = i < 18));

// Drive B: everything done up to the final interview.
const d2Candidates = makeCandidates("d2", "BITS23", 20, 7);
d2Candidates.forEach((c, i) => (c.shortlisted = i < 16));

// Drive C: resumes imported, nobody shortlisted yet.
const d3Candidates = makeCandidates("d3", "IIITH23", 15, 13);

export const candidates: Candidate[] = [...d1Candidates, ...d2Candidates, ...d3Candidates];

export const rounds: Round[] = [
  ...makeRounds("d1", ["completed", "active", "pending", "pending", "pending"]),
  ...makeRounds("d2", ["completed", "completed", "completed", "completed", "active"]),
  ...makeRounds("d3", ["active", "pending", "pending", "pending", "pending"]),
];

function scoresFor(list: Candidate[], roundId: string, seed: number, max: number): RoundResult[] {
  const r = rng(seed);
  return list.map((c) => ({
    roundId,
    candidateId: c.id,
    status: "submitted" as const,
    score: Math.round((0.35 + r() * 0.65) * max),
    maxScore: max,
    timeTakenMin: Math.round(14 + r() * 16),
    tabSwitches: r() < 0.15 ? 1 : 0,
    locked: false,
  }));
}

function passTop(results: RoundResult[], n: number): RoundResult[] {
  const ranked = [...results].sort((a, b) => b.score! - a.score! || a.timeTakenMin! - b.timeTakenMin!);
  const top = new Set(ranked.slice(0, n).map((x) => x.candidateId));
  return results.map((x) => ({ ...x, status: top.has(x.candidateId) ? "passed" : "failed" }));
}

const d1Short = d1Candidates.filter((c) => c.shortlisted);
const d1R1 = scoresFor(d1Short, "d1-r1", 3, 10).map((x, i): RoundResult => {
  if (i === 0) return { roundId: x.roundId, candidateId: x.candidateId, status: "invited", tabSwitches: 0, locked: false };
  if (i === 1) return { ...x, status: "in_progress", score: undefined, tabSwitches: 3, locked: true };
  if (i === 5 || i === 9) return { ...x, status: "in_progress", score: undefined, timeTakenMin: undefined };
  return x;
});

const d2Short = d2Candidates.filter((c) => c.shortlisted);
const d2R1 = passTop(scoresFor(d2Short, "d2-r1", 11, 10), 10);
const d2R1Passed = d2Short.filter((c) => d2R1.find((x) => x.candidateId === c.id)!.status === "passed");
const d2R2 = passTop(
  scoresFor(d2R1Passed, "d2-r2", 17, 45).map((x) => ({ ...x, passedCases: Math.round((x.score! / 45) * 54), totalCases: 54 })),
  6,
);
const d2R2Passed = d2R1Passed.filter((c) => d2R2.find((x) => x.candidateId === c.id)!.status === "passed");
const d2R3 = d2R2Passed.map((c, i): RoundResult => ({
  roundId: "d2-r3", candidateId: c.id, status: "passed", score: [4.8, 4.6, 4.5, 4.2, 4.1, 3.9][i] ?? 4, maxScore: 5, tabSwitches: 0, locked: false,
}));
const d2R4 = d2R2Passed.map((c, i): RoundResult => ({
  roundId: "d2-r4", candidateId: c.id, status: i < 2 ? "selected" : "invited", tabSwitches: 0, locked: false,
}));

const shortlistResults = (list: Candidate[], roundId: string): RoundResult[] =>
  list.map((c) => ({ roundId, candidateId: c.id, status: c.shortlisted ? "passed" : "failed", tabSwitches: 0, locked: false }));

export const results: RoundResult[] = [
  ...shortlistResults(d1Candidates, "d1-r0"),
  ...d1R1,
  ...shortlistResults(d2Candidates, "d2-r0"),
  ...d2R1,
  ...d2R2,
  ...d2R3,
  ...d2R4,
];

export const violations: Violation[] = [
  { id: "v1", roundId: "d1-r1", candidateId: d1Short[1]!.id, kind: "tab_switch", at: "10:12:04" },
  { id: "v2", roundId: "d1-r1", candidateId: d1Short[1]!.id, kind: "tab_switch", at: "10:15:40" },
  { id: "v3", roundId: "d1-r1", candidateId: d1Short[1]!.id, kind: "tab_switch", at: "10:16:02" },
  ...d1R1.filter((x) => x.tabSwitches === 1).map((x, i): Violation => ({ id: `vx${i}`, roundId: "d1-r1", candidateId: x.candidateId, kind: "tab_switch", at: `10:2${i}:11` })),
];

const SAMPLE_TRANSCRIPT = [
  { role: "ai" as const, text: "Hi, I'm the Ampera interviewer. Could you introduce yourself and a project you're proud of?" },
  { role: "candidate" as const, text: "I'm a final-year CSE student. I built a REST API for a college events app in FastAPI with PostgreSQL and deployed it on Render." },
  { role: "ai" as const, text: "How did you design the database for events and registrations?" },
  { role: "candidate" as const, text: "Events, users and a registrations join table with a unique constraint on user and event so nobody registers twice." },
  { role: "ai" as const, text: "What would you change if traffic grew ten times?" },
  { role: "candidate" as const, text: "Add indexes on the foreign keys, cache the event list, and move email sending to a background queue." },
  { role: "ai" as const, text: "Thank you, that's the end of the interview. HR will be in touch with next steps." },
];

export const interviews: Interview[] = d2R2Passed.map((c, i) => ({
  id: `i${i}`,
  roundId: "d2-r3",
  candidateId: c.id,
  slot: ["10:00", "10:30", "11:00", "11:30", "14:00", "14:30"][i] ?? "15:00",
  status: "completed",
  transcript: SAMPLE_TRANSCRIPT,
  aiScores: {
    communication: [5, 4, 4, 4, 4, 3][i] ?? 4,
    technical: [5, 5, 4, 4, 4, 4][i] ?? 4,
    problemSolving: [4, 5, 5, 4, 4, 4][i] ?? 4,
    culture: [5, 4, 5, 5, 4, 4][i] ?? 4,
    summary: "Clear communicator with solid backend fundamentals; reasoned well about scaling and data integrity.",
  },
  hrNotes: i === 0 ? "Strong — fast-track to final." : "",
}));

export const verificationLogs: VerificationLog[] = d1Short.slice(1, 15).flatMap((c) =>
  (["id_dob", "location", "terms", "fullscreen"] as const).map((step) => ({ roundId: "d1-r1", candidateId: c.id, step, ok: true, at: "10:0" + (step.length % 9) })),
);

export const emailLogs: EmailLog[] = d1Short.map((c, i) => ({ id: `e${i}`, roundId: "d1-r1", to: c.email, template: "Round 1 invite", at: "Mar 24, 18:00" }));

export const colleges: College[] = [
  { id: "col1", name: "ABC Engineering College", city: "Pune", tpo: "Prof. R. Kulkarni", tpoEmail: "tpo@abc.example.edu", registered: 320, hired: 0 },
  { id: "col2", name: "BITS Pilani", city: "Pilani", tpo: "Prof. K. Sundaram", tpoEmail: "placement@bits.example.edu", registered: 180, hired: 2 },
  { id: "col3", name: "IIIT Hyderabad", city: "Hyderabad", tpo: "Dr. S. Reddy", tpoEmail: "tpo@iiith.example.edu", registered: 140, hired: 0 },
];

export const auditLogs: AuditLog[] = [
  { id: "a3", at: "Mar 27, 14:32", actor: "Priya Sharma", action: "Corrected answer key", target: "Question q9 (Percentages)" },
  { id: "a2", at: "Mar 27, 11:05", actor: "Priya Sharma", action: "Advanced round (threshold 50)", target: "Full Stack Engineer · Round 2" },
  { id: "a1", at: "Mar 26, 09:40", actor: "Alex Chen", action: "Updated AI prompt", target: "interview_system v3" },
];

export const prompts: AiPrompt[] = [
  { key: "question_gen_mcq", label: "MCQ generation", version: 2, body: "Generate {count} {difficulty} multiple-choice questions on {tags}. Return JSON: [{title, body, options[4], answer_index}]. No ambiguous options." },
  { key: "interview_system", label: "AI interviewer (Gemini Live)", version: 3, body: "You are a friendly technical interviewer for {role_title}. Ask 4–6 questions based on the JD and the candidate's resume skills. One question at a time. End with a thank-you." },
  { key: "interview_eval", label: "Interview evaluation", version: 1, body: "Score the transcript 1–5 on communication, technical depth, problem solving and culture fit. Return JSON {communication, technical, problemSolving, culture, summary}." },
];
