import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import type { Banner } from "../../services/banner.service";
import BannerCard from "./BannerCard";
import "./BannerCarousel.css";

interface BannerCarouselProps {
  banners: Banner[];
  onBought?: (newBalance: number) => void;
}

export default function BannerCarousel({
  banners,
  onBought,
}: BannerCarouselProps) {
  const [index, setIndex] = useState(0);
  const cardRefs = useRef<(HTMLLIElement | null)[]>([]);

  const goTo = (next: number, direction: 1 | -1) => {
    const current = cardRefs.current[index];
    const nextEl = cardRefs.current[next];
    if (!current || !nextEl) return;

    gsap.fromTo(
      current,
      { xPercent: 0, opacity: 1, scale: 1 },
      {
        xPercent: -120 * direction,
        opacity: 0,
        scale: 0.8,
        duration: 0.35,
        ease: "power2.in",
      },
    );
    gsap.fromTo(
      nextEl,
      { xPercent: 120 * direction, opacity: 0, scale: 0.8 },
      {
        xPercent: 0,
        opacity: 1,
        scale: 1,
        duration: 0.35,
        ease: "power2.out",
        delay: 0.1,
      },
    );

    setIndex(next);
  };

  const prev = () => goTo((index - 1 + banners.length) % banners.length, -1);
  const next = () => goTo((index + 1) % banners.length, 1);

  // Init : cache tout sauf le premier
  useEffect(() => {
    cardRefs.current.forEach((el, i) => {
      if (!el) return;
      gsap.set(el, {
        xPercent: i === 0 ? 0 : 120,
        opacity: i === 0 ? 1 : 0,
        scale: i === 0 ? 1 : 0.8,
      });
    });
  }, [banners.length]);

  return (
    <div className="banner-carousel">
      <ul className="banner-carousel__list">
        {banners.map((b, i) => (
          <li
            key={b.id}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
          >
            <BannerCard banner={b} onBought={onBought} />
          </li>
        ))}
      </ul>

      {banners.length > 1 && (
        <div className="banner-carousel__actions">
          <button className="banner-carousel__btn" onClick={prev}>
            {"<"}
          </button>
          <div className="banner-carousel__dots">
            {banners.map((_, i) => (
              <span
                key={i}
                className={`banner-carousel__dot${i === index ? " banner-carousel__dot--active" : ""}`}
              />
            ))}
          </div>
          <button className="banner-carousel__btn" onClick={next}>
            {">"}
          </button>
        </div>
      )}
    </div>
  );
}
