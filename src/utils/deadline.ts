// Deadline utilities for submission cutoff
// Deadline: 2025-09-03 13:00 Beijing Time (UTC+8) => 2025-09-03T05:00:00Z

export const DEADLINE_UTC_ISO = '2025-09-03T05:00:00Z';
export const DEADLINE_LABEL = '2025年9月3日 北京时间 13:00';
export const DEADLINE_TS = Date.parse(DEADLINE_UTC_ISO);

export const getRemainingMs = (now: number = Date.now()): number => {
  const diff = DEADLINE_TS - now;
  return diff > 0 ? diff : 0;
};

export const isPastDeadline = (now: number = Date.now()): boolean => {
  return now >= DEADLINE_TS;
};

export const formatCountdown = (ms: number): string => {
  if (ms <= 0) return '已截止';
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const two = (n: number) => (n < 10 ? `0${n}` : String(n));
  const hms = `${two(hours)}:${two(minutes)}:${two(seconds)}`;
  return days > 0 ? `${days}天 ${hms}` : hms;
};

