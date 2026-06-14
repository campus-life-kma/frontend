import { resolveMediaUrl } from '../utils/media';
import type { ResourceOnMap } from '../types/locations';

/**
 * Властивості для компоненка ResourceTypeIcon.
 */
interface ResourceTypeIconProps {
  /** Об'єкт ресурсу на карті. */
  resource: ResourceOnMap;
  /** Розмір іконки в пікселях (за замовчуванням 18px). */
  size?: number;
}

/**
 * Візуальний компонент іконки типу ресурсу.
 * Відображає завантажене зображення іконки ресурсу, або першу літеру назви
 * ресурсу, якщо іконка не вказана. Якщо ресурс заблокований,
 * іконка відображається напівпрозорою.
 */
export default function ResourceTypeIcon({
  resource,
  size = 18,
}: ResourceTypeIconProps) {
  const iconUrl = resolveMediaUrl(resource.resource_icon ?? null);
  const opacity = resource.is_blocked ? 0.4 : 1;

  return (
    <span
      className={
        'inline-flex shrink-0 items-center justify-center overflow-hidden ' +
        'rounded bg-gray-100 text-[10px] font-semibold text-gray-500'
      }
      style={{ width: size, height: size, opacity }}
      title={
        resource.resource_icon ? resource.name : 'Іконка ресурсу не вказана'
      }
    >
      {iconUrl ? (
        <img
          src={iconUrl}
          alt=""
          width={size}
          height={size}
          className="h-full w-full object-contain"
        />
      ) : (
        (resource.name.trim()[0]?.toUpperCase() ?? '?')
      )}
    </span>
  );
}
