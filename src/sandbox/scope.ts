/**
 * Возвращает массивы ключей и значений для "затенения" (Shadowing).
 * Переопределяет критические браузерные API в undefined.
 */
export function getShadowedGlobals() {
  const forbiddenKeys = [
    'window',
    'document',
    'localStorage',
    'sessionStorage',
    'fetch',
    'XMLHttpRequest',
    'indexedDB',
    'navigator',
  ];

  const shadowValues = forbiddenKeys.map(() => undefined);

  return { forbiddenKeys, shadowValues };
}
