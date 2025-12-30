import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import type {
    ClaudeInstallationStatus,
    ClaudeSettings,
    ClaudeSettingsScope,
    ScopeInstallationStatus
} from '../types/ClaudeSettings';

// Re-export for backward compatibility
export type {
    ClaudeInstallationStatus,
    ClaudeSettings,
    ClaudeSettingsScope,
    ScopeInstallationStatus
};

// Use fs.promises directly
const readFile = fs.promises.readFile;
const writeFile = fs.promises.writeFile;
const mkdir = fs.promises.mkdir;

export const CCSTATUSLINE_COMMANDS = {
    NPM: 'npx -y @wvandaalen/ccstatusline@latest',
    BUNX: 'bunx -y @wvandaalen/ccstatusline@latest',
    SELF_MANAGED: 'ccstatusline'
};

/**
 * Determines the Claude config directory, checking CLAUDE_CONFIG_DIR environment variable first,
 * then falling back to the default ~/.claude directory.
 */
export function getClaudeConfigDir(): string {
    const envConfigDir = process.env.CLAUDE_CONFIG_DIR;

    if (envConfigDir) {
        try {
            // Validate that the path is absolute and reasonable
            const resolvedPath = path.resolve(envConfigDir);

            // Check if directory exists or can be created
            if (fs.existsSync(resolvedPath)) {
                const stats = fs.statSync(resolvedPath);
                if (stats.isDirectory()) {
                    return resolvedPath;
                }
            } else {
                // Directory doesn't exist yet, but we can try to use it
                // (mkdir will be called later when saving)
                return resolvedPath;
            }
        } catch {
            // Fall through to default on any error
        }
    }

    // Default fallback
    return path.join(os.homedir(), '.claude');
}

/**
 * Gets the full path to the Claude settings.json file (user scope).
 * @deprecated Use getClaudeSettingsPathForScope('user') instead
 */
export function getClaudeSettingsPath(): string {
    return path.join(getClaudeConfigDir(), 'settings.json');
}

// ============================================================================
// Scoped Settings Functions
// ============================================================================

/**
 * Finds the project root directory for Claude Code settings.
 *
 * IMPORTANT: This matches Claude Code's actual behavior - it uses the current
 * working directory only. Claude Code does NOT traverse upward to find .claude
 * directories for settings.json resolution.
 *
 * This is different from CLAUDE.md files, which DO traverse upward.
 * See: https://github.com/anthropics/claude-code/issues/12962
 *
 * Note: ccstatusline's own settings (in scoped-config.ts) use upward traversal
 * for better monorepo support, but Claude Code integration must match their behavior.
 */
export function getProjectRoot(): string {
    return process.cwd();
}

/**
 * Gets the Claude Code settings.json path for a specific scope.
 */
export function getClaudeSettingsPathForScope(scope: ClaudeSettingsScope): string {
    switch (scope) {
    case 'user':
        return path.join(getClaudeConfigDir(), 'settings.json');
    case 'project':
        return path.join(getProjectRoot(), '.claude', 'settings.json');
    case 'local':
        return path.join(getProjectRoot(), '.claude', 'settings.local.json');
    }
}

/**
 * Gets all Claude Code settings paths for display/debugging.
 */
export function getAllClaudeSettingsPaths(): Record<ClaudeSettingsScope, string> {
    return {
        user: getClaudeSettingsPathForScope('user'),
        project: getClaudeSettingsPathForScope('project'),
        local: getClaudeSettingsPathForScope('local')
    };
}

/**
 * Loads Claude Code settings from a specific scope.
 */
export async function loadClaudeSettingsFromScope(
    scope: ClaudeSettingsScope
): Promise<ClaudeSettings> {
    try {
        const settingsPath = getClaudeSettingsPathForScope(scope);
        if (!fs.existsSync(settingsPath)) {
            return {};
        }
        const content = await readFile(settingsPath, 'utf-8');
        return JSON.parse(content) as ClaudeSettings;
    } catch {
        return {};
    }
}

/**
 * Saves Claude Code settings to a specific scope.
 */
export async function saveClaudeSettingsToScope(
    settings: ClaudeSettings,
    scope: ClaudeSettingsScope
): Promise<void> {
    const settingsPath = getClaudeSettingsPathForScope(scope);
    const dir = path.dirname(settingsPath);
    await mkdir(dir, { recursive: true });
    await writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
}

/**
 * Checks if ccstatusline is installed in a single scope.
 */
async function checkScopeInstallation(
    scope: ClaudeSettingsScope
): Promise<ScopeInstallationStatus> {
    const settingsPath = getClaudeSettingsPathForScope(scope);
    const settings = await loadClaudeSettingsFromScope(scope);
    const command = settings.statusLine?.command ?? null;

    const validCommands = [
        CCSTATUSLINE_COMMANDS.NPM,
        CCSTATUSLINE_COMMANDS.BUNX,
        CCSTATUSLINE_COMMANDS.SELF_MANAGED
    ];

    const installed = command !== null
        && validCommands.includes(command)
        && (settings.statusLine?.padding === 0
            || settings.statusLine?.padding === undefined);

    return {
        installed,
        command,
        path: settingsPath
    };
}

/**
 * Gets the installation status across all scopes.
 */
export async function getInstallationStatus(): Promise<ClaudeInstallationStatus> {
    const [user, project, local] = await Promise.all([
        checkScopeInstallation('user'),
        checkScopeInstallation('project'),
        checkScopeInstallation('local')
    ]);

    return { user, project, local };
}

/**
 * Installs ccstatusline to a specific Claude Code settings scope.
 */
export async function installStatusLineToScope(
    scope: ClaudeSettingsScope,
    useBunx = false
): Promise<void> {
    const settings = await loadClaudeSettingsFromScope(scope);

    settings.statusLine = {
        type: 'command',
        command: useBunx
            ? CCSTATUSLINE_COMMANDS.BUNX
            : CCSTATUSLINE_COMMANDS.NPM,
        padding: 0
    };

    await saveClaudeSettingsToScope(settings, scope);
}

/**
 * Uninstalls ccstatusline from a specific Claude Code settings scope.
 */
export async function uninstallStatusLineFromScope(
    scope: ClaudeSettingsScope
): Promise<void> {
    const settings = await loadClaudeSettingsFromScope(scope);

    if (settings.statusLine) {
        delete settings.statusLine;
        await saveClaudeSettingsToScope(settings, scope);
    }
}

/**
 * Loads Claude Code settings from user scope.
 * @deprecated Use loadClaudeSettingsFromScope('user') instead
 */
export async function loadClaudeSettings(): Promise<ClaudeSettings> {
    return loadClaudeSettingsFromScope('user');
}

/**
 * Saves Claude Code settings to user scope.
 * @deprecated Use saveClaudeSettingsToScope(settings, 'user') instead
 */
export async function saveClaudeSettings(
    settings: ClaudeSettings
): Promise<void> {
    await saveClaudeSettingsToScope(settings, 'user');
}

/**
 * Checks if ccstatusline is installed in user scope.
 * @deprecated Use getInstallationStatus() instead for multi-scope support
 */
export async function isInstalled(): Promise<boolean> {
    const status = await getInstallationStatus();
    return status.user.installed || status.project.installed || status.local.installed;
}

export function isBunxAvailable(): boolean {
    try {
        // Use platform-appropriate command to check for bunx availability
        const command = process.platform === 'win32' ? 'where bunx' : 'which bunx';
        execSync(command, { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

/**
 * Installs ccstatusline to user scope.
 * @deprecated Use installStatusLineToScope(scope, useBunx) instead
 */
export async function installStatusLine(useBunx = false): Promise<void> {
    await installStatusLineToScope('user', useBunx);
}

/**
 * Uninstalls ccstatusline from user scope.
 * @deprecated Use uninstallStatusLineFromScope(scope) instead
 */
export async function uninstallStatusLine(): Promise<void> {
    await uninstallStatusLineFromScope('user');
}

/**
 * Gets the existing statusLine command from user scope.
 * @deprecated Use getInstallationStatus() instead
 */
export async function getExistingStatusLine(): Promise<string | null> {
    const status = await getInstallationStatus();
    // Return the first installed command found
    if (status.local.command)
        return status.local.command;
    if (status.project.command)
        return status.project.command;
    if (status.user.command)
        return status.user.command;
    return null;
}