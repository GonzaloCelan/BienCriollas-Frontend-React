import { useEffect, useRef } from "react";

import "../styles/splash.css";

const title = "Bien Criollas";

type SplashScreenProps = {
  onFinish: () => void;
};

function SplashScreen({ onFinish }: SplashScreenProps) {
  const splashRef = useRef<HTMLElement | null>(null);
  const lettersRef = useRef<(HTMLSpanElement | null)[]>([]);
  const loaderRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timeline: { kill: () => void } | null = null;

    async function reproducirSplash() {
      const { default: gsap } = await import("gsap");
      if (cancelled) return;

      const letters = lettersRef.current.filter(Boolean);
      const tl = gsap.timeline({ onComplete: onFinish });
      timeline = tl;

      tl.fromTo(
        letters,
        {
          opacity: 0,
          y: 50,
          rotateX: -75,
          scale: 0.9,
          filter: "blur(12px)",
        },
        {
          opacity: 1,
          y: 0,
          rotateX: 0,
          scale: 1,
          filter: "blur(0px)",
          duration: 0.62,
          ease: "expo.out",
          stagger: 0.04,
        }
      );

      tl.fromTo(
        loaderRef.current,
        { opacity: 0, y: 10, scale: 0.9 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.25,
          ease: "power2.out",
        },
        "-=0.3"
      );

      tl.to({}, { duration: 0.35 });

      tl.to(loaderRef.current, {
        opacity: 0,
        y: -8,
        duration: 0.2,
        ease: "power2.in",
      });

      tl.to(
        letters,
        {
          opacity: 0,
          y: -34,
          rotateX: 70,
          filter: "blur(10px)",
          duration: 0.35,
          ease: "power3.in",
          stagger: { each: 0.018, from: "end" },
        },
        "-=0.08"
      );

      tl.to(
        splashRef.current,
        {
          opacity: 0,
          scale: 1.02,
          filter: "blur(6px)",
          duration: 0.25,
          ease: "power2.inOut",
        },
        "-=0.1"
      );
    }

    void reproducirSplash();

    return () => {
      cancelled = true;
      timeline?.kill();
    };
  }, [onFinish]);

  return (
    <section ref={splashRef} className="splash">
      <div className="splash__content is-visible">
        <h1 className="splash__title" aria-label={title}>
          {title.split("").map((letter, index) => (
            <span
              key={`${letter}-${index}`}
              ref={(element) => {
                lettersRef.current[index] = element;
              }}
              className={
                letter === " " ? "splash__letter space" : "splash__letter"
              }
            >
              {letter === " " ? "\u00A0" : letter}
            </span>
          ))}
        </h1>

        <div ref={loaderRef} className="splash__loader">
          <span />
          <span />
          <span />
        </div>
      </div>
    </section>
  );
}

export default SplashScreen;
