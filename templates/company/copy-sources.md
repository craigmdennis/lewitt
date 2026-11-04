## Copy sources

Fill in this list for your product, and save it as `company/copy-sources.md`. The copywriter reads the sources in the order the `copy-rules` skill sets.

- **The company's copy skill or style guide:** `<skill name or path>`, and its terminology list: `<path>`.
- **The design system's language guidance**, relative to `$APP_REPO`:
  - `<path>` for text that an AI feature writes.
  - `<path>` for dates, times, amounts and counts.
  - `<path>` for accessible names.
  - The component pages: `<paths>`.
- **Existing strings:** `rg -n "<term>" "$APP_REPO/<source folder>"`.
