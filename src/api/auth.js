import axios from 'axios';
import { addLog, setProgress } from '../utils/logger';
import { CONFIG } from '../utils/constants';

let accessToken = null;
let tokenExpiry = null; // в мс

/**
 * Получение нового токена доступа
 */
async function getAccessToken() {
  setProgress('Запрос нового токена...');
  addLog('Запрос нового токена...');
  try {
    const response = await axios.post(CONFIG.TOKEN_URL, {
      client_id: CONFIG.CLIENT_ID,
      client_secret: CONFIG.CLIENT_SECRET,
      grant_type: 'client_credentials'
    });
    accessToken = response.data.access_token;
    tokenExpiry = Date.now() + response.data.expires_in * 1000;
    addLog('Токен успешно получен.');
    return accessToken;
  } catch (error) {
    addLog(`Ошибка получения токена: ${error}`);
    throw error;
  }
}

/**
 * Проверка и обновление токена при необходимости
 * @returns {Promise<string>} Действующий токен доступа
 */
async function ensureToken() {
  if (!accessToken || Date.now() >= tokenExpiry) {
    await getAccessToken();
  }
  return accessToken;
}

/**
 * Получение заголовков для авторизованных запросов
 * @returns {Object} Объект с заголовком авторизации
 */
function getAuthHeaders() {
  return { 
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json' 
  };
}

export { ensureToken, getAuthHeaders };