import { MceArrow, MceArrowHead } from 'mini-canvas-core';
import { DestroyableComponent } from '../../../components/component';
import { choicePropertyEditor } from '../editors/choice-property-editor';
import { colorPropertyEditor } from '../editors/color-property-editor';
import { numberPropertyEditor } from '../editors/number-property-editor';
import { propertyEditorRow } from '../layout/property-editor-row';
import { UpdateManager } from '../update-manager';
import { commonShapeEditor } from './common-shape-editor';

export function arrowShapeEditor(manager: UpdateManager<MceArrow>): DestroyableComponent {
	const colorRow = propertyEditorRow([
		colorPropertyEditor(
			'Color',
			manager.bind(
				o => o.stroke,
				(o, v) => o.set('stroke', v)
			)
		)
	]);
	const widthRow = propertyEditorRow([
		numberPropertyEditor(
			'Width',
			manager.bind(
				o => o.strokeWidth,
				(o, v) => o.set('strokeWidth', Math.max(v, 1))
			),
			{ min: 1, step: 1, decimals: 0 }
		)
	]);
	const headRow = propertyEditorRow([
		choicePropertyEditor<MceArrowHead>(
			'Head',
			{ End: MceArrowHead.end, Both: MceArrowHead.both, None: MceArrowHead.none },
			manager.bind(
				o => o.head,
				(o, v) => o.set('head', v)
			)
		)
	]);
	const headSizeRow = propertyEditorRow([
		numberPropertyEditor(
			'Head size',
			manager.bind(
				o => o.headSize,
				(o, v) => o.set('headSize', Math.max(v, 1))
			),
			{ min: 1, step: 0.5 }
		)
	]);
	const dashRow = propertyEditorRow([
		choicePropertyEditor<string>(
			'Line',
			{ Solid: 'solid', Dashed: 'dashed' },
			manager.bind(
				o => (o.strokeDashArray ? 'dashed' : 'solid') as string,
				(o, v) => o.set('strokeDashArray', v === 'dashed' ? [o.strokeWidth * 2.5, o.strokeWidth * 2] : null)
			)
		)
	]);
	return commonShapeEditor(manager, [colorRow, widthRow, headRow, headSizeRow, dashRow]);
}
