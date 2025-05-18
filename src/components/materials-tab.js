import { fetchAllCoursesMaterials, getCourseDetailsWithMaterials } from '../api/materials';
import { exportToExcel } from '../services/export';
import { addLogMaterials, setProgressMaterials } from '../utils/logger';
import { formatTime, applyCourseFilters, delay } from '../utils/helpers';

let exportMaterialsInProgress = false;

/**
 * Инициализация вкладки "Разделы и материалы"
 */
function initMaterialsTab() {
  // Получаем DOM элементы
  const fullExportMaterialsBtn = document.getElementById('fullExportMaterialsBtn');
  const exportMaterialsBtn = document.getElementById('exportMaterialsBtn');
  
  // Настраиваем обработчики событий
  if (fullExportMaterialsBtn) {
    fullExportMaterialsBtn.addEventListener('click', async () => {
      if (exportMaterialsBtn) exportMaterialsBtn.disabled = true;
      await fullExportMaterialsNew();
    });
  }
  
  if (exportMaterialsBtn) {
    exportMaterialsBtn.addEventListener('click', async () => {
      if (exportMaterialsInProgress) return;
      exportMaterialsInProgress = true;
      exportMaterialsBtn.disabled = true;
      
      if (window.materialsDataDetails && window.materialsDataDetails.length > 0) {
        await exportToExcel(
          window.materialsDataDetails, 
          `courses_materials_${new Date().toISOString().slice(0,10)}.xlsx`,
          addLogMaterials
        );
      } else {
        addLogMaterials('Нет данных для экспорта.');
      }
      
      exportMaterialsBtn.disabled = false;
      exportMaterialsInProgress = false;
    });
  }
}

/**
 * Добавление строки в таблицу материалов
 * @param {Object} record - Данные о материале
 * @param {number} rowNumber - Номер строки
 */
function addMaterialDetailRow(record, rowNumber) {
  const materialsDetailsTableBody = document.querySelector('#materialsDetailsTable tbody');
  if (!materialsDetailsTableBody) return;
  
  const tr = document.createElement('tr');
  
  // Добавляем номер строки
  const tdNum = document.createElement('td');
  tdNum.textContent = rowNumber;
  tr.appendChild(tdNum);
  
  // Добавляем остальные поля
  const fields = [
    'course_id', 
    'course_name', 
    'course_created_at', 
    'section_name', 
    'material_name', 
    'file_name', 
    'category', 
    'material_created_at', 
    'scorm'
  ];
  
  fields.forEach(field => {
    const td = document.createElement('td');
    
    // Форматируем дату если необходимо
    if (field === 'course_created_at' && record[field] && new Date(record[field]).toString() !== 'Invalid Date') {
      td.textContent = new Date(record[field]).toLocaleString();
    } else {
      td.textContent = record[field] !== null ? record[field] : '';
    }
    
    tr.appendChild(td);
  });
  
  materialsDetailsTableBody.appendChild(tr);
}

/**
 * Полный экспорт разделов и материалов курсов
 */
async function fullExportMaterialsNew() {
  addLogMaterials('Начало выгрузки разделов и материалов (GET /courses/{id}).');
  setProgressMaterials('Получение курсов для разделов и материалов...');
  const startTime = Date.now();
  let courses = [];
  
  try {
    courses = await fetchAllCoursesMaterials(setProgressMaterials);
    addLogMaterials(`Всего курсов получено: ${courses.length}`);
  } catch (error) {
    addLogMaterials('Ошибка при получении курсов: ' + error);
    return;
  }
  
  // Применяем фильтры
  if (
    window.filterOptionsMaterials.startDate ||
    window.filterOptionsMaterials.endDate ||
    window.filterOptionsMaterials.courseTypes.length > 0 ||
    (window.filterOptionsMaterials.courseIds && window.filterOptionsMaterials.courseIds.length > 0)
  ) {
    addLogMaterials(`Текущий фильтр courseIds: ${window.filterOptionsMaterials.courseIds.join(', ')}`);
    courses = applyCourseFilters(courses, window.filterOptionsMaterials);
    addLogMaterials(`После фильтрации осталось курсов: ${courses.length}`);
  }
  
  // Очищаем таблицу и массив данных
  const materialsDetailsTableBody = document.querySelector('#materialsDetailsTable tbody');
  if (materialsDetailsTableBody) {
    materialsDetailsTableBody.innerHTML = '';
  }
  
  window.materialsDataDetails = [];
  let detailRowCounter = 0;
  const totalCourses = courses.length;
  
  for (const [i, course] of courses.entries()) {
    const elapsedSec = Math.round((Date.now() - startTime) / 1000);
    const percent = totalCourses > 0 ? Math.round(((i + 1) / totalCourses) * 100) : 0;
    setProgressMaterials(`Обрабатывается курс ${i + 1} из ${totalCourses} (${percent}% завершено). Прошло: ${formatTime(elapsedSec)}.`);
    
    addLogMaterials(`Обработка курса ID ${course.id} ('${course.name}')...`);
    // Получаем детальную информацию курса через GET /courses/{id}
    const courseDetails = await getCourseDetailsWithMaterials(course.id);
    
    if (!courseDetails || !courseDetails.sections || !Array.isArray(courseDetails.sections)) {
      addLogMaterials(`Курс ID ${course.id} не содержит разделов.`);
      continue;
    }
    
    // Перебираем разделы курса
    for (const section of courseDetails.sections) {
      const sectionName = section.name || '';
      addLogMaterials(`Обработка раздела ID ${section.id} ('${sectionName}')...`);

      // 1. Обработка материалов (materials)
      if (section.materials && Array.isArray(section.materials)) {
        addLogMaterials(`Найдено ${section.materials.length} материалов в разделе '${sectionName}'.`);
        for (const material of section.materials) {
          detailRowCounter++;
          const record = {
            course_id: course.id,
            course_name: course.name,
            course_created_at: course.created_at,
            section_name: sectionName,
            material_name: material.name || "",
            file_name: material.file_name || "",
            category: material.category || "",
            material_created_at: material.created_at || "",
            scorm: false
          };
          window.materialsDataDetails.push(record);
          addMaterialDetailRow(record, detailRowCounter);
        }
      }
      
      // 2. Обработка заданий (tasks)
      if (section.tasks && Array.isArray(section.tasks)) {
        addLogMaterials(`Найдено ${section.tasks.length} заданий в разделе '${sectionName}'.`);
        for (const task of section.tasks) {
          detailRowCounter++;
          const record = {
            course_id: course.id,
            course_name: course.name,
            course_created_at: course.created_at,
            section_name: sectionName,
            material_name: task.name || "",
            file_name: "", // задания, как правило, не имеют файла
            category: "task",
            material_created_at: task.created_at || "",
            scorm: false
          };
          window.materialsDataDetails.push(record);
          addMaterialDetailRow(record, detailRowCounter);
        }
      }
      
      // 3. Обработка тестов (quizzes)
      if (section.quizzes && Array.isArray(section.quizzes)) {
        addLogMaterials(`Найдено ${section.quizzes.length} тестов в разделе '${sectionName}'.`);
        for (const quiz of section.quizzes) {
          detailRowCounter++;
          const record = {
            course_id: course.id,
            course_name: course.name,
            course_created_at: course.created_at,
            section_name: sectionName,
            material_name: quiz.name || "",
            file_name: "",
            category: "quiz",
            material_created_at: quiz.created_at || "",
            scorm: false
          };
          window.materialsDataDetails.push(record);
          addMaterialDetailRow(record, detailRowCounter);
        }
      }
      
      // 4. Обработка SCORM-пакетов
      if (section.scorm_packages && Array.isArray(section.scorm_packages)) {
        addLogMaterials(`Найдено ${section.scorm_packages.length} SCORM-пакетов в разделе '${sectionName}'.`);
        for (const scorm of section.scorm_packages) {
          detailRowCounter++;
          const record = {
            course_id: course.id,
            course_name: course.name,
            course_created_at: course.created_at,
            section_name: sectionName,
            material_name: scorm.name || "",
            file_name: scorm.resource_url || "",
            category: "scorm",
            material_created_at: scorm.created_at || "",
            scorm: true
          };
          window.materialsDataDetails.push(record);
          addMaterialDetailRow(record, detailRowCounter);
        }
      }
    }
    
    await delay(200);
  }
  
  setProgressMaterials('Выгрузка завершена.');
  addLogMaterials(`Выгрузка завершена. Всего деталей: ${window.materialsDataDetails.length}. Общее время: ${formatTime(Math.round((Date.now() - startTime) / 1000))}.`);
  document.getElementById('exportMaterialsBtn').disabled = false;
}

export { initMaterialsTab, fullExportMaterialsNew };