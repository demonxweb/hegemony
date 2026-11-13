// 最小合法策略：只求不犯規、不卡住。非國家席位一律政治施壓；國家依序嘗試安全的行動。
import { stateMainCandidates } from '../../engine/candidates.mjs';

export default {
  id: 'minimal',
  name: '最小合法',
  description: '只求合法與不卡住：非國家席位政治施壓，國家選第一個可行的行動。',
  // 主要行動候選清單，依優先順序；runner 取第一個合法者。
  turn(ctx) {
    const { view, role } = ctx;
    if (role === 'state') return stateMainCandidates(view);
    return view.hand.slice(0, 1).map(card => ({ type: 'pressure', cardId: card.id }));
  },
  // 免費行動候選清單；最小策略不做。
  free() {
    return [];
  },
};
