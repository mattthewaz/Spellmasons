import type Unit from './Unit';
import { Spell, effect } from './Spell';
import type Player from './Player';
import * as config from './config';

export enum game_state {
  Playing,
  GameOver,
}

export default class Game {
  state: game_state = game_state.Playing;
  height: number = config.BOARD_HEIGHT;
  width: number = config.BOARD_WIDTH;
  players: Player[] = [];
  units: Unit[] = [];
  spells: Spell[] = [];
  getUnitsAt(x?: number, y?: number): Unit[] {
    return this.units.filter((u) => u.x === x && u.y === y);
  }
  getPlayerAt(heart_x: number, heart_y: number): Player | undefined {
    for (let p of this.players) {
      // Only one has to match
      // Example heart postions are
      // p.heart_x = -1; p.heart_y = undefined;
      // p.heart_y = 9; p.heart_x = undefined;
      if (p.heart_x === heart_x || p.heart_y === heart_y) {
        return p;
      }
    }
  }
  cast(spell: Spell) {
    const { caster, target_x, target_y } = spell;
    const targets = this.getUnitsAt(target_x, target_y);
    if (caster.canCast(spell)) {
      for (let unit of targets) {
        effect(spell, { unit });
      }
    }
  }
  nextTurn() {
    // Cast spells
    for (let sm of this.spells) {
      this.cast(sm);
    }
    // Remove all spells, now that they are cast
    // TODO traps shouldn't be removed unless they are cast
    this.spells = [];

    // Remove dead units
    this.units = this.units.filter((u) => u.alive);

    // Move units
    for (let u of this.units) {
      u.move();
    }

    // Restore player mana
    for (let p of this.players) {
      p.mana = p.mana_max;
      // Lastly, Check for gameover
      if (p.heart_health <= 0) {
        this.state = game_state.GameOver;
      }
    }
  }
}
