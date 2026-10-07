import { Component } from '../../components/component';
import { Html } from '../../core/html';
import { SimpleEvent } from '../../core/simple-event';

export interface SliderToolbarInputComponent extends Component {
	readonly onChanged: SimpleEvent<number>;
	setValue(value: number): void;
}

export interface SliderToolbarInputConfiguration {
	min: number;
	max: number;
	step?: number;
	/**
	 * Text added after the value, for example "%" or "px".
	 */
	unit?: string;
}

export function sliderToolbarInput(labelText: string, initialValue: number, configuration: SliderToolbarInputConfiguration): SliderToolbarInputComponent {
	const unit = configuration.unit ?? '';

	function refreshReadout() {
		readout.textContent = `${input.value}${unit}`;
	}

	function onInput() {
		refreshReadout();
		onChanged.forward(Number(input.value));
	}

	const onChanged = new SimpleEvent<number>();

	const label = Html.element('span', {
		class: 'mce-toolbar-label'
	});
	label.textContent = labelText;

	const input = Html.element('input', {
		class: 'mce-toolbar-slider-input',
		type: 'range',
		min: String(configuration.min),
		max: String(configuration.max),
		step: String(configuration.step ?? 1),
		value: String(initialValue)
	});
	input.addEventListener('input', onInput, false);

	const readout = Html.element('span', {
		class: 'mce-toolbar-readout'
	});
	refreshReadout();

	const view = Html.div({
		class: 'mce-toolbar-item'
	});
	view.appendChild(label);
	view.appendChild(input);
	view.appendChild(readout);
	return {
		view,
		onChanged,
		setValue(value: number) {
			input.value = String(value);
			refreshReadout();
		}
	};
}
