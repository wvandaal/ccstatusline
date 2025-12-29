# Custom Widgets Guide

This document provides comprehensive documentation for the CustomText and CustomCommand widgets in ccstatusline, including implementation details, configuration options, and TUI usage.

## Table of Contents

- [Overview](#overview)
- [CustomText Widget](#customtext-widget)
- [CustomCommand Widget](#customcommand-widget)
- [TUI Configuration](#tui-configuration)
- [Widget Registry Architecture](#widget-registry-architecture)
- [Examples](#examples)

---

## Overview

ccstatusline provides two user-definable widgets for extending the status line:

| Widget | Purpose | Content |
|--------|---------|---------|
| **CustomText** | Static text display | User-defined text, emoji, labels |
| **CustomCommand** | Dynamic command output | Shell command execution results |

Both widgets support:
- Color customization (named colors, hex, ANSI 256)
- Bold styling
- Merging with adjacent widgets

---

## CustomText Widget

### Purpose

CustomText displays user-defined static text in the status line. It's ideal for:
- Project identifiers or environment labels (e.g., "DEV", "PROD")
- Emoji decorations or icons
- Custom separators or labels
- Any static text that doesn't change

### Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `customText` | string | `''` | The text to display |
| `color` | string | `'white'` | Foreground color |
| `backgroundColor` | string | - | Background color (powerline mode) |
| `bold` | boolean | `false` | Bold text styling |
| `merge` | boolean \| `'no-padding'` | - | Merge with next widget |

### Rendering

CustomText is the simplest widget - it directly returns the `customText` value:

```typescript
render(item: WidgetItem): string | null {
    return item.customText ?? '';
}
```

No variable substitution or processing is performed. The text appears exactly as entered.

### TUI Configuration

1. In ItemsEditor, add a widget and cycle to "Custom Text"
2. Press `e` to edit the text
3. The inline editor supports:
   - Full cursor navigation (arrow keys)
   - Ctrl+Left/Right to jump to start/end
   - Backspace and Delete
   - Emoji and multi-byte character support (grapheme-aware)
4. Press Enter to save, ESC to cancel

### Settings Example

```json
{
  "id": "label-1",
  "type": "custom-text",
  "customText": "DEV ",
  "color": "green",
  "bold": true
}
```

---

## CustomCommand Widget

### Purpose

CustomCommand executes a shell command and displays its output in the status line. It's ideal for:
- Git information (commit hash, status)
- Environment data (time, date, hostname)
- External tool integration (weather, system metrics)
- Integration with other statusline tools (e.g., ccusage)

### Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `commandPath` | string | - | Shell command to execute |
| `timeout` | number | `1000` | Max execution time in milliseconds |
| `maxWidth` | number | - | Maximum output width (truncates with `...`) |
| `preserveColors` | boolean | `false` | Preserve ANSI color codes from output |
| `color` | string | `'white'` | Foreground color (ignored if preserveColors) |
| `backgroundColor` | string | - | Background color (powerline mode) |
| `bold` | boolean | `false` | Bold text styling |

### Command Execution

Commands are executed using Node.js `execSync`:

```typescript
execSync(item.commandPath, {
    encoding: 'utf8',
    input: JSON.stringify(context.data),  // Claude Code JSON via stdin
    timeout: item.timeout ?? 1000,
    stdio: ['pipe', 'pipe', 'ignore'],    // stdin piped, stdout captured, stderr ignored
    env: process.env
});
```

**Important behaviors:**
- Commands run synchronously (blocks until completion or timeout)
- Commands execute on every status line refresh
- Full Claude Code JSON data is piped to stdin
- stderr is silently ignored
- Environment variables are inherited

### Stdin JSON Data

Commands receive Claude Code status data via stdin:

```json
{
  "model": {
    "id": "claude-sonnet-4-5-20250929[1m]"
  },
  "transcript_path": "/path/to/.claude/projects/.../logs/00001.jsonl",
  "session_id": "abc123...",
  "version": "1.0.48"
}
```

This allows commands to access session information if needed.

### Output Processing

1. **ANSI Code Handling**: If `preserveColors` is false, ANSI escape sequences are stripped
2. **Width Truncation**: If output exceeds `maxWidth`, it's truncated with `...` suffix
3. **Trimming**: Output is always trimmed of leading/trailing whitespace

### Error Handling

Commands can fail in various ways. Each produces a specific error message:

| Error | Output | Description |
|-------|--------|-------------|
| Command not found | `[Cmd not found]` | Invalid command path (ENOENT) |
| Timeout | `[Timeout]` | Exceeded timeout duration (ETIMEDOUT) |
| Permission denied | `[Permission denied]` | No execute permission (EACCES) |
| Non-zero exit | `[Exit: N]` | Command exited with code N |
| Signal termination | `[Signal: SIGTERM]` | Command killed by signal |
| Other errors | `[Error]` | Generic fallback |

### TUI Configuration

1. In ItemsEditor, add a widget and cycle to "Custom Command"
2. Available keybinds:

| Key | Action | Description |
|-----|--------|-------------|
| `e` | Edit command | Open command path editor |
| `w` | Edit width | Set maxWidth (numeric input) |
| `t` | Edit timeout | Set timeout in ms (numeric input) |
| `p` | Toggle preserve | Toggle preserveColors flag |

3. The command editor supports cursor navigation and standard text editing
4. Width/timeout editors accept numeric input only

### Performance Considerations

Since commands run on every status line refresh:

- **Fast commands (100-500ms)**: `pwd`, `git rev-parse --short HEAD`, `date`
- **Medium commands (1000-5000ms)**: Network requests, complex tools
- **Set appropriate timeout**: Default is 1000ms, increase for slower commands

### Settings Example

```json
{
  "id": "git-hash",
  "type": "custom-command",
  "commandPath": "git rev-parse --short HEAD",
  "timeout": 1000,
  "maxWidth": 8,
  "color": "yellow"
}
```

### Command Examples

| Command | Purpose | Timeout |
|---------|---------|---------|
| `pwd \| xargs basename` | Current directory name | 1000 |
| `node -v` | Node.js version | 1000 |
| `git rev-parse --short HEAD` | Current commit hash | 1000 |
| `date +%H:%M` | Current time | 1000 |
| `curl -s wttr.in?format="%t"` | Weather temperature | 3000 |
| `npx -y ccusage@latest statusline` | Claude usage metrics | 5000 |

---

## TUI Configuration

### ItemsEditor Navigation

The ItemsEditor is the main interface for configuring widgets:

**Widget Selection:**
- Up/Down arrows: Navigate between widgets
- Left/Right arrows: Cycle through widget types

**Widget Management:**
- `a`: Add widget after selected
- `i`: Insert widget before selected
- `d`: Delete selected widget
- `c`: Clear entire line
- Enter: Toggle move mode (reorder widgets)

**Widget Options:**
- `m`: Cycle merge state (off → merge → no-padding → off)
- `r`: Toggle raw value (for supported widgets)
- `Space`: Cycle separator character (separators only)

**Custom Widget Actions:**
When a CustomText or CustomCommand is selected, additional keybinds appear in the help text.

### Editor Display

Widgets show their current configuration in the editor:

**CustomText:**
```
1. Custom Text (My Label)
```

**CustomCommand:**
```
2. Custom Command (git rev-parse...) (max:8, timeout:2000ms, preserve)
```

The parenthetical modifiers show active options.

### Save Flow

1. Make changes in ItemsEditor
2. Press ESC to return to LineSelector
3. Press Ctrl+S or select "Save" from MainMenu
4. If multiple scopes exist, select target scope
5. Settings written to disk

---

## Widget Registry Architecture

### Registry Pattern

Widgets are registered in a Map-based registry (`src/utils/widgets.ts`):

```typescript
const widgetRegistry = new Map<WidgetItemType, Widget>([
    ['custom-text', new CustomTextWidget()],
    ['custom-command', new CustomCommandWidget()],
    // ... 20+ other widgets
]);
```

### Widget Interface

All widgets implement the Widget interface:

```typescript
interface Widget {
    // Identity
    getDefaultColor(): string;
    getDescription(): string;
    getDisplayName(): string;

    // Editor display
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay;

    // Core rendering
    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null;

    // Capability flags
    supportsRawValue(): boolean;
    supportsColors(item: WidgetItem): boolean;

    // Optional: Custom editor support
    getCustomKeybinds?(): CustomKeybind[];
    renderEditor?(props: WidgetEditorProps): React.ReactElement | null;
    handleEditorAction?(action: string, item: WidgetItem): WidgetItem | null;
}
```

### Registry Functions

| Function | Purpose |
|----------|---------|
| `getWidget(type)` | Get widget instance by type string |
| `getAllWidgetTypes(settings)` | Get available types (respects powerline settings) |
| `isKnownWidgetType(type)` | Validate if type is registered |

### Rendering Flow

```
WidgetItem (configuration)
    ↓
Registry lookup: getWidget(type)
    ↓
Widget.render(item, context, settings)
    ↓
String output
    ↓
Renderer applies colors, padding, separators
    ↓
Final status line
```

---

## Examples

### Emoji Label with Custom Text

Create a labeled widget by merging CustomText with another widget:

```json
[
  {
    "id": "emoji-label",
    "type": "custom-text",
    "customText": " ",
    "merge": true
  },
  {
    "id": "git-branch",
    "type": "git-branch",
    "color": "cyan"
  }
]
```

Result: ` main` (branch icon followed by branch name)

### ccusage Integration

Display Claude API usage with colors:

```json
{
  "id": "usage",
  "type": "custom-command",
  "commandPath": "npx -y ccusage@latest statusline",
  "timeout": 5000,
  "preserveColors": true
}
```

### Multi-Line Status with Custom Widgets

```json
{
  "lines": [
    [
      { "id": "model", "type": "model", "color": "cyan" },
      { "id": "sep1", "type": "separator" },
      { "id": "env", "type": "custom-text", "customText": "DEV", "color": "green" }
    ],
    [
      { "id": "git", "type": "git-branch" },
      { "id": "sep2", "type": "separator" },
      { "id": "time", "type": "custom-command", "commandPath": "date +%H:%M", "color": "gray" }
    ]
  ]
}
```

### Git Commit Hash

```json
{
  "id": "commit",
  "type": "custom-command",
  "commandPath": "git rev-parse --short HEAD",
  "maxWidth": 8,
  "timeout": 1000,
  "color": "yellow"
}
```

### Project Name from Directory

```json
{
  "id": "project",
  "type": "custom-command",
  "commandPath": "pwd | xargs basename",
  "maxWidth": 20,
  "color": "magenta"
}
```

---

## Appendix: WidgetItem Schema

Complete schema for widget configuration:

```typescript
{
    id: string;                          // Unique identifier (auto-generated GUID)
    type: string;                        // Widget type string

    // Styling
    color?: string;                      // Foreground color
    backgroundColor?: string;            // Background color (powerline mode)
    bold?: boolean;                      // Bold text

    // CustomText specific
    customText?: string;                 // Text content

    // CustomCommand specific
    commandPath?: string;                // Shell command
    maxWidth?: number;                   // Max output width
    timeout?: number;                    // Timeout in ms (default 1000)
    preserveColors?: boolean;            // Keep ANSI codes (default false)

    // Layout
    merge?: boolean | 'no-padding';      // Merge with next widget
    rawValue?: boolean;                  // Raw numeric display (supported widgets only)

    // Git widgets
    metadata?: {
        hideNoGit?: 'true' | 'false';    // Hide when not in git repo
    };
}
```

---

## See Also

- [README.md](../README.md) - Main project documentation
- [CLAUDE.md](../CLAUDE.md) - Development instructions
- [src/widgets/](../src/widgets/) - Widget implementations
- [src/utils/widgets.ts](../src/utils/widgets.ts) - Widget registry
