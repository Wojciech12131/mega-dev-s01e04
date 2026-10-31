import type { DigestRow, NightDigest } from '../digest/types.js';

const dash = (v: string | null) => (v === null || v === '' ? '—' : v);
const isWarn = (r: DigestRow) => r.retries >= 3 || r.lastStatus === 'fail';

export function DigestPage({ digest }: { digest: NightDigest }) {
  return (
    <>
      <h1>digest · {digest.night}</h1>
      {digest.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {digest.rows.map((r) => (
              <tr class={isWarn(r) ? 'warn' : undefined}>
                <td>{r.job}</td>
                <td>{dash(r.owner)}</td>
                <td>{r.runs}</td>
                <td>{r.retries}</td>
                <td>{r.lastStatus}</td>
                <td>{dash(r.lastError)}</td>
                <td>{r.firstAt}</td>
                <td>{r.lastAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {digest.badLines > 0 && (
        <p class="mute">
          {digest.badLines} {digest.badLines === 1 ? "line didn't" : "lines didn't"} parse
        </p>
      )}
    </>
  );
}

export function NoSuchNight({ night }: { night: string }) {
  return (
    <>
      <h1>digest · {night}</h1>
      <p class="mute">no such night</p>
    </>
  );
}
