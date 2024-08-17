import {
  type TEditor,
  type TSelection,
  type Value,
  createTEditor,
  getEndPoint,
  getStartPoint,
  normalizeEditor,
  select,
} from '@udecode/slate';

import type { AnyPluginConfig } from '../plugin/BasePlugin';
import type { AnySlatePlugin } from '../plugin/SlatePlugin';
import type { InferPlugins, TSlateEditor } from './SlateEditor';

import {
  type CorePlugin,
  type SlateEditor,
  getPlugin,
  pipeNormalizeInitialValue,
  resolvePlugins,
} from '../index';
import { createPlugin } from '../plugin/createPlugin';
import { getCorePlugins } from '../plugins/getCorePlugins';

export type BaseWithSlateOptions<
  V extends Value = Value,
  P extends AnyPluginConfig = CorePlugin,
> = {
  /**
   * Select the editor after initialization.
   *
   * @default false
   *
   * - `true` | 'end': Select the end of the editor
   * - `false`: Do not select anything
   * - `'start'`: Select the start of the editor
   */
  autoSelect?: 'end' | 'start' | boolean;

  id?: any;

  /** Specifies the maximum number of characters allowed in the editor. */
  maxLength?: number;

  plugins?: P[];

  selection?: TSelection;

  /**
   * When `true`, it will normalize the initial `value` passed to the `editor`.
   * This is useful when adding normalization rules on already existing
   * content.
   *
   * @default false
   */
  shouldNormalizeEditor?: boolean;

  value?: V;
};

export type WithSlateOptions<
  V extends Value = Value,
  P extends AnyPluginConfig = CorePlugin,
> = {
  /** Function to configure the root plugin */
  rootPlugin?: (plugin: AnySlatePlugin) => AnySlatePlugin;
} & BaseWithSlateOptions<V, P> &
  Pick<
    Partial<AnySlatePlugin>,
    | 'api'
    | 'decorate'
    | 'inject'
    | 'normalizeInitialValue'
    | 'options'
    | 'override'
    | 'transforms'
    | 'withOverrides'
  >;

/**
 * Applies Plate enhancements to an editor instance (non-React version).
 *
 * @remarks
 *   This function supports server-side usage as it doesn't include the
 *   ReactPlugin.
 * @see {@link createSlateEditor} for a higher-level non-React editor creation function.
 * @see {@link createPlateEditor} for a higher-level React editor creation function.
 * @see {@link usePlateEditor} for a React memoized version.
 * @see {@link withPlate} for the React-specific enhancement function.
 */
export const withSlate = <
  V extends Value = Value,
  P extends AnyPluginConfig = CorePlugin,
>(
  e: TEditor,
  {
    autoSelect,
    id,
    maxLength,
    plugins = [],
    rootPlugin,
    selection,
    shouldNormalizeEditor,
    value,
    ...pluginConfig
  }: WithSlateOptions<V, P> = {}
): TSlateEditor<V, InferPlugins<P[]>> => {
  const editor = e as SlateEditor;

  // Override incremental id generated by slate
  editor.id = id ?? editor.id;
  editor.key = editor.key ?? Math.random();
  editor.isFallback = false;

  editor.getApi = () => editor.api as any;
  editor.getPlugin = (plugin) => getPlugin(editor, plugin) as any;
  editor.getOptions = (plugin) => editor.getPlugin(plugin).options;
  editor.getType = (plugin) => editor.getPlugin(plugin).type;
  editor.getInjectProps = (plugin) =>
    editor.getPlugin(plugin).inject?.props ?? ({} as any);

  const corePlugins = getCorePlugins({
    maxLength,
    plugins,
  });

  let rootPluginInstance = createPlugin({
    key: 'root',
    priority: 10_000,
    ...pluginConfig,
    plugins: [...corePlugins, ...plugins],
  });

  // Apply rootPlugin configuration if provided
  if (rootPlugin) {
    rootPluginInstance = rootPlugin(rootPluginInstance) as any;
  }

  resolvePlugins(editor, [rootPluginInstance]);

  if (value) {
    editor.children = value;
  }
  if (editor.children?.length === 0) {
    editor.children = editor.api.childrenFactory();
  }
  if (selection) {
    editor.selection = selection;
  } else if (autoSelect) {
    const edge = autoSelect === 'start' ? 'start' : 'end';
    const target =
      edge === 'start' ? getStartPoint(editor, []) : getEndPoint(editor, []);
    select(editor, target);
  }
  if (value) {
    pipeNormalizeInitialValue(editor);
  }
  if (shouldNormalizeEditor) {
    normalizeEditor(editor, { force: true });
  }

  return editor as any;
};

export type CreateSlateEditorOptions<
  V extends Value = Value,
  P extends AnyPluginConfig = CorePlugin,
> = {
  /**
   * Initial editor to be extended with `withPlate`.
   *
   * @default createEditor()
   */
  editor?: TEditor;
} & WithSlateOptions<V, P>;

/**
 * Creates a Slate editor without React-specific enhancements.
 *
 * @see {@link createPlateEditor} for a React-specific version of editor creation.
 * @see {@link usePlateEditor} for a memoized React version.
 * @see {@link withSlate} for the underlying function that applies Slate enhancements to an editor.
 */
export const createSlateEditor = <
  V extends Value = Value,
  P extends AnyPluginConfig = CorePlugin,
>({
  editor = createTEditor(),
  ...options
}: CreateSlateEditorOptions<V, P> = {}) => {
  return withSlate<V, P>(editor, options);
};
