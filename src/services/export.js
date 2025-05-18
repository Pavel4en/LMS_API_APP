import * as XLSX from 'xlsx';
import { addLog, addLogMaterials, addLogFeedback } from '../utils/logger';

/**
 * Экспортирует данные в Excel файл
 * @param {Array} data - Массив данных для экспорта
 * @param {string} defaultFileName - Имя файла по умолчанию
 * @param {function} logFunction - Функция для логирования (optional)
 * @returns {Promise<void>}
 */
async function exportToExcel(data, defaultFileName, logFunction = addLog) {
  logFunction("Начало экспорта в Excel");
  
  const exportData = data.map(item => ({ ...item }));
  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
  
  // Преобразуем workbook в двоичные данные
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  
  // Передаем двоичные данные в основной процесс для сохранения
  let filePath = await window.electronAPI.saveAndWriteFile(defaultFileName, wbout);
  
  if (filePath) {
    logFunction(`Файл успешно сохранён: ${filePath}`);
  } else {
    logFunction('Сохранение файла отменено.');
  }
}

/**
 * Обработка Excel файла и загрузка его содержимого
 * @param {File} file - Объект файла
 * @param {function} onSuccess - Функция обратного вызова при успехе
 * @param {function} onError - Функция обратного вызова при ошибке
 * @param {function} progressCallback - Функция для отображения прогресса
 * @param {function} logCallback - Функция для логирования
 */
function processExcelFile(file, onSuccess, onError, progressCallback, logCallback) {
  progressCallback('Чтение файла...');
  logCallback('Начало чтения файла...');
  
  const reader = new FileReader();
  
  reader.onload = function(e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    
    logCallback(`Файл прочитан. Найдено строк: ${jsonData.length}`);
    onSuccess(jsonData);
  };
  
  reader.onerror = function(err) {
    logCallback(`Ошибка чтения файла: ${err}`);
    progressCallback('Ошибка чтения файла.');
    onError(err);
  };
  
  reader.readAsArrayBuffer(file);
}

export { exportToExcel, processExcelFile };