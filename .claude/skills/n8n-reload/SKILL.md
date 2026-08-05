---
name: n8n-reload
description: Rebuild the node and restart the local n8n dev instance so UI changes take effect, then print the loaded resources, operations and icon mapping from n8n's own registry. Use after changing properties.ts or a node description, since n8n reads node types only at startup.
disable-model-invocation: true
---

n8n loads node types **once at startup**. After changing `properties.ts` or a node description, a
running instance keeps serving the stale registry — you will see the old operations and conclude the
change didn't work. This restarts it and reads the result back from n8n itself.

`pnpm run dev` wraps this in an interactive TUI that is awkward to drive from a tool call, so use the
underlying mechanism directly.

## 1. Rebuild

```bash
cd "$(git rev-parse --show-toplevel)"
pnpm run build
```

## 2. Link the package (first run only)

```bash
CUSTOM="$HOME/.n8n-node-cli/.n8n/custom/node_modules"
mkdir -p "$CUSTOM/@sentdm"
ln -sfn "$(git rev-parse --show-toplevel)" "$CUSTOM/@sentdm/n8n-nodes-sent"
```

## 3. Restart

`npm_config_cache` is required — the user's `~/.npm/_cacache` contains root-owned files and `npx`
fails with `EACCES` without it. First boot downloads n8n and takes several minutes; later boots take
about 150 seconds.

```bash
PID=$(lsof -nP -iTCP:5678 -sTCP:LISTEN -t 2>/dev/null); [ -n "$PID" ] && kill $PID; sleep 4
cd "$HOME/.n8n-node-cli" && npm_config_cache=/tmp/n8n-npx-cache \
  N8N_USER_FOLDER="$HOME/.n8n-node-cli" N8N_DEV_RELOAD=true N8N_DIAGNOSTICS_ENABLED=false \
  npx -y n8n@latest > /tmp/n8n-dev.log 2>&1 &
for i in $(seq 1 60); do
  grep -q "Editor is now accessible" /tmp/n8n-dev.log 2>/dev/null && { echo "ready"; break; }
  sleep 5
done
```

Editor: http://localhost:5678 — local owner account is `dev@example.com` / `LocalDev123`.

## 4. Read the registry back

Do not trust the source files; read what n8n actually loaded. Use the Playwright MCP tools to
navigate to `http://localhost:5678/home/workflows` (sign in if prompted) and evaluate:

```js
async () => {
  const all = await (await fetch('/types/nodes.json?t=' + Date.now(),
    { credentials: 'include', cache: 'no-store' })).json();
  const sent = all.find(n => n.name === 'CUSTOM.sent');
  const trig = all.find(n => n.name === 'CUSTOM.sentTrigger');
  const real = o => o.value !== '__CUSTOM_API_CALL__';
  const ops = (sent.properties || []).filter(p => p.name === 'operation');
  return {
    resources: (sent.properties.find(p => p.name === 'resource').options || [])
      .map(o => o.name).filter(n => n !== 'Custom API Call'),
    operations: ops.flatMap(p => p.options.filter(real)
      .map(o => `${p.displayOptions.show.resource[0]}: ${o.name} | ${o.action}`)),
    icons: sent.iconUrl,
    triggerWebhook: trig.webhooks,
    triggerIsNotATool: !all.some(n => n.name === 'CUSTOM.sentTriggerTool'),
  };
};
```

`/types/nodes.json` is the reliable endpoint — `/rest/node-types` needs a `browser-id` header and
returns `Unauthorized` without it.

Check: the resources and operations match `properties.ts`; `icons.light` points at
`sent-dark-icon.svg` and `icons.dark` at `sent-light-icon.svg` (the mapping is deliberately crossed);
`triggerWebhook` has **no** `restartWebhook` key; and `triggerIsNotATool` is `true`.

## 5. Clean up

Playwright MCP drops snapshots into `.playwright-mcp/` in the repo. It is gitignored, but remove it
anyway so `git status` stays readable:

```bash
rm -rf "$(git rev-parse --show-toplevel)/.playwright-mcp"
```

Leave n8n running unless the user asks otherwise, and tell them the URL and credentials.
