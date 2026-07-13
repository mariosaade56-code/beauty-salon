"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const IDLE_MS = 5 * 60 * 1000; // log out after 5 minutes without activity
const PING_MS = 2 * 60 * 1000; // while active, refresh the server session every 2 minutes

export default function IdleLogout() {
  const router = useRouter();
  const isAdmin = useRef(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastPing = 0;
    let stopped = false;

    async function logout() {
      if (stopped) return;
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
      router.push("/login");
    }

    function reset() {
      if (!isAdmin.current || stopped) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(logout, IDLE_MS);
      // Keep the server-side sliding window alive while the user is active
      const now = Date.now();
      if (now - lastPing > PING_MS) {
        lastPing = now;
        fetch("/api/auth/me").catch(() => {});
      }
    }

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];

    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((u) => {
        // Session already expired (e.g. page reopened after idle timeout)
        if (!u) {
          router.push("/login");
          return;
        }
        if (u.role === "ADMIN") {
          isAdmin.current = true;
          lastPing = Date.now();
          events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
          reset();
        }
      })
      .catch(() => {});

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [router]);

  return null;
}
