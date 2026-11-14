// 風格：只是一組參數。
//   base：各目標的基礎優先程度；urgency：對盤面迫切度的敏感度（預設 1）；
//   effects：覆寫某個目標對指標的影響（沒寫的沿用 goals.mjs 的預設）。
export const goalStyles = [
  {
    id: 'balanced', name: '均衡', description: '各項目標並重，依盤面隨時調整。',
    base: { vp: 1, production: 1, income: 1, cost: 1, needs: 1, bills: 0.8 },
  },
  {
    id: 'growth', name: '擴張', description: '重視生產與收入，願意花錢與借貸擴大規模。',
    base: { vp: 0.7, production: 1.6, income: 1.4, cost: 0.4, needs: 0.9, bills: 0.5 },
    effects: { cost: { debt: -0.2 } },
  },
  {
    id: 'frugal', name: '保守', description: '重視降低成本與滿足需求，盡量不借貸。',
    base: { vp: 0.8, production: 0.7, income: 1, cost: 1.8, needs: 1.4, bills: 0.5 },
    urgency: { cost: 1.5 },
  },
  {
    id: 'political', name: '政治', description: '把法案與政策符合度放在第一，其次才是分數。',
    base: { vp: 1, production: 0.5, income: 0.7, cost: 0.7, needs: 0.9, bills: 2 },
    urgency: { bills: 1.5 },
  },
];
