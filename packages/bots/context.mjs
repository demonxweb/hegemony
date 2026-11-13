import { applyCommand, playerView } from '../engine/game.mjs';
import { defaultCandidates } from './phases.mjs';
import { pendingActors } from './turn.mjs';

function attempt(game, command, as) {
  try {
    // 引擎會把命令裡的陣列留在狀態裡並在後續步驟中修改（例如公營企業雇用），
    // 所以試跑一律用複製的命令，避免弄壞之後真正要送出的那一份。
    applyCommand(game, as, structuredClone(command), true);
    if (game.transaction) applyCommand(game, game.transaction.role, { type: 'transaction-confirm' }, true);
    return true;
  } catch {
    return false;
  }
}

// 在複本上套用命令後，若接著仍輪到同一席位做後續選擇（抽牌選擇、政策調整等），
// 確認預設候選能走完；避免打出一張之後卡在沒有合法後續的狀態。
// 這些階段由剛打出的行動直接引發，後續須有人完成；其他階段（投票、生產…）預設一定走得完。
const followUps = ['card-choice', 'event-hire', 'event-choice', 'policy-choice'];

function continuesCleanly(game) {
  for (let step = 0; step < 12; step++) {
    if (!followUps.includes(game.phase)) return true;
    const [actor] = pendingActors(game);
    const view = playerView(game, actor);
    // 收回卡牌不算往前走，否則會一直打出、收回同一張牌。
    const candidates = defaultCandidates({ role: actor, view, phase: game.phase }).filter(command => !command.option?.startsWith('cancel-'));
    // 失敗的命令可能已改動狀態，所以每個候選都先在新複本上試，成功的再套用到 game。
    const command = candidates.find(item => attempt(structuredClone(game), item, actor));
    if (!command) return false;
    attempt(game, command, actor);
  }
  return false;
}

// AI 只能看到該席位的私人視圖，並可在遊戲複本上試跑命令確認是否合法。
export function createContext(game, role) {
  const view = playerView(game, role);
  return {
    role,
    view,
    phase: view.phase,
    // 命令本身合法，且後續的強制選擇也走得完。不改動真實狀態，也不消耗亂數序列。
    tryCommand(command, as = role) {
      // 複本帶著自己的亂數狀態，試跑不會影響真實遊戲的抽牌順序。
      const copy = structuredClone(game);
      return attempt(copy, command, as) && continuesCleanly(copy);
    },
    // 回傳候選清單中第一個合法的命令；都不合法則回傳 null。
    firstValid(candidates, as = role) {
      return candidates.find(command => this.tryCommand(command, as)) ?? null;
    },
  };
}
