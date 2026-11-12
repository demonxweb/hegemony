import { randomInt } from 'node:crypto';
import catalog from '../../data/hegemony-base-catalog.json' with { type: 'json' };

export const { decks: catalogDecks, boards, marketSizes } = catalog;

export function shuffled(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = randomInt(index + 1);
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export function copies(cards) {
  return cards.flatMap(card => Array(card.copies).fill(card.id));
}

const cards = new Map(Object.values(catalogDecks).flat().map(card => [card.id, card]));
export const catalogCard = id => cards.get(id);

export function createRoundContent() {
  return {
    events: [], eventDeck: shuffled(copies(catalogDecks.events)),
    benefits: { working: {}, middle: {}, capitalist: {} },
    legitimacyTokens: { working: 0, middle: 0, capitalist: 0 },
    civil: null,
    agenda: null, agendaDeck: shuffled(copies(catalogDecks.agendas)),
    export: null, exportDeck: shuffled(copies(catalogDecks.exports)),
    immigration: shuffled(copies(catalogDecks.immigration)),
    deals: [], dealDeck: shuffled(copies(catalogDecks.businessDeals)),
  };
}

export function revealStateContent(game) {
  const { content } = game;
  content.events = eventDraw(game, 2);
  content.agenda = content.agendaDeck.shift();
}

export function eventDraw(game, count, peek = false) {
  const { content } = game;
  const drawn = [];
  const eligible = id => (catalogCard(id).minimumRound ?? 1) <= game.match.round;
  while (drawn.length < count && content.eventDeck.some(eligible)) {
    const id = content.eventDeck.shift();
    if (!eligible(id)) content.eventDeck = shuffled([...content.eventDeck, id]);
    else drawn.push(id);
  }
  if (peek) content.eventDeck.unshift(...drawn);
  return drawn;
}

export function revealTradeContent(game) {
  const { content } = game;
  content.export = content.exportDeck.shift();
  const count = marketSizes.businessDealsByPolicy6[game.policies[5]];
  content.deals = content.dealDeck.splice(0, count);
}

export function drawImmigrant(game, role) {
  const id = game.content.immigration.shift();
  game.content.immigration.push(id);
  return catalogCard(id).skillsByRole[role];
}
