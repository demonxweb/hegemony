// 讓 AI 席位自我對戰並統計結果。
//   node scripts/bot-arena.mjs [--games 20] [--seed 1] [--seats working=minimal,...]
//   node scripts/bot-arena.mjs --compare working=basic,minimal [--games 100]
//     同一批種子下，比較某席位換用策略 A 或 B（其餘席位維持 --seats 設定）的平均分差與標準誤。
import { applyCommand, createGame, roles } from '../packages/engine/game.mjs';
import { runBots } from '../packages/bots/index.mjs';

export function playGame({ seed, seats, onStep }) {
  const game = createGame({ seed });
  applyCommand(game, roles[0], { type: 'start' }, true);
  const steps = runBots(game, seats, { host: roles[0], onStep });
  return { game, steps };
}

function parseArgs(argv) {
  const options = { games: 20, seed: 1, seats: Object.fromEntries(roles.map(role => [role, 'minimal'])) };
  for (let index = 0; index < argv.length; index += 2) {
    const [flag, value] = [argv[index], argv[index + 1]];
    if (flag === '--games') options.games = Number(value);
    else if (flag === '--seed') options.seed = Number(value);
    else if (flag === '--compare') {
      const [role, strategies] = value.split('=');
      options.compare = { role, strategies: strategies.split(',') };
    } else if (flag === '--seats') Object.assign(options.seats, Object.fromEntries(value.split(',').map(item => item.split('='))));
  }
  return options;
}

if (process.argv[1]?.endsWith('bot-arena.mjs')) {
  const { games, seed, seats, compare } = parseArgs(process.argv.slice(2));
  if (compare) {
    const { role, strategies: [a, b] } = compare;
    const diffs = [];
    for (let index = 0; index < games; index++) {
      try {
        const scores = [a, b].map(strategy => {
          const { game } = playGame({ seed: seed + index, seats: { ...seats, [role]: strategy } });
          const result = game.match.final.results.find(item => item.role === role);
          return result.total ?? result.vp;
        });
        diffs.push(scores[0] - scores[1]);
      } catch (error) {
        console.error(`種子 ${seed + index} 略過：${error.message}`);
      }
    }
    const mean = diffs.reduce((sum, value) => sum + value, 0) / diffs.length;
    const variance = diffs.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, diffs.length - 1);
    const error = Math.sqrt(variance / diffs.length);
    console.log(`${role}：${a} 比 ${b} 平均${mean >= 0 ? '多' : '少'} ${Math.abs(mean).toFixed(2)} 分（標準誤 ${error.toFixed(2)}，${diffs.length} 局，z = ${(mean / (error || 1)).toFixed(1)}）`);
    process.exit(0);
  }
  const totals = Object.fromEntries(roles.map(role => [role, { vp: 0, wins: 0 }]));
  let failed = 0;
  for (let index = 0; index < games; index++) {
    try {
      const { game } = playGame({ seed: seed + index, seats });
      const results = game.match.final.results;
      const best = Math.max(...results.map(item => item.total ?? item.vp));
      for (const item of results) {
        const score = item.total ?? item.vp;
        totals[item.role].vp += score;
        if (score === best) totals[item.role].wins++;
      }
    } catch (error) {
      failed++;
      console.error(`第 ${index + 1} 局（種子 ${seed + index}）失敗：${error.message}`, error.detail ?? '');
    }
  }
  const finished = games - failed;
  console.log(`完成 ${finished}/${games} 局`);
  for (const role of roles) {
    console.log(`${role.padEnd(10)} ${seats[role].padEnd(10)} 平均 ${(totals[role].vp / Math.max(1, finished)).toFixed(1)} 分，勝 ${totals[role].wins}`);
  }
  process.exitCode = failed ? 1 : 0;
}
