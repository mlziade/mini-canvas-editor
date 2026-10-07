import { FabricObject, filters as fabricFilters, MceImage } from 'mini-canvas-core';
import { SimpleEvent } from '../core/simple-event';
import { RasterPatch } from '../raster/raster-layer';
import type { EditorState } from '../editor-state';

const MAX_ENTRIES = 100;
const MAX_PATCH_BYTES = 256 * 1024 * 1024;
const COMMIT_DELAY_MS = 250;

const IMAGE_KEYS = [
	'left',
	'top',
	'scaleX',
	'scaleY',
	'angle',
	'flipX',
	'flipY',
	'skewX',
	'skewY',
	'opacity',
	'visible',
	'selectable',
	'label'
];

interface ImageSource {
	element: unknown;
	filters: Record<string, unknown>[];
}

interface ObjectSnapshot {
	object: FabricObject;
	props: Record<string, unknown>;
	fill: unknown;
	stroke: unknown;
	image?: ImageSource;
}

export interface SceneSnapshot {
	objects: ObjectSnapshot[];
	key: string;
}

interface HistoryEntry {
	before: SceneSnapshot;
	after: SceneSnapshot;
	patches: RasterPatch[];
	bytes: number;
}

type ImageInternals = { _originalElement: unknown };

let nextId = 1;
const ids = new WeakMap<object, number>();
function idOf(value: unknown): number | string {
	if (value && typeof value === 'object') {
		let id = ids.get(value);
		if (!id) {
			id = nextId++;
			ids.set(value, id);
		}
		return id;
	}
	return String(value);
}

/**
 * Undo and redo.
 *
 * The scene is recorded as the list of objects and their properties, so undoing a change restores the
 * very same objects. Pixel edits are recorded as small patches of the area they changed.
 */
export class History {
	public readonly onChanged = new SimpleEvent<void>();

	private entries: HistoryEntry[] = [];
	private position = 0;
	private last: SceneSnapshot | null = null;
	private timer: ReturnType<typeof setTimeout> | null = null;
	private suspended = 0;
	private attached = false;

	public constructor(private readonly state: EditorState) {}

	public attach() {
		if (this.attached) {
			return;
		}
		this.attached = true;
		const canvas = this.state.canvas;
		canvas.on('object:added', this.onChange);
		canvas.on('object:removed', this.onChange);
		canvas.on('object:modified', this.onChange);
		canvas.on('text:editing:exited', this.onChange);
		this.state.onLayerOrderChanged.subscribe(this.onChange);
		this.state.onPropertiesChanged.subscribe(this.onChange);
		this.reset();
	}

	public detach() {
		if (!this.attached) {
			return;
		}
		this.attached = false;
		if (this.timer !== null) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		const canvas = this.state.canvas;
		canvas.off('object:added', this.onChange);
		canvas.off('object:removed', this.onChange);
		canvas.off('object:modified', this.onChange);
		canvas.off('text:editing:exited', this.onChange);
		this.state.onLayerOrderChanged.unsubscribe(this.onChange);
		this.state.onPropertiesChanged.unsubscribe(this.onChange);
	}

	/**
	 * Forgets everything and takes the current scene as the starting point.
	 */
	public reset() {
		this.entries = [];
		this.position = 0;
		this.last = this.capture();
		this.onChanged.forward();
	}

	public canUndo(): boolean {
		this.flush();
		return this.position > 0;
	}

	public canRedo(): boolean {
		return this.position < this.entries.length;
	}

	public undo(): boolean {
		this.flush();
		if (this.position === 0) {
			return false;
		}
		const entry = this.entries[this.position - 1];
		this.position--;
		this.suspended++;
		try {
			for (let i = entry.patches.length - 1; i >= 0; i--) {
				const patch = entry.patches[i];
				patch.layer.applyPatchPixels(patch.x, patch.y, patch.before);
			}
			this.restore(entry.before);
		} finally {
			this.suspended--;
		}
		this.last = entry.before;
		this.onChanged.forward();
		return true;
	}

	public redo(): boolean {
		this.flush();
		if (this.position >= this.entries.length) {
			return false;
		}
		const entry = this.entries[this.position];
		this.position++;
		this.suspended++;
		try {
			this.restore(entry.after);
			for (const patch of entry.patches) {
				patch.layer.applyPatchPixels(patch.x, patch.y, patch.after);
			}
		} finally {
			this.suspended--;
		}
		this.last = entry.after;
		this.onChanged.forward();
		return true;
	}

	/**
	 * Records the changes made by `action` as one step. `action` returns the pixel patches it made, if any.
	 */
	public transaction(action: () => RasterPatch[] | void) {
		this.flush();
		const before = this.last ?? this.capture();
		this.suspended++;
		let patches: RasterPatch[] | void;
		try {
			patches = action();
		} finally {
			this.suspended--;
		}
		this.commitEntry(before, patches || []);
	}

	/**
	 * For actions that cannot run inside a single callback, such as a brush stroke.
	 * Call `begin` before touching anything and `end` with the patches afterwards.
	 */
	public begin(): () => SceneSnapshot {
		this.flush();
		const before = this.last ?? this.capture();
		this.suspended++;
		return () => before;
	}

	public end(before: () => SceneSnapshot, patches: RasterPatch[]) {
		this.suspended--;
		this.commitEntry(before(), patches);
	}

	/**
	 * Records pending property changes right away instead of waiting for the delay.
	 */
	public flush() {
		if (this.timer !== null) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		if (this.suspended > 0 || !this.attached) {
			return;
		}
		const current = this.capture();
		if (this.last && current.key !== this.last.key) {
			this.commitEntry(this.last, [], current);
		}
	}

	private commitEntry(before: SceneSnapshot, patches: RasterPatch[], after?: SceneSnapshot) {
		const current = after ?? this.capture();
		if (current.key === before.key && patches.length === 0) {
			this.last = current;
			return;
		}
		const bytes = patches.reduce((sum, p) => sum + p.before.data.byteLength + p.after.data.byteLength, 0);
		this.entries.splice(this.position);
		this.entries.push({ before, after: current, patches, bytes });
		this.position = this.entries.length;
		this.last = current;
		this.trim();
		this.onChanged.forward();
	}

	private trim() {
		let total = this.entries.reduce((sum, e) => sum + e.bytes, 0);
		while (this.entries.length > MAX_ENTRIES || (total > MAX_PATCH_BYTES && this.entries.length > 1)) {
			const removed = this.entries.shift() as HistoryEntry;
			total -= removed.bytes;
			this.position--;
		}
		if (this.position < 0) {
			this.position = 0;
		}
	}

	private readonly onChange = () => {
		if (this.suspended > 0) {
			return;
		}
		if (this.timer !== null) {
			clearTimeout(this.timer);
		}
		this.timer = setTimeout(() => {
			this.timer = null;
			this.flush();
		}, COMMIT_DELAY_MS);
	};

	private capture(): SceneSnapshot {
		const objects = this.state.canvas.getWorkspaceObjects().map(object => this.captureObject(object));
		const key = JSON.stringify(objects.map(s => [idOf(s.object), s.props, idOf(s.fill), idOf(s.stroke), s.image && [idOf(s.image.element), s.image.filters]]));
		return { objects, key };
	}

	private captureObject(object: FabricObject): ObjectSnapshot {
		if (object.type === 'image') {
			const image = object as MceImage;
			const props: Record<string, unknown> = {};
			for (const key of IMAGE_KEYS) {
				props[key] = image.get(key as keyof MceImage);
			}
			props.selectable = this.state.getPersistedSelectable(object);
			return {
				object,
				props,
				fill: null,
				stroke: null,
				image: {
					element: (image as unknown as ImageInternals)._originalElement,
					filters: image.filters.map(f => f.toObject() as Record<string, unknown>)
				}
			};
		}
		const props = object.toObject(['label', 'selectable']) as Record<string, unknown>;
		props.selectable = this.state.getPersistedSelectable(object);
		const fill = object.fill;
		const stroke = object.stroke;
		// These are restored from the live objects, or cannot change after creation.
		delete props.fill;
		delete props.stroke;
		delete props.type;
		delete props.version;
		delete props.path;
		return { object, props, fill, stroke };
	}

	private restore(snapshot: SceneSnapshot) {
		const canvas = this.state.canvas;
		const keep = new Set(snapshot.objects.map(s => s.object));
		for (const object of canvas.getWorkspaceObjects()) {
			if (!keep.has(object)) {
				canvas.remove(object);
			}
		}
		const current = canvas.getWorkspaceObjects();
		const sameOrder = current.length === snapshot.objects.length && current.every((o, i) => o === snapshot.objects[i].object);
		if (!sameOrder) {
			current.forEach(o => canvas.remove(o));
			snapshot.objects.forEach(s => canvas.add(s.object));
		}

		for (const item of snapshot.objects) {
			const { object } = item;
			if (item.image) {
				this.restoreImage(object as MceImage, item.image);
			} else {
				object.set('fill', item.fill as never);
				object.set('stroke', item.stroke as never);
			}
			const { selectable, ...props } = item.props;
			object.set(props as never);
			this.state.setPersistedSelectable(object, selectable as boolean);
			object.setCoords();
			object.dirty = true;
		}
		canvas.discardActiveObject();
		this.state.onLayerOrderChanged.forward();
		canvas.requestRenderAll();
	}

	private restoreImage(image: MceImage, source: ImageSource) {
		const internals = image as unknown as ImageInternals;
		const sameFilters = JSON.stringify(image.filters.map(f => f.toObject())) === JSON.stringify(source.filters);
		if (internals._originalElement !== source.element) {
			image.filters = [];
			image.setElement(source.element as HTMLImageElement, { width: image.width, height: image.height });
		} else if (sameFilters) {
			return;
		}
		image.filters = source.filters.map(reviveFilter);
		image.applyFilters();
	}
}

function reviveFilter(serialized: Record<string, unknown>) {
	const { type, ...options } = serialized;
	const FilterClass = (fabricFilters as unknown as Record<string, new (options: object) => InstanceType<typeof fabricFilters.BaseFilter>>)[type as string];
	if (!FilterClass) {
		throw new Error(`Unknown filter: ${type}`);
	}
	return new FilterClass(options);
}
