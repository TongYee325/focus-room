export function Miniature({ game }: { game: string }) {
  if (game === 'schulte')
    return (
      <div className="mini-grid" aria-hidden="true">
        {[8, 3, 6, 1, 5, 9, 4, 7, 2].map((n) => (
          <span key={n} className={n === 1 ? 'lit' : ''}>
            {n}
          </span>
        ))}
      </div>
    );
  if (game === 'stroop')
    return (
      <div className="mini-stroop" aria-hidden="true">
        <span>蓝色</span>
        <div>
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>
    );
  if (game === 'sequence')
    return (
      <div className="mini-grid memory-mini" aria-hidden="true">
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} className={[0, 4, 7].includes(i) ? 'lit' : ''}>
            {i === 0 ? '1' : i === 4 ? '2' : i === 7 ? '3' : ''}
          </span>
        ))}
      </div>
    );
  return (
    <div className="mini-tracking" aria-hidden="true">
      {[
        [18, 24],
        [72, 16],
        [47, 49],
        [80, 70],
        [22, 79],
        [10, 51],
      ].map(([x, y], i) => (
        <i
          key={i}
          className={i < 2 ? 'target' : ''}
          style={{ left: `${x}%`, top: `${y}%` }}
        />
      ))}
    </div>
  );
}
