import { Component } from '../components/component';
import { Html } from '../core/html';
import { Icons } from '../core/icons';
import { EditorState } from '../editor-state';
import { ToolboxItem } from './toolbox-item';
import { ToolboxZoom } from './toolbox-zoom';
import { openImageAction } from './actions/open-image-action';
import { EditorConfiguration, EditorMode } from '../editor-configuration';

export const SHORTCUT_KEYS: Partial<Record<EditorMode, string>> = {
	[EditorMode.select]: 'V',
	[EditorMode.rect]: 'R',
	[EditorMode.shape]: 'U',
	[EditorMode.arrow]: 'A',
	[EditorMode.textbox]: 'T',
	[EditorMode.brush]: 'B',
	[EditorMode.eraser]: 'E',
	[EditorMode.clone]: 'S',
	[EditorMode.blur]: 'O',
	[EditorMode.magicWand]: 'W',
	[EditorMode.quickSelect]: 'Q',
	[EditorMode.gradient]: 'G'
};

function withHint(title: string, mode: EditorMode, shortcuts: boolean): string {
	const hint = SHORTCUT_KEYS[mode];
	return shortcuts && hint ? `${title} (${hint})` : title;
}

export class Toolbox implements Component {
	public static create(state: EditorState, configuration: EditorConfiguration) {
		const view = Html.div({
			class: 'mce-toolbox'
		});
		const top = Html.div({
			class: 'mce-toolbox-top'
		});
		const bottom = Html.div({
			class: 'mce-toolbox-bottom'
		});
		view.appendChild(top);
		view.appendChild(bottom);

		const hints = configuration.shortcuts !== false;
		const item = (enabled: boolean, icon: Parameters<typeof ToolboxItem.create>[0], title: string, mode: EditorMode) =>
			enabled && ToolboxItem.create(icon, withHint(title, mode, hints), mode);

		let imageItem: ToolboxItem | null = null;
		const groups: (ToolboxItem | false)[][] = [
			[
				ToolboxItem.create(Icons.cursor, withHint('Select', EditorMode.select, hints), EditorMode.select),
				item(configuration.quickSelect !== false, Icons.quickSelect, 'Quick selection', EditorMode.quickSelect),
				item(configuration.magicWand !== false, Icons.wand, 'Magic wand', EditorMode.magicWand)
			],
			[
				item(configuration.rect !== false, Icons.rect, 'Rect', EditorMode.rect),
				item(configuration.shape !== false, Icons.shapes, 'Shapes', EditorMode.shape),
				item(configuration.arrow !== false, Icons.arrow, 'Arrow', EditorMode.arrow),
				item(configuration.textbox !== false, Icons.text, 'Textbox', EditorMode.textbox),
				item(configuration.gradient !== false, Icons.gradient, 'Gradient', EditorMode.gradient)
			],
			[
				item(configuration.brush !== false, Icons.brush, 'Brush', EditorMode.brush),
				item(configuration.eraser !== false, Icons.erase, 'Eraser', EditorMode.eraser),
				item(configuration.clone !== false, Icons.clone, 'Clone stamp', EditorMode.clone),
				item(configuration.blur !== false, Icons.blur, 'Blur and pixelate', EditorMode.blur)
			],
			[configuration.image !== false && (imageItem = ToolboxItem.create(Icons.image, 'Image', null))]
		];

		const items: ToolboxItem[] = [];
		const toolbox = new Toolbox(view, state, items);
		groups.forEach(group => {
			const present = group.filter(Boolean) as ToolboxItem[];
			if (present.length === 0) {
				return;
			}
			if (items.length > 0) {
				top.appendChild(Html.div({ class: 'mce-toolbox-separator' }));
			}
			for (const toolboxItem of present) {
				items.push(toolboxItem);
				top.appendChild(toolboxItem.view);
				if (toolboxItem.mode) {
					toolboxItem.onClicked.subscribe(toolbox.onItemClicked);
				}
			}
		});

		if (imageItem) {
			imageItem.onClicked.subscribe(toolbox.onOpenImageClicked);
		}

		if (configuration.history !== false) {
			const undo = ToolboxItem.create(Icons.undo, hints ? 'Undo (Ctrl+Z)' : 'Undo', null);
			const redo = ToolboxItem.create(Icons.redo, hints ? 'Redo (Ctrl+Shift+Z)' : 'Redo', null);
			undo.onClicked.subscribe(() => state.history.undo());
			redo.onClicked.subscribe(() => state.history.redo());
			bottom.appendChild(undo.view);
			bottom.appendChild(redo.view);
			const refresh = () => {
				undo.setIsDisabled(!state.history.canUndo());
				redo.setIsDisabled(!state.history.canRedo());
			};
			state.history.onChanged.subscribe(refresh);
			refresh();
		}

		const zoom = ToolboxZoom.create(state);
		bottom.appendChild(zoom.view);

		toolbox.reloadSelection();
		state.onModeChanged.subscribe(toolbox.reloadSelection);
		return toolbox;
	}

	private constructor(
		public readonly view: HTMLElement,
		private readonly state: EditorState,
		private readonly items: ToolboxItem[]
	) {}

	private readonly onItemClicked = (item: ToolboxItem) => {
		if (item.mode) {
			this.state.setMode(item.mode);
		}
	};

	private readonly onOpenImageClicked = async () => {
		openImageAction(this.state);
	};

	private readonly reloadSelection = () => {
		this.items.forEach(item => {
			item.setIsSelected(item.mode === this.state.mode);
		});
	};
}
