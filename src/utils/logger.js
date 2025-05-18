/**
 * Добавить лог в контейнер основного лога
 * @param {string} message - Сообщение для логирования 
 */
function addLog(message) {
  const logContainer = document.getElementById('log');
  if (!logContainer) return;
  
  const time = new Date().toLocaleTimeString();
  const p = document.createElement('p');
  p.textContent = `[${time}] ${message}`;
  logContainer.appendChild(p);
  logContainer.scrollTop = logContainer.scrollHeight;
  
  // Отправка лога в основной процесс для системного логирования
  if (window.electronAPI?.logMessage) {
    window.electronAPI.logMessage(message);
  }
}

/**
 * Добавить лог в контейнер лога материалов
 * @param {string} message - Сообщение для логирования
 */
function addLogMaterials(message) {
  const logMaterials = document.getElementById('logMaterials');
  if (!logMaterials) return;
  
  const time = new Date().toLocaleTimeString();
  const p = document.createElement('p');
  p.textContent = `[${time}] ${message}`;
  logMaterials.appendChild(p);
  logMaterials.scrollTop = logMaterials.scrollHeight;
  
  if (window.electronAPI?.logMessage) {
    window.electronAPI.logMessage(message);
  }
}

/**
 * Добавить лог в контейнер лога обратной связи
 * @param {string} message - Сообщение для логирования
 */
function addLogFeedback(message) {
  const logFeedback = document.getElementById('logFeedback');
  if (!logFeedback) return;
  
  const time = new Date().toLocaleTimeString();
  const p = document.createElement('p');
  p.textContent = `[${time}] ${message}`;
  logFeedback.appendChild(p);
  logFeedback.scrollTop = logFeedback.scrollHeight;
  
  if (window.electronAPI?.logMessage) {
    window.electronAPI.logMessage(message);
  }
}

/**
 * Установить текст прогресса для основной вкладки
 * @param {string} message - Сообщение о прогрессе
 */
function setProgress(message) {
  const progressDiv = document.getElementById('progress');
  if (progressDiv) {
    progressDiv.textContent = message;
  }
}

/**
 * Установить текст прогресса для вкладки материалов
 * @param {string} message - Сообщение о прогрессе
 */
function setProgressMaterials(message) {
  const progressMaterials = document.getElementById('progressMaterials');
  if (progressMaterials) {
    progressMaterials.textContent = message;
  }
}

/**
 * Установить текст прогресса для вкладки обратной связи
 * @param {string} message - Сообщение о прогрессе
 */
function setProgressFeedback(message) {
  const progressFeedback = document.getElementById('progressFeedback');
  if (progressFeedback) {
    progressFeedback.textContent = message;
  }
}

export { 
  addLog, 
  addLogMaterials, 
  addLogFeedback, 
  setProgress, 
  setProgressMaterials, 
  setProgressFeedback 
};