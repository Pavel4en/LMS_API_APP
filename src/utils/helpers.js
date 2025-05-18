/**
 * Создаёт задержку выполнения
 * @param {number} ms - Миллисекунды задержки
 * @returns {Promise} Promise, разрешающийся после задержки
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Форматирует время в секундах в человекочитаемый формат
 * @param {number} seconds - Секунды
 * @returns {string} Отформатированное время в формате "X ч Y мин Z сек"
 */
function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h} ч ${m} мин ${s} сек`;
}

/**
 * Извлекает имя владельца из информации о курсе
 * @param {Object} courseInfo - Информация о курсе
 * @returns {string} Имя владельца
 */
function getOwnerName(courseInfo) {
  return (courseInfo.owner_name || '').trim();
}

/**
 * Формирует строку с именами авторов
 * @param {Object} courseInfo - Информация о курсе с авторами
 * @returns {string} Строка с именами авторов через запятую
 */
function getAuthorsNames(courseInfo) {
  if (courseInfo.authors && Array.isArray(courseInfo.authors) && courseInfo.authors.length > 0) {
    return courseInfo.authors
      .map(a => {
        // Формируем ФИО из полей last_name и name
        return `${(a.last_name || '').trim()} ${(a.name || '').trim()}`.trim();
      })
      .filter(Boolean) // Убираем пустые значения
      .join(', ');
  }
  return '';
}

/**
 * Применяет фильтры к списку курсов
 * @param {Array} courses - Список курсов
 * @param {Object} filters - Объект с параметрами фильтрации
 * @returns {Array} Отфильтрованный список курсов
 */
function applyCourseFilters(courses, filters) {
  return courses.filter(course => {
    // Фильтр по дате
    if (course.created_at) {
      const courseDate = new Date(course.created_at);
      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        if (courseDate < startDate) return false;
      }
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        if (courseDate > endDate) return false;
      }
    }
    
    // Фильтр по типам курсов
    if (filters.courseTypes.length > 0) {
      if (!course.types || !Array.isArray(course.types)) return false;
      const courseTypeNames = course.types.map(t => (t.name || '').toLowerCase());
      const filterMatch = filters.courseTypes.some(filterType => 
        courseTypeNames.includes(filterType.toLowerCase().trim())
      );
      if (!filterMatch) return false;
    }
    
    // Фильтр по ID курсов
    if (filters.courseIds && filters.courseIds.length > 0) {
      if (!filters.courseIds.includes(String(course.id).trim())) return false;
    }
    
    return true;
  });
}

export { 
  delay, 
  formatTime, 
  getOwnerName, 
  getAuthorsNames,
  applyCourseFilters
};