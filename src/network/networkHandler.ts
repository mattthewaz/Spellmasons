import type { OnDataArgs } from '@websocketpie/client';
import type * as PIXI from 'pixi.js';

import { MESSAGE_TYPES } from '../types/MessageTypes';
import * as Image from '../graphics/Image';
import floatingText from '../graphics/FloatingText';
import { getUpgradeByTitle } from '../Upgrade';
import Underworld, { IUnderworldSerializedForSyncronize, LevelData, turn_phase } from '../Underworld';
import * as Player from '../entity/Player';
import * as Doodad from '../entity/Doodad';
import * as Unit from '../entity/Unit';
import * as Pickup from '../entity/Pickup';
import * as messageQueue from '../messageQueue';
import * as storage from '../storage';
import * as config from '../config';
import { allUnits } from '../entity/units';
import { hostGiveClientGameState, typeGuardHostApp } from './networkUtil';
import { skyBeam } from '../VisualEffects';
import { tryFallInOutOfLiquid } from '../entity/Obstacle';
import { IPickupSerialized, removePickup } from '../entity/Pickup';
import { triggerAdminCommand } from '../graphics/ui/eventListeners';
import { Vec2 } from '../jmath/Vec';
import pingSprite from '../graphics/Ping';
import { clearLastNonMenuView, setView, View } from '../views';
import { autoExplain, explain, EXPLAIN_END_TURN, tutorialCompleteTask } from '../graphics/Explain';
import { cameraAutoFollow, runCinematicLevelCamera } from '../graphics/PixiUtils';
import { Overworld } from '../Overworld';
import { playerCastAnimationColor, playerCastAnimationColorLighter, playerCastAnimationGlow } from '../graphics/ui/colors';
import { lightenColor } from '../graphics/ui/colorUtil';
import { choosePerk, tryTriggerPerk } from '../Perk';

export const NO_LOG_LIST = [MESSAGE_TYPES.PING, MESSAGE_TYPES.PLAYER_THINKING];
export const HANDLE_IMMEDIATELY = [MESSAGE_TYPES.PING, MESSAGE_TYPES.PLAYER_THINKING];
export const elInstructions = document.getElementById('instructions') as (HTMLElement | undefined);
export function onData(d: OnDataArgs, overworld: Overworld) {
  const { payload, fromClient } = d;
  if (!NO_LOG_LIST.includes(d.payload.type)) {
    // Don't clog up server logs with payloads, leave that for the client which can handle them better
    try {
      console.log("onData:", MESSAGE_TYPES[d.payload.type], globalThis.headless ? '' : JSON.stringify(d))
    } catch (e) {
      console.warn('Prevent error due to Stringify:', e);
    }
  }
  const type: MESSAGE_TYPES = payload.type;
  const { underworld } = overworld;
  if (!underworld) {
    console.error('Cannot process onData, underworld does not exist');
    return;
  }
  switch (type) {
    case MESSAGE_TYPES.PING:
      pingSprite({ coords: payload as Vec2, color: underworld.players.find(p => p.clientId == d.fromClient)?.color });
      break;
    case MESSAGE_TYPES.INIT_GAME_STATE:
      // If the underworld is not yet initialized for this client then
      // load the game state
      // INIT_GAME_STATE is only to be handled by clients who just
      // connected to the room and need the first transfer of game state
      // This is why it is okay that updating the game state happens 
      // asynchronously.
      if (underworld.lastLevelCreated === undefined) {
        // If a client loads a full game state, they should be fully synced
        // so clear the onDataQueue to prevent old messages from being processed
        // after the full gamestate sync
        onDataQueueContainer.queue = [d];
        processNextInQueueIfReady(overworld);
      } else {
        console.log('Ignoring INIT_GAME_STATE because underworld has already been initialized.');
      }
      break;
    case MESSAGE_TYPES.CHOOSE_PERK:
      {
        console.log('onData: CHOOSE_PERK', `${fromClient}: ${JSON.stringify(payload?.perk || {})}`);
        // Get player of the client that sent the message 
        const fromPlayer = underworld.players.find((p) => p.clientId === fromClient);
        if (fromPlayer) {
          choosePerk(payload.perk, fromPlayer, underworld);
        } else {
          console.error('Cannot CHOOSE_PERK, fromPlayer is undefined', fromClient, fromPlayer)
        }
      }
      break;
    case MESSAGE_TYPES.CHOOSE_UPGRADE:
      console.log('onData: CHOOSE_UPGRADE', `${fromClient}: ${payload?.upgrade?.title}`);
      // Get player of the client that sent the message 
      const fromPlayer = underworld.players.find((p) => p.clientId === fromClient);
      if (fromPlayer) {
        const upgrade = getUpgradeByTitle(payload.upgrade.title);
        if (upgrade) {
          underworld.chooseUpgrade(fromPlayer, upgrade);
        } else {
          console.error(
            'Cannot CHOOSE_UPGRADE, upgrade does not exist',
            upgrade,
          );
        }
      } else {
        console.error('Cannot CHOOSE_UPGRADE, fromPlayer is undefined', fromClient, fromPlayer)
      }
      break;
    case MESSAGE_TYPES.LOAD_GAME_STATE:
      // If a client loads a full game state, they should be fully synced
      // so clear the onDataQueue to prevent old messages from being processed
      onDataQueueContainer.queue = [d];
      // The LOAD_GAME_STATE message is tricky, it is an 
      // exception to the normal pattern used
      // with the queue, but it should still be processed sequentially to prevent
      // weird race conditions.
      // Since it is a fully copy of the latest
      // game state, it should empty the queue (except for itself).
      // And rather than calling handleOnDataMessageSyncronously(d) here,
      // we just skip right to calling processNextInQueue since this message
      // can execute regardless of whether readyState.isReady() is true or not
      // --
      processNextInQueueIfReady(overworld);
      break;
    default:
      // MESSAGE_TYPES in HANDLE_IMMEDIATELY are not to be queued and can be processed
      // as soon as they are received.
      if (Object.values(HANDLE_IMMEDIATELY).includes(d.payload.type)) {
        handleOnDataMessage(d, overworld).catch(e => {
          console.error('handled: Error in immediate handleOnDataMessage:', e);
        })
      } else {
        // All other messages should be handled one at a time to prevent desync
        handleOnDataMessageSyncronously(d, overworld);
      }
      break;
  }
}
let onDataQueueContainer = messageQueue.makeContainer<OnDataArgs>();
// Waits until a message is done before it will continue to process more messages that come through
// This ensures that players can't move in the middle of when spell effects are occurring for example.
function handleOnDataMessageSyncronously(d: OnDataArgs, overworld: Overworld) {
  // Queue message for processing one at a time
  onDataQueueContainer.queue.push(d);
  // 10 is an arbitrary limit which will report that something may be wrong
  // because it's unusual for the queue to get this large
  const arbitraryQueueStuckLimit = 10;
  if (onDataQueueContainer.queue.length > arbitraryQueueStuckLimit) {
    const cachedQueue = JSON.stringify(onDataQueueContainer.queue.slice(0, arbitraryQueueStuckLimit));
    setTimeout(() => {
      if (cachedQueue == JSON.stringify(onDataQueueContainer.queue.slice(0, arbitraryQueueStuckLimit))) {
        console.log("onData queue: growing unusually large");
        console.error("onData queue stuck on message: ", MESSAGE_TYPES[currentlyProcessingOnDataMessage.payload.type], JSON.stringify(currentlyProcessingOnDataMessage), '\nPayload Types:', onDataQueueContainer.queue.map(x => MESSAGE_TYPES[x.payload.type]));
      } else {
        console.log('onData queue: Thought there might be a stuck queue but it resolved itself', cachedQueue, JSON.stringify(onDataQueueContainer.queue.slice(0, arbitraryQueueStuckLimit)));
      }
    }, 5000);
  }
  // process the "next" (the one that was just added) immediately
  processNextInQueueIfReady(overworld);
}
// currentlyProcessingOnDataMessage is used to help with bug reports to show
// which message is stuck and didn't finish being processed.
let currentlyProcessingOnDataMessage: any = null;
export function processNextInQueueIfReady(overworld: Overworld) {
  // If game is ready to process messages, begin processing
  // (if not, they will remain in the queue until the game is ready)
  messageQueue.processNextInQueue(onDataQueueContainer, d => handleOnDataMessage(d, overworld).catch(e => {
    console.error('Handled: error in handleOnDataMessage:', e);
  }));
}
function logHandleOnDataMessage(type: MESSAGE_TYPES, payload: any, fromClient: string, underworld: Underworld) {
  try {
    if (!NO_LOG_LIST.includes(type)) {
      // Count processed messages (but only those that aren't in the NO_LOG_LIST)
      underworld.processedMessageCount++;
      let payloadForLogging = payload;
      // For headless, log only portions of some payloads so as to not swamp the logs with
      // unnecessary info
      if (globalThis.headless) {
        switch (type) {
          case MESSAGE_TYPES.SET_PHASE:
            payloadForLogging = `phase: ${turn_phase[payload.phase]}`
            break;
          case MESSAGE_TYPES.SYNC_PLAYERS:
            payloadForLogging = `units: ${payload?.units.length}; players: ${payload?.players.length}`;
            break;
          case MESSAGE_TYPES.CREATE_LEVEL:
            payloadForLogging = `levelIndex: ${payload?.level?.levelIndex}; enemies: ${payload?.level?.enemies.length}`;
            break;
        }
      }
      // Don't clog up server logs with payloads, leave that for the client which can handle them better
      console.log("onData", underworld.processedMessageCount, ":", MESSAGE_TYPES[type], payloadForLogging)
    }
  } catch (e) {
    console.error('Error in logging', e);
  }

}
async function handleOnDataMessage(d: OnDataArgs, overworld: Overworld): Promise<any> {
  currentlyProcessingOnDataMessage = d;
  const { payload, fromClient } = d;
  const type: MESSAGE_TYPES = payload.type;
  const { underworld } = overworld;
  if (!underworld) {
    console.error('Cannot handleOnDataMessage, underworld does not exist');
    return;
  }
  logHandleOnDataMessage(type, payload, fromClient, underworld);
  // Get player of the client that sent the message 
  const fromPlayer = underworld.players.find((p) => p.clientId === fromClient);
  switch (type) {
    case MESSAGE_TYPES.PLAYER_THINKING:
      const thinkingPlayer = underworld.players.find(p => p.clientId === fromClient)
      if (thinkingPlayer && thinkingPlayer != globalThis.player) {
        underworld.playerThoughts[thinkingPlayer.clientId] = payload;
      }
      break;
    case MESSAGE_TYPES.CHANGE_CHARACTER:
      const player = underworld.players.find(p => p.clientId === fromClient)
      if (player) {
        const userSource = allUnits[payload.unitId];
        if (!userSource) {
          console.error('User unit source file not registered, cannot create player');
          return undefined;
        }
        player.unit.unitSourceId = payload.unitId;
        // Update the player image
        player.unit.defaultImagePath = userSource.info.image;
        Unit.returnToDefaultSprite(player.unit);
      } else {
        console.error('Cannot change character, player not found with id', fromClient);
        // TODO: This should request a unit and player sync
      }
      break;
    case MESSAGE_TYPES.REQUEST_SYNC_GAME_STATE:
      // If host, send sync; if non-host, ignore 
      if (globalThis.isHost(overworld.pie)) {
        console.log('Host: Sending game state for REQUEST_SYNC_GAME_STATE')
        hostGiveClientGameState(fromClient, underworld, underworld.lastLevelCreated, MESSAGE_TYPES.LOAD_GAME_STATE);
      }
      break;
    case MESSAGE_TYPES.SYNC_PLAYERS:
      {
        console.log('sync: SYNC_PLAYERS; syncs units and players')
        const { units, players } = payload as {
          // Note: When syncing players, must also sync units
          // because IPlayerSerialized doesn't container a full
          // unit serialized
          units: Unit.IUnitSerialized[],
          // Sync data for players
          players: Player.IPlayerSerialized[],
        }
        // Units must be synced before players so that the player's
        // associated unit is available for referencing
        underworld.syncUnits(units);
        underworld.syncPlayers(players);
      }
      break;
    case MESSAGE_TYPES.SET_PHASE:
      console.log('sync: SET_PHASE; syncs units and players')
      const { phase, units, players } = payload as {
        phase: turn_phase,
        // Sync data for players
        players?: Player.IPlayerSerialized[],
        // Sync data for units
        units?: Unit.IUnitSerialized[],
      }
      // Do not set the phase redundantly, this can occur due to tryRestartTurnPhaseLoop
      // being invoked multiple times before the first message is processed.  This is normal.
      if (underworld.turn_phase == phase) {
        console.debug(`Phase is already set to ${turn_phase[phase]}; Aborting SET_PHASE.`);
        return;
      }

      if (units) {
        underworld.syncUnits(units);
      }
      // Note: Players should sync after units so
      // that the player.unit reference is synced
      // with up to date units
      if (players) {
        underworld.syncPlayers(players);
      }
      // This should already be set to false after the spell completes but it is
      // also set to false here as an extra protection measure just in case
      for (let p of underworld.players) {
        if (p.isCasting) {
          console.error('Unexpected: player.isCasting was set to true during a SET_PHASE');
        }
        p.isCasting = false;
      }
      // Use the internal setTurnPhrase now that the desired phase has been sent
      // via the public setTurnPhase
      await underworld.initializeTurnPhase(phase);
      break;
    case MESSAGE_TYPES.CREATE_LEVEL:
      const { level } = payload as {
        level: LevelData
      }
      console.log('sync: CREATE_LEVEL: Syncing / Creating level');
      if (underworld) {
        await underworld.createLevel(level);
      } else {
        console.error('Cannot sync level, no underworld exists')
      }

      break;
    case MESSAGE_TYPES.INIT_GAME_STATE:
      await handleLoadGameState(payload, overworld);
      break;
    case MESSAGE_TYPES.LOAD_GAME_STATE:
      await handleLoadGameState(payload, overworld);
      break;
    case MESSAGE_TYPES.ENTER_PORTAL:
      if (fromPlayer) {
        Player.enterPortal(fromPlayer, underworld);
      } else {
        console.error('Recieved ENTER_PORTAL message but "caster" is undefined')
      }
      break;
    case MESSAGE_TYPES.PLAYER_CARDS:
      if (fromPlayer) {
        fromPlayer.cards = payload.cards;
      } else {
        console.error('No fromPlayer to set card order on')
      }
      break;
    case MESSAGE_TYPES.PLAYER_CONFIG:
      const { color, colorMagic, name, lobbyReady } = payload;
      if (fromPlayer) {
        if (lobbyReady !== undefined) {
          fromPlayer.lobbyReady = lobbyReady;
          // If all connected players are also ready, start the game:
          const connectedPlayers = underworld.players.filter(p => p.clientConnected);
          if (connectedPlayers.length > 0 && connectedPlayers.every(p => p.lobbyReady)) {
            console.log('Lobby: All players are ready, start game.');
            setView(View.Game);
            if (globalThis.player && fromPlayer.clientId == globalThis.player.clientId && !globalThis.player.isSpawned) {
              // Retrigger the cinematic camera since the first time
              // a user joins a game from the lobby, postLevelSetup will
              // already have completed before they enter View.Game, so now
              // that they have, run the cinematic again.
              runCinematicLevelCamera(underworld);
            }
          }
        }
        if (name !== undefined) {
          fromPlayer.name = name;
          fromPlayer.unit.name = name;
          if (globalThis.pixi && fromPlayer.unit.image) {
            // @ts-ignore jid is a custom identifier to id the text element used for the player name
            const nameText = fromPlayer.unit.image.sprite.children.find(child => child.jid == config.NAME_TEXT_ID) as PIXI.Text || new globalThis.pixi.Text();
            // @ts-ignore jid is a custom identifier to id the text element used for the player name
            nameText.jid = config.NAME_TEXT_ID;
            fromPlayer.unit.image.sprite.addChild(nameText);
            nameText.text = fromPlayer.name;
            nameText.y = -config.COLLISION_MESH_RADIUS - config.NAME_TEXT_Y_OFFSET;
            nameText.style = { fill: 'white', fontSize: config.NAME_TEXT_DEFAULT_SIZE, ...config.PIXI_TEXT_DROP_SHADOW };
            nameText.anchor.x = 0.5;
            nameText.anchor.y = 0.5;
          }
        }
        if (color !== undefined) {
          Player.setPlayerRobeColor(fromPlayer, color, colorMagic);
        }
        Player.syncLobby(underworld);
        underworld.tryRestartTurnPhaseLoop();
      } else {
        console.error('Cannot PLAYER_CONFIG, no associated player. Players:', underworld.players.map(p => p.clientId));
      }
      break;
    case MESSAGE_TYPES.SPAWN_PLAYER:
      if (fromPlayer) {
        // If the spawned player is the current client's player
        if (fromPlayer == globalThis.player) {
          tutorialCompleteTask('spawn');
          autoExplain();
          // When player spawns, send their config from storage
          // to the server
          overworld.pie.sendData({
            type: MESSAGE_TYPES.PLAYER_CONFIG,
            color: storage.get(storage.STORAGE_ID_PLAYER_COLOR),
            name: storage.get(storage.STORAGE_ID_PLAYER_NAME),
          });
        }
        if (!(isNaN(payload.x) && isNaN(payload.y))) {
          fromPlayer.isSpawned = true;
          if (fromPlayer == globalThis.player) {
            if (elInstructions) {
              elInstructions.innerText = '';
            }
            cameraAutoFollow(true);
          }
          Unit.setLocation(fromPlayer.unit, payload);
          // Trigger 'everyLevel' attributePerks
          // now that the player has spawned in at the new level
          for (let i = 0; i < fromPlayer.attributePerks.length; i++) {
            const perk = fromPlayer.attributePerks[i];
            if (perk) {
              tryTriggerPerk(perk, fromPlayer, 'everyLevel', underworld, 700 * i);
            }
          }
          // Detect if player spawns in liquid
          tryFallInOutOfLiquid(fromPlayer.unit, underworld, false);
          // Animate effect of unit spawning from the sky
          skyBeam(fromPlayer.unit);
          playSFXKey('summonDecoy');
          // Once a player spawns make sure to show their image as
          // their image may be hidden if they are the non-current user
          // player in multiplayer
          Image.show(fromPlayer.unit.image);
          fromPlayer.endedTurn = false;
          underworld.syncTurnMessage();
          // Used for the tutorial but harmless if invoked under other circumstances.
          // Spawns the portal after the player choses a spawn point if there are no
          // enemies left
          underworld.checkIfShouldSpawnPortal();
        } else {
          console.error('Cannot spawn player at NaN')
        }
        // This check protects against potential bugs where the upgrade screen still hasn't come up
        // by the time the player spawns
        if (fromPlayer == globalThis.player && (globalThis.player.upgradesLeftToChoose > 0 || globalThis.player.perksLeftToChoose > 0)) {
          console.error('Unexpected: player had unspent upgrade points when they spawned.');
          underworld.showUpgrades();
        }

      } else {
        console.error('Cannot SPAWN_PLAYER, fromPlayer is undefined.')
      }
      Player.syncLobby(underworld);


      underworld.tryRestartTurnPhaseLoop();
      break;
    case MESSAGE_TYPES.MOVE_PLAYER:
      if (fromPlayer == globalThis.player) {
        // Do not do anything, own player movement is handled locally
        // so that it is smooth
        break;
      }
      if (underworld.turn_phase == turn_phase.Stalled) {
        // This check shouldn't have to be here but it protects against the game getting stuck in stalled phase
        console.error('Game was in Stalled turn_phase when a player sent MESSAGE_TYPES.MOVE_PLAYER.');
        underworld.tryRestartTurnPhaseLoop();
      }
      if (fromPlayer) {
        // Only allow spawned players to move
        if (fromPlayer.isSpawned) {
          // Network Sync: Make sure other players move a little slower so that the MOVE_PLAYER messages have time to set the
          // next move point on the client's screen.  This prevents jagged movement due to network latency
          fromPlayer.unit.moveSpeed = config.UNIT_MOVE_SPEED * 0.9;
          // Network Sync: Make sure the other player always has stamina to get where they're going, this is to ensure that
          // the local copies of other player's stay in sync with the server and aren't prematurely stopped due
          // to a stamina limitation
          fromPlayer.unit.stamina = 100;
          const moveTowardsPromise = Unit.moveTowards(fromPlayer.unit, payload, underworld).then(() => {
            if (fromPlayer.unit.path?.points.length && fromPlayer.unit.stamina == 0) {
              // If they do not reach their destination, notify that they are out of stamina
              floatingText({
                coords: fromPlayer.unit,
                text: 'Out of Stamina!'
              });
              explain(EXPLAIN_END_TURN);
              playSFXKey('deny_stamina');
            }
            // Clear player unit path when they are done moving so they get
            // to choose a new path next turn
            fromPlayer.unit.path = undefined;
          });
          // Now that player movement has been set up, trigger the headless server to process it immediately
          underworld.triggerGameLoopHeadless();
          await moveTowardsPromise;
        }
      } else {
        console.error('Cannot move player, caster does not exist');
      }
      break;
    case MESSAGE_TYPES.SPELL:
      if (fromPlayer) {
        if (underworld.turn_phase == turn_phase.Stalled) {
          // This check shouldn't have to be here but it protects against the game getting stuck in stalled phase
          console.error('Game was in Stalled turn_phase when a player sent MESSAGE_TYPES.SPELL.');
          underworld.tryRestartTurnPhaseLoop();
        }
        await handleSpell(fromPlayer, payload, underworld);
        // Trigger it again in case the result of any spells caused a forceMove to be added to the array
        // such as Bloat's onDeath
        underworld.triggerGameLoopHeadless();
      } else {
        console.error('Cannot cast, caster does not exist');
      }
      break;
    case MESSAGE_TYPES.END_TURN:
      if (fromPlayer) {
        underworld.endPlayerTurn(fromPlayer.clientId);
      } else {
        console.error('Unable to end turn because caster is undefined');
      }
      break;
    case MESSAGE_TYPES.ADMIN_COMMAND:
      const { label } = payload;
      triggerAdminCommand(label, fromClient, payload)
      break;
    case MESSAGE_TYPES.ADMIN_CHANGE_STAT:
      const { unitId, stats } = payload;
      const unit = underworld.units.find(u => u.id == unitId);
      if (unit) {
        Object.assign(unit, stats);
      } else {
        console.error('ADMIN_CHANGE_STAT failed', payload)
      }
      break;

  }
}
async function handleLoadGameState(payload: {
  underworld: IUnderworldSerializedForSyncronize,
  phase: turn_phase,
  pickups: IPickupSerialized[],
  units: Unit.IUnitSerialized[],
  players: Player.IPlayerSerialized[],
  doodads: Doodad.IDoodadSerialized[]
}, overworld: Overworld) {
  console.log("Setup: Load game state", payload)
  const { underworld: payloadUnderworld, phase, pickups, units, players, doodads } = payload
  // Sync underworld properties
  const loadedGameState: IUnderworldSerializedForSyncronize = { ...payloadUnderworld };
  const { underworld } = overworld;
  if (!underworld) {
    return console.error('Cannot handleLoadGameState, underworld is undefined');
  }

  const level = loadedGameState.lastLevelCreated;
  if (!level) {
    console.error('Cannot handleLoadGameState, level is undefined');
    return;
  }
  underworld.levelIndex = loadedGameState.levelIndex;

  // Update the seed (this MUST come before syncronizeRNG)
  underworld.seed = loadedGameState.seed;
  // Now sync the seed-based RNG state
  if (loadedGameState.RNGState) {
    underworld.syncronizeRNG(loadedGameState.RNGState);
  }
  underworld.turn_phase = loadedGameState.turn_phase;
  underworld.turn_number = loadedGameState.turn_number;
  underworld.processedMessageCount = loadedGameState.processedMessageCount;
  underworld.cardDropsDropped = loadedGameState.cardDropsDropped;
  underworld.enemiesKilled = loadedGameState.enemiesKilled;

  // Sync Level.  Must await createLevel since it uses setTimeout to ensure that
  // the DOM can update with the "loading..." message before locking up the CPU with heavy processing.
  // This is important so that createLevel runs BEFORE loading units and syncing Players
  // Note: createLevel syncronizes a bunch of underworld properties; for example it invokes cache_walls.
  // Check it carefully before manually syncronizing properties
  await underworld.createLevel(level);

  // Since level data has pickups stored in it and since those pickups' locations
  // for existance may have changed between when the level was created and when
  // the gamestate was saved, remove all pickups and spawn pickups from the pickups array
  for (let p of underworld.pickups) {
    removePickup(p, underworld, false);
  }
  if (pickups) {
    for (let p of pickups) {
      const pickup = Pickup.pickups.find(pickupSource => pickupSource.imagePath == p.imagePath);
      if (pickup) {
        const newPickup = Pickup.create({ pos: { x: p.x, y: p.y }, pickupSource: pickup }, underworld, false);
        if (newPickup) {
          const { image, ...rest } = p;
          // Override pickup properties such as turnsLeftToGrab
          Object.assign(newPickup, rest);
        }
      } else {
        console.error('Could not spawn pickup, pickup source missing for imagePath', p.imagePath);
      }
    }
  }

  // Load units
  if (units) {
    // Clean up previous units:
    underworld.units.forEach(u => Unit.cleanup(u));
    underworld.units = units.map(u => Unit.load(u, underworld, false));
  }
  // Note: Players should sync after units are loaded so
  // that the player.unit reference is synced
  // with up to date units
  if (players) {
    underworld.syncPlayers(players);
  }
  underworld.doodads = doodads.map(d => Doodad.load(d, underworld, false)).flatMap(x => x !== undefined ? [x] : []);
  // lastUnitId must be synced AFTER all of the units are synced since the synced
  // units are id aware
  underworld.lastUnitId = loadedGameState.lastUnitId;
  // Set the turn_phase; do not use initializeTurnPhase
  // because that function runs initialization logic that would
  // make the loaded underworld desync from the host's underworld
  underworld.setTurnPhase(phase);

  underworld.syncTurnMessage();

}
async function handleSpell(caster: Player.IPlayer, payload: any, underworld: Underworld) {
  if (typeof payload.x !== 'number' || typeof payload.y !== 'number') {
    console.error('Spell is invalid, it must have coordinates');
    return;
  }
  // Clear out player thought (and the line that points to it) once they cast
  delete underworld.playerThoughts[caster.clientId];

  console.log('Handle Spell:', payload?.cards.join(','));

  // Only allow casting during the PlayerTurns phase
  if (underworld.turn_phase === turn_phase.PlayerTurns) {
    globalThis.animatingSpells = true;
    let animationKey = 'playerAttackEpic';
    if (payload.cards.length < 3) {
      animationKey = 'playerAttackSmall';
    } else if (payload.cards.length < 6) {
      animationKey = 'playerAttackMedium0';
    }
    if (['units/playerBookIn', 'units/playerBookIdle'].includes(caster.unit.image?.sprite.imagePath || '')) {
      await new Promise<void>((resolve) => {
        if (caster.unit.image) {
          Image.changeSprite(
            caster.unit.image,
            'units/playerBookReturn',
            caster.unit.image.sprite.parent,
            resolve,
            {
              loop: false,
              // Play the book close animation a little faster than usual so
              // the player can get on with casting
              animationSpeed: 0.2
            }
          );
          Image.addOneOffAnimation(caster.unit, 'units/playerBookReturnMagic', { doRemoveWhenPrimaryAnimationChanges: true }, {
            loop: false,
            // Play the book close animation a little faster than usual so
            // the player can get on with casting
            animationSpeed: 0.2
          });
        } else {
          resolve();
        }
      });
    }
    const keyMoment = () => underworld.castCards(caster.cardUsageCounts, caster.unit, payload.cards, payload, false, false, caster.colorMagic, caster);
    const colorMagicMedium = lightenColor(caster.colorMagic, 0.3);
    const colorMagicLight = lightenColor(caster.colorMagic, 0.6);
    await Unit.playComboAnimation(caster.unit, animationKey, keyMoment, {
      animationSpeed: 0.2, loop: false, colorReplace: {
        colors: [
          [playerCastAnimationGlow, caster.colorMagic],
          [playerCastAnimationColor, colorMagicMedium],
          [playerCastAnimationColorLighter, colorMagicLight],
        ],
        epsilon: 0.2
      }
    });
    globalThis.animatingSpells = false;
    // Check for dead players to end their turn,
    // this occurs here because spells may have caused their death
    for (let p of underworld.players) {
      // If a player's unit is dead, end their turn
      if (!p.unit.alive) {
        underworld.endPlayerTurn(p.clientId);
      }
    }
  } else {
    console.log('Someone is trying to cast out of turn');
  }
}

export function setupNetworkHandlerGlobalFunctions(overworld: Overworld) {
  globalThis.configPlayer = ({ color, colorMagic, name, lobbyReady }: { color?: number, colorMagic?: number, name?: string, lobbyReady?: boolean }) => {
    if (color !== undefined) {
      storage.set(storage.STORAGE_ID_PLAYER_COLOR, color);
    }
    if (color !== undefined) {
      storage.set(storage.STORAGE_ID_PLAYER_COLOR_MAGIC, colorMagic);
    }
    if (name !== undefined) {
      storage.set(storage.STORAGE_ID_PLAYER_NAME, name || '');
    }
    overworld.pie.sendData({
      type: MESSAGE_TYPES.PLAYER_CONFIG,
      color,
      colorMagic,
      name,
      lobbyReady
    });
  }


  globalThis.getAllSaveFiles = () => Object.keys(localStorage).filter(x => x.startsWith(globalThis.savePrefix)).map(x => x.substring(globalThis.savePrefix.length));

  globalThis.save = (title: string) => {
    const { underworld } = overworld;
    if (!underworld) {
      console.error('Cannot save game, underworld does not exist');
      return;
    }
    const saveObject = {
      underworld: underworld.serializeForSaving(),
      phase: underworld.turn_phase,
      pickups: underworld.pickups.map(Pickup.serialize),
      units: underworld.units.filter(u => !u.flaggedForRemoval).map(Unit.serialize),
      players: underworld.players.map(Player.serialize),
      doodads: underworld.doodads.map(Doodad.serialize),
    };
    try {
      storage.set(
        globalThis.savePrefix + title,
        JSON.stringify(saveObject),
      );
    } catch (e) {
      console.error(e);
      console.log('Failed to save', saveObject);
    }
  };
  globalThis.deleteSave = (title: string) => {
    const doDelete = confirm(i18n('Are you sure you want to delete this save file?'));
    if (doDelete) {
      storage.remove(globalThis.savePrefix + title);
    }
  }
  globalThis.load = async (title: string) => {
    const savedGameString = storage.get(globalThis.savePrefix + title);
    if (savedGameString) {
      console.log('LOAD: connectToSingleplayer in preparation for load');
      if (globalThis.connectToSingleplayer) {
        await globalThis.connectToSingleplayer();
      } else {
        console.error('Unexpected: Attempting to load but globalThis.connectToSingleplayer is undefined');
      }

      const { underworld: savedUnderworld, phase, units, players, pickups, doodads } = JSON.parse(savedGameString);
      console.log('LOAD: send LOAD_GAME_STATE');
      overworld.pie.sendData({
        type: MESSAGE_TYPES.LOAD_GAME_STATE,
        underworld: savedUnderworld,
        pickups,
        doodads,
        phase,
        units,
        players
      });
      setView(View.Game);

    } else {
      console.error('no save game found with title', title);
    }
  };

  globalThis.exitCurrentGame = function exitCurrentGame(): Promise<void> {
    // Go back to the main PLAY menu
    globalThis.setMenu?.('PLAY');
    if (overworld.underworld) {
      overworld.underworld.cleanup();
    }
    // This prevents 'esc' key from going "back" to viewGame after the underworld is cleaned up
    clearLastNonMenuView();
    // Ensure the menu is open
    setView(View.Menu);
    return typeGuardHostApp(overworld.pie) ? Promise.resolve() : overworld.pie.disconnect();
  }
}