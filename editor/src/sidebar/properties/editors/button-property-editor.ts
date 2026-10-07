import { Html } from '../../../core/html';
import { DestroyableComponent } from '../../../components/component';

export function buttonPropertyEditor(text: string, onClick: () => void): DestroyableComponent {
	const button = Html.element('button', {
		class: 'mce-prop-button',
		type: 'button'
	});
	button.textContent = text;
	button.addEventListener(
		'click',
		e => {
			e.preventDefault();
			onClick();
		},
		false
	);
	const view = Html.div({ class: 'mce-prop-simple' });
	view.appendChild(button);
	return {
		view,
		destroy() {
			//
		}
	};
}

export function sectionPropertyEditor(title: string): DestroyableComponent {
	const view = Html.div({ class: 'mce-prop-section' });
	view.textContent = title;
	return {
		view,
		destroy() {
			//
		}
	};
}
