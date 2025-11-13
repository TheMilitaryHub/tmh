(function () {
  const STATE_SELECTOR = '.us-map__state';
  const stateFilesData = window.STATE_RESOURCE_FILES || {};

  document.addEventListener('DOMContentLoaded', () => {
    const mapMount = document.querySelector('[data-role="state-map"]');
    const panelApi = createStateFilesPanel();
    if (!mapMount) return;

    const stateData = Array.isArray(window.US_STATE_PATHS) ? window.US_STATE_PATHS : [];
    if (!stateData.length) {
      mapMount.innerHTML = '<p class="us-map__error">Unable to load the map right now.</p>';
      return;
    }

    try {
      renderMap(stateData, mapMount, (stateName) => {
        handleStateSelection(stateName, panelApi, stateFilesData);
      });
    } catch (error) {
      console.error('Unable to initialize state map', error);
      mapMount.innerHTML = '<p class="us-map__error">Unable to load the map right now.</p>';
    }
  });

  function renderMap(stateData, mount, onStateSelect) {
    const svg = createSvgRoot();

    stateData.forEach((state) => {
      const stateName = state.name;
      const pathData = state.d;
      if (!stateName || !pathData) return;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathData);
      path.classList.add('us-map__state');
      path.dataset.state = stateName;
      path.dataset.file = state.file || sanitize(stateName);
      path.setAttribute('tabindex', '0');
      path.setAttribute('role', 'button');
      path.setAttribute('aria-label', `${stateName} resources download`);
      svg.appendChild(path);
    });

    mount.innerHTML = '';
    mount.appendChild(svg);

    svg.addEventListener('click', (event) => {
      const target = event.target.closest(STATE_SELECTOR);
      if (!target) return;
      if (onStateSelect) {
        onStateSelect(target.dataset.state);
      }
    });

    svg.addEventListener('keydown', (event) => {
      if (!event.target.matches(STATE_SELECTOR)) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (onStateSelect) {
          onStateSelect(event.target.dataset.state);
        }
      }
    });
  }

  function createSvgRoot() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('us-map__svg');
    svg.setAttribute('viewBox', '0 0 960 600');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'United States map with clickable states');
    return svg;
  }

  function sanitize(name) {
    return name.toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function stateNameToKey(name) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function handleStateSelection(stateName, panelApi, filesData) {
    if (!panelApi || !stateName) return;
    const key = stateNameToKey(stateName);
    const files = filesData[key] || [];
    panelApi.show(stateName, files);
  }

  function createStateFilesPanel() {
    const panel = document.querySelector('[data-role="state-files-panel"]');
    if (!panel) return null;
    const nameEl = panel.querySelector('[data-role="state-files-name"]');
    const statusEl = panel.querySelector('[data-role="state-files-status"]');
    const emptyEl = panel.querySelector('[data-role="state-files-empty"]');
    const formEl = panel.querySelector('[data-role="state-files-form"]');
    const selectEl = panel.querySelector('[data-role="state-file-select"]');
    const buttonEl = panel.querySelector('[data-role="state-file-open"]');
    const anchor = createHiddenAnchor();

    if (buttonEl && selectEl) {
      buttonEl.addEventListener('click', () => {
        const value = selectEl.value;
        if (!value) return;
        anchor.href = value;
        anchor.click();
      });
      selectEl.addEventListener('change', () => {
        buttonEl.disabled = !selectEl.value;
      });
    }

    return {
      show(stateName, files) {
        panel.classList.remove('hidden');
        if (nameEl) {
          nameEl.textContent = `${stateName} resources`;
        }
        if (statusEl) {
          statusEl.textContent = files.length
            ? `Choose from ${files.length} available file${files.length === 1 ? '' : 's'}.`
            : 'No files uploaded yet for this state.';
        }
        if (!files.length) {
          if (emptyEl) emptyEl.classList.remove('hidden');
          if (formEl) formEl.classList.add('hidden');
          if (buttonEl) buttonEl.disabled = true;
          return;
        }
        if (emptyEl) emptyEl.classList.add('hidden');
        if (formEl) formEl.classList.remove('hidden');
        if (selectEl) {
          selectEl.innerHTML = files
            .map((file) => `<option value="${file.path}">${file.name}</option>`)
            .join('');
        }
        if (buttonEl) {
          buttonEl.disabled = false;
        }
      }
    };
  }

  function createHiddenAnchor() {
    const anchor = document.createElement('a');
    anchor.style.display = 'none';
    anchor.setAttribute('target', '_blank');
    anchor.setAttribute('rel', 'noopener');
    document.body.appendChild(anchor);
    return anchor;
  }
})();
