import base from '../../data/hegemony-v1.2-data.json' with { type: 'json' };
import { catalogCard } from './content.mjs';
import { credit, pay, publicCapacity, storageCapacity } from './companies.mjs';
import { population, recordResourceSale } from './rounds.mjs';
import { adjustLegitimacy } from './events.mjs';
import { marketQuote } from './prices.mjs';
import { requireRule } from './errors.mjs';

const products = ['food', 'luxury', 'health', 'education', 'influence'];

export function buyGoods(game, role, resource, sources, options = {}) {
  requireRule(['working', 'middle'].includes(role) && products.includes(resource), '請選擇可購買的資源。');
  const entries = Object.entries(sources ?? {}).filter(([, amount]) => amount !== 0);
  const cap = population(game, role);
  requireRule(entries.length > 0 && (options.flexible || entries.length <= 2), '請選擇最多兩個供應來源。');
  for (const [seller, amount] of entries) {
    const limit = options.flexible && entries.length === 1 ? 2 * cap : cap;
    requireRule(Number.isInteger(amount) && amount > 0 && amount <= limit && (!options.only || seller === options.only), '購買數量或來源不符合限制。');
    const quote = marketQuote(game, seller, resource);
    if (seller === 'foreign') {
      requireRule(quote, '只能進口食物或奢侈品。');
      pay(game, role, amount * quote.price);
      credit(game, 'state', amount * quote.tariff);
    } else {
      const stock = seller === 'state' ? game.publicServices : game.economy.inventory[seller];
      requireRule(quote && !(role === 'working' && seller === role)
        && (!options.tourism || seller !== 'state') && quote.stock >= amount, '賣方庫存不足或不能供應。');
      const welfare = seller === 'state' && ['health', 'education'].includes(resource);
      const rate = quote.price;
      if (seller !== role) {
        const total = rate * amount;
        const own = options.tourism ? Math.ceil(total / 2) : total;
        pay(game, role, own);
        if (options.tourism) pay(game, 'state', total - own, true);
        credit(game, seller, total);
        recordResourceSale(game, seller, resource, amount);
        if (welfare && rate === 5) game.players.state.vp++;
        if (welfare && rate === 0) adjustLegitimacy(game, role, Math.floor(amount / 3));
      }
      stock[resource] -= amount;
    }
    game.players[role][resource] = (game.players[role][resource] ?? 0) + amount;
  }
}

export function sellToState(game, role, resource, amount, limit) {
  const stock = game.economy.inventory[role];
  const current = game.publicServices[resource] ?? 0;
  requireRule(Number.isInteger(amount) && amount >= 0 && amount <= limit && stock[resource] >= amount
    && current + amount <= publicCapacity(game.economy, resource), '出售數量超過卡牌、庫存或公營容量。');
  pay(game, 'state', amount * 10, true);
  credit(game, role, amount * 10);
  stock[resource] -= amount;
  game.publicServices[resource] = current + amount;
  recordResourceSale(game, role, resource, amount);
  adjustLegitimacy(game, role, Math.floor(amount / 3));
}

export function businessDeal(game, command) {
  const { content, economy } = game;
  requireRule(content?.deals.includes(command.dealId), '請選場上的商業交易卡。');
  const deal = catalogCard(command.dealId);
  const allocation = command.allocation;
  const freeZone = command.destination === 'free-zone';
  requireRule(allocation ? typeof allocation === 'object' && !Array.isArray(allocation)
    && Object.entries(allocation).every(([resource, amount]) => amount === 0 || Object.hasOwn(deal.goods, resource))
    : freeZone || command.destination === 'warehouse', '請依照卡牌實際提供的貨物分配到貨位置。');
  const goods = Object.entries(deal.goods);
  const warehouse = Object.fromEntries(goods.map(([resource, amount]) => [resource, allocation ? allocation[resource] ?? 0 : freeZone ? 0 : amount]));
  requireRule(goods.every(([resource, amount]) => Number.isInteger(warehouse[resource]) && warehouse[resource] >= 0
    && warehouse[resource] <= amount), '分配到國內倉庫的數量超過到貨量。');
  const tariff = Object.values(warehouse).some(Boolean) ? deal.tariffByForeignTrade[game.policies[5]] : 0;
  pay(game, 'capitalist', deal.cost + tariff);
  credit(game, 'state', tariff);
  for (const [resource, amount] of goods) {
    const stock = economy.inventory.capitalist;
    const zone = economy.tradeZone;
    stock[resource] = Math.min(storageCapacity(economy, 'capitalist', resource), stock[resource] + warehouse[resource]);
    zone[resource] = Math.min(base.limits.free_trade_zone_capacity[resource], zone[resource] + amount - warehouse[resource]);
  }
  content.deals.splice(content.deals.indexOf(command.dealId), 1);
  game.log.push(`資本家完成${deal.nameZh}，支付 $${deal.cost + tariff}。`);
}

export function specialExport(game, resource, quantity, limit, price) {
  const { tradeZone, inventory } = game.economy;
  const zone = Math.min(tradeZone[resource] ?? 0, quantity);
  requireRule(Number.isInteger(quantity) && quantity >= 0 && quantity <= limit && quantity <= zone + inventory.capitalist[resource], '特殊出口數量無效。');
  tradeZone[resource] -= zone;
  inventory.capitalist[resource] -= quantity - zone;
  credit(game, 'capitalist', quantity * price);
}
