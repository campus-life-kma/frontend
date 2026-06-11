import { resolveMediaUrl } from '../utils/media';
import type { ResourceOnMap } from '../types/locations';

interface ResourceTypeIconProps {
  resource: ResourceOnMap;
  size?: number;
}

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
