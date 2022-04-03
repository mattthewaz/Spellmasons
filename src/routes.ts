import { addPixiContainersForRoute, recenterStage } from './PixiUtils';
import {
  clickHandler,
  contextmenuHandler,
  endTurnBtnListener,
  keydownListener,
  keyupListener,
  mousemoveHandler,
} from './ui/eventListeners';
import { turn_phase } from './Underworld';
import { createUpgradeElement, generateUpgrades } from './Upgrade';
import { View, toggleMenu } from './views';

export enum Route {
  // Underworld contains the grid with levels and casting
  Underworld,
  // Post combat
  Upgrade,
  GameOver
}
// temp for testing
window.setRoute = setRoute;

// The "Route" is a game state that determines what in-game
// screen the user is viewing. setRoute may contain setup logic.
export function setRoute(r: Route) {
  if (r === undefined) {
    console.error('Could not set route to undefined route');
    return
  }
  console.log('setRoute(', Route[r], ')');
  for (let route of Object.keys(Route)) {
    document.body.classList.remove(`route-${route}`);
  }
  document.body.classList.add(`route-${Route[r]}`);
  window.route = r;
  if (window.view === View.Game) {
    addPixiContainersForRoute(r);
  }

  // Remove previous event listeners:
  removeUnderworldEventListeners();

  const elUpgradePicker = document.getElementById('upgrade-picker');
  // Hide the upgrade picker when the route changes
  elUpgradePicker && elUpgradePicker.classList.remove('active');
  switch (r) {
    case Route.Underworld:
      // Set the first turn phase
      window.underworld.setTurnPhase(turn_phase.PlayerTurns);
      addUnderworldEventListeners();
      // Start the gameloop
      window.underworld.gameLoopUnits();
      // Beating a level takes players from Underworld to Upgrade
      break;
    case Route.Upgrade:
      const elUpgradePickerContent = document.getElementById(
        'upgrade-picker-content',
      );
      if (!elUpgradePicker || !elUpgradePickerContent) {
        console.error('elUpgradePicker or elUpgradePickerContent are undefined.');
      }
      // Reveal the upgrade picker
      elUpgradePicker && elUpgradePicker.classList.add('active');
      const player = window.underworld.players.find(
        (p) => p.clientId === window.clientId,
      );
      if (player) {
        const upgrades = generateUpgrades(player);
        const elUpgrades = upgrades.map((upgrade) =>
          createUpgradeElement(upgrade, player),
        );
        if (elUpgradePickerContent) {
          elUpgradePickerContent.innerHTML = '';
          for (let elUpgrade of elUpgrades) {
            elUpgradePickerContent.appendChild(elUpgrade);
          }
        }
      } else {
        console.error('Upgrades cannot be generated, player not found');
      }
      break;
  }
  // Recentering should happen after stage setup
  recenterStage();
}
const menuBtnId = 'menuBtn';
const endTurnBtnId = 'endTurn';
function addUnderworldEventListeners() {
  // Add keyboard shortcuts
  window.addEventListener('keydown', keydownListener);
  window.addEventListener('keyup', keyupListener);
  document.body.addEventListener('contextmenu', contextmenuHandler);
  document.body.addEventListener('click', clickHandler);
  document.body.addEventListener('mousemove', mousemoveHandler);
  // Add button listeners
  const elEndTurnBtn: HTMLButtonElement = document.getElementById(
    endTurnBtnId,
  ) as HTMLButtonElement;
  elEndTurnBtn.addEventListener('click', endTurnBtnListener);
  const elMenuBtn: HTMLButtonElement = document.getElementById(
    menuBtnId,
  ) as HTMLButtonElement;
  elMenuBtn.addEventListener('click', toggleMenu);
  console.log('add event listeners', elMenuBtn);
}

function removeUnderworldEventListeners() {
  // Remove keyboard shortcuts
  window.removeEventListener('keydown', keydownListener);
  window.removeEventListener('keyup', keyupListener);
  // Remove mouse and click listeners
  document.body.removeEventListener('contextmenu', contextmenuHandler);
  document.body.removeEventListener('click', clickHandler);
  document.body.removeEventListener('mousemove', mousemoveHandler);
  // Remove button listeners
  const elEndTurnBtn: HTMLButtonElement = document.getElementById(
    endTurnBtnId,
  ) as HTMLButtonElement;
  elEndTurnBtn.removeEventListener('click', endTurnBtnListener);
  const elMenuBtn: HTMLButtonElement = document.getElementById(
    menuBtnId,
  ) as HTMLButtonElement;
  elMenuBtn.removeEventListener('click', toggleMenu);
}
