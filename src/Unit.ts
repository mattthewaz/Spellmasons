import * as config from './config';
import type Game from './Game';
import Image from './Image';
import type Player from './Player';

export default class Unit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  name?: string;
  game?: Game;
  power: number = config.UNIT_BASE_POWER;
  health: number = config.UNIT_BASE_HEALTH;
  alive = true;
  frozen: boolean = false;
  destruct: boolean = false;
  image: Image;

  constructor(
    x: number,
    y: number,
    vx: number,
    vy: number,
    imagePath?: string,
  ) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.image = new Image(this.x, this.y, this.vx, this.vy, imagePath);
  }
  takeDamage(amount: number) {
    this.health -= amount;
    window.addToLog(`Unit at (${this.x}, ${this.y}) takes ${amount} damage.`);
    this.image.anim_spin();
    if (this.health <= 0) {
      window.addToLog(`Unit at (${this.x}, ${this.y}) dies.`);
      this.alive = false;
    }
  }
  move() {
    // Do not move if dead
    if (!this.alive) {
      return;
    }
    // Do not move if frozen
    if (this.frozen) {
      window.addToLog(
        `Unit at (${this.x}, ${this.y}) is frozen and cannot move`,
      );
      return;
    }
    const next_x = this.x + this.vx;
    const next_y = this.y + this.vy;
    const bump_into_units = this.game
      ? this.game.getUnitsAt(next_x, next_y)
      : [];
    // Deal damage to what you run into
    for (let other_unit of bump_into_units) {
      // Do not attack self
      if (other_unit === this) {
        continue;
      }
      other_unit.takeDamage(this.power);
      // Note, destruct must occur before unit takes damage, so health isn't changed
      if (this.destruct) {
        other_unit.takeDamage(this.health);
        this.alive = false;
      }
      // Only take damage if the other unit is not frozen
      if (!other_unit.frozen) {
        this.takeDamage(other_unit.power);
      }
    }
    const alive_bump_into_units = bump_into_units.filter((u) => u.alive);
    // If nothing is obstructing
    if (alive_bump_into_units.length === 0) {
      // Check if at edge of board
      const player: Player | undefined = this.game
        ? this.game.getPlayerAt(next_x, next_y)
        : undefined;
      if (player) {
        // if player found, attack their heart
        player.heart_health -= this.power;
        if (this.destruct) {
          player.heart_health -= this.health;
          this.alive = false;
        }
        window.addToLog(
          `Player ${player.client_id} heart health at ${player.heart_health}!`,
        );
      } else {
        // Otherwise, physically move
        this.x = next_x;
        this.y = next_y;
        this.image.move(this.x, this.y);
      }
    }
  }
}
