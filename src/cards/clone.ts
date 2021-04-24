import type { Spell } from '.';
import * as Unit from '../Unit';
import * as Pickup from '../Pickup';
import * as Obstacle from '../Obstacle';
import { UnitSubType, UnitType } from '../commonTypes';
import { removeSubSprite } from '../Image';

const id = 'clone';
const spell: Spell = {
  card: {
    id,
    thumbnail: 'clone.png',
    probability: 3,
    description: `
Clones whatever is in the source target into all the other targets.
Requires more than 1 target to work
    `,
    effect: async (state, dryRun) => {
      if (dryRun) {
        return state;
      }
      const sourceTarget = state.targets[0];
      const unit = window.underworld.getUnitAt(sourceTarget);
      const pickup = window.underworld.getPickupAt(sourceTarget);
      const obstacle = window.underworld.getObstacleAt(sourceTarget);
      for (let target of state.targets) {
        if (!window.underworld.isCellEmpty(target)) {
          // Don't clone into non-empty cells
          continue;
        }
        if (unit) {
          const clone = Unit.load(unit);
          // If the cloned unit is player controlled, make them be controlled by the AI
          if (clone.unitSubType == UnitSubType.PLAYER_CONTROLLED) {
            clone.unitType = UnitType.AI;
            clone.unitSubType = UnitSubType.AI_melee;
            removeSubSprite(clone.image, 'ownCharacterMarker');
          }
          Unit.setLocation(clone, target);
        }
        if (pickup) {
          const clone = Pickup.load(pickup);
          Pickup.setPosition(clone, target.x, target.y);
        }
        if (obstacle) {
          const targetObstacle = { ...obstacle, ...target };
          Obstacle.load(targetObstacle);
        }
      }
      return state;
    },
  },
};
export default spell;
