import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import Button from "../../components/Button";
import {
  IconArrowRight,
  IconBooster,
  IconGift,
  IconSparkles,
} from "../../components/Icons";
import CardDisplay from "../cards/CardDisplay";
import type {
  BundleBooster,
  OpenedCard,
} from "../../services/opening.service";
import { RARITY_GLOW, toCard } from "./openingPlan";

interface BundleContentsProps {
  cards: OpenedCard[];
  boosters: BundleBooster[];
  onContinue: () => void;
}

export function BundleContents({ cards, boosters, onContinue }: BundleContentsProps) {
  const { t } = useTranslation();
  return (
    <motion.div
      key="bundle-reveal"
      className="opening-bundle"
      data-testid="bundle-contents"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="opening-bundle__title">
        <IconGift size={20} /> {t("opening.bundleContents")}
      </div>

      <div className="opening-bundle__row">
        {cards.map((c, i) => (
          <motion.div
            key={c.id + "-" + i}
            className="opening-bundle__item"
            initial={{ opacity: 0, y: 30, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: i * 0.18, type: "spring", damping: 16 }}
          >
            <div
              className="opening-reveal__glow"
              style={{
                boxShadow: `0 0 30px 10px ${RARITY_GLOW[c.rarity.toLowerCase()] ?? "#fff"}44`,
              }}
            />
            <CardDisplay card={toCard(c)} size="md" interactive flippable={false} />
            <span className="opening-bundle__item-name">{c.name}</span>
            <span
              className="opening-cards__rarity"
              style={{ color: RARITY_GLOW[c.rarity.toLowerCase()] }}
            >
              {t(`opening.rarity.${c.rarity.toLowerCase()}`)}
            </span>
            {c.isNew && (
              <span className="opening-cards__new-badge">
                <IconSparkles size={12} /> {t("opening.new")}
              </span>
            )}
          </motion.div>
        ))}

        {cards.length > 0 && boosters.length > 0 && (
          <motion.div
            className="opening-bundle__separator"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: cards.length * 0.18 + 0.1 }}
          >
            +
          </motion.div>
        )}

        {boosters.map((b, i) => (
          <motion.div
            key={"booster-" + i}
            className="opening-bundle__item"
            initial={{ opacity: 0, y: 30, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              delay: cards.length * 0.18 + 0.3 + i * 0.18,
              type: "spring",
              damping: 16,
            }}
          >
            <motion.div
              className="opening-bundle__booster-icon"
              animate={{ y: [0, -6, 0] }}
              transition={{
                repeat: Infinity,
                duration: 2,
                ease: "easeInOut",
                delay: i * 0.3,
              }}
            >
              <IconBooster size={56} />
            </motion.div>
            <span className="opening-bundle__item-name">{b.name}</span>
            {b.quantity > 1 && (
              <span className="opening-bundle__item-qty">x{b.quantity}</span>
            )}
          </motion.div>
        ))}
      </div>

      <Button variant="primary-inverse" size="lg" onClick={onContinue}>
        {t("opening.seeResults")} <IconArrowRight size={16} />
      </Button>
    </motion.div>
  );
}
