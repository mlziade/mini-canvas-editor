import { Component } from '../../components/component';
import { Html } from '../../core/html';
import { SimpleEvent } from '../../core/simple-event';

export interface CheckboxToolbarInputComponent extends Component {
	readonly onChanged: SimpleEvent<boolean>;
	setValue(value: boolean): void;
}

export function checkboxToolbarInput(labelText: string, initialValue: boolean): CheckboxToolbarInputComponent {
	function onInputChanged() {
		onChanged.forward(input.checked);
	}

	const onChanged = new SimpleEvent<boolean>();

	const view = Html.element('label', {
		class: 'mce-toolbar-item mce-toolbar-checkbox'
	});

	const input = Html.element('input', {
		class: 'mce-toolbar-checkbox-input',
		type: 'checkbox'
	});
	input.checked = initialValue;
	input.addEventListener('change', onInputChanged, false);

	const label = Html.element('span', {
		class: 'mce-toolbar-label'
	});
	label.textContent = labelText;

	view.appendChild(input);
	view.appendChild(label);
	return {
		view,
		onChanged,
		setValue(value: boolean) {
			input.checked = value;
		}
	};
}
