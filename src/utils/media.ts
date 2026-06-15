/**
 * Перетворює відносний шлях до медіа-файлу на повний URL.
 * Якщо шлях є повним URL (починається з http/https), повертає його без змін.
 *
 * @param url - Відносний або абсолютний шлях до файлу.
 * @returns Повний URL-шлях або null, якщо вхідний url порожній.
 */
export function resolveMediaUrl(url: string | null): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const apiUrl = import.meta.env.VITE_API_URL as string;
  const base = apiUrl.replace(/\/api\/?$/, '');
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}
