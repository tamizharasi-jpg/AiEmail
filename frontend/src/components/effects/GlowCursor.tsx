import { useEffect, useRef } from "react";

interface GlowCursorProps {
  /** Head colour of the trail. */
  color?: string;
  /** Tail colour of the trail. */
  secondaryColor?: string;
  /** How many points the trail keeps. */
  trailLength?: number;
  /** Stroke width at the head, in px. */
  trailWidth?: number;
  /** 0 = constant width, 1 = fully tapered tail. */
  trailTaper?: number;
  /** 0..1 easing applied to the point that chases the pointer. */
  followSpeed?: number;
  /** Blur radius multiplier for the glow. */
  glowIntensity?: number;
  /** Seconds of stillness before the trail fades out. */
  idleFade?: number;
}

function mix(a: [number, number, number], b: [number, number, number], t: number): string {
  const c = a.map((value, index) => Math.round(value + (b[index] - value) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

function parse(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
}

/**
 * Subtle canvas-2D pointer trail. Renders behind the UI on a pointer-events:none
 * canvas, animates only while the pointer moves (idle frames are skipped), and is
 * disabled entirely for prefers-reduced-motion or coarse (touch) pointers.
 */
export default function GlowCursor({
  color = "#62e6f5",
  secondaryColor = "#a88bff",
  trailLength = 26,
  trailWidth = 12,
  trailTaper = 0.85,
  followSpeed = 0.22,
  glowIntensity = 1,
  idleFade = 0.5,
}: GlowCursorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (reduced || coarse) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const head = parse(color);
    const tail = parse(secondaryColor);
    const points: Array<{ x: number; y: number }> = [];
    const target = { x: -100, y: -100 };
    const chase = { x: -100, y: -100 };
    let opacity = 0;
    let lastMove = 0;
    let frame = 0;
    let ratio = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * ratio;
      canvas.height = window.innerHeight * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();

    const onMove = (event: PointerEvent) => {
      target.x = event.clientX;
      target.y = event.clientY;
      lastMove = performance.now();
      opacity = 1;
    };

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      const idle = (now - lastMove) / 1000 > idleFade;
      if (idle) opacity = Math.max(0, opacity - 0.03);

      chase.x += (target.x - chase.x) * followSpeed;
      chase.y += (target.y - chase.y) * followSpeed;
      points.push({ x: chase.x, y: chase.y });
      while (points.length > trailLength) points.shift();

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (opacity <= 0.01) return;

      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (let i = 1; i < points.length; i += 1) {
        const t = i / points.length;
        ctx.strokeStyle = mix(tail, head, t);
        ctx.globalAlpha = opacity * t * 0.55;
        ctx.lineWidth = trailWidth * (1 - trailTaper * (1 - t));
        ctx.shadowBlur = 16 * glowIntensity * t;
        ctx.shadowColor = mix(tail, head, t);
        ctx.beginPath();
        ctx.moveTo(points[i - 1].x, points[i - 1].y);
        ctx.lineTo(points[i].x, points[i].y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("resize", resize);
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", resize);
    };
  }, [color, secondaryColor, trailLength, trailWidth, trailTaper, followSpeed, glowIntensity, idleFade]);

  return <canvas ref={canvasRef} className="glow-cursor" aria-hidden="true" data-testid="glow-cursor-canvas" />;
}
