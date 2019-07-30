import { IUserListWidget, User } from "types";

export class UserListWidget implements IUserListWidget {
    private container: HTMLElement;
    constructor() {
        this.initContainer();
        this.initStyle();
    }
    public destroy = (): void => {
        this.cleanContainer();
        this.container.parentNode.removeChild(this.container);
    }
    public update = (user_list: User[]): void => {
        this.cleanContainer();
        user_list.forEach(user => {
            const display = this.createUserIcon(user);
            display.addEventListener('click', this.handleClick);
            this.container.appendChild(display);
        });
    }

    private handleClick = (): void => {
        // navigate to cursor
    }

    private initContainer = (): void => {
        this.container = document.createElement('div');
        this.container.classList.add('userlist-container');
        const main_container = document.querySelector('#maintoolbar-container');
        main_container.appendChild(this.container);
    }

    private initStyle = (): void => {
        const sheet = document.createElement('style');
        sheet.innerHTML += '.userlist-container {display:inline; margin-left: 20px;}\n';
        sheet.innerHTML += '.userlist-username {margin-left: 6px; display:inline; font-size: 12px; font-weight: bold;}\n';
        sheet.innerHTML += '.userlist-wrapper {cursor: pointer; display:inline; background: #f8f8f8; border: 1px solid #e7e7e7; margin: 5px; padding: 4px 8px; border-radius: 4px;}\n';
        document.body.appendChild(sheet);
    }

    private cleanContainer = (): void => {
        while(this.container.firstChild) {
            this.container.removeChild(this.container.firstChild);
        }
    }
    private createUserIcon = (user: User): HTMLElement => {
        const container = document.createElement('div');
        container.classList.add('userlist-wrapper', 'btn-group');
        const el = document.createElement('div');
        const icon = document.createElement('i');
        icon.innerHTML = '<i class="fa fa-user"></i>';

        el.innerText = user.username;
        el.classList.add('userlist-username');
        container.style.color = user.color;

        container.appendChild(icon);
        container.appendChild(el);
        return container;
    }
}
