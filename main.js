// main.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    icon: path.join(__dirname, 'build', '309616865.jpg'), // путь к файлу иконки
    webPreferences: {
      preload: path.join(__dirname, 'src', 'preload.js'),
      nodeIntegration: false,       // отключено для безопасности
      contextIsolation: true
    }
  });
  mainWindow.loadFile('index.html');
  mainWindow.on('closed', () => mainWindow = null);
  
  // После создания окна запускаем проверку обновлений
  autoUpdater.checkForUpdatesAndNotify();
}

app.whenReady().then(() => {
  createWindow();

  // Настройка логирования для autoUpdater
  autoUpdater.logger = log;
  autoUpdater.logger.transports.file.level = 'info';


  autoUpdater.on('update-not-available', (info) => {
    log.info('Обновлений нет.', info);
    if(mainWindow) {
      mainWindow.webContents.send('update-message', 'Обновлений нет.');
    }
  });

  autoUpdater.on('error', (err) => {
    log.error('Ошибка автообновления: ', err);
    if(mainWindow) {
      mainWindow.webContents.send('update-message', 'Ошибка автообновления.');
    }
  });

  autoUpdater.on('download-progress', (progressObj) => {
    let log_message = "Скачивание: " + Math.round(progressObj.percent) + "%";
    log.info(log_message);
    if(mainWindow) {
      mainWindow.webContents.send('update-message', log_message);
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Обновление загружено.', info);
    if(mainWindow) {
      mainWindow.webContents.send('update-message', 'Обновление загружено. Приложение будет перезапущено для установки обновления.');
    }
    // Можно предложить пользователю установить обновление, например:
    setTimeout(() => {
      autoUpdater.quitAndInstall();
    }, 5000);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Обработчик для выбора пути сохранения файла Excel
ipcMain.handle('save-file-dialog', async (event, defaultPath) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Сохранить Excel файл',
    defaultPath,
    filters: [
      { name: 'Excel Files', extensions: ['xlsx'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  return canceled ? null : filePath;
});

// Обработчик логов
ipcMain.on('log-message', (event, message) => {
  log.info(message);
});

ipcMain.handle('save-and-write-file', async (event, defaultPath, data) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Сохранить Excel файл',
    defaultPath,
    filters: [
      { name: 'Excel Files', extensions: ['xlsx'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  
  if (!canceled && filePath) {
    fs.writeFileSync(filePath, Buffer.from(data));
    return filePath;
  }
  return null;
});

// Путь к файлу настроек
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

// Обработчик для загрузки настроек
ipcMain.handle('load-settings', async (event) => {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8');
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    log.error('Ошибка при загрузке настроек:', error);
    return null;
  }
});

// Обработчик для сохранения настроек
ipcMain.handle('save-settings', async (event, settings) => {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    return true;
  } catch (error) {
    log.error('Ошибка при сохранении настроек:', error);
    return false;
  }
});