import { FabricObject, MceStar } from 'mini-canvas-core';
import { DestroyableComponent } from '../../../components/component';
import { colorPropertyEditor } from '../editors/color-property-editor';
import { fillPropertyEditor } from '../editors/fill-property-editor';
import { numberPropertyEditor } from '../editors/number-property-editor';
import { sliderPropertyEditor } from '../editors/slider-property-editor';
import { propertyEditorRow } from '../layout/property-editor-row';
import { UpdateManager } from '../update-manager';
import { commonShapeEditor } from './common-shape-editor';

export function starShapeEditor(manager: UpdateManager<MceStar>): DestroyableComponent {
	const sizeRow = propertyEditorRow([
		numberPropertyEditor(
			'W',
			manager.bind(
				o => o.getScaledWidth(),
				(o, v) => o.set({ width: v, scaleX: 1 })
			)
		),
		numberPropertyEditor(
			'H',
			manager.bind(
				o => o.getScaledHeight(),
				(o, v) => o.set({ height: v, scaleY: 1 })
			)
		)
	]);
	const pointsRow = propertyEditorRow([
		numberPropertyEditor(
			'Points',
			manager.bind(
				o => o.points,
				(o, v) => o.set('points', Math.min(Math.max(Math.round(v), 3), 24))
			),
			{ decimals: 0, step: 1, min: 3, max: 24 }
		)
	]);
	// Depth 0 is a regular polygon, higher values pull the inner vertices toward the center.
	const depthRow = propertyEditorRow([
		sliderPropertyEditor(
			'Depth',
			manager.bind(
				o => Math.round((1 - o.innerRatio) * 100),
				(o, v) => o.set('innerRatio', 1 - Math.min(v, 95) / 100)
			),
			{ min: 0, max: 95, step: 1 }
		)
	]);
	const fillRows = fillPropertyEditor(manager as unknown as UpdateManager<FabricObject>);
	const strokeRow = propertyEditorRow([
		numberPropertyEditor(
			'SW',
			manager.bind(
				o => o.strokeWidth,
				(o, v) => o.set('strokeWidth', v)
			),
			{ min: 0 }
		),
		colorPropertyEditor(
			'SC',
			manager.bind(
				o => o.stroke,
				(o, v) => o.set('stroke', v)
			)
		)
	]);

	return commonShapeEditor(manager, [sizeRow, pointsRow, depthRow, fillRows, strokeRow]);
}
