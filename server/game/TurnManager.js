/**
 * TurnManager.js — Handles turn switching, mana refresh, card draw
 */

class TurnManager {
  /**
   * End the current turn and start the next
   * @param {GameState} gameState
   * @returns {{ newTurn: string, turnNumber: number, drawnCard: string|null }}
   */
  static endTurn(gameState) {
    // Switch turn
    const previousTurn = gameState.currentTurn;
    gameState.currentTurn = previousTurn === 'host' ? 'guest' : 'host';

    // If switching from guest back to host, increment turn number
    if (previousTurn === 'guest') {
      gameState.turnNumber++;
    }

    const newTurn = gameState.currentTurn;
    const turnNumber = gameState.turnNumber;

    // Refresh mana for the new active player
    const maxMana = Math.min(turnNumber, 6);
    if (newTurn === 'host') {
      gameState.hostMana = maxMana;
    } else {
      gameState.guestMana = maxMana;
    }

    // Reset per-turn flags for the new active player
    gameState.resetTurnFlags(newTurn);

    // Draw 1 card for the new active player
    const drawn = gameState.drawCards(newTurn, 1);

    return {
      newTurn,
      turnNumber,
      drawnCard: drawn.length > 0 ? drawn[0] : null,
    };
  }

  /**
   * Get the mana cap for a given turn number
   */
  static getManaCap(turnNumber) {
    return Math.min(turnNumber, 6);
  }
}

module.exports = TurnManager;
