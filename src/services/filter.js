import { processExcelFile } from './export';
import { fetchCourseTypes } from '../api/courses';
import { addLog } from '../utils/logger';
import { applyCourseFilters } from '../utils/helpers';

/**
 * Подготовка и отображение фильтров
 * @param {HTMLElement} container - Контейнер для вывода элементов фильтра
 * @param {string} target - Цель фильтрации: 'courses' или 'materials'
 */
async function setupFilters(container, target) {
  // Загрузка типов курсов
  const types = await fetchCourseTypes();
  
  // Получаем текущие значения фильтров
  const currentFilters = target === 'courses' 
    ? window.filterOptions 
    : window.filterOptionsMaterials;
  
  // Очищаем контейнер
  container.innerHTML = '';
  
  // Добавляем чекбоксы для каждого типа курса
  types.forEach(type => {
    const label = document.createElement('label');
    label.style.display = 'block';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = type.name;
    checkbox.name = 'courseTypeCheckbox';
    
    // Отмечаем чекбокс, если тип выбран в текущих фильтрах
    if (currentFilters.courseTypes.includes(type.name)) {
      checkbox.checked = true;
    }
    
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(` ${type.name}`));
    container.appendChild(label);
  });
  
  addLog("Типы курсов успешно загружены для фильтрации.");
}

/**
 * Применение выбранных фильтров
 * @param {string} target - Цель фильтрации: 'courses' или 'materials'
 * @param {Object} filterOptions - Объект с настройками фильтров
 */
function applyFilters(target, filterOptions) {
  const startVal = document.getElementById('startDate').value || null;
  const endVal = document.getElementById('endDate').value || null;
  const checkboxes = document.querySelectorAll('input[name="courseTypeCheckbox"]:checked');
  const typesArr = Array.from(checkboxes).map(cb => cb.value);
  
  if (target === 'courses') {
    window.filterOptions.startDate = startVal;
    window.filterOptions.endDate = endVal;
    window.filterOptions.courseTypes = typesArr;
    
    // Сохраняем course IDs если они уже были загружены
    if (filterOptions && filterOptions.courseIds) {
      window.filterOptions.courseIds = filterOptions.courseIds;
    }
    
    addLog('Фильтры применены для Курсов и потоков.');
  } else {
    window.filterOptionsMaterials.startDate = startVal;
    window.filterOptionsMaterials.endDate = endVal;
    window.filterOptionsMaterials.courseTypes = typesArr;
    
    // Сохраняем course IDs если они уже были загружены
    if (filterOptions && filterOptions.courseIds) {
      window.filterOptionsMaterials.courseIds = filterOptions.courseIds;
    }
    
    addLog('Фильтры применены для Разделов и материалов.');
  }
}

/**
 * Обработка файла с course_id для фильтрации
 * @param {File} file - Excel файл с course_id
 * @param {Object} filterOptions - Объект хранения параметров фильтра
 */
function processCourseIdFilterFile(file, filterOptions) {
  processExcelFile(
    file,
    (jsonData) => {
      const ids = jsonData
        .map(row => String(row.course_id || '').trim())
        .filter(id => id.length > 0);
        
      if (ids.length > 0) {
        addLog(`Фильтр по course_id: найдено ${ids.length} записей.`);
        filterOptions.courseIds = ids;
      } else {
        addLog("Файл с course_id не содержит данных.");
        filterOptions.courseIds = [];
      }
    },
    (error) => {
      addLog(`Ошибка чтения файла с course_id: ${error}`);
      filterOptions.courseIds = [];
    },
    () => {}, // Пустая функция прогресса
    addLog
  );
}

export { setupFilters, applyFilters, processCourseIdFilterFile, applyCourseFilters };