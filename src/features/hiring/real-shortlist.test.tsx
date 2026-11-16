import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";

vi.mock("@/components/ui/toast", () => ({ useToast: () => vi.fn() }));
vi.mock("@/components/shell/breadcrumbs", () => ({ useBreadcrumbs: () => {} }));
vi.mock("./import-panel", () => ({ ImportPanel: ({ missingResumes }: { missingResumes: number }) => <p>import panel, {missingResumes} missing</p> }));
const api = vi.hoisted(() => ({ getDrive: vi.fn(), listCandidates: vi.fn(), shortlist: vi.fn() }));
vi.mock("@/api/hiring", async (orig) => ({ ...(await orig<typeof import("@/api/hiring")>()), ...api }));

import { RealShortlist } from "./real-shortlist";

const row = (id: string, name: string, shortlisted: boolean | null) => ({ id, studentId: id, fullName: name, email: `${id}@x.edu`, cgpa: 8, skills: ["java"], jdMatch: 80, parseStatus: "parsed", shortlisted });

it("tells the import panel how many resumes are missing", async () => {
  api.getDrive.mockResolvedValue({ id: "d1", roleTitle: "SWE", campus: "ABC", candidates: 1 });
  api.listCandidates.mockResolvedValue([{ ...row("c1", "Asha", null), parseStatus: "missing", cgpa: null, jdMatch: null, skills: [] }]);
  render(<RealShortlist driveId="d1" />);
  expect(await screen.findByText("import panel, 1 missing")).toBeInTheDocument();
});

it("shows actions only for a selection and shortlists the chosen candidates", async () => {
  api.getDrive.mockResolvedValue({ id: "d1", roleTitle: "SWE", campus: "ABC", candidates: 2 });
  api.listCandidates.mockResolvedValue([row("c1", "Asha", null), row("c2", "Ravi", true)]);
  api.shortlist.mockResolvedValue({ updated: 1, moved: 1 });
  render(<RealShortlist driveId="d1" />);

  expect(await screen.findByText("import panel, 0 missing")).toBeInTheDocument();
  expect(screen.getByText("Shortlisted", { selector: "span[class*=badge]" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Shortlist 1/ })).not.toBeInTheDocument();

  fireEvent.click(screen.getByLabelText("Select Asha"));
  expect(screen.getByText("1 selected")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Shortlist 1" }));
  await waitFor(() => expect(api.shortlist).toHaveBeenCalledWith("d1", ["c1"], true));
});
