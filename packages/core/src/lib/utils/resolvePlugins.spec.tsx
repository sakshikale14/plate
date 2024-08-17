import type { SlateEditor } from '../editor';

import { createPlateEditor } from '../../react';
import { createReactPlugin } from '../../react/plugin/createReactPlugin';
import { getPlugin } from '../../react/plugin/getPlugin';
import { createPlugin } from '../plugin';
import { DebugPlugin } from '../plugins';
import { resolvePluginTest } from './resolveCreatePluginTest';
import {
  applyPluginOverrides,
  mergePlugins,
  resolveAndSortPlugins,
  resolvePlugins,
} from './resolvePlugins';

describe('resolvePlugins', () => {
  let editor: SlateEditor;

  beforeEach(() => {
    editor = createPlateEditor();
  });

  it('should initialize plugins with correct order based on priority', () => {
    const plugins = [
      createPlugin({ key: 'a', priority: 1 }),
      createPlugin({ key: 'b', priority: 3 }),
      createPlugin({ key: 'c', priority: 2 }),
    ];

    resolvePlugins(editor, plugins);

    expect(editor.pluginList.map((p) => p.key)).toEqual(['b', 'c', 'a']);
  });

  it('should handle nested plugins', () => {
    const plugins = [
      createPlugin({
        key: 'parent',
        plugins: [
          createPlugin({ key: 'child1' }),
          createPlugin({ key: 'child2' }),
        ],
      }),
    ];

    resolvePlugins(editor, plugins);

    expect(editor.pluginList.map((p) => p.key)).toContain('parent');
    expect(editor.pluginList.map((p) => p.key)).toContain('child1');
    expect(editor.pluginList.map((p) => p.key)).toContain('child2');
  });

  it('should not include disabled plugins', () => {
    const plugins = [
      createPlugin({ key: 'enabled' }),
      createPlugin({ enabled: false, key: 'disabled' }),
    ];

    resolvePlugins(editor, plugins);

    expect(editor.pluginList.map((p) => p.key)).toContain('enabled');
    expect(editor.pluginList.map((p) => p.key)).not.toContain('disabled');
  });

  it('should apply overrides correctly', () => {
    const plugins = [
      createPlugin({
        key: 'a',
        override: {
          plugins: {
            b: { type: 'overridden' },
          },
        },
        type: 'original',
      }),
      createPlugin({ key: 'b', type: 'original' }),
    ];

    resolvePlugins(editor, plugins);

    expect(editor.plugins.b.type).toBe('overridden');
  });

  it('should merge all plugin APIs into editor.api', () => {
    const editor = createPlateEditor({
      plugins: [
        createPlugin({
          api: { methodA: () => 'A' },
          key: 'plugin1',
        }),
        createPlugin({
          api: { methodB: () => 'B' },
          key: 'plugin2',
        }),
      ],
    });

    expect(editor.api.methodA).toBeDefined();
    expect(editor.api.methodB).toBeDefined();
    expect(editor.api.methodA()).toBe('A');
    expect(editor.api.methodB()).toBe('B');
  });

  it('should overwrite API methods with the same name', () => {
    const editor = createPlateEditor({
      plugins: [
        createPlugin<'plugin1'>({
          api: { method: (_: string) => 'first' },
          key: 'plugin1',
        }),
        createPlugin({
          api: { method: (_: number) => 'second' },
          key: 'plugin2',
        }),
      ],
    });

    expect(editor.api.method(1)).toBe('second');
  });
});

describe('resolveAndSortPlugins', () => {
  it('should resolve and sort plugins correctly', () => {
    const editor = createPlateEditor();
    const plugins = [
      createPlugin({ key: 'a', priority: 1 }),
      createPlugin({ key: 'b', priority: 3 }),
      createPlugin({ key: 'c', priority: 2 }),
    ];

    const result = resolveAndSortPlugins(editor, plugins);

    expect(result.map((p) => p.key)).toEqual(['b', 'c', 'a']);
  });

  it('should handle nested plugins', () => {
    const editor = createPlateEditor();
    const plugins = [
      createPlugin({
        key: 'parent',
        plugins: [
          createPlugin({ key: 'child1', priority: 2 }),
          createPlugin({ key: 'child2', priority: 1 }),
        ],
      }),
    ];

    const result = resolveAndSortPlugins(editor, plugins);

    expect(result.map((p) => p.key)).toEqual(['parent', 'child1', 'child2']);
  });

  it('should order plugins based on dependencies', () => {
    const editor = createPlateEditor();
    const plugins = [
      createPlugin({ key: 'a', priority: 1 }),
      createPlugin({ dependencies: ['c'], key: 'b', priority: 3 }),
      createPlugin({ key: 'c', priority: 2 }),
    ];

    const result = resolveAndSortPlugins(editor, plugins);

    expect(result.map((p) => p.key)).toEqual(['c', 'b', 'a']);
  });

  it('should handle multiple dependencies', () => {
    const editor = createPlateEditor();
    const plugins = [
      createPlugin({ dependencies: ['b', 'c'], key: 'a', priority: 3 }),
      createPlugin({ key: 'b', priority: 2 }),
      createPlugin({ key: 'c', priority: 1 }),
    ];

    const result = resolveAndSortPlugins(editor, plugins);

    expect(result.map((p) => p.key)).toEqual(['b', 'c', 'a']);
  });

  it('should handle nested dependencies', () => {
    const editor = createPlateEditor();
    const plugins = [
      createPlugin({ dependencies: ['b'], key: 'a', priority: 3 }),
      createPlugin({ dependencies: ['c'], key: 'b', priority: 2 }),
      createPlugin({ key: 'c', priority: 1 }),
    ];

    const result = resolveAndSortPlugins(editor, plugins);

    expect(result.map((p) => p.key)).toEqual(['c', 'b', 'a']);
  });

  it('should maintain priority order when no dependencies conflict', () => {
    const editor = createPlateEditor();
    const plugins = [
      createPlugin({ key: 'a', priority: 3 }),
      createPlugin({ dependencies: ['c'], key: 'b', priority: 2 }),
      createPlugin({ key: 'c', priority: 1 }),
    ];

    const result = resolveAndSortPlugins(editor, plugins);

    expect(result.map((p) => p.key)).toEqual(['a', 'c', 'b']);
  });

  it('should handle circular dependencies gracefully', () => {
    const editor = createPlateEditor();
    const plugins = [
      createPlugin({ dependencies: ['b'], key: 'a' }),
      createPlugin({ dependencies: ['a'], key: 'b' }),
    ];

    const result = resolveAndSortPlugins(editor, plugins);

    expect(result.map((p) => p.key)).toContain('a');
    expect(result.map((p) => p.key)).toContain('b');
    expect(result).toHaveLength(2);
  });

  it('should handle dependencies with nested plugins', () => {
    const editor = createPlateEditor();
    const plugins = [
      createPlugin({
        key: 'parent',
        plugins: [
          createPlugin({ dependencies: ['child2'], key: 'child1' }),
          createPlugin({ key: 'child2' }),
        ],
      }),
    ];

    const result = resolveAndSortPlugins(editor, plugins);

    const childIndices = result.map((p) => p.key).slice(1); // Exclude 'parent'
    expect(childIndices).toEqual(['child2', 'child1']);
  });
});

describe('mergePlugins', () => {
  it('should merge plugins correctly', () => {
    const editor = createPlateEditor();

    const plugins = [
      createPlugin({ key: 'a', type: 'typeA' }),
      createPlugin({ key: 'b', type: 'typeB' }),
    ];

    mergePlugins(editor, plugins);

    expect(editor.pluginList).toHaveLength(2);
    expect(editor.plugins.a.type).toBe('typeA');
    expect(editor.plugins.b.type).toBe('typeB');
  });

  it('should update existing plugins', () => {
    const editor = createPlateEditor({
      plugins: [createPlugin({ key: 'a', type: 'oldType' })],
    });

    const plugins = [createPlugin({ key: 'a', type: 'newType' })];

    mergePlugins(editor, plugins);

    expect(editor.pluginList).toHaveLength(1);
    expect(editor.plugins.a.type).toBe('newType');
  });
});

describe('applyPluginOverrides', () => {
  it('should apply overrides correctly', () => {
    const editor = createPlateEditor({
      plugins: [
        createPlugin({
          key: 'a',
          override: {
            plugins: {
              b: { type: 'overriddenB' },
            },
          },
          type: 'originalA',
        }),
        createPlugin({ key: 'b', type: 'originalB' }),
      ],
    });

    applyPluginOverrides(editor);

    expect(editor.plugins.a.type).toBe('originalA');
    expect(editor.plugins.b.type).toBe('overriddenB');
  });

  it('should handle nested overrides', () => {
    const editor = createPlateEditor() as SlateEditor;

    resolvePlugins(editor, [
      createPlugin({
        key: 'parent',
        override: {
          plugins: {
            child: { type: 'overriddenChild' },
          },
        },
        plugins: [createPlugin({ key: 'child', type: 'originalChild' })],
      }),
    ]);

    expect(editor.plugins.child.type).toBe('overriddenChild');
  });

  it('should apply multiple overrides in correct order', () => {
    const editor = createPlateEditor({
      plugins: [
        createPlugin({
          key: 'a',
          override: {
            plugins: {
              c: { type: 'overriddenByA' },
            },
          },
          type: 'originalA',
        }),
        createPlugin({
          key: 'b',
          override: {
            plugins: {
              c: { type: 'overriddenByB' },
            },
          },
          type: 'originalB',
        }),
        createPlugin({ key: 'c', type: 'originalC' }),
      ],
    });

    applyPluginOverrides(editor);

    expect(editor.plugins.c.type).toBe('overriddenByB');
  });

  it('should override components based on priority only if target plugin has a component', () => {
    const OriginalComponent = () => null;
    const OverrideComponent = () => null;
    const HighPriorityComponent = () => null;
    const PreservedOriginalComponent = () => null;

    const editor = createPlateEditor({
      plugins: [
        createReactPlugin({
          key: 'a',
          override: {
            components: {
              b: OverrideComponent,
              c: OverrideComponent,
              d: OverrideComponent,
              e: OverrideComponent,
            },
          },
          priority: 2,
        }),
        createReactPlugin({
          component: OriginalComponent,
          key: 'b',
          priority: 3,
        }),
        createPlugin({
          key: 'c',
          priority: 1,
        }),
        createReactPlugin({
          component: OriginalComponent,
          key: 'd',
          priority: 1,
        }),
        createReactPlugin({
          key: 'e',
          override: {
            components: {
              b: HighPriorityComponent,
              d: HighPriorityComponent,
            },
          },
          priority: 4,
        }),
        createReactPlugin({
          component: PreservedOriginalComponent,
          key: 'f',
          priority: 5,
        }),
      ],
    });

    applyPluginOverrides(editor);

    // Higher priority override
    expect(getPlugin(editor, { key: 'b' }).component).toBe(
      HighPriorityComponent
    );

    // No initial component, so it gets set
    expect(getPlugin(editor, { key: 'c' }).component).toBe(OverrideComponent);

    // Lower priority component gets overridden
    expect(getPlugin(editor, { key: 'd' }).component).toBe(
      HighPriorityComponent
    );

    // Highest priority original component is preserved
    expect(getPlugin(editor, { key: 'f' }).component).toBe(
      PreservedOriginalComponent
    );
  });

  describe('targetPlugins', () => {
    it('should correctly apply targetPluginToInject and merge with existing plugins', () => {
      const plugin = createPlugin({
        inject: {
          plugins: {
            plugin1: {
              deserializeHtml: {
                getNode: () => {},
              },
            },
            plugin3: {
              deserializeHtml: {
                getNode: () => {},
              },
            },
          },
          targetPluginToInject: ({ targetPlugin }) => ({
            deserializeHtml: {
              getNode: () => {},
            },
          }),
          targetPlugins: ['plugin1', 'plugin2'],
        },
        key: 'testPlugin',
      });

      const resolvedPlugin = resolvePluginTest(plugin);

      expect(resolvedPlugin.inject?.plugins).toBeDefined();
      expect(Object.keys(resolvedPlugin.inject!.plugins!)).toEqual([
        'plugin1',
        'plugin3',
        'plugin2',
      ]);

      // Check merged result for plugin1
      expect(resolvedPlugin.inject!.plugins!.plugin1).toHaveProperty(
        'deserializeHtml.getNode'
      );
      expect(
        resolvedPlugin.inject!.plugins!.plugin1.deserializeHtml!.getNode
      ).toBeDefined();

      // Check injected result for plugin2
      expect(resolvedPlugin.inject!.plugins!.plugin2).toHaveProperty(
        'deserializeHtml.getNode'
      );
      expect(
        resolvedPlugin.inject!.plugins!.plugin2.deserializeHtml!.getNode
      ).toBeDefined();

      // Check existing result for plugin3 is preserved
      expect(resolvedPlugin.inject!.plugins!.plugin3).toHaveProperty(
        'deserializeHtml.getNode'
      );
      expect(
        resolvedPlugin.inject!.plugins!.plugin3.deserializeHtml!.getNode
      ).toBeDefined();
    });
  });

  it('should replace plugins with the same key and merge their APIs', () => {
    const originalLogger = jest.fn();
    const replacementLogger = jest.fn();

    const editor = createPlateEditor({
      plugins: [
        createPlugin({
          api: { method: originalLogger },
          key: 'a',
        }),
        // This should replace the previous plugin
        createPlugin({
          api: { method: replacementLogger },
          key: 'a',
        }),
      ],
    });

    editor.api.method({
      level: 'debug',
      message: 'Test message',
      type: 'TEST',
    });

    expect(originalLogger).not.toHaveBeenCalled();
    expect(replacementLogger).toHaveBeenCalledWith({
      level: 'debug',
      message: 'Test message',
      type: 'TEST',
    });
  });

  it('should allow overriding core plugins like DebugPlugin', () => {
    const customLogger = jest.fn();

    const editor = createPlateEditor({
      plugins: [
        DebugPlugin.configure({
          options: {
            logger: { log: customLogger },
          },
        }),
      ],
    });

    editor.api.debug.log('Test message', 'TEST');

    expect(customLogger).toHaveBeenCalledWith(
      'Test message',
      'TEST',
      undefined
    );
  });

  it('should not include plugins disabled through overrides.enabled', () => {
    const editor = createPlateEditor({
      override: {
        enabled: {
          b: false,
        },
      },
      plugins: [
        createPlugin({
          key: 'a',
        }),
        createPlugin({ key: 'b' }),
        createPlugin({ key: 'c' }),
      ],
    });

    applyPluginOverrides(editor);

    expect(editor.plugins).toHaveProperty('a');
    expect(editor.plugins).not.toHaveProperty('b');
    expect(editor.plugins).toHaveProperty('c');
  });

  it('should not include plugins disabled through overrides.plugins', () => {
    const editor = createPlateEditor({
      override: {
        plugins: {
          b: {
            enabled: false,
          },
        },
      },
      plugins: [
        createPlugin({
          key: 'a',
        }),
        createPlugin({ key: 'b' }),
        createPlugin({ key: 'c' }),
      ],
    });

    applyPluginOverrides(editor);

    expect(editor.plugins).toHaveProperty('a');
    expect(editor.plugins).not.toHaveProperty('b');
    expect(editor.plugins).toHaveProperty('c');
  });
});
