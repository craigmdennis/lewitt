# First run

The designer follows these steps when `notes` is not a link, or when `lewitt.env` or any file in `notes/` is missing. The steps point Lewitt at one product's existing repositories on one Mac, and move nothing. A step or a question marked with a role applies only when `notes/roles.md` lists that role. Each step writes its answer to a file before the next step starts, so a setup that stops partway continues from the first missing answer.

## How to ask

- Ask one question per message, and wait for the answer.
- Before each question, look for the answer yourself: in the app repository, its `package.json`, its agent instructions and rule files, its design system documentation, and `claude mcp list`. Then propose what you found, with the file it came from, and ask the design lead to confirm or correct it. Ask an open question only when you found nothing.
- Write each confirmed answer into its file at once. Replace each `<placeholder>` in the template with the answer, and delete a line or a section the design lead says does not apply.
- When the design lead does not know an answer, write `Unknown` in its place and continue. List each unknown at the end.
- Use each repository where it already is. Never propose moving one or changing its folders.

## 0. The app repository

If `notes` is already a link, skip this step.

1. Ask for the app repository: the path of an existing checkout, or its git URL. Look for a likely checkout first, in the folder that holds this checkout and in its neighbours, and propose it.
2. For a URL, ask for the folder to clone it into. Propose the folder where the design lead's other repositories already are.
3. Run `scripts/point-at.sh <path>`, or `scripts/point-at.sh <URL> <folder>`. It creates `.lewitt/` in the app repository, creates `worktrees/` in this checkout, hides `.lewitt/` and `.lewitt-run/` through the repository's `.git/info/exclude`, writes `APP_REPO` in `lewitt.env`, links `notes` and `.claude/agent-memory`, and turns on the pre-commit check.

## 1. Roles

Copy `templates/notes/roles.md` to `notes/roles.md`. List each agent in `.claude/agents/`, then propose the roles that fit the product, with the file each proposal comes from:

- **An engineer.** A `package.json` with a web framework suggests the front-end engineer.
- **The copywriter**, when the product has a copy style guide, or UI strings in the repository.
- **The researcher**, when the company has issue trackers, product analytics or a data warehouse to read.

Ask the design lead to confirm or correct the list, then delete each other role from `notes/roles.md`. When the product needs a role Lewitt does not have, follow "Adding a role" in `CLAUDE.md` first.

## 2. This Mac

Ask for each pointer in `lewitt.env`:

1. **Worktrees.** `point-at.sh` sets `WORKTREES_DIR` to `worktrees/` in this checkout, which git ignores. Run `git -C "$APP_REPO" worktree list`. When the repository already keeps its worktrees in another folder, offer that folder as the other choice. Keep the default unless the design lead picks the other folder.
2. **The backend repository**, if the engineer should read one: an existing path, or a URL to clone into the folder the design lead names. Write it as `BACKEND_REPO`.
3. **Playwright**, front-end engineer only. Find the folder in the app repository that holds `@playwright/test` in its `node_modules`. Write it as `PLAYWRIGHT_DIR`. If no folder holds it, say that screenshots need it, and ask whether to install it.
4. **The session file**, front-end engineer only. Propose `$HOME/.lewitt/session.json`. Write it as `SESSION_FILE`.

Write paths with `$HOME`, never with a hardcoded home folder.

## 3. The app

Copy `templates/notes/app.md` to `notes/app.md`. Without a front-end engineer, delete each section marked "Front-end engineer only". Then ask for:

1. **The default branch** of the app repository. Read it with `git -C "$APP_REPO" symbolic-ref refs/remotes/origin/HEAD`.
2. **Agent instructions and rule files** in the app repository, such as `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/` or `.agents/rules/`.
3. **Running the app.** Brief the engineer with the "Running the app" task, and write its reply into "Running the app" in `notes/app.md`. Ask the design lead only to choose between the ways it found, and for each step it could not do. If the API it runs against holds real data, keep the read-only rules in the guide.
4. **The dev server**, front-end engineer only. The command that starts it, from `package.json`, and the port. Propose three free ports: one for the app checkout, one for the designer and one for the front-end engineer.
5. **Showing a state**, front-end engineer only. Whether the app has a mock API library, such as MSW, the folder of its handlers, and the command that starts the dev server with mocking on.
6. **The design system documentation.** The folders of the guidelines, the foundations and the component pages. Look for Storybook, `.mdx` files or a docs site first.
7. **The session**, front-end engineer only. When the way the app runs needs a saved login: the domain the app runs on locally, and a URL that returns 200 only when logged in, such as `/api/me`. Give the design lead the command to save a session, and ask them to run it when they first need screenshots:

   ```sh
   scripts/save-session.sh <domain> <check url>
   ```

## 4. The design system

Copy `templates/notes/design-system.md` to `notes/design-system.md`. When the product has no design system, write that at the top, name the platform controls and the platform guidelines the product uses instead, replace the screenshot command in "The visual check" with the engineer's, delete the tokens and the text styles, and ask item 5 only.

Otherwise, read the design system's foundations from the folders in step 3, then propose each part and ask the design lead to confirm it:

1. **The foundations to read** before a build or a review.
2. **The tokens:** the spacing scale and the radius scale, with their prefixes.
3. **The layout components** used for spacing.
4. **The text styles:** each component, its use and its sizes.
5. **Rules the design lead already follows** that the documentation does not state. Ask for them in the design lead's words, one at a time, until the design lead has no more. Write each one as a default with an exception.

## 5. Copy

Copywriter only. Copy `templates/notes/copy-sources.md` to `notes/copy-sources.md`, then ask for:

1. **A copy skill or style guide.** List the skills this session has whose names or descriptions mention copy, content, voice or writing, and ask which one is the company's. Ask for a style guide's path or link as well.
2. **The language guidance** in the design system: the pages for AI-written text, dates and numbers, accessible names, and each component that shows text.
3. **The folders that hold existing strings** in the app, for the copywriter's search.

## 6. Research

Researcher only. Write `notes/research.md` from `templates/notes/research.md`, then ask for:

1. **The units:** what the business counts, such as accounts, workspaces, users or seats, and what "customer" and "active" mean.
2. **Metric definitions** the team uses, and where they are written down.
3. **Data caveats:** internal and test accounts to exclude, known gaps, and the page that lists the caveats.
4. **A data skill**, if the company has one for its warehouse.
5. **Issue trackers:** each tool where the team logs issues, ideas and decisions, and each tool that links issues to code, docs or support tickets. The researcher searches them for prior work at the start of each project.
6. **Other sources,** such as a survey tool, support tickets or a research repository.

## 7. Skills and terms

1. Copy `templates/notes/skills.md` to `notes/skills.md`. Keep the heading of each role in `notes/roles.md`, and delete the others. For each company skill from steps 5 and 6, and each Lewitt skill an engineer needs for the product's stack, ask which agents load it, and list it under each one. When there are none, keep the file with its headings.
2. Ask for the company's own terms: the product names, the component library, internal hosts, repository names and code names. Propose the ones you found in steps 1 to 6. Add each one to `notes/denylist`, one per line.

## 8. Pattern rules

Copy `templates/notes/pattern-rules.md` to `notes/pattern-rules.md`. Ask whether the design lead has approved rules from earlier projects. Add each one to the table, one question at a time. Leave the example row out when there are none.

## 9. Connections

1. Run `claude mcp list`. Report each server in the definitions of the roles in `notes/roles.md`, such as `amplitude`, `mobbin`, `linear` and `snowflake`, as connected or missing, with Notion through claude.ai. For each missing server, ask whether to connect it, and give its setup step. Each server is optional.
2. Check that the Now view is installed. If it is not, give the two install commands in `README.md`.

## 10. Finish

1. Run the checks:
   - `git status --short` in this checkout lists none of `notes`, `lewitt.env`, `worktrees` or `.claude/agent-memory`.
   - `git -C "$APP_REPO" status --short` lists neither `.lewitt/` nor any change the setup made.
   - `git config core.hooksPath` prints `.githooks`.
   - With a front-end engineer, `node --check scripts/screenshot.mjs` passes, and the `PLAYWRIGHT_DIR` folder resolves `@playwright/test`.
2. Tell the design lead what was set up, the roles in `notes/roles.md`, each answer still `Unknown`, and the file to edit for each one.
3. Ask the design lead to describe the first project.
