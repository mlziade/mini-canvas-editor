import { FabricObject, MceArrowHead, MceCanvas, Point } from 'mini-canvas-core';
import { SimpleEvent } from './core/simple-event';
import {
	ArrowModeConfiguration,
	BlurModeConfiguration,
	BrushModeConfiguration,
	CloneModeConfiguration,
	EditorConfiguration,
	EditorMode,
	EraserModeConfiguration,
	GradientModeConfiguration,
	MagicWandModeConfiguration,
	QuickSelectModeConfiguration,
	RectModeConfiguration,
	ShapeModeConfiguration
} from './editor-configuration';
import { History } from './history/history';
import { SelectionMask, SelectionOperation } from './raster/selection-mask';

export class EditorState {
	public readonly onModeChanged = new SimpleEvent<EditorMode>();
	public readonly onZoomChanged = new SimpleEvent<void>();
	public readonly onLayerOrderChanged = new SimpleEvent<void>();
	public readonly onPropertiesChanged = new SimpleEvent<FabricObject | MceCanvas>();
	public readonly onBrushConfigurationChanged = new SimpleEvent<void>();
	public readonly onSelectionChanged = new SimpleEvent<void>();
	/**
	 * Raised when an option of any tool changes, so modes and toolbars can refresh.
	 */
	public readonly onToolOptionsChanged = new SimpleEvent<void>();

	public readonly history = new History(this);

	/**
	 * The layer the current pixel selection was made on.
	 */
	public selectionLayer: FabricObject | null = null;
	private selection: SelectionMask | null = null;

	public brush: Required<BrushModeConfiguration> = {
		brushSize: 10,
		brushColor: '#ff0000',
		...(this.configuration.brush || {})
	};

	public rect: Required<RectModeConfiguration> = {
		fillColor: '#ff0000',
		...(this.configuration.rect || {})
	};

	public arrow: Required<ArrowModeConfiguration> = {
		color: '#ff0000',
		width: 4,
		head: MceArrowHead.end,
		...(this.configuration.arrow || {})
	};

	public shape: Required<ShapeModeConfiguration> = {
		type: 'ellipse',
		fillColor: '#ff0000',
		strokeColor: '#ff0000',
		strokeWidth: 0,
		...(this.configuration.shape || {})
	};

	public eraser: Required<EraserModeConfiguration> = {
		size: 30,
		hardness: 0.8,
		opacity: 1,
		...(this.configuration.eraser || {})
	};

	public clone: Required<CloneModeConfiguration> = {
		size: 40,
		hardness: 0.5,
		opacity: 1,
		aligned: true,
		...(this.configuration.clone || {})
	};

	public blur: Required<BlurModeConfiguration> = {
		shape: 'brush',
		effect: 'blur',
		size: 40,
		strength: 6,
		hardness: 0.5,
		...(this.configuration.blur || {})
	};

	public magicWand: Required<MagicWandModeConfiguration> = {
		tolerance: 32,
		contiguous: true,
		operation: 'replace',
		...(this.configuration.magicWand || {})
	};

	public quickSelect: Required<QuickSelectModeConfiguration> = {
		size: 30,
		tolerance: 40,
		operation: 'add',
		...(this.configuration.quickSelect || {})
	};

	public gradient: Required<GradientModeConfiguration> = {
		type: 'linear',
		fromColor: '#ff0000',
		toColor: '#0000ff',
		...(this.configuration.gradient || {})
	};

	/**
	 * Where the clone brush copies from (workspace coordinates). Set with Alt + click.
	 */
	public cloneSource: Point | null = null;

	public constructor(
		public readonly canvas: MceCanvas,
		public mode: EditorMode,
		public readonly configuration: EditorConfiguration,
		private readonly container: HTMLElement
	) {}

	public center() {
		const scale = Math.min(
			1,
			this.container.clientWidth / this.canvas.workspaceWidth,
			this.container.clientHeight / this.canvas.workspaceHeight
		);
		const width = this.canvas.workspaceWidth * scale;
		const height = this.canvas.workspaceHeight * scale;
		const x = this.container.clientWidth / 2 - width / 2;
		const y = this.container.clientHeight / 2 - height / 2;
		this.canvas.setZoom(scale);
		this.canvas.absolutePan(new Point(-x, -y));
		this.onZoomChanged.forward();
	}

	public add(object: FabricObject) {
		this.canvas.add(object);
		this.canvas.requestRenderAll();
	}

	public selectObject(object: FabricObject) {
		this.canvas.discardActiveObject();
		this.canvas.setActiveObject(object);
		this.canvas.renderAll();
	}

	public forEachObject(callback: (object: FabricObject, index: number, isLast: boolean) => void) {
		const objects = this.canvas.getWorkspaceObjects();
		for (let index = 0; index < objects.length; index++) {
			callback(objects[index], index, index + 1 === objects.length);
		}
	}

	/**
	 * Original `selectable` values of the objects while a tool has made them unselectable.
	 */
	private disabledSelection: Map<FabricObject, boolean> | null = null;

	public disableSelection(): SelectionReverter {
		this.canvas.selection = false;
		const map = new Map<FabricObject, boolean>();
		this.forEachObject(o => {
			map.set(o, o.selectable);
			if (o.selectable) {
				o.set('selectable', false);
			}
		});
		this.disabledSelection = map;
		return new SelectionReverter(map, () => {
			if (this.disabledSelection === map) {
				this.disabledSelection = null;
			}
		});
	}

	/**
	 * Whether the object can be selected, ignoring that a tool may have turned selection off temporarily.
	 */
	public getPersistedSelectable(object: FabricObject): boolean {
		const map = this.disabledSelection;
		return map && map.has(object) ? (map.get(object) as boolean) : object.selectable;
	}

	/**
	 * Sets `selectable` for an object, keeping it off while a tool has selection disabled.
	 */
	public setPersistedSelectable(object: FabricObject, selectable: boolean) {
		const map = this.disabledSelection;
		if (map) {
			map.set(object, selectable);
			object.set('selectable', false);
		} else {
			object.set('selectable', selectable);
		}
	}

	public setMode(mode: EditorMode) {
		this.history.flush();
		this.mode = mode;
		this.onModeChanged.forward(mode);
	}

	/**
	 * The current pixel selection, or null when nothing is selected.
	 */
	public getSelection(): SelectionMask | null {
		if (!this.selection) {
			return null;
		}
		if (this.selection.width !== this.canvas.workspaceWidth || this.selection.height !== this.canvas.workspaceHeight) {
			// The workspace was resized, so the selection no longer fits.
			this.selection = null;
			return null;
		}
		return this.selection.isEmpty() ? null : this.selection;
	}

	/**
	 * Changes the selection. `mask` has the size of the workspace, 255 marks selected pixels.
	 */
	public applySelection(mask: Uint8Array, operation: SelectionOperation, layer: FabricObject | null) {
		const width = this.canvas.workspaceWidth;
		const height = this.canvas.workspaceHeight;
		if (!this.selection || this.selection.width !== width || this.selection.height !== height) {
			this.selection = SelectionMask.createEmpty(width, height);
		}
		this.selection.combine(mask, operation);
		this.selectionLayer = layer ?? this.selectionLayer;
		this.onSelectionChanged.forward();
	}

	public replaceSelection(mask: SelectionMask | null, layer: FabricObject | null) {
		this.selection = mask;
		this.selectionLayer = layer;
		this.onSelectionChanged.forward();
	}

	public touchSelection() {
		this.selection?.touch();
		this.onSelectionChanged.forward();
	}

	public clearSelection() {
		if (this.selection) {
			this.selection = null;
			this.selectionLayer = null;
			this.onSelectionChanged.forward();
		}
	}
}

export class SelectionReverter {
	public constructor(
		private readonly map: Map<FabricObject, boolean>,
		private readonly onReverted?: () => void
	) {}

	public revert() {
		this.map.forEach((value, key) => key.set('selectable', value));
		this.onReverted?.();
	}
}
