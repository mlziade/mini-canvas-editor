import { EditorState } from '../../editor-state';
import { EditorMode } from '../../editor-configuration';
import { DestroyableComponent } from '../../components/component';
import { RectToolbarMode } from './rect-toolbar-mode';
import { BrushToolbarMode } from './brush-toolbar-mode';
import { OptionsToolbarMode } from './options-toolbar-mode';
import { createToolSpecs } from './tool-toolbars';

export class ToolbarModeFactory {
	public static create(mode: EditorMode, state: EditorState): DestroyableComponent | null {
		switch (mode) {
			case EditorMode.rect:
				return RectToolbarMode.create(state);
			case EditorMode.brush:
				return BrushToolbarMode.create(state);
		}
		const specs = createToolSpecs(mode, state);
		return specs ? OptionsToolbarMode.create(state, specs) : null;
	}
}
