import {
    Box,
    Text,
    useInput
} from 'ink';
import React, { useState } from 'react';

import type {
    SettingsScope,
    SettingsSources
} from '../../types/SettingsScope';

export interface ScopeSaveDialogProps {
    /** Currently selected save scope */
    currentScope: SettingsScope;
    /** Available scope sources */
    sources: SettingsSources;
    /** Full paths to scope settings files */
    scopePaths: Record<SettingsScope, string>;
    /** Called when user selects a scope */
    onSelect: (scope: SettingsScope) => void;
    /** Called when user cancels */
    onCancel: () => void;
}

const SCOPE_LABELS: Record<SettingsScope, { label: string; description: string }> = {
    user: {
        label: 'User (Global)',
        description: 'Personal settings across all projects'
    },
    project: {
        label: 'Project (Shared)',
        description: 'Team settings (committed to git)'
    },
    local: {
        label: 'Local (Personal)',
        description: 'Personal project overrides (gitignored)'
    }
};

const SCOPES: SettingsScope[] = ['user', 'project', 'local'];

export const ScopeSaveDialog: React.FC<ScopeSaveDialogProps> = ({
    currentScope,
    sources,
    scopePaths,
    onSelect,
    onCancel
}) => {
    const initialIndex = SCOPES.indexOf(currentScope);
    const [selectedIndex, setSelectedIndex] = useState(initialIndex >= 0 ? initialIndex : 0);

    useInput((input, key) => {
        if (key.upArrow) {
            setSelectedIndex(Math.max(0, selectedIndex - 1));
        } else if (key.downArrow) {
            setSelectedIndex(Math.min(SCOPES.length - 1, selectedIndex + 1));
        } else if (key.return) {
            const scope = SCOPES[selectedIndex];
            if (scope) {
                onSelect(scope);
            }
        } else if (key.escape) {
            onCancel();
        }
    });

    const getStatusIndicator = (scope: SettingsScope): string => {
        const exists = sources[scope] !== null;
        if (exists) {
            return scope === currentScope ? ' (current)' : ' (exists)';
        }
        return ' (new)';
    };

    return (
        <Box flexDirection='column'>
            <Text bold>Save settings to which scope?</Text>
            <Box marginTop={1} flexDirection='column'>
                {SCOPES.map((scope, index) => {
                    const isSelected = index === selectedIndex;
                    const { label, description } = SCOPE_LABELS[scope];
                    const status = getStatusIndicator(scope);

                    return (
                        <Box key={scope} flexDirection='column' marginBottom={index < SCOPES.length - 1 ? 1 : 0}>
                            <Text color={isSelected ? 'cyan' : undefined}>
                                {isSelected ? '▶ ' : '  '}
                                <Text bold>{label}</Text>
                                <Text dimColor>{status}</Text>
                            </Text>
                            <Text dimColor>
                                {'    '}
                                {description}
                            </Text>
                            <Text dimColor>
                                {'    '}
                                {scopePaths[scope]}
                            </Text>
                        </Box>
                    );
                })}
            </Box>
            <Box marginTop={1}>
                <Text dimColor>
                    Press Enter to save, Escape to cancel
                </Text>
            </Box>
        </Box>
    );
};