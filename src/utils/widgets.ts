import type { Settings } from '../types/Settings';
import type {
    Widget,
    WidgetItemType
} from '../types/Widget';
import * as widgets from '../widgets';

// Prefix for custom module types
export const MODULE_TYPE_PREFIX = 'module:';

// Create widget registry for built-in widgets
const widgetRegistry = new Map<WidgetItemType, Widget>([
    ['model', new widgets.ModelWidget()],
    ['output-style', new widgets.OutputStyleWidget()],
    ['git-branch', new widgets.GitBranchWidget()],
    ['git-changes', new widgets.GitChangesWidget()],
    ['git-worktree', new widgets.GitWorktreeWidget()],
    ['current-working-dir', new widgets.CurrentWorkingDirWidget()],
    ['tokens-input', new widgets.TokensInputWidget()],
    ['tokens-output', new widgets.TokensOutputWidget()],
    ['tokens-cached', new widgets.TokensCachedWidget()],
    ['tokens-total', new widgets.TokensTotalWidget()],
    ['context-length', new widgets.ContextLengthWidget()],
    ['context-percentage', new widgets.ContextPercentageWidget()],
    ['context-percentage-usable', new widgets.ContextPercentageUsableWidget()],
    ['session-clock', new widgets.SessionClockWidget()],
    ['session-cost', new widgets.SessionCostWidget()],
    ['block-timer', new widgets.BlockTimerWidget()],
    ['terminal-width', new widgets.TerminalWidthWidget()],
    ['version', new widgets.VersionWidget()],
    ['custom-text', new widgets.CustomTextWidget()],
    ['custom-command', new widgets.CustomCommandWidget()],
    ['claude-session-id', new widgets.ClaudeSessionIdWidget()]
]);

/**
 * Extract module name from a module type string.
 * Returns null if not a module type.
 */
export function getModuleName(type: string): string | null {
    if (type.startsWith(MODULE_TYPE_PREFIX)) {
        return type.slice(MODULE_TYPE_PREFIX.length);
    }
    return null;
}

/**
 * Get a widget instance by type.
 * For module types (module:name), creates a widget from the module definition.
 * Settings parameter is required for module types.
 */
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
                ? new widgets.ModuleTextWidget(module)
                : new widgets.ModuleCommandWidget(module);
        }
        return null;
    }

    // Fall back to static registry for built-in widgets
    return widgetRegistry.get(type) ?? null;
}

/**
 * Get all available widget types including custom modules.
 */
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

/**
 * Check if a type is a known widget type.
 * For module types, validates against the modules in settings.
 */
export function isKnownWidgetType(type: string, settings?: Settings): boolean {
    // Check built-in widgets
    if (widgetRegistry.has(type)) {
        return true;
    }

    // Check separator types
    if (type === 'separator' || type === 'flex-separator') {
        return true;
    }

    // Check module types
    const moduleName = getModuleName(type);
    if (moduleName !== null && settings?.customModules) {
        return settings.customModules.some(m => m.name === moduleName);
    }

    return false;
}