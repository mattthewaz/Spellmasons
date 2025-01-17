import * as Unit from '../entity/Unit';
import * as colors from '../graphics/ui/colors';
import { CardCategory } from '../types/commonTypes';
import { addTarget, refundLastSpell, Spell } from './index';
import { CardRarity, probabilityMap } from '../types/commonTypes';
import { createVisualFlyingProjectile } from '../entity/Projectile';
import * as config from '../config';
import { clone, Vec2 } from '../jmath/Vec';
import { findArrowCollisions } from './arrow';

export const targetArrowCardId = 'Target Arrow';
const spell: Spell = {
  card: {
    id: targetArrowCardId,
    category: CardCategory.Targeting,
    supportQuantity: false,
    manaCost: 10,
    healthCost: 0,
    expenseScaling: 1,
    probability: probabilityMap[CardRarity.UNCOMMON],
    thumbnail: 'spellIconArrowGreen.png',
    // so that you can fire the arrow at targets out of range
    allowNonUnitTarget: true,
    // This ensures that "target scamming" doesn't work with target arrow
    // due to it being able to fire out of range
    noInitialTarget: true,
    requiresFollowingCard: true,
    animationPath: '',
    sfx: '',
    description: 'spell_target_arrow',
    effect: async (state, card, quantity, underworld, prediction) => {
      let targets: Vec2[] = state.targetedUnits;
      targets = targets.length ? targets : [state.castLocation];
      const promises = [];
      const length = targets.length;
      const originalCastLocation = clone(state.castLocation);
      let addedNewTarget = false;
      for (let i = 0; i < length; i++) {
        const target = targets[i];
        if (!target) {
          continue;
        }
        const arrowUnitCollisions = findArrowCollisions(state.casterPositionAtTimeOfCast, state.casterUnit.id, target, prediction, underworld);
        // This target arrow spell doesn't pierce
        const firstTarget = arrowUnitCollisions[0];
        if (firstTarget) {
          // Reassign castLocation to prevent other spells from using the original click location and instead to use
          // where the arrow collided.  Without this, "Target Arrow" + "Target Circle" allows for infinite range, even
          // behind walls.
          state.castLocation = clone(firstTarget);
          if (prediction) {
            if (Unit.isUnit(firstTarget)) {
              addedNewTarget = true;
              addTarget(firstTarget, state);
            }
          } else {
            promises.push(createVisualFlyingProjectile(
              state.casterPositionAtTimeOfCast,
              firstTarget,
              'projectile/arrow_ghost',
            ).then(() => {
              if (Unit.isUnit(firstTarget)) {
                addedNewTarget = true;
                addTarget(firstTarget, state);
                // Animations do not occur on headless
                if (!globalThis.headless) {
                  return new Promise<void>((resolve) => {
                    if (globalThis.predictionGraphics) {
                      globalThis.predictionGraphics.lineStyle(2, colors.targetingSpellGreen, 1.0)
                      playSFXKey('targetAquired');
                      globalThis.predictionGraphics.drawCircle(firstTarget.x, firstTarget.y, config.COLLISION_MESH_RADIUS);
                      // Show the targeting circle for a moment
                      setTimeout(resolve, 300);
                    } else {
                      resolve();
                    }
                  })
                }
              }
              return;
            }));
          }
        }
      }
      await Promise.all(promises).then(() => {
        globalThis.predictionGraphics?.clear();
        if (!addedNewTarget) {
          refundLastSpell(state, prediction, 'No valid targets. Cost refunded.');
        }
      });
      return state;
    },
  }
};
export default spell;
