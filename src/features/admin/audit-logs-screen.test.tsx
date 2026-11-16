import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", async (orig) => ({ ...(await orig<typeof import("@/lib/auth")>()), liveApi: true }));

import { ToastProvider } from "@/components/ui/toast";
import { AuditLogsScreen } from "./audit-logs-screen";

const entry = (id: number, patch: Record<string, unknown> = {}) => ({
  id,
  created_at: "2026-11-14T09:30:00Z",
  actor_id: "u-1",
  actor_name: "Asha",
  actor_email: "asha@x.com",
  actor_role: "hr",
  action: "round.advance",
  entity: "round",
  entity_id: `r-${id}`,
  diff: { threshold: 50, passed_ids: ["c1", "c2"] },
  ...patch,
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const page = (items: unknown[], next_cursor: string | null = null, total = items.length) => json({ items, next_cursor, total });

function stubApi(logs: (url: URL) => Response) {
  const fetchMock = vi.fn(async (input: string) => {
    const url = new URL(input, "http://x");
    if (url.pathname === "/api/v1/admin/users") return json({ items: [{ id: "u-1", full_name: "Asha", email: "asha@x.com" }], next_cursor: null });
    if (url.pathname === "/api/v1/admin/audit-logs/actions") return json(["round.advance", "user.create", "user.update"]);
    if (url.pathname === "/api/v1/admin/audit-logs/summary") return json({ total: 1234, last_24h: 5, actors: 3, access_changes: 2 });
    return logs(url);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const logCalls = (m: ReturnType<typeof stubApi>) =>
  m.mock.calls.map(([u]) => new URL(u, "http://x")).filter((u) => u.pathname === "/api/v1/admin/audit-logs");

const renderScreen = () =>
  render(
    <ToastProvider>
      <AuditLogsScreen />
    </ToastProvider>,
  );

afterEach(() => vi.unstubAllGlobals());

describe("Audit logs page reads GET /admin/audit-logs (FR-27, AC-10)", () => {
  it("shows summary cards and readable rows: person, role, event, target", async () => {
    stubApi(() => page([entry(2), entry(1, { actor_id: null, actor_name: null, actor_email: null, actor_role: null, diff: null })], null, 2));
    renderScreen();
    expect(await screen.findByText("Showing 2 of 2 events")).toBeInTheDocument();
    expect(await screen.findByText("1,234")).toBeInTheDocument();
    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]).getByText("Advanced round")).toBeInTheDocument();
    expect(within(rows[0]).getByText("round.advance")).toBeInTheDocument();
    expect(within(rows[0]).getByText("HR")).toBeInTheDocument();
    expect(within(rows[0]).getByText("r-2")).toBeInTheDocument();
    expect(within(rows[1]).getByText("System")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
  });

  it("Details opens a side panel with the recorded values in plain words", async () => {
    stubApi(() => page([entry(2)]));
    renderScreen();
    fireEvent.click(await screen.findByRole("button", { name: /details: advanced round by asha/i }));
    const panel = await screen.findByRole("dialog");
    expect(within(panel).getByText("Event #2")).toBeInTheDocument();
    // diff keys are data: kept as recorded (not camelCased), shown readable
    expect(within(panel).getByText("Passed ids")).toBeInTheDocument();
    expect(within(panel).getByText("c1, c2")).toBeInTheDocument();
  });

  it("an update shows a before / after table", async () => {
    stubApi(() => page([entry(3, { action: "user.update", entity: "users", diff: { from: { is_active: true }, to: { is_active: false } } })]));
    renderScreen();
    fireEvent.click(await screen.findByRole("button", { name: /details: updated user/i }));
    const panel = await screen.findByRole("dialog");
    const cells = within(panel).getAllByRole("cell").map((c) => c.textContent);
    expect(cells).toEqual(["Is active", "Yes", "No"]);
  });

  it("filters go to the server and Load more passes the cursor", async () => {
    const m = stubApi((u) => (u.searchParams.get("cursor") === "5" ? page([entry(4)], null, 3) : page([entry(6), entry(5)], "5", 3)));
    renderScreen();
    await screen.findByText("Showing 2 of 3 events");

    fireEvent.click(screen.getByRole("button", { name: /load more/i }));
    await screen.findByText("Showing 3 of 3 events");
    expect(logCalls(m).at(-1)!.searchParams.get("cursor")).toBe("5");

    await screen.findByRole("option", { name: "Invited user" });
    fireEvent.change(screen.getByLabelText("Event type"), { target: { value: "user.create" } });
    fireEvent.change(screen.getByLabelText("Actor"), { target: { value: "u-1" } });
    await waitFor(() => {
      const p = logCalls(m).at(-1)!.searchParams;
      expect(p.get("action")).toBe("user.create");
      expect(p.get("actor_id")).toBe("u-1");
      expect(p.get("cursor")).toBeNull();
    });
    // new filters drop the extra page loaded for the old ones
    await screen.findByText("Showing 2 of 3 matching events");
  });

  it("preset ranges send since; Custom sends local day bounds (until exclusive)", async () => {
    const m = stubApi(() => page([entry(1)]));
    renderScreen();
    await screen.findByText("Showing 1 of 1 event");

    const before = Date.now();
    fireEvent.click(screen.getByRole("button", { name: "7 days" }));
    await waitFor(() => expect(logCalls(m).at(-1)!.searchParams.get("since")).not.toBeNull());
    const since = Date.parse(logCalls(m).at(-1)!.searchParams.get("since")!);
    expect(before - since).toBeGreaterThanOrEqual(7 * 86_400_000 - 1000);
    expect(before - since).toBeLessThanOrEqual(7 * 86_400_000 + 1000);

    fireEvent.click(screen.getByRole("button", { name: "Custom" }));
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-11-01" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-11-14" } });
    await waitFor(() => {
      const p = logCalls(m).at(-1)!.searchParams;
      expect(p.get("since")).toBe(new Date(2026, 10, 1).toISOString());
      expect(p.get("until")).toBe(new Date(2026, 10, 15).toISOString());
    });
  });

  it("debounces the search box", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const m = stubApi(() => page([entry(1)]));
    renderScreen();
    await screen.findByText("Showing 1 of 1 event");
    const count = logCalls(m).length;
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "priya" } });
    expect(logCalls(m).length).toBe(count);
    await act(async () => void vi.advanceTimersByTime(350));
    await waitFor(() => expect(logCalls(m).at(-1)!.searchParams.get("q")).toBe("priya"));
    vi.useRealTimers();
  });

  it("empty log shows an empty state", async () => {
    stubApi(() => page([]));
    renderScreen();
    expect(await screen.findByText("No events yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /export csv/i })).toBeDisabled();
  });

  it("403 shows the permission-denied state", async () => {
    stubApi(() => json({ error: { code: "FORBIDDEN", message: "Forbidden", details: {} } }, 403));
    renderScreen();
    expect(await screen.findByText("You don't have access to this page")).toBeInTheDocument();
  });

  it("server error shows the message with retry", async () => {
    stubApi(() => json({ error: { code: "INTERNAL", message: "Database unavailable", details: {} } }, 500));
    renderScreen();
    expect(await screen.findByText("Database unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
