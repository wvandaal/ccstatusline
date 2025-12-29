/**
 * Custom Modules Menu - TUI screen for managing custom module definitions.
 * Allows users to create, edit, and delete custom text and command modules.
 */

import {
    Box,
    Text,
    useInput
} from 'ink';
import React, { useState } from 'react';

import type {
    CustomCommandModule,
    CustomModule,
    CustomTextModule
} from '../../types/CustomModule';
import type { Settings } from '../../types/Settings';

import { ConfirmDialog } from './ConfirmDialog';

export interface CustomModulesMenuProps {
    settings: Settings;
    onUpdate: (settings: Settings) => void;
    onBack: () => void;
    onEditModule: (module: CustomModule | null, isNew: boolean, kind: 'text' | 'command') => void;
}

export const CustomModulesMenu: React.FC<CustomModulesMenuProps> = ({
    settings,
    onUpdate,
    onBack,
    onEditModule
}) => {
    const modules = settings.customModules;
    const textModules = modules.filter((m): m is CustomTextModule => m.kind === 'text');
    const commandModules = modules.filter((m): m is CustomCommandModule => m.kind === 'command');

    // Build menu items
    interface MenuItem {
        label: string;
        value: string;
        type: 'text-module' | 'command-module' | 'add-text' | 'add-command' | 'back' | 'header';
        module?: CustomModule;
    }

    const menuItems: MenuItem[] = [];

    // Text modules section
    if (textModules.length > 0) {
        menuItems.push({ label: 'Text Modules:', value: '_header_text', type: 'header' });
        for (const module of textModules) {
            const preview = module.text.length > 20
                ? `${module.text.slice(0, 17)}...`
                : module.text;
            menuItems.push({
                label: `  ${module.name} (${preview})`,
                value: `text:${module.name}`,
                type: 'text-module',
                module
            });
        }
    }

    // Command modules section
    if (commandModules.length > 0) {
        if (textModules.length > 0) {
            menuItems.push({ label: '', value: '_gap1', type: 'header' });
        }
        menuItems.push({ label: 'Command Modules:', value: '_header_cmd', type: 'header' });
        for (const module of commandModules) {
            const preview = module.command.length > 20
                ? `${module.command.slice(0, 17)}...`
                : module.command;
            menuItems.push({
                label: `  ${module.name} (${preview})`,
                value: `cmd:${module.name}`,
                type: 'command-module',
                module
            });
        }
    }

    // Empty state
    if (modules.length === 0) {
        menuItems.push({ label: 'No modules defined yet', value: '_empty', type: 'header' });
    }

    // Action items
    menuItems.push({ label: '', value: '_gap2', type: 'header' });
    menuItems.push({ label: '+ Add Text Module', value: 'add-text', type: 'add-text' });
    menuItems.push({ label: '+ Add Command Module', value: 'add-command', type: 'add-command' });
    menuItems.push({ label: '', value: '_gap3', type: 'header' });
    menuItems.push({ label: '\u2190 Back', value: 'back', type: 'back' });

    const selectableItems = menuItems.filter(
        item => item.type !== 'header'
    );

    const [selectedIndex, setSelectedIndex] = useState(0);
    const [deleteConfirm, setDeleteConfirm] = useState<CustomModule | null>(null);

    const handleSelect = () => {
        const item = selectableItems[selectedIndex];
        if (!item)
            return;

        switch (item.type) {
        case 'back':
            onBack();
            break;
        case 'add-text':
            onEditModule(null, true, 'text');
            break;
        case 'add-command':
            onEditModule(null, true, 'command');
            break;
        case 'text-module':
        case 'command-module':
            if (item.module) {
                onEditModule(item.module, false, item.module.kind);
            }
            break;
        }
    };

    const handleDelete = () => {
        const item = selectableItems[selectedIndex];
        if (!item)
            return;

        if ((item.type === 'text-module' || item.type === 'command-module') && item.module) {
            setDeleteConfirm(item.module);
        }
    };

    const confirmDelete = () => {
        if (!deleteConfirm)
            return;

        const newModules = modules.filter(m => m.name !== deleteConfirm.name);
        onUpdate({
            ...settings,
            customModules: newModules
        });
        setDeleteConfirm(null);

        // Adjust selection if needed
        const newSelectableCount = selectableItems.length - 1;
        if (selectedIndex >= newSelectableCount && newSelectableCount > 0) {
            setSelectedIndex(newSelectableCount - 1);
        }
    };

    useInput((input, key) => {
        if (deleteConfirm) {
            // Let ConfirmDialog handle input
            return;
        }

        if (key.escape) {
            onBack();
        } else if (key.upArrow) {
            setSelectedIndex(Math.max(0, selectedIndex - 1));
        } else if (key.downArrow) {
            setSelectedIndex(Math.min(selectableItems.length - 1, selectedIndex + 1));
        } else if (key.return) {
            handleSelect();
        } else if (input === 'd' || input === 'D') {
            handleDelete();
        }
    });

    // Get description for current selection
    const getDescription = (): string => {
        const item = selectableItems[selectedIndex];
        if (!item)
            return '';

        switch (item.type) {
        case 'text-module':
            return item.module?.description ?? 'Custom text module - displays static text';
        case 'command-module':
            return item.module?.description ?? 'Custom command module - executes shell command';
        case 'add-text':
            return 'Create a new text module that displays static content';
        case 'add-command':
            return 'Create a new command module that executes a shell command';
        case 'back':
            return 'Return to the main menu';
        default:
            return '';
        }
    };

    // Check if current item is deletable
    const currentItem = selectableItems[selectedIndex];
    const isDeletable = currentItem?.type === 'text-module' || currentItem?.type === 'command-module';

    if (deleteConfirm) {
        return (
            <Box flexDirection='column'>
                <Text bold color='yellow'>Delete Module</Text>
                <Box marginTop={1} flexDirection='column'>
                    <Text>
                        Are you sure you want to delete module &quot;
                        {deleteConfirm.name}
                        &quot;?
                    </Text>
                    <Text color='red'>This cannot be undone.</Text>
                </Box>
                <Box marginTop={1}>
                    <ConfirmDialog
                        inline
                        onConfirm={confirmDelete}
                        onCancel={() => { setDeleteConfirm(null); }}
                    />
                </Box>
            </Box>
        );
    }

    return (
        <Box flexDirection='column'>
            <Text bold>Custom Modules</Text>
            <Text dimColor>
                Define reusable modules that appear in the widget type selector
            </Text>
            <Box marginTop={1} flexDirection='column'>
                {menuItems.map((item) => {
                    if (item.type === 'header') {
                        if (item.value.startsWith('_gap') || item.value === '_empty') {
                            return <Text key={item.value}>{item.label || ' '}</Text>;
                        }
                        return (
                            <Text key={item.value} bold dimColor>
                                {item.label}
                            </Text>
                        );
                    }

                    const selectableIdx = selectableItems.indexOf(item);
                    const isSelected = selectableIdx === selectedIndex;

                    return (
                        <Text
                            key={item.value}
                            color={isSelected ? 'green' : undefined}
                        >
                            {isSelected ? '\u25B6  ' : '   '}
                            {item.label}
                        </Text>
                    );
                })}
            </Box>
            <Box marginTop={1} paddingLeft={2}>
                <Text dimColor wrap='wrap'>{getDescription()}</Text>
            </Box>
            <Box marginTop={1}>
                <Text dimColor>
                    \u2191\u2193 select, Enter edit
                    {isDeletable ? ', (d)elete' : ''}
                    , ESC back
                </Text>
            </Box>
        </Box>
    );
};