import { DestroyableComponent } from '../../../components/component';
import { UpdateManager } from '../update-manager';
import { textShapeEditor } from './textbox-shape-editor';
import { rectShapeEditor } from './rect-shape-editor';
import { circleShapeEditor } from './circle-shape-editor';
import { imageShapeEditor } from './image-shape-editor';
import { unknownShapeEditor } from './unknown-shape-editor';
import { arrowShapeEditor } from './arrow-shape-editor';
import { ellipseShapeEditor } from './ellipse-shape-editor';
import { starShapeEditor } from './star-shape-editor';
import { triangleShapeEditor } from './triangle-shape-editor';
import { Circle, FabricObject, MceArrow, MceEllipse, MceImage, MceRect, MceStar, MceTextbox, MceTriangle, ObjectEvents } from 'mini-canvas-core';

export class ShapeEditorFactory {
	public static create(type: string, manager: UpdateManager<FabricObject, ObjectEvents>): DestroyableComponent {
		switch (type) {
			case 'rect':
				return rectShapeEditor(manager as UpdateManager<MceRect>);
			case 'ellipse':
				return ellipseShapeEditor(manager as UpdateManager<MceEllipse>);
			case 'triangle':
				return triangleShapeEditor(manager as UpdateManager<MceTriangle>);
			case 'mcestar':
				return starShapeEditor(manager as UpdateManager<MceStar>);
			case 'mcearrow':
				return arrowShapeEditor(manager as UpdateManager<MceArrow>);
			case 'circle':
				return circleShapeEditor(manager as UpdateManager<Circle>);
			case 'textbox':
				return textShapeEditor(manager as UpdateManager<MceTextbox>);
			case 'image':
				return imageShapeEditor(manager as UpdateManager<MceImage>);
			default:
				return unknownShapeEditor(manager as UpdateManager<FabricObject>);
		}
	}
}
