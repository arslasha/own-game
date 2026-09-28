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
      resolve(file); // Если это не картинка, возвращаем как есть
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
            height = maxHeight;
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

// Загрузка файла в Supabase Storage (или оптимизированный Base64, если Supabase не подключен)
export async function uploadMediaToCloud(file, folder = 'media') {
  try {
    // 1. Оптимизируем изображение, если это фото
    const processedFile = file.type.startsWith('image/')
      ? await compressImage(file)
      : file;

    // 2. Если подключен клиент Supabase Storage
    if (supabase) {
      const fileExt = processedFile.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const filePath = `${folder}/${fileName}`;

      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, processedFile, {
          cacheControl: '3600',
          upsert: false
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

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resolve(e.target.result);
    };
    if (file.type.startsWith('image/')) {
      compressImage(file, 700, 500, 0.6).then(compressedFile => {
        reader.readAsDataURL(compressedFile);
      });
    } else {
      reader.readAsDataURL(file);
    }
  });
}
export async function saveGameConfigToCloud(config) {
  try {
    if (!supabase) return null;

    const jsonStr = JSON.stringify(config);
    const gameId = `game_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.json`;
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const file = new File([blob], gameId, { type: 'application/json' });

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(`games/${gameId}`, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (!error && data) {
      return gameId; // Возвращаем короткий ID файла игры (например: game_17100000_a1b2c.json)
    }
    console.warn("Ошибка выгрузки игры в Supabase:", error);
  } catch (err) {
    console.error("Сбой сохранения игры в облаке:", err);
  }
  return null;
}

// Загрузка JSON объекта игры из Supabase Storage по ID
export async function loadGameConfigFromCloud(gameId) {
  try {
    if (!supabase || !gameId) return null;

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(`games/${gameId}`);

    if (publicUrlData && publicUrlData.publicUrl) {
      const res = await fetch(publicUrlData.publicUrl);
      if (res.ok) {
        const config = await res.json();
        if (config && Array.isArray(config.categories)) {
          return config;
        }
      }
    }
  } catch (err) {
    console.error("Ошибка загрузки игры из облака:", err);
  }
  return null;
}
