import * as Unit from '../Unit';
import type { Spell } from '.';

const id = 'damage';
const spell: Spell = {
  card: {
    id,
    thumbnail: 'damage.png',
    probability: 50,
    description: `
Deals damage to all targets.    
    `,
    effect: async (state, dryRun) => {
      if (dryRun) {
        return state;
      }
      let promises = [];
      for (let target of state.targets) {
        const unit = window.underworld.getUnitAt(target);
        if (unit) {
          const damage = 1;
          promises.push(Unit.takeDamage(unit, damage));
          state.aggregator.damageDealt =
            (state.aggregator.damageDealt || 0) + damage;
        }
      }
      await Promise.all(promises);
      return state;
    },
  },
};
export default spell;
