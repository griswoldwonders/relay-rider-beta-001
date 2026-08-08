import React, { useEffect, useState } from 'react';
import {
  motion,
  useMotionValue,
  useTransform,
  type MotionValue,
  type PanInfo,
  type Transition,
} from 'framer-motion';
import {
  BatteryCharging,
  Bookmark,
  Clock3,
  Footprints,
  Gift,
  MapPin,
  Route,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { RankedCommuterMatch } from '../screens/CommuterMatchesScreen';

const ITEM_WIDTH = 320;
const GAP = 16;
const CONTAINER_WIDTH = ITEM_WIDTH + GAP;
const DRAG_BUFFER = 50;
const VELOCITY_THRESHOLD = 500;

const SPRING_OPTIONS: Transition = {
  type: 'spring',
  stiffness: 330,
  damping: 30,
};

interface MatchCardProps {
  match: RankedCommuterMatch;
  index: number;
  x: MotionValue<number>;
  itemCount: number;
  saved: boolean;
  onSave: (id: string) => void;
  onReview: (id: string) => void;
}

const MatchCard: React.FC<MatchCardProps> = ({
  match,
  index,
  x,
  itemCount,
  saved,
  onSave,
  onReview,
}) => {
  const range = [
    -(index + 1) * CONTAINER_WIDTH,
    -index * CONTAINER_WIDTH,
    -(index - 1) * CONTAINER_WIDTH,
  ];
  const rotateY = useTransform(x, range, [62, 0, -62], { clamp: false });
  const opacity = useTransform(
    x,
    [-(index + 1.35) * CONTAINER_WIDTH, -index * CONTAINER_WIDTH, -(index - 1.35) * CONTAINER_WIDTH],
    [0.62, 1, 0.62],
    { clamp: true },
  );

  return (
    <motion.article
      style={{
        width: ITEM_WIDTH,
        minHeight: 500,
        rotateY,
        opacity,
        flexShrink: 0,
      }}
      transition={SPRING_OPTIONS}
      className={`commuter-match-card commuter-match-card--${match.vehicleType.toLowerCase()}`}
      aria-label={`${index + 1} of ${itemCount}: ${match.title}, ${match.fitScore}% compatibility`}
    >
      <div className="commuter-match-card__header">
        <div className="commuter-match-card__icon">
          <BatteryCharging size={25} strokeWidth={1.8} />
        </div>
        <div className="commuter-match-score">
          <strong>{match.fitScore}%</strong>
          <span>route fit</span>
        </div>
      </div>

      <div className="commuter-match-badges">
        <span><Sparkles size={12} /> Match preview</span>
        <span>{match.vehicleType}</span>
      </div>

      <div className="commuter-match-card__route">
        <p>{match.title}</p>
        <h2>{match.originArea} <span>→</span> {match.destinationArea}</h2>
      </div>

      <div className="commuter-match-card__time">
        <Clock3 size={16} />
        <span><strong>{match.departureWindow}</strong>{match.days.join(' · ')}</span>
      </div>

      <div className="commuter-match-metrics">
        <div>
          <Footprints size={17} />
          <strong>{match.walkingMinutes} min</strong>
          <span>walk</span>
        </div>
        <div>
          <Route size={17} />
          <strong>+{match.estimatedDetourMinutes} min</strong>
          <span>detour</span>
        </div>
        <div>
          <ShieldCheck size={17} />
          <strong>{match.routeOverlapScore}%</strong>
          <span>overlap</span>
        </div>
      </div>

      <div className="commuter-match-access-point">
        <MapPin size={17} />
        <div>
          <span>Access Point</span>
          <strong>{match.accessPoint}</strong>
        </div>
      </div>

      <div className="commuter-match-reason">
        <span>Why recommended</span>
        <p>{match.reasons[0]}</p>
      </div>

      {match.incentiveLabel && (
        <div className="commuter-match-incentive">
          <Gift size={16} />
          <span>{match.incentiveLabel}</span>
        </div>
      )}

      <div className="commuter-match-card__actions">
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          className={`commuter-match-save ${saved ? 'is-saved' : ''}`}
          onClick={() => onSave(match.id)}
          aria-label={saved ? 'Remove saved match' : 'Save match'}
        >
          <Bookmark size={18} fill={saved ? 'currentColor' : 'none'} />
        </motion.button>
        <motion.button
          type="button"
          whileHover={{ scale: 1.015 }}
          whileTap={{ scale: 0.98 }}
          className="commuter-match-review"
          onClick={() => onReview(match.id)}
        >
          Review match
        </motion.button>
      </div>
    </motion.article>
  );
};

interface CommuterMatchSwipeProps {
  items: RankedCommuterMatch[];
  savedIds: string[];
  onSave: (id: string) => void;
  onReview: (id: string) => void;
}

export const CommuterMatchSwipe: React.FC<CommuterMatchSwipeProps> = ({
  items,
  savedIds,
  onSave,
  onReview,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const x = useMotionValue(0);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (currentIndex > items.length - 1) setCurrentIndex(Math.max(0, items.length - 1));
  }, [currentIndex, items.length]);

  if (!mounted || items.length === 0) return null;

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    if (offset < -DRAG_BUFFER || velocity < -VELOCITY_THRESHOLD) {
      setCurrentIndex(prev => Math.min(prev + 1, items.length - 1));
    } else if (offset > DRAG_BUFFER || velocity > VELOCITY_THRESHOLD) {
      setCurrentIndex(prev => Math.max(prev - 1, 0));
    }
  };

  const leftConstraint = -(CONTAINER_WIDTH * (items.length - 1));

  return (
    <div className="commuter-match-carousel-shell">
      <div className="commuter-match-carousel-window">
        <motion.div
          className="commuter-match-carousel-track"
          drag="x"
          dragConstraints={{ left: leftConstraint, right: 0 }}
          dragElastic={0.12}
          style={{
            gap: GAP,
            perspective: 1100,
            perspectiveOrigin: currentIndex * ITEM_WIDTH + ITEM_WIDTH / 2,
            x,
          }}
          onDragEnd={handleDragEnd}
          animate={{ x: -(currentIndex * CONTAINER_WIDTH) }}
          transition={SPRING_OPTIONS}
        >
          {items.map((match, index) => (
            <MatchCard
              key={match.id}
              match={match}
              index={index}
              x={x}
              itemCount={items.length}
              saved={savedIds.includes(match.id)}
              onSave={onSave}
              onReview={onReview}
            />
          ))}
        </motion.div>
      </div>

      <div className="commuter-match-pagination" aria-label="Match carousel position">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={currentIndex === index ? 'is-active' : ''}
            aria-label={`Show match ${index + 1}`}
            aria-current={currentIndex === index ? 'true' : undefined}
            onClick={() => setCurrentIndex(index)}
          />
        ))}
      </div>

      <p className="commuter-match-swipe-hint">Swipe to browse · swiping does not accept or activate a route.</p>
    </div>
  );
};
