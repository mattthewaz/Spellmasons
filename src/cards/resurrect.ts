import * as Unit from '../entity/Unit';
import { ColorOverlayFilter } from '@pixi/filter-color-overlay';
import { Spell } from './index';
import { CardCategory } from '../types/commonTypes';

const id = 'resurrect';
// Brings stats back to this amount on res
const resStatAmount = 1.0;
const spell: Spell = {
  card: {
    id,
    category: CardCategory.Primary,
    manaCost: 80,
    healthCost: 0,
    expenseScaling: 2,
    probability: 5,
    thumbnail: 'spellIconResurrect.png',
    description: `
Resurrects a dead unit and converts them to the caster's faction.
    `,
    effect: async (state, card, quantity, underworld, prediction) => {
      // If there is a living unit atop a dead unit at the cast location, specifically target the dead unit
      // so the spell doesn't fizzle.
      const firstDeadUnitAtCastLocation = underworld.getUnitsAt(state.castLocation, prediction).filter(u => !u.alive)[0]
      const animationPromises = [];
      const targets = [firstDeadUnitAtCastLocation, ...state.targetedUnits]
      for (let unit of targets) {
        if (unit && !unit.alive) {
          let colorOverlayFilter: ColorOverlayFilter;
          if (unit.image && unit.image.sprite.filters) {
            // Overlay with white
            colorOverlayFilter = new ColorOverlayFilter(0xffffff, 1.0);
            // @ts-ignore Something is wrong with PIXI's filter types
            unit.image.sprite.filters.push(colorOverlayFilter)
          }
          Unit.resurrect(unit);
          unit.health = unit.healthMax * resStatAmount;
          unit.mana = unit.manaMax * resStatAmount;
          Unit.changeFaction(unit, state.casterUnit.faction);
          // Resurrect animation is the die animation played backwards
          animationPromises.push(Unit.playAnimation(unit, unit.animations.die, { loop: false, animationSpeed: -0.2 }));
          if (unit.image) {
            unit.image.sprite.gotoAndPlay(unit.image.sprite.totalFrames - 1);
          }
        }
      }
      await Promise.all(animationPromises);
      for (let unit of targets) {
        if (!unit) {
          continue;
        }
        // Remove color overlay now that the unit is done being resurrected
        if (unit.image && unit.image.sprite.filters) {
          // @ts-ignore This filter does have a __proto__ property
          unit.image.sprite.filters = unit.image.sprite.filters.filter(f => f.__proto__ !== ColorOverlayFilter.prototype)
        }

      }
      return state;
    },
  },
};
export default spell;