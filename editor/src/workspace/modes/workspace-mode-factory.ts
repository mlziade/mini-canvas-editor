import { EditorState } from '../../editor-state';
import { WorkspaceMode } from './workspace-mode';
import { SelectWorkspaceMode } from './select-workspace-mode';
import { RectWorkspaceMode } from './rect-workspace-mode';
import { TextboxWorkspaceMode } from './textbox-workspace-mode';
import { BrushWorkspaceMode } from './brush-workspace-mode';
import { EraserWorkspaceMode } from './eraser-workspace-mode';
import { CloneWorkspaceMode } from './clone-workspace-mode';
import { BlurWorkspaceMode, GradientWorkspaceMode } from './paint-modes';
import { ArrowWorkspaceMode, ShapeWorkspaceMode } from './shape-modes';
import { MagicWandWorkspaceMode, QuickSelectWorkspaceMode } from './selection-modes';
import { EditorMode } from '../../editor-configuration';

export class WorkspaceModeFactory {
	public static get(mode: EditorMode, state: EditorState): WorkspaceMode {
		switch (mode) {
			case EditorMode.select:
				return new SelectWorkspaceMode(state);
			case EditorMode.rect:
				return new RectWorkspaceMode(state);
			case EditorMode.brush:
				return new BrushWorkspaceMode(state);
			case EditorMode.textbox:
				return new TextboxWorkspaceMode(state);
			case EditorMode.arrow:
				return new ArrowWorkspaceMode(state);
			case EditorMode.shape:
				return new ShapeWorkspaceMode(state);
			case EditorMode.eraser:
				return new EraserWorkspaceMode(state);
			case EditorMode.clone:
				return new CloneWorkspaceMode(state);
			case EditorMode.blur:
				return new BlurWorkspaceMode(state);
			case EditorMode.magicWand:
				return new MagicWandWorkspaceMode(state);
			case EditorMode.quickSelect:
				return new QuickSelectWorkspaceMode(state);
			case EditorMode.gradient:
				return new GradientWorkspaceMode(state);
		}
	}
}
