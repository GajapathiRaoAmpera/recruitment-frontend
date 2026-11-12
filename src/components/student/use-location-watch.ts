"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Keeps an eye on location access while the test runs. `on` flips to false when the browser denies it or
 * location services are off, and back to true when a position arrives again. `onChange` fires only on a flip
 * (and once for the first reading), so the server log gets events, not a stream.
 * Best effort: browsers don't promise to tell a page when a permission is revoked, so the Permissions API
 * and the position watcher are both used.
 */
export function useLocationWatch(enabled: boolean, onChange: (ok: boolean, meta: Record<string, unknown>) => void) {
  const [on, setOn] = useState(true); // the system check already got permission
  const cb = useRef(onChange);
  const last = useRef<boolean>(undefined);
  useEffect(() => {
    cb.current = onChange;
  });

  const set = useCallback((ok: boolean, meta: Record<string, unknown>) => {
    setOn(ok);
    if (last.current !== ok) {
      last.current = ok;
      cb.current(ok, meta);
    }
  }, []);

  const read = useCallback(
    () =>
      navigator.geolocation?.getCurrentPosition(
        (p) => set(true, { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
        (e) => set(false, { reason: e.code === 1 ? "denied" : "unavailable" }),
        { timeout: 10_000 },
      ),
    [set],
  );

  useEffect(() => {
    if (!enabled || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (p) => set(true, { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => {
        if (e.code !== 3) set(false, { reason: e.code === 1 ? "denied" : "unavailable" }); // 3 = slow fix, not "off"
      },
      { maximumAge: 30_000, timeout: 30_000 },
    );
    let perm: PermissionStatus | undefined;
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((s) => {
        perm = s;
        s.onchange = () => (s.state === "denied" ? set(false, { reason: "denied" }) : read());
      })
      .catch(() => {});
    return () => {
      navigator.geolocation.clearWatch(id);
      if (perm) perm.onchange = null;
    };
  }, [enabled, set, read]);

  return { on, retry: read };
}
