// Импорт основных модулей
import { ensureToken } from './api/auth';
import { fetchCourseTypes } from './api/courses';
import { exportToExcel } from './services/export';
import { setupFilters, applyFilters, processCourseIdFilterFile } from './services/filter';
import { loadSettings } from './services/settings';
import { addLog, addLogMaterials } from './utils/logger';

// Импорт компонентов для вкладок
import { initCoursesTab } from './components/courses-tab';
import { initMaterialsTab } from './components/materials-tab';
import { initFeedbackTab } from './components/feedback-tab';

// Глобальные данные
window.fullExportData = [];
window.filterOptions = { startDate: null, endDate: null, courseTypes: [], courseIds: [] };
window.materialsDataDetails = [];
window.filterOptionsMaterials = { startDate: null, endDate: null, courseTypes: [], courseIds: [] };
window.feedbackData = [];
window.feedbackResults = [];

// Текущая цель фильтрации
let currentFilterTarget = 'courses';

/**
 * Инициализация приложения при загрузке DOM
 */
document.addEventListener('DOMContentLoaded', async () => {
  // Загружаем настройки из файла
  const settings = await loadSettings();
  console.log('Загружены настройки:', settings);

  // Инициализация вкладок
  initCoursesTab();
  initMaterialsTab();
  initFeedbackTab();
  
  // Настройка обработчиков фильтров
  setupFilterHandlers();
  
  // Настройка обработчика выбора файла с ID курсов
  setupCourseIdFileHandler();
  
  // Слушаем события от основного процесса
  listenForMainProcessEvents();
});

/**
 * Настройка обработчиков для модального окна фильтров
 */
function setupFilterHandlers() {
  const filterBtn = document.getElementById('filterBtn');
  const filterMaterialsBtn = document.getElementById('filterMaterialsBtn');
  const applyFiltersBtn = document.getElementById('applyFiltersBtn');
  const cancelFiltersBtn = document.getElementById('cancelFiltersBtn');
  const filterModal = document.getElementById('filterModal');
  const courseTypesContainer = document.getElementById('courseTypesContainer');
  
  // Кнопка фильтра для курсов и потоков
  if (filterBtn) {
    filterBtn.addEventListener('click', async () => {
      currentFilterTarget = 'courses';
      await setupFilters(courseTypesContainer, currentFilterTarget);
      
      // Установим значения дат из текущих фильтров
      const startDateInput = document.getElementById('startDate');
      const endDateInput = document.getElementById('endDate');
      
      if (startDateInput && window.filterOptions.startDate) {
        startDateInput.value = window.filterOptions.startDate;
      }
      
      if (endDateInput && window.filterOptions.endDate) {
        endDateInput.value = window.filterOptions.endDate;
      }
      
      if (filterModal) {
        filterModal.style.display = 'block';
      }
    });
  }
  
  // Кнопка фильтра для материалов
  if (filterMaterialsBtn) {
    filterMaterialsBtn.addEventListener('click', async () => {
      currentFilterTarget = 'materials';
      await setupFilters(courseTypesContainer, currentFilterTarget);
      
      // Установим значения дат из текущих фильтров
      const startDateInput = document.getElementById('startDate');
      const endDateInput = document.getElementById('endDate');
      
      if (startDateInput && window.filterOptionsMaterials.startDate) {
        startDateInput.value = window.filterOptionsMaterials.startDate;
      }
      
      if (endDateInput && window.filterOptionsMaterials.endDate) {
        endDateInput.value = window.filterOptionsMaterials.endDate;
      }
      
      if (filterModal) {
        filterModal.style.display = 'block';
      }
    });
  }
  
  // Кнопка применения фильтров
  if (applyFiltersBtn) {
    applyFiltersBtn.addEventListener('click', () => {
      const filterOptions = currentFilterTarget === 'courses' 
        ? window.filterOptions 
        : window.filterOptionsMaterials;
      
      applyFilters(currentFilterTarget, filterOptions);
      
      if (filterModal) {
        filterModal.style.display = 'none';
      }
    });
  }
  
  // Кнопка отмены
  if (cancelFiltersBtn) {
    cancelFiltersBtn.addEventListener('click', () => {
      if (filterModal) {
        filterModal.style.display = 'none';
      }
    });
  }
  
  // Закрытие модального окна при клике вне его
  window.onclick = function(event) {
    if (event.target === filterModal) {
      filterModal.style.display = 'none';
    }
  };
}

/**
 * Настройка обработчика файла с ID курсов
 */
function setupCourseIdFileHandler() {
  const courseIdFileInput = document.getElementById('courseIdFileInput');
  
  if (courseIdFileInput) {
    courseIdFileInput.addEventListener('change', () => {
      if (courseIdFileInput.files && courseIdFileInput.files.length > 0) {
        // Обрабатываем файл для обоих фильтров
        processCourseIdFilterFile(courseIdFileInput.files[0], window.filterOptions);
        
        // Копируем идентификаторы и в фильтр материалов
        const copyIds = () => {
          if (window.filterOptions.courseIds && window.filterOptions.courseIds.length > 0) {
            window.filterOptionsMaterials.courseIds = [...window.filterOptions.courseIds];
            addLogMaterials(`Фильтр по IDs курсов применен и для материалов: ${window.filterOptionsMaterials.courseIds.length} записей`);
          }
        };
        
        // Даем небольшую задержку для обработки первого фильтра
        setTimeout(copyIds, 500);
      }
    });
  }
}

/**
 * Настройка прослушивания сообщений от основного процесса
 */
function listenForMainProcessEvents() {
  const { ipcRenderer } = require('electron');
  
  ipcRenderer.on('update-message', (event, message) => {
    console.log('Update message:', message);
    const updateDiv = document.getElementById('updateMessage');
    if (updateDiv) {
      updateDiv.textContent = message;
    }
  });
}