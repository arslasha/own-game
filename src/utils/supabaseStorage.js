import { createClient } from '@supabase/supabase-js';

// Дефолтные учетные данные Supabase (анонимный публичный ключ)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://pimfbkybqwunccgoczsi.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpbWZia3licXd1bmNjZ29jenNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MjcxMTgsImV4cCI6MjEwNjIwMzExOH0.oJCoI_misfn7-cAt5PnAcOHz2RQ6sD565ZrPWGRGr98';
const BUCKET_NAME = 'own-game-media';

export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// Функция оптимизации и сжатия изображения через Canvas перед загрузкой
export function compressImage(file, maxWidth = 900, maxHeight = 700, quality = 0.7) {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            width = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".webp"), {
                type: 'image/webp',
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/webp',
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

// Загрузка файла в папочную структуру игры `games/{gameId}/media/{filename}`
export async function uploadMediaToCloud(file, gameId = null, subfolder = 'media') {
  try {
    const processedFile = file.type.startsWith('image/')
      ? await compressImage(file)
      : file;

    if (supabase) {
      const fileExt = processedFile.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      
      // Путь: games/{gameId}/media/{fileName} или temp_media/{fileName}
      const filePath = gameId 
        ? `games/${gameId}/${subfolder}/${fileName}`
        : `temp_media/${fileName}`;

      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, processedFile, {
          cacheControl: '3600',
          upsert: true
        });

      if (!error && data) {
        const { data: publicUrlData } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(filePath);

        if (publicUrlData && publicUrlData.publicUrl) {
          return publicUrlData.publicUrl;
        }
      }
      console.warn("Не удалось выгрузить в Supabase Storage, используем локальное сжатие:", error);
    }
  } catch (err) {
    console.error("Ошибка при обработке файла:", err);
  }

  // Резервный Base64
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    if (file.type.startsWith('image/')) {
      compressImage(file, 700, 500, 0.6).then(compressedFile => {
        reader.readAsDataURL(compressedFile);
      });
    } else {
      reader.readAsDataURL(file);
    }
  });
}

// Сохранение JSON файла игры в структуру `games/{gameId}/config.json`
export async function saveGameConfigToCloud(config, targetGameId = null) {
  try {
    if (!supabase) return null;

    const gameId = targetGameId || config.id || `game_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const gameConfig = {
      ...config,
      id: gameId,
      created_at: config.created_at || Date.now(),
      last_accessed: Date.now()
    };

    const jsonStr = JSON.stringify(gameConfig);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const file = new File([blob], 'config.json', { type: 'application/json' });

    const filePath = `games/${gameId}/config.json`;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (!error && data) {
      triggerLazyCleanup();
      return gameId; // Возвращаем ID игры (например: game_17906..._a1b2c)
    }
    console.warn("Ошибка выгрузки игры в Supabase:", error);
  } catch (err) {
    console.error("Сбой сохранения игры в облаке:", err);
  }
  return null;
}

// Обновление даты активности (last_accessed)
async function updateGameActivityInCloud(gameId, config) {
  try {
    if (!supabase) return;
    const jsonStr = JSON.stringify(config);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const file = new File([blob], 'config.json', { type: 'application/json' });

    await supabase.storage
      .from(BUCKET_NAME)
      .upload(`games/${gameId}/config.json`, file, {
        cacheControl: '3600',
        upsert: true
      });
  } catch (e) {
    console.warn("Не удалось обновить дату активности игры:", e);
  }
}

// Загрузка JSON объекта игры из Supabase Storage по ID
export async function loadGameConfigFromCloud(gameId) {
  try {
    if (!supabase || !gameId) return null;

    // 1. Сначала пробуем новую структуру: games/{gameId}/config.json
    let publicUrlData = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(`games/${gameId}/config.json`).data;

    let res = await fetch(publicUrlData.publicUrl);
    
    // 2. Фоллбек для старых файлов игры вида games/{gameId}.json
    if (!res.ok) {
      publicUrlData = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(`games/${gameId}`).data;
      res = await fetch(publicUrlData.publicUrl);
    }

    if (res.ok) {
      const config = await res.json();
      if (config && Array.isArray(config.categories)) {
        const now = Date.now();
        const twelveHoursMs = 12 * 60 * 60 * 1000;
        if (!config.last_accessed || (now - config.last_accessed > twelveHoursMs)) {
          config.last_accessed = now;
          updateGameActivityInCloud(gameId, config);
        }

        triggerLazyCleanup();
        return config;
      }
    }
  } catch (err) {
    console.error("Ошибка загрузки игры из облака:", err);
  }
  return null;
}

// Вариант Б: Очистка изолированных папок неактивных игр без анализа JSON
export async function cleanOldCloudGames(ttlDays = 30) {
  try {
    if (!supabase) return;

    // 1. Получаем список элементов в папке games
    const { data: gameItems, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list('games', { limit: 500 });

    if (error || !gameItems || gameItems.length === 0) return;

    const now = Date.now();
    const maxAgeMs = ttlDays * 24 * 60 * 60 * 1000;

    for (const item of gameItems) {
      // Поддержка папочной структуры games/{gameId}/
      const gameFolder = item.name;

      // 2. Получаем файлы внутри игры games/{gameFolder}/
      const { data: folderContent } = await supabase.storage
        .from(BUCKET_NAME)
        .list(`games/${gameFolder}`, { limit: 100 });

      if (!folderContent) continue;

      const configFile = folderContent.find(f => f.name === 'config.json');
      const fileDate = configFile 
        ? new Date(configFile.updated_at || configFile.created_at).getTime()
        : new Date(item.updated_at || item.created_at).getTime();

      // Если игра неактивна более 30 дней, удаляем ВСЮ ее папку в 1 запрос!
      if (now - fileDate > maxAgeMs) {
        console.log(`[Auto-Cleanup] Удаляем неактивную папку игры games/${gameFolder}...`);

        const filesToDelete = [`games/${gameFolder}/config.json`];

        // Получаем файлы из папки media внутри игры
        const { data: mediaContent } = await supabase.storage
          .from(BUCKET_NAME)
          .list(`games/${gameFolder}/media`, { limit: 500 });

        if (mediaContent && mediaContent.length > 0) {
          mediaContent.forEach(mf => {
            if (mf.name) filesToDelete.push(`games/${gameFolder}/media/${mf.name}`);
          });
        }

        // Также удаляем любые прямые файлы в папке игры
        folderContent.forEach(f => {
          if (f.name && f.name !== 'config.json') {
            filesToDelete.push(`games/${gameFolder}/${f.name}`);
          }
        });

        // Пакетное удаление всех файлов папки за один запрос!
        await supabase.storage.from(BUCKET_NAME).remove(filesToDelete);
        console.log(`[Auto-Cleanup] Папка games/${gameFolder} и её файлы (${filesToDelete.length} шт.) полностью удалены.`);
      }
    }
  } catch (err) {
    console.error("Ошибка при фоновой очистке папок старых игр:", err);
  }
}

// Запуск фоновой проверки не чаще 1 раза в сутки
export function triggerLazyCleanup() {
  const lastCleanup = localStorage.getItem('own_game_last_cleanup');
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;

  if (!lastCleanup || (now - parseInt(lastCleanup, 10) > oneDayMs)) {
    localStorage.setItem('own_game_last_cleanup', now.toString());
    setTimeout(() => {
      cleanOldCloudGames(30);
    }, 4000);
  }
}
