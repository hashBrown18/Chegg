/**
 * GameState.js — Core game state management for a CHEGG match
 */

const { MINION_BY_ID, getSpawnRows, isDarkTile } = require('./MinionLogic');
const { cellKey, getWitherSpawnExplosionTargets, buildOccupancyMap } = require('./MovementCalculator');

let instanceCounter = 0;
function generateInstanceId() {
  instanceCounter++;
  return `minion_${instanceCounter}_${Date.now()}`;
}

class GameState {
  constructor() {
    // Board: Map of "col,row" → minionInstance
    this.board = new Map();
    this.currentTurn = 'host'; // host goes first
    this.turnNumber = 1;
    this.hostMana = 1;
    this.guestMana = 1;
    this.status = 'playing';

    // Player decks / hands
    this.hostDeck = [];
    this.guestDeck = [];
    this.hostHand = [];
    this.guestHand = [];

    // Track minion instances by ID for quick lookup
    this.minionInstances = new Map();
  }

  /**
   * Initialize a new game with both players' decks
   */
  initializeGame(hostDeck, guestDeck) {
    // Shuffle decks
    this.hostDeck = this.shuffleArray([...hostDeck]);
    this.guestDeck = this.shuffleArray([...guestDeck]);

    // Place Villagers (FREE, not from deck)
    this.placeVillagers();

    // Draw 3 cards each
    this.hostHand = this.hostDeck.splice(0, 3);
    this.guestHand = this.guestDeck.splice(0, 3);

    // Set initial mana
    this.hostMana = 1;
    this.guestMana = 1;
    this.turnNumber = 1;
    this.currentTurn = 'host';
    this.status = 'playing';
  }

  /**
   * Place Villager for each player in their spawn zone center
   */
  placeVillagers() {
    // Host Villager: center of spawn zone rows I-J
    // Place at col 4 or 5, row I (front of spawn zone)
    const hostVillager = this.createMinionInstance('villager', 'host', 5, 'J');
    this.addToBoard(hostVillager);

    // Guest Villager: center of spawn zone rows A-B
    const guestVillager = this.createMinionInstance('villager', 'guest', 4, 'A');
    this.addToBoard(guestVillager);
  }

  /**
   * Create a minion instance object
   */
  createMinionInstance(minionType, owner, col, row) {
    const instanceId = generateInstanceId();
    const instance = {
      instanceId,
      type: minionType,
      owner,
      position: { col, row },
      spawnedThisTurn: false, // Villagers at game start are not "spawned this turn"
      hasMovedThisTurn: false,
      hasAttackedThisTurn: false,
      hasUsedAbilityThisTurn: false,
    };
    return instance;
  }

  /**
   * Add a minion to the board
   */
  addToBoard(minionInstance) {
    const key = cellKey(minionInstance.position.col, minionInstance.position.row);
    this.board.set(key, minionInstance);
    this.minionInstances.set(minionInstance.instanceId, minionInstance);
  }

  /**
   * Remove a minion from the board
   * @returns {Object|null} the removed minion instance, or null
   */
  removeMinion(instanceId) {
    const minion = this.minionInstances.get(instanceId);
    if (!minion) return null;

    const key = cellKey(minion.position.col, minion.position.row);
    this.board.delete(key);
    this.minionInstances.delete(instanceId);
    return minion;
  }

  /**
   * Remove a minion at a specific cell
   * @returns {Object|null} the removed minion instance, or null
   */
  removeMinionAt(col, row) {
    const key = cellKey(col, row);
    const minion = this.board.get(key);
    if (!minion) return null;

    this.board.delete(key);
    this.minionInstances.delete(minion.instanceId);
    return minion;
  }

  /**
   * Move a minion to a new position
   */
  moveMinion(instanceId, newCol, newRow) {
    const minion = this.minionInstances.get(instanceId);
    if (!minion) return false;

    // Remove from old position
    const oldKey = cellKey(minion.position.col, minion.position.row);
    this.board.delete(oldKey);

    // Set new position
    minion.position.col = newCol;
    minion.position.row = newRow;

    // Add to new position
    const newKey = cellKey(newCol, newRow);
    this.board.set(newKey, minion);

    return true;
  }

  /**
   * Spawn a minion from hand to the board
   * @returns {{ success: boolean, error?: string, destroyedMinions?: Array }}
   */
  spawnMinion(playerRole, minionId, targetCol, targetRow) {
    const hand = playerRole === 'host' ? this.hostHand : this.guestHand;
    const mana = playerRole === 'host' ? this.hostMana : this.guestMana;
    const spawnRows = getSpawnRows(playerRole);

    // Validate card is in hand
    const cardIndex = hand.indexOf(minionId);
    if (cardIndex === -1) {
      return { success: false, error: 'Card not in hand' };
    }

    // Validate minion type
    const minionDef = MINION_BY_ID[minionId];
    if (!minionDef) {
      return { success: false, error: 'Invalid minion type' };
    }

    // Validate mana
    if (mana < minionDef.cost) {
      return { success: false, error: 'Not enough mana' };
    }

    // Validate spawn zone
    if (!spawnRows.includes(targetRow)) {
      return { success: false, error: 'Not in spawn zone' };
    }

    // Validate cell is empty
    const key = cellKey(targetCol, targetRow);
    if (this.board.has(key)) {
      return { success: false, error: 'Cell is occupied' };
    }

    // Phantom: can only spawn on dark tiles
    if (minionId === 'phantom' && !isDarkTile(targetCol, targetRow)) {
      return { success: false, error: 'Phantom can only spawn on dark tiles' };
    }

    // Valid — deduct mana and spawn
    if (playerRole === 'host') {
      this.hostMana -= minionDef.cost;
    } else {
      this.guestMana -= minionDef.cost;
    }

    // Remove from hand
    hand.splice(cardIndex, 1);

    // Create and place minion
    const instance = this.createMinionInstance(minionId, playerRole, targetCol, targetRow);
    instance.spawnedThisTurn = true; // cannot act this turn
    this.addToBoard(instance);

    // Wither spawn explosion: destroy everything in 8 surrounding squares
    let destroyedMinions = [];
    if (minionId === 'wither') {
      const explosionTargets = getWitherSpawnExplosionTargets(targetCol, targetRow);
      for (const target of explosionTargets) {
        const destroyed = this.removeMinionAt(target.col, target.row);
        if (destroyed) {
          destroyedMinions.push(destroyed);
        }
      }
    }

    return { success: true, instance, destroyedMinions };
  }

  /**
   * Draw cards for a player
   */
  drawCards(playerRole, count) {
    const deck = playerRole === 'host' ? this.hostDeck : this.guestDeck;
    const hand = playerRole === 'host' ? this.hostHand : this.guestHand;
    const drawn = [];

    for (let i = 0; i < count; i++) {
      if (deck.length === 0) break;
      const card = deck.shift();
      hand.push(card);
      drawn.push(card);
    }

    return drawn;
  }

  /**
   * Get current mana for player
   */
  getMana(playerRole) {
    return playerRole === 'host' ? this.hostMana : this.guestMana;
  }

  /**
   * Deduct mana from player
   */
  deductMana(playerRole, amount) {
    if (playerRole === 'host') {
      this.hostMana -= amount;
    } else {
      this.guestMana -= amount;
    }
  }

  /**
   * Check win condition — returns winning role or null
   */
  checkWinCondition() {
    let hostVillagerAlive = false;
    let guestVillagerAlive = false;

    for (const [, minion] of this.minionInstances) {
      if (minion.type === 'villager') {
        if (minion.owner === 'host') hostVillagerAlive = true;
        if (minion.owner === 'guest') guestVillagerAlive = true;
      }
    }

    if (!hostVillagerAlive) return 'guest'; // guest wins
    if (!guestVillagerAlive) return 'host'; // host wins
    return null; // no winner yet
  }

  /**
   * Get player's hand
   */
  getPlayerHand(playerRole) {
    return playerRole === 'host' ? [...this.hostHand] : [...this.guestHand];
  }

  /**
   * Get player's hand count
   */
  getPlayerHandCount(playerRole) {
    return playerRole === 'host' ? this.hostHand.length : this.guestHand.length;
  }

  /**
   * Get player's deck count
   */
  getPlayerDeckCount(playerRole) {
    return playerRole === 'host' ? this.hostDeck.length : this.guestDeck.length;
  }

  /**
   * Get a minion instance by its ID
   */
  getMinionInstance(instanceId) {
    return this.minionInstances.get(instanceId) || null;
  }

  /**
   * Get minion at a specific cell
   */
  getMinionAt(col, row) {
    const key = cellKey(col, row);
    return this.board.get(key) || null;
  }

  /**
   * Get the full board state as a serializable object
   */
  getBoardState() {
    const state = {};
    for (const [key, minion] of this.board) {
      state[key] = {
        instanceId: minion.instanceId,
        type: minion.type,
        owner: minion.owner,
        position: { ...minion.position },
      };
    }
    return state;
  }

  /**
   * Get complete game state for serialization (for reconnection)
   */
  getFullState() {
    return {
      board: this.getBoardState(),
      currentTurn: this.currentTurn,
      turnNumber: this.turnNumber,
      hostMana: this.hostMana,
      guestMana: this.guestMana,
      status: this.status,
    };
  }

  /**
   * Shuffle array in-place (Fisher-Yates)
   */
  shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Reset per-turn flags for a player's minions at the start of their turn
   */
  resetTurnFlags(playerRole) {
    for (const [, minion] of this.minionInstances) {
      if (minion.owner === playerRole) {
        minion.spawnedThisTurn = false;
        minion.hasMovedThisTurn = false;
        minion.hasAttackedThisTurn = false;
        minion.hasUsedAbilityThisTurn = false;
      }
    }
  }
}

module.exports = GameState;
