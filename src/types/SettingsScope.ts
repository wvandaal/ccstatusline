import { type Settings } from './Settings';

/**
 * Settings scope identifier for hierarchical configuration.
 * Precedence: local > project > user > defaults
 */
export type SettingsScope = 'user' | 'project' | 'local';

/**
 * Information about where settings were loaded from.
 */
export interface SettingsSources {
    /** Path to user settings file if it exists and was loaded */
    user: string | null;
    /** Path to project settings file if it exists and was loaded */
    project: string | null;
    /** Path to local settings file if it exists and was loaded */
    local: string | null;
}

/**
 * Resolved settings with source tracking.
 * Used to understand which scopes contributed to the final merged settings.
 */
export interface ResolvedSettings {
    /** The merged settings from all scopes */
    settings: Settings;
    /** Paths to settings files that were loaded */
    sources: SettingsSources;
}

/**
 * Options for loading scoped settings.
 */
export interface LoadScopedSettingsOptions {
    /** Include source information in the result */
    includeSourceInfo?: boolean;
}

/**
 * Options for saving scoped settings.
 */
export interface SaveScopedSettingsOptions {
    /** Which scope to save to (default: 'user') */
    scope: SettingsScope;
    /** Create directory if it doesn't exist (default: true) */
    createIfMissing?: boolean;
}