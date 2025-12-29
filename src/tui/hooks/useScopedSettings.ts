import {
    useCallback,
    useEffect,
    useState
} from 'react';

import type { Settings } from '../../types/Settings';
import type {
    ResolvedSettings,
    SettingsScope,
    SettingsSources
} from '../../types/SettingsScope';
import {
    createScopeSettings,
    deleteScopeSettings,
    getAllScopePaths,
    loadScopedSettings,
    saveScopedSettings,
    scopeHasSettings
} from '../../utils/scoped-config';

export interface UseScopedSettingsResult {
    /** The merged settings from all scopes */
    settings: Settings | null;
    /** Information about which scopes contributed to settings */
    sources: SettingsSources | null;
    /** Full paths to all scope settings files */
    scopePaths: Record<SettingsScope, string>;
    /** Whether settings are still loading */
    isLoading: boolean;
    /** The current scope that will be used for saving */
    saveScope: SettingsScope;
    /** Set the scope to save to */
    setSaveScope: (scope: SettingsScope) => void;
    /** Update local settings state (does not persist) */
    updateSettings: (settings: Settings) => void;
    /** Save settings to the current save scope */
    saveToCurrentScope: () => Promise<void>;
    /** Save settings to a specific scope */
    saveToScope: (scope: SettingsScope) => Promise<void>;
    /** Check if a scope has settings */
    checkScopeExists: (scope: SettingsScope) => boolean;
    /** Create a new settings file at a scope */
    createScope: (scope: SettingsScope) => Promise<void>;
    /** Delete settings at a scope */
    deleteScope: (scope: SettingsScope) => Promise<void>;
    /** Reload settings from all scopes */
    reload: () => Promise<void>;
}

/**
 * React hook for managing scoped settings.
 * Provides loading, saving, and scope management functionality.
 */
export function useScopedSettings(): UseScopedSettingsResult {
    const [resolved, setResolved] = useState<ResolvedSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [saveScope, setSaveScope] = useState<SettingsScope>('user');
    const scopePaths = getAllScopePaths();

    // Load settings on mount
    useEffect(() => {
        void loadSettings();
    }, []);

    const loadSettings = useCallback(async () => {
        setIsLoading(true);
        try {
            const result = await loadScopedSettings({ includeSourceInfo: true });
            setResolved(result);

            // Set default save scope based on loaded sources
            // If local exists, save to local; else if project exists, save to project; else user
            if (result.sources.local) {
                setSaveScope('local');
            } else if (result.sources.project) {
                setSaveScope('project');
            } else {
                setSaveScope('user');
            }
        } finally {
            setIsLoading(false);
        }
    }, []);

    const updateSettings = useCallback((settings: Settings) => {
        if (resolved) {
            setResolved({
                ...resolved,
                settings
            });
        }
    }, [resolved]);

    const saveToScope = useCallback(async (scope: SettingsScope) => {
        if (!resolved)
            return;
        await saveScopedSettings(resolved.settings, { scope });
        // Reload to get updated sources
        await loadSettings();
    }, [resolved, loadSettings]);

    const saveToCurrentScope = useCallback(async () => {
        await saveToScope(saveScope);
    }, [saveToScope, saveScope]);

    const checkScopeExists = useCallback((scope: SettingsScope) => {
        return scopeHasSettings(scope);
    }, []);

    const createScope = useCallback(async (scope: SettingsScope) => {
        await createScopeSettings(scope, resolved?.settings);
        await loadSettings();
    }, [resolved, loadSettings]);

    const deleteScope = useCallback(async (scope: SettingsScope) => {
        await deleteScopeSettings(scope);
        await loadSettings();
    }, [loadSettings]);

    return {
        settings: resolved?.settings ?? null,
        sources: resolved?.sources ?? null,
        scopePaths,
        isLoading,
        saveScope,
        setSaveScope,
        updateSettings,
        saveToCurrentScope,
        saveToScope,
        checkScopeExists,
        createScope,
        deleteScope,
        reload: loadSettings
    };
}