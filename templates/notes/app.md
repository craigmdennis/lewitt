## The app

Fill in this guide for your product, and save it as `notes/app.md`. The designer and the front-end engineer read it before they run the app, take a screenshot or take a page snapshot.

### Repositories

| Repository | Path | Use |
|---|---|---|
| `<app>` | `$APP_REPO` | Front-end code and the design system. The default branch is `<main>`. |
| `<backend>` | `<path>` | Read only. The data model and the APIs. |

Each project builds in its own git worktree of the app repository, in `$WORKTREES_DIR`, on a branch named after the project. Follow the agent instructions in the app repository, such as `AGENTS.md` or `CLAUDE.md`, and its rule files: `<path to rules>`.

### The API the dev server uses

Name the API the dev server runs against, and the account it logs in as. When it holds real data, only read it:

- Never submit a form, save a setting, or send anything from the app.
- Stay in the account or workspace the session opens in.
- Opening a menu, a modal or a tab is permitted.
- Build every change that needs the backend on a stub.
- Never print, copy or edit the session file.

When a screenshot shows the login page, the session has expired. Report it. The design lead runs `scripts/save-session.sh` to save a new one.

### Dev servers

| Who | Port |
|---|---|
| The app checkout, for screenshots of the current app | `<port>` |
| Designer | `<port>` |
| Front-end engineer | `<port>` |

The command that starts a dev server: `<command>`.

Before starting a dev server, check the port with `lsof -iTCP:<port> -sTCP:LISTEN`. When a dev server already runs there, use it. "Local preview" in the codebase report gives the commands for a project's worktree.

### Screenshots

Load `lewitt.env` first, for `SESSION_FILE` and `PLAYWRIGHT_DIR`: `set -a; . ./lewitt.env; set +a`.

Every state in a list, with a contact sheet in `<dir>/sheet.png`:

```sh
node scripts/screenshot.mjs "$SESSION_FILE" --states <url> S1,S2,S3 <dir> --selector '<css>'
```

One page:

```sh
node scripts/screenshot.mjs "$SESSION_FILE" <url> <file>.png --selector '<css>'
```

- `--selector` crops each screenshot to the component. The page map in the codebase report gives the selector of each part of the page. Never crop by pixel offsets.
- The viewport is 1440 by 1600 by default. For a phone, add `390,844` after the file name or the directory.
- The script waits 15 seconds after each page loads. `--wait <ms>` changes the wait. A standalone prototype needs `--wait 1000`.

### Page snapshots

A page snapshot is a static copy of a page, with no scripts, for a standalone prototype. The element that `--selector` matches becomes a line that reads `<!-- PROTOTYPE -->`:

```sh
node scripts/screenshot.mjs "$SESSION_FILE" --snapshot <url> <run>/snapshots/<page> --selector '<css>'
```

The command writes `page.html`, `part.html` (the matched element), `page.css` (every CSS rule, with the fonts and images inlined) and `page.png`. A snapshot shows the account's real data, so it stays in the run folder.

### Showing a state

Every state in `states.md` has an ID, such as `S3`. The page URL with `?state=S3` shows that state, in one of two ways:

1. **A mock API handler**, for a state an API response produces, such as an MSW handler. The handler reads the ID with `new URLSearchParams(location.search).get('state')` and returns nothing for any other state, so other requests reach the real API. Handlers are in `<path>`. Start the dev server with mocking on: `<command>`.
2. **A state set in the draft code**, for a state that follows a user action, such as submitting or a failed save. The draft component reads the `state` parameter and sets the state.

Never submit a form to reach a state, even with a handler in place.

### The design system

The design system's documentation is in `<path>`:

- `<path>` holds the guidelines, including language and tone.
- `<path>` holds the foundations: typography, colour, spacing and icons.
- `<path>` holds each component's documentation.
