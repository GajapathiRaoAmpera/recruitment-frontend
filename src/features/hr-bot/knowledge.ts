import type { Role } from "@/mock/types";

/**
 * Everything the HR assistant knows. Pure data: no API calls, no database.
 * A link href may contain `{driveId}`; it is filled from the page the user is on,
 * and the link is dropped when they are not inside a drive (`fallback` is used instead, if given).
 */
export interface BotLink {
  label: string;
  href: string;
  fallback?: { label: string; href: string };
}

export interface Topic {
  id: string;
  title: string;
  /** Words and phrases HR might type. Phrases count more than single words. */
  keywords: string[];
  answer: string;
  steps?: string[];
  links: BotLink[];
  related?: string[];
  adminOnly?: boolean;
}

export const topics: Topic[] = [
  {
    id: "getting-started",
    title: "New here? A quick tour",
    keywords: ["help", "new", "i am new", "joined", "how to use", "new hr", "getting started", "start", "tour", "first time", "onboarding", "overview", "how does it work", "what can i do", "guide", "basics", "workflow", "process", "end to end", "flow"],
    answer: "Here is how a campus drive runs from start to finish:",
    steps: [
      "Create a drive with the company, campus, role, job description and dates.",
      "Add rounds (aptitude, coding, AI interview, technical, final) with cut-offs and time limits.",
      "Import candidates from the Google Form sheet. Resumes are fetched and read automatically.",
      "Shortlist candidates with skills, CGPA and JD-match filters.",
      "Build the Round 1 aptitude paper and send it to shortlisted candidates.",
      "Send round invites, watch progress and integrity alerts, then advance at the cut-off.",
      "Review AI interviews, make decisions, check the final ranking and analytics.",
      "Close the drive and download the PDF report.",
    ],
    links: [
      { label: "Dashboard", href: "/hr" },
      { label: "Create a drive", href: "/hr/drives/new" },
    ],
    related: ["create-drive", "import-candidates", "shortlist", "build-paper"],
  },
  {
    id: "dashboard",
    title: "The dashboard",
    keywords: ["dashboard", "home", "main page", "summary", "ongoing drives", "awaiting cut-off", "at a glance"],
    answer: "The dashboard shows ongoing drives, rounds awaiting a cut-off, integrity alerts, selected candidates and recent interviews. Click any card to jump straight to that drive, round or interview.",
    links: [{ label: "Open dashboard", href: "/hr" }],
    related: ["drive-details", "integrity-alerts"],
  },
  {
    id: "create-drive",
    title: "Create a campus drive",
    keywords: ["create drive", "new drive", "add drive", "start drive", "make drive", "setup drive", "set up drive", "campus drive", "launch drive", "create"],
    answer: "Drives → New drive opens a short wizard:",
    steps: [
      "Drive details: company, campus, role title, job description, first and last day.",
      "Rounds & rules: add rounds, pick AI-led or Manual, set the cut-off % and minutes. One extra technical round is allowed per drive.",
      "Review & create: check everything and create the drive.",
      "Next, import candidates from the drive's Candidates page.",
    ],
    links: [
      { label: "New drive", href: "/hr/drives/new" },
      { label: "All drives", href: "/hr/drives" },
    ],
    related: ["rounds", "import-candidates"],
  },
  {
    id: "drive-details",
    title: "Find a drive's details",
    keywords: ["drive details", "drive status", "my drives", "list drives", "find drive", "which drive", "drive info", "how many candidates", "candidate count", "drive progress", "drive", "drives", "rounds completed", "shortlisted count", "selected count"],
    answer: "Open Drives and pick one. The drive page shows its rounds and status, plus counts for candidates, shortlisted, rounds completed and selected. From there you can open the candidates, any round or the final ranking.",
    links: [
      { label: "This drive", href: "/hr/drives/{driveId}", fallback: { label: "All drives", href: "/hr/drives" } },
      { label: "Dashboard", href: "/hr" },
    ],
    related: ["round-progress", "ranking", "report"],
  },
  {
    id: "import-candidates",
    title: "Import candidates and resumes",
    keywords: ["add students", "add student", "student list", "students", "import", "upload candidates", "add candidates", "google form", "sheet", "excel", "xlsx", "csv", "resume", "resumes", "upload resume", "zip", "pdf resume", "students list"],
    answer: "On the drive's Candidates page:",
    steps: [
      "Upload the Google Form export (.xlsx or .csv).",
      "Resumes linked in the sheet are fetched and read automatically. You can also upload PDFs or a .zip.",
      "Rows with problems are listed with their sheet row and student ID so you can fix and re-import them.",
      "To replace one candidate's resume, use their profile page.",
    ],
    links: [{ label: "This drive's candidates", href: "/hr/drives/{driveId}/candidates", fallback: { label: "Pick a drive", href: "/hr/drives" } }],
    related: ["shortlist", "candidate-profile"],
  },
  {
    id: "shortlist",
    title: "Shortlist candidates",
    keywords: ["shortlist", "short list", "filter candidates", "cgpa", "jd match", "skills filter", "select candidates", "reject", "undecided", "screening"],
    answer: "On the drive's Candidates page (Resume shortlist):",
    steps: [
      "Filter with Skills (must have all), Min CGPA and JD match.",
      "Use Show to switch between All, Shortlisted, Not shortlisted and Undecided.",
      "Tick candidates (or Select all shown) and shortlist them.",
      "Shortlisted candidates are invited to Round 1.",
    ],
    links: [{ label: "This drive's candidates", href: "/hr/drives/{driveId}/candidates", fallback: { label: "Pick a drive", href: "/hr/drives" } }],
    related: ["build-paper", "invites"],
  },
  {
    id: "candidate-profile",
    title: "View a candidate",
    keywords: ["candidate profile", "student profile", "candidate details", "view candidate", "resume analysis", "student details", "candidate score", "candidate"],
    answer: "Click a candidate's name anywhere (candidates list, ranking, interviews). Their profile shows contact details, CGPA, resume analysis, skills, and a score and result for each round.",
    links: [{ label: "This drive's candidates", href: "/hr/drives/{driveId}/candidates", fallback: { label: "Pick a drive", href: "/hr/drives" } }],
    related: ["analytics"],
  },
  {
    id: "rounds",
    title: "Rounds and cut-offs",
    keywords: ["round", "rounds", "cut-off", "cutoff", "cut off", "pass mark", "aptitude round", "coding round", "technical round", "final round", "round settings", "minutes", "duration", "ai-led", "manual"],
    answer: "A drive has rounds in order: shortlist, aptitude, coding, AI interview, technical and final. Each has a mode (AI-led or Manual), a cut-off % and a time limit. Open a round from the drive page to set it up, send invites, watch progress and advance.",
    links: [{ label: "This drive's rounds", href: "/hr/drives/{driveId}", fallback: { label: "Pick a drive", href: "/hr/drives" } }],
    related: ["round-progress", "advance", "coding-setup"],
  },
  {
    id: "build-paper",
    title: "Build the Round 1 aptitude paper",
    keywords: ["create questions", "questions", "question", "send paper", "edit question", "paper", "aptitude paper", "question paper", "build paper", "create paper", "generate questions", "round 1", "mcq", "aptitude questions", "paper builder", "non-it", "it track"],
    answer: "The paper builder has 4 steps: Setup → Generate → Review → Send.",
    steps: [
      "Setup: pick the drive, the IT or Non-IT track, and the question mix.",
      "Generate: AI writes the questions and checks them. Wait for progress to reach 100%.",
      "Review: read the checks, edit questions, and choose which questions students get. Then Accept (this locks the paper).",
      "Send: pick candidates (or select all) and send. Already-sent candidates are marked Sent.",
    ],
    links: [
      { label: "New paper", href: "/hr/papers/new?drive={driveId}", fallback: { label: "New paper", href: "/hr/papers/new" } },
      { label: "All papers", href: "/hr/papers" },
    ],
    related: ["rounds", "invites"],
  },
  {
    id: "coding-setup",
    title: "Set up the coding round",
    keywords: ["coding", "coding questions", "programming", "code test", "sql question", "test cases", "coding round setup", "judge"],
    answer: "Open the coding round from the drive page. First create the test (test settings), then add coding questions: pick from the bank, write your own, or generate them. SQL questions are supported. Save before leaving; unsaved changes are flagged.",
    links: [{ label: "This drive's rounds", href: "/hr/drives/{driveId}", fallback: { label: "Pick a drive", href: "/hr/drives" } }],
    related: ["invites", "round-progress"],
  },
  {
    id: "invites",
    title: "Send round invites",
    keywords: ["test link", "send link", "send test", "exam link", "share link", "invite", "invites", "email", "send email", "invitation", "mail", "sign-in link", "login link", "interview slot", "template", "notify"],
    answer: "On a round page, use Email invites: choose a template, and for interviews an interview slot, then send. Invited students get an email with their sign-in link.",
    links: [{ label: "This drive's rounds", href: "/hr/drives/{driveId}", fallback: { label: "Pick a drive", href: "/hr/drives" } }],
    related: ["round-progress"],
  },
  {
    id: "round-progress",
    title: "Watch a round live",
    keywords: ["progress", "live", "monitor", "who is writing", "still writing", "not started", "attempts", "track round", "status of round", "absent"],
    answer: "Open the round page. Each student shows as Not started, Still writing, Locked, or finished with a score. The dashboard also lists rounds awaiting a cut-off.",
    links: [
      { label: "This drive's rounds", href: "/hr/drives/{driveId}", fallback: { label: "Pick a drive", href: "/hr/drives" } },
      { label: "Dashboard", href: "/hr" },
    ],
    related: ["integrity-alerts", "advance"],
  },
  {
    id: "integrity-alerts",
    title: "Integrity alerts and locked tests",
    keywords: ["integrity", "alert", "alerts", "cheating", "tab switch", "fullscreen", "locked", "malpractice", "proctor", "unlock"],
    answer: "Leaving fullscreen or switching tabs raises an integrity alert, and repeat offences lock the test. The dashboard's Integrity alerts card links to the round's Alerts tab. When advancing, you can finish locked attempts with their current marks.",
    links: [{ label: "Dashboard", href: "/hr" }],
    related: ["advance"],
  },
  {
    id: "advance",
    title: "Advance a round (pass / fail)",
    keywords: ["who cleared", "see results", "round results", "advance", "advance round", "next round", "set cut-off", "set the cut-off", "pass", "fail", "promote", "move candidates", "result", "results", "qualify", "cleared"],
    answer: "On the round page, set the cut-off (%). You'll see counts for Pass, Fail, Locked and Still writing, and a ranking with percent and time taken. Confirm Advance this round? and students who pass move on to the next round.",
    links: [{ label: "This drive's rounds", href: "/hr/drives/{driveId}", fallback: { label: "Pick a drive", href: "/hr/drives" } }],
    related: ["ranking", "invites"],
  },
  {
    id: "interviews",
    title: "AI interviews",
    keywords: ["interview", "interviews", "ai interview", "round 3", "transcript", "ai score", "hr notes", "video", "camera", "evaluate", "voice"],
    answer: "Interviews lists every AI interview. Open one to see the transcript, camera stills, the AI score (advice only) and your HR notes. Hiring decisions are always made by HR.",
    links: [{ label: "Interviews", href: "/hr/interviews" }],
    related: ["decisions"],
  },
  {
    id: "decisions",
    title: "Make interview decisions",
    keywords: ["select final", "final candidates", "final selection", "selection", "who got selected", "decision", "decide", "select", "hire", "offer", "approve candidate", "reject candidate", "final decision", "selected"],
    answer: "On an interview or final round page, each student shows their AI score (advice) with a link to their interview. Set the decision for each student. Selected students show up on the dashboard and in the final ranking.",
    links: [
      { label: "Interviews", href: "/hr/interviews" },
      { label: "Final ranking", href: "/hr/drives/{driveId}/ranking", fallback: { label: "Pick a drive", href: "/hr/drives" } },
    ],
    related: ["ranking"],
  },
  {
    id: "ranking",
    title: "Final ranking",
    keywords: ["ranking", "rank", "final ranking", "leaderboard", "top candidates", "composite", "finalists", "merit"],
    answer: "Each drive has a final ranking of finalists by composite score, with their decision and actions. Candidates appear once they reach the final round.",
    links: [{ label: "Final ranking", href: "/hr/drives/{driveId}/ranking", fallback: { label: "Pick a drive", href: "/hr/drives" } }],
    related: ["report", "analytics"],
  },
  {
    id: "analytics",
    title: "Analytics",
    keywords: ["analytics", "analysis", "charts", "performance", "statistics", "stats", "compare students", "score band", "performance index", "insights", "graph"],
    answer: "Analytics shows round-by-round results for a drive: average and best scores, score bands, time used, skill profiles, the top students by performance index, and side-by-side student comparisons. Pick the drive at the top.",
    links: [{ label: "Analytics", href: "/hr/analytics" }],
    related: ["ranking", "report"],
  },
  {
    id: "report",
    title: "Download the drive report",
    keywords: ["report", "download", "pdf report", "export", "drive report", "summary report", "close drive", "closed"],
    answer: "Once a drive is closed, a Download report button appears at the top of its page. It downloads a branded PDF summary of the drive.",
    links: [{ label: "This drive", href: "/hr/drives/{driveId}", fallback: { label: "All drives", href: "/hr/drives" } }],
    related: ["analytics"],
  },
  {
    id: "account",
    title: "Your account and password",
    keywords: ["password", "forgot password", "reset password", "sign out", "logout", "log out", "profile", "account", "login"],
    answer: "Use the profile menu at the top right to sign out. Forgot your password? Use 'Forgot password' on the sign-in page.",
    links: [{ label: "Forgot password", href: "/forgot-password" }],
  },
  {
    id: "team-access",
    title: "Add a new HR user",
    keywords: ["add hr", "add new hr", "add another hr", "new hr user", "add user", "create user", "give access", "access", "invite hr", "colleague", "team member"],
    answer: "Only a Super Admin can add HR users (Admin → Users & roles). The new HR gets an email to set their password, and then sees only the drives they run.",
    links: [{ label: "Sign-in help", href: "/forgot-password" }],
    related: ["getting-started"],
  },
  {
    id: "change-owner",
    title: "Change who runs a drive",
    keywords: ["change hr", "reassign", "owner", "transfer drive", "assign drive", "run by"],
    answer: "Super Admins see a Change HR button on the drive page. HR users only see drives they run, so ask a Super Admin to reassign one.",
    links: [{ label: "This drive", href: "/hr/drives/{driveId}", fallback: { label: "All drives", href: "/hr/drives" } }],
  },
  {
    id: "admin",
    title: "Admin tools",
    keywords: ["admin", "users", "add hr", "add user", "roles", "colleges", "campus list", "ai settings", "audit", "audit logs", "who changed", "permissions"],
    answer: "The Admin section has Overview, Users & roles (add HR users), Colleges, AI settings and Audit logs (who changed what).",
    links: [
      { label: "Users & roles", href: "/admin/users" },
      { label: "Colleges", href: "/admin/colleges" },
      { label: "AI settings", href: "/admin/ai-settings" },
      { label: "Audit logs", href: "/admin/audit-logs" },
    ],
    adminOnly: true,
  },
];

/** Direct "take me to" destinations, matched before topics when the message is a navigation request. */
export interface Destination {
  label: string;
  href: string;
  words: string[];
  adminOnly?: boolean;
}

export const destinations: Destination[] = [
  { label: "Dashboard", href: "/hr", words: ["dashboard", "home"] },
  { label: "Drives", href: "/hr/drives", words: ["drives", "drive list", "all drives"] },
  { label: "New drive", href: "/hr/drives/new", words: ["new drive", "create drive"] },
  { label: "Interviews", href: "/hr/interviews", words: ["interviews", "interview"] },
  { label: "Analytics", href: "/hr/analytics", words: ["analytics"] },
  { label: "Paper builder", href: "/hr/papers", words: ["papers", "paper builder", "paper"] },
  { label: "Candidates", href: "/hr/drives/{driveId}/candidates", words: ["candidates", "shortlist"] },
  { label: "Final ranking", href: "/hr/drives/{driveId}/ranking", words: ["ranking", "final ranking"] },
  { label: "Users & roles", href: "/admin/users", words: ["users", "roles"], adminOnly: true },
  { label: "Audit logs", href: "/admin/audit-logs", words: ["audit", "audit logs"], adminOnly: true },
  { label: "AI settings", href: "/admin/ai-settings", words: ["ai settings"], adminOnly: true },
  { label: "Colleges", href: "/admin/colleges", words: ["colleges"], adminOnly: true },
];

/** Suggestion chips per page: what HR most likely needs where they are. First match wins. */
const pageSuggestions: { test: RegExp; label: string; ids: string[] }[] = [
  { test: /^\/hr\/drives\/new/, label: "creating a drive", ids: ["create-drive", "rounds", "import-candidates"] },
  { test: /^\/hr\/drives\/[^/]+\/candidates/, label: "candidates", ids: ["import-candidates", "shortlist", "candidate-profile"] },
  { test: /^\/hr\/drives\/[^/]+\/ranking/, label: "the ranking", ids: ["ranking", "decisions", "report"] },
  { test: /^\/hr\/drives\/[^/]+\/rounds\//, label: "this round", ids: ["invites", "round-progress", "advance", "integrity-alerts"] },
  { test: /^\/hr\/drives\/[^/]+/, label: "this drive", ids: ["drive-details", "rounds", "import-candidates", "report"] },
  { test: /^\/hr\/drives/, label: "drives", ids: ["create-drive", "drive-details", "getting-started"] },
  { test: /^\/hr\/papers/, label: "papers", ids: ["build-paper", "invites"] },
  { test: /^\/hr\/interviews/, label: "interviews", ids: ["interviews", "decisions"] },
  { test: /^\/hr\/analytics/, label: "analytics", ids: ["analytics", "ranking"] },
  { test: /^\/hr\/candidates/, label: "this candidate", ids: ["candidate-profile", "shortlist"] },
  { test: /^\/admin/, label: "admin", ids: ["admin", "change-owner"] },
];

const defaultSuggestions = ["getting-started", "create-drive", "drive-details", "build-paper"];

export function visibleTopics(role: Role): Topic[] {
  return topics.filter((t) => !t.adminOnly || role === "SUPER_ADMIN");
}

export function topicById(id: string, role: Role): Topic | undefined {
  return visibleTopics(role).find((t) => t.id === id);
}

/** The drive id when the user is inside /hr/drives/<id>/…, else null ("new" is not a drive). */
export function driveIdFrom(pathname: string | null): string | null {
  const m = pathname?.match(/^\/hr\/drives\/([^/?#]+)/);
  return m && m[1] !== "new" ? decodeURIComponent(m[1]) : null;
}

export function suggestionsFor(pathname: string | null, role: Role): { label: string | null; topics: Topic[] } {
  const hit = pathname ? pageSuggestions.find((p) => p.test.test(pathname)) : undefined;
  const ids = hit?.ids ?? defaultSuggestions;
  return { label: hit?.label ?? null, topics: ids.map((id) => topicById(id, role)).filter((t): t is Topic => !!t) };
}

/** Fill `{driveId}`; without a drive, use the fallback (or drop the link). */
export function resolveLink(link: BotLink, driveId: string | null): { label: string; href: string } | null {
  if (!link.href.includes("{driveId}")) return { label: link.label, href: link.href };
  if (driveId) return { label: link.label, href: link.href.replaceAll("{driveId}", encodeURIComponent(driveId)) };
  return link.fallback ?? null;
}
