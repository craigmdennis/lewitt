// The Now view's version, the same as in .claude-plugin/plugin.json. The
// pre-commit hook checks the two match. `scripts/now-view.sh local` rewrites this file in an
// installed copy, with LOCAL set to the commit the copy came from.
export const VERSION = '0.1.29'
export const LOCAL: string | undefined = undefined
