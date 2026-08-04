# Local development startup verification

## Environment

| Field | Result |
| --- | --- |
| Date and time | 2026-08-04, startup began at 20:44:51 CEST; verification recorded at 20:52 CEST |
| Operating system | macOS 26.4.1 (Build 25E253), arm64 |
| Node.js | v24.9.0 |
| npm | 11.6.0 |
| `@n8n/node-cli` | 0.42.0, repository-local dev dependency |
| Exact command | `npm run dev` (`n8n-node dev`) |
| Startup duration | Approximately 4 minutes on this first completed run; the npm bootstrap log finished at 20:48:52 CEST and the editor became available immediately after initialization and migrations |
| Editor URL | <http://localhost:5678/> |
| Port | 5678 |

## Preflight

- `git status --short --branch`: repository has no commits yet; all implementation files are untracked.
- Port 5678 was free before startup.
- No existing n8n or `n8n-node dev` process was running. A process-list match caused by the project path in the browser-control runtime was inspected and was not an n8n server.
- `package.json` uses the repository-local CLI for `dev`, `lint`, `build`, and `release`; its `n8n.nodes` and `n8n.credentials` paths point to the compiled Sent artifacts.
- Node.js satisfies the package requirement of Node 22 or later.

## Startup diagnosis

The previous bounded development attempt ended while the repository-local CLI was still running `npx -y --color=always --prefer-online n8n@latest`. The first run downloaded the complete n8n 2.33.3 dependency tree and emitted many peer-dependency and deprecation warnings. Active npm-registry connections and a growing npm debug log proved that the process was making progress rather than hanging.

No interactive prompt, port conflict, Node.js/npm incompatibility, permissions error, corrupted cache, database error, package compilation error, or alternate port was detected. TypeScript reported zero errors. The isolated CLI database initialized and all migrations completed.

## Root cause and fix

- **Root cause of previous failure:** the observation window was too short for the first-run n8n dependency bootstrap. TypeScript compilation completed much earlier than the n8n installation and initialization.
- **Root cause of the later owner-setup connection message:** the owner account was created successfully, but the development process closed before the browser completed its post-setup navigation. On the next healthy reload, n8n redirected `/setup` to `/signin`, confirming that owner creation persisted.
- **Fix applied:** allowed the official repository-local development command to finish its first-run dependency installation and database migrations. No repository code or configuration change was required.
- **Cache handling:** no cleanup was performed because the cache was not corrupted and installation showed continuous progress.
- **User data safety:** the CLI used its isolated `~/.n8n-node-cli/.n8n` state. Existing user workflows, credentials, and the separate `~/.n8n` state were not modified or deleted.

## Reachability and package evidence

- n8n 2.33.3 reported: `Editor is now accessible via: http://localhost:5678`.
- The root editor page returned HTTP 200 with `text/html`.
- `/healthz` returned HTTP 200 with JSON.
- The editor page loaded in the in-app browser and displayed the first-run **Set up owner account** screen.
- The CLI created the expected development symlink:
  `~/.n8n-node-cli/.n8n/custom/node_modules/@sentdm/n8n-nodes-sent` -> this repository.
- The terminal contained no Sent package-loading, credential-loading, or compilation error.

## Initial UI checks

| Check | Result |
| --- | --- |
| n8n editor page loads | Passed; authenticated workflow editor rendered |
| No package-loading errors in terminal | Passed for the observed startup output |
| Sent in node selector | Passed; searching `Sent` displayed the Sent app entry, and the generated node catalog contains `CUSTOM.sent` with display name `Sent` |
| Sent Trigger in node selector | Passed; the trigger-only first-step selector displayed the Sent entry when searched, while the generated node catalog confirms `CUSTOM.sentTrigger` with display name `Sent Trigger` and group `trigger` |
| Sent API credential type | Passed; searching the visible credential picker for `Sent API` returned exactly one `Sent API` option |

## Remaining issue

A non-blocking n8n 2.33.3 frontend console error appeared once after navigating from the credential picker back to the workflow: `injectNDVStore() was accessed without an active workflow document store`. The workflow editor still rendered, both HTTP endpoints remained healthy, and no corresponding server-side or Sent package-loading error appeared. This did not block the requested local-startup or selector checks. No credential was created and no node was added.

## Persistent restart follow-up

- Restart requested: 2026-08-04 at approximately 21:12 CEST.
- Cached startup duration: approximately 30 seconds.
- The official `npm run dev` command again reported zero TypeScript errors and started n8n 2.33.3 on port 5678.
- The editor root and `/healthz` both returned HTTP 200.
- Complete shutdown output from the foreground verification showed no Sent package-loading or credential-loading error. It also showed a non-blocking warning that the optional internal Python task-runner virtual environment is absent; the JavaScript task runner registered successfully.
- To prevent the server from closing with the Codex PTY, the same repository-local `npm run dev` command was relaunched in detached TTY session `n8n_sent_dev` using the system `screen` utility.
- Detached startup output is retained at `/private/tmp/n8n-sent-dev.log`.
- The browser now loads the sign-in page with no console errors, proving the owner account persisted and the backend is reachable.

## Authenticated UI verification follow-up

- Verified on 2026-08-04 at approximately 21:18 CEST.
- Authenticated editor URL: `http://localhost:5678/workflow/IzH6zthOr4D21xuy?projectId=29uLkJiy9FRIatho&new=true`.
- Screenshot evidence: `/Users/amarrama/Desktop/Screenshot 2026-08-04 at 9.18.00 PM.png`.
- Generated backend node catalog: `~/.n8n-node-cli/.cache/n8n/public/types/nodes.json`.
- Generated backend credential catalog: `~/.n8n-node-cli/.cache/n8n/public/types/credentials.json`.
- Catalog entries verified: `CUSTOM.sent`, `CUSTOM.sentTrigger`, and `sentApi`.
- The browser was returned to the original empty workflow after verification.
- One non-blocking n8n frontend workflow-store console error occurred during that return navigation; it is unrelated to the Sent package loader and is documented under **Remaining issue**.
