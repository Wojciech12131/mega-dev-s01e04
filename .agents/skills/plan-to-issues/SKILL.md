---
name: plan-to-issues
description: Split this repo's plan.md into GitHub issues with gh, one per unit of work, after a human has reviewed the split. Use when a plan is ready and has no issues yet.
---

# plan-to-issues

Turns `plan.md` into GitHub issues that workers can pick up cold. Easiest with `gh`, authenticated,
in a shell this agent can run.

## Steps

1. Read `plan.md`, `AGENTS.md` and `docs/adr/`.
2. Draft the split as a table: title · plan section · scope · done when · blocked by.
   One issue per unit of work.
3. **Stop and show the table to the human.** Publish nothing until they approve it.
4. Ask the human what every issue here must carry (fields, labels, wording), unless it is
   already written down in this session or in the repo (see "What every issue carries").
5. Create each issue in dependency order, so blocked-by can cite real numbers:

   ```sh
   gh issue create --title "<title>" --body-file <tmp.md> --label plan:<plan>
   ```

6. Record every issue URL from gh's output (not from memory) and reply with the list.

Closing one, with the closing comment from AGENTS.md:

```sh
gh issue close <n> -c "<closing comment>"
```

## What every issue carries

Set by the reviewer and the repo owner for plan morning-digest (2026-10-31); it holds for every
plan here until they change it.

- Label `plan:<plan>`, the `plan:` value from the frontmatter of `plan.md` (create it once with
  `gh label create`).
- The body opens with exactly `Source: plan.md § <n>`, the plan's own section label (`§ 1`,
  `§ 2a`). The reviewer sorts issues by it.
- Then, each on its own line: `Scope:`, `Done when:` (checkable, from the plan), `Blocked by:`
  (real issue numbers, or `—`).
- Done when that needs someone outside the lane (a reviewer's look, a reply) holds only once they
  have confirmed it. Sending is not done: the issue stays open, and blocks what comes after it.

```md
Source: plan.md § 2a

Scope: <what changes, where>

Done when: <the plan's check>

Blocked by: #1
```

## No `gh`

Steps 1–4 hold either way. GitHub reachable another way (a connector, the REST API, the web UI):
the same issues, made that way. GitHub issues out of reach altogether: write them as files in
`docs/issues/`, format in ADR 0004, then commit and push.

## Don'ts

- Don't paste the whole plan into one issue, and don't keep issues only in chat.
- Don't invent sections the plan doesn't have. If the plan is unclear, ask.
