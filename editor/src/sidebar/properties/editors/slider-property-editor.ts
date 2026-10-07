import { Html } from '../../../core/html';
import { DestroyableComponent } from '../../../components/component';
import { simplePropertyEditor } from './simple-property-editor';
import { PropertyAccessor } from '../property-accessor';

export interface SliderPropertyEditorConfiguration {
	min: number;
	max: number;
	step?: number;
}

export function sliderPropertyEditor(
	label: string,
	accessor: PropertyAccessor<number>,
	configuration: SliderPropertyEditorConfiguration
): DestroyableComponent {
	function onInput() {
		accessor.setValue(Number(input.value));
	}

	function setValue(value: number) {
		input.value = String(value);
	}

	function destroy() {
		//
	}

	const input = Html.element('input', {
		class: 'mce-prop-slider',
		type: 'range',
		min: String(configuration.min),
		max: String(configuration.max),
		step: String(configuration.step ?? 1),
		value: String(accessor.getValue()),
		title: label
	});
	input.addEventListener('input', onInput, false);
	accessor.onExternalChanged.subscribe(setValue);

	return {
		view: simplePropertyEditor(label, input).view,
		destroy
	};
}
