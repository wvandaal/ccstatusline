/**
 * Custom Module type definitions for reusable custom text and command widgets.
 * Modules are defined once in settings.customModules and referenced by name
 * using the 'module:name' type format in WidgetItems.
 */

import { z } from 'zod';

/**
 * Base schema for all custom modules.
 * Name must be lowercase alphanumeric with hyphens only.
 */
const CustomModuleBaseSchema = z.object({
    /** Unique identifier, used as 'module:{name}' in widget type */
    name: z.string()
        .min(1, 'Module name is required')
        .max(32, 'Module name must be 32 characters or less')
        .regex(/^[a-z0-9-]+$/, 'Module name must be lowercase alphanumeric with hyphens only'),
    /** Optional description shown in TUI */
    description: z.string().optional(),
    /** Optional default color for this module */
    color: z.string().optional()
});

/**
 * Custom text module - displays static text.
 */
export const CustomTextModuleSchema = CustomModuleBaseSchema.extend({
    kind: z.literal('text'),
    /** The text content to display */
    text: z.string().min(1, 'Text content is required')
});

/**
 * Custom command module - executes a shell command and displays output.
 */
export const CustomCommandModuleSchema = CustomModuleBaseSchema.extend({
    kind: z.literal('command'),
    /** Shell command to execute */
    command: z.string().min(1, 'Command is required'),
    /** Maximum output width (truncates with ...) */
    maxWidth: z.number().positive().optional(),
    /** Command timeout in milliseconds (default 1000) */
    timeout: z.number().positive().optional(),
    /** Whether to preserve ANSI color codes from command output */
    preserveColors: z.boolean().optional()
});

/**
 * Union of all custom module types.
 * Uses discriminated union on 'kind' field for type narrowing.
 */
export const CustomModuleSchema = z.discriminatedUnion('kind', [
    CustomTextModuleSchema,
    CustomCommandModuleSchema
]);

// Type exports
export type CustomTextModule = z.infer<typeof CustomTextModuleSchema>;
export type CustomCommandModule = z.infer<typeof CustomCommandModuleSchema>;
export type CustomModule = z.infer<typeof CustomModuleSchema>;

/**
 * Type guard for text modules
 */
export function isTextModule(module: CustomModule): module is CustomTextModule {
    return module.kind === 'text';
}

/**
 * Type guard for command modules
 */
export function isCommandModule(module: CustomModule): module is CustomCommandModule {
    return module.kind === 'command';
}