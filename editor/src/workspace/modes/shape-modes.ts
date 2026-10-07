import { FabricObject, MceArrow, MceArrowHead, MceEllipse, MceRect, MceStar, MceTriangle, Point, TPointerEvent } from 'mini-canvas-core';
import { EditorMode, ShapeType } from '../../editor-configuration';
import type { EditorState } from '../../editor-state';
import { DragPainter } from './drag-painter';
import { WorkspaceMode } from './workspace-mode';

/**
 * Creates an empty shape of the given type, colored with the current shape options.
 */
function createShape(state: EditorState, type: ShapeType): FabricObject {
	const { fillColor, strokeColor, strokeWidth } = state.shape;
	const paint = { fill: fillColor, stroke: strokeColor, strokeWidth };
	switch (type) {
		case 'rect':
			return new MceRect(paint);
		case 'ellipse':
			return new MceEllipse(paint);
		case 'triangle':
			return new MceTriangle(paint);
		case 'star':
			return new MceStar({ ...paint, points: 5, innerRatio: 0.45, label: 'Star' });
		case 'polygon':
			return new MceStar({ ...paint, points: 6, innerRatio: 1, label: 'Polygon' });
		case 'line':
			return createArrow({ color: strokeColor, width: Math.max(strokeWidth, 2), head: MceArrowHead.none }, 'Line');
	}
}

function createArrow(options: { color: string; width: number; head: MceArrowHead }, label: string): MceArrow {
	return new MceArrow({ stroke: options.color, strokeWidth: options.width, head: options.head, label });
}

/**
 * Fits the object to the box between the two points. With `square` the box is forced to be square.
 */
function fitToBox(object: FabricObject, start: Point, point: Point, square: boolean) {
	let dx = point.x - start.x;
	let dy = point.y - start.y;
	if (square) {
		const size = Math.max(Math.abs(dx), Math.abs(dy));
		dx = Math.sign(dx || 1) * size;
		dy = Math.sign(dy || 1) * size;
	}
	const width = Math.abs(dx);
	const height = Math.abs(dy);
	const left = dx >= 0 ? start.x : start.x + dx;
	const top = dy >= 0 ? start.y : start.y + dy;
	if (object instanceof MceEllipse) {
		object.set({ left, top, rx: width / 2, ry: height / 2 });
	} else {
		object.set({ left, top, width, height });
	}
	object.setCoords();
}

/**
 * Points the arrow from `start` to `point`. With `snap` the angle is rounded to steps of 45 degrees.
 */
function fitArrow(arrow: MceArrow, start: Point, point: Point, snap: boolean) {
	let dx = point.x - start.x;
	let dy = point.y - start.y;
	if (snap) {
		const length = Math.hypot(dx, dy);
		const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
		dx = Math.cos(angle) * length;
		dy = Math.sin(angle) * length;
	}
	arrow.set({
		width: Math.abs(dx),
		height: Math.abs(dy),
		flipX: dx < 0,
		flipY: dy < 0
	});
	arrow.setPositionByOrigin(new Point(start.x + dx / 2, start.y + dy / 2), 'center', 'center');
	arrow.setCoords();
}

function isTooSmall(object: FabricObject): boolean {
	if (object instanceof MceEllipse) {
		return object.rx * 2 < 3 && object.ry * 2 < 3;
	}
	return object.width < 3 && object.height < 3;
}

abstract class DragShapeMode implements WorkspaceMode {
	protected object: FabricObject | null = null;
	private painter?: DragPainter;

	public constructor(protected readonly state: EditorState) {}

	protected abstract create(): FabricObject;
	protected abstract fit(object: FabricObject, start: Point, point: Point, event: TPointerEvent): void;

	public init() {
		this.painter = DragPainter.create(this.state, {
			onStart: () => {
				this.object = this.create();
				this.state.add(this.object);
			},
			onMove: (start, point, event) => {
				if (this.object) {
					this.fit(this.object, start, point, event);
					this.state.canvas.requestRenderAll();
				}
			},
			onEnd: (start, point, event) => {
				const object = this.object;
				this.object = null;
				if (!object) {
					return;
				}
				this.fit(object, start, point, event);
				if (isTooSmall(object)) {
					this.state.canvas.remove(object);
					return;
				}
				this.state.canvas.setActiveObject(object);
				this.state.setMode(EditorMode.select);
			}
		});
	}

	public destroy() {
		if (this.object) {
			this.state.canvas.remove(this.object);
			this.object = null;
		}
		this.painter?.destroy();
		this.painter = undefined;
	}
}

export class ShapeWorkspaceMode extends DragShapeMode {
	protected create() {
		return createShape(this.state, this.state.shape.type);
	}

	protected fit(object: FabricObject, start: Point, point: Point, event: TPointerEvent) {
		const shift = (event as MouseEvent).shiftKey;
		if (object instanceof MceArrow) {
			fitArrow(object, start, point, shift);
		} else {
			fitToBox(object, start, point, shift);
		}
	}
}

export class ArrowWorkspaceMode extends DragShapeMode {
	protected create() {
		return createArrow(this.state.arrow, 'Arrow');
	}

	protected fit(object: FabricObject, start: Point, point: Point, event: TPointerEvent) {
		fitArrow(object as MceArrow, start, point, (event as MouseEvent).shiftKey);
	}
}
