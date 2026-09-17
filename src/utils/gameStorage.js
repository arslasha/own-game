import { categories as defaultCategories } from '../data/questions';

export const DEFAULT_CONFIG = {
  title: "Своя Игра",
  subtitle: "",
  theme: {
    bg: "#00B7EB",
    headerBg: "#FFF44F",
    accent: "#E6007A",
    text: "#111827",
    btnText: "#FFFFFF",
    bgBtnText: "#FFFFFF"
  },
  teams: ["Команда 1", "Команда 2", "Команда 3"],
  categories: defaultCategories
};

import LZString from 'lz-string';

// Функция кодирования строки в сжатый формат для URL
export function encodeConfigToUrlHash(config) {
  try {
    const jsonStr = JSON.stringify(config);
    // Используем lz-string с безопасной кодировкой для URI компонентов
    const compressedStr = LZString.compressToEncodedURIComponent(jsonStr);
    return compressedStr;
  } catch (err) {
    console.error("Ошибка при кодировании конфигурации в URL:", err);
    return null;
  }
}

// Сокращение URL через бесплатный API TinyURL (с таймаутом и фоллбэком на исходный URL)
export async function shortenUrlViaTinyUrl(longUrl) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 сек таймаут

    const apiUrl = `https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`;
    const res = await fetch(apiUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const shortUrl = await res.text();
      if (shortUrl && shortUrl.startsWith('http')) {
        return shortUrl.trim();
      }
    }
  } catch (e) {
    console.warn("Не удалось сократить ссылку через TinyURL, используется полная ссылка:", e);
  }
  return longUrl;
}

// Надежная функция копирования текста в буфер обмена (работает и после async/await, и на любых сайтах)
export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn("navigator.clipboard не сработал, используем fallback:", err);
  }

  // Fallback через скрытый textarea и execCommand('copy')
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    textArea.remove();
    return successful;
  } catch (err) {
    console.error("Ошибка при копировании через fallback:", err);
    return false;
  }
}

// Функция декодирования из URL обратно в объект (поддерживает LZString и старый Base64)
export function decodeConfigFromUrlHash(rawStr) {
  try {
    // 1. Пробуем декодировать через lz-string
    const decompressed = LZString.decompressFromEncodedURIComponent(rawStr);
    if (decompressed) {
      const config = JSON.parse(decompressed);
      if (config && Array.isArray(config.categories)) {
        return config;
      }
    }
  } catch (err) {
    // Игнорируем ошибку и пробуем фоллбэк на старый base64
  }

  try {
    // 2. Фоллбэк: простая base64 строка (для старых ссылок)
    const jsonStr = decodeURIComponent(escape(atob(rawStr)));
    const config = JSON.parse(jsonStr);
    if (config && Array.isArray(config.categories)) {
      return config;
    }
  } catch (err) {
    console.error("Ошибка при декодировании конфигурации из URL:", err);
  }
  return null;
}

// Загрузка конфигурации: URL hash -> localStorage -> DEFAULT_CONFIG
export function loadGameConfig() {
  const hash = window.location.hash;
  if (hash && hash.includes("data=")) {
    const rawData = hash.split("data=")[1];
    if (rawData) {
      const decoded = decodeConfigFromUrlHash(rawData);
      if (decoded) return decoded;
    }
  }

  const saved = localStorage.getItem("game_custom_config");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.categories)) {
        return parsed;
      }
    } catch (e) {
      console.error("Ошибка парсинга localStorage:", e);
    }
  }

  return DEFAULT_CONFIG;
}

// Сохранение в localStorage
export function saveGameConfigToStorage(config) {
  try {
    localStorage.setItem("game_custom_config", JSON.stringify(config));
  } catch (e) {
    console.error("Не удалось сохранить в localStorage:", e);
  }
}

// Сброс настроек к дефолтным
export function clearSavedGameConfig() {
  localStorage.removeItem("game_custom_config");
}

// Экспорт конфигурации в .json файл
export function exportConfigAsJson(config) {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(config, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `game-config-${Date.now()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}
