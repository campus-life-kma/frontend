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
      className={
        'flex w-16 flex-col gap-2 border-r border-gray-200 bg-white p-2'
      }
    >
      {sorted.map((floor) => {
        const active = floor.id === selectedFloorId;
        return (
          <button
            key={floor.id}
            type="button"
            onClick={() => onSelect(floor.id)}
            className={
              'flex h-12 items-center justify-center rounded-md ' +
              'text-base font-semibold transition ' +
              (active
                ? 'bg-blue-600 text-white shadow'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200')
            }
          >
            {floor.number}
          </button>
        );
      })}
    </aside>
  );
}
