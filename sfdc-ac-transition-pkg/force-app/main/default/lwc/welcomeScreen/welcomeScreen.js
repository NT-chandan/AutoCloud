import { LightningElement } from 'lwc';

//Labels
import WelcomeIntro1 from '@salesforce/label/c.WelcomeIntro1';

//Content Assets
import DR_ASTRO from '@salesforce/contentAssetUrl/DrAstro';

export default class WelcomeScreen extends LightningElement {

    astroImage = DR_ASTRO;

    label = {
        WelcomeIntro1
    };
}