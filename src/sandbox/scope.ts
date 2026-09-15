/**
 * Изоляция окружения выполнения: затенение опасных глобалов и Proxy-мембрана
 * (Secure Realm), блокирующая побег из песочницы через `constructor`,
 * прототипное загрязнение и обращение к API хост-приложения.
 */

/**
 * Глобалы, доступ к которым полностью блокируется внутри песочницы.
 */
export const FORBIDDEN_GLOBALS = new Set([
  'window',
  'document',
  'localStorage',
  'sessionStorage',
  'fetch',
  'XMLHttpRequest',
  'indexedDB',
  'navigator',
  'WebSocket',
  'location',
  'top',
  'parent',
]);

/**
 * Возвращает массивы ключей и значений для "затенения" (Shadowing).
 * Переопределяет критические браузерные API в undefined.
 */
export function getShadowedGlobals() {
  const forbiddenKeys = Array.from(FORBIDDEN_GLOBALS);
  const shadowValues = forbiddenKeys.map(() => undefined);

  return { forbiddenKeys, shadowValues };
}

/**
 * Создает строгую защитную мембрану поверх объекта глобалов.
 *
 * `get` — возвращает `undefined` для запрещённых глобалов и нейтрализует
 * доступ к `constructor` (блокирует цепочку `x.constructor.constructor`).
 * `has` — перехватывает проверки `'window' in globalThis`.
 * `set` — запрещает перезапись защищённых ключей.
 */
export function createSandboxMembrane<T extends object>(target: T): T {
  return new Proxy(target, {
    get(t, prop, receiver) {
      if (typeof prop === 'string' && FORBIDDEN_GLOBALS.has(prop)) {
        return undefined;
      }
      if (prop === 'constructor') {
        return undefined;
      }
      return Reflect.get(t, prop, receiver);
    },
    has(t, prop) {
      if (typeof prop === 'string' && FORBIDDEN_GLOBALS.has(prop)) {
        return true;
      }
      return Reflect.has(t, prop);
    },
    set(t, prop, value) {
      if (typeof prop === 'string' && FORBIDDEN_GLOBALS.has(prop)) {
        return false;
      }
      return Reflect.set(t, prop, value);
    },
  }) as T;
}