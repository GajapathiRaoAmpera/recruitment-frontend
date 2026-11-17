import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ThankYouScreen } from "./thank-you-screen";

describe("thank-you page after a round (AC-7: never shows marks)", () => {
  it("test round: greets by first name, lists the next steps toward the next round, and takes focus", () => {
    render(<ThankYouScreen name="Asha Rao" roundType="coding" roundTitle="Round 2 · Coding" />);
    const heading = screen.getByRole("heading", { name: "Thank you, Asha" });
    expect(heading).toHaveFocus();
    expect(screen.getByText(/Round 2 · Coding/)).toBeInTheDocument();
    expect(screen.getByText("If you move on, your next round opens on your dashboard.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to dashboard" })).toHaveAttribute("href", "/student");
  });

  it("interview: talks about the final decision and has no dashboard link (it has its own sign-in)", () => {
    render(<ThankYouScreen name="Asha Rao" roundType="ai_interview" dashboard={false} />);
    expect(screen.getByText("Your interview is complete and saved.")).toBeInTheDocument();
    expect(screen.getByText("You'll get an email with the final decision.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Back to dashboard" })).not.toBeInTheDocument();
  });

  it("prototype preview: says nothing was recorded and lists no next steps", () => {
    render(<ThankYouScreen roundType="aptitude" recorded={false} />);
    expect(screen.getByRole("heading", { name: "Thank you" })).toBeInTheDocument();
    expect(screen.getByText("Preview finished. Nothing was recorded.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "What happens next" })).not.toBeInTheDocument();
  });
});
