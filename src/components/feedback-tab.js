import { processExcelFile, exportToExcel } from '../services/export';
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from '../services/settings';
import { addLogFeedback, setProgressFeedback } from '../utils/logger';
import { delay, formatTime } from '../utils/helpers';
import { createSection, addMaterialWithHyperlink, createPrefilledUrl } from '../api/feedback';

let exportFeedbackInProgress = false;

// Глобальные настройки обратной связи
let feedbackSettings = {
  formUrl: '',
  courseNameFieldId: '',
  courseIdFieldId: '',
  materialText: ''
};

/**
 * Инициализация вкладки "Обратная связь"
 */
async function initFeedbackTab() {
  // Загружаем настройки
  const settings = await loadSettings();
  feedbackSettings = settings.feedback || DEFAULT_SETTINGS.feedback;
  
  // Получаем DOM элементы
  const feedbackFileInput = document.getElementById('feedbackFileInput');
  const processFeedbackBtn = document.getElementById('processFeedbackBtn');
  const exportFeedbackBtn = document.getElementById('exportFeedbackBtn');
  const showSettingsBtn = document.getElementById('showSettingsBtn');
  const settingsModal = document.getElementById('settingsModal');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
  
  // Настройка модального окна настроек
  if (showSettingsBtn && settingsModal) {
    showSettingsBtn.addEventListener('click', () => {
      // Заполняем поля текущими настройками
      document.getElementById('formUrlInput').value = feedbackSettings.formUrl || '';
      document.getElementById('courseNameFieldIdInput').value = feedbackSettings.courseNameFieldId || '';
      document.getElementById('courseIdFieldIdInput').value = feedbackSettings.courseIdFieldId || '';
      document.getElementById('materialTextInput').value = feedbackSettings.materialText || '';
      
      settingsModal.style.display = 'block';
    });
    
    // Закрытие при клике вне модального окна
    window.addEventListener('click', (event) => {
      if (event.target === settingsModal) {
        settingsModal.style.display = 'none';
      }
    });
    
    // Кнопка "Сохранить"
    if (saveSettingsBtn) {
      saveSettingsBtn.addEventListener('click', async () => {
        // Получаем новые значения настроек
        const newSettings = {
          formUrl: document.getElementById('formUrlInput').value.trim(),
          courseNameFieldId: document.getElementById('courseNameFieldIdInput').value.trim(),
          courseIdFieldId: document.getElementById('courseIdFieldIdInput').value.trim(),
          materialText: document.getElementById('materialTextInput').value
        };
        
        // Обновляем локальные настройки
        feedbackSettings = newSettings;
        
        // Сохраняем настройки в файл
        const allSettings = await loadSettings();
        allSettings.feedback = newSettings;
        const success = await saveSettings(allSettings);
        
        if (success) {
          addLogFeedback('Настройки обратной связи успешно сохранены.');
        } else {
          addLogFeedback('Ошибка при сохранении настроек обратной связи.');
        }
        
        settingsModal.style.display = 'none';
      });
    }
    
    // Кнопка "Отмена"
    if (cancelSettingsBtn) {
      cancelSettingsBtn.addEventListener('click', () => {
        settingsModal.style.display = 'none';
      });
    }
  }
  
  // Устанавливаем обработчики событий для основных кнопок
  if (processFeedbackBtn) {
    processFeedbackBtn.addEventListener('click', () => {
      const files = feedbackFileInput?.files;
      if (!files || files.length === 0) {
        addLogFeedback('Выберите файл для обработки.');
        return;
      }
      
      if (exportFeedbackBtn) exportFeedbackBtn.disabled = true;
      processFeedbackFile(files[0]);
    });
  }
  
  if (exportFeedbackBtn) {
    exportFeedbackBtn.addEventListener('click', async () => {
      if (exportFeedbackInProgress) return;
      exportFeedbackInProgress = true;
      exportFeedbackBtn.disabled = true;
      
      if (window.feedbackResults && window.feedbackResults.length > 0) {
        await exportToExcel(
          window.feedbackResults, 
          `feedback_results_${new Date().toISOString().slice(0,10)}.xlsx`,
          addLogFeedback
        );
      } else {
        addLogFeedback('Нет данных для экспорта.');
      }
      
      exportFeedbackBtn.disabled = false;
      exportFeedbackInProgress = false;
    });
  }
}

/**
 * Обработка файла с данными обратной связи
 * @param {File} file - Excel файл с данными
 */
function processFeedbackFile(file) {
  processExcelFile(
    file,
    (jsonData) => {
      // Добавляем ссылку в каждую строку данных с учетом настроек
      jsonData.forEach(row => {
        const courseName = row["Название курса в ЛМС"] || "";
        const courseId = row["course_id"] || "";
        row["Ссылка"] = createPrefilledUrl(
          feedbackSettings.formUrl,
          courseName,
          courseId,
          feedbackSettings.courseNameFieldId,
          feedbackSettings.courseIdFieldId
        );
      });
      
      window.feedbackData = jsonData;
      addLogFeedback('Ссылки сгенерированы.');
      setProgressFeedback('Генерация ссылок завершена.');
      
      setTimeout(() => {
        addLogFeedback('Запуск процесса создания разделов и материалов...');
        awaitCreateFeedback();
      }, 100);
    },
    (error) => {
      addLogFeedback(`Ошибка чтения файла: ${error}`);
      setProgressFeedback('Ошибка чтения файла.');
    },
    setProgressFeedback,
    addLogFeedback
  );
}

/**
 * Создание разделов и материалов обратной связи
 */
async function awaitCreateFeedback() {
  window.feedbackResults = [];
  const feedbackSectionIconUrl = 'https://i.ibb.co/dmK60K4/feedback.png';
  addLogFeedback("Начало создания разделов и материалов для обратной связи...");
  const startTime = Date.now();
  const totalRecords = window.feedbackData.length;
  
  for (const [index, row] of window.feedbackData.entries()) {
    addLogFeedback(`Обработка записи ${index + 1} из ${totalRecords}...`);
    const courseId = row['course_id'];
    const courseName = row["Название курса в ЛМС"] || row["course_name"] || "";
    const link = row["Ссылка"] || "";
    
    if (!courseId || !courseName || !link) {
      addLogFeedback(`Пропуск записи ${index + 1}: недостаточно данных (course_id: ${courseId}, courseName: ${courseName})`);
      continue;
    }
    
    const sectionId = await createSection(courseId, "Обратная связь", feedbackSectionIconUrl);
    
    if (!sectionId) {
      addLogFeedback(`Запись ${index + 1}: Не удалось создать раздел для курса ID ${courseId}.`);
      continue;
    }
    
    const success = await addMaterialWithHyperlink(
      sectionId, 
      "Обратная связь по дисциплине", 
      link,
      feedbackSettings.materialText
    );
    
    addLogFeedback(`Запись ${index + 1}: Раздел ID ${sectionId} создан. Материал ${success ? "добавлен" : "не добавлен"}.`);
    
    window.feedbackResults.push({
      course_id: courseId,
      course_name: courseName,
      section_id: sectionId,
      material_added: success,
      link: link
    });
    
    await delay(500);
    const elapsedSec = Math.round((Date.now() - startTime) / 1000);
    setProgressFeedback(`Обработано ${index + 1} из ${totalRecords}. Прошло: ${formatTime(elapsedSec)}.`);
  }
  
  addLogFeedback("Создание разделов и материалов 'Обратная связь' завершено.");
  
  const exportFeedbackBtn = document.getElementById('exportFeedbackBtn');
  if (exportFeedbackBtn) {
    exportFeedbackBtn.disabled = false;
  }
}

export { initFeedbackTab, processFeedbackFile, awaitCreateFeedback };