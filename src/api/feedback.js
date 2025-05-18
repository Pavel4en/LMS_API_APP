import axios from 'axios';
import { ensureToken, getAuthHeaders } from './auth';
import { addLogFeedback } from '../utils/logger';
import { CONFIG } from '../utils/constants';

/**
 * Создает новый раздел в курсе
 * @param {number|string} courseId - ID курса
 * @param {string} sectionName - Название раздела
 * @param {string} iconUrl - URL для иконки раздела
 * @returns {Promise<number|null>} ID созданного раздела или null в случае ошибки
 */
async function createSection(courseId, sectionName, iconUrl) {
  await ensureToken();
  const url = `${CONFIG.API_BASE}/courses/${courseId}/sections`;
  const headers = await getAuthHeaders();
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

/**
 * Добавляет материал с гиперссылкой в раздел
 * @param {number|string} sectionId - ID раздела
 * @param {string} materialName - Название материала
 * @param {string} link - Ссылка для вставки в материал
 * @param {string} materialTextTemplate - Шаблон текста материала
 * @returns {Promise<boolean>} Успешность добавления материала
 */
async function addMaterialWithHyperlink(sectionId, materialName, link, materialTextTemplate) {
  await ensureToken();
  const url = `${CONFIG.API_BASE}/sections/${sectionId}/materials`;
  const headers = await getAuthHeaders();
  
  // Заменяем {link} в шаблоне на актуальную ссылку
  const materialText = materialTextTemplate.replace('{link}', link);
  
  const content = {
    blocks: [
      {
        type: "paragraph",
        id: "unique-id",
        data: {
          text: materialText
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

/**
 * Создает URL с предзаполненными полями для формы обратной связи
 * @param {string} baseUrl - Базовый URL формы
 * @param {string} courseName - Название курса
 * @param {string|number} courseId - ID курса
 * @param {string} courseNameFieldId - ID поля для названия курса
 * @param {string} courseIdFieldId - ID поля для идентификатора курса
 * @returns {string} URL с параметрами
 */
function createPrefilledUrl(baseUrl, courseName, courseId, courseNameFieldId, courseIdFieldId) {
  const params = {};
  params[courseNameFieldId] = courseName;
  params[courseIdFieldId] = courseId;
  
  const encodedParams = Object.keys(params)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');
    
  return `${baseUrl}?${encodedParams}`;
}

export { 
  createSection, 
  addMaterialWithHyperlink,
  createPrefilledUrl
};