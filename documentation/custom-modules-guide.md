# Custom Modules Guide

This document provides comprehensive documentation for the Custom Modules feature in ccstatusline, which allows users to define reusable text and command modules that appear alongside native widgets in the TUI type selector.

## Table of Contents

- [Overview](#overview)
- [Modules vs Inline Custom Widgets](#modules-vs-inline-custom-widgets)
- [Module Types](#module-types)
- [TUI Configuration](#tui-configuration)
- [Settings Schema](#settings-schema)
- [Widget Registry Integration](#widget-registry-integration)
- [Examples](#examples)
- [API Reference](#api-reference)
- [Type Definitions](#type-definitions)

---

## Overview

Custom Modules provide a way to define reusable custom text and command configurations that can be quickly added to status lines without reconfiguring each time.

### Key Benefits

| Benefit | Description |
|---------|-------------|
| **Reusability** | Define once, use in multiple lines |
| **Discoverability** | Modules appear alongside native widgets in the type selector |
| **Consistency** | Same configuration across all uses |
| **Maintainability** | Update in one place, applies everywhere |

### How It Works

1. Define modules in `settings.customModules` array
2. Modules appear as `Module: name` in the widget type selector
3. Add modules to lines just like native widgets
4. Widgets reference modules by name using `module:name` type format

---

## Modules vs Inline Custom Widgets

ccstatusline provides two ways to use custom content:

| Feature | Custom Widgets | Custom Modules |
|---------|---------------|----------------|
| Configuration | Inline in each widget | Centralized in settings |
| Reuse | Copy/paste configuration | Reference by name |
| Type selector | "Custom Text" / "Custom Command" | "Module: name" |
| Discovery | Generic types | Named, project-specific |
| Updates | Edit each widget individually | Update module definition |

### When to Use Each

**Use Custom Widgets when:**
- One-off usage in a single line
- Quick testing or experimentation
- Simple static text without reuse

**Use Custom Modules when:**
- Same configuration in multiple lines
- Team-shared widgets via project scope
- Named, discoverable project-specific widgets
- Frequently used commands or text

---

## Module Types

### Text Module

Displays static text, similar to CustomText widget.

```json
{
  "name": "env-label",
  "kind": "text",
  "text": "DEV",
  "description": "Environment indicator",
  "color": "green"
}
```

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `name` | string | Yes | - | Unique identifier (lowercase alphanumeric with hyphens, max 32 chars) |
| `kind` | `"text"` | Yes | - | Module type discriminator |
| `text` | string | Yes | - | Text content to display |
| `description` | string | No | - | Description shown in TUI |
| `color` | string | No | `"white"` | Default foreground color |

### Command Module

Executes a shell command and displays output, similar to CustomCommand widget.

```json
{
  "name": "usage",
  "kind": "command",
  "command": "npx -y ccusage@latest statusline",
  "timeout": 5000,
  "maxWidth": 50,
  "preserveColors": true,
  "description": "Claude API usage metrics",
  "color": "cyan"
}
```

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `name` | string | Yes | - | Unique identifier |
| `kind` | `"command"` | Yes | - | Module type discriminator |
| `command` | string | Yes | - | Shell command to execute |
| `description` | string | No | - | Description shown in TUI |
| `color` | string | No | `"white"` | Default foreground color |
| `timeout` | number | No | `1000` | Command timeout in milliseconds |
| `maxWidth` | number | No | - | Max output width (truncates with `...`) |
| `preserveColors` | boolean | No | `false` | Preserve ANSI color codes from output |

### Name Constraints

Module names must follow these rules:
- Minimum 1 character
- Maximum 32 characters
- Lowercase letters, numbers, and hyphens only
- Regex: `/^[a-z0-9-]+$/`

**Valid names:** `usage`, `git-hash`, `env-label`, `my-widget-1`

**Invalid names:** `Usage` (uppercase), `my widget` (space), `env_label` (underscore)

---

## TUI Configuration

### Accessing Custom Modules

From the Main Menu:

```
Main Menu
   ...
   🧩 Custom Modules
   ...
```

### Custom Modules Menu

The Custom Modules screen displays all defined modules organized by type:

```
Custom Modules
Define reusable modules that appear in the widget type selector

Text Modules:
    env-label (DEV)
    arrow (→)

Command Modules:
    usage (npx ccusage...)
    git-hash (git rev-parse...)

  + Add Text Module
  + Add Command Module

  ← Back

↑↓ select, Enter edit, (d)elete, ESC back
```

**Available Actions:**

| Key | Action | Description |
|-----|--------|-------------|
| ↑/↓ | Navigate | Move between modules and actions |
| Enter | Edit | Open module editor for selected module |
| `d` | Delete | Delete selected module (with confirmation) |
| ESC | Back | Return to main menu |

### Module Editor

Creating or editing a module opens the Module Editor:

```
New Text Module
Enter to edit field, ESC to cancel

▶ Name*: my-module
  Text*: Hello World
  Description: My custom text
  Default Color: green

  Save
  Cancel

↑↓ navigate, Enter select/edit, ESC go back
```

**Fields:**

- **Name** (required): Module identifier, becomes `module:name` in widget type
- **Text/Command** (required): Content or command to execute
- **Description** (optional): Shown in TUI for context
- **Default Color** (optional): Color for the module output

For command modules, additional fields:

- **Max Width**: Truncate output beyond this width
- **Timeout (ms)**: Command execution timeout
- **Preserve Colors**: Toggle to keep ANSI codes from command output

**Color Selection:**

When editing the Default Color field, use ←/→ arrows to cycle through available colors.

### Using Modules in Status Lines

Once modules are defined, they appear in the widget type selector when editing lines:

```
ItemsEditor - Line 1

1. Model (claude-sonnet-4-5)
2. Separator (|)
▶ 3. [New Widget] ← → to change type

Available types:
  Model, Version, Git Branch, ..., Module: env-label, Module: usage, ...

↑↓ select, ←→ change type, (a)dd after, (d)elete, ESC back
```

Press ←/→ to cycle through types including your custom modules.

---

## Settings Schema

### Version 4 Schema

The Custom Modules feature was added in settings version 4.

```json
{
  "version": 4,
  "customModules": [
    {
      "name": "env-label",
      "kind": "text",
      "text": "DEV",
      "color": "green"
    },
    {
      "name": "usage",
      "kind": "command",
      "command": "npx -y ccusage@latest statusline",
      "timeout": 5000,
      "preserveColors": true
    }
  ],
  "lines": [
    [
      { "id": "1", "type": "model" },
      { "id": "2", "type": "separator" },
      { "id": "3", "type": "module:env-label", "color": "yellow" },
      { "id": "4", "type": "separator" },
      { "id": "5", "type": "module:usage" }
    ]
  ]
}
```

### Widget Reference Format

Widgets reference modules using the `module:` prefix:

```json
{
  "id": "abc123",
  "type": "module:usage",
  "color": "cyan"
}
```

The widget's `color`, `backgroundColor`, and `bold` properties can override the module's defaults.

### Migration

Settings are automatically migrated from version 3 to version 4:

```typescript
// v3 → v4 migration
{
    fromVersion: 3,
    toVersion: 4,
    description: 'Add custom modules support',
    migrate: (data) => ({
        ...data,
        version: 4,
        customModules: data.customModules ?? []
    })
}
```

---

## Widget Registry Integration

### Module Type Prefix

Module types use the `module:` prefix to distinguish from built-in widgets:

```typescript
export const MODULE_TYPE_PREFIX = 'module:';

// Example: "module:usage" -> moduleName = "usage"
```

### getWidget Function

The widget registry's `getWidget()` function was updated to handle module types:

```typescript
export function getWidget(type: WidgetItemType, settings?: Settings): Widget | null {
    // Check for module prefix
    const moduleName = getModuleName(type);
    if (moduleName !== null) {
        if (!settings?.customModules) {
            return null;
        }
        const module = settings.customModules.find(m => m.name === moduleName);
        if (module) {
            return module.kind === 'text'
                ? new ModuleTextWidget(module)
                : new ModuleCommandWidget(module);
        }
        return null;
    }

    // Fall back to static registry for built-in widgets
    return widgetRegistry.get(type) ?? null;
}
```

### getAllWidgetTypes Function

Returns all available widget types including custom modules:

```typescript
export function getAllWidgetTypes(settings: Settings): WidgetItemType[] {
    const allTypes = Array.from(widgetRegistry.keys());

    // Add custom module types
    for (const module of settings.customModules) {
        allTypes.push(`${MODULE_TYPE_PREFIX}${module.name}`);
    }

    // Add separator types based on settings
    if (!settings.powerline.enabled) {
        if (!settings.defaultSeparator) {
            allTypes.push('separator');
        }
        allTypes.push('flex-separator');
    }

    return allTypes;
}
```

### Widget Implementations

Modules are implemented as two widget classes:

**ModuleTextWidget:**
```typescript
class ModuleTextWidget implements Widget {
    constructor(private module: CustomTextModule) {}

    render(): string | null {
        return this.module.text || null;
    }

    getDisplayName(): string {
        return `Module: ${this.module.name}`;
    }

    getDefaultColor(): string {
        return this.module.color ?? 'white';
    }
}
```

**ModuleCommandWidget:**
```typescript
class ModuleCommandWidget implements Widget {
    constructor(private module: CustomCommandModule) {}

    render(item: WidgetItem, context: RenderContext): string | null {
        // Execute command with module configuration
        const output = execSync(this.module.command, {
            encoding: 'utf8',
            input: JSON.stringify(context.data),
            timeout: this.module.timeout ?? 1000,
            stdio: ['pipe', 'pipe', 'ignore']
        }).trim();

        // Apply preserveColors and maxWidth settings
        // ...
        return output;
    }
}
```

---

## Examples

### Environment Indicator Module

Define a text module for environment labeling:

```json
{
  "name": "env-dev",
  "kind": "text",
  "text": "DEV",
  "description": "Development environment",
  "color": "green"
}
```

Use in a line:
```json
{ "type": "module:env-dev", "bold": true }
```

### ccusage Integration Module

Define a command module for Claude API usage:

```json
{
  "name": "api-usage",
  "kind": "command",
  "command": "npx -y ccusage@latest statusline",
  "timeout": 5000,
  "preserveColors": true,
  "description": "Shows Claude API cost and usage"
}
```

### Git Commit Hash Module

```json
{
  "name": "commit",
  "kind": "command",
  "command": "git rev-parse --short HEAD",
  "maxWidth": 8,
  "timeout": 1000,
  "color": "yellow",
  "description": "Current commit hash"
}
```

### Multi-Module Status Line

Complete example with multiple modules:

```json
{
  "version": 4,
  "customModules": [
    {
      "name": "env",
      "kind": "text",
      "text": "DEV",
      "color": "green"
    },
    {
      "name": "commit",
      "kind": "command",
      "command": "git rev-parse --short HEAD",
      "maxWidth": 8,
      "color": "yellow"
    },
    {
      "name": "usage",
      "kind": "command",
      "command": "npx -y ccusage@latest statusline",
      "timeout": 5000,
      "preserveColors": true
    }
  ],
  "lines": [
    [
      { "id": "1", "type": "model", "color": "cyan" },
      { "id": "2", "type": "separator" },
      { "id": "3", "type": "module:env" },
      { "id": "4", "type": "separator" },
      { "id": "5", "type": "module:commit" }
    ],
    [
      { "id": "6", "type": "tokens-total" },
      { "id": "7", "type": "flex-separator" },
      { "id": "8", "type": "module:usage" }
    ]
  ]
}
```

### Team-Shared Modules via Project Scope

Store modules in project scope for team sharing:

```
.claude/statusline/settings.json  (committed)
```

```json
{
  "version": 4,
  "customModules": [
    {
      "name": "project-name",
      "kind": "text",
      "text": "MyProject",
      "color": "magenta"
    }
  ]
}
```

Individual developers can add personal modules in local scope:

```
.claude/statusline/settings.local.json  (gitignored)
```

```json
{
  "version": 4,
  "customModules": [
    {
      "name": "debug-info",
      "kind": "command",
      "command": "echo DEBUG",
      "color": "red"
    }
  ]
}
```

---

## API Reference

### Module Functions

```typescript
// Get module name from type string (returns null if not a module type)
getModuleName(type: string): string | null

// Check if type is a known widget (includes modules)
isKnownWidgetType(type: string, settings?: Settings): boolean

// Get widget instance (handles both built-in and module types)
getWidget(type: WidgetItemType, settings?: Settings): Widget | null

// Get all available widget types (includes modules)
getAllWidgetTypes(settings: Settings): WidgetItemType[]
```

### Module Type Guards

```typescript
// Check if module is a text module
isTextModule(module: CustomModule): module is CustomTextModule

// Check if module is a command module
isCommandModule(module: CustomModule): module is CustomCommandModule
```

---

## Type Definitions

### CustomModule

```typescript
// Base properties for all modules
interface CustomModuleBase {
    name: string;           // Unique identifier (1-32 chars, lowercase alphanumeric + hyphens)
    description?: string;   // Optional description for TUI
    color?: string;         // Optional default color
}

// Text module
interface CustomTextModule extends CustomModuleBase {
    kind: 'text';
    text: string;           // Text content to display
}

// Command module
interface CustomCommandModule extends CustomModuleBase {
    kind: 'command';
    command: string;        // Shell command to execute
    maxWidth?: number;      // Max output width
    timeout?: number;       // Timeout in ms (default 1000)
    preserveColors?: boolean; // Keep ANSI codes (default false)
}

// Union type
type CustomModule = CustomTextModule | CustomCommandModule;
```

### Zod Schemas

```typescript
const CustomModuleBaseSchema = z.object({
    name: z.string()
        .min(1, 'Module name is required')
        .max(32, 'Module name must be 32 characters or less')
        .regex(/^[a-z0-9-]+$/, 'Lowercase alphanumeric with hyphens only'),
    description: z.string().optional(),
    color: z.string().optional(),
});

const CustomTextModuleSchema = CustomModuleBaseSchema.extend({
    kind: z.literal('text'),
    text: z.string().min(1, 'Text content is required'),
});

const CustomCommandModuleSchema = CustomModuleBaseSchema.extend({
    kind: z.literal('command'),
    command: z.string().min(1, 'Command is required'),
    maxWidth: z.number().positive().optional(),
    timeout: z.number().positive().optional(),
    preserveColors: z.boolean().optional(),
});

const CustomModuleSchema = z.discriminatedUnion('kind', [
    CustomTextModuleSchema,
    CustomCommandModuleSchema,
]);
```

### Settings Schema (v4)

```typescript
const SettingsSchema = z.object({
    version: z.literal(4),
    customModules: z.array(CustomModuleSchema).default([]),
    // ... other fields
});
```

---

## Implementation Files

| File | Purpose |
|------|---------|
| `src/types/CustomModule.ts` | Zod schemas and TypeScript types |
| `src/widgets/ModuleWidget.ts` | ModuleTextWidget and ModuleCommandWidget implementations |
| `src/utils/widgets.ts` | Widget registry with module support |
| `src/tui/components/CustomModulesMenu.tsx` | TUI module list screen |
| `src/tui/components/ModuleEditor.tsx` | TUI module create/edit form |
| `src/utils/migrations.ts` | v3→v4 migration |

---

## See Also

- [README.md](../README.md) - Main project documentation
- [CLAUDE.md](../CLAUDE.md) - Development instructions
- [custom-widgets-guide.md](./custom-widgets-guide.md) - CustomText and CustomCommand widgets
- [scoped-settings-guide.md](./scoped-settings-guide.md) - Hierarchical settings system
- [src/types/CustomModule.ts](../src/types/CustomModule.ts) - Type definitions
- [src/utils/widgets.ts](../src/utils/widgets.ts) - Widget registry
