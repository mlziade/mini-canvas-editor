import { FabricObject, MceEllipse } from 'mini-canvas-core';
import { DestroyableComponent } from '../../../components/component';
import { colorPropertyEditor } from '../editors/color-property-editor';
import { fillPropertyEditor } from '../editors/fill-property-editor';
import { numberPropertyEditor } from '../editors/number-property-editor';
import { propertyEditorRow } from '../layout/property-editor-row';
import { UpdateManager } from '../update-manager';
import { commonShapeEditor } from './common-shape-editor';

export function ellipseShapeEditor(manager: UpdateManager<MceEllipse>): DestroyableComponent {
	const sizeRow = propertyEditorRow([
		numberPropertyEditor(
			'W',
			manager.bind(
				o => o.rx * 2 * o.scaleX,
				(o, v) => o.set({ rx: v / 2, scaleX: 1 })
			)
		),
		numberPropertyEditor(
			'H',
			manager.bind(
				o => o.ry * 2 * o.scaleY,
				(o, v) => o.set({ ry: v / 2, scaleY: 1 })
			)
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

	return commonShapeEditor(manager, [sizeRow, fillRows, strokeRow]);
}
