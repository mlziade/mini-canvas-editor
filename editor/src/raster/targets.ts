import { FabricObject, MceImage, Point } from 'mini-canvas-core';
import type { EditorState } from '../editor-state';
import { RasterLayer } from './raster-layer';

/**
 * Whether the object has a visible pixel under the workspace point.
 */
export function hitsObject(object: FabricObject, point: Point): boolean {
	if (!object.visible) {
		return false;
	}
	if (RasterLayer.isRasterizable(object)) {
		return RasterLayer.from(object).hitTest(point);
	}
	const rect = object.getBoundingRect();
	if (point.x < rect.left || point.y < rect.top || point.x > rect.left + rect.width || point.y > rect.top + rect.height) {
		return false;
	}
	const canvas = object.toCanvasElement({ multiplier: 1, enableRetinaScaling: false });
	const x = Math.floor(point.x - rect.left);
	const y = Math.floor(point.y - rect.top);
	if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) {
		return false;
	}
	return canvas.getContext('2d')!.getImageData(x, y, 1, 1).data[3] > 0;
}

/**
 * The topmost object that has a visible pixel under the workspace point.
 */
export function findObjectAt(state: EditorState, point: Point): FabricObject | null {
	const objects = state.canvas.getWorkspaceObjects();
	for (let i = objects.length - 1; i >= 0; i--) {
		if (hitsObject(objects[i], point)) {
			return objects[i];
		}
	}
	return null;
}

/**
 * Replaces any object with an image of what it looks like, so pixel tools can work on it.
 * The new image takes the place of the object. Images are returned as they are.
 */
export function rasterizeObject(state: EditorState, object: FabricObject): MceImage {
	if (RasterLayer.isRasterizable(object)) {
		return object;
	}
	const rect = object.getBoundingRect();
	const element = object.toCanvasElement({ multiplier: 1, enableRetinaScaling: false });
	const image = new MceImage(element as unknown as HTMLImageElement, {
		left: rect.left,
		top: rect.top,
		width: element.width,
		height: element.height,
		label: object.get('label') ?? object.type
	});
	const index = state.canvas.getObjects().indexOf(object);
	state.canvas.remove(object);
	state.canvas.insertAt(index, image);
	return image;
}

/**
 * The layer a pixel tool should edit when the pointer goes down at `point`.
 * Objects that are not images are converted to images first, so call this inside a history step.
 */
export function resolveRasterLayer(state: EditorState, point: Point): RasterLayer | null {
	const object = findObjectAt(state, point);
	if (!object) {
		return null;
	}
	return RasterLayer.from(rasterizeObject(state, object));
}

/**
 * The layer that selection actions apply to: the one the selection was made on, or the topmost image.
 */
export function getSelectionLayer(state: EditorState): RasterLayer | null {
	const remembered = state.selectionLayer;
	if (remembered && state.canvas.getObjects().includes(remembered) && RasterLayer.isRasterizable(remembered)) {
		return RasterLayer.from(remembered);
	}
	const objects = state.canvas.getWorkspaceObjects();
	for (let i = objects.length - 1; i >= 0; i--) {
		const object = objects[i];
		if (object.visible && RasterLayer.isRasterizable(object)) {
			return RasterLayer.from(object);
		}
	}
	return null;
}

/**
 * What an object looks like, in a canvas the size of the workspace. Used to pick pixels by color.
 */
export function renderObjectToWorkspace(state: EditorState, object: FabricObject): HTMLCanvasElement {
	const width = state.canvas.workspaceWidth;
	const height = state.canvas.workspaceHeight;
	if (RasterLayer.isRasterizable(object)) {
		return RasterLayer.from(object).renderToWorkspace(width, height);
	}
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const rect = object.getBoundingRect();
	canvas.getContext('2d')!.drawImage(object.toCanvasElement({ multiplier: 1, enableRetinaScaling: false }), rect.left, rect.top);
	return canvas;
}
