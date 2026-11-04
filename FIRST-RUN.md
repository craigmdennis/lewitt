# First run

The designer follows these steps when `company` is not a link, or when `machine.env` or any file in `company/` is missing. The steps set up Lewitt for one company's product on one Mac. Each step writes its answer to a file before the next step starts, so a setup that stops partway continues from the first missing answer.

## How to ask

- Ask one question per message, and wait for the answer.
- Before each question, look for the answer yourself: in the app repository, its `package.json`, its agent instructions and rule files, its design system documentation, and `claude mcp list`. Then propose what you found, with the file it came from, and ask the design lead to confirm or correct it. Ask an open question only when you found nothing.
- Write each confirmed answer into its file at once. Replace each `<placeholder>` in the template with the answer, and delete a line or a section the design lead says does not apply.
- When the design lead does not know an answer, write `Unknown` in its place and continue. List each unknown at the end.

## 0. The company folder

If `company` is already a link, skip this step.

1. Ask for the company's name, and propose `$HOME/Projects/lewitt-<company>` as its folder. The folder sits outside this repository.
2. Run `scripts/use-company.sh <folder>`. It creates the folder, links `company`, `machine.env`, `runs`, `worktrees` and `.claude/agent-memory` to it, and turns on the pre-commit check.
3. Ask whether the folder should be its own private git repository. If the design lead says yes, run `git init` in it, and add `runs/`, `worktrees/` and `machine.env` to its `.gitignore`. Run folders hold the company's real data.

## 1. This Mac

`machine.env` is in the company folder. Ask for:

1. **The app repository.** The path of the front-end checkout. If it is not cloned yet, ask for its URL and offer to clone it. Write it as `APP_REPO`.
2. **Playwright.** Find the folder in the app repository that holds `@playwright/test` in its `node_modules`. Write it as `PLAYWRIGHT_DIR`. If no folder holds it, say that screenshots need it, and ask whether to install it.
3. **The session file.** Propose `$HOME/.lewitt/session.json`. Write it as `SESSION_FILE`.

Write paths with `$HOME`, never with a hardcoded home folder.

## 2. The app

Copy `templates/company/app.md` to `company/app.md`, then ask for:

1. **The backend repository**, if the engineer should read one. Its path, or its URL to clone.
2. **The default branch** of the app repository. Read it with `git -C "$APP_REPO" symbolic-ref refs/remotes/origin/HEAD`.
3. **Agent instructions and rule files** in the app repository, such as `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/` or `.agents/rules/`.
4. **The API the dev server uses.** A local backend, a staging API or the production API, and the account it logs in as. If it holds real data, keep the read-only rules in the guide.
5. **The dev server.** The command that starts it, from `package.json`, and the port. Propose three free ports: one for the app checkout, one for the designer and one for the front-end engineer.
6. **Showing a state.** Whether the app has a mock API library, such as MSW, the folder of its handlers, and the command that starts the dev server with mocking on.
7. **The design system documentation.** The folders of the guidelines, the foundations and the component pages. Look for Storybook, `.mdx` files or a docs site first.
8. **The session.** The domain the app runs on locally, and a URL that returns 200 only when logged in, such as `/api/me`. Give the design lead the command to save a session, and ask them to run it when they first need screenshots:

   ```sh
   scripts/save-session.sh <domain> <check url>
   ```

## 3. The design system

Copy `templates/company/design-system.md` to `company/design-system.md`. Read the design system's foundations from the folders in step 2, then propose each part and ask the design lead to confirm it:

1. **The foundations to read** before a build or a review.
2. **The tokens:** the spacing scale and the radius scale, with their prefixes.
3. **The layout components** used for spacing.
4. **The text styles:** each component, its use and its sizes.
5. **Rules the design lead already follows** that the documentation does not state. Ask for them in the design lead's words, one at a time, until the design lead has no more. Write each one as a default with an exception.

## 4. Copy

Copy `templates/company/copy-sources.md` to `company/copy-sources.md`, then ask for:

1. **A copy skill or style guide.** List the skills this session has whose names or descriptions mention copy, content, voice or writing, and ask which one is the company's. Ask for a style guide's path or link as well.
2. **The language guidance** in the design system: the pages for AI-written text, dates and numbers, accessible names, and each component that shows text.
3. **The folders that hold existing strings** in the app, for the copywriter's search.

## 5. Research

Write `company/research.md` from `templates/company/research.md`, then ask for:

1. **The units:** what the business counts, such as accounts, workspaces, users or seats, and what "customer" and "active" mean.
2. **Metric definitions** the team uses, and where they are written down.
3. **Data caveats:** internal and test accounts to exclude, known gaps, and the page that lists the caveats.
4. **A data skill**, if the company has one for its warehouse.
5. **Other sources,** such as a survey tool, support tickets or a research repository.

## 6. Skills and terms

1. Copy `templates/company/skills.md` to `company/skills.md`. For each company skill from steps 4 and 5, ask which agents load it, and list it under each one. When there are none, keep the file with its headings.
2. Ask for the company's own terms: the product names, the component library, internal hosts, repository names and code names. Propose the ones you found in steps 1 to 5. Add each one to `company/denylist`, one per line.

## 7. Pattern rules

Copy `templates/company/pattern-rules.md` to `company/pattern-rules.md`. Ask whether the design lead has approved rules from earlier projects. Add each one to the table, one question at a time. Leave the example row out when there are none.

## 8. Connections

1. Run `claude mcp list`. Report each server in the researcher's and the engineer's definitions, `amplitude`, `mobbin`, `linear` and `snowflake`, as connected or missing, with Notion through claude.ai. For each missing server, ask whether to connect it, and give its setup step. Each server is optional.
2. Check that the Now view is installed. If it is not, give the two install commands in `README.md`.

## 9. Finish

1. Run the checks:
   - `git status --short` lists none of `company`, `machine.env`, `runs`, `worktrees` or `.claude/agent-memory`.
   - `git config core.hooksPath` prints `.githooks`.
   - `node --check scripts/screenshot.mjs` passes.
   - The `PLAYWRIGHT_DIR` folder resolves `@playwright/test`.
2. Tell the design lead what was set up, each answer still `Unknown`, and the file to edit for each one.
3. Ask the design lead to describe the first project.
