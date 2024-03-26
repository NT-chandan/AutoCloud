import { LightningElement, api } from 'lwc';

export default class ScopedNotification extends LightningElement {

    @api outerDivClass;
    @api componentRichText;
    @api spanContainingSvgClass;
    @api svgXlinkPath;

}