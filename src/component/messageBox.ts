export class MessageBox implements IMessageBox {
    public el: HTMLDivElement;
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
        this.el = document.createElement('div');
        this.el.id = 'message-box';
        const div = document.createElement('div');
        this.el.append(div);

        this.text_area = document.createElement('textarea');
        this.text_area.id = 'input-box';
        this.text_area.placeholder = 'write your message';

        div.append(this.text_area);
    }

    private initStyle(): void {
        // TODO: add style.
    }

}