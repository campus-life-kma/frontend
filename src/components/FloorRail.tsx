import type { FloorListItem } from '../types/locations';

interface FloorRailProps {
  floors: FloorListItem[];
  selectedFloorId: number | null;
  onSelect: (floorId: number) => void;
}

export default function FloorRail({
  floors,
  selectedFloorId,
  onSelect,
}: FloorRailProps) {
  if (floors.length === 0) return null;

  const sorted = [...floors].sort((a, b) => b.number - a.number);

  return (
    <aside
      id="floor-rail"
      className={
        'pointer-events-none absolute top-1/2 left-3 z-10 flex ' +
        '-translate-y-1/2 flex-col gap-1'
      }
    >
      {sorted.map((floor) => {
        const active = floor.id === selectedFloorId;
        return (
          <button
            key={floor.id}
            id={`floor-rail-button-${floor.id}`}
            type="button"
            onClick={() => onSelect(floor.id)}
            aria-current={active ? 'true' : undefined}
            className={
              'pointer-events-auto flex h-8 w-8 items-center justify-center ' +
              'text-base font-semibold transition ' +
              (active
                ? 'text-blue-700 underline decoration-2 underline-offset-4'
                : 'text-gray-700 hover:text-blue-700')
            }
          >
            {floor.number}
          </button>
        );
      })}
    </aside>
  );
}
