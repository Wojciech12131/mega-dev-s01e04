import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { readNight } from '../src/digest/read.js';
import type { NightDigest } from '../src/digest/types.js';

// Route tests for plan morning-digest § 2d: /digest/:night (§ 2a) and /api/digest/:night (§ 2b).
// The runs dir is a temp dir filled with fixtures made here; the real runs/ is never touched.

const NORMAL = '2026-10-20'; // 2 jobs: one with 3 retries, one that failed (owner null)
const EMPTY = '2026-10-21'; // empty file: nothing ran
const BAD = '2026-10-22'; // 2 good jobs and 1 line that doesn't parse
const MISSING = '2026-10-23'; // no file

const line = (o: Record<string, unknown>) => JSON.stringify(o);

// Job names are written in the file in the reverse of their sorted order, so the tests catch a
// page or JSON that follows the log instead of sorting by job.
const fixtures: Record<string, string> = {
  [NORMAL]:
    [
      line({ at: '2026-10-20T23:00:02+01:00', job: 'zeta/backup', status: 'retry', owner: 'rook', error: 'timeout' }),
      line({ at: '2026-10-20T23:05:02+01:00', job: 'alpha/sync', status: 'ok', owner: 'lane-07' }),
      line({ at: '2026-10-20T23:10:02+01:00', job: 'zeta/backup', status: 'retry', owner: 'rook', error: 'timeout' }),
      line({ at: '2026-10-20T23:20:02+01:00', job: 'zeta/backup', status: 'retry', owner: 'rook', error: 'timeout' }),
      line({ at: '2026-10-21T00:00:02+01:00', job: 'zeta/backup', status: 'ok', owner: 'rook' }),
      line({ at: '2026-10-21T01:00:02+01:00', job: 'alpha/sync', status: 'fail', owner: null, error: 'disk full' }),
    ].join('\n') + '\n',
  [EMPTY]: '',
  [BAD]:
    [
      line({ at: '2026-10-22T23:00:02+01:00', job: 'mid/rotate', status: 'ok', owner: 'rook' }),
      '{"at": "2026-10-22T23:30:00+01:00", "job": "broken',
      line({ at: '2026-10-22T23:45:02+01:00', job: 'beta/index', status: 'ok', owner: 'lane-07' }),
    ].join('\n') + '\n',
};

let runsDir: string;
let app: ReturnType<typeof createApp>;
let savedMarker: string | undefined;

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  for (const [night, text] of Object.entries(fixtures)) writeFileSync(join(runsDir, `${night}.jsonl`), text);
  savedMarker = process.env.LANE_MARKER;
  process.env.LANE_MARKER = 'TEST-MARKER';
  app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir });
});

afterAll(() => {
  if (savedMarker === undefined) delete process.env.LANE_MARKER;
  else process.env.LANE_MARKER = savedMarker;
  rmSync(runsDir, { recursive: true, force: true });
});

// The data rows of the page's table: every <tr> that has cells (the header row has <th> only).
function dataRows(html: string): { open: string; html: string }[] {
  return [...html.matchAll(/<tr(\s[^>]*)?>([\s\S]*?)<\/tr>/g)]
    .filter((m) => /<td[\s>]/.test(m[2] ?? ''))
    .map((m) => ({ open: `<tr${m[1] ?? ''}>`, html: m[2] ?? '' }));
}

const hasWarn = (open: string) => /class="[^"]*\bwarn\b[^"]*"/.test(open);

describe('GET /digest/:night', () => {
  it('renders one table, rows sorted by job, with the lane banner', async () => {
    const res = await app.request(`/digest/${NORMAL}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(html).toContain('TEST-MARKER');
    expect(html.match(/<table[\s>]/g)).toHaveLength(1);
    const rows = dataRows(html);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.html).toContain('alpha/sync');
    expect(rows[1]?.html).toContain('zeta/backup');
  });

  it('marks rows with 3 or more retries or a last status of fail as warn', async () => {
    const html = await (await app.request(`/digest/${NORMAL}`)).text();
    const [alpha, zeta] = dataRows(html);
    // alpha/sync: last status fail, no retries. zeta/backup: 3 retries, last status ok.
    expect(hasWarn(alpha?.open ?? '')).toBe(true);
    expect(hasWarn(zeta?.open ?? '')).toBe(true);
  });

  it('leaves rows without retries >= 3 and without a fail unmarked', async () => {
    const html = await (await app.request(`/digest/${BAD}`)).text();
    const rows = dataRows(html);
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(hasWarn(row.open)).toBe(false);
  });

  it('shows a null owner as —', async () => {
    const html = await (await app.request(`/digest/${NORMAL}`)).text();
    const alpha = dataRows(html).find((r) => r.html.includes('alpha/sync'));
    expect(alpha?.html).toContain('—');
  });

  it('answers 404 for a night with no file', async () => {
    const res = await app.request(`/digest/${MISSING}`);
    expect(res.status).toBe(404);
  });

  it('renders "nothing ran" for an empty night', async () => {
    const res = await app.request(`/digest/${EMPTY}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
    expect(html).toContain('TEST-MARKER');
    expect(dataRows(html)).toHaveLength(0);
  });

  it('still answers 200 for a night with a bad line and renders its good rows', async () => {
    const res = await app.request(`/digest/${BAD}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    const rows = dataRows(html);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.html).toContain('beta/index');
    expect(rows[1]?.html).toContain('mid/rotate');
  });
});

describe('GET /api/digest/:night', () => {
  const get = async (night: string) => {
    const res = await app.request(`/api/digest/${night}`);
    return { res, body: (await res.json()) as NightDigest };
  };

  it('returns the NightDigest from readNight as JSON', async () => {
    const { res, body } = await get(NORMAL);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(body).toEqual(readNight(runsDir, NORMAL));
    expect(body.night).toBe(NORMAL);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha/sync', 'zeta/backup']);
    expect(body.counts).toEqual({ ok: 2, retry: 3, fail: 1 });
    expect(body.badLines).toBe(0);
    const zeta = body.rows[1];
    expect(zeta?.retries).toBe(3);
    expect(zeta?.lastStatus).toBe('ok');
    expect(body.rows[0]?.owner).toBeNull();
  });

  it('answers 404 for a night with no file', async () => {
    const res = await app.request(`/api/digest/${MISSING}`);
    expect(res.status).toBe(404);
  });

  it('gives rows: [] for the empty night', async () => {
    const { res, body } = await get(EMPTY);
    expect(res.status).toBe(200);
    expect(body.rows).toEqual([]);
    expect(body.counts).toEqual({ ok: 0, retry: 0, fail: 0 });
    expect(body.badLines).toBe(0);
  });

  it('counts the bad line and keeps the good rows', async () => {
    const { res, body } = await get(BAD);
    expect(res.status).toBe(200);
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['beta/index', 'mid/rotate']);
    expect(body.counts).toEqual({ ok: 2, retry: 0, fail: 0 });
  });
});

describe('page and JSON agree', () => {
  it.each([NORMAL, BAD])('lists the jobs of %s in the same order', async (night) => {
    const html = await (await app.request(`/digest/${night}`)).text();
    const body = (await (await app.request(`/api/digest/${night}`)).json()) as NightDigest;
    const jobs = body.rows.map((r) => r.job);
    expect(jobs.length).toBeGreaterThan(1);
    // The job of each page row, found by which JSON job the row's text contains.
    const pageJobs = dataRows(html).map((r) => jobs.find((j) => r.html.includes(j)));
    expect(pageJobs).toEqual(jobs);
  });
});
