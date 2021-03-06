import { Game, PlayerView } from 'boardgame.io/core';

import { currentPlayer, getState, discard } from '../utils';
import { getTopPhase, playCardFromHand, buyCard, drawCard, createPlayer, populateCardMap, populateMoves } from './utils';
import phases from './phases';

import baseModule from './base/module';
import coreModule from './core/module';

import province from './base/cards/province';


const Dominion = {
  setup: (ctx) => {
    let G = {
      play_area: [],
      trash: [],
      onPlayHandTrigger: [],
      players: {},
      cardMap: populateCardMap([baseModule, coreModule]),
      // base game cards, always present
      boardCards: [...baseModule.cards],
      phase_pile: [phases.ACTION_PHASE],
      playerView: PlayerView.STRIP_SECRETS
    };

    // create n players for the game
    for (var i = 0; i < ctx.numPlayers; i++) {
      G.players[i] = { ...createPlayer(ctx), name: 'Player ' + (i + 1) };
    }

    // get 10 random cards
    // and sort by cost
    const coreCards = ctx.random.Shuffle(coreModule.cards);
    G.boardCards.push(...coreCards.slice(0, 10).sort((a, b) => a.cost - b.cost));

    return G;
  },
  moves: {
    onClickBoard(G, ctx, key) {
      let state = getState(G);
      const card = state.cardMap.get(key);
      // Ensure we can't have less then 0 cards.
      if (card.count <= 0) {
        return state;
      }

      const player = currentPlayer(state, ctx);
      state = buyCard(state, ctx, player, card);

      return state;
    },
    onClickHand(G, ctx, index) {
      let state = getState(G, ctx);
      const player = currentPlayer(state, ctx);
      const hand = player.hand;

      // sanity check
      if (index < 0 || index > hand.length) {
        return state;
      }

      //TODO: reveal or play card?
      state = playCardFromHand(state, ctx, index);

      return state;
    },
    customAction(G, ctx) {
      let state = getState(G, ctx);
      if (state.customAction) {
        state = state.customAction.action(state, ctx);
      }

      return state;
    }
  },
  flow: {
    endGameIf: (G, ctx) => {
      // check if there are 3 or more empty piles in the board
      let emptyCount = 0;
      for (let index = 0; index < G.boardCards.length; index++) {
        const card = G.boardCards[index];
        if (card.count === 0) {
          emptyCount += 1;
        }
      }

      // if less then 3 piles
      // AND there are still province in the game
      if (emptyCount < 2 && province.count !== 0) {
        return undefined;
      } else {
        // game end, check victory condition
        let victoryMap = new Map();
        for (let player in G.players) {
          if (G.players.hasOwnProperty(player)) {
            let playerVictory = 0;
            const props = G.players[player];
            const cards = [...props.hand, ...props.deck, ...props.discard];
            for (const playerCard of cards) {
              if (playerCard.custom_victory) {
                playerVictory += playerCard.custom_victory(G, ctx);
              } else if (playerCard.victory) {
                playerVictory += playerCard.victory;
              }
            }
            victoryMap.set(player, playerVictory);
          }
        }

        let winner = null;
        let mostPoints = null;
        for (const maybeWinner of victoryMap) {
          const points = maybeWinner[1];
          if (!winner || points > mostPoints) {
            mostPoints = points;
            winner = maybeWinner[0];
          }
        }

        return winner;
      }
    },

    // Run at the end of a turn.
    onTurnEnd: (G, ctx) => {
      G.end_turn = false;
      const topPhase = getTopPhase(G);
      if (topPhase !== phases.ACTION_PHASE) {
        return G;
      }

      const state = getState(G);
      const player = currentPlayer(state, ctx);

      // remove temp cards
      state.play_area = state.play_area.filter(card => !card.temp);

      // move played card to discard area
      player.discard.push(...state.play_area);
      state.play_area = [];
      for (; player.hand.length > 0;) {
        discard(player, 0);
      }
      drawCard(ctx, player, 5);
      return state;
    },

    onTurnBegin: (G, ctx) => {
      const topPhase = getTopPhase(G);
      if (topPhase !== phases.ACTION_PHASE) {
        return G;
      }

      const state = getState(G);
      const player = currentPlayer(state, ctx);
      player.actions = 1;
      player.buy = 1;
      player.treasure = 0;

      return state;
    },

    endTurnIf: (G, ctx) => {
      return !!G.end_turn;
    },

    phases: [
      {
        name: phases.ACTION_PHASE,
        allowedMoves: ['onClickHand'],
        endPhaseIf: (G, ctx) => {
          const topPhase = getTopPhase(G);
          if (topPhase !== phases.ACTION_PHASE) {
            return topPhase;
          }

          return false;
          // const player = currentPlayer(G, ctx);
          // return player.actions === 0;
        },
        onPhaseBegin: (G, ctx) => {
          if(G.phase_pile.length !== 1 
            || (G.phase_pile[0] !== phases.ACTION_PHASE
                && G.phase_pile[0] !== phases.BUY_PHASE)) {
            throw new Error('Invalid phase pile');
          }

          const state = getState(G);
          state.phase_pile = [phases.ACTION_PHASE];
          return state;
        }
      },
      {
        name: phases.BUY_PHASE,
        allowedMoves: ['onClickHand', 'onClickBoard'],
        onPhaseBegin: (G, ctx) => {
          const state = getState(G);
          state.phase_pile = [phases.BUY_PHASE];
          return state;
        }
      },
      ...coreModule.custom_phases
    ],
  },
};

populateMoves(Dominion, [baseModule, coreModule]);

export default Game(Dominion);
