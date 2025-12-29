# ccstatusline Documentation

This directory contains detailed documentation for ccstatusline's advanced features. For basic usage and installation, see the main [README.md](../README.md).

## Documentation Index

| Guide | Description |
|-------|-------------|
| [Custom Modules Guide](./custom-modules-guide.md) | Define reusable text and command modules that appear in the widget type selector |
| [Custom Widgets Guide](./custom-widgets-guide.md) | Configure inline CustomText and CustomCommand widgets |
| [Scoped Settings Guide](./scoped-settings-guide.md) | Hierarchical settings with User, Project, and Local scopes |

---

## Quick Reference

### Custom Modules

Define modules once, use them anywhere. Modules appear as selectable widget types like "Module: usage".

```json
{
  "customModules": [
    { "name": "usage", "kind": "command", "command": "npx ccusage statusline", "timeout": 5000 }
  ],
  "lines": [
    [{ "type": "model" }, { "type": "separator" }, { "type": "module:usage" }]
  ]
}
```

**[Read more →](./custom-modules-guide.md)**

### Custom Widgets

Inline custom content for one-off usage.

```json
{
  "type": "custom-command",
  "commandPath": "git rev-parse --short HEAD",
  "maxWidth": 8
}
```

**[Read more →](./custom-widgets-guide.md)**

### Scoped Settings

Three-tier configuration hierarchy:

| Scope | Path | Purpose |
|-------|------|---------|
| Local | `.claude/statusline/settings.local.json` | Personal project overrides (gitignored) |
| Project | `.claude/statusline/settings.json` | Team-shared settings (committed) |
| User | `~/.claude/statusline/settings.json` | Global defaults |

**[Read more →](./scoped-settings-guide.md)**

---

## Feature Comparison

| Feature | Custom Widgets | Custom Modules |
|---------|---------------|----------------|
| Configuration | Inline per widget | Centralized in `customModules` |
| Reusability | Copy/paste | Reference by name |
| Type selector | Generic types | Named: "Module: name" |
| Best for | One-off usage | Repeated usage |

---

## TUI Access

All features are configurable via the interactive TUI:

```bash
npx @wvandaalen/ccstatusline
```

| Menu Item | Feature |
|-----------|---------|
| Edit Lines | Add/configure widgets including modules |
| Custom Modules | Create/edit/delete module definitions |
| Manage Scopes | Configure User/Project/Local settings |

---

## See Also

- [README.md](../README.md) - Main project documentation
- [CLAUDE.md](../CLAUDE.md) - Development instructions
