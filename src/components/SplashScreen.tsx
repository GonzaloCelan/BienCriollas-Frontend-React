import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

import "../styles/splash.css";

const title = "Bien Criollas";

type SplashScreenProps = {
  onFinish: () => void;
};

function SplashScreen({ onFinish }: SplashScreenProps) {
  const [started, setStarted] = useState(false);

  const splashRef = useRef<HTMLElement | null>(null);
  const lettersRef = useRef<(HTMLSpanElement | null)[]>([]);
  const loaderRef = useRef<HTMLDivElement | null>(null);

  function startSplash() {
    if (started) return;

    setStarted(true);
  }

  useEffect(() => {
    if (!started) return;

    const letters = lettersRef.current.filter(Boolean);

    const tl = gsap.timeline({
      onComplete: onFinish,
    });

    tl.fromTo(
      letters,
      {
        opacity: 0,
        y: 72,
        rotateX: -90,
        scale: 0.88,
        filter: "blur(16px)",
      },
      {
        opacity: 1,
        y: 0,
        rotateX: 0,
        scale: 1,
        filter: "blur(0px)",
        duration: 1.55,
        ease: "expo.out",
        stagger: 0.105,
      }
    );

    tl.fromTo(
      loaderRef.current,
      {
        opacity: 0,
        y: 18,
        scale: 0.88,
      },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.7,
        ease: "power3.out",
      },
      "-=0.55"
    );

    tl.to(
      letters,
      {
        y: -6,
        duration: 1.45,
        ease: "sine.inOut",
        stagger: {
          each: 0.03,
          from: "center",
        },
        yoyo: true,
        repeat: 1,
      },
      "+=0.15"
    );

    tl.to({}, { duration: 1.15 });

    tl.to(loaderRef.current, {
      opacity: 0,
      y: -14,
      scale: 0.85,
      duration: 0.55,
      ease: "power2.in",
    });

    tl.to(
      letters,
      {
        opacity: 0,
        y: -58,
        rotateX: 88,
        scale: 0.92,
        filter: "blur(16px)",
        duration: 1,
        ease: "power3.in",
        stagger: {
          each: 0.055,
          from: "end",
        },
      },
      "-=0.15"
    );

    tl.to(
      splashRef.current,
      {
        opacity: 0,
        scale: 1.04,
        filter: "blur(10px)",
        duration: 0.75,
        ease: "power2.inOut",
      },
      "-=0.15"
    );

    return () => {
      tl.kill();
    };
  }, [started, onFinish]);

  return (
    <section ref={splashRef} className="splash">
      {!started && (
        <button type="button" className="splash__start" onClick={startSplash}>
          Entrar
        </button>
      )}

      <div className={`splash__content ${started ? "is-visible" : ""}`}>
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
