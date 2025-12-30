/**
 * Scoped configuration module for hierarchical settings resolution.
 * This wraps the original config.ts to add Claude Code-style settings resolution.
 *
 * Settings precedence (highest to lowest):
 * 1. Local: .claude/statusline/settings.local.json
 * 2. Project: .claude/statusline/settings.json
 * 3. User: ~/.claude/statusline/settings.json
 * 4. Defaults: Zod schema defaults
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import {
    CURRENT_VERSION,
    SettingsSchema,
    type Settings
} from '../types/Settings';
import type {
    LoadScopedSettingsOptions,
    ResolvedSettings,
    SaveScopedSettingsOptions,
    SettingsScope,
    SettingsSources
} from '../types/SettingsScope';

import { getClaudeConfigDir } from './claude-settings';
import {
    migrateConfig,
    needsMigration
} from './migrations';

const readFile = fs.promises.readFile;
const writeFile = fs.promises.writeFile;
const mkdir = fs.promises.mkdir;
const appendFile = fs.promises.appendFile;

// ============================================================================
// Path Resolution Functions
// ============================================================================

/**
 * Gets the user-scope settings directory.
 * Uses CLAUDE_CONFIG_DIR if set, otherwise ~/.claude/statusline/
 */
export function getUserSettingsDir(): string {
    return path.join(getClaudeConfigDir(), 'statusline');
}

/**
 * Gets the git root directory, or null if not in a git repo.
 */
function getGitRoot(): string | null {
    try {
        return execSync('git rev-parse --show-toplevel', {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'ignore']
        }).trim();
    } catch {
        return null;
    }
}

/**
 * Finds the project root directory for ccstatusline's own settings.
 *
 * IMPORTANT: This intentionally differs from Claude Code's settings resolution!
 *
 * - Claude Code settings (claude-settings.ts): Uses cwd only, no traversal
 * - ccstatusline settings (this file): Searches upward for .claude directories
 *
 * Why the difference?
 * - Claude Code doesn't support parent directory traversal for settings.json
 *   (see: https://github.com/anthropics/claude-code/issues/12962)
 * - ccstatusline provides enhanced monorepo support by finding the nearest
 *   .claude/statusline directory, allowing nested projects to have their own
 *   status line configurations while falling back to parent configs
 *
 * Search algorithm:
 * 1. Start at cwd
 * 2. Check if .claude directory exists
 * 3. If yes, use this as project root
 * 4. If no, move up one directory
 * 5. Stop at git root (don't search above it) or filesystem root
 * 6. If no .claude found, fall back to git root or cwd
 */
export function getProjectRoot(): string {
    const gitRoot = getGitRoot();
    let currentDir = process.cwd();
    const root = path.parse(currentDir).root;

    while (currentDir !== root) {
        const claudeDir = path.join(currentDir, '.claude');

        if (fs.existsSync(claudeDir) && fs.statSync(claudeDir).isDirectory()) {
            return currentDir;
        }

        // Don't search above git root
        if (gitRoot && currentDir === gitRoot) {
            break;
        }

        currentDir = path.dirname(currentDir);
    }

    // Fall back to git root or cwd
    return gitRoot ?? process.cwd();
}

/**
 * Gets the project-scope settings directory.
 */
export function getProjectSettingsDir(): string {
    const projectRoot = getProjectRoot();
    return path.join(projectRoot, '.claude', 'statusline');
}

/**
 * Gets the settings file path for a given scope.
 */
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

/**
 * Gets all scope paths for display/debugging.
 */
export function getAllScopePaths(): Record<SettingsScope, string> {
    return {
        user: getSettingsPathForScope('user'),
        project: getSettingsPathForScope('project'),
        local: getSettingsPathForScope('local')
    };
}

// ============================================================================
// Deep Merge Utility
// ============================================================================

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return (
        typeof value === 'object'
        && value !== null
        && !Array.isArray(value)
        && Object.getPrototypeOf(value) === Object.prototype
    );
}

/**
 * Deep merges multiple settings objects.
 * - Objects are merged recursively
 * - Arrays are replaced entirely (not merged)
 * - Primitives are replaced
 */
export function deepMerge<T extends Record<string, unknown>>(
    ...sources: (Partial<T> | undefined)[]
): T {
    const result: Record<string, unknown> = {};

    for (const source of sources) {
        if (!source)
            continue;

        for (const [key, value] of Object.entries(source)) {
            if (value === undefined)
                continue;

            if (Array.isArray(value)) {
                // Arrays are replaced, not merged
                result[key] = Array.from(value);
            } else if (isPlainObject(value) && isPlainObject(result[key])) {
                // Objects are recursively merged
                result[key] = deepMerge(
                    result[key],
                    value
                );
            } else {
                // Primitives are replaced
                result[key] = value;
            }
        }
    }

    return result as T;
}

// ============================================================================
// Settings Loading Functions
// ============================================================================

/**
 * Loads settings from a single scope.
 * Returns undefined if the file doesn't exist or can't be parsed.
 */
async function loadSingleScopeSettings(
    settingsPath: string
): Promise<Partial<Settings> | undefined> {
    try {
        if (!fs.existsSync(settingsPath)) {
            return undefined;
        }

        const content = await readFile(settingsPath, 'utf-8');
        let rawData: unknown;

        try {
            rawData = JSON.parse(content);
        } catch {
            console.error(`Failed to parse ${settingsPath}, skipping`);
            return undefined;
        }

        // Check if migration is needed
        const hasVersion = typeof rawData === 'object'
            && rawData !== null
            && 'version' in rawData;

        if (!hasVersion || needsMigration(rawData, CURRENT_VERSION)) {
            rawData = migrateConfig(rawData, CURRENT_VERSION);
            // Save migrated settings back to disk
            await writeFile(settingsPath, JSON.stringify(rawData, null, 2), 'utf-8');
        }

        return rawData as Partial<Settings>;
    } catch (error) {
        console.error(`Error loading settings from ${settingsPath}:`, error);
        return undefined;
    }
}

/**
 * Resolves settings from all scopes and merges them.
 * Returns the merged settings and information about which sources were loaded.
 */
export async function resolveSettings(): Promise<ResolvedSettings> {
    const userPath = getSettingsPathForScope('user');
    const projectPath = getSettingsPathForScope('project');
    const localPath = getSettingsPathForScope('local');

    // Load settings from each scope
    const userSettings = await loadSingleScopeSettings(userPath);
    const projectSettings = await loadSingleScopeSettings(projectPath);
    const localSettings = await loadSingleScopeSettings(localPath);

    // Get defaults from schema
    const defaults = SettingsSchema.parse({});

    // Deep merge with precedence: local > project > user > defaults
    const merged = deepMerge<Settings>(
        defaults,
        userSettings,
        projectSettings,
        localSettings
    );

    // Validate final result
    const validated = SettingsSchema.parse(merged);

    // Track sources
    const sources: SettingsSources = {
        user: userSettings ? userPath : null,
        project: projectSettings ? projectPath : null,
        local: localSettings ? localPath : null
    };

    return {
        settings: validated,
        sources
    };
}

/**
 * Loads scoped settings.
 * Drop-in replacement for loadSettings from config.ts.
 */
export async function loadScopedSettings(): Promise<Settings>;
export async function loadScopedSettings(
    options: LoadScopedSettingsOptions & { includeSourceInfo: true }
): Promise<ResolvedSettings>;
export async function loadScopedSettings(
    options?: LoadScopedSettingsOptions
): Promise<Settings | ResolvedSettings>;
export async function loadScopedSettings(
    options?: LoadScopedSettingsOptions
): Promise<Settings | ResolvedSettings> {
    const resolved = await resolveSettings();

    if (options?.includeSourceInfo) {
        return resolved;
    }

    return resolved.settings;
}

// ============================================================================
// Settings Saving Functions
// ============================================================================

/**
 * Ensures the local settings file is added to .gitignore.
 */
export async function ensureLocalSettingsGitignored(): Promise<void> {
    const projectRoot = getProjectRoot();
    const gitignorePath = path.join(projectRoot, '.gitignore');
    const localPattern = '.claude/statusline/settings.local.json';

    try {
        if (fs.existsSync(gitignorePath)) {
            const content = await readFile(gitignorePath, 'utf-8');
            if (!content.includes(localPattern)) {
                await appendFile(
                    gitignorePath,
                    `\n# ccstatusline local settings\n${localPattern}\n`
                );
            }
        }
    } catch (error) {
        console.error('Failed to update .gitignore:', error);
    }
}

/**
 * Saves settings to the specified scope.
 */
export async function saveScopedSettings(
    settings: Settings,
    options: SaveScopedSettingsOptions = { scope: 'user' }
): Promise<void> {
    const settingsPath = getSettingsPathForScope(options.scope);
    const dir = path.dirname(settingsPath);

    if (options.createIfMissing !== false) {
        await mkdir(dir, { recursive: true });
    }

    // Always include version when saving
    const settingsWithVersion = {
        ...settings,
        version: CURRENT_VERSION
    };

    await writeFile(
        settingsPath,
        JSON.stringify(settingsWithVersion, null, 2),
        'utf-8'
    );

    // If saving to local scope, ensure it's gitignored
    if (options.scope === 'local') {
        await ensureLocalSettingsGitignored();
    }
}

/**
 * Checks if a scope has settings.
 */
export function scopeHasSettings(scope: SettingsScope): boolean {
    const settingsPath = getSettingsPathForScope(scope);
    return fs.existsSync(settingsPath);
}

/**
 * Deletes settings for a scope.
 */
export async function deleteScopeSettings(scope: SettingsScope): Promise<void> {
    const settingsPath = getSettingsPathForScope(scope);
    if (fs.existsSync(settingsPath)) {
        await fs.promises.unlink(settingsPath);
    }
}

/**
 * Creates a new settings file at the specified scope with the given settings.
 * If settings are not provided, uses defaults.
 */
export async function createScopeSettings(
    scope: SettingsScope,
    settings?: Partial<Settings>
): Promise<void> {
    const defaults = SettingsSchema.parse({});
    const mergedSettings = settings ? deepMerge(defaults, settings) : defaults;
    await saveScopedSettings(mergedSettings, { scope });
}