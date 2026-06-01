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
  if (!iconUrl) return null;

  return (
    <img
      src={iconUrl}
      alt=""
      width={size}
      height={size}
      className="shrink-0"
      style={{ opacity: resource.is_blocked ? 0.4 : 1 }}
    />
  );
}
