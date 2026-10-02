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

export default function App() {
  const [board, setBoard] = useState<Board>(createEmptyBoard);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => +(localStorage.getItem('bb_best') || 0));
  const [linesCount, setLinesCount] = useState(0);
  const [pieces, setPieces] = useState<Piece[]>(spawnPieces);
  const [clearingCells, setClearingCells] = useState<Set<string>>(new Set());
  const [gameOver, setGameOver] = useState(false);
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

  const boardRef = useRef<HTMLDivElement>(null);
  const popupKey = useRef(0);

  // Update best score
  useEffect(() => {
    if (score > best) {
      setBest(score);
      localStorage.setItem('bb_best', String(score));
    }
  }, [score, best]);

  // Check game over when pieces change
  useEffect(() => {
    const remaining = pieces.filter((p) => !p.used);
    if (remaining.length === 0) return;
    const anyCanPlace = remaining.some((p) => canPlaceAnywhere(board, p));
    if (!anyCanPlace) {
      setGameOver(true);
    }
  }, [pieces, board]);

  const restartGame = useCallback(() => {
    setBoard(createEmptyBoard());
    setScore(0);
    setLinesCount(0);
    setPieces(spawnPieces());
    setGameOver(false);
    setClearingCells(new Set());
    setCombo(0);
    setScorePopup(null);
  }, []);

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
      const piece = pieces[idx];
      if (piece.used) return;

      setDragPieceIdx(idx);
      setDragPos({ x: e.clientX, y: e.clientY });
    },
    [pieces]
  );

  const dragPiece = dragPieceIdx !== null ? pieces[dragPieceIdx] : null;

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

      {/* Game Container */}
      <section className="max-w-lg mx-auto px-4 pb-8">
        <div className="bg-black/30 rounded-3xl border border-white/10 p-4 sm:p-5 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
          {/* Score Bar */}
          <div className="flex justify-between mb-4 gap-2 relative">
            <div className="bg-white/[0.08] px-3 py-2 rounded-xl text-center flex-1">
              <small className="block text-[#b8b8d4] text-[10px] uppercase tracking-wider">Счёт</small>
              <strong className="text-xl sm:text-2xl text-[#feca57]">{score}</strong>
            </div>
            <div className="bg-white/[0.08] px-3 py-2 rounded-xl text-center flex-1">
              <small className="block text-[#b8b8d4] text-[10px] uppercase tracking-wider">Рекорд</small>
              <strong className="text-xl sm:text-2xl text-[#feca57]">{best}</strong>
            </div>
            <div className="bg-white/[0.08] px-3 py-2 rounded-xl text-center flex-1">
              <small className="block text-[#b8b8d4] text-[10px] uppercase tracking-wider">Линий</small>
              <strong className="text-xl sm:text-2xl text-[#feca57]">{linesCount}</strong>
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
                  className={`cursor-grab active:cursor-grabbing transition-all duration-200 p-1.5 sm:p-2 rounded-xl
                    ${isDragging ? 'opacity-20 scale-75' : 'hover:scale-110 active:scale-95'}
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

          {/* Dragging piece overlay */}
          {dragPiece && dragPos && (
            <div
              className="fixed pointer-events-none z-50"
              style={{
                left: dragPos.x - (dragPiece.shape[0].length * 26) / 2,
                top: dragPos.y - 90,
                display: 'grid',
                gridTemplateColumns: `repeat(${dragPiece.shape[0].length}, 1fr)`,
                gap: '3px',
              }}
            >
              {dragPiece.shape.map((row, dr) =>
                row.map((v, dc) => (
                  <div
                    key={`${dr}-${dc}`}
                    className="w-6 h-6 sm:w-7 sm:h-7 rounded-[4px]"
                    style={{
                      background: v ? dragPiece.color : 'transparent',
                      boxShadow: v
                        ? `inset 0 0 8px rgba(255,255,255,0.4), 0 0 15px ${dragPiece.color}`
                        : 'none',
                      opacity: v ? 0.9 : 0,
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
              <h2 className="text-2xl font-bold mb-2">💥 Игра окончена!</h2>
              <p className="text-lg mb-1">
                Ваш счёт: <span className="text-[#feca57] font-bold text-xl">{score}</span>
              </p>
              {score >= best && score > 0 && (
                <p className="text-[#1dd1a1] font-semibold mb-3">🎉 Новый рекорд!</p>
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
            <p className="text-gray-400 text-sm max-w-md mx-auto">
              Есть вопросы, предложения или нашли ошибку? Заполните форму прямо здесь!
            </p>
          </div>

          {/* Embedded Google Form */}
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

          <p className="text-center text-gray-500 text-xs mt-3">
            Форма защищена Google. Ваши данные в безопасности 🔒
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-6 text-gray-500 text-sm">
        <p>© 2026 Block Blast — Сделано с ❤️ для любителей головоломок</p>
      </footer>
    </div>
  );
}
