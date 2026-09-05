"use client";

import { useSyncExternalStore } from "react";
import {
  formatFullDateTime,
  formatRelativeTime,
  type TimestampValue
} from "@/lib/date-time";

const subscribers = new Set<() => void>();
let currentTime = 0;
let intervalId: ReturnType<typeof setInterval> | null = null;

function emitCurrentTime() {
  currentTime = Date.now();
  subscribers.forEach((subscriber) => subscriber());
}

function subscribe(subscriber: () => void) {
  subscribers.add(subscriber);
  if (subscribers.size === 1) {
    currentTime = Date.now();
    intervalId = setInterval(emitCurrentTime, 30_000);
  }

  return () => {
    subscribers.delete(subscriber);
    if (!subscribers.size && intervalId) {
      clearInterval(intervalId);
      intervalId = null;
      currentTime = 0;
    }
  };
}

function getSnapshot() {
  return currentTime;
}

function getServerSnapshot() {
  return 0;
}

export function RelativeTime({
  timestamp,
  className
}: {
  timestamp: TimestampValue;
  className?: string;
}) {
  const now = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!now) return <span className={className} />;

  return (
    <time
      className={className}
      dateTime={typeof timestamp === "string" ? timestamp : undefined}
      title={formatFullDateTime(timestamp)}
    >
      {formatRelativeTime(timestamp, now)}
    </time>
  );
}
