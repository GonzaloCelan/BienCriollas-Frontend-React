import { useEffect, useRef, type CSSProperties } from "react";
import type { AnimationItem } from "lottie-web";

type LottieAnimationProps = {
  animationData: object;
  className?: string;
  style?: CSSProperties;
};

let lottiePromise: Promise<typeof import("lottie-web")> | null = null;

function cargarLottie() {
  if (!lottiePromise) {
    lottiePromise = import("lottie-web/build/player/lottie_light");
  }

  return lottiePromise;
}

function LottieAnimation({
  animationData,
  className,
  style,
}: LottieAnimationProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let animation: AnimationItem | null = null;

    async function iniciarAnimacion() {
      const { default: lottie } = await cargarLottie();
      if (cancelled || !containerRef.current) return;

      animation = lottie.loadAnimation({
        container: containerRef.current,
        renderer: "svg",
        loop: true,
        autoplay: true,
        animationData,
        rendererSettings: {
          progressiveLoad: true,
        },
      });
    }

    void iniciarAnimacion();

    return () => {
      cancelled = true;
      animation?.destroy();
    };
  }, [animationData]);

  return <div ref={containerRef} className={className} style={style} />;
}

export default LottieAnimation;
