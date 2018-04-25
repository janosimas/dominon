import { Game, PlayerView } from 'boardgame.io/dist/core';
import { getState, currentPlayer } from '../utils';
import { drawCard } from '../dominion/utils';
import Specie from './specie';
import Player from './player';

const getCardFromHand = (state, ctx, index) => {
  const player = currentPlayer(state, ctx);
  // sanity check
  if (index < 0 || index > player.hand.length) {
    return undefined;
  }

  const card = player.hand.splice(index, 1);
  return card;
};

/**
 * Check body size and traits of the attacking specie
 * 
 * @param {Specie} specie 
 * @param {Specie} attackedSpecie
 */
const canAttack = (specie, attackedSpecie) => {
  return specie.bodySize > attackedSpecie.bodySize;
};

/**
 * Check traits of the attacked specie
 * @param {Specie} defendingSpecie
 * @param {Specie} specie
 */
const canBeAttacked = (defendingSpecie, specie) => {
  return true;
};

const Evolution = {
  setup: (ctx) => {
    let G = {
      secret: {},
      players: [],
      discard: [],
      wateringHole: 0
      // playerView: PlayerView.STRIP_SECRETS
    };

    // create n players for the game
    for (var i = 0; i < ctx.numPlayers; i++) {
      G.players.push(new Player('Player '+(i+1)));
    }

    G.secret.traitsDeck = [];

    return G;
  },
  moves: {
    clickOnCardForFood: (G, ctx, index) => {
      const state = getState(G, ctx);
      const card = getCardFromHand(state, ctx, index);
      if(!card) {
        return G;
      }

      state.secret.selectedCards.push(card);
      state.endTurn = true;

      return state;
    },

    //////////////////////////////////////////
    // cards action phase
    clickOnCard: (G, ctx, index) => {
      const state = getState(G, ctx);
      const card = getCardFromHand(state, ctx, index);
      if (!card) {
        return G;
      }

      const player = currentPlayer(state, ctx);
      player.selectedCard = card;
      return state;
    },

    newTrait: (G, ctx, specieIndex) => {
      const state = getState(G, ctx);
      const player = currentPlayer(state, ctx);
      if (!player.selectedCard) {
        return G;
      }

      const specie = player.species[specieIndex];
      if(specie.traits.length >= 4) {
        return G;
      }

      specie.traits.push(player.selectedCard);

      player.selectedCard = undefined;
      return state;
    },
    increasePopulation: (G, ctx, specieIndex) => {
      const state = getState(G, ctx);
      const player = currentPlayer(state, ctx);
      if (!player.selectedCard) {
        return G;
      }

      const specie = player.species[specieIndex];
      if (specie.population >= 9) {
        return G;
      }

      specie.population++;

      player.selectedCard = undefined;
      return state;
    },
    increaseBodySize: (G, ctx, specieIndex) => {
      const state = getState(G, ctx);
      const player = currentPlayer(state, ctx);
      if (!player.selectedCard) {
        return G;
      }

      const specie = player.species[specieIndex];
      if (specie.bodySize >= 9) {
        return G;
      }

      specie.bodySize++;

      player.selectedCard = undefined;
      return state;
    },
    createNewSpecie: (G, ctx, position) => {
      const state = getState(G, ctx);
      const player = currentPlayer(state, ctx);
      if (!player.selectedCard) {
        return G;
      }

      player.species.insert(position, new Specie());

      player.selectedCard = undefined;
      return state;
    },
    //////////////////////////////////////////
    // eat phase actions
    selectSpecie: (G, ctx, specieIndex) => {
      const state = getState(G, ctx);
      const player = currentPlayer(state, ctx);
      player.selectedSpecie = specieIndex;
    },
    eatFromWateringHole: (G, ctx) => {
      const state = getState(G, ctx);
      const player = currentPlayer(state, ctx);
      if (player.selectedSpecie === undefined) {
        return G;
      }

      const specie = player.species[player.selectedSpecie];
      if (!specie.isHungry()) {
        return G;
      }

      specie.food++;
      if(specie.food > specie.population) {
        specie.food = specie.population;
      }

      player.selectedSpecie = undefined;
      state.endTurn;
      return state;
    },
    attackOtherSpecie: (G, ctx, attackedPlayerIndex, attackedSpecieIndex) => {
      const state = getState(G, ctx);
      const player = currentPlayer(state, ctx);
      if (player.selectedSpecie === undefined) {
        return G;
      }

      const specie = player.species[player.selectedSpecie];
      if (specie.population === specie.food) {
        return G;
      }

      const attackedSpecie = state.players[attackedPlayerIndex].species[attackedSpecieIndex];
      if(!canAttack(specie, attackedSpecie)) {
        return G;
      }
      if (!canBeAttacked(attackedSpecie, specie)) {
        return G;
      }

      attackedSpecie.population--;

      const missingFood = specie.population - specie.food;
      const food = attackedSpecie.bodySize > missingFood ? missingFood : attackedSpecie.bodySize;
      specie.food += food;

      player.selectedSpecie = undefined;
      state.endTurn;
      return state;
    },
    //////////////////////////////////////////
  },
  flow: {
    endGameIf: (G, ctx) => {
      return false;
    },
    phases: [
      {
        name: 'Play food phase',
        allowedMoves: ['clickOnCardForFood'],
        endTurnIf: (G, ctx) => {
          return G.endTurn;
        },
        onTurnEnd: (G, ctx) => {
          const state = getState(G, ctx);
          state.endTurn = undefined;
          return state;
        },
        endPhaseIf: (G, ctx) => {
          if (G.secret.selectedCards.length === ctx.players.length) {
            return 'Card action phase';
          } else {
            return false;
          }
        },
        onPhaseBegin: (G, ctx) => {
          const state = getState(G, ctx);
          state.secret.selectedCards = [];
          for (const player of state.players) {
            drawCard(ctx, player, 4+player.species.length);
          }
          return state;
        },
        onPhaseEnd: (G, ctx) => {
          const state = getState(G, ctx);
          for (const card of state.secret.selectedCards) {
            state.wateringHole+=card.food;
          }
          state.secret.selectedCards = undefined;
          return state;
        }
      },
      {
        name: 'Card action phase',
        allowedMoves: ['clickOnCard', 'newTrait', 'increasePopulation', 'increaseBodySize', 'createNewSpecie'],
        endTurnIf: (G, ctx) => {
          const player = currentPlayer(G, ctx);
          // end turn if the player has no card in hand
          // and no selected card
          return (!player.hand.length && !player.selectedCard);
        },
        endPhaseIf: (G, ctx) => {
          let endPhase = true;
          for (const player of G.players) {
            if (player.hand.length || player.selectedCard) {
              endPhase = false;
              break;
            }  
          }
          
          if(endPhase) {
            return 'Eat phase';
          } else {
            return false;
          }
        }
      },
      {
        name: 'Eat phase', 
        allowedMoves: ['selectSpecie', 'eatFromWateringHole', 'attackOtherSpecie'],
        onPhaseEnd: (G, ctx) => {
          const state = getState(G, ctx);
          for (const player of state.players) {
            for (const specie of player.species) {
              player.food += specie.food;
              specie.food = 0;
            }
          }
          
          return state;
        },
        onTurnEnd: (G, ctx) => {
          const state = getState(G, ctx);
          state.endTurn = undefined;
          return state;
        },
        endTurnIf: (G, ctx) => {
          return G.endTurn;
        }
      }
    ]
  }
};

export default Game(Evolution);