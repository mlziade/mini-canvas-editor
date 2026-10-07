import { MceArrowHead } from 'mini-canvas-core';
import { BlurEffect, BlurShape, EditorMode, GradientType, ShapeType } from '../../editor-configuration';
import { EditorState } from '../../editor-state';
import { SelectionActions } from '../../raster/selection-actions';
import { SelectionOperation } from '../../raster/selection-mask';
import { ControlSpec } from './options-toolbar-mode';

const percent = (value: number) => Math.round(value * 100);

const OPERATIONS: Record<string, string> = {
	New: 'replace',
	Add: 'add',
	Subtract: 'subtract',
	Intersect: 'intersect'
};

/**
 * Buttons that work on the current selection. They only show while there is one.
 */
function selectionActionSpecs(state: EditorState): ControlSpec[] {
	const actions = new SelectionActions(state);
	const visible = () => actions.hasSelection();
	return [
		{ type: 'separator', visible },
		{ type: 'button', label: 'Deselect', title: 'Remove the selection (Ctrl+D)', onClick: () => actions.deselect(), visible },
		{ type: 'button', label: 'Invert', title: 'Select everything that is not selected', onClick: () => actions.invert(), visible },
		{ type: 'button', label: 'Delete', title: 'Erase the selected pixels (Delete)', onClick: () => actions.deletePixels(), visible },
		{ type: 'button', label: 'Cut', title: 'Move the selected pixels to a new layer', onClick: () => actions.toLayer(true), visible },
		{ type: 'button', label: 'Copy', title: 'Copy the selected pixels to a new layer', onClick: () => actions.toLayer(false), visible },
		{ type: 'button', label: 'Blur', title: 'Blur the selected pixels', onClick: () => actions.applyEffect('blur', state.blur.strength), visible },
		{
			type: 'button',
			label: 'Pixelate',
			title: 'Pixelate the selected pixels',
			onClick: () => actions.applyEffect('pixelate', Math.max(state.blur.strength, 2)),
			visible
		},
		{ type: 'color', label: 'Fill', get: () => state.shape.fillColor, set: v => (state.shape.fillColor = v), visible },
		{ type: 'button', label: 'Fill', title: 'Add a layer with the selected shape in this color', onClick: () => actions.fill(state.shape.fillColor), visible }
	];
}

/**
 * Describes the toolbar of a mode, or returns null when the mode has no options.
 */
export function createToolSpecs(mode: EditorMode, state: EditorState): ControlSpec[] | null {
	switch (mode) {
		case EditorMode.arrow:
			return [
				{ type: 'color', label: 'Color', get: () => state.arrow.color, set: v => (state.arrow.color = v) },
				{ type: 'number', label: 'Width', min: 1, step: 1, get: () => state.arrow.width, set: v => (state.arrow.width = v) },
				{
					type: 'choice',
					label: 'Head',
					choices: { End: MceArrowHead.end, Both: MceArrowHead.both, None: MceArrowHead.none },
					get: () => state.arrow.head,
					set: v => (state.arrow.head = v as MceArrowHead)
				},
				{ type: 'text', label: 'Hold Shift for straight angles' }
			];
		case EditorMode.shape:
			return [
				{
					type: 'choice',
					label: 'Shape',
					choices: { Rectangle: 'rect', Ellipse: 'ellipse', Triangle: 'triangle', Star: 'star', Polygon: 'polygon', Line: 'line' },
					get: () => state.shape.type,
					set: v => (state.shape.type = v as ShapeType)
				},
				{ type: 'color', label: 'Fill', get: () => state.shape.fillColor, set: v => (state.shape.fillColor = v), visible: () => state.shape.type !== 'line' },
				{ type: 'color', label: 'Stroke', get: () => state.shape.strokeColor, set: v => (state.shape.strokeColor = v) },
				{ type: 'number', label: 'Stroke width', min: 0, step: 1, get: () => state.shape.strokeWidth, set: v => (state.shape.strokeWidth = v) },
				{ type: 'text', label: 'Hold Shift for equal sides' }
			];
		case EditorMode.eraser:
			return [
				{ type: 'slider', label: 'Size', min: 1, max: 300, get: () => state.eraser.size, set: v => (state.eraser.size = v), unit: 'px' },
				{ type: 'slider', label: 'Hardness', min: 0, max: 100, get: () => percent(state.eraser.hardness), set: v => (state.eraser.hardness = v / 100), unit: '%' },
				{ type: 'slider', label: 'Opacity', min: 1, max: 100, get: () => percent(state.eraser.opacity), set: v => (state.eraser.opacity = v / 100), unit: '%' }
			];
		case EditorMode.clone:
			return [
				{ type: 'slider', label: 'Size', min: 1, max: 300, get: () => state.clone.size, set: v => (state.clone.size = v), unit: 'px' },
				{ type: 'slider', label: 'Hardness', min: 0, max: 100, get: () => percent(state.clone.hardness), set: v => (state.clone.hardness = v / 100), unit: '%' },
				{ type: 'slider', label: 'Opacity', min: 1, max: 100, get: () => percent(state.clone.opacity), set: v => (state.clone.opacity = v / 100), unit: '%' },
				{ type: 'checkbox', label: 'Aligned', get: () => state.clone.aligned, set: v => (state.clone.aligned = v) },
				{ type: 'text', label: 'Alt + click to pick the source' }
			];
		case EditorMode.blur:
			return [
				{
					type: 'choice',
					label: 'Mode',
					choices: { Brush: 'brush', Area: 'area' },
					get: () => state.blur.shape,
					set: v => (state.blur.shape = v as BlurShape)
				},
				{
					type: 'choice',
					label: 'Effect',
					choices: { Blur: 'blur', Pixelate: 'pixelate' },
					get: () => state.blur.effect,
					set: v => (state.blur.effect = v as BlurEffect),
					visible: () => state.blur.shape === 'area'
				},
				{
					type: 'slider',
					label: 'Size',
					min: 1,
					max: 300,
					get: () => state.blur.size,
					set: v => (state.blur.size = v),
					unit: 'px',
					visible: () => state.blur.shape === 'brush'
				},
				{
					type: 'slider',
					label: 'Hardness',
					min: 0,
					max: 100,
					get: () => percent(state.blur.hardness),
					set: v => (state.blur.hardness = v / 100),
					unit: '%',
					visible: () => state.blur.shape === 'brush'
				},
				{ type: 'slider', label: 'Strength', min: 1, max: 60, get: () => state.blur.strength, set: v => (state.blur.strength = v) }
			];
		case EditorMode.magicWand:
			return [
				{ type: 'slider', label: 'Tolerance', min: 0, max: 255, get: () => state.magicWand.tolerance, set: v => (state.magicWand.tolerance = v) },
				{ type: 'checkbox', label: 'Contiguous', get: () => state.magicWand.contiguous, set: v => (state.magicWand.contiguous = v) },
				{
					type: 'choice',
					label: 'Mode',
					choices: OPERATIONS,
					get: () => state.magicWand.operation,
					set: v => (state.magicWand.operation = v as SelectionOperation)
				},
				...selectionActionSpecs(state)
			];
		case EditorMode.quickSelect:
			return [
				{ type: 'slider', label: 'Size', min: 2, max: 300, get: () => state.quickSelect.size, set: v => (state.quickSelect.size = v), unit: 'px' },
				{ type: 'slider', label: 'Tolerance', min: 1, max: 255, get: () => state.quickSelect.tolerance, set: v => (state.quickSelect.tolerance = v) },
				{
					type: 'choice',
					label: 'Mode',
					choices: OPERATIONS,
					get: () => state.quickSelect.operation,
					set: v => (state.quickSelect.operation = v as SelectionOperation)
				},
				...selectionActionSpecs(state)
			];
		case EditorMode.gradient:
			return [
				{
					type: 'choice',
					label: 'Type',
					choices: { Linear: 'linear', Radial: 'radial' },
					get: () => state.gradient.type,
					set: v => (state.gradient.type = v as GradientType)
				},
				{ type: 'color', label: 'From', get: () => state.gradient.fromColor, set: v => (state.gradient.fromColor = v) },
				{ type: 'color', label: 'To', get: () => state.gradient.toColor, set: v => (state.gradient.toColor = v) },
				{ type: 'text', label: 'Drag to paint. Fills the selection if there is one' }
			];
	}
	return null;
}
