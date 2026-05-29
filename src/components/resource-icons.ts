const C = 'currentColor';
const SW = '2';

const ICON_WASHING_MACHINE = [
  `<rect width="18" height="20" x="3" y="2" rx="2" fill="none"`,
  ` stroke="${C}" stroke-width="${SW}" stroke-linejoin="round"/>`,
  `<path d="M3 6h18" stroke="${C}" stroke-width="${SW}" stroke-linecap="round"/>`,
  `<circle cx="7" cy="4" r="0.8" fill="${C}"/>`,
  `<circle cx="12" cy="14" r="5" fill="none" stroke="${C}" stroke-width="${SW}"/>`,
  `<circle cx="12" cy="14" r="2" fill="none" stroke="${C}" stroke-width="1.5"/>`,
].join('');

const FLAME_D =
  'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 ' +
  '2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 ' +
  '1-3a2.5 2.5 0 0 0 2.5 2.5z';
const ICON_FLAME = [
  `<path d="${FLAME_D}" fill="none" stroke="${C}" stroke-width="${SW}"`,
  ` stroke-linejoin="round" stroke-linecap="round"/>`,
].join('');

const ICON_OVEN = [
  `<rect width="18" height="20" x="3" y="2" rx="2" fill="none"`,
  ` stroke="${C}" stroke-width="${SW}"/>`,
  `<path d="M3 8h18" stroke="${C}" stroke-width="${SW}"/>`,
  `<path d="M6 5h2" stroke="${C}" stroke-width="${SW}" stroke-linecap="round"/>`,
  `<path d="M16 5h2" stroke="${C}" stroke-width="${SW}" stroke-linecap="round"/>`,
  `<path d="M9 14h6" stroke="${C}" stroke-width="${SW}" stroke-linecap="round"/>`,
].join('');

const ICON_SHOWER = [
  `<path d="m22 22-5-5" stroke="${C}" stroke-width="${SW}" stroke-linecap="round"/>`,
  `<circle cx="12" cy="13" r="3" fill="none" stroke="${C}" stroke-width="${SW}"/>`,
  `<path d="M19.4 12.4a8 8 0 0 1-7 7" fill="none" stroke="${C}"`,
  ` stroke-width="${SW}" stroke-linecap="round"/>`,
  `<path d="M14 3v3" stroke="${C}" stroke-width="${SW}" stroke-linecap="round"/>`,
  `<path d="M18 7v4" stroke="${C}" stroke-width="${SW}" stroke-linecap="round"/>`,
  `<path d="m5 3 1 1" stroke="${C}" stroke-width="${SW}" stroke-linecap="round"/>`,
  `<path d="M4 4 2 6" stroke="${C}" stroke-width="${SW}" stroke-linecap="round"/>`,
].join('');

const ICON_MICROWAVE = [
  `<rect width="20" height="15" x="2" y="4" rx="2" fill="none"`,
  ` stroke="${C}" stroke-width="${SW}"/>`,
  `<rect width="8" height="7" x="6" y="8" fill="none" stroke="${C}" stroke-width="${SW}"/>`,
  `<path d="M18 8v7" stroke="${C}" stroke-width="${SW}"/>`,
  `<path d="M6 19v2" stroke="${C}" stroke-width="${SW}"/>`,
  `<path d="M18 19v2" stroke="${C}" stroke-width="${SW}"/>`,
].join('');

const KETTLE_D1 =
  'M2 12h2a4 4 0 0 0 4-4V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2a4 4 0 0 0 4 4';
const KETTLE_D2 = 'M4 12v6a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4v-6';
const ICON_KETTLE = [
  `<path d="${KETTLE_D1}" fill="none" stroke="${C}" stroke-width="${SW}"`,
  ` stroke-linejoin="round" stroke-linecap="round"/>`,
  `<path d="${KETTLE_D2}" fill="none" stroke="${C}" stroke-width="${SW}"`,
  ` stroke-linejoin="round"/>`,
].join('');

const TOOL_D =
  'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1 ' +
  '-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 ' +
  '7.94-7.94l-3.76 3.76z';
const ICON_TOOL = [
  `<path d="${TOOL_D}" fill="none" stroke="${C}" stroke-width="${SW}"`,
  ` stroke-linecap="round" stroke-linejoin="round"/>`,
].join('');

export function iconForResourceName(name: string): string {
  const lc = name.toLowerCase();
  if (lc.includes('пралк') || lc.includes('пральн')) {
    return ICON_WASHING_MACHINE;
  }
  if (lc.includes('сушильн')) return ICON_WASHING_MACHINE;
  if (lc.includes('варильн') || lc.includes('плит')) return ICON_FLAME;
  if (lc.includes('духов')) return ICON_OVEN;
  if (lc.includes('душ')) return ICON_SHOWER;
  if (lc.includes('мікрох')) return ICON_MICROWAVE;
  if (lc.includes('чайник')) return ICON_KETTLE;
  return ICON_TOOL;
}
