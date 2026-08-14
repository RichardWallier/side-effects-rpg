"use client";

import { useCallback, useEffect, useRef } from "react";

/** Agenda `fn` pro fim de uma rajada de eventos (slider, drag, digitação). */
export function useDebounced<A extends unknown[]>(fn: (...args: A) => void, delay = 300) {
  const latest = useRef(fn);
  latest.current = fn;

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return useCallback(
    (...args: A) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => latest.current(...args), delay);
    },
    [delay],
  );
}
