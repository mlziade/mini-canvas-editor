import type { EditorState } from '../../editor-state';
import { RasterBrushMode } from './raster-brush-mode';

export class EraserWorkspaceMode extends RasterBrushMode {
	public constructor(state: EditorState) {
		super(state, {
			kind: 'erase',
			getOptions: () => ({ ...state.eraser })
		});
	}
}
