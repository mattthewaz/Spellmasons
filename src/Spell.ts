import type Game from './Game';
import type Player from './Player';
import * as Unit from './Unit';
import floatingText from './FloatingText';
import type Image from './Image';

export interface Spell {
  caster?: Player;
  x?: number;
  y?: number;
  // damage can be negative for healing
  damage?: number;
  freeze?: boolean;
  chain?: boolean;
  aoe_radius?: number;
  // TODO
  rotate?: boolean;
  // TODO, in form of object
  summon?: any;
  // in turns
  delay?: number;
  // If the spell has been cast
  isCast?: boolean;
  image?: Image;
}
export function getImage(s: Spell) {
  let imgPath = 'crosshair.png';
  if (s.damage) {
    imgPath = 'crosshair.png';
  }
  if (s.delay) {
    // TODO image for delay
  }
  if (s.freeze) {
    imgPath = 'ice-cube.png';
  }
  if (s.chain) {
    imgPath = 'lightning.png';
  }
  if (s.aoe_radius > 0) {
    imgPath = 'bomb.png';
  }
  if (s.summon) {
    imgPath = 'egg.png';
  }
  return imgPath;
}
function toString(s: Spell) {
  const strings = [];
  if (s.damage > 0) {
    strings.push('Hurt');
  }
  if (s.damage < 0) {
    strings.push('Heal');
  }
  if (s.delay) {
    strings.push('Delay');
  }
  if (s.freeze) {
    strings.push('Freeze');
  }
  if (s.chain) {
    strings.push('Chain');
  }
  if (s.aoe_radius > 0) {
    strings.push('AOE');
  }
  if (s.summon) {
    strings.push('Summon');
  }
  return strings.join('|');
}
export function getManaCost(s: Spell) {
  let cost = 0;
  if (s.damage) {
    if (s.damage < 0) {
      // Healing is always 1 mana more expensive
      cost += Math.abs(s.damage) + 1;
    } else {
      cost += s.damage;
    }
  }
  if (s.delay) {
    cost -= s.delay;
  }
  if (s.freeze) {
    cost += 2;
  }
  if (s.chain) {
    cost += 4;
  }
  if (s.aoe_radius > 0) {
    cost += 4 * s.aoe_radius;
  }
  if (s.summon) {
    cost += 4;
  }
  return cost;
}
export interface EffectArgs {
  unit?: Unit.IUnit;
  // Used to prevent infinite loops when recuring via chain for example
  ignore?: Unit.IUnit[];
  game?: Game;
}
export function effect(spell: Spell, args: EffectArgs) {
  const { unit, game, ignore = [] } = args;
  if (spell.delay && spell.delay > 0) {
    spell.delay--;
    return;
  }
  if (unit && ignore.includes(unit)) {
    return;
  }
  if (unit && spell.damage) {
    floatingText({
      cellX: unit.x,
      cellY: unit.y,
      text: toString(spell),
      color: 'red',
    });
    Unit.takeDamage(unit, spell.damage, 'spell');
  }
  if (unit && spell.freeze) {
    unit.frozen = true;
  }
  if (game) {
    if (spell.aoe_radius) {
      const withinRadius = game.getUnitsWithinDistanceOfPoint(
        spell.x,
        spell.y,
        1,
      );
      for (let unit_in_radius of withinRadius) {
        // If not self (because self has already been cast on)
        if (unit_in_radius !== unit) {
          // Cast on units in radius but turn off aoe_radius
          // so it doesn't recur
          effect(
            { ...spell, aoe_radius: 0 },
            {
              ...args,
              unit: unit_in_radius,
            },
          );
        }
      }
    }
    if (unit && spell.chain) {
      const chained_units = game.getTouchingUnitsRecursive(unit.x, unit.y, 1);
      for (let chained_unit of chained_units) {
        if (chained_unit === unit) {
          // Skip current unit who has already taken damage
          continue;
        }
        // Cast on each chained unit without chaining again
        effect(
          { ...spell, chain: false },
          {
            ...args,
            unit: chained_unit,
          },
        );
      }
    }
    spell.isCast = true;
  }
  if (game) {
    if (spell.summon) {
      const { x, y } = spell;
      const { vx, vy, imagePath } = spell.summon;
      floatingText({
        cellX: x,
        cellY: y,
        text: 'Summon Golem',
        color: 'blue',
      });
      const unit = Unit.create(x, y, vx, vy, imagePath);
      game.summon(unit);
    }
  }
}
