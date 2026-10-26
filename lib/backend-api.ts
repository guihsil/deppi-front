export function backendApiUrl(path: string): string {
  const configuredUrl = process.env.API_BASE_URL;

  if (!configuredUrl) {
    throw new Error('A variável de ambiente API_BASE_URL não está configurada.');
  }

  let baseUrl: URL;
  try {
    baseUrl = new URL(configuredUrl);
  } catch {
    throw new Error('A variável API_BASE_URL deve conter uma URL absoluta válida.');
  }

  if (baseUrl.protocol !== 'http:' && baseUrl.protocol !== 'https:') {
    throw new Error('A variável API_BASE_URL deve usar HTTP ou HTTPS.');
  }

  if (baseUrl.search || baseUrl.hash) {
    throw new Error('A variável API_BASE_URL não deve conter query string ou fragmento.');
  }

  const pathname = baseUrl.pathname.replace(/\/+$/, '');
  const normalizedBase = `${baseUrl.origin}${pathname}`;

  return `${normalizedBase}${path.startsWith('/') ? path : `/${path}`}`;
}
