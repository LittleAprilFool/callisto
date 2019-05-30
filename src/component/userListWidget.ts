export class UserListWidget implements IUserListWidget {
    private container: HTMLElement;
    constructor() {
        this.container = document.createElement('div');
        this.container.setAttribute('style', 'display: inline; margin-left: 20px;');
        const main_container = document.querySelector('#maintoolbar-container');
        main_container.appendChild(this.container);
    }
    public destroy(): void {
        this.cleanContainer();
        this.container.parentNode.removeChild(this.container);
    }
    public update(user_list: User[]): void {
        this.cleanContainer();
        user_list.forEach(user => {
            const display = this.createUserIcon(user);
            this.container.appendChild(display);
        });
    }
    private cleanContainer(): void {
        while(this.container.firstChild) {
            this.container.removeChild(this.container.firstChild);
        }
    }
    private createUserIcon(user: User): HTMLElement {
        const container = document.createElement('div');
        container.setAttribute('class', 'btn-group');
        const el = document.createElement('div');
        const icon = document.createElement('i');
        icon.innerHTML = '<i class="fa fa-user"></i>';

        el.innerText = user.username;
        el.style.marginLeft = '6px';
        el.style.display = 'inline';
        el.style.fontSize = '12px';
        el.style.fontWeight = 'bold';
        container.style.display = 'inline';
        container.style.backgroundColor = '#f8f8f8';
        container.style.borderColor = '#e7e7e7';
        container.style.margin = '5px';
        container.style.color = user.color;
        container.style.padding = '4px 8px';
        container.style.borderRadius = '4px';

        container.appendChild(icon);
        container.appendChild(el);
        return container;
    }
}
