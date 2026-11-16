import type { Role } from "@/mock/types";
import { destinations, driveIdFrom, resolveLink, topicById, visibleTopics, type Topic } from "./knowledge";

export interface BotReply {
  text: string;
  steps?: string[];
  links: { label: string; href: string }[];
  /** Topic ids offered as follow-up chips. */
  followUps: string[];
  topicId?: string;
}

const STOP = new Set(["a", "an", "the", "i", "me", "my", "to", "do", "how", "can", "is", "are", "of", "for", "in", "on", "and", "or", "what", "where", "which", "it", "this", "that", "please", "pls", "want", "need", "should", "we", "you", "with", "about", "get", "show"]);

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9%\s-]/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text: string): string[] {
  return normalize(text)
    .split(" ")
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map(stem);
}

/** Tiny stemmer: enough to make "drives"/"drive", "shortlisting"/"shortlist" meet. */
function stem(w: string): string {
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("es") && !w.endsWith("ses")) return w.slice(0, -1);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

/** Score a topic: whole keyword phrases count most, then shared words with keywords and title. */
export function scoreTopic(topic: Topic, message: string): number {
  // Compare stemmed, filler-free words, so "create a drive" meets the phrase "create drive".
  const msg = tokens(message);
  const text = ` ${msg.join(" ")} `;
  const words = new Set(msg);
  let score = 0;
  // "cut-off"/"cut off" and "drive"/"drives" reduce to the same key: count each once.
  for (const key of new Set(topic.keywords.map((k) => tokens(k).join(" ")).filter(Boolean))) {
    if (key.includes(" ")) {
      if (text.includes(` ${key} `)) score += 4 + key.split(" ").length;
    } else if (words.has(key)) score += 2;
  }
  for (const w of tokens(topic.title)) if (words.has(w)) score += 1;
  return score;
}

export function rankTopics(message: string, role: Role): { topic: Topic; score: number }[] {
  return visibleTopics(role)
    .map((topic) => ({ topic, score: scoreTopic(topic, message) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

const GREETING = /^(hi+|hii+|hello|hey|hai|good (morning|afternoon|evening)|namaste|yo)\b/;
const THANKS = /^(thanks|thank you|thx|ty|ok thanks|great|cool|got it)\b/;
const NAV = /^(go to|goto|open|take me to|navigate to|show me|bring me to|where is)\s+(the\s+)?(.+)$/;

function linksFor(topic: Topic, driveId: string | null) {
  return topic.links.map((l) => resolveLink(l, driveId)).filter((l): l is { label: string; href: string } => !!l);
}

export function topicReply(topic: Topic, pathname: string | null): BotReply {
  return {
    text: topic.answer,
    steps: topic.steps,
    links: linksFor(topic, driveIdFrom(pathname)),
    followUps: topic.related ?? [],
    topicId: topic.id,
  };
}

/** Turn what HR typed into an answer. Pure and synchronous: no network, no database. */
export function reply(message: string, role: Role, pathname: string | null): BotReply {
  const text = normalize(message);
  const driveId = driveIdFrom(pathname);

  if (!text) return { text: "Type a question, or pick one of the suggestions below.", links: [], followUps: ["getting-started"] };

  if (GREETING.test(text) && text.split(" ").length <= 3) {
    return {
      text: "Hi! I'm your HR assistant. Ask me how to do anything in the portal, like creating a drive, shortlisting, building a paper or reading results, and I'll take you to the right page.",
      links: [],
      followUps: ["getting-started", "create-drive", "drive-details"],
    };
  }
  if (THANKS.test(text) && text.split(" ").length <= 3) {
    return { text: "Happy to help. Ask me anything else whenever you need.", links: [], followUps: [] };
  }

  const nav = text.match(NAV);
  if (nav) {
    const target = ` ${nav[3]} `;
    const dest = destinations
      .filter((d) => !d.adminOnly || role === "SUPER_ADMIN")
      .map((d) => ({ d, len: Math.max(0, ...d.words.map((w) => (target.includes(` ${w} `) ? w.length : 0))) }))
      .filter((x) => x.len > 0)
      .sort((a, b) => b.len - a.len)[0]?.d;
    if (dest) {
      const link = resolveLink({ label: dest.label, href: dest.href, fallback: { label: "Pick a drive first", href: "/hr/drives" } }, driveId);
      if (link) return { text: dest.href.includes("{driveId}") && !driveId ? `${dest.label} belongs to a drive. Pick a drive first:` : `Here you go:`, links: [link], followUps: [] };
    }
  }

  const ranked = rankTopics(message, role);
  const best = ranked[0];
  if (!best || best.score < 2) {
    return {
      text: "I'm not sure about that one yet. Try asking about drives, candidates, shortlisting, papers, rounds, interviews, analytics or reports. Or start with the quick tour:",
      links: [{ label: "Dashboard", href: "/hr" }],
      followUps: ["getting-started", "drive-details", "build-paper", "interviews"],
    };
  }

  const out = topicReply(best.topic, pathname);
  // Offer close runners-up first, then the topic's own related ones.
  const runnersUp = ranked
    .slice(1, 3)
    .filter((r) => r.score >= best.score * 0.6)
    .map((r) => r.topic.id);
  out.followUps = [...new Set([...runnersUp, ...out.followUps])].filter((id) => id !== best.topic.id && topicById(id, role)).slice(0, 3);
  return out;
}
