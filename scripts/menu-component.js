const template = document.createElement('template');

template.innerHTML = `
    <style>
        :host {
            display: block;
            width: 100%;
            position: sticky;
            top: 0;
            z-index: 1000;
            background: linear-gradient(120deg, #0b0b0b, #111827);
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.6);
        }

        .menu-container {
            position: relative;
            width: 100%;
            margin: 0 auto;
            padding: 1.25rem 1.25rem 2.5rem;
            max-width: 1024px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            gap: 0.75rem;
        }

        .menu-toggle {
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
            transition: transform 0.3s ease, background 0.3s ease;
            background: radial-gradient(circle at top, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0));
            border: 1px solid rgba(255, 255, 255, 0);
            border-radius: 999px;
            padding: 0;
            color: #f7f7f7;
            position: absolute;
            bottom: -1.95rem;
            left: 50%;
            transform: translate(-50%, 0);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
        }

        .menu-toggle svg {
            width: 100%;
            height: 100%;
            fill: currentColor;
        }

        .menu-toggle:focus-visible {
            outline: 2px solid white;
            outline-offset: 4px;
        }

        .menu-toggle:hover {
            background: rgba(255, 255, 255, 0.16);
        }

        .menu-toggle.flipped {
            transform: translate(-50%, 0) rotate(180deg);
        }

        .menu-options {
            display: flex;
            flex-direction: column;
            align-items: stretch;
            background-color: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 20px;
            overflow: hidden;
            transition: max-height 0.4s ease, opacity 0.4s ease;
            max-height: 0;
            opacity: 0;
            margin: 0;
            width: 100%;
            max-width: 960px;
            backdrop-filter: blur(8px);
            flex: 1;
        }

        .menu-options.show {
            max-height: 480px;
            opacity: 1;
        }

        .menu-options a {
            color: #f7f7f7;
            padding: 0.9rem 1.25rem;
            text-decoration: none;
            text-align: center;
            border-bottom: 1px solid rgba(255, 255, 255, 0.12);
            font-weight: 600;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            transition: background 0.3s ease, transform 0.2s ease;
            min-width: 0;
            flex: 1 1 auto;
        }

        .menu-options a:last-child {
            border-bottom: none;
        }

        @media (hover: hover) {
            .menu-options a:hover {
                animation: bounce 0.3s;
                background-color: rgba(255, 255, 255, 0.12);
            }
        }

        @keyframes bounce {
            0%, 100% {
                transform: translateY(0);
            }
            50% {
                transform: translateY(-10px);
            }
        }

        :host([data-mode="desktop"]) .menu-container {
        padding-top: 1.25rem;
        padding-bottom: 2.5rem;
        }

        :host([data-mode="desktop"]) .menu-options {
            flex-direction: row;
            justify-content: center;
            border-radius: 999px;
        }

        :host([data-mode="desktop"]) .menu-options.show {
            max-height: none;
            opacity: 1;
        }

        :host([data-mode="desktop"]) .menu-options a {
            border-bottom: none;
            border-right: 1px solid rgba(255, 255, 255, 0.12);
            padding: 0.85rem 1.5rem;
            min-width: auto;
            flex: 0;
        }

        :host([data-mode="desktop"]) .menu-options a:last-child {
            border-right: none;
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

class ModularMenu extends HTMLElement {
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
        this.isDesktop = false;
        this.handleMediaChange = this.handleMediaChange.bind(this);

        this.handleToggle = this.handleToggle.bind(this);
        this.handleHoverSound = this.handleHoverSound.bind(this);
        this.handleSelectSound = this.handleSelectSound.bind(this);
        this.handleAnchorClick = this.handleAnchorClick.bind(this);
    }

    connectedCallback() {
        this.renderMenu();
        this.menuToggleEl.addEventListener('click', this.handleToggle);
        this.desktopMedia = window.matchMedia('(min-width: 768px)');
        this.desktopMedia.addEventListener('change', this.handleMediaChange);
        this.handleMediaChange(this.desktopMedia);
    }

    disconnectedCallback() {
        this.menuToggleEl.removeEventListener('click', this.handleToggle);
        this.detachSoundHandlers();
        if (this.desktopMedia) {
            this.desktopMedia.removeEventListener('change', this.handleMediaChange);
        }
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
        const shouldOpen = !this.menuOptionsEl.classList.contains('show');
        this.setMenuOpen(shouldOpen);
    }

    setMenuOpen(isOpen) {
        this.menuOptionsEl.classList.toggle('show', isOpen);
        this.menuToggleEl.classList.toggle('flipped', isOpen);
        this.menuToggleEl.setAttribute('aria-expanded', String(Boolean(isOpen)));
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
            console.warn(`[modular-menu] Unable to parse ${attrName}:`, error);
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

        this.setMenuOpen(false);

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
            if (element.tagName === 'A') {
                element.addEventListener('click', this.handleAnchorClick);
            }
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
            if (element.tagName === 'A') {
                element.removeEventListener('click', this.handleAnchorClick);
            }
        });

        this.boundClickableElements = [];
    }

    handleMediaChange(event) {
        this.isDesktop = Boolean(event.matches);
        if (this.isDesktop) {
            this.setAttribute('data-mode', 'desktop');
        } else {
            this.removeAttribute('data-mode');
            this.setMenuOpen(false);
        }
    }

    handleAnchorClick() {
        if (this.isDesktop) {
            return;
        }
        this.setMenuOpen(false);
    }
}

customElements.define('modular-menu', ModularMenu);
