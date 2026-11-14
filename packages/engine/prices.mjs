import base from '../../data/hegemony-v1.2-data.json' with { type: 'json' };
import catalog from '../../data/hegemony-base-catalog.json' with { type: 'json' };
import { requireRule } from './errors.mjs';

export const domesticPriceLevels = catalog.boards.domesticPrices;
const domesticPrices = Object.fromEntries(Object.entries(domesticPriceLevels.capitalist).map(([resource, levels]) => [resource, levels[1]]));
const importBase = { food: 10, luxury: 6 };
const sellers = ['middle', 'capitalist', 'state', 'foreign'];
const resources = [...Object.keys(domesticPrices), 'influence'];

export function marketQuote(game, seller, resource) {
  if (seller === 'foreign' && Object.hasOwn(importBase, resource)) {
    const override = game.testImports?.[resource];
    const priceBeforeTariff = override?.base ?? importBase[resource];
    const tariff = override?.tariff ?? base.policies.foreign_trade[game.policies[5]][`${resource}_tariff`];
    return { price: priceBeforeTariff + tariff, stock: null, base: priceBeforeTariff, tariff };
  }
  if (seller === 'state') {
    const policy = resource === 'health' ? 3 : resource === 'education' ? 4 : null;
    const price = policy !== null ? base.policies.public_health_and_education_price[game.policies[policy]]
      : resource === 'influence' ? 10 : Object.hasOwn(domesticPrices, resource) ? domesticPrices[resource] : undefined;
    if (price !== undefined) return { price, stock: game.publicServices[resource] ?? 0 };
  }
  if (['middle', 'capitalist'].includes(seller) && Object.hasOwn(domesticPrices, resource)) {
    return { price: game.economy.domesticPrices?.[seller]?.[resource] ?? domesticPrices[resource], stock: game.economy.inventory[seller][resource] };
  }
  return null;
}

export function adjustPrices(game, role, prices) {
  requireRule(role === 'middle' || role === 'capitalist', '只有中產與資本家可調整國內售價。');
  requireRule(prices && typeof prices === 'object' && !Array.isArray(prices), '請選擇要調整的資源與售價。');
  const entries = Object.entries(prices);
  const allowed = domesticPriceLevels[role];
  requireRule(entries.length && entries.every(([resource, price]) => Object.hasOwn(allowed, resource)
    && allowed[resource].includes(price) && marketQuote(game, role, resource).price !== price), '請選擇圖板上的不同售價。');
  const pricesByRole = game.economy.domesticPrices ??= {};
  pricesByRole[role] = { ...pricesByRole[role], ...prices };
}

export function marketPrices(game) {
  return Object.fromEntries(sellers.map(seller => [seller, Object.fromEntries(resources.flatMap(resource => {
    const quote = marketQuote(game, seller, resource);
    return quote ? [[resource, quote]] : [];
  }))]));
}
