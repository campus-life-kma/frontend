import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
  FloorMapData,
  ResourceOnMap,
  RoomOnMap,
  UserOnMap,
} from '../types/locations';

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

const SVG_NS = 'http://www.w3.org/2000/svg';
const OVERLAY_CLASS = 'campus-life-overlay';
const USER_RADIUS = 11;
const USER_GAP = 4;
const MAX_USER_CIRCLES = 6;
const RESOURCE_SIZE = 18;
const RESOURCE_GAP = 6;
const ROOM_PAD_X = 6;
const LABEL_TOP_GAP = 14;
const LABEL_FONT_MAX = 13;
const LABEL_FONT_MIN = 8;

function fillFor(room: RoomOnMap): string {
  if (room.is_blocked) return BLOCKED_COLOR;
  return ROOM_TYPE_COLOR[room.room_type] ?? DEFAULT_FILL;
}

function emojiForResource(resource: ResourceOnMap): string {
  const name = resource.name.toLowerCase();
  if (name.includes('пральн')) return '🧺';
  if (name.includes('сушильн')) return '🌀';
  if (name.includes('плит')) return '🍳';
  if (name.includes('душ')) return '🚿';
  if (name.includes('мікрох')) return '♨️';
  if (name.includes('чайник')) return '☕';
  return '🔧';
}

function initialOf(user: UserOnMap): string {
  return user.display_name.trim()[0]?.toUpperCase() ?? '?';
}

function buildUserNode(
  user: UserOnMap,
  cx: number,
  cy: number,
  defs: SVGDefsElement,
  uniqueKey: string
): SVGElement {
  const wrapper = document.createElementNS(SVG_NS, 'g');
  wrapper.style.pointerEvents = 'auto';
  wrapper.style.cursor = 'default';

  const title = document.createElementNS(SVG_NS, 'title');
  title.textContent = user.display_name;
  wrapper.appendChild(title);

  if (user.photo) {
    const clipId = `clip-${uniqueKey}`;
    const clipPath = document.createElementNS(SVG_NS, 'clipPath');
    clipPath.setAttribute('id', clipId);
    const clipCircle = document.createElementNS(SVG_NS, 'circle');
    clipCircle.setAttribute('cx', String(cx));
    clipCircle.setAttribute('cy', String(cy));
    clipCircle.setAttribute('r', String(USER_RADIUS));
    clipPath.appendChild(clipCircle);
    defs.appendChild(clipPath);

    const image = document.createElementNS(SVG_NS, 'image');
    image.setAttributeNS(
      'http://www.w3.org/1999/xlink',
      'xlink:href',
      user.photo
    );
    image.setAttribute('href', user.photo);
    image.setAttribute('x', String(cx - USER_RADIUS));
    image.setAttribute('y', String(cy - USER_RADIUS));
    image.setAttribute('width', String(USER_RADIUS * 2));
    image.setAttribute('height', String(USER_RADIUS * 2));
    image.setAttribute('clip-path', `url(#${clipId})`);
    image.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    wrapper.appendChild(image);
  } else {
    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', String(cx));
    circle.setAttribute('cy', String(cy));
    circle.setAttribute('r', String(USER_RADIUS));
    circle.setAttribute('fill', '#3b82f6');
    wrapper.appendChild(circle);

    const letter = document.createElementNS(SVG_NS, 'text');
    letter.textContent = initialOf(user);
    letter.setAttribute('x', String(cx));
    letter.setAttribute('y', String(cy + 4));
    letter.setAttribute('text-anchor', 'middle');
    letter.setAttribute('font-size', '11');
    letter.setAttribute('font-weight', '600');
    letter.setAttribute('fill', 'white');
    wrapper.appendChild(letter);
  }

  const border = document.createElementNS(SVG_NS, 'circle');
  border.setAttribute('cx', String(cx));
  border.setAttribute('cy', String(cy));
  border.setAttribute('r', String(USER_RADIUS));
  border.setAttribute('fill', 'none');
  border.setAttribute('stroke', 'white');
  border.setAttribute('stroke-width', '1.5');
  wrapper.appendChild(border);

  return wrapper;
}

function buildOverflowNode(count: number, cx: number, cy: number): SVGElement {
  const wrapper = document.createElementNS(SVG_NS, 'g');
  const circle = document.createElementNS(SVG_NS, 'circle');
  circle.setAttribute('cx', String(cx));
  circle.setAttribute('cy', String(cy));
  circle.setAttribute('r', String(USER_RADIUS));
  circle.setAttribute('fill', '#6b7280');
  circle.setAttribute('stroke', 'white');
  circle.setAttribute('stroke-width', '1.5');
  wrapper.appendChild(circle);

  const text = document.createElementNS(SVG_NS, 'text');
  text.textContent = `+${count}`;
  text.setAttribute('x', String(cx));
  text.setAttribute('y', String(cy + 4));
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('font-size', '10');
  text.setAttribute('font-weight', '600');
  text.setAttribute('fill', 'white');
  wrapper.appendChild(text);

  return wrapper;
}

function buildResourceNode(
  resource: ResourceOnMap,
  cx: number,
  cy: number
): SVGElement {
  const wrapper = document.createElementNS(SVG_NS, 'g');
  wrapper.style.pointerEvents = 'auto';

  const title = document.createElementNS(SVG_NS, 'title');
  title.textContent = resource.is_blocked
    ? `${resource.name} (зайнятий)`
    : resource.name;
  wrapper.appendChild(title);

  const text = document.createElementNS(SVG_NS, 'text');
  text.textContent = emojiForResource(resource);
  text.setAttribute('x', String(cx));
  text.setAttribute('y', String(cy + 6));
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('font-size', '16');
  if (resource.is_blocked) text.setAttribute('opacity', '0.45');
  wrapper.appendChild(text);

  return wrapper;
}

function findTopEdgeY(
  el: SVGGeometryElement,
  cx: number,
  bbox: DOMRect
): number {
  const centerY = bbox.y + bbox.height / 2;
  if (!el.isPointInFill({ x: cx, y: centerY })) {
    return bbox.y;
  }

  let lo = bbox.y;
  let hi = centerY;
  for (let i = 0; i < 24 && hi - lo > 0.5; i++) {
    const mid = (lo + hi) / 2;
    if (el.isPointInFill({ x: cx, y: mid })) {
      hi = mid;
    } else {
      lo = mid;
    }
  }

  return hi;
}

function fitRoomLabel(
  name: string,
  maxWidth: number,
  overlayGroup: SVGGElement
): { node: SVGTextElement; fontSize: number } {
  const label = document.createElementNS(SVG_NS, 'text');
  label.setAttribute('text-anchor', 'middle');
  label.setAttribute('font-weight', '600');
  label.setAttribute('fill', '#1f2937');
  label.style.pointerEvents = 'none';
  label.textContent = name;

  let fontSize = LABEL_FONT_MAX;
  label.setAttribute('font-size', String(fontSize));
  overlayGroup.appendChild(label);

  let textWidth = label.getComputedTextLength();
  if (textWidth > maxWidth && textWidth > 0) {
    const shrunkSize = Math.floor((LABEL_FONT_MAX * maxWidth) / textWidth);
    fontSize = Math.max(LABEL_FONT_MIN, shrunkSize);
    label.setAttribute('font-size', String(fontSize));
    textWidth = label.getComputedTextLength();

    if (textWidth > maxWidth && name.length > 1) {
      let trimmed = name;
      while (textWidth > maxWidth && trimmed.length > 1) {
        trimmed = trimmed.slice(0, -1);
        label.textContent = `${trimmed}…`;
        textWidth = label.getComputedTextLength();
      }
    }
  }

  return { node: label, fontSize };
}

function renderRoomOverlay(
  room: RoomOnMap,
  el: SVGGeometryElement,
  bbox: DOMRect,
  defs: SVGDefsElement,
  overlayGroup: SVGGElement
) {
  const cx = bbox.x + bbox.width / 2;
  const maxWidth = Math.max(20, bbox.width - ROOM_PAD_X * 2);
  const topY = findTopEdgeY(el, cx, bbox);

  const { node: label, fontSize } = fitRoomLabel(
    room.name,
    maxWidth,
    overlayGroup
  );
  const labelBaseline = topY + LABEL_TOP_GAP + fontSize;
  label.setAttribute('x', String(cx));
  label.setAttribute('y', String(labelBaseline));

  const userSlotWidth = USER_RADIUS * 2 + USER_GAP;
  const maxUserSlots = Math.max(
    0,
    Math.floor((maxWidth + USER_GAP) / userSlotWidth)
  );
  const userCap = Math.min(MAX_USER_CIRCLES, maxUserSlots);
  const needsOverflow = room.current_users.length > userCap;
  const visibleUsers = room.current_users.slice(
    0,
    needsOverflow ? Math.max(0, userCap - 1) : userCap
  );
  const overflow = room.current_users.length - visibleUsers.length;
  const slotsUsed = visibleUsers.length + (overflow > 0 ? 1 : 0);

  if (slotsUsed > 0) {
    const rowWidth = slotsUsed * userSlotWidth - USER_GAP;
    const startX = cx - rowWidth / 2 + USER_RADIUS;
    const rowY = labelBaseline + USER_RADIUS + 6;

    visibleUsers.forEach((user, index) => {
      const ux = startX + index * userSlotWidth;
      const node = buildUserNode(user, ux, rowY, defs, `${room.id}-${user.id}`);
      overlayGroup.appendChild(node);
    });

    if (overflow > 0) {
      const ox = startX + visibleUsers.length * userSlotWidth;
      overlayGroup.appendChild(buildOverflowNode(overflow, ox, rowY));
    }
  }

  if (room.resources.length > 0) {
    const resourceSlotWidth = RESOURCE_SIZE + RESOURCE_GAP;
    const maxResSlots = Math.max(
      0,
      Math.floor((maxWidth + RESOURCE_GAP) / resourceSlotWidth)
    );
    const resCap = Math.min(5, maxResSlots);
    if (resCap > 0) {
      const visible = room.resources.slice(0, resCap);
      const rowY = labelBaseline + (slotsUsed > 0 ? USER_RADIUS * 2 + 12 : 8);
      const rowWidth = visible.length * resourceSlotWidth - RESOURCE_GAP;
      const startX = cx - rowWidth / 2 + RESOURCE_SIZE / 2;
      visible.forEach((resource, index) => {
        const rx = startX + index * resourceSlotWidth;
        overlayGroup.appendChild(buildResourceNode(resource, rx, rowY));
      });
    }
  }
}

export default function FloorMap({
  data,
  onRoomClick,
  selectedRoomId,
}: FloorMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const svgQuery = useQuery({
    queryKey: ['svg', data.map_file],
    queryFn: () => fetchSvg(data.map_file!),
    enabled: !!data.map_file,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !svgQuery.data) return;
    const svg = container.querySelector<SVGSVGElement>('svg');
    if (!svg) return;

    svg.querySelectorAll(`.${OVERLAY_CLASS}`).forEach((node) => node.remove());

    let defs = svg.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS(SVG_NS, 'defs');
      svg.insertBefore(defs, svg.firstChild);
    }
    defs.classList.add(OVERLAY_CLASS);

    const overlayGroup = document.createElementNS(SVG_NS, 'g') as SVGGElement;
    overlayGroup.classList.add(OVERLAY_CLASS);
    overlayGroup.style.pointerEvents = 'none';
    svg.appendChild(overlayGroup);

    const cleanups: Array<() => void> = [];

    for (const room of data.rooms) {
      const el = container.querySelector<SVGGeometryElement>(
        `#${CSS.escape(room.svg_element_id)}`
      );
      if (!el) continue;

      el.setAttribute('fill', fillFor(room));
      el.setAttribute('fill-opacity', '0.85');
      el.style.cursor = 'pointer';
      el.style.transition = 'fill-opacity 120ms ease';

      const isSelected = room.id === selectedRoomId;
      el.setAttribute('stroke', isSelected ? SELECTED_STROKE : DEFAULT_STROKE);
      el.setAttribute('stroke-width', isSelected ? '6' : '4');

      const onEnter = () => el.setAttribute('fill-opacity', '1');
      const onLeave = () => el.setAttribute('fill-opacity', '0.85');
      const onClick = () => onRoomClick(room);
      el.addEventListener('mouseenter', onEnter);
      el.addEventListener('mouseleave', onLeave);
      el.addEventListener('click', onClick);
      cleanups.push(() => {
        el.removeEventListener('mouseenter', onEnter);
        el.removeEventListener('mouseleave', onLeave);
        el.removeEventListener('click', onClick);
      });

      let bbox: DOMRect;
      try {
        bbox = el.getBBox();
      } catch {
        continue;
      }
      if (bbox.width === 0 || bbox.height === 0) continue;
      renderRoomOverlay(room, el, bbox, defs as SVGDefsElement, overlayGroup);
    }

    return () => {
      for (const cleanup of cleanups) cleanup();
      overlayGroup.remove();
    };
  }, [data.rooms, svgQuery.data, selectedRoomId, onRoomClick]);

  if (!data.map_file) {
    return (
      <p className="text-sm text-gray-500">
        Для цього поверху мапа недоступна.
      </p>
    );
  }
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

async function fetchSvg(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}
