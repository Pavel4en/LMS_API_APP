import axios from 'axios';
import { ensureToken } from './auth';
import { addLog } from '../utils/logger';
import { delay, getOwnerName, getAuthorsNames } from '../utils/helpers';
import { CONFIG } from '../utils/constants';

/**
 * Получение всех сессий для курса
 * @param {number|string} courseId - ID курса
 * @returns {Promise<Array>} Массив сессий курса
 */
async function fetchCourseSessions(courseId) {
  const url = `${CONFIG.API_BASE}/courses/${courseId}/course_sessions`;
  let sessions = [];
  let page = 1;
  const per_page = 100;
  let moreData = true;
  
  while (moreData) {
    await ensureToken();
    try {
      const response = await axios.get(url, {
        params: { page, per_page },
        headers: { Authorization: `Bearer ${await ensureToken()}` }
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

/**
 * Получение детальной информации о сессии курса
 * @param {number|string} courseId - ID курса
 * @param {number|string} sessionId - ID сессии
 * @returns {Promise<Object>} Данные о сессии и слушателях
 */
async function fetchSessionDetails(courseId, sessionId) {
  const url = `${CONFIG.API_BASE}/courses/${courseId}/course_sessions/${sessionId}`;
  await ensureToken();
  
  try {
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${await ensureToken()}` }
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
    // Получаем owner_name и authorsNames через вспомогательные функции
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

/**
 * Обработка сессий для курса, получение дополнительной информации
 * @param {Object} course - Объект курса
 * @returns {Promise<Array>} Массив записей с информацией о сессиях
 */
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
        // Если докладчики есть – для каждого из них создаём запись
        for (const speaker of details.speakers) {
          const fullname = speaker.fullname ? speaker.fullname.trim() : '';
          records.push({
            course_id: course.id,
            course_name: course.name,
            session_id: sessionId,
            session_name: sessionName,
            user_id: speaker.id,
            fullname: fullname,
            listeners_count: details.listenersCount,
            owner_name: details.ownerName,
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

export { 
  fetchCourseSessions, 
  fetchSessionDetails,
  processCourseSessions
};