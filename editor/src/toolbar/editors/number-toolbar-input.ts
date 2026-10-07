import { Component } from '../../components/component';
import { Html } from '../../core/html';
import { SimpleEvent } from '../../core/simple-event';

export interface NumberToolbarInputComponent extends Component {
	readonly onChanged: SimpleEvent<number>;
	setValue(value: number): void;
}

export interface NumberToolbarInputConfiguration {
	min?: number;
	max?: number;
	step?: number;
}

export function numberToolbarInput(
	labelText: string,
	initialValue: number,
	configuration?: NumberToolbarInputConfiguration
): NumberToolbarInputComponent {
	function onInputChanged() {
		const newValue = Number(input.value);
		onChanged.forward(newValue);
	}

	const onChanged = new SimpleEvent<number>();

	const label = Html.element('span', {
		class: 'mce-toolbar-label'
	});
	label.textContent = labelText;

	const input = Html.element('input', {
		class: 'mce-toolbar-number-input',
		type: 'number',
		min: String(configuration?.min ?? 0.5),
		step: String(configuration?.step ?? 0.5),
		value: String(initialValue)
	});
	if (typeof configuration?.max === 'number') {
		input.max = String(configuration.max);
	}
	input.addEventListener('change', onInputChanged, false);

	const view = Html.div({
		class: 'mce-toolbar-item'
	});
	view.appendChild(label);
	view.appendChild(input);
	return {
		view,
		onChanged,
		setValue(value: number) {
			input.value = String(value);
		}
	};
}
