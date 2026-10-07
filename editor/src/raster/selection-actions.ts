import { MceImage, Point } from 'mini-canvas-core';
import type { EditorState } from '../editor-state';
import { SelectionMask } from './selection-mask';
import { RasterPatch } from './raster-layer';
import { applyRegionEffect, deleteRegion, extractRegion, RegionEffect } from './region-effects';
import { getSelectionLayer } from './targets';

/**
 * Things the user can do with a pixel selection. Each one is a single undo step.
 */
export class SelectionActions {
	public constructor(private readonly state: EditorState) {}

	public hasSelection(): boolean {
		return this.state.getSelection() !== null;
	}

	public selectAll() {
		const { workspaceWidth, workspaceHeight } = this.state.canvas;
		const mask = SelectionMask.createRect(workspaceWidth, workspaceHeight, { x: 0, y: 0, width: workspaceWidth, height: workspaceHeight });
		this.state.replaceSelection(mask, null);
	}

	public deselect() {
		this.state.clearSelection();
	}

	public invert() {
		const selection = this.state.getSelection();
		if (selection) {
			selection.invert();
			this.state.touchSelection();
		} else {
			this.selectAll();
		}
	}

	/**
	 * Makes the selected pixels of the layer transparent.
	 */
	public deletePixels(): boolean {
		return this.edit(layer => {
			const patch = deleteRegion(layer, layer.createMaskCanvas(this.requireSelection()));
			return patch ? [patch] : [];
		});
	}

	public applyEffect(effect: RegionEffect, amount: number): boolean {
		return this.edit(layer => {
			const patch = applyRegionEffect(layer, layer.createMaskCanvas(this.requireSelection()), effect, amount);
			return patch ? [patch] : [];
		});
	}

	/**
	 * Copies the selected pixels to a new layer above the source layer. With `cut` they are removed from the source.
	 */
	public toLayer(cut: boolean): boolean {
		return this.edit(layer => {
			const mask = layer.createMaskCanvas(this.requireSelection());
			const extracted = extractRegion(layer, mask);
			if (!extracted) {
				return [];
			}
			const patches: RasterPatch[] = [];
			if (cut) {
				const patch = deleteRegion(layer, mask);
				if (patch) {
					patches.push(patch);
				}
			}

			const source = layer.image;
			const rx = layer.canvas.width / source.width;
			const ry = layer.canvas.height / source.height;
			const { bounds, canvas } = extracted;
			const image = new MceImage(canvas as unknown as HTMLImageElement, {
				width: bounds.width,
				height: bounds.height,
				scaleX: source.scaleX / rx,
				scaleY: source.scaleY / ry,
				angle: source.angle,
				flipX: source.flipX,
				flipY: source.flipY,
				skewX: source.skewX,
				skewY: source.skewY,
				label: cut ? 'Cut' : 'Copy'
			});
			const center = new Point((bounds.x + bounds.width / 2) / rx - source.width / 2, (bounds.y + bounds.height / 2) / ry - source.height / 2);
			image.setPositionByOrigin(center.transform(source.calcTransformMatrix()), 'center', 'center');
			image.setCoords();
			const index = this.state.canvas.getObjects().indexOf(source);
			this.state.canvas.insertAt(index + 1, image);
			return patches;
		});
	}

	/**
	 * Adds a layer in the shape of the selection, painted with one color.
	 */
	public fill(color: string): boolean {
		const selection = this.state.getSelection();
		if (!selection) {
			return false;
		}
		this.state.history.transaction(() => {
			const canvas = selection.toAlphaCanvas();
			const ctx = canvas.getContext('2d')!;
			ctx.globalCompositeOperation = 'source-in';
			ctx.fillStyle = color;
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			this.state.add(
				new MceImage(canvas as unknown as HTMLImageElement, {
					left: 0,
					top: 0,
					width: canvas.width,
					height: canvas.height,
					label: 'Fill'
				})
			);
		});
		return true;
	}

	private requireSelection(): SelectionMask {
		const selection = this.state.getSelection();
		if (!selection) {
			throw new Error('There is no selection');
		}
		return selection;
	}

	private edit(action: (layer: NonNullable<ReturnType<typeof getSelectionLayer>>) => RasterPatch[]): boolean {
		if (!this.state.getSelection()) {
			return false;
		}
		let done = false;
		this.state.history.transaction(() => {
			let layer: ReturnType<typeof getSelectionLayer> = null;
			try {
				layer = getSelectionLayer(this.state);
			} catch (e) {
				console.warn('The pixels of this layer cannot be edited.', e);
			}
			if (!layer) {
				return [];
			}
			const patches = action(layer);
			done = patches.length > 0 || this.state.canvas.getObjects().length > 0;
			return patches;
		});
		return done;
	}
}
