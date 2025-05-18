import { fetchAllCourses } from '../api/courses';
import { processCourseSessions } from '../api/sessions';
import { exportToExcel } from '../services/export';
import { addLog, setProgress } from '../utils/logger';
import { formatTime, applyCourseFilters, delay } from '../utils/helpers';

let exportFullInProgress = false;

/**
 * Инициализация вкладки "Курсы и потоки"
 */
function initCoursesTab() {
  // Получаем DOM элементы
  const fullExportBtn = document.getElementById('fullExportBtn');
  const exportFullBtn = document.getElementById('exportFullBtn');
  
  // Настраиваем обработчики событий
  if (fullExportBtn) {
    fullExportBtn.addEventListener('click', async () => {
      exportFullBtn.disabled = true;
      await fullExport();
    });
  }
  
  if (exportFullBtn) {
    exportFullBtn.addEventListener('click', async () => {
      if (exportFullInProgress) return;
      exportFullInProgress = true;
      exportFullBtn.disabled = true;
      
      if (window.fullExportData && window.fullExportData.length > 0) {
        await exportToExcel(
          window.fullExportData, 
          `course_sessions_speakers_${new Date().toISOString().slice(0,10)}.xlsx`
        );
      } else {
        addLog('Нет данных для экспорта.');
      }
      
      exportFullBtn.disabled = false;
      exportFullInProgress = false;
    });
  }
}

/**
 * Добавление строки в таблицу результатов
 * @param {Object} data - Данные для отображения
 * @param {number} rowNumber - Номер строки
 */
function addFullExportRow(data, rowNumber) {
  const fullExportTableBody = document.querySelector('#fullExportTable tbody');
  if (!fullExportTableBody) return;
  
  const tr = document.createElement('tr');
  
  // Добавляем номер строки
  const tdNum = document.createElement('td');
  tdNum.textContent = rowNumber;
  tr.appendChild(tdNum);
  
  // Добавляем остальные поля
  const fields = [
    'course_id', 'course_name', 'session_id', 'session_name', 
    'user_id', 'fullname', 'listeners_count', 'owner_name', 
    'authors_names', 'created_at', 'Категория'
  ];
  
  fields.forEach(field => {
    const td = document.createElement('td');
    
    // Форматируем дату если необходимо
    if (field === 'created_at' && data[field] && new Date(data[field]).toString() !== 'Invalid Date') {
      td.textContent = new Date(data[field]).toLocaleString();
    } else {
      td.textContent = data[field] !== null ? data[field] : '';
    }
    
    tr.appendChild(td);
  });
  
  fullExportTableBody.appendChild(tr);
}

/**
 * Полная выгрузка курсов, сессий и потоков
 */
async function fullExport() {
  addLog('Начало полной выгрузки: курсы, сеансы и потоки.');
  setProgress('Получение курсов...');
  const startTime = Date.now();
  let courses = [];
  
  try {
    courses = await fetchAllCourses();
    addLog(`Всего курсов получено: ${courses.length}`);
  } catch (error) {
    addLog('Ошибка при получении курсов: ' + error);
    return;
  }
  
  // Применяем фильтры: по дате, типам и по course_id
  if (
    window.filterOptions.startDate || 
    window.filterOptions.endDate || 
    window.filterOptions.courseTypes.length > 0 || 
    (window.filterOptions.courseIds && window.filterOptions.courseIds.length > 0)
  ) {
    addLog(`Текущий фильтр courseIds: ${window.filterOptions.courseIds.join(', ')}`);
    courses = applyCourseFilters(courses, window.filterOptions);
    addLog(`После фильтрации осталось курсов: ${courses.length}`);
  }
  
  // Очищаем таблицу и массив данных
  const fullExportTableBody = document.querySelector('#fullExportTable tbody');
  if (fullExportTableBody) {
    fullExportTableBody.innerHTML = '';
  }
  
  window.fullExportData = [];
  let rowCounter = 0;
  const totalCourses = courses.length;
  
  for (const [i, course] of courses.entries()) {
    const elapsedSec = Math.round((Date.now() - startTime) / 1000);
    const percent = totalCourses > 0 ? Math.round(((i + 1) / totalCourses) * 100) : 0;
    setProgress(`Обрабатывается курс ${i + 1} из ${totalCourses} (${percent}% завершено). Прошло: ${formatTime(elapsedSec)}.`);
    
    const sessionRecords = await processCourseSessions(course);
    
    if (sessionRecords && sessionRecords.length > 0) {
      for (const rec of sessionRecords) {
        rowCounter++;
        window.fullExportData.push(rec);
        addFullExportRow(rec, rowCounter);
      }
    } else {
      rowCounter++;
      // Если у курса нет сессий, добавляем информацию о самом курсе
      const record = {
        course_id: course.id,
        course_name: course.name,
        session_id: null,
        session_name: null,
        user_id: null,
        fullname: null,
        listeners_count: 0,
        owner_name: course.owner_name || 'Неизвестно',
        authors_names: (course.authors && Array.isArray(course.authors))
                       ? course.authors.map(a => `${(a.last_name || '').trim()} ${(a.name || '').trim()}`.trim()).join(', ')
                       : 'Неизвестно',
        created_at: course.created_at,
        'Категория': (course.types && Array.isArray(course.types))
                    ? course.types.map(t => t.name || 'Неизвестно').join(', ')
                    : 'Неизвестно'
      };
      window.fullExportData.push(record);
      addFullExportRow(record, rowCounter);
      addLog(`Курс ID ${course.id} ('${course.name}') не имеет сеансов.`);
    }
    
    await delay(200);
  }
  
  setProgress('Выгрузка завершена.');
  addLog(`Полная выгрузка завершена. Всего записей: ${window.fullExportData.length}. Общее время: ${formatTime(Math.round((Date.now() - startTime)/1000))}.`);
  document.getElementById('exportFullBtn').disabled = false;
}

export { initCoursesTab, fullExport };