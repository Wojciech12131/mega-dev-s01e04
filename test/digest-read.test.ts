import { describe, expect, it } from 'vitest';
import { digest, parseLine, readNight } from '../src/digest/read.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28')!;

  it('has 5 jobs, sorted by job, and 1 bad line', () => {
    expect(night.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(night.badLines).toBe(1);
  });

  it('folds each job into one row', () => {
    const refresh = night.rows.find((r) => r.job === 'fixtures/refresh')!;
    expect(refresh).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    const backup = night.rows.find((r) => r.job === 'notes/backup')!;
    expect(backup.lastStatus).toBe('fail');
    expect(backup.lastError).toBe('quota exceeded');
  });

  it('keeps a row whose owner is null', () => {
    expect(night.rows.find((r) => r.job === 'digest/render')!.owner).toBeNull();
  });

  it('keeps the offset from the log', () => {
    expect(night.rows.find((r) => r.job === 'rig/rotate-logs')!.firstAt).toBe('2026-10-28T23:00:02+01:00');
  });

  it('counts lines per status', () => {
    expect(night.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
  });
});

describe('readNight edges', () => {
  it('returns null for a night with no file', () => {
    expect(readNight('runs', '2026-01-01')).toBeNull();
  });

  it('returns null for something that is not a night', () => {
    expect(readNight('runs', '../package')).toBeNull();
  });

  it('renders an empty night as no rows', () => {
    expect(digest('2026-10-30', '')).toEqual({
      night: '2026-10-30',
      rows: [],
      counts: { ok: 0, retry: 0, fail: 0 },
      badLines: 0,
    });
  });

  it('counts bad lines instead of throwing', () => {
    const text = '{"at":"x","job":"a","status":"ok","owner":"me"}\nnot json\n{"job":"a"}\n{"at":"x","job":"a","status":"maybe","owner":"me"}\r\n';
    const d = digest('2026-10-30', text);
    expect(d.rows).toHaveLength(1);
    expect(d.badLines).toBe(3);
  });

  it('parses CRLF lines', () => {
    expect(parseLine('{"at":"x","job":"a","status":"ok","owner":null}\r')?.owner).toBeNull();
  });
});
