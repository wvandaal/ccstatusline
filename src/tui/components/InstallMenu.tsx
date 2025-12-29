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
import type { SettingsScope } from '../../types/SettingsScope';

type InstallStep = 'package-manager' | 'claude-scope' | 'ccstatusline-scope' | 'confirm';

export interface InstallMenuProps {
    bunxAvailable: boolean;
    installationStatus: ClaudeInstallationStatus;
    claudeSettingsPaths: Record<ClaudeSettingsScope, string>;
    ccstatuslinePaths: Record<SettingsScope, string>;
    currentCcstatuslineScope: SettingsScope;
    onInstall: (options: {
        useBunx: boolean;
        claudeScope: ClaudeSettingsScope;
        ccstatuslineScope: SettingsScope;
    }) => void;
    onCancel: () => void;
}

const SCOPES: ClaudeSettingsScope[] = ['user', 'project', 'local'];

const SCOPE_LABELS: Record<ClaudeSettingsScope, { name: string; description: string }> = {
    user: { name: 'User (Global)', description: 'Personal global settings' },
    project: { name: 'Project (Shared)', description: 'Team-shared, committed to git' },
    local: { name: 'Local (Personal)', description: 'Personal project overrides, gitignored' }
};

export const InstallMenu: React.FC<InstallMenuProps> = ({
    bunxAvailable,
    installationStatus,
    claudeSettingsPaths,
    ccstatuslinePaths,
    currentCcstatuslineScope,
    onInstall,
    onCancel
}) => {
    const [step, setStep] = useState<InstallStep>('package-manager');
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Wizard state
    const [useBunx, setUseBunx] = useState(false);
    const [claudeScope, setClaudeScope] = useState<ClaudeSettingsScope>('user');
    const [ccstatuslineScope, setCcstatuslineScope] = useState<SettingsScope>(currentCcstatuslineScope);

    // Navigation helpers
    const getMaxIndex = (): number => {
        switch (step) {
        case 'package-manager':
            return 2; // npx, bunx (maybe disabled), back
        case 'claude-scope':
            return 3; // user, project, local, back
        case 'ccstatusline-scope':
            return 4; // user, project, local, skip, back
        case 'confirm':
            return 2; // confirm, back
        }
    };

    useInput((input, key) => {
        if (key.escape) {
            if (step === 'package-manager') {
                onCancel();
            } else {
                // Go back one step
                goBack();
            }
            return;
        }

        const maxIndex = getMaxIndex();

        if (key.upArrow) {
            // Handle skipping bunx if not available
            if (step === 'package-manager' && selectedIndex === 2) {
                setSelectedIndex(bunxAvailable ? 1 : 0);
            } else {
                setSelectedIndex(Math.max(0, selectedIndex - 1));
            }
        } else if (key.downArrow) {
            // Handle skipping bunx if not available
            if (step === 'package-manager' && selectedIndex === 0 && !bunxAvailable) {
                setSelectedIndex(2);
            } else if (step === 'package-manager' && selectedIndex === 1 && bunxAvailable) {
                setSelectedIndex(2);
            } else {
                setSelectedIndex(Math.min(maxIndex, selectedIndex + 1));
            }
        } else if (key.return) {
            handleSelect();
        }
    });

    const goBack = () => {
        setSelectedIndex(0);
        switch (step) {
        case 'claude-scope':
            setStep('package-manager');
            break;
        case 'ccstatusline-scope':
            setStep('claude-scope');
            break;
        case 'confirm':
            setStep('ccstatusline-scope');
            break;
        }
    };

    const handleSelect = () => {
        switch (step) {
        case 'package-manager':
            if (selectedIndex === 0) {
                setUseBunx(false);
                setStep('claude-scope');
                setSelectedIndex(0);
            } else if (selectedIndex === 1 && bunxAvailable) {
                setUseBunx(true);
                setStep('claude-scope');
                setSelectedIndex(0);
            } else if (selectedIndex === 2) {
                onCancel();
            }
            break;

        case 'claude-scope': {
            const scope = SCOPES[selectedIndex];
            if (selectedIndex < 3 && scope) {
                setClaudeScope(scope);
                setStep('ccstatusline-scope');
                setSelectedIndex(0);
            } else {
                goBack();
            }
            break;
        }

        case 'ccstatusline-scope': {
            const scope = SCOPES[selectedIndex];
            if (selectedIndex < 3 && scope) {
                setCcstatuslineScope(scope);
                setStep('confirm');
                setSelectedIndex(0);
            } else if (selectedIndex === 3) {
                // Skip - use current scope
                setCcstatuslineScope(currentCcstatuslineScope);
                setStep('confirm');
                setSelectedIndex(0);
            } else {
                goBack();
            }
            break;
        }

        case 'confirm':
            if (selectedIndex === 0) {
                onInstall({
                    useBunx,
                    claudeScope,
                    ccstatuslineScope
                });
            } else {
                goBack();
            }
            break;
        }
    };

    const renderPackageManagerStep = () => (
        <>
            <Text bold>Step 1: Select Package Manager</Text>
            <Box marginTop={1} flexDirection='column'>
                <Box>
                    <Text color={selectedIndex === 0 ? 'blue' : undefined}>
                        {selectedIndex === 0 ? '▶  ' : '   '}
                        npx - Node Package Execute
                    </Text>
                </Box>
                <Box>
                    <Text
                        color={selectedIndex === 1 && bunxAvailable ? 'blue' : undefined}
                        dimColor={!bunxAvailable}
                    >
                        {selectedIndex === 1 && bunxAvailable ? '▶  ' : '   '}
                        bunx - Bun Package Execute
                        {!bunxAvailable && ' (not installed)'}
                    </Text>
                </Box>
                <Box marginTop={1}>
                    <Text color={selectedIndex === 2 ? 'blue' : undefined}>
                        {selectedIndex === 2 ? '▶  ' : '   '}
                        ← Cancel
                    </Text>
                </Box>
            </Box>
        </>
    );

    const renderClaudeScopeStep = () => (
        <>
            <Text bold>Step 2: Select Claude Code Settings Scope</Text>
            <Box marginBottom={1}>
                <Text dimColor>
                    Using:
                    {' '}
                    {useBunx ? 'bunx' : 'npx'}
                </Text>
            </Box>
            <Box flexDirection='column'>
                {SCOPES.map((scope, idx) => {
                    const isSelected = selectedIndex === idx;
                    const status = installationStatus[scope];
                    return (
                        <Box key={scope} flexDirection='column'>
                            <Box>
                                <Text color={isSelected ? 'blue' : undefined}>
                                    {isSelected ? '▶  ' : '   '}
                                    {SCOPE_LABELS[scope].name}
                                    {status.installed && (
                                        <Text color='green'> (installed)</Text>
                                    )}
                                </Text>
                            </Box>
                            {isSelected && (
                                <Box marginLeft={3}>
                                    <Text dimColor>
                                        {claudeSettingsPaths[scope]}
                                    </Text>
                                </Box>
                            )}
                        </Box>
                    );
                })}
                <Box marginTop={1}>
                    <Text color={selectedIndex === 3 ? 'blue' : undefined}>
                        {selectedIndex === 3 ? '▶  ' : '   '}
                        ← Back
                    </Text>
                </Box>
            </Box>
        </>
    );

    const renderCcstatuslineScopeStep = () => (
        <>
            <Text bold>Step 3: Select ccstatusline Settings Scope</Text>
            <Box marginBottom={1}>
                <Text dimColor>
                    Claude Code:
                    {' '}
                    {claudeScope}
                    {' → '}
                    {claudeSettingsPaths[claudeScope]}
                </Text>
            </Box>
            <Box flexDirection='column'>
                {SCOPES.map((scope, idx) => {
                    const isSelected = selectedIndex === idx;
                    const isCurrent = scope === currentCcstatuslineScope;
                    return (
                        <Box key={scope} flexDirection='column'>
                            <Box>
                                <Text color={isSelected ? 'blue' : undefined}>
                                    {isSelected ? '▶  ' : '   '}
                                    {SCOPE_LABELS[scope].name}
                                    {isCurrent && (
                                        <Text color='cyan'> (current)</Text>
                                    )}
                                </Text>
                            </Box>
                            {isSelected && (
                                <Box marginLeft={3}>
                                    <Text dimColor>
                                        {ccstatuslinePaths[scope]}
                                    </Text>
                                </Box>
                            )}
                        </Box>
                    );
                })}
                <Box marginTop={1}>
                    <Text color={selectedIndex === 3 ? 'blue' : undefined}>
                        {selectedIndex === 3 ? '▶  ' : '   '}
                        Skip (keep current:
                        {' '}
                        {currentCcstatuslineScope}
                        )
                    </Text>
                </Box>
                <Box marginTop={1}>
                    <Text color={selectedIndex === 4 ? 'blue' : undefined}>
                        {selectedIndex === 4 ? '▶  ' : '   '}
                        ← Back
                    </Text>
                </Box>
            </Box>
        </>
    );

    const renderConfirmStep = () => (
        <>
            <Text bold>Step 4: Confirm Installation</Text>
            <Box marginTop={1} flexDirection='column'>
                <Box>
                    <Text>Package manager: </Text>
                    <Text color='cyan'>{useBunx ? 'bunx' : 'npx'}</Text>
                </Box>
                <Box marginTop={1} flexDirection='column'>
                    <Text>Claude Code settings:</Text>
                    <Box marginLeft={2}>
                        <Text color='cyan'>{SCOPE_LABELS[claudeScope].name}</Text>
                    </Box>
                    <Box marginLeft={2}>
                        <Text dimColor>{claudeSettingsPaths[claudeScope]}</Text>
                    </Box>
                </Box>
                <Box marginTop={1} flexDirection='column'>
                    <Text>ccstatusline settings:</Text>
                    <Box marginLeft={2}>
                        <Text color='cyan'>{SCOPE_LABELS[ccstatuslineScope].name}</Text>
                    </Box>
                    <Box marginLeft={2}>
                        <Text dimColor>{ccstatuslinePaths[ccstatuslineScope]}</Text>
                    </Box>
                </Box>
            </Box>
            <Box marginTop={2} flexDirection='column'>
                <Box>
                    <Text color={selectedIndex === 0 ? 'green' : undefined} bold={selectedIndex === 0}>
                        {selectedIndex === 0 ? '▶  ' : '   '}
                        Confirm Installation
                    </Text>
                </Box>
                <Box marginTop={1}>
                    <Text color={selectedIndex === 1 ? 'blue' : undefined}>
                        {selectedIndex === 1 ? '▶  ' : '   '}
                        ← Back
                    </Text>
                </Box>
            </Box>
        </>
    );

    return (
        <Box flexDirection='column'>
            <Text bold color='cyan'>Install ccstatusline to Claude Code</Text>
            <Box marginTop={1} />

            {step === 'package-manager' && renderPackageManagerStep()}
            {step === 'claude-scope' && renderClaudeScopeStep()}
            {step === 'ccstatusline-scope' && renderCcstatuslineScopeStep()}
            {step === 'confirm' && renderConfirmStep()}

            <Box marginTop={2}>
                <Text dimColor>
                    ↑↓ navigate, Enter select, ESC
                    {' '}
                    {step === 'package-manager' ? 'cancel' : 'back'}
                </Text>
            </Box>
        </Box>
    );
};