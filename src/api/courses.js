import axios from 'axios';
import { ensureToken, getAuthHeaders } from './auth';
import { addLog, setProgress } from '../utils/logger';
import { delay } from '../utils/helpers';
import { URLS } from '../utils/constants';

/**
 * Получение всех курсов с пагинацией
 * @returns {Promise<Array>} Массив всех курсов
 */
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
      const response = await axios.get(URLS.COURSES, {
        params: { page, per_page },
        headers: { Authorization: `Bearer ${await ensureToken()}` }
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

/**
 * Получение детальной информации о курсе
 * @param {number|string} courseId - ID курса
 * @returns {Promise<Object>} Данные курса
 */
async function getCourseDetails(courseId) {
  await ensureToken();
  try {
    const response = await axios.get(`${URLS.COURSES}/${courseId}`, {
      headers: { Authorization: `Bearer ${await ensureToken()}` }
    });
    addLog(`Получены детали курса ID ${courseId}.`);
    return response.data;
  } catch (error) {
    addLog(`Ошибка получения деталей курса ${courseId}: ${error}`);
    return null;
  }
}

/**
 * Получение всех типов курсов
 * @returns {Promise<Array>} Массив типов курсов
 */
async function fetchCourseTypes() {
  try {
    await ensureToken();
    const response = await axios.get(URLS.COURSE_TYPES, {
      headers: { Authorization: `Bearer ${await ensureToken()}` }
    });
    return response.data;
  } catch (error) {
    addLog(`Ошибка получения типов курсов: ${error}`);
    return [];
  }
}

export { fetchAllCourses, getCourseDetails, fetchCourseTypes };