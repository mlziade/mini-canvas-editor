import { EditorConfiguration, EditorMode } from './editor-configuration';
import { EditorState } from './editor-state';
import { SelectionActions } from './raster/selection-actions';
import { SHORTCUT_KEYS } from './toolbox/toolbox';

const MODE_BY_KEY = new Map<string, EditorMode>(Object.entries(SHORTCUT_KEYS).map(([mode, key]) => [(key as string).toLowerCase(), mode as EditorMode]));

const SELECTION_MODES = [EditorMode.magicWand, EditorMode.quickSelect];

function isTypingTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) {
		return false;
	}
	const tag = target.tagName;
	if (tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
		return true;
	}
	if (tag === 'INPUT') {
		// Sliders, checkboxes and color pickers do not take text, so shortcuts keep working with them.
		const type = (target as HTMLInputElement).type;
		return !['range', 'checkbox', 'color', 'button'].includes(type);
	}
	return false;
}

/**
 * Keyboard shortcuts: tool keys, undo and redo, delete, escape and brush size.
 */
export class KeyboardController {
	public static create(state: EditorState, root: HTMLElement, configuration: EditorConfiguration): KeyboardController {
		const controller = new KeyboardController(state, root, configuration);
		window.addEventListener('keydown', controller.onKeyDown, true);
		return controller;
	}

	private readonly actions: SelectionActions;

	private constructor(
		private readonly state: EditorState,
		private readonly root: HTMLElement,
		private readonly configuration: EditorConfiguration
	) {
		this.actions = new SelectionActions(state);
	}

	public destroy() {
		window.removeEventListener('keydown', this.onKeyDown, true);
	}

	private isModeEnabled(mode: EditorMode): boolean {
		if (mode === EditorMode.select) {
			return true;
		}
		return (this.configuration as Record<string, unknown>)[mode] !== false;
	}

	private consume(e: KeyboardEvent) {
		e.preventDefault();
		e.stopPropagation();
		e.stopImmediatePropagation();
	}

	private readonly onKeyDown = (e: KeyboardEvent) => {
		if (!this.root.isConnected || this.root.offsetParent === null || e.defaultPrevented || isTypingTarget(e.target)) {
			return;
		}
		const active = this.state.canvas.getActiveObject() as { isEditing?: boolean } | undefined;
		if (active?.isEditing) {
			return;
		}

		const key = e.key.toLowerCase();
		if (e.ctrlKey || e.metaKey) {
			if (key === 'z') {
				this.consume(e);
				if (e.shiftKey) {
					this.state.history.redo();
				} else {
					this.state.history.undo();
				}
			} else if (key === 'y') {
				this.consume(e);
				this.state.history.redo();
			} else if (key === 'd' && this.state.getSelection()) {
				this.consume(e);
				this.actions.deselect();
			}
			return;
		}
		if (e.altKey) {
			return;
		}

		if (key === 'delete' || key === 'backspace') {
			if (this.deleteSelectionOrObjects()) {
				this.consume(e);
			}
			return;
		}
		if (key === 'escape') {
			if (this.state.getSelection()) {
				this.consume(e);
				this.actions.deselect();
			}
			return;
		}
		if (key === '[' || key === ']') {
			if (this.resizeBrush(key === ']' ? 1.25 : 0.8)) {
				this.consume(e);
			}
			return;
		}

		const mode = MODE_BY_KEY.get(key);
		if (mode && this.isModeEnabled(mode)) {
			this.consume(e);
			if (this.state.mode !== mode) {
				this.state.setMode(mode);
			}
		}
	};

	private deleteSelectionOrObjects(): boolean {
		if (SELECTION_MODES.includes(this.state.mode) && this.state.getSelection()) {
			return this.actions.deletePixels();
		}
		const objects = this.state.canvas.getActiveObjects();
		if (objects.length === 0) {
			return false;
		}
		this.state.history.transaction(() => {
			this.state.canvas.discardActiveObject();
			this.state.canvas.remove(...objects);
		});
		return true;
	}

	private resizeBrush(factor: number): boolean {
		const state = this.state;
		const clamp = (value: number) => Math.min(300, Math.max(1, Math.round(value * factor)));
		switch (state.mode) {
			case EditorMode.brush:
				state.brush.brushSize = clamp(state.brush.brushSize);
				state.onBrushConfigurationChanged.forward();
				break;
			case EditorMode.eraser:
				state.eraser.size = clamp(state.eraser.size);
				break;
			case EditorMode.clone:
				state.clone.size = clamp(state.clone.size);
				break;
			case EditorMode.blur:
				state.blur.size = clamp(state.blur.size);
				break;
			case EditorMode.quickSelect:
				state.quickSelect.size = clamp(state.quickSelect.size);
				break;
			default:
				return false;
		}
		state.onToolOptionsChanged.forward();
		return true;
	}
}
