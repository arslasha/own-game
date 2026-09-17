import React, { useState } from 'react';
import './QuestionView.css';

export const QuestionView = ({ question, categoryTitle, onBack }) => {
  const [showAnswer, setShowAnswer] = useState(false);

  // Определяем активное медиа в зависимости от состояния кнопки "Показать ответ"
  const currentImage = (showAnswer && question.aimage) ? question.aimage : question.image;
  const currentVideo = (showAnswer && question.avideo) ? question.avideo : question.video;
  
  const hasMedia = Boolean(currentImage || currentVideo);
  const hasOptions = Boolean(question.options && question.options.length > 0);

  return (
    <div className="q-view">
      <div className="q-header-meta">
        <span className="q-badge">{categoryTitle}</span>
        <span className="q-points-badge">{question.points} Очков</span>
      </div>

      <div className={`q-content ${hasMedia ? 'has-media' : 'text-only'}`}>
        {/* Блок Медиа (Фото или Видео) */}
        {hasMedia && (
          <div className="q-media-wrapper">
            {currentVideo ? (
              <video 
                key={currentVideo} // key принудительно перезапускает видео при подмене
                src={currentVideo} 
                controls 
                autoPlay 
                className="q-media-element" 
              />
            ) : (
              <img 
                key={currentImage} 
                src={currentImage} 
                alt="Иллюстрация к вопросу" 
                className="q-media-element animate-pop" 
              />
            )}
          </div>
        )}

        {/* Текстовый блок: Текст, Варианты ответов и Сам ответ */}
        <div className="q-text-wrapper">
          <h2 className="q-title">{question.q}</h2>

          {/* Варианты ответов */}
          {hasOptions && (
            <div className="q-options-grid">
              {question.options.map((option, idx) => (
                <div key={idx} className="q-option-card">
                  <span className="q-option-letter">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span>{option}</span>
                </div>
              ))}
            </div>
          )}

          {/* Плашка с правильным ответом */}
          {showAnswer && (
            <div className="q-answer-box animate-pop">
              <span className="q-ans-label">Ответ:</span> {question.a}
            </div>
          )}
        </div>
      </div>

      {/* Кнопки управления */}
      <div className="q-actions">
        {!showAnswer ? (
          <button className="btn-main" onClick={() => setShowAnswer(true)}>
            Показать ответ
          </button>
        ) : (
          <button className="btn-main btn-blue" onClick={onBack}>
            Вернуться к табло
          </button>
        )}
      </div>
    </div>
  );
};