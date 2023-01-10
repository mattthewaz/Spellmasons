import { Spell } from './index';
import { CardCategory } from '../types/commonTypes';
import { CardRarity, probabilityMap } from '../types/commonTypes';

const id = 'Plus Radius';
const radiusIncreaseAmount = 50;
const spell: Spell = {
  card: {
    id,
    category: CardCategory.Targeting,
    supportQuantity: true,
    manaCost: 20,
    healthCost: 0,
    expenseScaling: 1,
    probability: probabilityMap[CardRarity.UNCOMMON],
    thumbnail: 'spellIconPlusRadius.png',
    requiresFollowingCard: true,
    description: `
Increases the radius of the impact of other spells.
Works well with Bloat, Contageous, and Targeting Spells.
Note: ${id} only affects spells that are forged AFTER it.
For example: ${id} then Connect will increase the Connect Radius.
    `,
    allowNonUnitTarget: true,
    effect: async (state, card, quantity, underworld, prediction, outOfRange) => {
      const adjustedRadius = radiusIncreaseAmount * quantity;
      state.aggregator.radius += adjustedRadius;
      return state;
    },
  },
};
export default spell;
