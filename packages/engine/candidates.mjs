// 產生「可能合法」的命令候選。是否真的合法由 ctx.tryCommand 在複本上判定，這裡只負責窮舉常見參數形狀。
export const classes = ['working', 'middle', 'capitalist'];
const pairs = [['working', 'middle'], ['working', 'capitalist'], ['middle', 'capitalist']];

// 事件處理的參數變體（不含 type）。events 為事件視圖陣列。
export function eventVariants(events) {
  const variants = [];
  for (const event of events) {
    const { kind, max } = event.form;
    const eventId = event.id;
    if (kind === 'industry') {
      // 受贈企業的雇用由收到企業的席位在 event-hire 階段完成。
      for (const company of event.form.offers ?? []) for (const recipient of ['capitalist', 'middle']) variants.push({ eventId, recipient, company });
      continue;
    }
    for (const recipient of classes) {
      for (const amount of [1, 15, 10, 25, 2, 3]) variants.push({ eventId, recipient, amount });
    }
    for (const recipients of pairs) variants.push({ eventId, recipients });
    for (const role of classes) {
      // 投票方塊事件的分配總數必須剛好等於上限；其餘事件分配 1 份即可。
      variants.push({ eventId, distribution: { [role]: max ?? 1 } });
      variants.push({ eventId, distribution: { [role]: 1 } });
    }
  }
  return variants;
}

// 打出手牌的參數變體（不含 type 與 cardId）。
export function playVariants(view) {
  return [
    {},
    { quantity: 1 },
    ...classes.map(recipient => ({ recipient })),
    ...pairs.flatMap(recipients => [{ recipients, quantity: 0 }, { recipients, quantity: 1 }]),
    ...view.availablePolicies.map(({ policy, target }) => ({ policy, target, immediate: false })),
    ...view.emergencyPolicies.map(({ policy, target }) => ({ policy, target })),
  ];
}

// 國家所有可能的主要行動候選（依建議優先順序）。AI 與「無行動可跳過」的判定共用這一份，
// 兩邊對「有沒有合法行動」的看法才不會分歧。是否合法由 applyCommand 在複本上判定。
export function stateMainCandidates(view) {
  const cardId = view.hand[0]?.id;
  const actions = eventVariants(view.content.events).map(variant => ({ type: 'event', cardId, ...variant }));
  if (view.publicServices.influence > 0) actions.push({ type: 'campaign', amount: 1, cardId });
  for (const { policy, target } of view.availablePolicies) actions.push({ type: 'propose', policy, target, immediate: false, cardId });
  if (view.players.state.influence >= 2) for (const recipient of classes) actions.push({ type: 'meet-mps', recipient, cardId });
  // 對外出口：以目前價格表中庫存足夠的交易。
  for (const offer of view.match?.exports ?? []) if (offer.available) actions.push({ type: 'export', offers: [offer.id], cardId });
  for (const card of view.hand) for (const variant of playVariants(view)) actions.push({ type: 'play', cardId: card.id, ...variant });
  const byLegitimacy = [...classes].sort((a, b) => view.legitimacy[b] - view.legitimacy[a]);
  actions.push({ type: 'extra-tax', recipients: byLegitimacy.slice(0, 2), cardId });
  return actions;
}
