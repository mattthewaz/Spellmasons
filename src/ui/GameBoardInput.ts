import * as PIXI from 'pixi.js';
import * as Image from '../Image';
import { MESSAGE_TYPES } from '../MessageTypes';
import { BOARD_HEIGHT, BOARD_WIDTH, CELL_SIZE } from '../config';
import { turn_phase } from '../Game';
import * as Card from '../CardUI';
import * as Player from '../Player';
import floatingText from '../FloatingText';
import * as Unit from '../Unit';
import { app, containerSpells, containerUI } from '../PixiUtils';
import { Coords, Faction, UnitSubType, UnitType } from '../commonTypes';
import { allUnits } from '../units';

let mouseCell: Coords = { x: -1, y: -1 };
const elInspectorTooltip = document.getElementById('inspector-tooltip');
const elInspectorTooltipContainer = document.getElementById(
  'inspector-tooltip-container',
);
const elInspectorTooltipContent = document.getElementById(
  'inspector-tooltip-content',
);
// SpellEffectProjection are images that appear above cells to denote some information, such as the spell or action about to be cast/taken when clicked
export function clearSpellEffectProjection() {
  if (!window.animatingSpells) {
    dryRunGraphics.clear();
    containerSpells.removeChildren();
  }
}
function isOutOfBounds(cell: Coords) {
  return (
    cell.x < 0 || cell.x >= BOARD_WIDTH || cell.y < 0 || cell.y >= BOARD_HEIGHT
  );
}
function areAnyCardsSelected() {
  return !!Card.getSelectedCards().length;
}
const dryRunGraphics = new PIXI.Graphics();
containerUI.addChild(dryRunGraphics);

export function drawSwapLine(one: Coords, two: Coords) {
  if (one && two) {
    const x1 = one.x * CELL_SIZE + CELL_SIZE / 2;
    const y1 = one.y * CELL_SIZE + CELL_SIZE / 2;
    const x2 = two.x * CELL_SIZE + CELL_SIZE / 2;
    const y2 = two.y * CELL_SIZE + CELL_SIZE / 2;
    dryRunGraphics.beginFill(0xffff0b, 0.5);
    dryRunGraphics.lineStyle(3, 0x33ff00);
    dryRunGraphics.moveTo(x1, y1);
    dryRunGraphics.lineTo(x2, y2);
    dryRunGraphics.drawCircle(x2, y2, 10);
    dryRunGraphics.endFill();
  }
}

// Draws the image that shows on the cell under the mouse
export async function syncSpellEffectProjection() {
  if (window.animatingSpells) {
    // Do not change the hover icons when spells are animating
    return;
  }
  // Clear the spelleffectprojection in preparation for showing the current ones
  clearSpellEffectProjection();
  if (isOutOfBounds(mouseCell)) {
    // Mouse is out of bounds, do not show a hover icon
    return;
  }
  // only show hover target when it's the correct turn phase
  if (window.game.turn_phase == turn_phase.PlayerTurns) {
    // If mouse hovering over a new cell, update the target images

    if (!areAnyCardsSelected()) {
      // Do not render if there are no cards selected meaning there is no spell
      return;
    }
    const currentPlayer = window.game.players.find(
      (p) => p.clientId === window.clientId,
    );
    if (currentPlayer) {
      if (!Player.isTargetInRange(currentPlayer, mouseCell)) {
        // Draw deny icon to show the player they are out of range
        Image.create(mouseCell.x, mouseCell.y, 'deny.png', containerSpells);
      } else {
        // Dry run cast so the user can see what effect it's going to have
        await window.game.castCards(
          currentPlayer,
          Card.getSelectedCards(),
          mouseCell,
          true,
        );
      }
    }
  }
}
export function updateTooltip() {
  if (
    !(
      elInspectorTooltipContent &&
      elInspectorTooltip &&
      elInspectorTooltipContainer
    )
  ) {
    return;
  }
  // Update position of HTML element
  elInspectorTooltip.style.transform = `translate(${
    app.stage.x + mouseCell.x * CELL_SIZE
  }px, ${app.stage.y + mouseCell.y * CELL_SIZE}px)`;
  elInspectorTooltipContainer.classList.remove('top');
  elInspectorTooltipContainer.classList.remove('bottom');
  elInspectorTooltipContainer.classList.remove('left');
  elInspectorTooltipContainer.classList.remove('right');
  elInspectorTooltipContainer.classList.add(
    mouseCell.y > BOARD_HEIGHT / 2 ? 'bottom' : 'top',
  );
  elInspectorTooltipContainer.classList.add(
    mouseCell.x > BOARD_WIDTH / 2 ? 'right' : 'left',
  );

  // Update information in content
  // show info on cell, unit, pickup, etc clicked
  let text = '';
  // Find unit:
  const unit = window.game.getUnitAt(mouseCell);
  if (unit) {
    let cards = '';
    if (unit.unitType === UnitType.PLAYER_CONTROLLED) {
      const player = window.game.players.find((p) => p.unit === unit);
      if (player) {
        cards =
          'Cards: \n' +
          Object.entries(
            player.cards.reduce<{ [card: string]: number }>((acc, card) => {
              if (!acc[card]) {
                acc[card] = 0;
              }
              acc[card]++;
              return acc;
            }, {}),
          )
            .map(([card, amount]) => `${amount} ${card}`)
            .join('\n');
      } else {
        console.error(
          'Could not find player corresponding to player controlled unit',
        );
      }
    }
    text += `\
Unit
${allUnits[unit.unitSourceId].info.description}
Type ${UnitType[unit.unitType]}
SubType ${UnitSubType[unit.unitSubType]}
Faction ${Faction[unit.faction]}
Health ${unit.health}/${unit.healthMax}
Modifiers ${JSON.stringify(unit.modifiers, null, 2)}
${cards}
        `;
  }
  const pickup = window.game.getPickupAt(mouseCell);
  if (pickup) {
    text += `\
Pickup
${pickup.name}
${pickup.description}
        `;
  }
  const obstacle = window.game.getObstacleAt(mouseCell);
  if (obstacle) {
    text += `\
${obstacle.name}
${obstacle.description}
        `;
  }
  elInspectorTooltipContent.innerText = text;
}
export default function setupBoardInputHandlers() {
  // on Hover
  document.body.addEventListener('mousemove', (e) => {
    const cell = window.game.getCellFromCurrentMousePos();
    const didChange = mouseCell.x !== cell.x || mouseCell.y !== cell.y;
    // If mouse hovering over a new cell, update the target images
    if (didChange) {
      // Update mouseCell
      mouseCell = cell;
      // Show target hover on cells
      syncSpellEffectProjection();
    }
  });
  // Handle right click on game board
  document.body.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const mouseTarget = window.game.getCellFromCurrentMousePos();
    if (isOutOfBounds(mouseTarget)) {
      // Disallow click out of bounds
      return;
    }
    if (window.game.turn_phase == turn_phase.PlayerTurns) {
      // Get current client's player
      const selfPlayer: Player.IPlayer | undefined = window.game.players.find(
        (p) => p.clientId === window.clientId,
      );
      // If player hasn't already moved this turn...
      if (selfPlayer && !selfPlayer.unit.thisTurnMoved) {
        const targetCell = Unit.findCellOneStepCloserTo(
          selfPlayer.unit,
          mouseTarget,
        );
        if (targetCell && !window.game.isCellObstructed(targetCell)) {
          window.pie.sendData({
            type: MESSAGE_TYPES.MOVE_PLAYER,
            // This formula clamps the diff to -1, 0 or 1
            ...targetCell,
          });
        } else {
          floatingText({
            cell: mouseTarget,
            text: 'You cannot move here',
            style: {
              fill: 'red',
            },
          });
        }
      } else {
        floatingText({
          cell: mouseTarget,
          text: 'You cannot move more than once per turn.',
        });
      }
    }
    return false;
  });
  // Handle clicks on the game board
  document.body.addEventListener('click', (e) => {
    const mouseTarget = window.game.getCellFromCurrentMousePos();
    if (isOutOfBounds(mouseTarget)) {
      // Disallow click out of bounds
      return;
    }
    if (window.planningViewActive) {
      window.pie.sendData({
        type: MESSAGE_TYPES.PING,
        x: mouseTarget.x,
        y: mouseTarget.y,
      });
      return;
    }
    // If a spell exists (based on the combination of cards selected)...
    if (areAnyCardsSelected()) {
      // Only allow casting in the proper phase
      if (window.game.turn_phase == turn_phase.PlayerTurns) {
        // Get current client's player
        const selfPlayer: Player.IPlayer | undefined = window.game.players.find(
          (p) => p.clientId === window.clientId,
        );
        // If the player casting is the current client player
        if (selfPlayer) {
          // If the spell is not in range
          if (!Player.isTargetInRange(selfPlayer, mouseTarget)) {
            // Show floating message to alert player
            floatingText({
              cell: mouseTarget,
              text: 'out of range',
            });
          } else {
            // cast the spell
            window.pie.sendData({
              type: MESSAGE_TYPES.SPELL,
              x: mouseTarget.x,
              y: mouseTarget.y,
              cards: Card.getSelectedCards(),
            });
            Card.clearSelectedCards();
          }
        }
      }
    }
  });
}
