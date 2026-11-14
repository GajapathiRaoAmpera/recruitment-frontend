import type { CaseStatus, CodingQuestion } from "@/api/attempt";
import type { Signature } from "@/api/coding-questions";

// Shared by the real coding workspace and the prototype (mock) coding page.

/** Starter code per language key (the keys /attempt/run accepts). Labels here are for the prototype only; the API sends its own names. */
export const LANGS = {
  python: { label: "Python 3", starter: "import sys\n\ndef solve():\n    data = sys.stdin.read().split()\n    # write your solution here\n\nsolve()\n" },
  javascript: { label: "JavaScript (Node)", starter: "const data = require(\"fs\").readFileSync(0, \"utf8\").split(/\\s+/);\n\nfunction solve() {\n  // write your solution here\n}\n\nsolve();\n" },
  c: { label: "C", starter: "#include <stdio.h>\n\nint main(void) {\n    // write your solution here\n    return 0;\n}\n" },
  cpp: { label: "C++17", starter: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // write your solution here\n    return 0;\n}\n" },
  java: { label: "Java 17", starter: "import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        // write your solution here\n    }\n}\n" },
  go: { label: "Go", starter: "package main\n\nimport \"fmt\"\n\nfunc main() {\n\t// write your solution here\n\tfmt.Println()\n}\n" },
  sql: { label: "SQL (SQLite)", starter: "-- write your query here\nSELECT\n" },
} as const;
export type Lang = keyof typeof LANGS;

export const starterFor = (language: string) => (language in LANGS ? LANGS[language as Lang].starter : "");

/**
 * What a new or empty draft opens with. Function mode: the API's `starter_code` for that language (empty if it sent none).
 * stdin mode: the LANGS template, as before.
 */
export const starterOf = (q: Pick<CodingQuestion, "mode" | "starterCode">, language: string) =>
  q.mode === "function" ? (q.starterCode?.[language] ?? "") : starterFor(language);

/** Language-neutral one-liner, e.g. `twoSum(nums: int[], target: int): int[]`. */
export const signatureText = (sig: Signature) => `${sig.functionName}(${sig.parameters.map((p) => `${p.name}: ${p.type}`).join(", ")}): ${sig.returnType}`;

/** Monaco's language id for an API language key (syntax colouring only). */
export const monacoLanguage = (language: string) => (language in LANGS ? language : "plaintext");

export const STATUS_LABEL: Record<CaseStatus, string> = {
  passed: "Passed",
  wrong_answer: "Wrong answer",
  compile_error: "Compile error",
  runtime_error: "Runtime error",
  time_limit: "Time limit exceeded",
};

/** One line explaining a failed sample: the expected output for a wrong answer, else the first line of stderr. */
export function failText(r: { expected: string; status?: CaseStatus; detail?: string }) {
  if (!r.status || r.status === "wrong_answer") return `Wrong answer — expected ${r.expected.split("\n")[0]}`;
  const first = r.detail?.split("\n").find((l) => l.trim());
  return first ? `${STATUS_LABEL[r.status]} — ${first}` : STATUS_LABEL[r.status];
}
