import type { Vec2 } from '../../../jmath/Vec';
import { distance } from '../../../jmath/math';
import * as Unit from '../../Unit';
import Underworld from '../../../Underworld';

export async function action(unit: Unit.IUnit, attackTarget: Unit.IUnit | undefined, underworld: Underworld, _canAttackTarget: boolean) {
  if (!Unit.canMove(unit)) {
    return;
  }
  if (!attackTarget) {
    // Do not move if they don't have a target
    return;
  }
  // Movement
  await Unit.moveTowards(unit, attackTarget, underworld);

  // Attack closest enemy
  // Note: Special case: don't use canAttackEnemy for melee units
  // because pathing doesn't take immovable units into account yet
  // so it might think it can attack but will be blocked.
  // Instead, just check that the distance is within the attack range
  // and let canAttackEnemy be used for just the attention markers
  if (withinMeleeRange(unit, attackTarget)) {
    await Unit.playComboAnimation(unit, unit.animations.attack, async () =>
      Unit.takeDamage(attackTarget, unit.damage, unit, underworld, false, undefined)
    );
  }
}
export function withinMeleeRange(unit: Unit.IUnit, target: Vec2): boolean {
  return distance(unit, target) <= unit.attackRange;
}