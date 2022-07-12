import * as Unit from '../Unit';
import type { UnitSource } from './index';
import { UnitSubType } from '../../types/commonTypes';
import * as math from '../../jmath/math';
import { createVisualFlyingProjectile } from '../Projectile';
import Shield from '../../cards/shield';
import { isVampire } from '../../cards/vampire_bite';
import { addPixiSpriteAnimated, containerUnits } from '../../graphics/PixiUtils';

const CAST_MANA_COST = 30;
async function animatePriestProjectileAndHit(self: Unit.IUnit, target: Unit.IUnit) {
  await createVisualFlyingProjectile(
    self,
    target,
    'projectile/priestProjectileCenter',
  );
  // Add projectile hit animation
  const animationSprite = addPixiSpriteAnimated('projectile/priestProjectileHit', containerUnits, {
    loop: false,
    animationSpeed: 0.1,
    onComplete: () => {
      if (animationSprite.parent) {
        animationSprite.parent.removeChild(animationSprite)
      } else {
        console.error('Expected priest animationSprite to have parent so it could be removed but it did not.')
      }
    }
  });
  animationSprite.anchor.set(0.5, 0.3);
  animationSprite.x = target.x;
  animationSprite.y = target.y;

}
async function healOneOf(self: Unit.IUnit, units: Unit.IUnit[]): Promise<boolean> {
  for (let ally of units) {
    if (Unit.inRange(self, ally)) {
      const chosenUnit = units[0];
      if (chosenUnit) {
        await Unit.playAnimation(self, unit.animations.attack);
        await animatePriestProjectileAndHit(self, chosenUnit);
        // Heal for 2
        Unit.takeDamage(chosenUnit, -2, false, undefined);
        // Remove mana once the cast occurs
        self.mana -= CAST_MANA_COST;
        return true;
      }
      break;
    }
  }
  return false;

}
const unit: UnitSource = {
  id: 'priest',
  info: {
    description: 'The priest heals its allies, and if its allies are at full health it will shield them.  Priests will also attack vampires of a different faction by healing them (which makes them take damage).',
    image: 'units/priestIdle',
    subtype: UnitSubType.SUPPORT_CLASS,
  },
  unitProps: {
    attackRange: 264
  },
  spawnParams: {
    probability: 20,
    unavailableUntilLevelIndex: 5,
  },
  animations: {
    idle: 'units/priestIdle',
    hit: 'units/priestHit',
    attack: 'units/priestAttack',
    die: 'units/priestDeath',
    walk: 'units/priestWalk',
  },
  extraTooltipInfo: () => {
    return `Mana cost per cast: ${CAST_MANA_COST}`;
  },
  action: async (unit: Unit.IUnit) => {
    let didAction = false;
    const closestAlly = Unit.findClosestUnitInSameFaction(unit);
    // If they have enough mana
    if (unit.mana >= CAST_MANA_COST) {
      // Heal (in order to damage) enemy vampires
      const enemyVampires = window.underworld.units.filter(
        u => u.faction !== unit.faction && isVampire(u)
      );
      if (enemyVampires.length) {
        // Heal to damage enemy vampires
        didAction = await healOneOf(unit, enemyVampires);
      } else {
        // Heal an ally
        const damagedAllys = window.underworld.units.filter(
          // Only select allies, that are alive, that are damaged, and that aren't SUPPORT_CLASS cause it's
          // annoying when priests heal each other.
          // Also exclude vampires because vampires take health as DAMAGE! And we don't want priests hurting their ally vampires
          (u) => u.faction === unit.faction && u.alive && u.health < u.healthMax && u.unitSubType !== UnitSubType.SUPPORT_CLASS && !isVampire(u),
        );
        if (damagedAllys.length) {
          didAction = await healOneOf(unit, damagedAllys);
        } else {
          // if there are no damaged allies cast shield on the closest:
          if (closestAlly && closestAlly.unitSubType !== UnitSubType.SUPPORT_CLASS) {
            if (Unit.inRange(unit, closestAlly)) {
              await Unit.playAnimation(unit, unit.animations.attack);
              await animatePriestProjectileAndHit(unit, closestAlly);
              Unit.addModifier(closestAlly, Shield.card.id);
              // Remove mana once the cast occurs
              unit.mana -= CAST_MANA_COST;
              didAction = true;
            }
          }
        }
      }
    }
    if (!didAction) {
      // Move to closest ally
      if (closestAlly) {
        const moveTo = math.getCoordsAtDistanceTowardsTarget(unit, closestAlly, unit.stamina);
        await Unit.moveTowards(unit, moveTo);
      } else {
        // flee from closest enemey
        const closestEnemy = Unit.findClosestUnitInDifferentFaction(unit);
        if (closestEnemy) {
          const moveTo = math.getCoordsAtDistanceTowardsTarget(unit, closestEnemy, -unit.stamina);
          await Unit.moveTowards(unit, moveTo);
        }
      }
    }
  },
};

export default unit;
