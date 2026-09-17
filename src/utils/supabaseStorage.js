import { createClient } from '@supabase/supabase-js';

// Дефолтные учетные данные Supabase (анонимный клиент с публичным бакетом)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
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

  // 3. Умный фоллбэк: клиентское Canvas-сжатие картинок в мини-Base64
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
