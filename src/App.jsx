import React, { useState, useEffect } from 'react';
import { Board } from './components/Board';
import { QuestionView } from './components/QuestionView';
import { Scoreboard } from './components/Scoreboard';
import { GameEditor } from './components/GameEditor';
import {
  loadGameConfig,
  saveGameConfigToStorage,
  clearSavedGameConfig,
  encodeConfigToUrlHash,
  DEFAULT_CONFIG
} from './utils/gameStorage';

// Helpers for sessionStorage game state
function loadSessionState() {
  try {
    const raw = sessionStorage.getItem('game_session_state');
    if (raw) return JSON.parse(raw);
  } catch (e) { }
  return null;
}

export default function App() {
  const [gameConfig, setGameConfig] = useState(loadGameConfig);

  // Restore screen / played / scores from sessionStorage if present
  const _session = loadSessionState();
  const [currentScreen, setCurrentScreen] = useState(_session?.currentScreen || 'start');
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [activeCategoryTitle, setActiveCategoryTitle] = useState('');
  const [playedQuestions, setPlayedQuestions] = useState(() => new Set(_session?.playedQuestions || []));
  const [scores, setScores] = useState(_session?.scores || [0, 0, 0]);
  const [shareToast, setShareToast] = useState('');
  // Track whether a saved game session exists (for "Continue" button)
  const [hasSavedGame, setHasSavedGame] = useState(() => !!sessionStorage.getItem('game_session_state'));

  // Состояние для имен команд
  const [teams, setTeams] = useState(
    _session?.teams || ["Команда 1", "Команда 2", "Команда 3"]
  );

  // Persist game state to sessionStorage whenever it changes
  useEffect(() => {
    if (currentScreen === 'start' || currentScreen === 'editor') return;
    const state = {
      currentScreen: currentScreen === 'question' ? 'board' : currentScreen,
      playedQuestions: Array.from(playedQuestions),
      scores,
      teams,
    };
    sessionStorage.setItem('game_session_state', JSON.stringify(state));
  }, [currentScreen, playedQuestions, scores, teams]);

  // Применение темы оформления
  const applyThemeToCssRoot = (theme) => {
    if (!theme) return;
    const root = document.documentElement;
    const bg = theme.bg || '#00B7EB';
    const headerBg = theme.headerBg || '#FFF44F';
    const accent = theme.accent || '#E6007A';
    const text = theme.text || '#111827';
    const btnText = theme.btnText || '#FFFFFF';
    const bgBtnText = theme.bgBtnText || btnText;

    root.style.setProperty('--cyan-blue', bg);
    root.style.setProperty('--lemon-yellow', headerBg);
    root.style.setProperty('--bright-pink', accent);
    root.style.setProperty('--dark-text', text);
    root.style.setProperty('--header-text', text);
    root.style.setProperty('--btn-text', btnText);
    root.style.setProperty('--bg-text', bgBtnText);
  };

  useEffect(() => {
    if (gameConfig && gameConfig.theme) {
      applyThemeToCssRoot(gameConfig.theme);
    }
  }, [gameConfig]);

  const handleSaveConfig = (newConfig) => {
    setGameConfig(newConfig);
    saveGameConfigToStorage(newConfig);
  };

  const handleResetConfig = () => {
    clearSavedGameConfig();
    setGameConfig(DEFAULT_CONFIG);
  };

  const handleTeamNameChange = (index, newName) => {
    setTeams(prev => {
      const updated = [...prev];
      updated[index] = newName;
      return updated;
    });
  };

  const handleAddTeam = () => {
    if (teams.length >= 6) return;
    setTeams(prev => [...prev, `Команда ${prev.length + 1}`]);
    setScores(prev => [...prev, 0]);
  };

  const handleRemoveTeam = (index) => {
    if (teams.length <= 2) return;
    setTeams(prev => prev.filter((_, i) => i !== index));
    setScores(prev => prev.filter((_, i) => i !== index));
  };

  const handleSelectQuestion = (cIdx, qIdx, qId) => {
    setPlayedQuestions(prev => new Set(prev).add(qId));
    setActiveQuestion(gameConfig.categories[cIdx].questions[qIdx]);
    setActiveCategoryTitle(gameConfig.categories[cIdx].title);
    setCurrentScreen('question');
  };

  const handleScoreChange = (teamIdx, delta) => {
    setScores(prev => {
      const next = [...prev];
      next[teamIdx] += delta;
      return next;
    });
  };

  const showToast = (msg) => {
    setShareToast(msg);
    setTimeout(() => setShareToast(''), 3500);
  };

  const handleShareCurrentGame = () => {
    const encoded = encodeConfigToUrlHash(gameConfig);
    if (encoded) {
      const shareUrl = `${window.location.origin}${window.location.pathname}#data=${encoded}`;
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast("Ссылка на вашу игру скопирована! 🔗");
      });
    }
  };

  return (
    <>
      {/* ГЛОБАЛЬНОЕ ВСПЛЫВАЮЩЕЕ УВЕДОМЛЕНИЕ В ПРАВОМ НИЖНЕМ УГЛУ */}
      {shareToast && (
        <div className="global-toast-notification">
          <span className="toast-icon">🔗</span>
          <span>{shareToast}</span>
        </div>
      )}

      <div className="container">
        <header>
          <h1>{gameConfig.title || "Своя Игра"}</h1>
          <div className="header-right">
            <span className="theme-tag">{gameConfig.subtitle || ""}</span>
            {currentScreen === 'start' && (
              <button
                className="btn-header-edit"
                onClick={() => setCurrentScreen('editor')}
                title="Настроить игру"
              >
                ⚙️ Конструктор
              </button>
            )}
            {currentScreen === 'board' && (
              <button
                className="btn-header-edit"
                onClick={() => {
                  // Keep session state so "Continue" button appears on start screen
                  setCurrentScreen('start');
                }}
                title="Вернуться в главное меню"
              >
                🏠 Главное меню
              </button>
            )}
          </div>
        </header>

        {/* ЕКРАН ПРИВЕТСТВИЯ С НАСТРОЙКОЙ КОМАНД */}
        {currentScreen === 'start' && (
          <div className="start-screen">
            <h2 className="start-title">{gameConfig.title}</h2>
            <p className="start-subtitle">Введите названия команд перед началом:</p>

            <div className="team-inputs-grid">
              {teams.map((teamName, idx) => (
                <div key={idx} className="team-input-card">
                  <div className="team-input-top">
                    <label className="team-input-label">Команда {idx + 1}</label>
                    {teams.length > 2 && (
                      <button
                        className="btn-remove-team"
                        onClick={() => handleRemoveTeam(idx)}
                        title="Удалить команду"
                      >×</button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={teamName}
                    onChange={(e) => handleTeamNameChange(idx, e.target.value)}
                    placeholder={`Название команды ${idx + 1}`}
                    className="team-input-field"
                  />
                </div>
              ))}
              {teams.length < 6 && (
                <button className="team-input-card btn-add-team" onClick={handleAddTeam}>
                  + Добавить команду
                </button>
              )}
            </div>

            <div className="start-actions">
              {hasSavedGame && (
                <button
                  className="btn-main btn-continue"
                  onClick={() => setCurrentScreen('board')}
                >
                  ▶️ Продолжить игру
                </button>
              )}
              <button className="btn-main" onClick={() => {
                // Reset game state on new game
                setPlayedQuestions(new Set());
                setScores(new Array(teams.length).fill(0));
                sessionStorage.removeItem('game_session_state');
                setHasSavedGame(false);
                setCurrentScreen('board');
              }}>
                🚀 Начать новую игру
              </button>
            </div>
          </div>
        )}

        {/* ЕКРАН КОНСТРУКТОРА / РЕДАКТОРА */}
        {currentScreen === 'editor' && (
          <GameEditor
            config={gameConfig}
            onSaveConfig={handleSaveConfig}
            onResetConfig={handleResetConfig}
            onBack={() => setCurrentScreen('start')}
            onPreviewTheme={applyThemeToCssRoot}
            onShowToast={showToast}
          />
        )}

        {/* ЕКРАН ТАБЛО */}
        {currentScreen === 'board' && (
          <Board
            categories={gameConfig.categories}
            playedQuestions={playedQuestions}
            onSelectQuestion={handleSelectQuestion}
          />
        )}

        {/* ЕКРАН ВОПРОСА */}
        {currentScreen === 'question' && activeQuestion && (
          <QuestionView
            question={activeQuestion}
            categoryTitle={activeCategoryTitle}
            onBack={() => setCurrentScreen('board')}
          />
        )}

        {/* НИЖНИЙ СЧЕТЧИК КОМАНД */}
        {currentScreen !== 'editor' && (
          <Scoreboard teams={teams} scores={scores} onScoreChange={handleScoreChange} />
        )}
      </div>
    </>
  );
}