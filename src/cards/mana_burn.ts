import * as Unit from '../Unit';
import type { Spell } from '.';
import { CardType, cardTypeToProbability } from './cardUtils';

const id = 'mana_burn';
const mana_burnt = 30;
const health_burn_ratio = .1;
const type = CardType.Special;
const spell: Spell = {
  card: {
    id,
    type,
    probability: cardTypeToProbability(type),
    thumbnail: 'mana_burn.png',
    description: `
Burn up to ${mana_burnt} of the targets' mana, causing the target take ${health_burn_ratio} damage per mana burnt.
    `,
    effect: async (state, dryRun) => {
      if (dryRun) {
        return state;
      }
      let promises = [];
      for (let target of state.targets) {
        const unit = window.underworld.getUnitAt(target);
        if (unit) {
          const unitManaBurnt = Math.min(unit.mana, mana_burnt);
          unit.mana -= unitManaBurnt;
          const damage = unitManaBurnt * health_burn_ratio
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
