import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";

vi.mock("@/lib/auth", async (orig) => ({ ...(await orig<typeof import("@/lib/auth")>()), liveApi: false }));

import { useAsync } from "./use-async";

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

it("useAsync ignores stale response", async () => {
  const first = deferred<string>();
  const second = deferred<string>();
  const { result, rerender } = renderHook(({ id }) => useAsync(() => (id === 1 ? first.promise : second.promise), [id]), { initialProps: { id: 1 } });
  rerender({ id: 2 });
  await act(async () => second.resolve("new"));
  await waitFor(() => expect(result.current.data).toBe("new"));
  await act(async () => first.resolve("old"));
  expect(result.current.data).toBe("new");
  expect(result.current.loading).toBe(false);
});

it("useAsync reload refetches", async () => {
  let n = 0;
  const fn = vi.fn(async () => ++n);
  const { result } = renderHook(() => useAsync(fn, []));
  await waitFor(() => expect(result.current.data).toBe(1));
  act(() => result.current.reload());
  await waitFor(() => expect(result.current.data).toBe(2));
  expect(fn).toHaveBeenCalledTimes(2);
});

it("useAsync exposes failures as an ApiError", async () => {
  const { result } = renderHook(() => useAsync(async () => Promise.reject(new Error("boom")), []));
  await waitFor(() => expect(result.current.error?.message).toBe("boom"));
  expect(result.current.loading).toBe(false);
});
