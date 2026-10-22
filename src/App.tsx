import { useState, useCallback, useEffect, useRef } from 'react';

const SIZE = 8;
const COLORS = ['#ff6b6b', '#feca57', '#48dbfb', '#1dd1a1', '#ff9ff3', '#f368e0', '#54a0ff', '#ff9f43'];

type CellColor = string | null;
type Board = CellColor[][];
type Shape = number[][];

interface Piece {
  shape: Shape;
  color: string;
  used: boolean;
}

type ModeId = 'classic' | 'zen' | 'timeattack' | 'marathon';

interface ModeDef {
  id: ModeId;
  icon: string;
  label: string;
  desc: string;
  timeLimit?: number; // seconds
  dailyGoal?: number; // lines to clear
}

const MODES: ModeDef[] = [
  { id: 'classic', icon: '🎮', label: 'Классика', desc: 'Собирай линии, бей рекорды. Одна ошибка — конец игры.' },
  { id: 'zen', icon: '🧘', label: 'Дзен', desc: 'Без таймеров и поражений. Чистая медитация.' },
  { id: 'timeattack', icon: '⏱️', label: 'Гонка на время', desc: '2 минуты на борту. Рекорд считается в каждом режиме!', timeLimit: 120 },
  { id: 'marathon', icon: '🏃', label: 'Марафон', desc: 'Цель: 15 линий за игру. Уложись в 4 минуты!', timeLimit: 240, dailyGoal: 15 },
];

const SHAPES: Shape[] = [
  [[1]],
  [[1, 1]],
  [[1], [1]],
  [[1, 1, 1]],
  [[1], [1], [1]],
  [[1, 1, 1, 1]],
  [[1], [1], [1], [1]],
  [[1, 1], [1, 1]],
  [[1, 1, 1], [1, 0, 0]],
  [[1, 1, 1], [0, 0, 1]],
  [[1, 0, 0], [1, 1, 1]],
  [[0, 0, 1], [1, 1, 1]],
  [[1, 1], [1, 0]],
  [[1, 1], [0, 1]],
  [[1, 0], [1, 1]],
  [[0, 1], [1, 1]],
  [[1, 1, 1], [1, 1, 1]],
  [[1, 1, 1, 1], [1, 0, 0, 0]],
  [[1, 1, 1], [0, 1, 0], [0, 1, 0]],
  [[1, 1, 1, 1], [0, 0, 1, 1]],
  [[1, 1], [1, 0], [1, 0]],
  [[1, 1], [0, 1], [0, 1]],
  [[1, 0], [1, 0], [1, 1]],
  [[0, 1], [0, 1], [1, 1]],
];

function createEmptyBoard(): Board {
  return Array.from({ length: SIZE }, () => Array<CellColor>(SIZE).fill(null));
}

function randomPiece(): Piece {
  const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  return { shape, color, used: false };
}

function spawnPieces(): Piece[] {
  return [randomPiece(), randomPiece(), randomPiece()];
}

function canPlace(board: Board, shape: Shape, r: number, c: number): boolean {
  for (let dr = 0; dr < shape.length; dr++) {
    for (let dc = 0; dc < shape[0].length; dc++) {
      if (!shape[dr][dc]) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) return false;
      if (board[nr][nc]) return false;
    }
  }
  return true;
}

function canPlaceAnywhere(board: Board, piece: Piece): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (canPlace(board, piece.shape, r, c)) return true;
    }
  }
  return false;
}

function findClearableCells(board: Board): Set<string> {
  const toClear = new Set<string>();

  // Horizontal lines
  for (let r = 0; r < SIZE; r++) {
    if (board[r].every((v) => v !== null)) {
      for (let c = 0; c < SIZE; c++) toClear.add(`${r},${c}`);
    }
  }

  // Vertical lines
  for (let c = 0; c < SIZE; c++) {
    let full = true;
    for (let r = 0; r < SIZE; r++) {
      if (!board[r][c]) {
        full = false;
        break;
      }
    }
    if (full) {
      for (let r = 0; r < SIZE; r++) toClear.add(`${r},${c}`);
    }
  }

  return toClear;
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function App() {
  const [mode, setMode] = useState<ModeId>('classic');
  const [board, setBoard] = useState<Board>(createEmptyBoard);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => +(localStorage.getItem('bb_best_classic') || 0));
  const [newRecords, setNewRecords] = useState(() => +(localStorage.getItem('bb_records_count') || 0));
  const [linesCount, setLinesCount] = useState(0);
  const [pieces, setPieces] = useState<Piece[]>(spawnPieces);
  const [clearingCells, setClearingCells] = useState<Set<string>>(new Set());
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [previewCells, setPreviewCells] = useState<{ cells: Set<string>; valid: boolean; row: number; col: number }>({
    cells: new Set(),
    valid: false,
    row: -1,
    col: -1,
  });
  const [dragPieceIdx, setDragPieceIdx] = useState<number | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [combo, setCombo] = useState(0);
  const [showCombo, setShowCombo] = useState(false);
  const [scorePopup, setScorePopup] = useState<{ value: number; key: number } | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [goalReached, setGoalReached] = useState(false);
  const [recordFlash, setRecordFlash] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const boardRef = useRef<HTMLDivElement>(null);
  const popupKey = useRef(0);
  const recordShownRef = useRef(false);

  const modeDef = MODES.find((m) => m.id === mode)!;
  const bestKey = `bb_best_${mode}`;

  // Update best score & count NEW RECORDS
  useEffect(() => {
    if (score > 0 && score > best) {
      setBest(score);
      localStorage.setItem(bestKey, String(score));
      if (!recordShownRef.current) {
        recordShownRef.current = true;
        setNewRecords((n) => {
          const next = n + 1;
          localStorage.setItem('bb_records_count', String(next));
          return next;
        });
        setRecordFlash(true);
        setTimeout(() => setRecordFlash(false), 2500);
      }
    }
  }, [score, best, bestKey]);

  // Reset "record already shown" flag on restart / mode change
  useEffect(() => {
    recordShownRef.current = false;
  }, [mode]);

  // Timers: countdown (time attack) and stopwatch (other modes)
  useEffect(() => {
    if (paused || gameOver) return;
    const interval = setInterval(() => {
      setElapsed((e) => e + 1);
      if (modeDef.timeLimit) {
        setTimeLeft((t) => {
          if (t === null) return t;
          if (t <= 1) {
            clearInterval(interval);
            setGameOver(true);
            return 0;
          }
          return t - 1;
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [paused, gameOver, modeDef.timeLimit, mode]);

  // Check game over when pieces/board change (not in Zen — pieces reroll instead)
  useEffect(() => {
    if (gameOver || paused) return;
    const remaining = pieces.filter((p) => !p.used);
    if (remaining.length === 0) return;
    const anyCanPlace = remaining.some((p) => canPlaceAnywhere(board, p));
    if (!anyCanPlace) {
      if (mode === 'zen') {
        // In Zen mode pieces never end the game — just reroll them
        setPieces(spawnPieces());
      } else {
        setGameOver(true);
      }
    }
  }, [pieces, board, gameOver, paused, mode]);

  // Marathon: goal reached?
  useEffect(() => {
    if (modeDef.dailyGoal && linesCount >= modeDef.dailyGoal && !goalReached) {
      setGoalReached(true);
      setScore((s) => s + 200);
      popupKey.current += 1;
      setScorePopup({ value: 200, key: popupKey.current });
      setTimeout(() => setScorePopup(null), 1200);
    }
  }, [linesCount, modeDef, goalReached]);

  const startGame = useCallback((m: ModeId) => {
    const def = MODES.find((x) => x.id === m)!;
    setMode(m);
    setBoard(createEmptyBoard());
    setScore(0);
    setLinesCount(0);
    setPieces(spawnPieces());
    setGameOver(false);
    setPaused(false);
    setClearingCells(new Set());
    setCombo(0);
    setScorePopup(null);
    setElapsed(0);
    setGoalReached(false);
    setTimeLeft(def.timeLimit ? def.timeLimit : null);
    setPreviewCells({ cells: new Set(), valid: false, row: -1, col: -1 });
    setDragPieceIdx(null);
    setDragPos(null);
    recordShownRef.current = false;
    setBest(+(localStorage.getItem(`bb_best_${m}`) || 0));
  }, []);

  const restartGame = useCallback(() => {
    startGame(mode);
  }, [mode, startGame]);

  const togglePause = useCallback(() => {
    if (gameOver) return;
    setPaused((p) => {
      const next = !p;
      if (next) {
        // cancel any active drag when pausing
        setDragPieceIdx(null);
        setDragPos(null);
        setPreviewCells({ cells: new Set(), valid: false, row: -1, col: -1 });
      }
      return next;
    });
  }, [gameOver]);

  // Space / P hotkeys for pause
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key.toLowerCase() === 'p' || e.key.toLowerCase() === 'з') {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'IFRAME') return;
        e.preventDefault();
        togglePause();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePause]);

  const handlePlace = useCallback(
    (pieceIdx: number, r: number, c: number) => {
      const piece = pieces[pieceIdx];
      if (!piece || piece.used) return;
      if (!canPlace(board, piece.shape, r, c)) return;

      // Place piece on board
      const newBoard = board.map((row) => [...row]);
      let cellsPlaced = 0;
      piece.shape.forEach((row, dr) => {
        row.forEach((v, dc) => {
          if (v) {
            newBoard[r + dr][c + dc] = piece.color;
            cellsPlaced++;
          }
        });
      });

      setBoard(newBoard);
      setScore((s) => s + cellsPlaced);

      // Mark piece as used
      const newPieces = pieces.map((p, i) => (i === pieceIdx ? { ...p, used: true } : p));
      setPieces(newPieces);

      // Check for lines to clear
      const toClear = findClearableCells(newBoard);
      if (toClear.size > 0) {
        setClearingCells(toClear);
        const newCombo = combo + 1;
        setCombo(newCombo);
        setShowCombo(true);
        setTimeout(() => setShowCombo(false), 1500);

        const bonus = toClear.size * 10 + (newCombo > 1 ? newCombo * 20 : 0);

        popupKey.current += 1;
        setScorePopup({ value: bonus, key: popupKey.current });
        setTimeout(() => setScorePopup(null), 1200);

        setTimeout(() => {
          const clearedBoard = newBoard.map((row) => [...row]);
          toClear.forEach((key) => {
            const [cr, cc] = key.split(',').map(Number);
            clearedBoard[cr][cc] = null;
          });
          setBoard(clearedBoard);
          setScore((s) => s + bonus);
          setLinesCount((l) => l + 1);
          setClearingCells(new Set());
        }, 500);
      } else {
        setCombo(0);
      }

      // Spawn new pieces if all used
      if (newPieces.every((p) => p.used)) {
        setTimeout(() => {
          setPieces(spawnPieces());
        }, 300);
      }
    },
    [board, pieces, combo]
  );

  // Get cell position from pointer coordinates
  const getCellFromPointer = useCallback(
    (clientX: number, clientY: number, pieceShape: Shape): { r: number; c: number } | null => {
      if (!boardRef.current) return null;
      const rect = boardRef.current.getBoundingClientRect();
      const padding = 8;
      const innerWidth = rect.width - padding * 2;
      const innerHeight = rect.height - padding * 2;
      const cellW = innerWidth / SIZE;
      const cellH = innerHeight / SIZE;

      // Offset so the piece is above the finger
      const offsetY = -cellH * 2;
      const offsetX = -(pieceShape[0].length * cellW) / 2;

      const x = clientX - rect.left - padding + offsetX;
      const y = clientY - rect.top - padding + offsetY;

      const c = Math.floor(x / cellW);
      const r = Math.floor(y / cellH);

      if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return null;
      return { r, c };
    },
    []
  );

  // Global pointer move/up handlers
  useEffect(() => {
    const handleGlobalMove = (e: PointerEvent) => {
      if (dragPieceIdx === null) return;
      e.preventDefault();

      setDragPos({ x: e.clientX, y: e.clientY });

      const piece = pieces[dragPieceIdx];
      if (!piece) return;

      const cellPos = getCellFromPointer(e.clientX, e.clientY, piece.shape);
      if (!cellPos) {
        setPreviewCells({ cells: new Set(), valid: false, row: -1, col: -1 });
        return;
      }

      const { r, c } = cellPos;
      const valid = canPlace(board, piece.shape, r, c);
      const cells = new Set<string>();

      piece.shape.forEach((row, dr) => {
        row.forEach((v, dc) => {
          if (v) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) {
              cells.add(`${nr},${nc}`);
            }
          }
        });
      });

      setPreviewCells({ cells, valid, row: r, col: c });
    };

    const handleGlobalUp = (e: PointerEvent) => {
      if (dragPieceIdx === null) return;
      e.preventDefault();

      const piece = pieces[dragPieceIdx];
      if (piece) {
        const cellPos = getCellFromPointer(e.clientX, e.clientY, piece.shape);
        if (cellPos && canPlace(board, piece.shape, cellPos.r, cellPos.c)) {
          handlePlace(dragPieceIdx, cellPos.r, cellPos.c);
        }
      }

      setDragPieceIdx(null);
      setDragPos(null);
      setPreviewCells({ cells: new Set(), valid: false, row: -1, col: -1 });
    };

    if (dragPieceIdx !== null) {
      window.addEventListener('pointermove', handleGlobalMove, { passive: false });
      window.addEventListener('pointerup', handleGlobalUp, { passive: false });
      window.addEventListener('pointercancel', handleGlobalUp, { passive: false });
    }

    return () => {
      window.removeEventListener('pointermove', handleGlobalMove);
      window.removeEventListener('pointerup', handleGlobalUp);
      window.removeEventListener('pointercancel', handleGlobalUp);
    };
  }, [dragPieceIdx, pieces, board, getCellFromPointer, handlePlace]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, idx: number) => {
      e.preventDefault();
      if (paused || gameOver) return;
      const piece = pieces[idx];
      if (piece.used) return;

      setDragPieceIdx(idx);
      setDragPos({ x: e.clientX, y: e.clientY });
    },
    [pieces, paused, gameOver]
  );

  const dragPiece = dragPieceIdx !== null ? pieces[dragPieceIdx] : null;

  // Measure the board so the dragged piece renders at EXACTLY board-cell size (no shrinking)
  const [boardPx, setBoardPx] = useState(0);
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const update = () => setBoardPx(el.getBoundingClientRect().width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const boardPadding = 8;
  const boardGap = 3;
  const cellPx = boardPx > 0 ? (boardPx - boardPadding * 2 - boardGap * (SIZE - 1)) / SIZE : 36;
  const dragOffsetY = cellPx * 2; // piece floats above the cursor, matching the preview offset

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e] text-white overflow-x-hidden select-none">
      {/* Hero Section */}
      <section className="text-center pt-10 pb-4 px-5">
        <h1
          className="text-4xl sm:text-5xl md:text-6xl font-extrabold mb-3 bg-clip-text text-transparent"
          style={{
            backgroundImage: 'linear-gradient(90deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3)',
            animation: 'glow 3s ease-in-out infinite',
          }}
        >
          BLOCK BLAST
        </h1>
        <p className="text-base sm:text-lg text-[#b8b8d4] max-w-xl mx-auto mb-4">
          Размещай фигуры на поле и заполняй линии — горизонтальные и вертикальные! Чем больше линий за раз — тем больше очков.
        </p>
        <div className="flex justify-center gap-3 flex-wrap mt-4">
          {[
            { icon: '🎯', label: 'Точность' },
            { icon: '🧩', label: 'Логика' },
            { icon: '⚡', label: 'Скорость' },
            { icon: '🏆', label: 'Рекорды' },
          ].map((f) => (
            <div
              key={f.label}
              className="bg-white/5 border border-white/10 px-4 py-2.5 rounded-2xl backdrop-blur-sm flex flex-col items-center"
            >
              <span className="text-xl mb-0.5">{f.icon}</span>
              <span className="text-xs text-gray-300">{f.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Game Modes */}
      <section className="max-w-lg mx-auto px-4 pb-4">
        <h2 className="text-center text-sm uppercase tracking-widest text-[#b8b8d4] mb-3">Выбери режим</h2>
        <div className="grid grid-cols-2 gap-2">
          {MODES.map((m) => {
            const active = m.id === mode;
            const modeBest = +(localStorage.getItem(`bb_best_${m.id}`) || 0);
            return (
              <button
                key={m.id}
                onClick={() => startGame(m.id)}
                className={`text-left p-3 rounded-2xl border transition-all cursor-pointer ${
                  active
                    ? 'bg-white/[0.12] border-[#48dbfb]/60 shadow-[0_0_15px_rgba(72,219,251,0.25)] scale-[1.02]'
                    : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.08] hover:scale-[1.02]'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{m.icon}</span>
                  <span className={`font-bold text-sm ${active ? 'text-[#48dbfb]' : 'text-white'}`}>{m.label}</span>
                  {active && <span className="ml-auto text-[10px] bg-[#48dbfb]/20 text-[#48dbfb] px-2 py-0.5 rounded-full">активен</span>}
                </div>
                <p className="text-[11px] text-gray-400 leading-snug mb-1">{m.desc}</p>
                <p className="text-[10px] text-[#feca57]">🏆 Рекорд режима: {modeBest}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Game Container */}
      <section className="max-w-lg mx-auto px-4 pb-8">
        <div className="bg-black/30 rounded-3xl border border-white/10 p-4 sm:p-5 shadow-[0_20px_60px_rgba(0,0,0,0.5)] relative">
          {/* Score Bar */}
          <div className="flex justify-between mb-4 gap-2 relative">
            <div className="bg-white/[0.08] px-3 py-2 rounded-xl text-center flex-1">
              <small className="block text-[#b8b8d4] text-[10px] uppercase tracking-wider">Счёт</small>
              <strong className="text-xl sm:text-2xl text-[#feca57]">{score}</strong>
            </div>
            <div className="bg-white/[0.08] px-3 py-2 rounded-xl text-center flex-1 relative overflow-hidden">
              <small className="block text-[#b8b8d4] text-[10px] uppercase tracking-wider">Рекорд</small>
              <strong className={`text-xl sm:text-2xl ${recordFlash ? 'text-[#1dd1a1]' : 'text-[#feca57]'}`}>{best}</strong>
              {recordFlash && (
                <span
                  className="absolute inset-0 pointer-events-none rounded-xl"
                  style={{ animation: 'recordGlow 2.5s ease-out forwards', boxShadow: '0 0 0 2px rgba(29,209,161,0.7)' }}
                />
              )}
            </div>
            <div className="bg-white/[0.08] px-3 py-2 rounded-xl text-center flex-1">
              <small className="block text-[#b8b8d4] text-[10px] uppercase tracking-wider">Новых рекордов</small>
              <strong className="text-xl sm:text-2xl text-[#1dd1a1]">🏆 {newRecords}</strong>
            </div>

            {/* Score popup */}
            {scorePopup && (
              <div
                key={scorePopup.key}
                className="absolute -top-2 left-1/2 -translate-x-1/2 text-[#1dd1a1] font-bold text-lg pointer-events-none"
                style={{ animation: 'scoreFloat 1.2s ease-out forwards' }}
              >
                +{scorePopup.value}
              </div>
            )}
          </div>

          {/* Timer / Goal bar */}
          {(modeDef.timeLimit || modeDef.dailyGoal) && (
            <div className="flex items-center justify-between gap-3 mb-3 px-1">
              {modeDef.timeLimit ? (
                <div className={`flex items-center gap-2 font-mono text-lg font-bold ${timeLeft !== null && timeLeft <= 15 ? 'text-[#ff6b6b] animate-pulse' : 'text-[#48dbfb]'}`}>
                  ⏱ {fmtTime(timeLeft ?? modeDef.timeLimit)}
                </div>
              ) : (
                <div className="text-sm text-[#b8b8d4]">⏳ Время: <span className="font-mono text-white">{fmtTime(elapsed)}</span></div>
              )}
              {modeDef.dailyGoal && (
                <div className="flex-1 max-w-[180px]">
                  <div className="text-[10px] uppercase tracking-wider text-[#b8b8d4] mb-1 text-right">
                    Цель: {Math.min(linesCount, modeDef.dailyGoal)}/{modeDef.dailyGoal} линий {goalReached && '✅'}
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#48dbfb] to-[#1dd1a1] transition-all duration-500"
                      style={{ width: `${Math.min(100, (linesCount / modeDef.dailyGoal) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Combo indicator */}
          {showCombo && combo > 1 && (
            <div className="text-center mb-2">
              <span
                className="inline-block text-lg font-bold text-[#ff9ff3]"
                style={{ animation: 'comboShake 0.5s ease-in-out' }}
              >
                🔥 COMBO x{combo}!
              </span>
            </div>
          )}

          {/* Control buttons: pause / restart */}
          <div className="flex justify-center gap-2 mb-3">
            <button
              onClick={togglePause}
              disabled={gameOver}
              className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all cursor-pointer ${
                gameOver
                  ? 'opacity-40 cursor-not-allowed bg-white/5'
                  : paused
                    ? 'bg-gradient-to-r from-[#1dd1a1] to-[#48dbfb] text-black hover:scale-105 active:scale-95'
                    : 'bg-white/10 hover:bg-white/20 border border-white/10'
              }`}
            >
              {paused ? '▶ Продолжить' : '⏸ Пауза'}
            </button>
            <button
              onClick={restartGame}
              className="px-4 py-2 rounded-xl font-semibold text-sm bg-white/10 hover:bg-white/20 border border-white/10 transition-all cursor-pointer active:scale-95"
            >
              🔄 Заново
            </button>
          </div>

          {/* Game Board */}
          <div
            ref={boardRef}
            className="grid grid-cols-8 gap-[3px] bg-black/40 p-2 rounded-2xl aspect-square mb-5 relative touch-none"
          >
            {board.map((row, r) =>
              row.map((cell, c) => {
                const key = `${r},${c}`;
                const isClearing = clearingCells.has(key);
                const isPreview = previewCells.cells.has(key);
                const previewValid = previewCells.valid;

                return (
                  <div
                    key={key}
                    className={`rounded-[4px] transition-all duration-150 relative
                      ${!cell && !isPreview ? 'bg-white/[0.06]' : ''}
                      ${isClearing ? 'animate-[clearAnim_0.5s_ease-out_forwards]' : ''}
                      ${isPreview && previewValid ? 'bg-white/25' : ''}
                      ${isPreview && !previewValid ? 'bg-red-400/30' : ''}
                    `}
                    style={{
                      ...(cell && !isClearing
                        ? {
                            background: cell,
                            boxShadow: `inset 0 0 10px rgba(255,255,255,0.3), 0 0 8px ${cell}`,
                          }
                        : {}),
                      ...(isPreview && previewValid && !cell
                        ? {
                            boxShadow: 'inset 0 0 10px rgba(255,255,255,0.5)',
                          }
                        : {}),
                    }}
                  />
                );
              })
            )}

            {/* Pause overlay on the board */}
            {paused && !gameOver && (
              <div
                className="absolute inset-0 z-30 rounded-2xl bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3"
                style={{ animation: 'fadeIn 0.3s ease-out' }}
              >
                <div className="text-5xl">⏸</div>
                <div className="text-2xl font-bold text-[#48dbfb]">Пауза</div>
                <div className="text-sm text-gray-300">Игра остановлена — таймер тоже</div>
                <button
                  onClick={togglePause}
                  className="mt-2 px-8 py-3 bg-gradient-to-r from-[#1dd1a1] to-[#48dbfb] rounded-full text-black font-bold text-lg hover:scale-105 active:scale-95 transition-transform cursor-pointer shadow-lg"
                >
                  ▶ Продолжить
                </button>
                <div className="text-xs text-gray-500">или клавиша Пробел / P</div>
              </div>
            )}
          </div>

          {/* Pieces Panel */}
          <div className="flex justify-around items-center min-h-[110px] bg-white/[0.05] rounded-2xl p-3 sm:p-4">
            {pieces.map((piece, idx) => {
              if (piece.used) {
                return <div key={idx} className="w-16 h-16 sm:w-20 sm:h-20" />;
              }
              const isDragging = dragPieceIdx === idx;
              return (
                <div
                  key={idx}
                  className={`cursor-grab active:cursor-grabbing transition-all duration-200 p-1.5 sm:p-2 rounded-xl touch-none
                    ${isDragging ? 'opacity-20' : 'hover:scale-110'}
                  `}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${piece.shape[0].length}, 1fr)`,
                    gap: '2px',
                  }}
                  onPointerDown={(e) => handlePointerDown(e, idx)}
                >
                  {piece.shape.map((row, dr) =>
                    row.map((v, dc) => (
                      <div
                        key={`${dr}-${dc}`}
                        className={`w-5 h-5 sm:w-6 sm:h-6 rounded-[3px] ${v ? '' : 'bg-transparent'}`}
                        style={{
                          background: v ? piece.color : 'transparent',
                          boxShadow: v ? 'inset 0 0 5px rgba(255,255,255,0.3)' : 'none',
                        }}
                      />
                    ))
                  )}
                </div>
              );
            })}
          </div>

          {/* Dragging piece overlay — rendered at EXACT board cell size so it never shrinks */}
          {dragPiece && dragPos && !paused && (
            <div
              className="fixed pointer-events-none z-50"
              style={{
                left: dragPos.x - (dragPiece.shape[0].length * (cellPx + boardGap)) / 2 + boardGap / 2,
                top: dragPos.y - dragOffsetY - (dragPiece.shape.length * (cellPx + boardGap)) / 2 + boardGap / 2,
                display: 'grid',
                gridTemplateColumns: `repeat(${dragPiece.shape[0].length}, ${cellPx}px)`,
                gridAutoRows: `${cellPx}px`,
                gap: `${boardGap}px`,
              }}
            >
              {dragPiece.shape.map((row, dr) =>
                row.map((v, dc) => (
                  <div
                    key={`${dr}-${dc}`}
                    className="rounded-[4px]"
                    style={{
                      background: v ? dragPiece.color : 'transparent',
                      boxShadow: v
                        ? `inset 0 0 10px rgba(255,255,255,0.4), 0 0 15px ${dragPiece.color}`
                        : 'none',
                      opacity: v ? 0.95 : 0,
                    }}
                  />
                ))
              )}
            </div>
          )}

          {/* Game Over */}
          {gameOver && (
            <div
              className="text-center p-5 bg-red-500/20 rounded-2xl mt-4"
              style={{ animation: 'fadeIn 0.5s ease-out' }}
            >
              <h2 className="text-2xl font-bold mb-2">
                💥 Игра окончена!
                {modeDef.timeLimit && <span className="block text-sm font-normal text-gray-300 mt-1">Время вышло ⏱</span>}
              </h2>
              <p className="text-lg mb-1">
                Ваш счёт: <span className="text-[#feca57] font-bold text-xl">{score}</span>
              </p>
              <p className="text-sm text-gray-300 mb-1">
                Линий собрано: <span className="font-bold">{linesCount}</span>
                {modeDef.dailyGoal && (
                  <>
                    {' '}
                    / цель {modeDef.dailyGoal} {goalReached ? '✅' : '❌'}
                  </>
                )}
              </p>
              {score >= best && score > 0 && (
                <p className="text-[#1dd1a1] font-semibold mb-3">🎉 Новый рекорд! Всего новых рекордов: {newRecords}</p>
              )}
              <button
                onClick={restartGame}
                className="mt-3 px-8 py-3 bg-gradient-to-r from-[#ff6b6b] to-[#feca57] rounded-full text-black font-bold text-lg hover:scale-105 active:scale-95 transition-transform cursor-pointer shadow-lg"
              >
                Играть снова
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Feedback Section */}
      <section className="max-w-lg mx-auto px-4 pb-8">
        <div className="bg-black/30 rounded-3xl border border-white/10 p-4 sm:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
          <div className="text-center mb-4">
            <div className="text-4xl mb-2">💬</div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage: 'linear-gradient(90deg, #48dbfb, #1dd1a1)',
                }}
              >
                Обратная связь
              </span>
            </h2>
            <p className="text-gray-400 text-sm max-w-md mx-auto mb-4">
              Есть вопросы, предложения или нашли ошибку? Поделитесь своим мнением!
            </p>

            {/* Toggle Button */}
            <button
              onClick={() => setIsFormOpen(!isFormOpen)}
              className="inline-flex items-center gap-2 py-3 px-8 bg-gradient-to-r from-[#48dbfb] to-[#1dd1a1] rounded-xl text-white font-bold text-lg hover:scale-105 active:scale-95 transition-transform cursor-pointer shadow-lg"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              {isFormOpen ? 'Скрыть форму' : 'Оставить отзыв'}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-4 w-4 transition-transform duration-300 ${isFormOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          </div>

          {/* Embedded Google Form - Collapsible */}
          <div
            className={`overflow-hidden transition-all duration-500 ease-in-out ${
              isFormOpen ? 'max-h-[700px] opacity-100 mt-4' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              <iframe
                src="https://docs.google.com/forms/d/e/1FAIpQLSfvjKKFakcGvGHes5p9SRr_SMdrS6aFxCGR43h2BAajgTs8hA/viewform?embedded=true"
                className="w-full border-0"
                style={{
                  minHeight: '600px',
                  height: '650px',
                }}
                title="Форма обратной связи"
                frameBorder="0"
                loading="lazy"
              >
                Загрузка…
              </iframe>
            </div>

            <p className="text-center text-gray-400 text-xs mt-3">
              Не видно форму?{' '}
              <a
                href="https://docs.google.com/forms/d/e/1FAIpQLSfvjKKFakcGvGHes5p9SRr_SMdrS6aFxCGR43h2BAajgTs8hA/viewform?usp=sending_link"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#48dbfb] underline hover:text-[#1dd1a1]"
              >
                Открыть форму обратной связи в новой вкладке →
              </a>
            </p>

            <p className="text-center text-gray-500 text-xs mt-3">
              Форма защищена Google. Ваши данные в безопасности 🔒
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-6 text-gray-500 text-sm">
        <p>© 2026 Block Blast — Сделано с ❤️ для любителей головоломок</p>
      </footer>
    </div>
  );
}
