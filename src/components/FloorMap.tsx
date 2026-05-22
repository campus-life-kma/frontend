import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { FloorMapData, RoomOnMap } from '../types/locations';

interface FloorMapProps {
  data: FloorMapData;
  onRoomClick: (room: RoomOnMap) => void;
  selectedRoomId: number | null;
}

const ROOM_TYPE_COLOR: Record<string, string> = {
  LIVING: '#cfe3ff',
  COMMON_AREA: '#d6f4d6',
  KITCHEN: '#fff1cf',
  LAUNDRY: '#e9d6ff',
  BATHROOM: '#cfecf4',
};
const BLOCKED_COLOR = '#f3b9b9';
const DEFAULT_FILL = '#e5e7eb';
const DEFAULT_STROKE = '#3A4A6B';
const SELECTED_STROKE = '#1d4ed8';
const FALLBACK_SVG_URL = '/map.svg';

function fillFor(room: RoomOnMap): string {
  if (room.is_blocked) return BLOCKED_COLOR;
  return ROOM_TYPE_COLOR[room.room_type] ?? DEFAULT_FILL;
}

async function fetchSvg(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

export default function FloorMap({
  data,
  onRoomClick,
  selectedRoomId,
}: FloorMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgUrl = data.map_file ?? FALLBACK_SVG_URL;

  const svgQuery = useQuery({
    queryKey: ['svg', svgUrl],
    queryFn: () => fetchSvg(svgUrl),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !svgQuery.data) return;

    const handlers: Array<{ el: SVGElement; fn: () => void }> = [];

    for (const room of data.rooms) {
      const el = container.querySelector<SVGElement>(
        `#${CSS.escape(room.svg_element_id)}`
      );
      if (!el) continue;

      el.setAttribute('fill', fillFor(room));
      el.setAttribute('fill-opacity', '0.85');
      el.style.cursor = 'pointer';

      const isSelected = room.id === selectedRoomId;
      el.setAttribute('stroke', isSelected ? SELECTED_STROKE : DEFAULT_STROKE);
      el.setAttribute('stroke-width', isSelected ? '6' : '4');

      const handler = () => onRoomClick(room);
      el.addEventListener('click', handler);
      handlers.push({ el, fn: handler });
    }

    return () => {
      for (const { el, fn } of handlers) el.removeEventListener('click', fn);
    };
  }, [data.rooms, svgQuery.data, selectedRoomId, onRoomClick]);

  if (svgQuery.isError) {
    return (
      <p className="text-sm text-red-700">
        Не вдалося завантажити мапу: {String(svgQuery.error)}
      </p>
    );
  }
  if (!svgQuery.data) {
    return <p className="text-sm text-gray-500">Завантажуємо мапу…</p>;
  }
  return (
    <div
      ref={containerRef}
      className="[&_svg]:h-auto [&_svg]:max-h-[75vh] [&_svg]:w-full"
      dangerouslySetInnerHTML={{ __html: svgQuery.data }}
    />
  );
}
