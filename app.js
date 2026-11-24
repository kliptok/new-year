(() => {
  'use strict';
  const cfg = window.KLIPTOK_CONFIG || {};
  const api = (cfg.API_URL || '').trim();
  const idKey = 'kliptok_vk_id';
  const $ = (selector) => document.querySelector(selector);
  let playerId = sessionStorage.getItem(idKey) || '';
  let tasks = [];
  const progress = {};
  const statusText = {
    pending: 'Не отправлено', review: 'На проверке', complete: 'Выполнено', rejected: 'Отклонено',
    'Не отправлено': 'Не отправлено', 'На проверке': 'На проверке',
    'Выполнено': 'Выполнено', 'Отклонено': 'Отклонено'
  };

  // Opening the sign-in page intentionally clears the current browser session (logout).
  if ($('#register-form')) {
    sessionStorage.removeItem(idKey);
    playerId = '';
  }

  function apiReady() {
    return /^https:\/\/script\.google\.com\/macros\/s\//.test(api) && !api.includes('ВСТАВЬТЕ');
  }
  async function requestJson(url, options) {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`Ошибка сервера (${response.status})`);
    const data = await response.json();
    if (data && data.ok === false) throw new Error(data.error || 'Сервис вернул ошибку');
    return data;
  }
  async function get(action, params = {}) {
    if (!apiReady()) throw new Error('Сначала подключите API_URL в config.js');
    const query = new URLSearchParams({ action, ...params });
    return requestJson(`${api}?${query.toString()}`);
  }
  function message(element, text, success = false) {
    if (!element) return;
    element.textContent = text;
    element.className = `form-message${success ? ' success' : ''}`;
  }
  function fallbackTasks() {
    return Array.from({ length: 12 }, (_, i) => ({
      number: i + 1, title: `Новогоднее задание ${i + 1}`,
      description: 'Описание задания появится после подключения Google Таблицы.',
      conditions: 'Подробные условия будут опубликованы организаторами.', deadline: 'Срок уточняется'
    }));
  }
  function statusFor(number) { return progress[number]?.status || 'pending'; }
  function counts() {
    let done = 0, review = 0;
    Object.values(progress).forEach((item) => {
      const status = item.status;
      if (status === 'Выполнено' || status === 'complete') done++;
      if (status === 'На проверке' || status === 'review') review++;
    });
    return { done, review };
  }
  function updateTree() {
    const completed = counts().done;
    const counter = $('#tree-counter');
    if (counter) counter.textContent = `${completed}/12`;
    const fill = $('#tree-progress-fill');
    if (fill) fill.style.width = `${completed / 12 * 100}%`;
    const text = $('#tree-progress-text');
    if (text) text.textContent = `Выполнено ${completed} из 12 заданий`;
    document.querySelectorAll('.ornament[data-task]').forEach((button) => {
      button.classList.remove('is-review', 'is-complete', 'is-rejected');
      const status = statusFor(Number(button.dataset.task));
      if (status === 'На проверке' || status === 'review') button.classList.add('is-review');
      if (status === 'Выполнено' || status === 'complete') button.classList.add('is-complete');
      if (status === 'Отклонено' || status === 'rejected') button.classList.add('is-rejected');
    });
  }
  function updateCabinet() {
    const idLabel = $('#player-id');
    if (idLabel) idLabel.textContent = playerId || 'Не зарегистрирован';
    const { done, review } = counts();
    if ($('#cabinet-completed')) $('#cabinet-completed').textContent = `${done}/12`;
    if ($('#cabinet-review')) $('#cabinet-review').textContent = review;
    const percent = Math.round(done / 12 * 100);
    if ($('#cabinet-percent')) $('#cabinet-percent').textContent = `${percent}%`;
    if ($('#cabinet-progress-fill')) $('#cabinet-progress-fill').style.width = `${percent}%`;
    const statusMessage = $('#cabinet-progress-message');
    if (statusMessage) statusMessage.textContent = done === 0 ? 'Приключение только начинается!' : done < 4 ? 'Отличное начало! Продолжай!' : done < 8 ? 'Ты уже далеко продвинулся!' : done < 12 ? 'Финал близко!' : 'Все задания отправлены/подтверждены!';
  }

  const registrationForm = $('#register-form');
  if (registrationForm) registrationForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const enteredId = $('#vk-id')?.value.trim();
    const password = $('#vk-password')?.value || '';
    const output = $('#register-message');
    const submitButton = registrationForm.querySelector('button[type="submit"]');
    if (!enteredId || !password) return;
    if (!apiReady()) { message(output, 'Сервис не подключён. Проверьте URL в config.js.'); return; }
    if (submitButton) submitButton.disabled = true;
    try {
      const result = await get('player', { id: enteredId, password });
      if (!result.player?.id) throw new Error('Ответ сервера не содержит профиль участника. Обратитесь к организаторам.');
      playerId = String(result.player.id);
      sessionStorage.setItem(idKey, playerId);
      message(output, 'Вход выполнен!', true);
      location.href = 'cabinet.html';
    } catch (error) {
      message(output, error.message || 'Не удалось войти. Проверьте VK ID и подключение.');
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  const changeButton = $('#change-id');
  if (changeButton) changeButton.addEventListener('click', () => {
    sessionStorage.removeItem(idKey);
    location.href = 'register.html';
  });
  if ($('#tree-player')) {
    if (!playerId) { location.href = 'register.html'; return; }
    $('#tree-player').textContent = playerId;
  }

  const modal = $('#task-modal');
  if (modal) {
    const openTask = (number) => {
      const task = tasks.find((item) => Number(item.number) === number) || fallbackTasks()[number - 1];
      if (!task) return;
      $('#task-number').textContent = `MISSION ${String(number).padStart(2, '0')}`;
      $('#task-title').textContent = task.title || `Задание ${number}`;
      $('#task-text').textContent = task.description || task.text || 'Описание задания пока не загружено.';
      $('#task-condition').textContent = task.conditions || task.condition || 'Условия пока не загружены.';
      $('#task-deadline').textContent = task.deadline || 'До конца активности';
      $('#task-toy').textContent = number;
      const status = statusFor(number);
      const statusElement = $('#task-status');
      statusElement.textContent = statusText[status] || status;
      statusElement.className = `status-${String(status).toLowerCase().replace(/[^a-zа-яё]/g, '')}`;
      modal.classList.add('show');
      modal.setAttribute('aria-hidden', 'false');
    };
    document.querySelectorAll('.ornament[data-task]').forEach((button) => button.addEventListener('click', () => openTask(Number(button.dataset.task))));
    const closeModal = () => { modal.classList.remove('show'); modal.setAttribute('aria-hidden', 'true'); };
    $('#task-close')?.addEventListener('click', closeModal);
    $('#task-ok')?.addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && modal.classList.contains('show')) closeModal(); });
  }

  (async () => {
    try {
      const [taskResponse, progressResponse] = await Promise.all([
        get('tasks'), playerId ? get('progress', { id: playerId }) : Promise.resolve({ items: [] })
      ]);
      tasks = Array.isArray(taskResponse.tasks) ? taskResponse.tasks : [];
      (progressResponse.items || []).forEach((item) => { progress[item.number] = item; });
    } catch (error) {
      tasks = fallbackTasks();
      const notice = $('.api-notice');
      if (notice) { notice.hidden = false; notice.textContent = 'Не удалось загрузить данные. Проверьте подключение к таблице и обновите страницу.'; }
    }
    if (!tasks.length) tasks = fallbackTasks();
    updateTree();
    updateCabinet();
  })();
})();
