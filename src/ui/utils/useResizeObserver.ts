import { useEffect, useState, type RefObject } from 'react';

export const useResizeObserver = (ref: RefObject<HTMLElement | null>) => {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setSize({ width, height });
      }
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);

  return size;
};
