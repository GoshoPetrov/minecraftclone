/** Presentation for one notice shown over the game viewport. */
export interface NoticeOptions {
  readonly level: 'info' | 'warning' | 'error';
  /** Whether the player can dismiss it. Dismissible notices are transient. */
  readonly dismissible: boolean;
  /** Whether the notice describes an ongoing condition and must stay visible. */
  readonly persistent: boolean;
}

/**
 * Renders non-fatal messages (save failures, recovery, disabled storage) as
 * an unobtrusive stack over the canvas. It owns only its container element
 * and creates its children; it attaches no game listeners and holds no game
 * state, so it can be replaced or omitted without affecting play.
 */
export class NoticeOverlay {
  constructor(private readonly container: HTMLElement) {}

  /** Append a message; return the element so callers can update or remove it. */
  show(message: string, options: NoticeOptions): HTMLElement {
    const notice = document.createElement('div');
    notice.className = `notice notice--${options.level}`;
    if (options.persistent) {
      notice.classList.add('notice--persistent');
    }
    notice.setAttribute('role', options.level === 'error' ? 'alert' : 'status');

    const text = document.createElement('span');
    text.className = 'notice__message';
    text.textContent = message;
    notice.appendChild(text);

    if (options.dismissible) {
      const dismiss = document.createElement('button');
      dismiss.type = 'button';
      dismiss.className = 'notice__dismiss';
      dismiss.textContent = 'Dismiss';
      dismiss.addEventListener('click', () => {
        notice.remove();
      });
      notice.appendChild(dismiss);
    }

    this.container.appendChild(notice);
    return notice;
  }

  /** Remove every visible notice. */
  clear(): void {
    this.container.replaceChildren();
  }
}
