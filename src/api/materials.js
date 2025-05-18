import axios from 'axios';
import { ensureToken } from './auth';
import { addLogMaterials } from '../utils/logger';
import { CONFIG } from '../utils/constants';

/**
 * Получение всех курсов с пагинацией для вкладки материалов
 * @param {function} setProgressCallback - Функция для вывода прогресса
 * @returns {Promise<Array>} Массив всех курсов
 */
async function fetchAllCoursesMaterials(setProgressCallback) {
  let courses = [];
  let page = 1;
  const per_page = 100;
  let moreData = true;
  
  while (moreData) {
    await ensureToken();
    setProgressCallback(`Получение курсов (материалы): страница ${page}...`);
    addLogMaterials(`Запрос курсов для материалов, страница ${page}`);
    
    try {
      const response = await axios.get(`${CONFIG.API_BASE}/courses`, {
        params: { page, per_page },
        headers: { Authorization: `Bearer ${await ensureToken()}` }
      });
      
      let data = Array.isArray(response.data)
        ? response.data
        : (response.data.data || []);
        
      addLogMaterials(`Страница ${page}: найдено ${data.length} курсов.`);
      
      if (Array.isArray(data) && data.length > 0) {
        courses = courses.concat(data);
        page++;
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        addLogMaterials('Больше курсов не найдено.');
        moreData = false;
      }
    } catch (error) {
      addLogMaterials(`Ошибка получения курсов на странице ${page}: ${error}`);
      moreData = false;
    }
  }
  
  setProgressCallback('Загрузка курсов для материалов завершена.');
  return courses;
}

/**
 * Получение детальной информации о разделах и материалах курса
 * @param {number|string} courseId - ID курса
 * @returns {Promise<Object|null>} Данные курса с разделами и материалами
 */
async function getCourseDetailsWithMaterials(courseId) {
  await ensureToken();
  try {
    const response = await axios.get(`${CONFIG.API_BASE}/courses/${courseId}`, {
      headers: { Authorization: `Bearer ${await ensureToken()}` }
    });
    addLogMaterials(`Получены детали курса ID ${courseId}.`);
    return response.data;
  } catch (error) {
    addLogMaterials(`Ошибка получения деталей курса ${courseId}: ${error}`);
    return null;
  }
}

export { fetchAllCoursesMaterials, getCourseDetailsWithMaterials };