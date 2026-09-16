import { useEffect, useRef, useState } from "react";
import type { MouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Check, Hand } from "lucide-react";

export type ProcessRecipeItem = { id: number; name: string; detail: string; image: string };
type Props = { recipes: ProcessRecipeItem[]; selectedId: number | null; dirtyIds: number[]; onSelect: (id: number) => void };
type DragState = { active: boolean; pointerId: number; startX: number; startScroll: number; moved: boolean };

const carouselEase = (progress: number) => 1 - Math.pow(1 - progress, 4);

export default function RecipeCarousel({ recipes, selectedId, dirtyIds, onSelect }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const animationFrame = useRef<number | null>(null);
  const drag = useRef<DragState>({ active: false, pointerId: 0, startX: 0, startScroll: 0, moved: false });
  const suppressClick = useRef(false);
  const [edges, setEdges] = useState({ start: true, end: false });
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);

  function updatePosition() {
    const element = track.current;
    if (!element) return;
    const maxScroll = Math.max(0, element.scrollWidth - element.clientWidth);
    const start = element.scrollLeft <= 2;
    const end = element.scrollLeft >= maxScroll - 2;
    setEdges(previous => previous.start === start && previous.end === end ? previous : { start, end });
    setProgress(maxScroll ? Math.min(1, Math.max(0, element.scrollLeft / maxScroll)) : 1);
  }

  function animateScroll(target: number) {
    const element = track.current;
    if (!element) return;
    if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
    const maxScroll = Math.max(0, element.scrollWidth - element.clientWidth);
    const destination = Math.min(maxScroll, Math.max(0, target));
    const origin = element.scrollLeft;
    const distance = destination - origin;
    let startedAt: number | null = null;
    const tick = (now: number) => {
      startedAt ??= now;
      const elapsed = Math.min(1, (now - startedAt) / 540);
      element.scrollLeft = origin + distance * carouselEase(elapsed);
      if (elapsed < 1) animationFrame.current = requestAnimationFrame(tick);
      else animationFrame.current = null;
    };
    animationFrame.current = requestAnimationFrame(tick);
  }

  useEffect(() => {
    const observer = new ResizeObserver(updatePosition);
    if (track.current) observer.observe(track.current);
    return () => {
      observer.disconnect();
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
    };
  }, [recipes.length]);

  function reveal(button: HTMLButtonElement) {
    const element = track.current;
    if (!element) return;
    const viewport = element.getBoundingClientRect();
    const card = button.getBoundingClientRect();
    const distance = card.left < viewport.left + 8 ? card.left - viewport.left - 8 : card.right > viewport.right - 8 ? card.right - viewport.right + 8 : 0;
    if (distance) animateScroll(element.scrollLeft + distance);
  }

  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    const element = track.current;
    if (!element) return;
    if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
    drag.current = { active: true, pointerId: event.pointerId, startX: event.clientX, startScroll: element.scrollLeft, moved: false };
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const element = track.current;
    if (!element || !drag.current.active || drag.current.pointerId !== event.pointerId) return;
    const delta = event.clientX - drag.current.startX;
    if (Math.abs(delta) > 5 && !drag.current.moved) {
      drag.current.moved = true;
      element.setPointerCapture(event.pointerId);
      setDragging(true);
    }
    if (!drag.current.moved) return;
    element.scrollLeft = drag.current.startScroll - delta;
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const element = track.current;
    if (!element || !drag.current.active || drag.current.pointerId !== event.pointerId) return;
    suppressClick.current = drag.current.moved;
    drag.current.active = false;
    setDragging(false);
    if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
    window.setTimeout(() => { suppressClick.current = false; }, 0);
  }

  function preventDraggedClick(event: MouseEvent<HTMLDivElement>) {
    if (!suppressClick.current) return;
    event.preventDefault();
    event.stopPropagation();
  }

  return <section className="sp-recipe-carousel" aria-label="Variedades de empanadas" aria-roledescription="carrusel">
    <div className="sp-recipe-heading"><span>01 <i /> ELEGÍ UNA RECETA <b>{recipes.length} variedades</b></span><small className="sp-carousel-drag-hint"><Hand size={13} />Mantené y arrastrá</small></div>
    <div className="sp-carousel-viewport">
      <motion.span className="sp-carousel-fade start" aria-hidden animate={{ opacity: edges.start ? 0 : 1 }} />
      <div ref={track} id="sp-recipe-track" className={`sp-recipes ${dragging ? "is-dragging" : ""}`} role="group" aria-label="Seleccionar receta" onScroll={updatePosition} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onClickCapture={preventDraggedClick}>
        {recipes.map((item, index) => {
          const selected = selectedId === item.id;
          return <motion.button key={item.id} className={`sp-recipe ${selected ? "selected" : ""}`} onClick={event => { onSelect(item.id); reveal(event.currentTarget); }} onFocus={event => reveal(event.currentTarget)} aria-pressed={selected} initial={{ opacity: 0, y: 18, scale: .97 }} animate={{ opacity: 1, y: selected ? -2 : 0, scale: selected ? 1.012 : 1 }} transition={{ delay: Math.min(index * .045, .22), duration: .42, ease: [.22, 1, .36, 1], layout: { type: "spring", stiffness: 290, damping: 27 } }} whileHover={{ y: -5, scale: 1.01 }} whileTap={{ scale: .975 }}>
            {selected && <motion.span className="sp-recipe-selected" layoutId="standard-recipe-selection" transition={{ type: "spring", stiffness: 260, damping: 25, mass: .8 }} />}
            <motion.img src={item.image} alt="" draggable={false} animate={{ scale: selected ? 1.08 : 1, rotate: selected ? -1.5 : 0 }} transition={{ type: "spring", stiffness: 260, damping: 24 }} /><motion.span className="sp-recipe-copy" animate={{ x: selected ? 2 : 0 }}><strong>{item.name}</strong><small>{item.detail}</small></motion.span><motion.span className="sp-recipe-check" animate={{ rotate: selected ? 0 : -35, scale: selected ? 1.08 : 1 }} transition={{ type: "spring", stiffness: 300, damping: 22 }}>{selected ? <Check size={14} /> : <ArrowUpRight size={14} />}</motion.span>{dirtyIds.includes(item.id) && <motion.span className="sp-draft-dot" title="Cambios sin guardar" initial={{ scale: 0 }} animate={{ scale: [0, 1.45, 1] }} />}
          </motion.button>;
        })}
      </div>
      <motion.span className="sp-carousel-fade end" aria-hidden animate={{ opacity: edges.end ? 0 : 1 }} />
    </div>
    <div className="sp-carousel-progress" aria-hidden><motion.i animate={{ scaleX: .12 + progress * .88 }} transition={{ type: "spring", stiffness: 170, damping: 25 }} /></div>
  </section>;
}
