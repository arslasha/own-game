import React from 'react';
import './Board.css';

export const Board = ({ categories, playedQuestions, onSelectQuestion }) => {
  return (
    <div className="board-view">
      <div className="board-grid">
        {categories.map((cat, cIdx) => (
          <React.Fragment key={cIdx}>
            {/* Название категории */}
            <div className="category-cell">{cat.title}</div>
            
            {/* Кнопки очков */}
            {cat.questions.map((q, qIdx) => {
              const qId = `${cIdx}-${qIdx}`;
              const isPlayed = playedQuestions.has(qId);

              return (
                <div
                  key={qIdx}
                  className={`point-cell ${isPlayed ? 'played' : ''}`}
                  onClick={() => !isPlayed && onSelectQuestion(cIdx, qIdx, qId)}
                >
                  {q.points}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
