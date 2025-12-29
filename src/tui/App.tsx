import chalk from 'chalk';
import {
    Box,
    Text,
    render,
    useApp,
    useInput
} from 'ink';
import Gradient from 'ink-gradient';
import React, {
    useCallback,
    useEffect,
    useState
} from 'react';

import type {
    ClaudeInstallationStatus,
    ClaudeSettingsScope
} from '../types/ClaudeSettings';
import type { CustomModule } from '../types/CustomModule';
import type { Settings } from '../types/Settings';
import type {
    SettingsScope,
    SettingsSources
} from '../types/SettingsScope';
import type { WidgetItem } from '../types/Widget';
import {
    getAllClaudeSettingsPaths,
    getInstallationStatus,
    installStatusLineToScope,
    isBunxAvailable,
    uninstallStatusLineFromScope
} from '../utils/claude-settings';
import {
    checkPowerlineFonts,
    checkPowerlineFontsAsync,
    installPowerlineFonts,
    type PowerlineFontStatus
} from '../utils/powerline';
import {
    createScopeSettings,
    deleteScopeSettings,
    getAllScopePaths,
    loadScopedSettings,
    saveScopedSettings
} from '../utils/scoped-config';
import { getPackageVersion } from '../utils/terminal';

import {
    ColorMenu,
    ConfirmDialog,
    CustomModulesMenu,
    GlobalOverridesMenu,
    InstallMenu,
    ItemsEditor,
    LineSelector,
    MainMenu,
    ManageScopesMenu,
    ModuleEditor,
    PowerlineSetup,
    ScopeSaveDialog,
    StatusLinePreview,
    TerminalOptionsMenu,
    TerminalWidthMenu,
    UninstallScopeSelector
} from './components';

export const App: React.FC = () => {
    const { exit } = useApp();
    const [settings, setSettings] = useState<Settings | null>(null);
    const [originalSettings, setOriginalSettings] = useState<Settings | null>(null);
    const [hasChanges, setHasChanges] = useState(false);
    const [screen, setScreen] = useState<'main' | 'lines' | 'items' | 'colorLines' | 'colors' | 'terminalWidth' | 'terminalConfig' | 'globalOverrides' | 'confirm' | 'powerline' | 'install' | 'uninstall' | 'scopes' | 'scopeSave' | 'customModules' | 'moduleEditor'>('main');
    // Scope-related state
    const [settingsSources, setSettingsSources] = useState<SettingsSources | null>(null);
    const [saveScope, setSaveScope] = useState<SettingsScope>('user');
    const scopePaths = getAllScopePaths();
    // Claude Code installation state
    const [installationStatus, setInstallationStatus] = useState<ClaudeInstallationStatus | null>(null);
    const claudeSettingsPaths = getAllClaudeSettingsPaths();
    const [selectedLine, setSelectedLine] = useState(0);
    const [menuSelections, setMenuSelections] = useState<Record<string, number>>({});
    const [confirmDialog, setConfirmDialog] = useState<{ message: string; action: () => Promise<void> } | null>(null);
    const [terminalWidth, setTerminalWidth] = useState(process.stdout.columns || 80);
    const [powerlineFontStatus, setPowerlineFontStatus] = useState<PowerlineFontStatus>({ installed: false });
    const [installingFonts, setInstallingFonts] = useState(false);
    const [fontInstallMessage, setFontInstallMessage] = useState<string | null>(null);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);
    const [previewIsTruncated, setPreviewIsTruncated] = useState(false);
    // Module editor state
    const [editingModule, setEditingModule] = useState<CustomModule | null>(null);
    const [isNewModule, setIsNewModule] = useState(false);
    const [moduleKind, setModuleKind] = useState<'text' | 'command'>('text');

    useEffect(() => {
        // Load installation status across all scopes
        void getInstallationStatus().then(setInstallationStatus);

        void loadScopedSettings({ includeSourceInfo: true }).then((resolved) => {
            // Set global chalk level based on settings (default to 256 colors for compatibility)
            chalk.level = resolved.settings.colorLevel;
            setSettings(resolved.settings);
            setOriginalSettings(JSON.parse(JSON.stringify(resolved.settings)) as Settings); // Deep copy
            setSettingsSources(resolved.sources);

            // Set default save scope based on loaded sources
            if (resolved.sources.local) {
                setSaveScope('local');
            } else if (resolved.sources.project) {
                setSaveScope('project');
            } else {
                setSaveScope('user');
            }
        });

        // Check for Powerline fonts on startup (use sync version that doesn't call execSync)
        const fontStatus = checkPowerlineFonts();
        setPowerlineFontStatus(fontStatus);

        // Optionally do the async check later (but not blocking React)
        void checkPowerlineFontsAsync().then((asyncStatus) => {
            setPowerlineFontStatus(asyncStatus);
        });

        const handleResize = () => {
            setTerminalWidth(process.stdout.columns || 80);
        };

        process.stdout.on('resize', handleResize);
        return () => {
            process.stdout.off('resize', handleResize);
        };
    }, []);

    // Check for changes whenever settings update
    useEffect(() => {
        if (originalSettings) {
            const hasAnyChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);
            setHasChanges(hasAnyChanges);
        }
    }, [settings, originalSettings]);

    // Clear save message after 2 seconds
    useEffect(() => {
        if (saveMessage) {
            const timer = setTimeout(() => {
                setSaveMessage(null);
            }, 2000);
            return () => { clearTimeout(timer); };
        }
    }, [saveMessage]);

    useInput((input, key) => {
        if (key.ctrl && input === 'c') {
            exit();
        }
        // Global save shortcut - show scope dialog if multiple scopes exist
        if (key.ctrl && input === 's' && settings) {
            const hasMultipleScopes = settingsSources
                && (settingsSources.project !== null || settingsSources.local !== null);
            if (hasMultipleScopes) {
                setScreen('scopeSave');
            } else {
                void (async () => {
                    await saveScopedSettings(settings, { scope: saveScope });
                    setOriginalSettings(JSON.parse(JSON.stringify(settings)) as Settings);
                    setHasChanges(false);
                    setSaveMessage('✓ Configuration saved');
                })();
            }
        }
    });

    // Derive isClaudeInstalled from installationStatus
    const isClaudeInstalled = installationStatus
        ? (installationStatus.user.installed
            || installationStatus.project.installed
            || installationStatus.local.installed)
        : false;

    const handleInstall = useCallback(async (options: {
        useBunx: boolean;
        claudeScope: ClaudeSettingsScope;
        ccstatuslineScope: SettingsScope;
    }) => {
        // Install to Claude Code settings
        await installStatusLineToScope(options.claudeScope, options.useBunx);

        // Update ccstatusline scope if changed
        if (options.ccstatuslineScope !== saveScope) {
            setSaveScope(options.ccstatuslineScope);
            // Create settings file if it doesn't exist
            if (settingsSources && !settingsSources[options.ccstatuslineScope] && settings) {
                await createScopeSettings(options.ccstatuslineScope, settings);
                // Reload sources
                const resolved = await loadScopedSettings({ includeSourceInfo: true });
                setSettingsSources(resolved.sources);
            }
        }

        // Refresh installation status
        const newStatus = await getInstallationStatus();
        setInstallationStatus(newStatus);
        setScreen('main');
    }, [saveScope, settingsSources, settings]);

    const handleUninstall = useCallback(async (scopes: ClaudeSettingsScope[]) => {
        // Uninstall from each selected scope
        await Promise.all(scopes.map(scope => uninstallStatusLineFromScope(scope)));

        // Refresh installation status
        const newStatus = await getInstallationStatus();
        setInstallationStatus(newStatus);
        setScreen('main');
    }, []);

    if (!settings) {
        return <Text>Loading settings...</Text>;
    }

    const handleInstallUninstall = () => {
        if (isClaudeInstalled) {
            // Show uninstall scope selector
            setScreen('uninstall');
        } else {
            // Show install wizard
            setScreen('install');
        }
    };

    const handleMainMenuSelect = async (value: string) => {
        switch (value) {
        case 'lines':
            setScreen('lines');
            break;
        case 'colors':
            setScreen('colorLines');
            break;
        case 'terminalConfig':
            setScreen('terminalConfig');
            break;
        case 'globalOverrides':
            setScreen('globalOverrides');
            break;
        case 'powerline':
            setScreen('powerline');
            break;
        case 'scopes':
            setScreen('scopes');
            break;
        case 'customModules':
            setScreen('customModules');
            break;
        case 'install':
            handleInstallUninstall();
            break;
        case 'save':
            await saveScopedSettings(settings, { scope: saveScope });
            setOriginalSettings(JSON.parse(JSON.stringify(settings)) as Settings); // Update original after save
            setHasChanges(false);
            exit();
            break;
        case 'exit':
            exit();
            break;
        }
    };

    const updateLine = (lineIndex: number, widgets: WidgetItem[]) => {
        const newLines = [...settings.lines];
        newLines[lineIndex] = widgets;
        setSettings({ ...settings, lines: newLines });
    };

    const updateLines = (newLines: WidgetItem[][]) => {
        setSettings({ ...settings, lines: newLines });
    };

    const handleLineSelect = (lineIndex: number) => {
        setSelectedLine(lineIndex);
        setScreen('items');
    };

    return (
        <Box flexDirection='column'>
            <Box marginBottom={1}>
                <Text bold>
                    <Gradient name='retro'>
                        CCStatusline Configuration
                    </Gradient>
                </Text>
                <Text bold>
                    {` | ${getPackageVersion() && `v${getPackageVersion()}`}`}
                </Text>
                {settingsSources?.project && (
                    <Text color='cyan' bold> [Project]</Text>
                )}
                {settingsSources?.local && (
                    <Text color='yellow' bold> [Local]</Text>
                )}
                {saveMessage && (
                    <Text color='green' bold>
                        {`  ${saveMessage}`}
                    </Text>
                )}
            </Box>

            <StatusLinePreview
                lines={settings.lines}
                terminalWidth={terminalWidth}
                settings={settings}
                onTruncationChange={setPreviewIsTruncated}
            />

            <Box marginTop={1}>
                {screen === 'main' && (
                    <MainMenu
                        onSelect={(value) => {
                            // Only persist menu selection if not exiting
                            if (value !== 'save' && value !== 'exit') {
                                const menuMap: Record<string, number> = {
                                    lines: 0,
                                    colors: 1,
                                    powerline: 2,
                                    terminalConfig: 3,
                                    globalOverrides: 4,
                                    install: 5
                                };
                                setMenuSelections({ ...menuSelections, main: menuMap[value] ?? 0 });
                            }
                            void handleMainMenuSelect(value);
                        }}
                        isClaudeInstalled={isClaudeInstalled}
                        hasChanges={hasChanges}
                        initialSelection={menuSelections.main}
                        powerlineFontStatus={powerlineFontStatus}
                        settings={settings}
                        previewIsTruncated={previewIsTruncated}
                    />
                )}
                {screen === 'lines' && (
                    <LineSelector
                        lines={settings.lines}
                        onSelect={(line) => {
                            setMenuSelections({ ...menuSelections, lines: line });
                            handleLineSelect(line);
                        }}
                        onLinesUpdate={updateLines}
                        onBack={() => {
                            // Save that we came from 'lines' menu (index 0)
                            // Clear the line selection so it resets next time we enter
                            setMenuSelections({ ...menuSelections, main: 0 });
                            setScreen('main');
                        }}
                        initialSelection={menuSelections.lines}
                        title='Select Line to Edit Items'
                        allowEditing={true}
                    />
                )}
                {screen === 'items' && (
                    <ItemsEditor
                        widgets={settings.lines[selectedLine] ?? []}
                        onUpdate={(widgets) => { updateLine(selectedLine, widgets); }}
                        onBack={() => {
                            // When going back to lines menu, preserve which line was selected
                            setMenuSelections({ ...menuSelections, lines: selectedLine });
                            setScreen('lines');
                        }}
                        lineNumber={selectedLine + 1}
                        settings={settings}
                    />
                )}
                {screen === 'colorLines' && (
                    <LineSelector
                        lines={settings.lines}
                        onLinesUpdate={updateLines}
                        onSelect={(line) => {
                            setMenuSelections({ ...menuSelections, lines: line });
                            setSelectedLine(line);
                            setScreen('colors');
                        }}
                        onBack={() => {
                            // Save that we came from 'colors' menu (index 1)
                            setMenuSelections({ ...menuSelections, main: 1 });
                            setScreen('main');
                        }}
                        initialSelection={menuSelections.lines}
                        title='Select Line to Edit Colors'
                        blockIfPowerlineActive={true}
                        settings={settings}
                        allowEditing={false}
                    />
                )}
                {screen === 'colors' && (
                    <ColorMenu
                        widgets={settings.lines[selectedLine] ?? []}
                        lineIndex={selectedLine}
                        settings={settings}
                        onUpdate={(updatedWidgets) => {
                            // Update only the selected line
                            const newLines = [...settings.lines];
                            newLines[selectedLine] = updatedWidgets;
                            setSettings({ ...settings, lines: newLines });
                        }}
                        onBack={() => {
                            // Go back to line selection for colors
                            setScreen('colorLines');
                        }}
                    />
                )}
                {screen === 'terminalConfig' && (
                    <TerminalOptionsMenu
                        settings={settings}
                        onUpdate={(updatedSettings) => {
                            setSettings(updatedSettings);
                        }}
                        onBack={(target?: string) => {
                            if (target === 'width') {
                                setScreen('terminalWidth');
                            } else {
                                // Save that we came from 'terminalConfig' menu (index 3)
                                setMenuSelections({ ...menuSelections, main: 3 });
                                setScreen('main');
                            }
                        }}
                    />
                )}
                {screen === 'terminalWidth' && (
                    <TerminalWidthMenu
                        settings={settings}
                        onUpdate={(updatedSettings) => {
                            setSettings(updatedSettings);
                        }}
                        onBack={() => {
                            setScreen('terminalConfig');
                        }}
                    />
                )}
                {screen === 'globalOverrides' && (
                    <GlobalOverridesMenu
                        settings={settings}
                        onUpdate={(updatedSettings) => {
                            setSettings(updatedSettings);
                        }}
                        onBack={() => {
                            // Save that we came from 'globalOverrides' menu (index 4)
                            setMenuSelections({ ...menuSelections, main: 4 });
                            setScreen('main');
                        }}
                    />
                )}
                {screen === 'confirm' && confirmDialog && (
                    <ConfirmDialog
                        message={confirmDialog.message}
                        onConfirm={() => void confirmDialog.action()}
                        onCancel={() => {
                            setScreen('main');
                            setConfirmDialog(null);
                        }}
                    />
                )}
                {screen === 'install' && installationStatus && (
                    <InstallMenu
                        bunxAvailable={isBunxAvailable()}
                        installationStatus={installationStatus}
                        claudeSettingsPaths={claudeSettingsPaths}
                        ccstatuslinePaths={scopePaths}
                        currentCcstatuslineScope={saveScope}
                        onInstall={options => void handleInstall(options)}
                        onCancel={() => {
                            setScreen('main');
                        }}
                    />
                )}
                {screen === 'uninstall' && installationStatus && (
                    <UninstallScopeSelector
                        installationStatus={installationStatus}
                        claudeSettingsPaths={claudeSettingsPaths}
                        onUninstall={scopes => void handleUninstall(scopes)}
                        onCancel={() => {
                            setScreen('main');
                        }}
                    />
                )}
                {screen === 'powerline' && (
                    <PowerlineSetup
                        settings={settings}
                        powerlineFontStatus={powerlineFontStatus}
                        onUpdate={(updatedSettings) => {
                            setSettings(updatedSettings);
                        }}
                        onBack={() => {
                            setScreen('main');
                        }}
                        onInstallFonts={() => {
                            setInstallingFonts(true);
                            // Add a small delay to allow React to render the "Installing..." message
                            // before the blocking execSync calls in installPowerlineFonts
                            setTimeout(() => {
                                void installPowerlineFonts().then((result) => {
                                    setInstallingFonts(false);
                                    setFontInstallMessage(result.message);
                                    // Refresh font status
                                    void checkPowerlineFontsAsync().then((asyncStatus) => {
                                        setPowerlineFontStatus(asyncStatus);
                                    });
                                });
                            }, 50);
                        }}
                        installingFonts={installingFonts}
                        fontInstallMessage={fontInstallMessage}
                        onClearMessage={() => { setFontInstallMessage(null); }}
                    />
                )}
                {screen === 'scopes' && settingsSources && (
                    <ManageScopesMenu
                        sources={settingsSources}
                        scopePaths={scopePaths}
                        saveScope={saveScope}
                        onSetSaveScope={setSaveScope}
                        onCreateScope={(scope) => {
                            void (async () => {
                                await createScopeSettings(scope, settings);
                                // Reload settings to update sources
                                const resolved = await loadScopedSettings({ includeSourceInfo: true });
                                setSettingsSources(resolved.sources);
                            })();
                        }}
                        onDeleteScope={(scope) => {
                            void (async () => {
                                await deleteScopeSettings(scope);
                                // Reload settings to update sources
                                const resolved = await loadScopedSettings({ includeSourceInfo: true });
                                setSettings(resolved.settings);
                                setSettingsSources(resolved.sources);
                                // Reset save scope if we deleted the current one
                                if (scope === saveScope) {
                                    setSaveScope('user');
                                }
                            })();
                        }}
                        onBack={() => {
                            setScreen('main');
                        }}
                    />
                )}
                {screen === 'scopeSave' && settingsSources && (
                    <ScopeSaveDialog
                        currentScope={saveScope}
                        sources={settingsSources}
                        scopePaths={scopePaths}
                        onSelect={(scope) => {
                            void (async () => {
                                await saveScopedSettings(settings, { scope });
                                setOriginalSettings(JSON.parse(JSON.stringify(settings)) as Settings);
                                setHasChanges(false);
                                setSaveMessage(`✓ Saved to ${scope}`);
                                setSaveScope(scope);
                                setScreen('main');
                            })();
                        }}
                        onCancel={() => {
                            setScreen('main');
                        }}
                    />
                )}
                {screen === 'customModules' && (
                    <CustomModulesMenu
                        settings={settings}
                        onUpdate={(updatedSettings) => {
                            setSettings(updatedSettings);
                        }}
                        onBack={() => {
                            setMenuSelections({ ...menuSelections, main: 6 });
                            setScreen('main');
                        }}
                        onEditModule={(module, isNew, kind) => {
                            setEditingModule(module);
                            setIsNewModule(isNew);
                            setModuleKind(kind);
                            setScreen('moduleEditor');
                        }}
                    />
                )}
                {screen === 'moduleEditor' && (
                    <ModuleEditor
                        settings={settings}
                        module={editingModule}
                        isNew={isNewModule}
                        kind={moduleKind}
                        onSave={(module) => {
                            const existingModules = settings.customModules;
                            let newModules: CustomModule[];
                            if (isNewModule) {
                                newModules = [...existingModules, module];
                            } else {
                                // Replace existing module
                                newModules = existingModules.map(m => m.name === editingModule?.name ? module : m
                                );
                            }
                            setSettings({ ...settings, customModules: newModules });
                            setEditingModule(null);
                            setScreen('customModules');
                        }}
                        onCancel={() => {
                            setEditingModule(null);
                            setScreen('customModules');
                        }}
                    />
                )}
            </Box>
        </Box>
    );
};

export function runTUI() {
    // Clear the terminal before starting the TUI
    process.stdout.write('\x1b[2J\x1b[H');
    render(<App />);
}