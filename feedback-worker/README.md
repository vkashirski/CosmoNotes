# Feedback relay

Settings → Feedback in CosmoNotes ("Ground control" in the code) sends a feature request or a bug report to this Cloudflare Worker. The Worker
opens an issue in a private GitHub repo and puts the pictures in that repo. Users need no account. Your GitHub token
stays in Cloudflare and is never in the app.

It is free: the Workers free plan allows 100,000 requests a day, and KV allows 1,000 writes a day. Each report uses
three writes. The defaults (5 a day per person, 50 a day in all) stay far below that.

## One-time setup (about 15 minutes, all in the browser)

1. **The private repo.** On GitHub, create `CosmoNotesFeedback`: **Private**, tick "Add a README" (so `main` exists).
2. **A token for that repo only.** GitHub → Settings → Developer settings → Fine-grained tokens → Generate new token.
   - Repository access: *Only select repositories* → `CosmoNotesFeedback`.
   - Permissions: **Contents: Read and write**, **Issues: Read and write**. Nothing else.
   - Expiration: the longest you are happy with. When it runs out, Send says "Couldn't send". Make a new token and
     replace the secret (step 5).
3. **Cloudflare.** Sign up at dash.cloudflare.com (free, no card). Workers & Pages → Create → Worker → name it
   `cosmonotes-feedback` → Deploy. Then **Edit code**, replace everything with `worker.mjs` from this folder, and
   Deploy.
4. **The KV store.** Storage & Databases → KV → Create → name `cosmonotes-limits`. Then your Worker → Settings →
   Bindings → Add → KV namespace: variable name **`LIMITS`**, the namespace you just made.
5. **Variables.** Your Worker → Settings → Variables and Secrets → Add:

   | Name | Type | Value |
   |---|---|---|
   | `GITHUB_TOKEN` | Secret | the token from step 2 |
   | `PUZZLE_SECRET` | Secret | any long random text (40+ letters). Change it any time. |
   | `REPO` | Text | `vkashirski/CosmoNotesFeedback` |
   | `OPEN` | Text | `yes` (`no` closes Feedback; the app says "closed for now") |
   | `PER_IP_DAY` | Text | `5` |
   | `PER_DAY` | Text | `50` |
   | `BITS` | Text | `18` (the puzzle: each +1 doubles the work on the user’s PC; 18 is about half a second) |

6. **The address.** The Worker's page shows it, e.g. `https://cosmonotes-feedback.<you>.workers.dev`. It must be the
   `RELAY` line at the top of `main/feedback.js`. If it isn't, change that line before you build.
7. **Try it.** Open `<address>/challenge` in a browser: it should show `{"challenge":"…","bits":18}`. Then send a
   report from `npm start` (Settings → Feedback) and check that an issue appears in `CosmoNotesFeedback`.

## With the command line (instead of steps 3–5)

```
cd feedback-worker
npx wrangler login
npx wrangler kv namespace create LIMITS      # put the id it prints in wrangler.toml
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put PUZZLE_SECRET
npx wrangler deploy
```

## Day to day

- **Turn it off:** set `OPEN` to `no` (no new app version needed). Set it back to `yes` to open again.
- **Too much spam:** lower `PER_IP_DAY` / `PER_DAY`, or raise `BITS` by 1 or 2.
- **Pictures** show in the issue when you are signed in to GitHub. They are also in the repo under `reports/<month>/`.
- **Logs:** your Worker → Logs (the free plan keeps 3 days). A failed GitHub call is logged with its status.
- `@names` and `#numbers` in a report get a zero-width space, so a report can't ping anyone or link other issues.
- The tests run this file under Node: `npm test -- ground-control` (in the app's folder).
