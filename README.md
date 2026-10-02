# Floating Workspace Bar

A GNOME Shell extension for **GNOME 50** that adds a floating bar on any edge of your screen (left, right, top or bottom). The bar slides in and out with a keyboard shortcut and shows live, miniature previews of every workspace. Click a preview to jump to that workspace.

## Features

- Floating bar on the **left, right, top or bottom** edge of the primary monitor
- **Slide in / slide out** animation, toggled with a configurable shortcut (default: `Super+Shift+W`)
- Live thumbnails of the windows in **every workspace**, with workspace numbers
- Current workspace highlighted with a blue border
- **Click a thumbnail to switch** to that workspace (optionally auto-hides afterwards)
- Adjustable sizes:
  - Workspace preview width (80-600 px, height follows screen aspect ratio)
  - Maximum bar length (% of the screen edge)
  - Bar padding
  - Animation duration
- Bar scrolls automatically when there are more workspaces than fit

## Requirements

- GNOME Shell 50 (Wayland)

## Installation

### From the zip

```bash
unzip floating-workspace-bar@example.com.zip \
  -d ~/.local/share/gnome-shell/extensions/floating-workspace-bar@example.com
```

### From the source folder

```bash
cp -r floating-workspace-bar@example.com ~/.local/share/gnome-shell/extensions/
glib-compile-schemas ~/.local/share/gnome-shell/extensions/floating-workspace-bar@example.com/schemas/
```

Then **log out and log back in** (GNOME on Wayland cannot reload extensions in place) and enable it:

```bash
gnome-extensions enable floating-workspace-bar@example.com
```

### Testing without logging out

```bash
dbus-run-session gnome-shell --devkit
```

## Usage

1. Press the shortcut (default `Super+Shift+W`) to slide the bar in.
2. Click any workspace thumbnail to jump to it.
3. Press the shortcut again to slide the bar out.

## Settings

Open them with:

```bash
gnome-extensions prefs floating-workspace-bar@example.com
```

| Setting | Description | Default |
|---|---|---|
| Screen edge | Left, Right, Top or Bottom | Left |
| Toggle shortcut | Click, then press keys. Backspace clears, Esc cancels | `Super+Shift+W` |
| Slide out after jumping | Hide the bar after you pick a workspace | On |
| Workspace preview width | Width of each thumbnail in px | 200 |
| Maximum bar length | Percent of the screen edge the bar may use | 90 |
| Bar padding | Padding inside the bar in px | 10 |
| Slide animation | Animation time in ms (0 disables it) | 250 |

Settings can also be changed from the command line, for example:

```bash
gsettings --schemadir ~/.local/share/gnome-shell/extensions/floating-workspace-bar@example.com/schemas \
  set org.gnome.shell.extensions.floating-workspace-bar side 'bottom'
```

## Files

| File | Purpose |
|---|---|
| `metadata.json` | Extension metadata (UUID, supported Shell version) |
| `extension.js` | The bar, animations, thumbnails and shortcut handling |
| `prefs.js` | Preferences window (Adwaita) |
| `stylesheet.css` | Look of the bar and thumbnails |
| `schemas/` | GSettings schema for the options above |

## Known limitations

- Only windows on the **primary monitor** are shown.
- Clicking a thumbnail switches workspace but does not focus the specific window you clicked.
- Minimized windows and windows hidden from the taskbar are not shown.

## Troubleshooting

View Shell errors live:

```bash
journalctl -f -o cat /usr/bin/gnome-shell
```

If you rename the extension, change both the folder name and the `uuid` in `metadata.json` so they match.

## Customizing the look

Edit `stylesheet.css` to change colors, rounding and borders. If you change the thumbnail border width, update the `BORDER` constant at the top of `extension.js` to match.
