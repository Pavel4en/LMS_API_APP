import axios from 'axios';
import * as XLSX from 'xlsx';

/* ======================= ОБЩИЕ НАСТРОЙКИ И ФУНКЦИИ ======================= */
const API_BASE = 'https://apk.vevo.ru/endpoint/v1';
const TOKEN_URL = 'https://apk.vevo.ru/oauth/token';
const COURSES_URL = `${API_BASE}/courses`;
const COURSE_TYPES_URL = `${API_BASE}/course_types`;
const FORM_URL = 'PASTE_URL_FORM';

const CLIENT_ID = 'PASTE_CLIENT_ID';
const CLIENT_SECRET = 'PASTE_CLIENT_SECRET';

let accessToken = null;
let tokenExpiry = null; // в мс

// Флаг, чтобы не запускать экспорт одновременно
let isExporting = false;

// Элементы для "Курсы и потоки"
const logContainer = document.getElementById('log');
const progressDiv = document.getElementById('progress');
const fullExportTableBody = document.querySelector('#fullExportTable tbody');
const courseTypesContainer = document.getElementById('courseTypesContainer');

// Элементы для "Разделы и материалы"
const logMaterials = document.getElementById('logMaterials');
const progressMaterials = document.getElementById('progressMaterials');
const materialsDetailsTableBody = document.querySelector('#materialsDetailsTable tbody');

// Элементы для "Обратная связь"
const feedbackFileInput = document.getElementById('feedbackFileInput');
const processFeedbackBtn = document.getElementById('processFeedbackBtn'); // кнопка "Добавить ОС"
const exportFeedbackBtn = document.getElementById('exportFeedbackBtn');   // кнопка "Выгрузить результат"
const progressFeedback = document.getElementById('progressFeedback');
const logFeedback = document.getElementById('logFeedback');

// Элемент для загрузки файла с course_id из фильтра
const courseIdFileInput = document.getElementById('courseIdFileInput');
courseIdFileInput.addEventListener('change', () => {
  if (courseIdFileInput.files && courseIdFileInput.files.length > 0) {
    processCourseIdFilterFile(courseIdFileInput.files[0]);
  }
});

// Глобальные данные
window.fullExportData = []; // для "Курсы и потоки"
window.filterOptions = { startDate: null, endDate: null, courseTypes: [], courseIds: [] };

window.materialsDataDetails = []; // для "Разделы и материалы"
window.filterOptionsMaterials = { startDate: null, endDate: null, courseTypes: [], courseIds: [] };

window.feedbackData = [];    // исходные данные из файла (сгенерированные ссылки)
window.feedbackResults = []; // результаты создания разделов и материалов

let currentFilterTarget = 'courses'; // для фильтров

/* ======================= ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ФОРМАТИРОВАНИЯ ВРЕМЕНИ ======================= */
function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h} ч ${m} мин ${s} сек`;
}

/* ======================= ФУНКЦИИ ЛОГИРОВАНИЯ И ПРОГРЕССА ======================= */
function addLog(message) {
  const time = new Date().toLocaleTimeString();
  const p = document.createElement('p');
  p.textContent = `[${time}] ${message}`;
  logContainer.appendChild(p);
  logContainer.scrollTop = logContainer.scrollHeight;
  if (window.electronAPI?.logMessage) {
    window.electronAPI.logMessage(message);
  }
}

function addLogMaterials(message) {
  const time = new Date().toLocaleTimeString();
  const p = document.createElement('p');
  p.textContent = `[${time}] ${message}`;
  logMaterials.appendChild(p);
  logMaterials.scrollTop = logMaterials.scrollHeight;
  if (window.electronAPI?.logMessage) {
    window.electronAPI.logMessage(message);
  }
}

function addLogFeedback(message) {
  const time = new Date().toLocaleTimeString();
  const p = document.createElement('p');
  p.textContent = `[${time}] ${message}`;
  logFeedback.appendChild(p);
  logFeedback.scrollTop = logFeedback.scrollHeight;
  if (window.electronAPI?.logMessage) {
    window.electronAPI.logMessage(message);
  }
}

function setProgress(message) {
  progressDiv.textContent = message;
}

function setProgressMaterials(message) {
  progressMaterials.textContent = message;
}

function setProgressFeedback(message) {
  progressFeedback.textContent = message;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* ======================= ФУНКЦИИ ДЛЯ ТОКЕНА ======================= */
async function getAccessToken() {
  setProgress('Запрос нового токена...');
  addLog('Запрос нового токена...');
  try {
    const response = await axios.post(TOKEN_URL, {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'client_credentials'
    });
    accessToken = response.data.access_token;
    tokenExpiry = Date.now() + response.data.expires_in * 1000;
    addLog('Токен успешно получен.');
  } catch (error) {
    addLog(`Ошибка получения токена: ${error}`);
    throw error;
  }
}

async function ensureToken() {
  if (!accessToken || Date.now() >= tokenExpiry) {
    await getAccessToken();
  }
}

/* ======================= ФУНКЦИИ ДЛЯ СОЗДАНИЯ РАЗДЕЛОВ И МАТЕРИАЛОВ (ОБРАТНАЯ СВЯЗЬ) ======================= */
async function createSection(courseId, sectionName, iconUrl) {
  await ensureToken();
  const url = `${API_BASE}/courses/${courseId}/sections`;
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };
  const payload = {
    section: {
      name: sectionName,
      icon_remote_url: iconUrl
    }
  };
  try {
    const response = await axios.post(url, payload, { headers });
    const sectionData = response.data;
    addLogFeedback(`Создан раздел "${sectionName}" для курса ID ${courseId}.`);
    return sectionData.id;
  } catch (error) {
    addLogFeedback(`Ошибка при создании раздела "${sectionName}" для курса ID ${courseId}: ${error}`);
    return null;
  }
}

async function addMaterialWithHyperlink(sectionId, materialName, link) {
  await ensureToken();
  const url = `${API_BASE}/sections/${sectionId}/materials`;
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };
  const content = {
    blocks: [
      {
        type: "paragraph",
        id: "unique-id",
        data: {
          text: (
            "Уважаемые студенты!<br><br>" +
            "Просим вас принять участие в опросе по нашей дисциплине.<br>" +
            "Ваше мнение очень важно для улучшения качества обучения и организации учебного процесса.<br><br>" +
            `Ссылка на обратную связь по дисциплине: <a href="${link}" target="_blank">ссылка</a><br><br>` +
            "Заранее благодарим за вашу активность!"
          )
        }
      }
    ],
    version: "2.25.0",
    time: Date.now()
  };
  const payload = {
    material: {
      name: materialName,
      description: "Описание отсутствует",
      content: content
    }
  };
  try {
    const response = await axios.post(url, payload, { headers });
    addLogFeedback(`Добавлен материал "${materialName}" в раздел ID ${sectionId}.`);
    return true;
  } catch (error) {
    addLogFeedback(`Ошибка при добавлении материала "${materialName}" в раздел ID ${sectionId}: ${error}`);
    return false;
  }
}

/* ======================= ФУНКЦИОНАЛ "КУРСЫ И ПОТОКИ" ======================= */
async function fetchAllCourses() {
  let courses = [];
  let page = 1;
  const per_page = 100;
  let moreData = true;
  while (moreData) {
    await ensureToken();
    setProgress(`Загрузка курсов: страница ${page}...`);
    addLog(`Запрос курсов, страница ${page}`);
    try {
      const response = await axios.get(COURSES_URL, {
        params: { page, per_page },
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      let data = Array.isArray(response.data)
        ? response.data
        : (response.data.data || []);
      addLog(`Страница ${page}: найдено ${data.length} курсов.`);
      if (Array.isArray(data) && data.length > 0) {
        courses = courses.concat(data);
        page++;
        await delay(500);
      } else {
        addLog('Больше курсов не найдено.');
        moreData = false;
      }
    } catch (error) {
      addLog(`Ошибка получения курсов на странице ${page}: ${error}`);
      moreData = false;
    }
  }
  setProgress('Загрузка курсов завершена.');
  return courses;
}

async function fetchCourseSessions(courseId) {
  const url = `${API_BASE}/courses/${courseId}/course_sessions`;
  let sessions = [];
  let page = 1;
  const per_page = 100;
  let moreData = true;
  while (moreData) {
    await ensureToken();
    try {
      const response = await axios.get(url, {
        params: { page, per_page },
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      let data = Array.isArray(response.data)
        ? response.data
        : (response.data.data || []);
      addLog(`Курс ${courseId} - страница ${page}: найдено ${data.length} сеансов.`);
      if (Array.isArray(data) && data.length > 0) {
        sessions = sessions.concat(data);
        page++;
        await delay(200);
      } else {
        moreData = false;
      }
    } catch (error) {
      addLog(`Ошибка получения сеансов для курса ${courseId} на странице ${page}: ${error}`);
      moreData = false;
    }
  }
  return sessions;
}

// Функция для получения owner_name – просто обрезаем пробелы
function getOwnerName(courseInfo) {
  return (courseInfo.owner_name || '').trim();
}

// Функция для формирования строки авторов (сначала фамилия, потом имя)
function getAuthorsNames(courseInfo) {
  if (courseInfo.authors && Array.isArray(courseInfo.authors) && courseInfo.authors.length > 0) {
    return courseInfo.authors
      .map(a => {
        // Формируем ФИО из полей last_name и name
        return `${(a.last_name || '').trim()} ${(a.name || '').trim()}`.trim();
      })
      .filter(Boolean)
      .join(', ');
  }
  return '';
}

async function fetchSessionDetails(courseId, sessionId) {
  const url = `${API_BASE}/courses/${courseId}/course_sessions/${sessionId}`;
  await ensureToken();
  try {
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    let sessionData = response.data;
    if (!sessionData || Array.isArray(sessionData)) {
      sessionData = {};
    }
    const participants = sessionData.participants || [];

    // Фильтрация докладчиков по точному совпадению роли "докладчик"
    const speakers = participants.filter(p => {
      return (p.role_name || '').toLowerCase().trim() === 'докладчик';
    });

    // Подсчет слушателей по роли "слушатель"
    let listenersCount = participants.filter(p => {
      return (p.role_name || '').toLowerCase().trim() === 'слушатель';
    }).length;
    // Если докладчиков нет, считаем, что все участники – слушатели
    if (participants.length > 0 && speakers.length === 0) {
      listenersCount = participants.length;
    }

    const courseInfo = sessionData.course || {};
    // Получаем owner_name и authorsNames через отдельные функции
    const ownerName = getOwnerName(courseInfo);
    const authorsNames = getAuthorsNames(courseInfo);

    if (listenersCount === 0 && participants.length > 0) {
      addLog(`Внимание: В сеансе ${sessionId} курса ${courseId} обнаружено ${participants.length} участников, но нет слушателей. Проверьте роли.`);
    }

    return { speakers, listenersCount, ownerName, authorsNames };
  } catch (error) {
    addLog(`Ошибка получения деталей сеанса (Course ID: ${courseId}, Session ID: ${sessionId}): ${error}`);
    return { speakers: [], listenersCount: 0, ownerName: '', authorsNames: '' };
  }
}

async function processCourseSessions(course) {
  const courseId = course.id;
  let records = [];
  const sessions = await fetchCourseSessions(courseId);
  addLog(`Для курса ${courseId} получено сеансов: ${sessions.length}`);

  if (sessions && sessions.length > 0) {
    for (const session of sessions) {
      const sessionId = session.id;
      const sessionName = session.name || 'Неизвестно';
      const details = await fetchSessionDetails(courseId, sessionId);

      if (details.speakers && details.speakers.length > 0) {
        // Если докладчики есть – для каждого из них создаём запись,
        // используя готовое значение fullname из API (без разбиения)
        for (const speaker of details.speakers) {
          const fullname = speaker.fullname ? speaker.fullname.trim() : '';
          records.push({
            course_id: course.id,
            course_name: course.name,
            session_id: sessionId,
            session_name: sessionName,
            user_id: speaker.id,
            fullname: fullname, // используем готовое значение
            listeners_count: details.listenersCount,
            owner_name: details.ownerName,  // выводим значение, как пришло из API
            authors_names: details.authorsNames,
            created_at: course.created_at,
            'Категория': (course.types && Array.isArray(course.types))
              ? course.types.map(t => t.name || '').join(', ')
              : ''
          });
        }
      } else {
        // Если докладчика нет – оставляем поля, связанные с докладчиком, пустыми
        records.push({
          course_id: course.id,
          course_name: course.name,
          session_id: sessionId,
          session_name: sessionName,
          user_id: null,
          fullname: '', // оставляем пустым
          listeners_count: details.listenersCount,
          owner_name: details.ownerName,
          authors_names: details.authorsNames,
          created_at: course.created_at,
          'Категория': (course.types && Array.isArray(course.types))
            ? course.types.map(t => t.name || '').join(', ')
            : ''
        });
      }
    }
  }

  return records;
}



function addFullExportRow(data, rowNumber) {
  const tr = document.createElement('tr');
  const tdNum = document.createElement('td');
  tdNum.textContent = rowNumber;
  tr.appendChild(tdNum);
  const fields = ['course_id', 'course_name', 'session_id', 'session_name', 'user_id', 'fullname', 'listeners_count', 'owner_name', 'authors_names', 'created_at', 'Категория'];
  fields.forEach(field => {
    const td = document.createElement('td');
    if (field === 'created_at' && data[field] && new Date(data[field]).toString() !== 'Invalid Date') {
      td.textContent = new Date(data[field]).toLocaleString();
    } else {
      td.textContent = data[field] !== null ? data[field] : '';
    }
    tr.appendChild(td);
  });
  fullExportTableBody.appendChild(tr);
}

async function exportToExcel(data, defaultFileName) {
  addLog("Начало экспорта в Excel");
  console.log('Перед вызовом saveFileDialog, defaultFileName:', defaultFileName);
  const exportData = data.map(item => ({ ...item }));
  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
  
  // Преобразуем workbook в двоичные данные
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  
  // Передаем двоичные данные в основной процесс для сохранения
  let filePath = await window.electronAPI.saveAndWriteFile(defaultFileName, wbout);
  if (filePath) {
    addLog(`Файл успешно сохранён: ${filePath}`);
  } else {
    addLog('Сохранение файла отменено.');
  }
}

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
  // Применяем фильтры: по дате, типам и по course_id (если загружен файл)
  if (window.filterOptions.startDate || window.filterOptions.endDate || window.filterOptions.courseTypes.length > 0 || (window.filterOptions.courseIds && window.filterOptions.courseIds.length > 0)) {
    addLog(`Текущий фильтр courseIds: ${window.filterOptions.courseIds.join(', ')}`);
    courses = courses.filter(course => {
      if (course.created_at) {
        const courseDate = new Date(course.created_at);
        if (window.filterOptions.startDate) {
          const startDate = new Date(window.filterOptions.startDate);
          if (courseDate < startDate) return false;
        }
        if (window.filterOptions.endDate) {
          const endDate = new Date(window.filterOptions.endDate);
          if (courseDate > endDate) return false;
        }
      }
      if (window.filterOptions.courseTypes.length > 0) {
        if (!course.types || !Array.isArray(course.types)) return false;
        const courseTypeNames = course.types.map(t => (t.name || '').toLowerCase());
        const filterMatch = window.filterOptions.courseTypes.some(filterType => courseTypeNames.includes(filterType.toLowerCase().trim()));
        if (!filterMatch) return false;
      }
      if (window.filterOptions.courseIds && window.filterOptions.courseIds.length > 0) {
        if (!window.filterOptions.courseIds.includes(String(course.id).trim())) return false;
      }
      return true;
    });
    addLog(`После фильтрации осталось курсов: ${courses.length}`);
  }
  fullExportTableBody.innerHTML = '';
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

/* ======================= ФУНКЦИОНАЛ "РАЗДЕЛЫ И МАТЕРИАЛЫ" ======================= */
// Получение деталей курса по его ID (эндпоинт GET /courses/{id})
async function getCourseDetails(courseId) {
  await ensureToken();
  try {
    const response = await axios.get(`${API_BASE}/courses/${courseId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    addLogMaterials(`Получены детали курса ID ${courseId}.`);
    return response.data;
  } catch (error) {
    addLogMaterials(`Ошибка получения деталей курса ${courseId}: ${error}`);
    return null;
  }
}

// Функция для добавления строки в таблицу экспорта материалов
function addMaterialDetailRow(record, rowNumber) {
  const tr = document.createElement('tr');
  const tdNum = document.createElement('td');
  tdNum.textContent = rowNumber;
  tr.appendChild(tdNum);
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
    if (field === 'course_created_at' && record[field] && new Date(record[field]).toString() !== 'Invalid Date') {
      td.textContent = new Date(record[field]).toLocaleString();
    } else {
      td.textContent = record[field] !== null ? record[field] : '';
    }
    tr.appendChild(td);
  });
  materialsDetailsTableBody.appendChild(tr);
}
async function fetchAllCoursesMaterials() {
  let courses = [];
  let page = 1;
  const per_page = 100;
  let moreData = true;
  while (moreData) {
    await ensureToken();
    setProgressMaterials(`Получение курсов (материалы): страница ${page}...`);
    addLogMaterials(`Запрос курсов для материалов, страница ${page}`);
    try {
      const response = await axios.get(COURSES_URL, {
        params: { page, per_page },
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      let data = Array.isArray(response.data)
        ? response.data
        : (response.data.data || []);
      addLogMaterials(`Страница ${page}: найдено ${data.length} курсов.`);
      if (Array.isArray(data) && data.length > 0) {
        courses = courses.concat(data);
        page++;
        await delay(500);
      } else {
        addLogMaterials('Больше курсов не найдено.');
        moreData = false;
      }
    } catch (error) {
      addLogMaterials(`Ошибка получения курсов на странице ${page}: ${error}`);
      moreData = false;
    }
  }
  setProgressMaterials('Загрузка курсов для материалов завершена.');
  return courses;
}

// Новый вариант экспорта разделов и материалов, использующий GET /courses/{id}
async function fullExportMaterialsNew() {
  addLogMaterials('Начало выгрузки разделов и материалов (GET /courses/{id}).');
  setProgressMaterials('Получение курсов для разделов и материалов...');
  const startTime = Date.now();
  let courses = [];
  try {
    courses = await fetchAllCoursesMaterials();
    addLogMaterials(`Всего курсов получено: ${courses.length}`);
  } catch (error) {
    addLogMaterials('Ошибка при получении курсов: ' + error);
    return;
  }
  // Применяем фильтры (аналогично предыдущей реализации)
  if (
    window.filterOptionsMaterials.startDate ||
    window.filterOptionsMaterials.endDate ||
    window.filterOptionsMaterials.courseTypes.length > 0 ||
    (window.filterOptionsMaterials.courseIds && window.filterOptionsMaterials.courseIds.length > 0)
  ) {
    addLogMaterials(`Текущий фильтр courseIds: ${window.filterOptionsMaterials.courseIds.join(', ')}`);
    courses = courses.filter(course => {
      if (course.created_at) {
        const courseDate = new Date(course.created_at);
        if (window.filterOptionsMaterials.startDate) {
          const startDate = new Date(window.filterOptionsMaterials.startDate);
          if (courseDate < startDate) return false;
        }
        if (window.filterOptionsMaterials.endDate) {
          const endDate = new Date(window.filterOptionsMaterials.endDate);
          if (courseDate > endDate) return false;
        }
      }
      if (window.filterOptionsMaterials.courseTypes.length > 0) {
        if (!course.types || !Array.isArray(course.types)) return false;
        const courseTypeNames = course.types.map(t => (t.name || '').toLowerCase());
        const filterMatch = window.filterOptionsMaterials.courseTypes.some(filterType =>
          courseTypeNames.includes(filterType.toLowerCase().trim())
        );
        if (!filterMatch) return false;
      }
      if (window.filterOptionsMaterials.courseIds && window.filterOptionsMaterials.courseIds.length > 0) {
        if (!window.filterOptionsMaterials.courseIds.includes(String(course.id).trim())) return false;
      }
      return true;
    });
    addLogMaterials(`После фильтрации осталось курсов: ${courses.length}`);
  }
  materialsDetailsTableBody.innerHTML = '';
  window.materialsDataDetails = [];
  let detailRowCounter = 0;
  const totalCourses = courses.length;
  for (const [i, course] of courses.entries()) {
    const elapsedSec = Math.round((Date.now() - startTime) / 1000);
    const percent = totalCourses > 0 ? Math.round(((i + 1) / totalCourses) * 100) : 0;
    setProgressMaterials(`Обрабатывается курс ${i + 1} из ${totalCourses} (${percent}% завершено). Прошло: ${formatTime(elapsedSec)}.`);
    
    addLogMaterials(`Обработка курса ID ${course.id} ('${course.name}')...`);
    // Получаем детальную информацию курса через GET /courses/{id}
    const courseDetails = await getCourseDetails(course.id);
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
      // 2. Обработка заданий (tasks) – считаем их как материалы с категорией "task"
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
      // 3. Обработка тестов (quizzes) – считаем их как материалы с категорией "quiz"
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
      // 4. Обработка SCORM-пакетов – считаем их как материалы с категорией "scorm"
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


/* ======================= ФУНКЦИОНАЛ "ОБРАТНАЯ СВЯЗЬ" ======================= */
// Функция для генерации URL с предзаполненными полями
function createPrefilledUrl(baseUrl, courseName, courseId) {
  const params = { 
    answer_long_text_64154736: courseName,
    answer_long_text_70163274: courseId
  };
  const encodedParams = Object.keys(params)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');
  return `${baseUrl}?${encodedParams}`;
}

function processFeedbackFile(file) {
  setProgressFeedback('Чтение файла...');
  addLogFeedback('Начало чтения файла обратной связи...');
  const reader = new FileReader();
  reader.onload = function(e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    addLogFeedback(`Файл прочитан. Найдено строк: ${jsonData.length}`);
    jsonData.forEach(row => {
      const courseName = row["Название курса в ЛМС"] || "";
      const courseId = row["course_id"] || "";
      row["Ссылка"] = createPrefilledUrl(FORM_URL, courseName, courseId);
    });
    window.feedbackData = jsonData;
    addLogFeedback('Ссылки сгенерированы.');
    setProgressFeedback('Генерация ссылок завершена.');
    setTimeout(() => {
      addLogFeedback('Запуск процесса создания разделов и материалов...');
      awaitCreateFeedback();
    }, 100);
  };
  reader.onerror = function(err) {
    addLogFeedback(`Ошибка чтения файла: ${err}`);
    setProgressFeedback('Ошибка чтения файла.');
  };
  reader.readAsArrayBuffer(file);
}

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
    const success = await addMaterialWithHyperlink(sectionId, "Обратная связь по дисциплине", link);
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
  exportFeedbackBtn.disabled = false;
}

async function exportFeedbackResultsToExcel(defaultFileName) {
  addLogFeedback("Начало экспорта результата в Excel");
  const worksheet = XLSX.utils.json_to_sheet(window.feedbackResults);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Results");
  
  // Преобразуем workbook в двоичные данные
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  
  // Передаем двоичные данные в основной процесс для сохранения
  let filePath = await window.electronAPI.saveAndWriteFile(defaultFileName, wbout);
  if (filePath) {
    addLogFeedback(`Файл успешно сохранён: ${filePath}`);
  } else {
    addLogFeedback('Сохранение файла отменено.');
  }
}

/* ======================= ОБРАБОТЧИКИ КНОПОК ======================= */

// Для экспорта курсов и потоков
let exportFullInProgress = false;
document.getElementById('fullExportBtn').addEventListener('click', async () => {
  // Кнопка "Выгрузить курсы и потоки" собирает данные, после чего активируется кнопка экспорта
  document.getElementById('exportFullBtn').disabled = true;
  await fullExport();
});

document.getElementById('exportFullBtn').addEventListener('click', async () => {
  if (exportFullInProgress) return;
  exportFullInProgress = true;
  const btn = document.getElementById('exportFullBtn');
  btn.disabled = true;
  if (window.fullExportData && window.fullExportData.length > 0) {
    await exportToExcel(window.fullExportData, `course_sessions_speakers_${new Date().toISOString().slice(0,10)}.xlsx`);
  } else {
    addLog('Нет данных для экспорта.');
  }
  btn.disabled = false;
  exportFullInProgress = false;
});

// Для экспорта разделов и материалов
let exportMaterialsInProgress = false;
document.getElementById('fullExportMaterialsBtn').addEventListener('click', async () => {
  document.getElementById('exportMaterialsBtn').disabled = true;
  await fullExportMaterialsNew();
});
document.getElementById('exportMaterialsBtn').addEventListener('click', async () => {
  if (exportMaterialsInProgress) return;
  exportMaterialsInProgress = true;
  const btn = document.getElementById('exportMaterialsBtn');
  btn.disabled = true;
  if (window.materialsDataDetails && window.materialsDataDetails.length > 0) {
    await exportToExcel(window.materialsDataDetails, `courses_materials_${new Date().toISOString().slice(0,10)}.xlsx`);
  } else {
    addLogMaterials('Нет данных для экспорта.');
  }
  btn.disabled = false;
  exportMaterialsInProgress = false;
});

// Для экспорта результатов обратной связи
let exportFeedbackInProgress = false;
processFeedbackBtn.addEventListener('click', () => {
  const files = feedbackFileInput.files;
  if (!files || files.length === 0) {
    addLogFeedback('Выберите файл для обработки.');
    return;
  }
  exportFeedbackBtn.disabled = true;
  processFeedbackFile(files[0]);
});

exportFeedbackBtn.addEventListener('click', async () => {
  if (exportFeedbackInProgress) return;
  exportFeedbackInProgress = true;
  const btn = exportFeedbackBtn;
  btn.disabled = true;
  if (window.feedbackResults && window.feedbackResults.length > 0) {
    await exportFeedbackResultsToExcel(`feedback_results_${new Date().toISOString().slice(0,10)}.xlsx`);
  } else {
    addLogFeedback('Нет данных для экспорта.');
  }
  btn.disabled = false;
  exportFeedbackInProgress = false;
});

/* ======================= ФУНКЦИОНАЛ ФИЛЬТРОВ ======================= */
async function fetchCourseTypes() {
  try {
    await ensureToken();
    const response = await axios.get(COURSE_TYPES_URL, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const types = response.data;
    const container = document.getElementById('courseTypesContainer');
    container.innerHTML = '';
    types.forEach(type => {
      const label = document.createElement('label');
      label.style.display = 'block';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = type.name;
      checkbox.name = 'courseTypeCheckbox';
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(` ${type.name}`));
      container.appendChild(label);
    });
    addLog("Типы курсов успешно загружены для фильтрации.");
  } catch (error) {
    addLog(`Ошибка получения типов курсов: ${error}`);
  }
}

document.getElementById('filterBtn').addEventListener('click', async () => {
  currentFilterTarget = 'courses';
  await fetchCourseTypes();
  if (courseIdFileInput.files && courseIdFileInput.files.length > 0) {
    processCourseIdFilterFile(courseIdFileInput.files[0]);
  } else {
    window.filterOptions.courseIds = [];
  }
  document.getElementById('filterModal').style.display = 'block';
});

document.getElementById('filterMaterialsBtn').addEventListener('click', async () => {
  currentFilterTarget = 'materials';
  await fetchCourseTypes();
  if (courseIdFileInput.files && courseIdFileInput.files.length > 0) {
    processCourseIdFilterFile(courseIdFileInput.files[0]);
  } else {
    window.filterOptionsMaterials.courseIds = [];
  }
  document.getElementById('filterModal').style.display = 'block';
});

document.getElementById('applyFiltersBtn').addEventListener('click', () => {
  const startVal = document.getElementById('startDate').value || null;
  const endVal = document.getElementById('endDate').value || null;
  const checkboxes = document.querySelectorAll('input[name="courseTypeCheckbox"]:checked');
  const typesArr = Array.from(checkboxes).map(cb => cb.value);
  if (currentFilterTarget === 'courses') {
    window.filterOptions.startDate = startVal;
    window.filterOptions.endDate = endVal;
    window.filterOptions.courseTypes = typesArr;
    addLog('Фильтры применены для Курсов и потоков.');
  } else {
    window.filterOptionsMaterials.startDate = startVal;
    window.filterOptionsMaterials.endDate = endVal;
    window.filterOptionsMaterials.courseTypes = typesArr;
    addLogMaterials('Фильтры применены для Разделов и материалов.');
  }
  document.getElementById('filterModal').style.display = 'none';
});

document.getElementById('cancelFiltersBtn').addEventListener('click', () => {
  document.getElementById('filterModal').style.display = 'none';
});

window.onclick = function(event) {
  if (event.target == document.getElementById('filterModal')) {
    document.getElementById('filterModal').style.display = 'none';
  }
};

// Функция для обработки файла с course_id в фильтрах
function processCourseIdFilterFile(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    const ids = jsonData
      .map(row => String(row.course_id).trim())
      .filter(id => id.length > 0);
    if (ids.length > 0) {
      addLog(`Фильтр по course_id: найдено ${ids.length} записей.`);
      window.filterOptions.courseIds = ids;
      window.filterOptionsMaterials.courseIds = ids;
    } else {
      addLog("Файл с course_id не содержит данных.");
    }
  };
  reader.onerror = function(err) {
    addLog(`Ошибка чтения файла с course_id: ${err}`);
  };
  reader.readAsArrayBuffer(file);
}

const { ipcRenderer } = require('electron');
ipcRenderer.on('update-message', (event, message) => {
  console.log('Update message:', message);
  const updateDiv = document.getElementById('updateMessage');
  if (updateDiv) {
    updateDiv.textContent = message;
  }
});
