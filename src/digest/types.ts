// Plan morning-digest § 1. The contract every part of § 2 starts against: the reader fills it,
// the page, the JSON and the board link only read it.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl, after parsing.
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job. Times keep the offset from the log (styleguide); never converted to UTC.
export type DigestRow = {
  job: string;
  owner: string | null; // null is kept; views show it as `—`
  runs: number; // lines for this job, any status
  retries: number; // lines with status `retry`
  lastStatus: RunStatus;
  lastError: string | null; // `error` of the last line that had one
  firstAt: string;
  lastAt: string;
};

export type NightDigest = {
  night: string; // YYYY-MM-DD
  rows: DigestRow[]; // sorted by job; the page and the JSON use this order as is
  counts: Record<RunStatus, number>; // lines per status, for the board link
  badLines: number; // lines that didn't parse: counted, never thrown
};

// Reads runs/<night>.jsonl. Returns null when the night has no file (or isn't a YYYY-MM-DD
// night), so routes can answer 404. An empty file is a night with no rows ("nothing ran").
// Implemented as `readNight` in src/digest/read.ts.
export type ReadNight = (runsDir: string, night: string) => NightDigest | null;
