/** @jsx jsx */

import { PlateEditor, TPlateEditor } from '@udecode/plate-core';
import { jsx } from '@udecode/plate-test-utils';

jsx;

export const input = ((
  <editor>
    <hp>
      test
      <cursor />
    </hp>
  </editor>
) as any) as PlateEditor;

export const output = (
  <editor>
    <hh1>
      test
      <cursor />
    </hh1>
  </editor>
) as any;
