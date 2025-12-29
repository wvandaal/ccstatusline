import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi
} from 'vitest';

import {
    deepMerge,
    getAllScopePaths,
    getProjectSettingsDir,
    getSettingsPathForScope,
    getUserSettingsDir
} from '../scoped-config';

// Mock execSync for git root detection
vi.mock('child_process', () => ({ execSync: vi.fn() }));

// Mock claude-settings for getClaudeConfigDir
vi.mock('../claude-settings', () => ({ getClaudeConfigDir: vi.fn(() => '/home/user/.claude') }));

describe('scoped-config', () => {
    describe('getUserSettingsDir', () => {
        it('should return ~/.claude/statusline by default', () => {
            const dir = getUserSettingsDir();
            expect(dir).toBe('/home/user/.claude/statusline');
        });
    });

    describe('getProjectRoot', () => {
        beforeEach(() => {
            vi.resetModules();
        });

        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('should return cwd when not in a git repo', async () => {
            const { execSync } = await import('child_process');
            vi.mocked(execSync).mockImplementation(() => {
                throw new Error('Not a git repo');
            });

            // Re-import to get fresh instance
            const { getProjectRoot: freshGetProjectRoot } = await import('../scoped-config');
            const root = freshGetProjectRoot();
            expect(root).toBe(process.cwd());
        });
    });

    describe('getProjectSettingsDir', () => {
        it('should return project_root/.claude/statusline', () => {
            const dir = getProjectSettingsDir();
            // Will use cwd since execSync might fail
            expect(dir).toContain('.claude/statusline');
        });
    });

    describe('getSettingsPathForScope', () => {
        it('should return correct path for user scope', () => {
            const path = getSettingsPathForScope('user');
            expect(path).toBe('/home/user/.claude/statusline/settings.json');
        });

        it('should return correct path for project scope', () => {
            const path = getSettingsPathForScope('project');
            expect(path).toContain('.claude/statusline/settings.json');
            expect(path).not.toContain('settings.local.json');
        });

        it('should return correct path for local scope', () => {
            const path = getSettingsPathForScope('local');
            expect(path).toContain('.claude/statusline/settings.local.json');
        });
    });

    describe('getAllScopePaths', () => {
        it('should return paths for all scopes', () => {
            const paths = getAllScopePaths();
            expect(paths).toHaveProperty('user');
            expect(paths).toHaveProperty('project');
            expect(paths).toHaveProperty('local');
        });
    });

    describe('deepMerge', () => {
        it('should merge objects recursively', () => {
            type TestType = Record<string, unknown>;
            const base: TestType = { a: 1, nested: { x: 1, y: 2 } };
            const override: TestType = { b: 2, nested: { y: 3 } };
            const result = deepMerge(base, override);

            expect(result).toEqual({
                a: 1,
                b: 2,
                nested: { x: 1, y: 3 }
            });
        });

        it('should replace arrays entirely', () => {
            type TestType = Record<string, unknown>;
            const base: TestType = { lines: [['a', 'b']] };
            const override: TestType = { lines: [['c']] };
            const result = deepMerge(base, override);

            expect(result.lines).toEqual([['c']]);
        });

        it('should replace primitives', () => {
            type TestType = Record<string, unknown>;
            const base: TestType = { color: 'red', count: 5 };
            const override: TestType = { color: 'blue' };
            const result = deepMerge(base, override);

            expect(result).toEqual({ color: 'blue', count: 5 });
        });

        it('should handle undefined sources', () => {
            type TestType = Record<string, unknown>;
            const base: TestType = { a: 1 };
            const override: TestType = { b: 2 };
            const result = deepMerge(base, undefined, override);

            expect(result).toEqual({ a: 1, b: 2 });
        });

        it('should handle empty sources', () => {
            type TestType = Record<string, unknown>;
            const base: TestType = { a: 1 };
            const result = deepMerge(base, {});

            expect(result).toEqual({ a: 1 });
        });

        it('should merge multiple sources with correct precedence', () => {
            type TestType = Record<string, unknown>;
            const base: TestType = { a: 1, b: 1, c: 1 };
            const override1: TestType = { b: 2 };
            const override2: TestType = { c: 3 };
            const result = deepMerge(base, override1, override2);

            expect(result).toEqual({ a: 1, b: 2, c: 3 });
        });

        it('should handle nested arrays in objects', () => {
            type TestType = Record<string, unknown>;
            const base: TestType = {
                config: {
                    items: [1, 2, 3],
                    enabled: true
                }
            };
            const override: TestType = { config: { items: [4, 5] } };
            const result = deepMerge(base, override);

            expect(result).toEqual({
                config: {
                    items: [4, 5],
                    enabled: true
                }
            });
        });
    });
});