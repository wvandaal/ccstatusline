export interface ClaudeSettings {
    permissions?: {
        allow?: string[];
        deny?: string[];
    };
    statusLine?: {
        type: string;
        command: string;
        padding?: number;
    };
    [key: string]: unknown;
}

/**
 * Scope for Claude Code's settings.json file.
 * This mirrors the SettingsScope type but specifically for Claude Code's own settings.
 */
export type ClaudeSettingsScope = 'user' | 'project' | 'local';

/**
 * Installation status for a single scope.
 */
export interface ScopeInstallationStatus {
    /** Whether ccstatusline is installed in this scope */
    installed: boolean;
    /** The command configured in this scope, or null if not installed */
    command: string | null;
    /** The full path to the settings file for this scope */
    path: string;
}

/**
 * Installation status across all scopes.
 */
export interface ClaudeInstallationStatus {
    user: ScopeInstallationStatus;
    project: ScopeInstallationStatus;
    local: ScopeInstallationStatus;
}