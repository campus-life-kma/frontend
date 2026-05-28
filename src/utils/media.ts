export function resolveMediaUrl(url: string | null): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const apiUrl = import.meta.env.VITE_API_URL as string;
  const base = apiUrl.replace(/\/api\/?$/, '');
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}
