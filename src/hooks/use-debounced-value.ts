import { useEffect, useState } from "react";

/** Retorna o valor após `delay` ms sem alterações (busca automática enquanto digita). */
export function useDebouncedValue<T>(value: T, delay = 600): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
