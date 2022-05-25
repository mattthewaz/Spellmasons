import * as Unit from '../Unit';
import { allUnits, UnitSource } from './index';
import { UnitSubType, UnitType } from '../commonTypes';
import * as math from '../math';
import floatingText from '../FloatingText';

const SUMMON_MANA_COST = 30;
const unit: UnitSource = {
  id: 'summoner',
  info: {
    description: 'A summoner uses mana to summon grunts.',
    image: 'units/golem-summoner.png',
    subtype: UnitSubType.RANGED_RADIUS,
    probability: 30,
  },
  unitProps: {
  },
  extraTooltipInfo: () => {
    return `Mana cost per summon: ${SUMMON_MANA_COST}`;
  },
  action: async (unit: Unit.IUnit) => {
    // Summon unit
    if (unit.mana >= SUMMON_MANA_COST) {
      unit.mana -= SUMMON_MANA_COST;
      const sourceUnit = allUnits.grunt;
      if (sourceUnit) {
        const coords = window.underworld.findValidSpawn(unit, 5)
        if (coords) {
          const summonedUnit = Unit.create(
            sourceUnit.id,
            // Start the unit at the summoners location
            coords.x,
            coords.y,
            // A unit always summons units in their own faction
            unit.faction,
            sourceUnit.info.image,
            UnitType.AI,
            sourceUnit.info.subtype,
            unit.strength,
            sourceUnit.unitProps
          );
          await Unit.moveTowards(summonedUnit, unit);
        } else {
          console.log("Summoner could not find valid spawn");
        }
        // Unit.setLocation(summonedUnit, coords);
      } else {
        console.error('summoner could not find unit source to summon from');
      }
    }
    // Move opposite to closest enemy
    const closestEnemy = Unit.findClosestUnitInDifferentFaction(unit);
    if (closestEnemy) {
      const moveTo = math.getCoordsAtDistanceTowardsTarget(unit, closestEnemy, -unit.stamina);
      await Unit.moveTowards(unit, moveTo);
    }
  },
};
export default unit;
