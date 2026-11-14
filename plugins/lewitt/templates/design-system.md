## Design system guidance

Fill in this guide for your design system, and save it as `.lewitt/design-system.md`. It applies the design system and the design lead's rules to the principles in `guides/visual-design.md`. Where it conflicts with a general principle, this guidance applies.

### Foundations

Before a build or a review, read the foundations that apply, in `<path>` in the app repository:

- `<typography>`, `<colour>`, `<icons>`, `<spacing>`.
- `<accessibility>`, `<numbers>`, `<dates and times>`.

### Tokens

| Token | Values |
|---|---|
| Spacing, `<prefix>` | `<values>` |
| Radius, `<prefix>` | `<values>` |

Space elements with the layout components `<names>` and the spacing tokens. A value off the scale is a judgement call.

### Text styles

| Component | Use | Sizes |
|---|---|---|
| `<name>` | `<use>` | `<sizes>` |

### Rules from the design lead's feedback

Each rule is a default, with the designer's discretion as the exception unless the rule states another exception. The designer adds each new pattern rule and org rule to `.lewitt/pattern-rules.md` after the design lead decides its level.

### Editing Figma renders

Before you call `use_figma`, read the `figma-use` skill.

1. **Edit a node before you move it.** Moving a node inside a component slot can invalidate the IDs of its children. Make every edit inside a node first, then move it.
2. **Keep no node handle across a move.** Before each operation, find the node again with `findOne` or `children`.
3. **Recreate a text node to move it out of a moved frame.** Create a new text node with the same style, fills and characters, append it where it belongs, and remove the old one.
4. **Limit a bulk pass to frames outside instances.** A pass that sets a property on every frame also overrides layers inside component instances.
5. **Vary one thing between options.** In a comparison of options, each option differs from the others in one change only.
6. **Return only what the next step needs.** A `use_figma` script returns the IDs and the few properties the next step uses, under 2 KB. Each result stays in the conversation for the rest of the run.
7. **View each screenshot once.** Check alignment and spacing with measurements from `absoluteBoundingBox`, and view the screenshot once at the end.
8. **Write each result as soon as it is ready.** A failed `use_figma` script rolls back completely. Send the design lead each finished frame before you build the next one.

### The visual check

A contact sheet hides an offset of a few pixels. Run the visual check on each state a version builds, before you send a build and in every review.

1. Run the layout check on the state, from the product folder, with `.lewitt/paths` loaded as `.lewitt/app.md` describes:

   ```sh
   node "$LEWITT_ROOT/scripts/screenshot.mjs" "$SESSION_FILE" --layout 'file://<run>/prototype/v<n>/index.html?state=<ID>' <run>/screenshots/layout-<ID>.png --selector '<css>' --wait 1000
   ```

   The check lists each pair of neighbouring elements whose edges miss by 1 to 4 px, and each heading with less space above it than below it. The PNG shows each finding outlined and numbered. For a page on a dev server, use its URL and `--wait 15000`.
2. Fix each finding. When a finding is intended, record a judgement call that names the principle.
3. View the state's own screenshot at full size, and check:
   - **Alignment:** edges, text baselines, and each icon centred on its text.
   - **Spacing:** values on the scale, one space for one relationship, and smaller space inside a group than between groups.
   - **Text styles:** one style for each job, and clear changes of level.
   - **Colour:** tokens only, contrast, and no meaning carried by colour alone.
   - **Hierarchy:** one primary action, and a reading order that matches the task.
   - **Consistency:** each element looks like the elements with the same job on the page.
   - **Content:** long text, a missing value, and the empty state.
4. In the reply to the design lead, state the result: "Visual check: no findings", or each finding with its fix or its judgement call. Attach the layout PNG when the check has findings.
