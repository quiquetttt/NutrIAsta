(() => {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const navItems = [
    { id: 'today', label: 'Hoy', mark: '⌂', eyebrow: 'DOMINGO, 26 DE JULIO' },
    { id: 'diary', label: 'Diario', mark: '▤', eyebrow: 'DOMINGO, 26 DE JULIO' },
    { id: 'training', label: 'Entrenar', mark: '◆', eyebrow: 'JULIO 2026' },
    { id: 'inventory', label: 'Inventario', mark: '▣', eyebrow: 'ALIMENTOS EN CASA' },
    { id: 'profile', label: 'Perfil', mark: '●', eyebrow: 'DATOS LOCALES' },
  ];

  const state = {
    view: navItems.some((item) => item.id === params.get('view')) ? params.get('view') : 'today',
    online: params.get('offline') !== '1',
    waterMl: 1250,
    inventoryTab: params.get('inventory') === 'shopping' ? 'shopping' : 'stock',
    profilePanel: ['weight', 'backup'].includes(params.get('panel')) ? params.get('panel') : 'overview',
    restoreState: params.get('restore') === 'activated' ? 'activated' : 'candidate',
    pendingTimer: null,
  };

  if (params.get('text') === '200') {
    document.documentElement.classList.add('text-scale-200');
  }
  if (params.get('focus') === 'restore') {
    document.documentElement.classList.add('restore-focus');
  }

  const views = [...document.querySelectorAll('[data-view]')];
  const title = document.querySelector('#view-title');
  const eyebrow = document.querySelector('#view-eyebrow');
  const bottomNav = document.querySelector('.bottom-nav');
  const railNav = document.querySelector('.rail-nav');
  const dialog = document.querySelector('#transaction-dialog');
  const pendingBar = document.querySelector('#pending-bar');
  const toast = document.querySelector('#toast');
  const toastText = document.querySelector('#toast-text');

  function navButton(item, rail = false) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.viewTarget = item.id;
    button.innerHTML = `<span aria-hidden="true">${item.mark}</span><strong>${item.label}</strong>`;
    if (rail) button.className = 'rail-nav__button';
    return button;
  }

  navItems.forEach((item) => railNav.append(navButton(item, true)));

  function setView(nextView) {
    const definition = navItems.find((item) => item.id === nextView) ?? navItems[0];
    state.view = definition.id;

    views.forEach((view) => {
      const active = view.dataset.view === state.view;
      view.hidden = !active;
      view.classList.toggle('is-active', active);
    });

    document.querySelectorAll('[data-view-target]').forEach((button) => {
      const active = button.dataset.viewTarget === state.view;
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });

    title.textContent = definition.label;
    eyebrow.textContent = definition.eyebrow;
    window.scrollTo({ top: 0, behavior: 'auto' });

    if (state.view === 'profile' && state.profilePanel === 'weight') {
      requestAnimationFrame(drawWeightChart);
    }
  }

  function setOnline(online) {
    state.online = online;
    document.body.classList.toggle('is-offline', !online);
    document.querySelectorAll('[data-network-label]').forEach((label) => {
      label.textContent = online ? 'Online' : 'Offline';
    });
    document.querySelector('#toggle-offline').textContent = online ? 'Simular offline' : 'Volver online';
  }

  function setInventoryTab(nextTab) {
    state.inventoryTab = nextTab;
    document.querySelectorAll('[data-inventory-tab]').forEach((button) => {
      button.setAttribute('aria-selected', String(button.dataset.inventoryTab === nextTab));
    });
    document.querySelectorAll('[data-inventory-panel]').forEach((panel) => {
      const active = panel.dataset.inventoryPanel === nextTab;
      panel.hidden = !active;
      panel.classList.toggle('is-active', active);
    });
  }

  function setProfilePanel(nextPanel) {
    state.profilePanel = nextPanel;
    document.querySelectorAll('[data-profile-panel]').forEach((panel) => {
      const active = panel.dataset.profilePanel === nextPanel;
      panel.hidden = !active;
      panel.classList.toggle('is-active', active);
    });
    if (nextPanel === 'weight') requestAnimationFrame(drawWeightChart);
  }

  function showToast(message) {
    toastText.textContent = message;
    toast.hidden = false;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
      toast.hidden = true;
    }, 2600);
  }

  function showPending(message = 'Aplicando operación local…', persistent = false) {
    const strong = pendingBar.querySelector('strong');
    strong.textContent = message;
    pendingBar.hidden = false;
    window.clearTimeout(state.pendingTimer);
    if (!persistent) {
      state.pendingTimer = window.setTimeout(() => {
        pendingBar.hidden = true;
        showToast('Simulación terminada sin escribir datos reales.');
      }, 1300);
    }
  }

  const dialogContent = {
    depletion: {
      eyebrow: 'REVISIÓN ANTES DE CAMBIAR DATOS',
      title: 'Se va a acabar carne picada',
      copy: 'Este consumo dejará la existencia ficticia en cero.',
      values: [
        ['Disponible', '200 g'],
        ['Este consumo', '200 g'],
        ['Después', '0 g'],
      ],
      note: 'La operación todavía no ha modificado nutrición, inventario ni compra.',
      actions: [
        ['Consumir y añadir a compra', 'primary', 'Consumo simulado y alimento añadido a la compra.'],
        ['Consumir sin añadir', 'secondary', 'Consumo simulado sin añadir a la compra.'],
        ['Cancelar', 'plain', null],
      ],
    },
    shortage: {
      eyebrow: 'CANTIDAD INSUFICIENTE',
      title: 'No hay suficiente arroz ficticio',
      copy: 'El registro nutricional puede conservar la cantidad completa, pero el inventario no debe aparentar exactitud.',
      values: [
        ['Solicitado', '500 g'],
        ['Disponible', '450 g'],
        ['Faltan', '50 g'],
      ],
      note: 'Si descuentas solo lo disponible, el saldo quedará en 0 g y se mostrará una diferencia de inventario.',
      actions: [
        ['Descontar 450 g disponibles', 'primary', 'Diferencia ficticia registrada: solicitado 500 g, descontado 450 g.'],
        ['No descontar inventario', 'secondary', 'Consumo ficticio conservado sin cambiar inventario.'],
        ['Cancelar y corregir', 'plain', null],
      ],
    },
    undo: {
      eyebrow: 'COMPRA COMPLETADA · EJEMPLO',
      title: 'Deshacer compra ficticia',
      copy: 'Se crearían movimientos inversos y los elementos volverían a una lista editable.',
      values: [
        ['Carne picada', '−500 g'],
        ['Leche', '−250 ml'],
        ['Saldo mínimo', '0 g / 0 ml'],
      ],
      note: 'Si una inversión produjera saldo negativo, la operación completa quedaría bloqueada.',
      actions: [
        ['Deshacer compra', 'danger', 'Compra ficticia deshecha mediante movimientos inversos.'],
        ['Conservar compra', 'plain', null],
      ],
    },
  };

  function openDialog(kind) {
    const content = dialogContent[kind];
    if (!content) return;
    dialog.dataset.kind = kind;
    document.querySelector('#dialog-eyebrow').textContent = content.eyebrow;
    document.querySelector('#dialog-title').textContent = content.title;
    document.querySelector('#dialog-copy').textContent = content.copy;
    document.querySelector('#dialog-values').innerHTML = content.values
      .map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`)
      .join('');
    document.querySelector('#dialog-note').textContent = content.note;
    const actions = document.querySelector('#dialog-actions');
    actions.replaceChildren();
    content.actions.forEach(([label, tone, message]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = tone === 'plain'
        ? 'button button--secondary'
        : `button button--${tone}`;
      button.textContent = label;
      button.addEventListener('click', () => {
        dialog.close();
        if (message) {
          showPending('Aplicando transacción ficticia…');
          window.setTimeout(() => showToast(message), 1400);
        }
      });
      actions.append(button);
    });
    dialog.showModal();
    requestAnimationFrame(() => document.querySelector('#dialog-title').focus());
  }

  function setRestoreState(nextState) {
    state.restoreState = nextState;
    const card = document.querySelector('#restore-card');
    const restoreTitle = document.querySelector('#restore-title');
    const explanation = document.querySelector('#restore-explanation');
    const actions = document.querySelector('#restore-actions');
    card.dataset.restoreState = nextState;

    if (nextState === 'activated') {
      restoreTitle.textContent = 'Restauración pendiente';
      explanation.textContent = 'Estás viendo el candidato ficticio. Los datos anteriores se conservan para volver.';
      actions.innerHTML = `
        <button class="button button--primary" type="button" data-confirm-restore>Confirmar restauración</button>
        <button class="button button--secondary" type="button" data-rollback>Volver a datos anteriores</button>
      `;
    } else if (nextState === 'rolledback') {
      restoreTitle.textContent = 'Datos anteriores activos';
      explanation.textContent = 'Has vuelto a los datos ficticios anteriores. El candidato continúa disponible.';
      actions.innerHTML = `
        <button class="button button--primary" type="button" data-reactivate>Reactivar candidato</button>
        <button class="button button--secondary" type="button">Conservar datos anteriores</button>
      `;
    } else {
      restoreTitle.textContent = 'Candidato verificado';
      explanation.textContent = 'Los datos actuales siguen activos. Puedes cancelar sin modificarlos.';
      actions.innerHTML = `
        <button class="button button--primary" type="button" data-activate-restore>Activar candidato</button>
        <button class="button button--secondary" type="button">Cancelar sin cambiar datos</button>
      `;
    }
  }

  function drawWeightChart() {
    const canvas = document.querySelector('#weight-chart');
    if (!canvas || canvas.clientWidth === 0) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(280, canvas.clientWidth);
    const height = 180;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const context = canvas.getContext('2d');
    context.scale(ratio, ratio);
    context.clearRect(0, 0, width, height);

    const values = [71.2, 71.0, 70.8, 70.9, 70.4, 70.2, 70.0];
    const min = 69.6;
    const max = 71.6;
    const pad = { left: 34, right: 12, top: 16, bottom: 20 };
    const chartWidth = width - pad.left - pad.right;
    const chartHeight = height - pad.top - pad.bottom;
    const x = (index) => pad.left + (chartWidth * index) / (values.length - 1);
    const y = (value) => pad.top + ((max - value) / (max - min)) * chartHeight;

    context.font = '11px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
    context.fillStyle = '#64727c';
    context.strokeStyle = '#dce5df';
    context.lineWidth = 1;
    [70, 70.5, 71, 71.5].forEach((tick) => {
      const lineY = y(tick);
      context.beginPath();
      context.moveTo(pad.left, lineY);
      context.lineTo(width - pad.right, lineY);
      context.stroke();
      context.fillText(tick.toLocaleString('es-ES'), 2, lineY + 4);
    });

    const gradient = context.createLinearGradient(0, pad.top, 0, height - pad.bottom);
    gradient.addColorStop(0, 'rgba(34, 94, 133, .22)');
    gradient.addColorStop(1, 'rgba(34, 94, 133, 0)');
    context.beginPath();
    values.forEach((value, index) => {
      if (index === 0) context.moveTo(x(index), y(value));
      else context.lineTo(x(index), y(value));
    });
    context.lineTo(x(values.length - 1), height - pad.bottom);
    context.lineTo(x(0), height - pad.bottom);
    context.closePath();
    context.fillStyle = gradient;
    context.fill();

    context.beginPath();
    values.forEach((value, index) => {
      if (index === 0) context.moveTo(x(index), y(value));
      else context.lineTo(x(index), y(value));
    });
    context.strokeStyle = '#225e85';
    context.lineWidth = 3;
    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.stroke();

    values.forEach((value, index) => {
      context.beginPath();
      context.arc(x(index), y(value), index === values.length - 1 ? 5 : 3.5, 0, Math.PI * 2);
      context.fillStyle = index === values.length - 1 ? '#11784b' : '#ffffff';
      context.fill();
      context.strokeStyle = index === values.length - 1 ? '#11784b' : '#225e85';
      context.lineWidth = 2;
      context.stroke();
    });
  }

  document.addEventListener('click', (event) => {
    const target = event.target.closest('button');
    if (!target) return;

    if (target.dataset.viewTarget) {
      setView(target.dataset.viewTarget);
      return;
    }

    if (target.dataset.go) {
      setView(target.dataset.go);
      if (target.dataset.inventoryTarget) setInventoryTab(target.dataset.inventoryTarget);
      return;
    }

    if (target.dataset.inventoryTab) {
      setInventoryTab(target.dataset.inventoryTab);
      return;
    }

    if (target.hasAttribute('data-switch-shopping')) {
      setInventoryTab('shopping');
      return;
    }

    if (target.dataset.profileTarget) {
      setProfilePanel(target.dataset.profileTarget);
      return;
    }

    if (target.dataset.modal) {
      openDialog(target.dataset.modal);
      return;
    }

    if (target.dataset.water) {
      state.waterMl += Number(target.dataset.water);
      document.querySelector('#water-total').textContent = `${state.waterMl.toLocaleString('es-ES')} ml`;
      showToast(`Agua ficticia actualizada a ${state.waterMl.toLocaleString('es-ES')} ml.`);
      return;
    }

    if (target.hasAttribute('data-pending-action')) {
      showPending();
      return;
    }

    if (target.hasAttribute('data-activate-restore') || target.id === 'activate-restore') {
      showPending('Activando candidato ficticio…');
      window.setTimeout(() => setRestoreState('activated'), 1350);
      return;
    }

    if (target.hasAttribute('data-rollback')) {
      showPending('Volviendo a datos anteriores…');
      window.setTimeout(() => setRestoreState('rolledback'), 1350);
      return;
    }

    if (target.hasAttribute('data-reactivate')) {
      showPending('Reactivando candidato ficticio…');
      window.setTimeout(() => setRestoreState('activated'), 1350);
      return;
    }

    if (target.hasAttribute('data-confirm-restore')) {
      showPending('Confirmando restauración ficticia…');
      return;
    }
  });

  document.querySelector('#toggle-offline').addEventListener('click', () => {
    setOnline(!state.online);
    showToast(state.online ? 'Estado visual Online.' : 'Estado visual Offline. Todos los recursos siguen siendo locales.');
  });

  document.querySelector('#simulate-pending').addEventListener('click', () => {
    showPending('Aplicando operación local ficticia…');
  });

  document.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  document.querySelectorAll('.range-tabs button').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.range-tabs button').forEach((item) => item.classList.remove('is-selected'));
      button.classList.add('is-selected');
      drawWeightChart();
    });
  });

  window.addEventListener('resize', () => {
    if (state.profilePanel === 'weight') drawWeightChart();
  });

  setOnline(state.online);
  setInventoryTab(state.inventoryTab);
  setProfilePanel(state.profilePanel);
  setRestoreState(state.restoreState);
  setView(state.view);

  if (params.get('modal')) {
    setView('inventory');
    requestAnimationFrame(() => openDialog(params.get('modal')));
  }

  if (params.get('pending') === '1') {
    showPending('Operación local ficticia pendiente…', true);
  }
})();
