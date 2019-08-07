import { Dialog } from "types";

const dialog = require('base/js/dialog');

export class StudyWidget {
    constructor(private reloadCallback: () => void) {
        this.initContainer();
        (window as any).study_condition = 'experiment';
    }

    private toggleCondition = (e): void => {
        const new_dialog = this.getStudyDialog();
        dialog.modal(new_dialog);
    }
    private initContainer = (): void => {
        const helpEl = document.querySelector('#help_menu');
        const toggle = document.createElement('li');
        const title = document.createElement('a');
        title.href = '#';
        title.innerText = 'Study Condition';
        title.addEventListener('click', this.toggleCondition);
        toggle.appendChild(title);
        helpEl.appendChild(toggle);
    }

    private getStudyDialog = (): any => {
        const form = document.createElement('form');
        form.setAttribute('id', 'kernel_form');
        form.setAttribute('onSubmit', 'return false;');
            
        const form_label = document.createElement('p');
        form_label.style.display = 'inline-block';
        const conditions = document.createElement('select');
        conditions.style.display = 'inline-block';
        const condition_experiment = document.createElement('option');
        condition_experiment.value = 'experiment';
        condition_experiment.innerText = 'experiment';
        const condition_control = document.createElement('option');
        condition_control.value = 'control';
        condition_control.innerText = 'control';
        conditions.appendChild(condition_experiment);
        conditions.appendChild(condition_control);
        conditions.value = (window as any).study_condition;
        form_label.innerText = 'The current study condition:';
        form.appendChild(form_label);
        form.appendChild(conditions);

        const buttons = {
            'Confirm': {
                'class': 'btn-primary', 
                'click': () => {
                    if((window as any).study_condition !== conditions.value) {
                        (window as any).study_condition = conditions.value;
                        this.reloadCallback();
                    }
                },
                'id': 'confirm-button'
            },
            'Cancel': {
                'class': 'btn-default',
                'click': () => {
                    // cancel join
                    console.log('Cancel changing study condition');
                },
                'id': 'confirm-close'
            }
        };

        return {
            body: form,
            buttons,
            title: 'Change Study Condition'
        };
    }
}