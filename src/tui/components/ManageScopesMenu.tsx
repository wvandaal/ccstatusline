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

export interface ManageScopesMenuProps {
    /** Information about which scopes have settings */
    sources: SettingsSources;
    /** Full paths to scope settings files */
    scopePaths: Record<SettingsScope, string>;
    /** Current save scope */
    saveScope: SettingsScope;
    /** Callback to set the save scope */
    onSetSaveScope: (scope: SettingsScope) => void;
    /** Callback to create a scope */
    onCreateScope: (scope: SettingsScope) => void;
    /** Callback to delete a scope */
    onDeleteScope: (scope: SettingsScope) => void;
    /** Callback to go back */
    onBack: () => void;
}

interface MenuItem {
    label: string;
    value: string;
    selectable: boolean;
    scope?: SettingsScope;
    action?: 'create' | 'delete' | 'setDefault';
}

const SCOPE_LABELS: Record<SettingsScope, { label: string; description: string }> = {
    user: {
        label: 'User (Global)',
        description: 'Personal settings across all projects (~/.claude/statusline/)'
    },
    project: {
        label: 'Project (Shared)',
        description: 'Team settings committed to git (.claude/statusline/)'
    },
    local: {
        label: 'Local (Personal)',
        description: 'Personal project overrides, gitignored (.claude/statusline/)'
    }
};

const SCOPES: SettingsScope[] = ['user', 'project', 'local'];

export const ManageScopesMenu: React.FC<ManageScopesMenuProps> = ({
    sources,
    scopePaths,
    saveScope,
    onSetSaveScope,
    onCreateScope,
    onDeleteScope,
    onBack
}) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [confirmDelete, setConfirmDelete] = useState<SettingsScope | null>(null);

    // Build menu items
    const buildMenuItems = (): MenuItem[] => {
        const items: MenuItem[] = [];

        for (const scope of SCOPES) {
            const exists = sources[scope] !== null;
            const isDefault = scope === saveScope;
            const { label } = SCOPE_LABELS[scope];

            // Header for scope
            const statusText = exists
                ? (isDefault ? ' (active, default save target)' : ' (active)')
                : ' (not configured)';

            items.push({
                label: `${label}${statusText}`,
                value: `header_${scope}`,
                selectable: false
            });

            // Path
            items.push({
                label: `  ${scopePaths[scope]}`,
                value: `path_${scope}`,
                selectable: false
            });

            // Actions
            if (exists) {
                if (!isDefault) {
                    items.push({
                        label: '  → Set as default save target',
                        value: `setDefault_${scope}`,
                        selectable: true,
                        scope,
                        action: 'setDefault'
                    });
                }
                // Can't delete user scope - it's always needed
                if (scope !== 'user') {
                    items.push({
                        label: '  → Delete this scope',
                        value: `delete_${scope}`,
                        selectable: true,
                        scope,
                        action: 'delete'
                    });
                }
            } else {
                items.push({
                    label: '  → Create settings in this scope',
                    value: `create_${scope}`,
                    selectable: true,
                    scope,
                    action: 'create'
                });
            }

            // Gap between scopes
            items.push({
                label: '',
                value: `gap_${scope}`,
                selectable: false
            });
        }

        // Back option
        items.push({
            label: '← Back',
            value: 'back',
            selectable: true
        });

        return items;
    };

    const menuItems = buildMenuItems();
    const selectableItems = menuItems.filter(item => item.selectable);

    useInput((input, key) => {
        if (confirmDelete) {
            // In delete confirmation mode
            if (input === 'y' || input === 'Y') {
                onDeleteScope(confirmDelete);
                setConfirmDelete(null);
            } else if (input === 'n' || input === 'N' || key.escape) {
                setConfirmDelete(null);
            }
            return;
        }

        if (key.upArrow) {
            setSelectedIndex(Math.max(0, selectedIndex - 1));
        } else if (key.downArrow) {
            setSelectedIndex(Math.min(selectableItems.length - 1, selectedIndex + 1));
        } else if (key.return) {
            const item = selectableItems[selectedIndex];
            if (item) {
                if (item.value === 'back') {
                    onBack();
                } else if (item.action === 'create' && item.scope) {
                    onCreateScope(item.scope);
                } else if (item.action === 'delete' && item.scope) {
                    setConfirmDelete(item.scope);
                } else if (item.action === 'setDefault' && item.scope) {
                    onSetSaveScope(item.scope);
                }
            }
        } else if (key.escape) {
            onBack();
        }
    });

    if (confirmDelete) {
        return (
            <Box flexDirection='column'>
                <Text bold color='yellow'>
                    Delete
                    {' '}
                    {SCOPE_LABELS[confirmDelete].label}
                    {' '}
                    settings?
                </Text>
                <Text>
                    This will delete:
                    {' '}
                    {scopePaths[confirmDelete]}
                </Text>
                <Box marginTop={1}>
                    <Text>
                        Press
                        {' '}
                        <Text color='green'>Y</Text>
                        {' '}
                        to confirm,
                        {' '}
                        <Text color='red'>N</Text>
                        {' '}
                        to cancel
                    </Text>
                </Box>
            </Box>
        );
    }

    return (
        <Box flexDirection='column'>
            <Text bold>Manage Settings Scopes</Text>
            <Text dimColor>
                Settings are merged: Local
                {' '}
                {'>'}
                {' '}
                Project
                {' '}
                {'>'}
                {' '}
                User
                {' '}
                {'>'}
                {' '}
                Defaults
            </Text>
            <Box marginTop={1} flexDirection='column'>
                {menuItems.map((item, idx) => {
                    if (!item.selectable && item.value.startsWith('gap_')) {
                        return <Text key={item.value}> </Text>;
                    }

                    const selectableIdx = selectableItems.indexOf(item);
                    const isSelected = item.selectable && selectableIdx === selectedIndex;

                    // Headers and paths
                    if (item.value.startsWith('header_')) {
                        return (
                            <Text key={item.value} bold>
                                {item.label}
                            </Text>
                        );
                    }

                    if (item.value.startsWith('path_')) {
                        return (
                            <Text key={item.value} dimColor>
                                {item.label}
                            </Text>
                        );
                    }

                    // Selectable actions
                    const actionColor = item.action === 'delete' ? 'red' : 'cyan';

                    return (
                        <Text
                            key={item.value}
                            color={isSelected ? actionColor : 'gray'}
                        >
                            {isSelected ? '▶ ' : '  '}
                            {item.label}
                        </Text>
                    );
                })}
            </Box>
        </Box>
    );
};