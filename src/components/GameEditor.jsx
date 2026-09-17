import React, { useState } from 'react';
import { THEME_PRESETS } from '../utils/themePresets';
import { encodeConfigToUrlHash, shortenUrlViaTinyUrl, copyToClipboard, exportConfigAsJson, DEFAULT_CONFIG } from '../utils/gameStorage';
import './GameEditor.css';

export const GameEditor = ({ config, onSaveConfig, onResetConfig, onBack, onPreviewTheme, onShowToast }) => {
  const [editedConfig, setEditedConfig] = useState(JSON.parse(JSON.stringify(config)));
  const [activeTab, setActiveTab] = useState('general'); // 'general' | 'questions' | 'export'
  const [selectedCategoryIdx, setSelectedCategoryIdx] = useState(0);
  const [copiedMessage, setCopiedMessage] = useState('');

  // Отмена изменений темы и выход
  const handleCancelAndBack = () => {
    if (onPreviewTheme && config.theme) {
      onPreviewTheme(config.theme);
    }
    onBack();
  };

  // Изменение общих настроек
  const handleGeneralChange = (field, value) => {
    setEditedConfig(prev => ({ ...prev, [field]: value }));
  };

  // Изменение темы с предпросмотром
  const handleThemeChange = (colorKey, value) => {
    setEditedConfig(prev => {
      const updatedTheme = { ...prev.theme, [colorKey]: value };
      if (onPreviewTheme) onPreviewTheme(updatedTheme);
      return { ...prev, theme: updatedTheme };
    });
  };

  const applyThemePreset = (presetTheme) => {
    setEditedConfig(prev => ({
      ...prev,
      theme: { ...presetTheme }
    }));
    if (onPreviewTheme) {
      onPreviewTheme(presetTheme);
    }
  };

  // Управление категориями
  const handleCategoryTitleChange = (idx, newTitle) => {
    setEditedConfig(prev => {
      const updated = [...prev.categories];
      updated[idx] = { ...updated[idx], title: newTitle };
      return { ...prev, categories: updated };
    });
  };

  const handleAddCategory = () => {
    const newCat = {
      title: "Новая Категория",
      questions: [100, 200, 300, 400, 500].map(pts => ({
        points: pts,
        q: "Вопрос на " + pts + " очков",
        a: "Ответ",
        options: []
      }))
    };
    setEditedConfig(prev => {
      const updated = [...prev.categories, newCat];
      return { ...prev, categories: updated };
    });
    setSelectedCategoryIdx(editedConfig.categories.length);
  };

  const handleDeleteCategory = (idx) => {
    if (editedConfig.categories.length <= 1) {
      alert("Нельзя удалить последнюю категорию!");
      return;
    }
    if (confirm("Вы уверены, что хотите удалить эту категорию со всеми вопросами?")) {
      setEditedConfig(prev => {
        const updated = prev.categories.filter((_, i) => i !== idx);
        return { ...prev, categories: updated };
      });
      setSelectedCategoryIdx(0);
    }
  };

  // Редактирование вопроса
  const handleQuestionChange = (catIdx, qIdx, field, value) => {
    setEditedConfig(prev => {
      const updatedCats = [...prev.categories];
      const updatedQs = [...updatedCats[catIdx].questions];
      updatedQs[qIdx] = { ...updatedQs[qIdx], [field]: value };
      updatedCats[catIdx] = { ...updatedCats[catIdx], questions: updatedQs };
      return { ...prev, categories: updatedCats };
    });
  };

  // Изменение вариантов ответов
  const handleOptionChange = (catIdx, qIdx, optIdx, value) => {
    setEditedConfig(prev => {
      const updatedCats = [...prev.categories];
      const updatedQs = [...updatedCats[catIdx].questions];
      const q = updatedQs[qIdx];
      const newOptions = [...(q.options || [])];
      newOptions[optIdx] = value;
      updatedQs[qIdx] = { ...q, options: newOptions };
      updatedCats[catIdx] = { ...updatedCats[catIdx], questions: updatedQs };
      return { ...prev, categories: updatedCats };
    });
  };

  const handleAddOption = (catIdx, qIdx) => {
    setEditedConfig(prev => {
      const updatedCats = [...prev.categories];
      const updatedQs = [...updatedCats[catIdx].questions];
      const q = updatedQs[qIdx];
      const options = q.options ? [...q.options] : [];
      if (options.length >= 4) {
        alert("Максимум 4 варианта (A, B, C, D)");
        return prev;
      }
      options.push(`Вариант ${options.length + 1}`);
      updatedQs[qIdx] = { ...q, options };
      updatedCats[catIdx] = { ...updatedCats[catIdx], questions: updatedQs };
      return { ...prev, categories: updatedCats };
    });
  };

  const handleRemoveOption = (catIdx, qIdx, optIdx) => {
    setEditedConfig(prev => {
      const updatedCats = [...prev.categories];
      const updatedQs = [...updatedCats[catIdx].questions];
      const q = updatedQs[qIdx];
      const options = (q.options || []).filter((_, i) => i !== optIdx);
      updatedQs[qIdx] = { ...q, options };
      updatedCats[catIdx] = { ...updatedCats[catIdx], questions: updatedQs };
      return { ...prev, categories: updatedCats };
    });
  };

  // Загрузка локального файла (картинки или видео) в base64
  const handleFileUpload = (catIdx, qIdx, field, file) => {
    if (!file) return;
    const isVideo = field.includes('video');
    const maxSize = isVideo ? 25 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      alert(`Файл слишком большой! Максимальный размер: ${isVideo ? '25МБ' : '5МБ'}.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      handleQuestionChange(catIdx, qIdx, field, e.target.result);
    };
    reader.readAsDataURL(file);
  };

  // Генерация и копирование делимой ссылки
  const handleCopyShareLink = async () => {
    const encoded = encodeConfigToUrlHash(editedConfig);
    if (!encoded) {
      alert("Ошибка создания ссылки!");
      return;
    }
    const fullShareUrl = `${window.location.origin}${window.location.pathname}#data=${encoded}`;
    if (onShowToast) {
      onShowToast("Создаем короткую ссылку... ⏳");
    }
    const finalUrl = await shortenUrlViaTinyUrl(fullShareUrl);
    const copied = await copyToClipboard(finalUrl);
    if (copied) {
      if (onShowToast) {
        onShowToast("Короткая ссылка скопирована! 🔗");
      }
    } else {
      alert("Не удалось скопировать ссылку автоматически.");
    }
  };

  // Импорт файла JSON
  const handleImportJson = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (imported && Array.isArray(imported.categories)) {
          setEditedConfig(imported);
          alert("Конфигурация успешно загружена!");
        } else {
          alert("Неверный формат JSON файла.");
        }
      } catch (err) {
        alert("Ошибка чтения JSON файла.");
      }
    };
    reader.readAsText(file);
  };

  const currentCategory = editedConfig.categories[selectedCategoryIdx] || editedConfig.categories[0];

  return (
    <div className="editor-container">
      <div className="editor-header">
        <h2 className="editor-title">⚙️ Конструктор «Своей Игры»</h2>
        <button className="btn-main btn-blue" onClick={handleCancelAndBack}>
          ⬅ Выйти без сохранения
        </button>
      </div>

      {/* ВКЛАДКИ НАВИГАЦИИ */}
      <div className="editor-tabs">
        <button
          className={`tab-btn ${activeTab === 'general' ? 'active' : ''}`}
          onClick={() => setActiveTab('general')}
        >
          🎨 Заголовок и Темы
        </button>
        <button
          className={`tab-btn ${activeTab === 'questions' ? 'active' : ''}`}
          onClick={() => setActiveTab('questions')}
        >
          📝 Категории и Вопросы
        </button>
        <button
          className={`tab-btn ${activeTab === 'export' ? 'active' : ''}`}
          onClick={() => setActiveTab('export')}
        >
          🔗 Поделиться и Экспорт
        </button>
      </div>

      <div className="editor-content">
        {/* ВКЛАДКА: ОБЩИЕ НАСТРОЙКИ И ТЕМЫ */}
        {activeTab === 'general' && (
          <div className="editor-section">
            <h3 className="section-title">Названия игры</h3>
            <div className="form-group">
              <label>Заголовок (Header Title):</label>
              <input
                type="text"
                className="editor-input"
                value={editedConfig.title}
                onChange={(e) => handleGeneralChange('title', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Подзаголовок (Тег):</label>
              <input
                type="text"
                className="editor-input"
                value={editedConfig.subtitle}
                onChange={(e) => handleGeneralChange('subtitle', e.target.value)}
              />
            </div>

            <h3 className="section-title" style={{ marginTop: '30px' }}>Цветовая Тема</h3>
            <p className="editor-hint">Выберите готовый пресет или настройте цвета вручную:</p>

            <div className="theme-presets-grid">
              {THEME_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  className="preset-card"
                  onClick={() => applyThemePreset(preset.theme)}
                >
                  <span className="preset-name">{preset.name}</span>
                  <div className="preset-swatches">
                    <span style={{ background: preset.theme.bg }} title="Фон" />
                    <span style={{ background: preset.theme.headerBg }} title="Шапка" />
                    <span style={{ background: preset.theme.accent }} title="Кнопки" />
                    <span style={{ background: preset.theme.text }} title="Текст" />
                  </div>
                </button>
              ))}
            </div>

            <div className="color-pickers-grid">
              <div className="color-field">
                <label>Основной Фон (Страница):</label>
                <input
                  type="color"
                  value={editedConfig.theme.bg || '#00B7EB'}
                  onChange={(e) => handleThemeChange('bg', e.target.value)}
                />
              </div>
              <div className="color-field">
                <label>Фон Шапки и Старта:</label>
                <input
                  type="color"
                  value={editedConfig.theme.headerBg || '#FFF44F'}
                  onChange={(e) => handleThemeChange('headerBg', e.target.value)}
                />
              </div>
              <div className="color-field">
                <label>Акцентный цвет (Кнопки):</label>
                <input
                  type="color"
                  value={editedConfig.theme.accent || '#FF69B4'}
                  onChange={(e) => handleThemeChange('accent', e.target.value)}
                />
              </div>
              <div className="color-field">
                <label>Цвет текста (Шапка и Заголовки):</label>
                <input
                  type="color"
                  value={editedConfig.theme.text || '#111827'}
                  onChange={(e) => handleThemeChange('text', e.target.value)}
                />
              </div>
              <div className="color-field">
                <label>Цвет текста на кнопках:</label>
                <input
                  type="color"
                  value={editedConfig.theme.btnText || '#FFFFFF'}
                  onChange={(e) => handleThemeChange('btnText', e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* ВКЛАДКА: ВОПРОСЫ И КАТЕГОРИИ */}
        {activeTab === 'questions' && (
          <div className="editor-section">
            <div className="categories-sidebar-container">
              {/* Список категорий слева */}
              <div className="categories-list">
                <h4>Категории:</h4>
                {editedConfig.categories.map((cat, idx) => (
                  <button
                    key={idx}
                    className={`cat-item-btn ${selectedCategoryIdx === idx ? 'active' : ''}`}
                    onClick={() => setSelectedCategoryIdx(idx)}
                  >
                    {idx + 1}. {cat.title || "Без названия"}
                  </button>
                ))}
                <button className="btn-add-cat" onClick={handleAddCategory}>
                  ➕ Добавить категорию
                </button>
              </div>

              {/* Содержимое выбранной категории справа */}
              {currentCategory && (
                <div className="category-detail">
                  <div className="category-header-edit">
                    <label>Название категории:</label>
                    <input
                      type="text"
                      className="editor-input cat-title-input"
                      value={currentCategory.title}
                      onChange={(e) => handleCategoryTitleChange(selectedCategoryIdx, e.target.value)}
                    />
                    <button
                      className="btn-delete"
                      onClick={() => handleDeleteCategory(selectedCategoryIdx)}
                    >
                      🗑 Удалить категорию
                    </button>
                  </div>

                  <h4>Вопросы в категории ({currentCategory.questions.length}):</h4>

                  <div className="questions-edit-list">
                    {currentCategory.questions.map((qObj, qIdx) => (
                      <div key={qIdx} className="question-edit-card">
                        <div className="q-card-header">
                          <span className="q-pts-tag">{qObj.points} Очков</span>
                          <div className="q-pts-field">
                            <label>Баллы:</label>
                            <input
                              type="number"
                              className="editor-input-sm"
                              value={qObj.points}
                              onChange={(e) => handleQuestionChange(selectedCategoryIdx, qIdx, 'points', Number(e.target.value))}
                            />
                          </div>
                        </div>

                        {/* Текст вопроса */}
                        <div className="form-group">
                          <label>Текст вопроса:</label>
                          <textarea
                            className="editor-textarea"
                            value={qObj.q || ''}
                            onChange={(e) => handleQuestionChange(selectedCategoryIdx, qIdx, 'q', e.target.value)}
                            rows={2}
                          />
                        </div>

                        {/* Правильный ответ */}
                        <div className="form-group">
                          <label>Правильный ответ:</label>
                          <input
                            type="text"
                            className="editor-input"
                            value={qObj.a || ''}
                            onChange={(e) => handleQuestionChange(selectedCategoryIdx, qIdx, 'a', e.target.value)}
                          />
                        </div>

                        {/* Варианты ответов A/B/C/D */}
                        <div className="form-group">
                          <div className="opts-header">
                            <label>Варианты ответов (опционально):</label>
                            <button
                              className="btn-sm"
                              onClick={() => handleAddOption(selectedCategoryIdx, qIdx)}
                            >
                              + Добавить вариант
                            </button>
                          </div>
                          {(qObj.options || []).map((opt, optIdx) => (
                            <div key={optIdx} className="opt-input-row">
                              <span className="opt-prefix">{String.fromCharCode(65 + optIdx)}:</span>
                              <input
                                type="text"
                                className="editor-input"
                                value={opt}
                                onChange={(e) => handleOptionChange(selectedCategoryIdx, qIdx, optIdx, e.target.value)}
                              />
                              <button
                                className="btn-icon-del"
                                onClick={() => handleRemoveOption(selectedCategoryIdx, qIdx, optIdx)}
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>

                        {/* Медиа файлы (Картинка / Видео / Картинка-ответ / Видео-ответ) */}
                        <div className="media-edit-header">
                          <h5>📁 Медиафайлы к вопросу (ссылка или загрузить файл):</h5>
                        </div>
                        <div className="media-edit-grid">
                          {[
                            { key: 'image', label: '🖼️ Фото ВОПРОСА (до ответа)', isVideo: false, placeholder: 'https://... или файл' },
                            { key: 'aimage', label: '🖼️ Фото ОТВЕТА (после ответа)', isVideo: false, placeholder: 'https://... или файл' },
                            { key: 'video', label: '🎥 Видео ВОПРОСА (до ответа)', isVideo: true, placeholder: 'https://... или файл' },
                            { key: 'avideo', label: '🎥 Видео ОТВЕТА (после ответа)', isVideo: true, placeholder: 'https://... или файл' },
                          ].map((item) => (
                            <div key={item.key} className="media-field-card">
                              <label className="media-field-label">{item.label}</label>
                              <input
                                type="text"
                                className="editor-input media-input-url"
                                placeholder={item.placeholder}
                                value={qObj[item.key] || ''}
                                onChange={(e) => handleQuestionChange(selectedCategoryIdx, qIdx, item.key, e.target.value)}
                              />
                              <div className="media-file-actions">
                                <label className="btn-file-custom">
                                  <span>{qObj[item.key] ? '🔄 Заменить файл' : '📁 Загрузить файл'}</span>
                                  <input
                                    type="file"
                                    accept={item.isVideo ? "video/*" : "image/*"}
                                    style={{ display: 'none' }}
                                    onChange={(e) => handleFileUpload(selectedCategoryIdx, qIdx, item.key, e.target.files[0])}
                                  />
                                </label>
                                {qObj[item.key] && (
                                  <button
                                    type="button"
                                    className="btn-media-clear"
                                    onClick={() => handleQuestionChange(selectedCategoryIdx, qIdx, item.key, '')}
                                    title="Очистить"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                              {/* ПРЕВЬЮ ПРИКРЕПЛЕННОГО ФАЙЛА */}
                              {qObj[item.key] && (
                                <div className="media-preview-box">
                                  {!item.isVideo ? (
                                    <img src={qObj[item.key]} alt="Превью" className="media-preview-img" />
                                  ) : (
                                    <div className="media-preview-video-badge">🎥 Видео прикреплено</div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ВКЛАДКА: ПОДЕЛИТЬСЯ И ЭКСПОРТ */}
        {activeTab === 'export' && (
          <div className="editor-section text-center">
            <h3 className="section-title">🔗 Поделиться настроенной игрой</h3>
            <p className="editor-hint">
              Сгенерируйте уникальную ссылку! Любой человек, открыв её, унесёт с собой все ваши настройки, вопросы и визуальные темы.
            </p>

            <div className="share-action-box">
              <button className="btn-main" onClick={handleCopyShareLink}>
                🔗 Скопировать ссылку на мою игру
              </button>
            </div>

            <hr className="editor-divider" />

            <h3 className="section-title">📥 Резервное сохранение (JSON)</h3>
            <p className="editor-hint">Вы можете сохранить игру в файл и загрузить её на любом компьютере:</p>

            <div className="json-actions-grid">
              <button className="btn-main btn-blue" onClick={() => exportConfigAsJson(editedConfig)}>
                📥 Скачать JSON файл
              </button>

              <label className="btn-main btn-file-label">
                📤 Загрузить из JSON
                <input
                  type="file"
                  accept=".json"
                  style={{ display: 'none' }}
                  onChange={handleImportJson}
                />
              </label>
            </div>

            <hr className="editor-divider" />

            <div className="reset-box">
              <button className="btn-delete" onClick={() => {
                if (confirm("Вы точно хотите сбросить все вопросы и тему к стандартным?")) {
                  setEditedConfig(DEFAULT_CONFIG);
                  onResetConfig();
                }
              }}>
                🔄 Сбросить всё к стандартной игре
              </button>
            </div>
          </div>
        )}
      </div>

      {/* НИЖНЯЯ ПАНЕЛЬ СОХРАНЕНИЯ */}
      <div className="editor-footer">
        <button className="btn-main btn-blue" onClick={handleCancelAndBack}>
          Отмена
        </button>
        <button
          className="btn-main"
          onClick={() => {
            onSaveConfig(editedConfig);
            onBack();
          }}
        >
          💾 Сохранить и начать игру!
        </button>
      </div>
    </div>
  );
};
