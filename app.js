
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
    pending: 'Не отправлено',
    review: 'На проверке',
    complete: 'Выполнено',
    rejected: 'Отклонено',
    'Не отправлено': 'Не отправлено',
    'На проверке': 'На проверке',
    'Выполнено': 'Выполнено',
    'Отклонено': 'Отклонено'
  };

  /* При открытии регистрации завершаем предыдущую сессию */
  if ($('#register-form')) {
    sessionStorage.removeItem(idKey);
    playerId = '';
  }

  /* Проверка адреса API */
  function apiReady() {
    return /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec\/?$/.test(api);
  }

  /* Запрос JSON */
  async function requestJson(url, options = {}) {
    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`Ошибка сервера (${response.status})`);
    }

    const data = await response.json();

    if (data && data.ok === false) {
      throw new Error(data.error || 'Сервис вернул ошибку');
    }

    return data;
  }

  /* GET-запрос к API */
  async function get(action, params = {}) {
    if (!apiReady()) {
      throw new Error('Проверьте API_URL в config.js');
    }

    const query = new URLSearchParams({
      action,
      ...params
    });

    return requestJson(`${api}?${query.toString()}`);
  }

  /* Вывод сообщения */
  function message(element, text, success = false) {
    if (!element) return;

    element.textContent = text;
    element.className = `form-message${success ? ' success' : ''}`;
  }

  /* Статус задания */
  function statusFor(number) {
    return progress[number]?.status || 'Не отправлено';
  }

  /* Подсчёт выполненных и проверяемых */
  function counts() {
    let done = 0;
    let review = 0;

    Object.values(progress).forEach(item => {
      const status = item.status;

      if (status === 'Выполнено' || status === 'complete') {
        done++;
      }

      if (status === 'На проверке' || status === 'review') {
        review++;
      }
    });

    return { done, review };
  }

  /* Обновление ёлки */
  function updateTree() {
    const completed = counts().done;

    const counter = $('#tree-counter');
    if (counter) counter.textContent = `${completed}/12`;

    const fill = $('#tree-progress-fill');
    if (fill) fill.style.width = `${completed / 12 * 100}%`;

    const text = $('#tree-progress-text');
    if (text) text.textContent = `Выполнено ${completed} из 12 заданий`;

    document.querySelectorAll('.ornament[data-task]').forEach(button => {
      button.classList.remove('is-review', 'is-complete', 'is-rejected');

      const status = statusFor(Number(button.dataset.task));

      if (status === 'На проверке' || status === 'review') {
        button.classList.add('is-review');
      }

      if (status === 'Выполнено' || status === 'complete') {
        button.classList.add('is-complete');
      }

      if (status === 'Отклонено' || status === 'rejected') {
        button.classList.add('is-rejected');
      }
    });
  }

  /* Обновление личного кабинета */
  function updateCabinet() {
    const idLabel = $('#player-id');
    if (idLabel) idLabel.textContent = playerId || 'Не зарегистрирован';

    const { done, review } = counts();

    if ($('#cabinet-completed')) {
      $('#cabinet-completed').textContent = `${done}/12`;
    }

    if ($('#cabinet-review')) {
      $('#cabinet-review').textContent = review;
    }

    const percent = Math.round(done / 12 * 100);

    if ($('#cabinet-percent')) {
      $('#cabinet-percent').textContent = `${percent}%`;
    }

    if ($('#cabinet-progress-fill')) {
      $('#cabinet-progress-fill').style.width = `${percent}%`;
    }

    const statusMessage = $('#cabinet-progress-message');

    if (statusMessage) {
      if (done === 0) {
        statusMessage.textContent = 'Приключение только начинается!';
      } else if (done < 4) {
        statusMessage.textContent = 'Отличное начало! Продолжай!';
      } else if (done < 8) {
        statusMessage.textContent = 'Ты уже далеко продвинулся!';
      } else if (done < 12) {
        statusMessage.textContent = 'Финал близко!';
      } else {
        statusMessage.textContent = 'Все задания выполнены!';
      }
    }
  }

  /* Вход участника */
  const registrationForm = $('#register-form');

  if (registrationForm) {
    registrationForm.addEventListener('submit', async event => {
      event.preventDefault();

      const enteredId = $('#vk-id')?.value.trim();
      const password = $('#vk-password')?.value || '';
      const output = $('#register-message');
      const submitButton = registrationForm.querySelector('button[type="submit"]');

      if (!enteredId || !password) {
        message(output, 'Заполните VK ID и пароль.');
        return;
      }

      if (!apiReady()) {
        message(output, 'Сервис не подключён. Проверьте config.js.');
        return;
      }

      if (submitButton) submitButton.disabled = true;

      try {
        const result = await get('player', {
          id: enteredId,
          password
        });

        if (!result.player?.id) {
          throw new Error('Профиль участника не найден.');
        }

        playerId = String(result.player.id);
        sessionStorage.setItem(idKey, playerId);

        message(output, 'Вход выполнен!', true);
        location.href = 'cabinet.html';

      } catch (error) {
        message(
          output,
          error.message || 'Не удалось войти. Проверьте VK ID и пароль.'
        );
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  }

  /* Выход и смена аккаунта */
  const changeButton = $('#change-id');

  if (changeButton) {
    changeButton.addEventListener('click', () => {
      sessionStorage.removeItem(idKey);
      location.href = 'register.html';
    });
  }

  /* Проверка входа на странице ёлки */
  if ($('#tree-player')) {
    if (!playerId) {
      location.href = 'register.html';
      return;
    }

    $('#tree-player').textContent = playerId;
  }

  /* Модальное окно заданий */
  const modal = $('#task-modal');

  if (modal) {
    function openTask(number) {
      const task = tasks.find(item => Number(item.number) === number);

      if (!task) {
        const notice = $('.api-notice');

        if (notice) {
          notice.hidden = false;
          notice.textContent = 'Задание пока не загружено. Обновите страницу чуть позже.';
        }

        return;
      }

      if ($('#task-number')) {
        $('#task-number').textContent =
          `MISSION ${String(number).padStart(2, '0')}`;
      }

      if ($('#task-title')) {
        $('#task-title').textContent = task.title || `Задание ${number}`;
      }

      if ($('#task-text')) {
        $('#task-text').textContent =
          task.description || 'Описание задания пока не загружено.';
      }

      if ($('#task-condition')) {
        $('#task-condition').textContent =
          task.conditions || 'Условия пока не указаны.';
      }

      if ($('#task-deadline')) {
        $('#task-deadline').textContent =
          task.deadline || 'До конца активности';
      }

      if ($('#task-toy')) {
        $('#task-toy').textContent = number;
      }

      const status = statusFor(number);
      const statusElement = $('#task-status');

      if (statusElement) {
        statusElement.textContent = statusText[status] || status;
        statusElement.className =
          `status-${String(status).toLowerCase().replace(/[^a-zа-яё]/g, '')}`;
      }

      modal.classList.add('show');
      modal.setAttribute('aria-hidden', 'false');
    }

    document.querySelectorAll('.ornament[data-task]').forEach(button => {
      button.addEventListener('click', () => {
        openTask(Number(button.dataset.task));
      });
    });

    function closeModal() {
      modal.classList.remove('show');
      modal.setAttribute('aria-hidden', 'true');
    }

    $('#task-close')?.addEventListener('click', closeModal);
    $('#task-ok')?.addEventListener('click', closeModal);

    modal.addEventListener('click', event => {
      if (event.target === modal) closeModal();
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && modal.classList.contains('show')) {
        closeModal();
      }
    });
  }

  /* =====================================================
     НЕЗАВИСИМАЯ ЗАГРУЗКА ЗАДАНИЙ И ПРОГРЕССА
     ===================================================== */

  async function loadTasks() {
    try {
      const response = await get('tasks');

      if (!Array.isArray(response.tasks)) {
        throw new Error('Сервер вернул некорректный список заданий.');
      }

      tasks = response.tasks;

      const notice = $('.api-notice');
      if (notice) notice.hidden = true;

    } catch (error) {
      tasks = [];

      const notice = $('.api-notice');

      if (notice) {
        notice.hidden = false;
        notice.textContent =
          `Не удалось загрузить задания: ${error.message}`;
      }
    }
  }

  async function loadProgress() {
    if (!playerId) return;

    try {
      const response = await get('progress', {
        id: playerId
      });

      if (!Array.isArray(response.items)) {
        throw new Error('Сервер вернул некорректный прогресс.');
      }

      Object.keys(progress).forEach(key => delete progress[key]);

      response.items.forEach(item => {
        progress[item.number] = item;
      });

    } catch (error) {
      const notice = $('.api-notice');

      if (notice) {
        notice.hidden = false;
        notice.textContent =
          'Задания загружены, но прогресс пока недоступен.';
      }
    }
  }

  /* Запуск */
  (async function init() {
    await loadTasks();
    await loadProgress();

    updateTree();
    updateCabinet();
  })();

})();
