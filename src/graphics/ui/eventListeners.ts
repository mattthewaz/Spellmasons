import { MESSAGE_TYPES } from '../../types/MessageTypes';
import throttle from 'lodash.throttle';
import * as CardUI from './CardUI';
import * as Unit from '../../entity/Unit';
import * as Pickup from '../../entity/Pickup';
import * as storage from '../../storage';
import floatingText from '../FloatingText';
import {
  clearSpellEffectProjection,
  clearTooltipSelection,
  clearTints,
  drawCircleUnderTarget,
  drawWalkRope,
  isOutOfBounds,
  runPredictions,
  updateTooltipSelection,
} from '../PlanningView';
import { toggleMenu, View } from '../../views';
import * as config from '../../config';
import { cameraAutoFollow, getCamera, moveCamera, toggleHUD } from '../PixiUtils';
import { getAdjustedCastTarget, isOutOfRange } from '../../PlayerUtils';
import { vec2ToOneDimentionIndexPreventWrap } from '../../jmath/ArrayUtil';
import * as Vec from '../../jmath/Vec';
import { Vec2 } from '../../jmath/Vec';
import Underworld, { showUpgradesClassName } from '../../Underworld';
import { toLineSegments } from '../../jmath/Polygon2';
import { closestLineSegmentIntersection } from '../../jmath/lineSegment';
import { allUnits } from '../../entity/units';
import { Faction } from '../../types/commonTypes';
import * as Freeze from '../../cards/freeze';
import { collideWithLineSegments } from '../../jmath/moveWithCollision';
import keyMapping from './keyMapping';

export const keyDown = {
  showWalkRope: false,
  w: false,
  a: false,
  s: false,
  d: false
}

globalThis.addEventListener('keydown', nonUnderworldKeydownListener);
function nonUnderworldKeydownListener(event: KeyboardEvent) {
  // Only handle hotkeys when NOT viewing the Game
  if (globalThis.view == View.Game) {
    return;
  }
  switch (event.code) {
    case 'Escape':
      toggleMenu();
      event.stopImmediatePropagation();
      break;
  }
}
export function keydownListener(underworld: Underworld, event: KeyboardEvent) {
  // Only handle hotkeys when viewing the Game
  if (globalThis.view !== View.Game) {
    return;
  }
  if (!underworld) {
    return
  }

  // Possibly handle hotkey for Jprompt:
  // note: :last-child targets the top most prompt if there are more than one
  const promptYesBtn = document.querySelector(`.prompt:last-child .yes[data-key="${event.code}"]`) as HTMLElement;
  if (promptYesBtn) {
    promptYesBtn.click();
    // Return immediately, prompt hotkey overrides other hotkeys
    return;
  }
  // note: :last-child targets the top most prompt if there are more than one
  const promptNoBtn = document.querySelector(`.prompt:last-child .no[data-key="${event.code}"]`) as HTMLElement;
  if (promptNoBtn) {
    // Event was handled
    promptNoBtn.click();
    // Return immediately, prompt hotkey overrides other hotkeys
    return;
  }

  switch (event.code) {
    case 'Escape':
      const thereWasTooltipActive = clearTooltipSelection();
      const thereWereCardsSelected = CardUI.areAnyCardsSelected();
      const thereWasInventoryOpen = document.body?.classList.contains(CardUI.openInvClass);
      // force close inventory
      CardUI.toggleInventory(undefined, false, underworld);
      CardUI.clearSelectedCards(underworld);
      if (!thereWasTooltipActive && !thereWereCardsSelected && !thereWasInventoryOpen) {
        // Otherwise finally toggle menu
        toggleMenu();
      }
      break;
    case 'Tab':
      CardUI.toggleInventory(undefined, undefined, underworld);
      event.preventDefault();
      break;
    case 'Backspace':
      CardUI.deselectLastCard();
      break;
    case keyMapping.showWalkRope:
      keyDown.showWalkRope = true;
      // When the walkRope turns on clear the spell effect projection
      // so the user can focus on the information that the walk rope is 
      // communicating
      clearSpellEffectProjection(underworld);
      break;
    // Camera movement
    case 'KeyW':
      keyDown.w = true;
      cameraAutoFollow(false);
      break;
    case 'KeyA':
      keyDown.a = true;
      cameraAutoFollow(false);
      break;
    case 'KeyS':
      keyDown.s = true;
      cameraAutoFollow(false);
      break;
    case 'KeyD':
      keyDown.d = true;
      cameraAutoFollow(false);
      break;
    case 'KeyC':
      const mouseTarget = underworld.getMousePos();
      underworld.pie.sendData({
        type: MESSAGE_TYPES.PING,
        x: mouseTarget.x,
        y: mouseTarget.y
      });
      break;
    case 'KeyZ':
      // Make camera follow player unit 
      cameraAutoFollow(true)
      break;
    case 'KeyI':
      CardUI.toggleInventory(undefined, undefined, underworld);
      break;
    case 'Space':
      underworld.endMyTurn();
      break;
    case 'Digit1':
      CardUI.selectCardByIndex(0);
      break;
    case 'Digit2':
      CardUI.selectCardByIndex(1);
      break;
    case 'Digit3':
      CardUI.selectCardByIndex(2);
      break;
    case 'Digit4':
      CardUI.selectCardByIndex(3);
      break;
    case 'Digit5':
      CardUI.selectCardByIndex(4);
      break;
    case 'Digit6':
      CardUI.selectCardByIndex(5);
      break;
    case 'Digit7':
      CardUI.selectCardByIndex(6);
      break;
    case 'Digit8':
      CardUI.selectCardByIndex(7);
      break;
    case 'Digit9':
      CardUI.selectCardByIndex(8);
      break;
    case 'Digit0':
      CardUI.selectCardByIndex(9);
      break;
  }
}

export function keyupListener(underworld: Underworld, event: KeyboardEvent) {
  // Only handle hotkeys when viewing the Game
  if (globalThis.view !== View.Game) {
    return;
  }
  switch (event.code) {
    case keyMapping.showWalkRope:
      keyDown.showWalkRope = false;
      break;
    // Camera movement
    case 'KeyW':
      keyDown.w = false;
      break;
    case 'KeyA':
      keyDown.a = false;
      break;
    case 'KeyS':
      keyDown.s = false;
      break;
    case 'KeyD':
      keyDown.d = false;
      break;
  }
}

export function endTurnBtnListener(underworld: Underworld, e: MouseEvent) {
  underworld.endMyTurn();
  e.preventDefault();
  e.stopPropagation();
  return false;
}
const sendMovePlayer = throttle((underworld: Underworld) => {
  if (globalThis.player) {
    underworld.pie.sendData({
      type: MESSAGE_TYPES.MOVE_PLAYER,
      ...Vec.clone(globalThis.player.unit),
    });
  } else {
    console.error('Cannot send MOVE_PLAYER, globalThis.player is undefined')
  }

}, 200, { trailing: true });

export function mouseMove(underworld: Underworld, e?: MouseEvent) {
  // Only handle clicks when viewing the Game
  if (globalThis.view !== View.Game) {
    return;
  }
  if (!underworld) {
    return
  }
  const mouseTarget = underworld.getMousePos();
  // Move the spawn "ghost" around so players can see where they will
  // spawn if they click
  if (globalThis.player && !globalThis.player.isSpawned &&
    !document.body?.classList.contains(showUpgradesClassName)) {
    const spawnPoint = { ...mouseTarget, radius: config.COLLISION_MESH_RADIUS }
    collideWithLineSegments(spawnPoint, underworld.walls, underworld);
    if (globalThis.player.unit.image) {
      globalThis.player.unit.image.sprite.alpha = 0.5;
      if (underworld.isCoordOnWallTile(spawnPoint) || isOutOfBounds(spawnPoint, underworld)) {
        globalThis.player.unit.x = NaN;
        globalThis.player.unit.y = NaN;
      } else {
        globalThis.player.unit.x = spawnPoint.x;
        globalThis.player.unit.y = spawnPoint.y;
      }
    }
  }

  if (globalThis.MMBDown && e) {
    const { movementX, movementY } = e;
    const { zoom } = getCamera();
    cameraAutoFollow(false);
    moveCamera(-movementX / zoom, -movementY / zoom);
  }

  if (globalThis.player) {
    if (keyDown.showWalkRope) {
      drawWalkRope(mouseTarget, underworld);
    } else {
      globalThis.walkPathGraphics?.clear();
    }
    if (globalThis.RMBDown) {
      if (underworld.isMyTurn()) {
        // If player is able to move
        if (Unit.canMove(globalThis.player.unit)) {
          // Move towards mouseTarget, but stop pathing where the direct path intersects a wall
          // This ensures that the player will always move in the direction of the mouse
          // and won't path in an unexpected direction to attempt to get to the final destination.
          const intersection = closestLineSegmentIntersection({ p1: globalThis.player.unit, p2: mouseTarget }, underworld.walls) || mouseTarget;
          Unit._moveTowards(globalThis.player.unit, intersection, underworld);
          // Send current player movements to server
          sendMovePlayer(underworld);

        } else {
          if (!globalThis.notifiedOutOfStamina) {
            floatingText({
              coords: mouseTarget,
              text: 'Out of stamina',
            });
            globalThis.notifiedOutOfStamina = true;
          }
        }
      } else {
        floatingText({
          coords: mouseTarget,
          text: 'You must wait for your turn\nto move',
        });
      }
    }
  }

  runPredictions(underworld);

  // TODO: optimize this function by not rerunning parts if mouse & player.unit position
  // havent changed since last call.

  // Show faint circle on clickable entities on hover:
  drawCircleUnderTarget(mouseTarget, underworld, 1.0, globalThis.planningViewGraphics);


  // Test pathing
  if (globalThis.showDebug && globalThis.player) {
    globalThis.debugGraphics?.clear();

    // Draw player path
    const path = globalThis.player.unit.path;
    if (path && path.points[0]) {
      globalThis.debugGraphics?.lineStyle(4, 0x00ff00, 1.0);
      globalThis.debugGraphics?.moveTo(globalThis.player.unit.x, globalThis.player.unit.y);
      for (let point of path.points) {
        globalThis.debugGraphics?.lineTo(point.x, point.y);
      }
    }
    const mouseTarget = underworld.getMousePos();
    const cellX = Math.round(mouseTarget.x / config.OBSTACLE_SIZE);
    const cellY = Math.round(mouseTarget.y / config.OBSTACLE_SIZE);
    const originalTile = underworld.lastLevelCreated?.imageOnlyTiles[vec2ToOneDimentionIndexPreventWrap({ x: cellX, y: cellY }, underworld.lastLevelCreated?.width)];
    const originalTileImage = originalTile ? originalTile.image : '';
    (document.getElementById('debug-info') as HTMLElement).innerText = `x:${Math.round(mouseTarget.x)}, y:${Math.round(mouseTarget.y)}
    cellX: ${cellX}, cellY: ${cellY}
    tile: ${originalTileImage}`;
    // Debug draw cell that mouse is hovered over
    // globalThis.debugGraphics?.lineStyle(3, 0xff0000, 1);
    // globalThis.debugGraphics?.moveTo(cellX * config.OBSTACLE_SIZE - config.OBSTACLE_SIZE / 2, cellY * config.OBSTACLE_SIZE - config.OBSTACLE_SIZE / 2);
    // globalThis.debugGraphics?.lineTo(cellX * config.OBSTACLE_SIZE + config.OBSTACLE_SIZE / 2, cellY * config.OBSTACLE_SIZE - config.OBSTACLE_SIZE / 2);
    // globalThis.debugGraphics?.lineTo(cellX * config.OBSTACLE_SIZE + config.OBSTACLE_SIZE / 2, cellY * config.OBSTACLE_SIZE + config.OBSTACLE_SIZE / 2);
    // globalThis.debugGraphics?.lineTo(cellX * config.OBSTACLE_SIZE - config.OBSTACLE_SIZE / 2, cellY * config.OBSTACLE_SIZE + config.OBSTACLE_SIZE / 2);
    // globalThis.debugGraphics?.lineTo(cellX * config.OBSTACLE_SIZE - config.OBSTACLE_SIZE / 2, cellY * config.OBSTACLE_SIZE - config.OBSTACLE_SIZE / 2);
    // Draw the pathing walls
    for (let lineSegment of underworld.pathingLineSegments) {
      globalThis.debugGraphics?.lineStyle(2, 0xffaabb, 1.0);
      globalThis.debugGraphics?.moveTo(lineSegment.p1.x, lineSegment.p1.y);
      globalThis.debugGraphics?.lineTo(lineSegment.p2.x, lineSegment.p2.y);
    }
    // Draw liquid polygons
    for (let lineSegment of underworld.liquidPolygons.map(toLineSegments).flat()) {
      globalThis.debugGraphics?.lineStyle(4, 0x34b7eb, 1.0);
      globalThis.debugGraphics?.moveTo(lineSegment.p1.x, lineSegment.p1.y);
      globalThis.debugGraphics?.lineTo(lineSegment.p2.x, lineSegment.p2.y);
    }
    // Draw bounds that prevent movement
    for (let bound of underworld.liquidBounds) {
      globalThis.debugGraphics?.lineStyle(2, 0x0000ff, 1.0);
      globalThis.debugGraphics?.moveTo(bound.p1.x, bound.p1.y);
      globalThis.debugGraphics?.lineTo(bound.p2.x, bound.p2.y);
    }
    // Draw walls that prevent line of sight 
    for (let wall of underworld.walls) {
      globalThis.debugGraphics?.lineStyle(2, 0x00ff00, 1.0);
      globalThis.debugGraphics?.moveTo(wall.p1.x, wall.p1.y);
      globalThis.debugGraphics?.lineTo(wall.p2.x, wall.p2.y);
    }
    // Draw underworld limits
    // globalThis.debugGraphics?.lineStyle(2, 0xff0000, 1.0);
    // globalThis.debugGraphics?.moveTo(underworld.limits.xMin, underworld.limits.yMin);
    // globalThis.debugGraphics?.lineTo(underworld.limits.xMax, underworld.limits.yMin);
    // globalThis.debugGraphics?.lineTo(underworld.limits.xMax, underworld.limits.yMax);
    // globalThis.debugGraphics?.lineTo(underworld.limits.xMin, underworld.limits.yMax);
    // globalThis.debugGraphics?.lineTo(underworld.limits.xMin, underworld.limits.yMin);

  }
}
export function contextmenuHandler(underworld: Underworld, e: MouseEvent) {
  // Prevent opening context menu on right click
  e.preventDefault();
  e.stopPropagation();
}
export function mouseDownHandler(underworld: Underworld, e: MouseEvent) {
  if (e.button == 1) {
    // setMMBDown so camera will be dragged around
    globalThis.setMMBDown?.(true);
    e.preventDefault();
  } else if (e.button == 2) {
    e.preventDefault();
    globalThis.setRMBDown?.(true, underworld);
  }
}
export function mouseUpHandler(underworld: Underworld, e: MouseEvent) {
  // Turn MMBDown off for any click to protect against it getting stuck
  // as flagged "down"
  globalThis.setMMBDown?.(false);
  if (globalThis.player) {
    globalThis.player.unit.path = undefined;
  }
  if (e.button == 2) {
    globalThis.walkPathGraphics?.clear();
    globalThis.setRMBDown?.(false, underworld);
    e.preventDefault();
  }
}
export function onWindowBlur(underworld: Underworld) {
  // Turn off keyboard and mouse flags when the document loses focus
  // To protect against the case where a user has middle mouse down
  // while they alt tab, which - without the following line -
  // would mean that it's stuck "up" when they return to the game
  // if they were to release it when this document wasn't focused
  globalThis.setMMBDown?.(false);
}
// Handle clicks on the game board
export function clickHandler(underworld: Underworld, e: MouseEvent) {
  // Only handle clicks when viewing the Game
  if (globalThis.view !== View.Game) {
    return;
  }
  if (!underworld) {
    return;
  }
  const mousePos = underworld.getMousePos();

  if (isOutOfBounds(mousePos, underworld)) {
    // Disallow click out of bounds
    floatingText({
      coords: mousePos,
      text: 'Out of bounds!'
    })
    return;
  }
  // Get current client's player
  const selfPlayer = globalThis.player;
  if (selfPlayer && !selfPlayer.isSpawned &&
    !document.body?.classList.contains(showUpgradesClassName)) {
    const spawnPoint = { ...mousePos, radius: config.COLLISION_MESH_RADIUS }
    collideWithLineSegments(spawnPoint, underworld.walls, underworld);
    if (underworld.isCoordOnWallTile(spawnPoint)) {
      floatingText({
        coords: mousePos,
        text: 'Invalid Spawn Location'
      })
    } else {
      // Spawn player:
      underworld.pie.sendData({
        type: MESSAGE_TYPES.SPAWN_PLAYER,
        x: spawnPoint.x,
        y: spawnPoint.y,
      });
      // Resync player config from storage
      const color = storage.get(config.STORAGE_ID_PLAYER_COLOR);
      const name = storage.get(config.STORAGE_ID_PLAYER_NAME);
      underworld.pie.sendData({
        type: MESSAGE_TYPES.PLAYER_CONFIG,
        color: color,
        name: name
      });
      return;
    }
  }

  // If a spell exists (based on the combination of cards selected)...
  if (CardUI.areAnyCardsSelected()) {
    // Only allow casting in the proper phase and on player's turn only
    if (underworld.isMyTurn()) {
      // If the player casting is the current client player
      if (selfPlayer) {
        // cast the spell
        const target = getAdjustedCastTarget(selfPlayer, mousePos);
        const cardIds = CardUI.getSelectedCardIds();
        const cards = CardUI.getSelectedCards();


        // Ensure that last card doesn't require a following card
        // If it does, warn the player that their card order won't do what
        // they are expecting it to do
        const lastCard = cards[cards.length - 1];
        if (lastCard && lastCard.requiresFollowingCard) {
          floatingText({
            coords: target,
            text: `${lastCard.id} only modifies\nspells on its right`,
            style: { fill: 'red', ...config.PIXI_TEXT_DROP_SHADOW }
          });
          const elHints = document.querySelectorAll('.requires-following-card');
          const elHint = elHints.length ? elHints[elHints.length - 1] : undefined;
          // Remove then add 'blink' class to the "hint" outline so that
          // it will restart the animation to grab the user's attention.
          if (elHint) {
            elHint.classList.remove('blink');
            setTimeout(() => {
              elHint.classList.add('blink');
            }, 10);

          }
          // Then cancel casting:
          return
        }
        if (isOutOfRange(selfPlayer, mousePos, true)) {
          // If there is no target at end range, just show that they are trying to cast out of range
          floatingText({
            coords: target,
            text: 'Out of Range!'
          })
          // Cancel Casting
          return;
        }
        // Abort casting if there is no unitAtCastLocation
        // unless the first card (like AOE) specifically allows casting
        // on non unit targets
        const unitAtCastLocation = underworld.getUnitAt(target);
        const pickupAtCastLocation = underworld.getPickupAt(target);
        if ((!unitAtCastLocation && !pickupAtCastLocation) && cards.length && cards[0] && !cards[0].allowNonUnitTarget) {
          floatingText({
            coords: target,
            text: 'No Target!'
          })
          // Cancel Casting
          return;
        }

        // Prevent casting on wall
        if (underworld.isCoordOnWallTile(mousePos)) {
          // Deny casting on a wall tile unless there is a target (which may overlap the wall)
          // 'allowNonUnitTarget' is specifically excluded from this check so that nonUnitTarget casts
          // such as summon_decoy may not be cast on a wall
          if (!unitAtCastLocation && !pickupAtCastLocation) {
            floatingText({
              coords: target,
              text: 'Invalid Target!'
            })
            // Cancel Casting
            return;
          }
        }

        if (selfPlayer.unit.modifiers[Freeze.id]) {
          floatingText({ coords: selfPlayer.unit, text: 'Cannot Cast. Frozen.' })
          // Cancel Casting
          return
        }
        clearSpellEffectProjection(underworld);
        // Clear resMarkers so they don't hang around once the spell is cast
        globalThis.resMarkers = [];

        underworld.pie.sendData({
          type: MESSAGE_TYPES.SPELL,
          x: target.x,
          y: target.y,
          cards: cardIds,
        });
        CardUI.clearSelectedCards(underworld);
        // Now that the cast has begun, clear the prediction tint so it doesn't color the targeted units anymore
        clearTints(underworld);
      } else {
        console.error("Attempting to cast while globalThis.player is undefined");
      }
    } else {
      floatingText({
        coords: mousePos,
        text: 'You must wait for your turn to cast',
      });
    }
  } else {
    updateTooltipSelection(mousePos, underworld);
  }
  tryShowDevContextMenu(underworld, e, mousePos);
}
function tryShowDevContextMenu(underworld: Underworld, e: MouseEvent, mousePos: Vec2) {
  if (globalThis.headless) {
    return;
  }
  // Developer tool, shift left click to choose to spawn a unit
  if (adminMode && e.shiftKey) {
    let menu = document.createElement("div") as HTMLElement;
    menu.id = "ctxmenu"
    menu.style.top = `${e.pageY - 10}px`;
    menu.style.left = `${e.pageX - 40}px`;
    menu.style.zIndex = '2';
    menu.onmouseleave = () => menu.outerHTML = '';
    menu.innerHTML = `
    <div>
      <p id='global-label'>Global</p>
      <ul id='menu-global'></ul>
    </div>
    <div>
      <p id='selected-unit-label'>Selected Unit</p>
      <ul id='menu-selected-unit'></ul>
    </div>
    <div>
      <p>Spawn Unit</p>
      <ul id='menu-spawn'></ul>
    </div>
    <div>
    <p>Spawn Pickup</p>
    <ul id='menu-spawn-pickup'></ul>
    </div>
    <div>
    <p>Self</p>
    <ul id='menu-self'>
    </ul>
    </div>
    `;
    if (globalThis.selectedUnit) {

      const elSelectedUnitList = menu.querySelector('#menu-selected-unit') as HTMLElement;
      const selectedUnitActions = [
        {
          label: '🔪 Die',
          action: () => {
            if (globalThis.selectedUnit) {
              Unit.die(globalThis.selectedUnit, underworld, false);
            }

          }
        },
        {
          label: '✖️ Delete',
          action: () => {
            // Remove without blood, remember clean up will just
            // flag them for deletion, they will be removed from the array
            // at the start of the next turn.
            if (globalThis.selectedUnit) {
              Unit.cleanup(globalThis.selectedUnit);
            }

          }
        },
        {
          label: 'Play All Animations',
          action: () => {
            if (globalThis.selectedUnit) {
              Unit.demoAnimations(globalThis.selectedUnit);
            }
          }
        },
        {
          label: '❤️ Set Health',
          action: () => {
            const health = prompt('Choose a new max health')
            const parsedHealth = parseInt(health || '');
            if (!isNaN(parsedHealth)) {
              if (globalThis.selectedUnit) {
                globalThis.selectedUnit.healthMax = parsedHealth;
                globalThis.selectedUnit.health = parsedHealth;
              }
            }
          }
        },
        {
          label: '🔵 Set Mana',
          action: () => {
            const mana = prompt('Choose a new max mana')
            const parsedMana = parseInt(mana || '');
            if (!isNaN(parsedMana)) {
              if (globalThis.selectedUnit) {
                globalThis.selectedUnit.manaMax = parsedMana;
                globalThis.selectedUnit.mana = parsedMana;
              }
            }
          }
        },
        {
          label: '👟 Set Stamina',
          action: () => {
            const stamina = prompt('Choose a new max stamina')
            const parsedStamina = parseInt(stamina || '');
            if (!isNaN(parsedStamina)) {
              if (globalThis.selectedUnit) {
                globalThis.selectedUnit.staminaMax = parsedStamina;
                globalThis.selectedUnit.stamina = parsedStamina;
              }
            }
          }
        },
        {
          label: 'Orient image towards player',
          action: () => {
            if (globalThis.selectedUnit && player) {
              Unit.orient(globalThis.selectedUnit, player.unit);
            }
          }
        }
      ]
      createContextMenuOptions(selectedUnitActions, elSelectedUnitList, menu);
    } else {
      menu.querySelector('#menu-selected-unit')?.remove();
      menu.querySelector('#selected-unit-label')?.remove();
    }
    const elGlobalList = menu.querySelector('#menu-global') as HTMLElement;
    const elKillAll = document.createElement('li');
    elKillAll.innerHTML = 'Kill All Enemies'
    elKillAll.addEventListener('click', () => {
      underworld.units.filter(u => u.faction == Faction.ENEMY).forEach(u => {
        Unit.die(u, underworld, false);
      })
      // Close the menu
      menu.remove();
    })
    elGlobalList.appendChild(elKillAll);

    const elSpawnList = menu.querySelector('#menu-spawn') as HTMLElement;
    createContextMenuOptions(Object.values(allUnits).map(u => ({
      label: u.id,
      action: () => {
        if (devSpawnUnit) {
          devSpawnUnit(u.id, Faction.ENEMY, mousePos);
        }

      }
    })), elSpawnList, menu);
    const elSpawnPickupList = menu.querySelector('#menu-spawn-pickup') as HTMLElement;
    createContextMenuOptions(Pickup.pickups.map(p => ({
      label: p.name,
      action: () => {
        Pickup.create({ pos: mousePos, pickupSource: p }, underworld, false);
      }
    })), elSpawnPickupList, menu);

    const elSelfList = menu.querySelector('#menu-self') as HTMLElement;
    createContextMenuOptions([
      {
        label: '🦸‍♂️ Super Me',
        action: () => {
          if (superMe) {
            superMe(underworld);
          }
        }
      },
      {
        label: '☄️ Teleport Here',
        action: () => {
          if (player) {
            player.unit.x = mousePos.x;
            player.unit.y = mousePos.y;
          }
        }
      },
      {
        label: '🎥 Toggle HUD',
        action: () => {
          toggleHUD();
        }
      },
      {
        label: '📹 Toggle UI for recording',
        action: () => {
          // Hides a portion of the UI but not all of it for recording or screenshots
          document.body.classList.toggle('recording');
        }
      }
    ], elSelfList, menu);

    document.body.appendChild(menu);

  }

}
function createContextMenuOptions(options: { action: () => void, label: string }[], container: HTMLElement, menu: HTMLElement) {
  for (let { label, action } of options) {
    let el = document.createElement('li');
    el.innerHTML = label
    el.addEventListener('click', () => {
      action();
      // Close the menu
      menu.remove();
    })
    container.appendChild(el);
  }

}