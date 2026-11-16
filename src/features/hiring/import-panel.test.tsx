import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ importCandidates: vi.fn(), fetchResumes: vi.fn() }));
vi.mock("@/api/hiring", async (orig) => ({ ...(await orig<typeof import("@/api/hiring")>()), ...api }));

import { ImportPanel } from "./import-panel";

it("imports the sheet and fetches resumes in one go", async () => {
  api.importCandidates.mockResolvedValue({ created: 2, updated: 0, errors: [] });
  api.fetchResumes.mockResolvedValue([
    { candidateId: "c1", studentId: "S1", status: "parsed" },
    { candidateId: "c2", studentId: "S2", status: "not_accessible" },
  ]);
  const onChanged = vi.fn();
  const { container } = render(<ImportPanel driveId="d1" onChanged={onChanged} />);
  const file = new File(["x"], "form.xlsx");
  fireEvent.change(container.querySelector("input[type=file]")!, { target: { files: [file] } });
  await waitFor(() => expect(api.fetchResumes).toHaveBeenCalledWith("d1"));
  expect(api.importCandidates).toHaveBeenCalledWith("d1", file);
  expect(await screen.findByText("1 resumes read")).toBeInTheDocument();
  expect(screen.getByText(/Drive file is private/)).toBeInTheDocument();
  expect(onChanged).toHaveBeenCalled();
});

it("offers Fetch resumes only when some are missing", () => {
  const { rerender } = render(<ImportPanel driveId="d1" />);
  expect(screen.queryByRole("button", { name: /Fetch/ })).not.toBeInTheDocument();
  rerender(<ImportPanel driveId="d1" missingResumes={3} total={5} />);
  expect(screen.getByText("2 of 5 resumes read · 3 still missing")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Fetch 3 resumes/ })).toBeInTheDocument();
});
