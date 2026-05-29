import { resolveMediaUrl } from '../utils/media';
import { iconForResourceName } from './resource-icons';
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

  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt=""
        width={size}
        height={size}
        className="shrink-0"
        style={{ opacity }}
      />
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className="shrink-0"
      style={{ color: resource.is_blocked ? '#9ca3af' : '#374151' }}
      dangerouslySetInnerHTML={{ __html: iconForResourceName(resource.name) }}
    />
  );
}
