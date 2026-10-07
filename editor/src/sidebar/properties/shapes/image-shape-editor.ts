import { UpdateManager } from '../update-manager';
import { DestroyableComponent } from '../../../components/component';
import { commonShapeEditor } from './common-shape-editor';
import { MceImage } from 'mini-canvas-core';
import { propertyEditorRow } from '../layout/property-editor-row';
import { numberPropertyEditor } from '../editors/number-property-editor';
import { choicePropertyEditor } from '../editors/choice-property-editor';
import { sliderPropertyEditor } from '../editors/slider-property-editor';
import { buttonPropertyEditor, sectionPropertyEditor } from '../editors/button-property-editor';
import { FILTER_PRESETS, FILTER_SLIDERS, readPreset, readSlider, resetFilters, writePreset, writeSlider } from './image-filters';

export function imageShapeEditor(manager: UpdateManager<MceImage>): DestroyableComponent {
	const row1 = propertyEditorRow([
		numberPropertyEditor(
			'W',
			manager.bind(
				o => o.getScaledWidth(),
				(o, v) => {
					const scaleX = v / o.getOriginalSize().width;
					o.set('scaleX', scaleX);
				}
			)
		),
		numberPropertyEditor(
			'H',
			manager.bind(
				o => o.getScaledHeight(),
				(o, v) => {
					const scaleY = v / o.getOriginalSize().height;
					o.set('scaleY', scaleY);
				}
			)
		)
	]);

	const presetRow = propertyEditorRow([
		choicePropertyEditor<string>(
			'Look',
			FILTER_PRESETS,
			manager.bind(
				o => readPreset(o),
				(o, v) => writePreset(o, v)
			)
		)
	]);
	const sliderRows = FILTER_SLIDERS.map(slider =>
		propertyEditorRow([
			sliderPropertyEditor(
				slider.label,
				manager.bind(
					o => readSlider(o, slider),
					(o, v) => writeSlider(o, slider, v)
				),
				slider
			)
		])
	);
	// Setting the filters one by one would leave the sliders showing old values, so refresh the panel from the layer.
	const resetRow = propertyEditorRow([buttonPropertyEditor('Reset filters', () => manager.apply(o => resetFilters(o)))]);

	return commonShapeEditor(manager, [row1, propertySection('Filters'), presetRow, ...sliderRows, resetRow]);
}

function propertySection(title: string) {
	return propertyEditorRow([sectionPropertyEditor(title)]);
}
