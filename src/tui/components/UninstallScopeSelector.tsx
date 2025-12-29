import {
    Box,
    Text,
    useInput
} from 'ink';
import React, { useState } from 'react';

import type {
    ClaudeInstallationStatus,
    ClaudeSettingsScope
} from '../../types/ClaudeSettings';

export interface UninstallScopeSelectorProps {
    installationStatus: ClaudeInstallationStatus;
    claudeSettingsPaths: Record<ClaudeSettingsScope, string>;
    onUninstall: (scopes: ClaudeSettingsScope[]) => void;
    onCancel: () => void;
}

const SCOPES: ClaudeSettingsScope[] = ['user', 'project', 'local'];

const SCOPE_LABELS: Record<ClaudeSettingsScope, string> = {
    user: 'User (Global)',
    project: 'Project (Shared)',
    local: 'Local (Personal)'
};

export const UninstallScopeSelector: React.FC<UninstallScopeSelectorProps> = ({
    installationStatus,
    claudeSettingsPaths,
    onUninstall,
    onCancel
}) => {
    // Get installed scopes
    const installedScopes = SCOPES.filter(scope => installationStatus[scope].installed);

    // Selection state for each installed scope
    const [selectedScopes, setSelectedScopes] = useState<Set<ClaudeSettingsScope>>(
        new Set(installedScopes)
    );
    const [focusIndex, setFocusIndex] = useState(0);

    // Items include each installed scope + confirm + cancel
    const totalItems = installedScopes.length + 2;

    useInput((input, key) => {
        if (key.escape) {
            onCancel();
            return;
        }

        if (key.upArrow) {
            setFocusIndex(Math.max(0, focusIndex - 1));
        } else if (key.downArrow) {
            setFocusIndex(Math.min(totalItems - 1, focusIndex + 1));
        } else if (key.return || input === ' ') {
            const scope = installedScopes[focusIndex];
            if (focusIndex < installedScopes.length && scope) {
                // Toggle scope selection
                const newSelected = new Set(selectedScopes);
                if (newSelected.has(scope)) {
                    newSelected.delete(scope);
                } else {
                    newSelected.add(scope);
                }
                setSelectedScopes(newSelected);
            } else if (focusIndex === installedScopes.length) {
                // Confirm
                if (selectedScopes.size > 0) {
                    onUninstall(Array.from(selectedScopes));
                }
            } else {
                // Cancel
                onCancel();
            }
        }
    });

    if (installedScopes.length === 0) {
        return (
            <Box flexDirection='column'>
                <Text bold color='yellow'>No Installation Found</Text>
                <Box marginTop={1}>
                    <Text>ccstatusline is not installed in any scope.</Text>
                </Box>
                <Box marginTop={1}>
                    <Text dimColor>Press any key to go back</Text>
                </Box>
            </Box>
        );
    }

    const isAllSelected = selectedScopes.size === installedScopes.length;

    return (
        <Box flexDirection='column'>
            <Text bold color='red'>Uninstall ccstatusline</Text>
            <Box marginTop={1}>
                <Text>Select scope(s) to uninstall from:</Text>
            </Box>

            <Box marginTop={1} flexDirection='column'>
                {installedScopes.map((scope, idx) => {
                    const isFocused = focusIndex === idx;
                    const isSelected = selectedScopes.has(scope);
                    const status = installationStatus[scope];

                    return (
                        <Box key={scope} flexDirection='column'>
                            <Box>
                                <Text color={isFocused ? 'blue' : undefined}>
                                    {isFocused ? '▶ ' : '  '}
                                    [
                                    {isSelected ? '×' : ' '}
                                    ]
                                    {' '}
                                    {SCOPE_LABELS[scope]}
                                </Text>
                            </Box>
                            <Box marginLeft={5}>
                                <Text dimColor>
                                    {claudeSettingsPaths[scope]}
                                </Text>
                            </Box>
                            {status.command && (
                                <Box marginLeft={5}>
                                    <Text dimColor>
                                        Command:
                                        {' '}
                                        {status.command}
                                    </Text>
                                </Box>
                            )}
                        </Box>
                    );
                })}
            </Box>

            {isAllSelected && (
                <Box marginTop={1}>
                    <Text color='yellow'>
                        ⚠ Warning: Removing from all scopes will fully uninstall ccstatusline
                    </Text>
                </Box>
            )}

            <Box marginTop={2} flexDirection='column'>
                <Box>
                    <Text
                        color={focusIndex === installedScopes.length ? 'red' : undefined}
                        bold={focusIndex === installedScopes.length}
                        dimColor={selectedScopes.size === 0}
                    >
                        {focusIndex === installedScopes.length ? '▶ ' : '  '}
                        Uninstall (
                        {selectedScopes.size}
                        {' '}
                        selected)
                    </Text>
                </Box>
                <Box marginTop={1}>
                    <Text color={focusIndex === installedScopes.length + 1 ? 'blue' : undefined}>
                        {focusIndex === installedScopes.length + 1 ? '▶ ' : '  '}
                        ← Cancel
                    </Text>
                </Box>
            </Box>

            <Box marginTop={2}>
                <Text dimColor>
                    ↑↓ navigate, Space/Enter toggle/select, ESC cancel
                </Text>
            </Box>
        </Box>
    );
};