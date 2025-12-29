/**
 * Widget implementations for custom modules.
 * These wrap module definitions and render them as widgets.
 * Modules are configured in settings.customModules, not inline in widgets.
 */

import { execSync } from 'child_process';

import type {
    CustomCommandModule,
    CustomTextModule
} from '../types/CustomModule';
import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';

/**
 * Widget implementation for text-based custom modules.
 * Simply renders the module's configured text.
 */
export class ModuleTextWidget implements Widget {
    constructor(private module: CustomTextModule) {}

    getDefaultColor(): string {
        return this.module.color ?? 'white';
    }

    getDescription(): string {
        return this.module.description ?? `Custom text module: ${this.module.name}`;
    }

    getDisplayName(): string {
        return `Module: ${this.module.name}`;
    }

    getEditorDisplay(_item: WidgetItem): WidgetEditorDisplay {
        const text = this.module.text.length > 15
            ? `${this.module.text.slice(0, 12)}...`
            : this.module.text;
        return { displayText: `${this.module.name} (${text})` };
    }

    render(_item: WidgetItem, _context: RenderContext, _settings: Settings): string | null {
        return this.module.text || null;
    }

    supportsRawValue(): boolean {
        return false;
    }

    supportsColors(_item: WidgetItem): boolean {
        return true;
    }
}

/**
 * Widget implementation for command-based custom modules.
 * Executes the module's configured command and renders the output.
 * Reuses command execution logic from CustomCommandWidget.
 */
export class ModuleCommandWidget implements Widget {
    constructor(private module: CustomCommandModule) {}

    getDefaultColor(): string {
        return this.module.color ?? 'white';
    }

    getDescription(): string {
        return this.module.description ?? `Custom command module: ${this.module.name}`;
    }

    getDisplayName(): string {
        return `Module: ${this.module.name}`;
    }

    getEditorDisplay(_item: WidgetItem): WidgetEditorDisplay {
        const cmd = this.module.command.length > 15
            ? `${this.module.command.slice(0, 12)}...`
            : this.module.command;

        // Build modifiers string
        const modifiers: string[] = [];
        if (this.module.maxWidth) {
            modifiers.push(`max:${this.module.maxWidth}`);
        }
        if (this.module.timeout && this.module.timeout !== 1000) {
            modifiers.push(`timeout:${this.module.timeout}ms`);
        }
        if (this.module.preserveColors) {
            modifiers.push('preserve');
        }

        return {
            displayText: `${this.module.name} (${cmd})`,
            modifierText: modifiers.length > 0 ? `(${modifiers.join(', ')})` : undefined
        };
    }

    render(_item: WidgetItem, context: RenderContext, _settings: Settings): string | null {
        if (context.isPreview) {
            const cmdPreview = this.module.command.substring(0, 20);
            const ellipsis = this.module.command.length > 20 ? '...' : '';
            return `[${this.module.name}: ${cmdPreview}${ellipsis}]`;
        }

        if (!context.data) {
            return null;
        }

        try {
            const timeout = this.module.timeout ?? 1000;
            const jsonInput = JSON.stringify(context.data);
            let output = execSync(this.module.command, {
                encoding: 'utf8',
                input: jsonInput,
                timeout: timeout,
                stdio: ['pipe', 'pipe', 'ignore'],
                env: process.env
            }).trim();

            // Strip ANSI codes if preserveColors is false
            if (!this.module.preserveColors) {
                output = output.replace(/\x1b\[[0-9;]*m/g, '');
            }

            // Apply maxWidth truncation
            if (this.module.maxWidth && output.length > this.module.maxWidth) {
                output = output.substring(0, this.module.maxWidth - 3) + '...';
            }

            return output || null;
        } catch (error) {
            // Provide specific error messages based on error type
            if (error instanceof Error) {
                const execError = error as Error & {
                    code?: string;
                    signal?: string;
                    status?: number;
                };
                if (execError.code === 'ENOENT') {
                    return '[Cmd not found]';
                } else if (execError.code === 'ETIMEDOUT') {
                    return '[Timeout]';
                } else if (execError.code === 'EACCES') {
                    return '[Permission denied]';
                } else if (execError.signal) {
                    return `[Signal: ${execError.signal}]`;
                } else if (execError.status !== undefined) {
                    return `[Exit: ${execError.status}]`;
                }
            }
            return '[Error]';
        }
    }

    supportsRawValue(): boolean {
        return false;
    }

    supportsColors(_item: WidgetItem): boolean {
        // Only supports colors if preserveColors is false
        return !this.module.preserveColors;
    }
}