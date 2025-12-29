# Scoped Settings Guide

This document provides comprehensive documentation for the hierarchical settings resolution system in ccstatusline, which mirrors Claude Code's configuration patterns.

## Table of Contents

- [Overview](#overview)
- [Motivation](#motivation)
- [Settings Paths](#settings-paths)
- [Precedence and Merging](#precedence-and-merging)
- [Core Implementation](#core-implementation)
- [TUI Integration](#tui-integration)
- [API Reference](#api-reference)
- [Type Definitions](#type-definitions)
- [Testing](#testing)
- [Migration from Legacy Config](#migration-from-legacy-config)

---

## Overview

ccstatusline implements a hierarchical settings resolution system with three scopes:

| Scope | Path | Purpose | Git Status |
|-------|------|---------|------------|
| **User** | `~/.claude/statusline/settings.json` | Personal global defaults | N/A |
| **Project** | `.claude/statusline/settings.json` | Team-shared settings | Committed |
| **Local** | `.claude/statusline/settings.local.json` | Personal project overrides | Gitignored |

This design enables:
- Team-shared project configurations committed to version control
- Personal overrides that don't affect other developers
- User-level defaults that apply across all projects

---

## Motivation

### Previous System

Previously, ccstatusline stored settings in a single location:
```
~/.config/ccstatusline/settings.json
```

This had limitations:
- No way to share project-specific settings with team members
- No separation between personal and shared configurations
- Didn't align with Claude Code's configuration patterns

### New System

The new system aligns with Claude Code's settings resolution mechanism:
- Respects `CLAUDE_CONFIG_DIR` environment variable
- Uses `.claude/` directory structure
- Follows the same scope precedence pattern

---

## Settings Paths

### User Scope

```
~/.claude/statusline/settings.json
```

Or with `CLAUDE_CONFIG_DIR` set:
```
$CLAUDE_CONFIG_DIR/statusline/settings.json
```

**Purpose**: Global user preferences that apply across all projects.

**Examples**:
- Preferred color scheme
- Default terminal width mode
- Personal widget preferences

### Project Scope

```
{git-root}/.claude/statusline/settings.json
```

**Purpose**: Team-shared settings committed to the repository.

**Examples**:
- Project-specific status line layout
- Team-standardized widgets
- Environment indicators (DEV, PROD labels)

**Note**: The project root is detected using `git rev-parse --show-toplevel`. If not in a git repository, falls back to the current working directory.

### Local Scope

```
{git-root}/.claude/statusline/settings.local.json
```

**Purpose**: Personal overrides within a project, not shared with team.

**Examples**:
- Custom colors overriding project theme
- Personal debugging widgets
- Developer-specific customizations

**Automatic Gitignore**: When saving to the local scope, ccstatusline automatically adds the pattern to `.gitignore`:
```
# ccstatusline local settings
.claude/statusline/settings.local.json
```

---

## Precedence and Merging

### Precedence Order (Highest to Lowest)

1. **Local** - `.claude/statusline/settings.local.json`
2. **Project** - `.claude/statusline/settings.json`
3. **User** - `~/.claude/statusline/settings.json`
4. **Defaults** - Zod schema defaults

Higher precedence settings override lower precedence settings.

### Merge Strategy

The `deepMerge` function implements a specific merge strategy:

#### Objects: Recursive Merge

Nested objects are merged recursively, preserving keys from both sources:

```typescript
// User scope
{ colors: { foreground: 'white', background: 'black' } }

// Project scope
{ colors: { foreground: 'cyan' } }

// Result
{ colors: { foreground: 'cyan', background: 'black' } }
```

#### Arrays: Complete Replacement

Arrays are replaced entirely, not merged element-by-element:

```typescript
// User scope
{ lines: [['model', 'separator', 'git-branch']] }

// Project scope
{ lines: [['model', 'version']] }

// Result
{ lines: [['model', 'version']] }  // Completely replaced
```

**Rationale**: Status line layouts are intentional configurations. Merging arrays would create unexpected combinations.

#### Primitives: Replacement

Simple values (strings, numbers, booleans) are replaced:

```typescript
// User scope
{ colorLevel: 3 }

// Project scope
{ colorLevel: 1 }

// Result
{ colorLevel: 1 }
```

### Merge Example

```typescript
// Defaults
{
  version: 3,
  colorLevel: 3,
  lines: [[{ type: 'model' }]],
  powerline: { enabled: false }
}

// User scope
{
  colorLevel: 2,
  powerline: { enabled: true, theme: 'default' }
}

// Project scope
{
  lines: [[{ type: 'model' }, { type: 'git-branch' }]]
}

// Local scope
{
  powerline: { theme: 'rainbow' }
}

// Final merged result
{
  version: 3,
  colorLevel: 2,                    // From user
  lines: [[{ type: 'model' }, { type: 'git-branch' }]],  // From project (replaced)
  powerline: {
    enabled: true,                  // From user
    theme: 'rainbow'                // From local (overrides user)
  }
}
```

---

## Core Implementation

### File Structure

The implementation uses a wrapper pattern to minimize merge conflicts with upstream:

```
src/
├── types/
│   └── SettingsScope.ts       # Type definitions
├── utils/
│   ├── config.ts              # Original (unchanged)
│   ├── scoped-config.ts       # New wrapper module
│   └── __tests__/
│       └── scoped-config.test.ts
└── tui/
    ├── hooks/
    │   └── useScopedSettings.ts
    └── components/
        ├── ScopeSaveDialog.tsx
        └── ManageScopesMenu.tsx
```

### scoped-config.ts

The core module that wraps the original `config.ts` without modifying it.

#### Path Resolution

```typescript
// User settings directory
export function getUserSettingsDir(): string {
    return path.join(getClaudeConfigDir(), 'statusline');
}

// Project root (git-aware)
export function getProjectRoot(): string {
    try {
        const gitRoot = execSync('git rev-parse --show-toplevel', {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'ignore']
        }).trim();
        return gitRoot;
    } catch {
        return process.cwd();
    }
}

// Project settings directory
export function getProjectSettingsDir(): string {
    return path.join(getProjectRoot(), '.claude', 'statusline');
}

// Full path for a scope
export function getSettingsPathForScope(scope: SettingsScope): string {
    switch (scope) {
        case 'user':
            return path.join(getUserSettingsDir(), 'settings.json');
        case 'project':
            return path.join(getProjectSettingsDir(), 'settings.json');
        case 'local':
            return path.join(getProjectSettingsDir(), 'settings.local.json');
    }
}
```

#### Deep Merge Implementation

```typescript
function isPlainObject(value: unknown): value is Record<string, unknown> {
    return (
        typeof value === 'object'
        && value !== null
        && !Array.isArray(value)
        && Object.getPrototypeOf(value) === Object.prototype
    );
}

export function deepMerge<T extends Record<string, unknown>>(
    ...sources: (Partial<T> | undefined)[]
): T {
    const result: Record<string, unknown> = {};

    for (const source of sources) {
        if (!source) continue;

        for (const [key, value] of Object.entries(source)) {
            if (value === undefined) continue;

            if (Array.isArray(value)) {
                // Arrays replaced entirely
                result[key] = Array.from(value);
            } else if (isPlainObject(value) && isPlainObject(result[key])) {
                // Objects merged recursively
                result[key] = deepMerge(result[key], value);
            } else {
                // Primitives replaced
                result[key] = value;
            }
        }
    }

    return result as T;
}
```

#### Settings Resolution

```typescript
export async function resolveSettings(): Promise<ResolvedSettings> {
    const userPath = getSettingsPathForScope('user');
    const projectPath = getSettingsPathForScope('project');
    const localPath = getSettingsPathForScope('local');

    // Load from each scope (undefined if missing/invalid)
    const userSettings = await loadSingleScopeSettings(userPath);
    const projectSettings = await loadSingleScopeSettings(projectPath);
    const localSettings = await loadSingleScopeSettings(localPath);

    // Get defaults from Zod schema
    const defaults = SettingsSchema.parse({});

    // Merge with precedence: local > project > user > defaults
    const merged = deepMerge<Settings>(
        defaults,
        userSettings,
        projectSettings,
        localSettings
    );

    // Validate final result
    const validated = SettingsSchema.parse(merged);

    // Track which sources were loaded
    const sources: SettingsSources = {
        user: userSettings ? userPath : null,
        project: projectSettings ? projectPath : null,
        local: localSettings ? localPath : null
    };

    return { settings: validated, sources };
}
```

#### Migration Handling

Settings are automatically migrated when loaded:

```typescript
async function loadSingleScopeSettings(
    settingsPath: string
): Promise<Partial<Settings> | undefined> {
    // Check file existence
    if (!fs.existsSync(settingsPath)) {
        return undefined;
    }

    const content = await readFile(settingsPath, 'utf-8');
    let rawData = JSON.parse(content);

    // Check for version and migrate if needed
    const hasVersion = typeof rawData === 'object'
        && rawData !== null
        && 'version' in rawData;

    if (!hasVersion || needsMigration(rawData, CURRENT_VERSION)) {
        rawData = migrateConfig(rawData, CURRENT_VERSION);
        // Save migrated settings back to disk
        await writeFile(settingsPath, JSON.stringify(rawData, null, 2), 'utf-8');
    }

    return rawData as Partial<Settings>;
}
```

---

## TUI Integration

### Header Scope Indicators

When project or local scopes are active, indicators appear in the header:

```
ccstatusline v1.2.3 [Project] [Local]
```

- **[Project]** - Cyan, appears when project scope has settings
- **[Local]** - Yellow, appears when local scope has settings

### Manage Scopes Menu

Accessed via Main Menu → "Manage Scopes", this screen shows:

```
Manage Settings Scopes
Settings are merged: Local > Project > User > Defaults

User (Global) (active, default save target)
  ~/.claude/statusline/settings.json

Project (Shared) (not configured)
  /path/to/project/.claude/statusline/settings.json
  → Create settings in this scope

Local (Personal) (not configured)
  /path/to/project/.claude/statusline/settings.local.json
  → Create settings in this scope

← Back
```

**Available Actions**:

| Action | Description |
|--------|-------------|
| Set as default save target | Changes which scope receives save operations |
| Create settings in this scope | Creates new settings file with current config |
| Delete this scope | Removes the settings file (with confirmation) |

**Restrictions**:
- User scope cannot be deleted (always required)
- Delete requires Y/N confirmation

### Save Scope Selection

When pressing Ctrl+S with multiple scopes active, a dialog appears:

```
Save to which scope?

▶ User (Global)           (current)
    ~/.claude/statusline/settings.json

  Project (Shared)         (exists)
    /project/.claude/statusline/settings.json

  Local (Personal)         (new)
    /project/.claude/statusline/settings.local.json

↑↓ select, Enter confirm, ESC cancel
```

**Status Indicators**:
- `(current)` - Currently selected save target
- `(exists)` - Scope has settings but isn't current target
- `(new)` - Scope doesn't have settings yet

### Automatic Save Scope Selection

On startup, the save scope is automatically set to the highest-priority existing scope:

```typescript
if (sources.local) {
    setSaveScope('local');
} else if (sources.project) {
    setSaveScope('project');
} else {
    setSaveScope('user');
}
```

---

## API Reference

### Loading Settings

```typescript
// Simple load (returns Settings)
const settings = await loadScopedSettings();

// Load with source tracking (returns ResolvedSettings)
const { settings, sources } = await loadScopedSettings({
    includeSourceInfo: true
});
```

### Saving Settings

```typescript
// Save to specific scope
await saveScopedSettings(settings, { scope: 'project' });

// Save with directory creation control
await saveScopedSettings(settings, {
    scope: 'local',
    createIfMissing: true  // Default: true
});
```

### Scope Management

```typescript
// Check if scope has settings
const hasProject = scopeHasSettings('project');

// Create new scope with current settings
await createScopeSettings('local', existingSettings);

// Delete scope settings
await deleteScopeSettings('project');

// Get all paths
const paths = getAllScopePaths();
// { user: '...', project: '...', local: '...' }
```

### Gitignore Management

```typescript
// Automatically called when saving to local scope
await ensureLocalSettingsGitignored();
```

---

## Type Definitions

### SettingsScope

```typescript
export type SettingsScope = 'user' | 'project' | 'local';
```

### SettingsSources

```typescript
export interface SettingsSources {
    user: string | null;     // Path if loaded, null if not
    project: string | null;
    local: string | null;
}
```

### ResolvedSettings

```typescript
export interface ResolvedSettings {
    settings: Settings;      // Merged, validated settings
    sources: SettingsSources; // Which files contributed
}
```

### LoadScopedSettingsOptions

```typescript
export interface LoadScopedSettingsOptions {
    includeSourceInfo?: boolean;  // Return ResolvedSettings instead of Settings
}
```

### SaveScopedSettingsOptions

```typescript
export interface SaveScopedSettingsOptions {
    scope: SettingsScope;         // Target scope
    createIfMissing?: boolean;    // Create directories (default: true)
}
```

---

## Testing

### Test Coverage

The test suite (`src/utils/__tests__/scoped-config.test.ts`) covers:

| Area | Tests | Coverage |
|------|-------|----------|
| Path resolution | 7 tests | All scope paths, git fallback |
| Deep merge | 8 tests | Objects, arrays, primitives, edge cases |

### Mocking Strategy

```typescript
// Mock git detection
vi.mock('child_process', () => ({
    execSync: vi.fn()
}));

// Mock config directory
vi.mock('../claude-settings', () => ({
    getClaudeConfigDir: vi.fn(() => '/home/user/.claude')
}));
```

### Deep Merge Test Cases

| Test | Behavior |
|------|----------|
| Recursive object merging | Nested objects merge, preserve unmodified keys |
| Array replacement | Arrays replaced entirely |
| Primitive replacement | Values overwritten |
| Undefined handling | Skipped silently |
| Empty source handling | No effect on result |
| Multiple source precedence | Left-to-right, later wins |
| Nested arrays | Arrays in objects still replaced |

---

## Migration from Legacy Config

### Automatic Migration

When loading settings, the system automatically:
1. Checks for `version` field
2. Runs migration if missing or outdated
3. Saves migrated settings back to disk

### No Auto-Import

Settings are **not** automatically imported from the legacy location:
```
~/.config/ccstatusline/settings.json  (legacy, not imported)
```

Users start fresh with the new location. This prevents confusion about which settings are active.

### Manual Migration

To manually migrate settings:

1. Copy your existing settings:
   ```bash
   mkdir -p ~/.claude/statusline
   cp ~/.config/ccstatusline/settings.json ~/.claude/statusline/settings.json
   ```

2. Run ccstatusline to verify and auto-migrate the schema version

---

## Package Publication

The scoped settings feature was released as part of the npm package:

```
@wvandaalen/ccstatusline
```

### Installation

```bash
npx -y @wvandaalen/ccstatusline@latest
```

### Claude Code Integration

```json
{
  "statusLine": {
    "type": "command",
    "command": "npx -y @wvandaalen/ccstatusline@latest",
    "padding": 0
  }
}
```

---

## Design Decisions

### Wrapper Pattern

The implementation uses a wrapper pattern (`scoped-config.ts` wrapping `config.ts`) to:
- Minimize changes to existing files
- Reduce merge conflicts when pulling upstream updates
- Keep original config.ts as a working fallback

### Array Replacement vs Merge

Arrays are replaced entirely rather than merged because:
- Status line layouts are intentional configurations
- Merging arrays could create unexpected widget combinations
- Users expect to override layouts completely at higher scopes

### Git Root Detection

Project root is determined by git repository root because:
- Projects are typically git repositories
- Consistent with Claude Code's project detection
- Falls back gracefully to cwd for non-git directories

### Local Settings Gitignore

Local settings are automatically gitignored to:
- Prevent accidental commits of personal overrides
- Reduce repository noise
- Align with the "personal project overrides" use case

---

## See Also

- [README.md](../README.md) - Main project documentation
- [CLAUDE.md](../CLAUDE.md) - Development instructions
- [custom-widgets-guide.md](./custom-widgets-guide.md) - Custom widgets documentation
- [custom-modules-guide.md](./custom-modules-guide.md) - Reusable custom modules
- [src/utils/scoped-config.ts](../src/utils/scoped-config.ts) - Core implementation
- [src/types/SettingsScope.ts](../src/types/SettingsScope.ts) - Type definitions
