import type { UnitSource } from './index';
import { Vec2, UnitSubType } from '../commonTypes';
import { createVisualFlyingProjectile } from '../Projectile';
import * as Unit from '../Unit';
import * as math from '../math';
import * as poison from '../cards/poison';

const range = 3;
const unit: UnitSource = {
  id: 'Poisoner',
  info: {
    description: 'Poisons enemies',
    image: 'units/golem-poison.png',
    subtype: UnitSubType.AI_poisoner,
    probability: 30,
  },
  unitProps: {},
  action: async (unit: Unit.IUnit) => {
    const nonPoisonedEnemyUnits = window.underworld.units.filter(
      (u) =>
        u.faction !== unit.faction &&
        u.alive &&
        u.modifiers.poison === undefined,
    );
    if (nonPoisonedEnemyUnits.length) {
      const chosenUnit = nonPoisonedEnemyUnits[0];
      const moveTo = math.getCoordsAtDistanceTowardsTarget(unit, chosenUnit, unit.moveDistance);
      await Unit.moveTowards(unit, moveTo);
      if (inRange(unit, chosenUnit)) {
        createVisualFlyingProjectile(
          unit,
          chosenUnit.x,
          chosenUnit.y,
          'green-thing.png',
        );
        poison.add(chosenUnit);
      }
    }
  },
  canInteractWithTarget: (unit, x, y) => {
    return inRange(unit, { x, y });
  },
};
function inRange(unit: Unit.IUnit, coords: Vec2): boolean {
  return math.distance(unit, coords) <= range;
}
export default unit;
