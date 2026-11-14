---
name: libghostty
description: How to embed a Ghostty terminal in a native macOS app through libghostty and GhosttyKit, so that each terminal reads the configuration of the standalone Ghostty app. Covers getting the framework, the app and surface lifecycle, the runtime callbacks, input, actions such as the bell and desktop notifications, and keeping up with an API that changes between Ghostty releases. Use for any task that builds, debugs or updates a libghostty terminal view.
---

# libghostty

libghostty is the Zig library under the Ghostty terminal. The Ghostty macOS app is a Swift app on top of it, through a C header, `include/ghostty.h`, and an XCFramework named GhosttyKit.

## The two APIs

Ghostty publishes two C APIs. Check which one a task needs before writing code.

| API | Header | What it does | Status |
|---|---|---|---|
| The embedder API | `include/ghostty.h` | A full terminal: the PTY and the shell, the Metal renderer, fonts, the Ghostty configuration, keybindings, the clipboard. The host gives it an `NSView`. | Internal. The header names the Ghostty macOS app as its only consumer and documents almost no function. It changes between releases. |
| libghostty-vt | `include/ghostty/` | Terminal state and escape sequence parsing only. The host draws the screen and runs the process. | The API Ghostty recommends for other apps. |

A terminal that has to look and behave like the standalone Ghostty app, with the same configuration, uses the embedder API. libghostty-vt reads no Ghostty configuration and draws nothing.

## Getting GhosttyKit

Choose one way, and record it in the project's build plan:

1. **The `libghostty-spm` Swift package**, at `https://github.com/Lakr233/libghostty-spm.git`. It ships a prebuilt GhosttyKit XCFramework as a binary target. The `GhosttyKit` product exposes `ghostty.h`. The `GhosttyTerminal` product is the package's own Swift layer, with host-managed I/O. A terminal that runs a local shell with the Ghostty configuration uses `GhosttyKit`. Pin an exact version, and record the Ghostty commit the package builds from.
2. **A build from Ghostty's source**, with Zig, as Ghostty's own build of the macOS app does. Read the build instructions at the pinned Ghostty commit for the Zig version and the command that produces `GhosttyKit.xcframework`.

Pin one Ghostty commit. Read `ghostty.h` and the macOS app's sources at that commit only. The header on Ghostty's main branch can differ from the pinned one.

## The reference implementation

The Ghostty macOS app is the only complete example of the embedder API. Before writing a part of the host, read the same part in `macos/Sources/` at the pinned commit, and follow it. List the folder first, because files move between releases. At the time of writing, the parts are:

- the app object, the runtime callbacks and the action handler: `macos/Sources/Ghostty/Ghostty.App.swift`;
- the configuration: `macos/Sources/Ghostty/Ghostty.Config.swift`;
- the terminal view, with input, IME, mouse, resize and focus: `macos/Sources/Ghostty/SurfaceView_AppKit.swift` and `SurfaceView.swift`.

Ghostty's license is MIT. Code copied from Ghostty keeps its copyright notice, in the file or in the app's acknowledgements.

## Lifecycle

The names below are from `ghostty.h`. Check each signature against the pinned header.

1. **Initialise once per process**, before any other call: `ghostty_init(uintptr_t argc, char **argv)`. It returns `GHOSTTY_SUCCESS` (0) on success.
2. **Load the configuration:**
   1. `ghostty_config_new()`.
   2. `ghostty_config_load_default_files(config)` reads the files the standalone Ghostty app reads.
   3. `ghostty_config_load_recursive_files(config)` follows each `config-file` line.
   4. `ghostty_config_finalize(config)`.
   5. Read `ghostty_config_diagnostics_count` and `ghostty_config_get_diagnostic` and show each message, because a wrong configuration line otherwise fails without a message.
   6. Skip `ghostty_config_load_cli_args` unless the host passes Ghostty arguments on its own command line.
3. **Create one app per process:** `ghostty_app_new(&runtime, config)`, with a `ghostty_runtime_config_s`:
   - `userdata`: a pointer to the host's app object.
   - `wakeup_cb`: called from any thread. Schedule `ghostty_app_tick(app)` on the main thread.
   - `action_cb`: receives each action, with a `ghostty_target_s` that is the app or one surface. Return `true` when the host handled the action.
   - `read_clipboard_cb`, `confirm_read_clipboard_cb`, `write_clipboard_cb`: connect these to `NSPasteboard`. Complete or deny each read with `ghostty_surface_complete_clipboard_request` or `ghostty_surface_deny_clipboard_request`.
   - `close_surface_cb`: the shell of a surface exited, or a close was requested.
   - `supports_selection_clipboard`: set it as the reference app does at the pinned commit.
4. **Create one surface per terminal view.** Start from `ghostty_surface_config_new()`, then set:
   - `platform_tag = GHOSTTY_PLATFORM_MACOS`, and `platform.macos.nsview` to the unretained pointer of the host's `NSView`;
   - `userdata` to the view;
   - `scale_factor` to the window's `backingScaleFactor`;
   - `working_directory`, the folder the shell starts in;
   - `command`, when the terminal starts a program in place of the login shell;
   - `env_vars` and `env_var_count`, for variables the host adds;
   - `initial_input`, for text typed into the shell after it starts;
   - `context`, which is `GHOSTTY_SURFACE_CONTEXT_TAB` for a terminal in a tab.

   Call `ghostty_surface_new(app, &config)`, and treat a null result as a failure to show.
5. **Keep the surface current:** `ghostty_surface_set_size` with the size in pixels, `ghostty_surface_set_content_scale` when the screen changes, `ghostty_surface_set_focus`, and `ghostty_surface_set_occlusion` when the tab is hidden.
6. **Free explicitly:** `ghostty_surface_free(surface)` when the tab closes, and `ghostty_app_free` and `ghostty_config_free` at quit. SwiftUI can keep a view object after its tab closes, so free the surface from the close action and never from `deinit` alone.

Copy each C string into the surface configuration with storage that lives until `ghostty_surface_new` returns, for example with `withCString` around the call.

## Hosting in SwiftUI

The terminal is an `NSView` subclass wrapped in `NSViewRepresentable`. libghostty adds its own Metal layer to that view.

- One app object for the whole process, held by the host's app model.
- One surface per tab, created when the tab's view first appears and freed when the tab closes. Switching tabs hides a view and sets occlusion. It does not free the surface.
- The view becomes first responder when its tab is selected, and calls `ghostty_surface_set_focus`.

## Input

Follow the reference view for input. It is the part with the most edge cases.

- Keys go through `NSTextInputClient` so that dead keys and input methods work. Each key event becomes a `ghostty_input_key_s` with the action, the modifiers, the consumed modifiers, the native macOS `keyCode`, the text, the unshifted code point and the composing flag, passed to `ghostty_surface_key`.
- `ghostty_surface_key_is_binding` tells the host whether Ghostty binds a key. The host checks its own menu shortcuts first.
- Preedit text goes to `ghostty_surface_preedit`, and committed text to `ghostty_surface_text`.
- The mouse uses `ghostty_surface_mouse_button`, `ghostty_surface_mouse_pos` with the position in the view's points from the top left, and `ghostty_surface_mouse_scroll`.

## Actions

The action callback receives a `ghostty_action_s` with a tag and a payload. The host handles the actions it supports and returns `false` for the others. The tags a tabbed host usually handles:

| Tag | Payload | A tabbed host |
|---|---|---|
| `GHOSTTY_ACTION_RING_BELL` | none | Marks the tab as waiting for input. |
| `GHOSTTY_ACTION_DESKTOP_NOTIFICATION` | `title`, `body` | Marks the tab as waiting, and can post a user notification. |
| `GHOSTTY_ACTION_SET_TITLE` | `title` | Updates the tab's title. |
| `GHOSTTY_ACTION_PWD` | `pwd` | Records the shell's folder, when shell integration reports it. |
| `GHOSTTY_ACTION_SHOW_CHILD_EXITED` | `exit_code`, run time | Shows that the program ended. |
| `GHOSTTY_ACTION_RENDER` | none | Nothing on macOS, where the renderer draws on its own thread. Check the reference app. |
| `GHOSTTY_ACTION_MOUSE_SHAPE` | a cursor shape | Sets the `NSCursor`. |
| `GHOSTTY_ACTION_CONFIG_CHANGE` | the new configuration | Stores the configuration after a reload. |
| `GHOSTTY_ACTION_NEW_TAB`, `NEW_SPLIT`, `CLOSE_TAB`, `CLOSE_WINDOW` | various | Maps to the host's own tabs, or does nothing. |

`GHOSTTY_ACTION_PWD` is reported by shell integration only. A host that has to know where every child process is reads each process's folder itself, for example with `proc_pidinfo` and `PROC_PIDVNODEPATHINFO`.

## Updating Ghostty

1. Move the pin to the new commit or package version.
2. Diff `include/ghostty.h` between the old and the new commit, and list each changed signature, struct field and action tag.
3. Diff the reference files listed above over the same range, and apply the changes that touch the host's copy.
4. Build, run the tests, and check one terminal by hand: typing, an input method, paste, the bell, resize and closing the tab.
5. Record the new pin and each change in the build plan.

## Checks

- The terminal's font, colours and theme match the standalone Ghostty app with the same configuration file.
- A wrong line in the configuration shows its diagnostic.
- Closing a tab frees its surface, and no surface outlives its tab. Check with Instruments or a log line in the free call.
- Typing with an input method, such as Japanese, places the preedit text at the cursor.
