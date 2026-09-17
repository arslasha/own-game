import React from 'react';
import './Scoreboard.css';

export const Scoreboard = ({ teams, scores, onScoreChange }) => {
  return (
    <footer>
      {teams.map((teamName, idx) => (
        <div className="team-card" key={idx}>
          <span className="team-name" title={teamName}>{teamName}</span>
          <div className="score-controls">
            <button className="score-btn minus" onClick={() => onScoreChange(idx, -100)}>-</button>
            <span className="team-score">{scores[idx]}</span>
            <button className="score-btn" onClick={() => onScoreChange(idx, 100)}>+</button>
          </div>
        </div>
      ))}
    </footer>
  );
};