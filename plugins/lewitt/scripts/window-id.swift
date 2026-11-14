// Prints the window number of the frontmost on-screen window of a running app,
// for `screencapture -l`. Exits 1 when the app has no on-screen window.
//
// Usage: swift scripts/window-id.swift <app name>
//        screencapture -o -l "$(swift scripts/window-id.swift <app name>)" <file>.png
import CoreGraphics
import Foundation

guard CommandLine.arguments.count == 2 else {
    FileHandle.standardError.write("Usage: swift scripts/window-id.swift <app name>\n".data(using: .utf8)!)
    exit(2)
}
let app = CommandLine.arguments[1]
let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] ?? []
// The list is in front-to-back order. Layer 0 holds normal windows.
guard let window = windows.first(where: { $0[kCGWindowOwnerName as String] as? String == app && $0[kCGWindowLayer as String] as? Int == 0 }),
      let number = window[kCGWindowNumber as String] as? Int else {
    FileHandle.standardError.write("\(app) has no on-screen window.\n".data(using: .utf8)!)
    exit(1)
}
print(number)
