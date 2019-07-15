export class MessageBox implements IMessageBox {
    public el: HTMLSpanElement;
    public text_area: HTMLTextAreaElement;

    constructor() {
        this.initTextArea();
        this.initStyle();
    }

    public getValue(): string {
        return this.text_area.value;
    }

    public setValue(new_value: string): void {
        this.text_area.value = new_value;
    }

    private initTextArea(): void {
        this.el = document.createElement('span');

        this.text_area = document.createElement('textarea');
        this.text_area.id = 'input-box';
        this.text_area.placeholder = 'write your message';

        this.el.append(this.text_area);
    }

    private initStyle(): void {
        // TODO: add style.
    }

}