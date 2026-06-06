import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";

/**
 * Wrapper que faz fade+slide-up quando entra no viewport.
 * Usado para preencher a página inicial da liga com animação fluída de scroll.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
  as: As = "div",
  y = 24,
  style,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: any;
  y?: number;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;
    if (typeof IntersectionObserver === "undefined") { setShown(true); return; }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { setShown(true); io.disconnect(); }
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);

  return (
    <As
      ref={ref as any}
      className={className}
      style={{
        transition: "opacity 700ms cubic-bezier(.16,1,.3,1), transform 700ms cubic-bezier(.16,1,.3,1)",
        transitionDelay: `${delay}ms`,
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : `translateY(${y}px)`,
        willChange: "opacity, transform",
        ...style,
      }}
    >
      {children}
    </As>
  );
}
