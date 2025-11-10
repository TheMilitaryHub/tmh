const template = document.createElement('template');

template.innerHTML = `
    <style>
        :host {
            display: block;
            width: 100%;
            z-index: 1000;
        }

        .menu-container {
            position: relative;
            width: 100%;
            text-align: center;
            padding: 10px;
        }

        .menu-toggle {
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
            transition: transform 0.5s ease, margin-top 0.5s ease;
            margin-top: 0;
            background: none;
            border: none;
            padding: 0;
            color: inherit;
        }

        .menu-toggle svg {
            width: 100%;
            height: 100%;
            fill: white;
        }

        .menu-toggle:focus-visible {
            outline: 2px solid white;
            outline-offset: 4px;
        }

        .menu-toggle.flipped {
            transform: rotate(180deg);
        }

        .menu-options {
            display: flex;
            justify-content: center;
            background-color: rgba(0, 0, 0, 0.021);
            overflow: hidden;
            transition: max-height 0.5s ease, opacity 0.5s ease;
            max-height: 0;
            opacity: 0;
            margin-bottom: 0;
        }

        .menu-options.show {
            max-height: 200px;
            opacity: 1;
        }

        .menu-options a {
            color: white;
            padding: 15px 20px;
            text-decoration: none;
            flex: 1;
            text-align: center;
            border-right: 2px solid #444;
        }

        .menu-options a:last-child {
            border-right: none;
        }

        .menu-options a:hover {
            animation: bounce 0.3s;
            background-color: #131313;
        }

        @keyframes bounce {
            0%, 100% {
                transform: translateY(0);
            }
            50% {
                transform: translateY(-10px);
            }
        }
    </style>
    <div class="menu-container">
        <div class="menu-options" id="menuOptions"></div>
        <button class="menu-toggle" id="menuToggle" aria-expanded="false" aria-label="Toggle primary navigation" type="button">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M12 21L22 3H2z"></path>
            </svg>
        </button>
    </div>
`;

class TacticalMenu extends HTMLElement {
    static get observedAttributes() {
        return ['links', 'data-links'];
    }

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.appendChild(template.content.cloneNode(true));

        this.menuOptionsEl = this.shadowRoot.getElementById('menuOptions');
        this.menuToggleEl = this.shadowRoot.getElementById('menuToggle');
        this.boundClickableElements = [];

        this.handleToggle = this.handleToggle.bind(this);
        this.handleHoverSound = this.handleHoverSound.bind(this);
        this.handleSelectSound = this.handleSelectSound.bind(this);
    }

    connectedCallback() {
        this.renderMenu();
        this.menuToggleEl.addEventListener('click', this.handleToggle);
    }

    disconnectedCallback() {
        this.menuToggleEl.removeEventListener('click', this.handleToggle);
        this.detachSoundHandlers();
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) {
            return;
        }

        if (name === 'links' || name === 'data-links') {
            this.renderMenu();
        }
    }

    handleToggle() {
        const isOpen = this.menuOptionsEl.classList.toggle('show');
        this.menuToggleEl.classList.toggle('flipped', isOpen);
        this.menuToggleEl.setAttribute('aria-expanded', String(isOpen));
    }

    handleHoverSound() {
        this.playSound(this.getHoverSoundId());
    }

    handleSelectSound() {
        this.playSound(this.getSelectSoundId());
    }

    playSound(soundId) {
        if (!soundId) {
            return;
        }
        const audio = document.getElementById(soundId);
        if (audio) {
            audio.currentTime = 0;
            audio.play();
        }
    }

    getHoverSoundId() {
        return this.getAttribute('hover-sound-id') || 'beepSound';
    }

    getSelectSoundId() {
        return this.getAttribute('select-sound-id') || 'selectSound';
    }

    getLinksFromAttribute(attrName) {
        const attrValue = this.getAttribute(attrName);
        if (!attrValue) {
            return null;
        }

        try {
            const parsed = JSON.parse(attrValue);
            if (Array.isArray(parsed)) {
                return parsed
                    .map(item => ({
                        label: item.label,
                        href: item.href,
                        target: item.target || '_self'
                    }))
                    .filter(item => item.label && item.href);
            }
        } catch (error) {
            console.warn(`[tactical-menu] Unable to parse ${attrName}:`, error);
        }
        return null;
    }

    getMenuLinks() {
        return (
            this.getLinksFromAttribute('links') ||
            this.getLinksFromAttribute('data-links') ||
            []
        );
    }

    renderMenu() {
        if (!this.menuOptionsEl) {
            return;
        }

        const links = this.getMenuLinks();
        this.menuOptionsEl.innerHTML = '';

        links.forEach(link => {
            const anchor = document.createElement('a');
            anchor.href = link.href;
            anchor.textContent = link.label;
            anchor.target = link.target || '_self';
            if (anchor.target === '_blank') {
                anchor.rel = 'noopener noreferrer';
            }
            this.menuOptionsEl.appendChild(anchor);
        });

        // Close menu if there are no links to display.
        this.menuOptionsEl.classList.remove('show');
        this.menuToggleEl.classList.remove('flipped');
        this.menuToggleEl.setAttribute('aria-expanded', 'false');

        this.attachSoundHandlers();
    }

    attachSoundHandlers() {
        this.detachSoundHandlers();

        const elements = [
            this.menuToggleEl,
            ...this.menuOptionsEl.querySelectorAll('a')
        ].filter(Boolean);

        elements.forEach(element => {
            element.addEventListener('mouseenter', this.handleHoverSound);
            element.addEventListener('click', this.handleSelectSound);
        });

        this.boundClickableElements = elements;
    }

    detachSoundHandlers() {
        if (!this.boundClickableElements.length) {
            return;
        }

        this.boundClickableElements.forEach(element => {
            element.removeEventListener('mouseenter', this.handleHoverSound);
            element.removeEventListener('click', this.handleSelectSound);
        });

        this.boundClickableElements = [];
    }
}

customElements.define('tactical-menu', TacticalMenu);
