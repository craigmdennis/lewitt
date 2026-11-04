---
name: copy-rules
description: Where the product's copy rules and approved strings are, the order to check them in, and the checks each string passes before it goes back to the designer. Use for any UI string in a prototype or build.
---

# Copy rules

`company/copy-sources.md` in this repository names the company's copy sources: its copy skill or style guide, the design system's language guidance, and the folders that hold existing strings. This skill sets the order to check them in. When two sources disagree, the earlier source in this list applies, and the reply names the conflict.

## Sources, in order

1. **The design lead's decisions for the project.** The decision log in the run folder (`decision-log.md`) and the state file (`states.md`). A string that the design lead wrote or approved stays as written.
2. **The design system's language guidance**, as `company/copy-sources.md` lists it. Read the page of each component that shows the string.
3. **Pattern rules the design lead approved,** in `company/pattern-rules.md`.
4. **The company's copy skill or style guide,** when `company/copy-sources.md` names one.
5. **`guides/ux-writing.md`** in this repository, including its self-edit.
6. **Existing strings in the app.** Before writing a new string for an action, a state or an object, search the app repository for the same action, state or object, in the folders `company/copy-sources.md` names. Reuse an existing string when the action is the same, and name the file and line.

## Checks on each string

1. The string names the user's task or the result, in the words of the screen it sits on.
2. One action has one verb and one object name on every surface where it appears.
3. Each source rule that applies is followed, and the reply cites it.
4. The accessible name of each control is written, and it names the object when the visible label does not.
5. Each placeholder, such as `{Brand} ending in {last4}`, has one filled example.
6. The string is true in every state where it shows. List the states.

## Reply format

The designer reads the reply in its own context, so it holds the table and the questions only. Give no summary of the sources read.

| State | Element | String | Accessible name | Source |
|---|---|---|---|---|

- **Element:** button, link, toast, message title, message body, modal title, label, or helper text.
- **Source:** a short reference, such as `Toast.mdx:47`, `entry 189`, `Messages/index.tsx:30` or `memory`. Write `none` when no source applies.

After the table, list each question for the designer, numbered. Add a conflict between two sources only when it changed a string, in one line.
