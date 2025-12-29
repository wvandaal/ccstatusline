/**
 * Module Editor - Form for creating and editing custom modules.
 * Handles both text and command module types with appropriate fields.
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
import {
    COLOR_MAP,
    getChalkColor
} from '../../utils/colors';

type ModuleKind = 'text' | 'command';

interface TextModuleState {
    name: string;
    text: string;
    description: string;
    color: string;
}

interface CommandModuleState {
    name: string;
    command: string;
    description: string;
    color: string;
    maxWidth: string;
    timeout: string;
    preserveColors: boolean;
}

export interface ModuleEditorProps {
    settings: Settings;
    module: CustomModule | null;
    isNew: boolean;
    kind: ModuleKind;
    onSave: (module: CustomModule) => void;
    onCancel: () => void;
}

type FieldName = 'name' | 'text' | 'command' | 'description' | 'color' | 'maxWidth' | 'timeout';

export const ModuleEditor: React.FC<ModuleEditorProps> = ({
    settings,
    module,
    isNew,
    kind,
    onSave,
    onCancel
}) => {
    // Initialize state from existing module or defaults
    const initTextState = (): TextModuleState => {
        if (module && module.kind === 'text') {
            return {
                name: module.name,
                text: module.text,
                description: module.description ?? '',
                color: module.color ?? ''
            };
        }
        return { name: '', text: '', description: '', color: '' };
    };

    const initCommandState = (): CommandModuleState => {
        if (module && module.kind === 'command') {
            return {
                name: module.name,
                command: module.command,
                description: module.description ?? '',
                color: module.color ?? '',
                maxWidth: module.maxWidth?.toString() ?? '',
                timeout: module.timeout?.toString() ?? '',
                preserveColors: module.preserveColors ?? false
            };
        }
        return {
            name: '',
            command: '',
            description: '',
            color: '',
            maxWidth: '',
            timeout: '',
            preserveColors: false
        };
    };

    const [textState, setTextState] = useState<TextModuleState>(initTextState);
    const [commandState, setCommandState] = useState<CommandModuleState>(initCommandState);
    const [editingField, setEditingField] = useState<FieldName | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Get available colors
    const fgColors = ['', ...COLOR_MAP.filter(c => !c.isBackground).map(c => c.name)];

    const state = kind === 'text' ? textState : commandState;

    // Field definitions
    const textFields: { name: FieldName; label: string; required?: boolean }[] = [
        { name: 'name', label: 'Name', required: true },
        { name: 'text', label: 'Text', required: true },
        { name: 'description', label: 'Description' },
        { name: 'color', label: 'Default Color' }
    ];

    const commandFields: { name: FieldName; label: string; required?: boolean }[] = [
        { name: 'name', label: 'Name', required: true },
        { name: 'command', label: 'Command', required: true },
        { name: 'description', label: 'Description' },
        { name: 'color', label: 'Default Color' },
        { name: 'maxWidth', label: 'Max Width' },
        { name: 'timeout', label: 'Timeout (ms)' }
    ];

    const fields = kind === 'text' ? textFields : commandFields;

    const [selectedFieldIndex, setSelectedFieldIndex] = useState(0);

    // For command module, add preserveColors toggle
    const hasPreserveColorsField = kind === 'command';
    const totalFields = fields.length + (hasPreserveColorsField ? 1 : 0) + 2; // +2 for Save and Cancel

    const validateAndSave = () => {
        setError(null);

        // Validate name
        const name = state.name.trim();
        if (!name) {
            setError('Name is required');
            return;
        }
        if (!/^[a-z0-9-]+$/.test(name)) {
            setError('Name must be lowercase alphanumeric with hyphens only');
            return;
        }
        if (name.length > 32) {
            setError('Name must be 32 characters or less');
            return;
        }

        // Check for duplicate name (except for edits of the same module)
        const existingModule = settings.customModules.find(m => m.name === name);
        if (existingModule && (isNew || existingModule.name !== module?.name)) {
            setError(`Module "${name}" already exists`);
            return;
        }

        if (kind === 'text') {
            const s = state as TextModuleState;
            if (!s.text.trim()) {
                setError('Text content is required');
                return;
            }

            const newModule: CustomTextModule = {
                kind: 'text',
                name: name,
                text: s.text,
                ...(s.description && { description: s.description }),
                ...(s.color && { color: s.color })
            };
            onSave(newModule);
        } else {
            const s = state as CommandModuleState;
            if (!s.command.trim()) {
                setError('Command is required');
                return;
            }

            let maxWidth: number | undefined;
            let timeout: number | undefined;

            if (s.maxWidth) {
                const parsed = parseInt(s.maxWidth, 10);
                if (isNaN(parsed) || parsed <= 0) {
                    setError('Max width must be a positive number');
                    return;
                }
                maxWidth = parsed;
            }
            if (s.timeout) {
                const parsed = parseInt(s.timeout, 10);
                if (isNaN(parsed) || parsed <= 0) {
                    setError('Timeout must be a positive number');
                    return;
                }
                timeout = parsed;
            }

            const newModule: CustomCommandModule = {
                kind: 'command',
                name: name,
                command: s.command,
                ...(s.description && { description: s.description }),
                ...(s.color && { color: s.color }),
                ...(maxWidth && { maxWidth }),
                ...(timeout && { timeout }),
                ...(s.preserveColors && { preserveColors: true })
            };
            onSave(newModule);
        }
    };

    const getFieldValue = (fieldName: FieldName): string => {
        if (kind === 'text') {
            const textS = state as TextModuleState;
            switch (fieldName) {
            case 'name': return textS.name;
            case 'text': return textS.text;
            case 'description': return textS.description;
            case 'color': return textS.color;
            default: return '';
            }
        } else {
            const cmdS = state as CommandModuleState;
            switch (fieldName) {
            case 'name': return cmdS.name;
            case 'command': return cmdS.command;
            case 'description': return cmdS.description;
            case 'color': return cmdS.color;
            case 'maxWidth': return cmdS.maxWidth;
            case 'timeout': return cmdS.timeout;
            default: return '';
            }
        }
    };

    const setFieldValue = (fieldName: FieldName, value: string) => {
        if (kind === 'text') {
            setTextState(s => ({ ...s, [fieldName]: value }));
        } else {
            setCommandState(s => ({ ...s, [fieldName]: value }));
        }
    };

    useInput((input, key) => {
        if (editingField) {
            if (editingField === 'color') {
                // Color cycling with left/right arrows
                if (key.leftArrow || key.rightArrow) {
                    const currentColor = getFieldValue('color');
                    const currentIndex = fgColors.indexOf(currentColor);
                    const idx = currentIndex === -1 ? 0 : currentIndex;
                    const nextIndex = key.rightArrow
                        ? (idx + 1) % fgColors.length
                        : (idx - 1 + fgColors.length) % fgColors.length;
                    setFieldValue('color', fgColors[nextIndex] ?? '');
                } else if (key.return || key.escape) {
                    setEditingField(null);
                }
            } else {
                // Text input handling
                if (key.return) {
                    setEditingField(null);
                } else if (key.escape) {
                    setEditingField(null);
                } else if (key.backspace) {
                    setFieldValue(editingField, getFieldValue(editingField).slice(0, -1));
                } else if (input && !key.ctrl && !key.meta) {
                    setFieldValue(editingField, getFieldValue(editingField) + input);
                }
            }
            return;
        }

        if (key.escape) {
            onCancel();
        } else if (key.upArrow) {
            setSelectedFieldIndex(Math.max(0, selectedFieldIndex - 1));
        } else if (key.downArrow) {
            setSelectedFieldIndex(Math.min(totalFields - 1, selectedFieldIndex + 1));
        } else if (key.return) {
            // Determine what's selected
            if (selectedFieldIndex < fields.length) {
                // A field
                const field = fields[selectedFieldIndex];
                if (field) {
                    setEditingField(field.name);
                }
            } else if (hasPreserveColorsField && selectedFieldIndex === fields.length) {
                // preserveColors toggle
                setCommandState(s => ({ ...s, preserveColors: !s.preserveColors }));
            } else if (selectedFieldIndex === totalFields - 2) {
                // Save
                validateAndSave();
            } else if (selectedFieldIndex === totalFields - 1) {
                // Cancel
                onCancel();
            }
        }
    });

    const renderField = (field: { name: FieldName; label: string; required?: boolean }, index: number) => {
        const isSelected = selectedFieldIndex === index;
        const isEditing = editingField === field.name;
        const value = getFieldValue(field.name);

        const indicator = isSelected ? '\u25B6 ' : '  ';

        if (field.name === 'color') {
            // Color field with preview
            const colorDisplay = value || '(default)';
            const colorChalk = value ? getChalkColor(value, 'ansi16', false) : null;
            const colorPreview = colorChalk ? colorChalk(colorDisplay) : colorDisplay;

            return (
                <Box key={field.name}>
                    <Text color={isSelected ? 'green' : undefined}>
                        {indicator}
                        {field.label}
                        :
                        {' '}
                    </Text>
                    {isEditing ? (
                        <Text color='cyan'>
                            [
                            {colorPreview}
                            ] \u2190\u2192 to change, Enter to confirm
                        </Text>
                    ) : (
                        <Text>{colorPreview}</Text>
                    )}
                </Box>
            );
        }

        return (
            <Box key={field.name}>
                <Text color={isSelected ? 'green' : undefined}>
                    {indicator}
                    {field.label}
                    {field.required && <Text color='red'>*</Text>}
                    :
                    {' '}
                </Text>
                {isEditing ? (
                    <Text color='cyan'>
                        {value}
                        <Text backgroundColor='gray'> </Text>
                    </Text>
                ) : (
                    <Text color={value ? undefined : 'gray'}>
                        {value || '(empty)'}
                    </Text>
                )}
            </Box>
        );
    };

    const title = isNew
        ? `New ${kind === 'text' ? 'Text' : 'Command'} Module`
        : `Edit Module: ${module?.name}`;

    return (
        <Box flexDirection='column'>
            <Text bold>{title}</Text>
            <Text dimColor>Enter to edit field, ESC to cancel</Text>

            {error && (
                <Box marginTop={1}>
                    <Text color='red'>{error}</Text>
                </Box>
            )}

            <Box marginTop={1} flexDirection='column'>
                {fields.map((field, idx) => renderField(field, idx))}

                {hasPreserveColorsField && (
                    <Box>
                        <Text color={selectedFieldIndex === fields.length ? 'green' : undefined}>
                            {selectedFieldIndex === fields.length ? '\u25B6 ' : '  '}
                            Preserve Colors:
                            {' '}
                        </Text>
                        <Text color={(commandState).preserveColors ? 'green' : 'red'}>
                            {(commandState).preserveColors ? '\u2713 Yes' : '\u2717 No'}
                        </Text>
                    </Box>
                )}

                <Box marginTop={1}>
                    <Text color={selectedFieldIndex === totalFields - 2 ? 'green' : undefined}>
                        {selectedFieldIndex === totalFields - 2 ? '\u25B6 ' : '  '}
                        Save
                    </Text>
                </Box>
                <Box>
                    <Text color={selectedFieldIndex === totalFields - 1 ? 'green' : undefined}>
                        {selectedFieldIndex === totalFields - 1 ? '\u25B6 ' : '  '}
                        Cancel
                    </Text>
                </Box>
            </Box>

            <Box marginTop={1}>
                <Text dimColor>
                    \u2191\u2193 navigate, Enter select/edit, ESC go back
                </Text>
            </Box>
        </Box>
    );
};