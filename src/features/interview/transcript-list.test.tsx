import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { TranscriptList } from "./transcript-list";

it("shows an interviewer flag as an unverified warning between the chat turns", () => {
  render(
    <TranscriptList
      candidateName="Asha"
      turns={[
        { role: "ai", kind: "spoken", text: "Tell me about your project." },
        { role: "ai", kind: "flag", text: "multiple_voices: a second voice read out an answer" },
        { role: "candidate", kind: "spoken", text: "I built an API." },
      ]}
    />,
  );
  expect(screen.getByText("Possible second voice")).toBeInTheDocument();
  expect(screen.getByText(/a second voice read out an answer\. AI-detected and unverified/)).toBeInTheDocument();
  expect(screen.getAllByRole("listitem")).toHaveLength(3);
});
