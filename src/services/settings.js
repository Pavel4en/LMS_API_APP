/**
 * Модуль для работы с настройками приложения
 */

const { ipcRenderer } = require('electron');

// Значения настроек по умолчанию
const DEFAULT_SETTINGS = {
  feedback: {
    formUrl: 'https://forms.yandex.ru/cloud/6743cc36c417f388901ebaf6/',
    courseNameFieldId: 'answer_long_text_64154736',
    courseIdFieldId: 'answer_long_text_70163274',
    materialText: `Уважаемые студенты!<br><br>
Просим вас принять участие в опросе по нашей дисциплине.<br>
Ваше мнение очень важно для улучшения качества обучения и организации учебного процесса.<br><br>
Ссылка на обратную связь по дисциплине: <a href="{link}" target="_blank">ссылка</a><br><br>
Заранее благодарим за вашу активность!`
  }
};

/**
 * Загружает настройки из локального хранилища
 * @returns {Promise<Object>} Настройки приложения
 */
async function loadSettings() {
  try {
    const settings = await ipcRenderer.invoke('load-settings');
    return settings || DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Ошибка при загрузке настроек:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Сохраняет настройки в локальное хранилище
 * @param {Object} settings - Объект с настройками для сохранения
 * @returns {Promise<void>}
 */
async function saveSettings(settings) {
  try {
    await ipcRenderer.invoke('save-settings', settings);
    return true;
  } catch (error) {
    console.error('Ошибка при сохранении настроек:', error);
    return false;
  }
}

export { loadSettings, saveSettings, DEFAULT_SETTINGS };