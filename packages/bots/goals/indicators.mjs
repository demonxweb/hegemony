// 指標：把一個席位眼中的盤面（playerView）化成幾個數字。AI 比較「行動前後」的指標差，
// 就知道這個行動對哪些面向有正面或負面影響。全部只用該席位看得到的資訊。
export const indicatorLabels = {
  vp: '勝利分數', money: '資金', income: '預期收入', production: '生產力', cost: '預期支出',
  needs: '需求滿足', political: '政治影響', stock: '庫存分', debt: '貸款',
};

// 各指標一個「單位」大約多大，用來把不同單位的變化放到可比較的尺度。
export const indicatorScales = { vp: 1, money: 25, income: 10, production: 2, cost: 10, needs: 2, political: 2, stock: 1, debt: 1 };

const preferences = { working: 'A', middle: 'B', capitalist: 'C' };
const interestPerLoan = 5;
const loanPrincipal = 50;

const paidSlot = company => company.owner === 'middle' ? company.slots.find(slot => slot.optional) : company.slots[0];

function inventoryPoints(stock = {}) {
  return ['food', 'luxury', 'health', 'education'].reduce((sum, resource) => sum + Math.floor((stock[resource] ?? 0) / (resource === 'food' ? 2 : 3)), 0);
}

export function policyMatches(view, role) {
  const target = role === 'state' ? view.match?.agenda ?? [] : Array(5).fill(preferences[role]);
  return target.filter((section, index) => view.policies[index] === section).length;
}

export function indicators(view, role) {
  const me = view.players[role];
  const { economy } = view;
  const prices = view.match?.prices ?? {};
  const workers = new Map(economy.workers.map(worker => [worker.id, worker]));
  const money = role === 'state' ? view.treasury : role === 'capitalist' ? me.revenue + me.capital : me.cash;
  let income = 0;
  let wagesDue = 0;
  let production = 0;
  for (const company of economy.companies) {
    if (!company.operational) continue;
    const slot = paidSlot(company);
    const recipient = !company.strike || company.wage === 3 ? workers.get(slot?.worker)?.role : undefined;
    const wage = recipient ? company.wages?.[company.wage - 1] ?? 0 : 0;
    if (company.owner === role) {
      wagesDue += wage;
      const output = company.output + (recipient && company.employee ? company.employee.output : 0);
      production += output;
      income += output * (prices[role]?.[company.resource]?.price ?? 0);
    } else if (recipient === role) {
      income += wage;
    }
  }
  if (role === 'working') production = economy.workers.filter(worker => worker.role === role && worker.company).length;
  const loans = economy.loans[role] ?? 0;
  const population = view.match?.populations?.[role] ?? 3;
  const ownFood = me.food + (role === 'middle' ? economy.inventory.middle.food : 0);
  const needs = ['working', 'middle'].includes(role) ? -Math.max(0, population - ownFood) : 0;
  const target = role === 'state' ? view.match?.agenda ?? [] : Array(5).fill(preferences[role]);
  const aligned = view.bills.filter(bill => bill.role === role && bill.target === target[bill.policy]).length;
  const political = policyMatches(view, role) * 3 + aligned * 1.5 + me.influence * 0.5 + (view.bag?.[role] ?? 0) * 0.15;
  const stock = role === 'state' ? inventoryPoints(view.publicServices) + Math.floor((view.publicServices.influence ?? 0) / 3)
    : role === 'working' ? 0 : inventoryPoints(economy.inventory[role]);
  // 貸款：已有的筆數，加上「應付薪資超過手上資金」預期要新借的筆數（強制支出不足時會自動借貸）。
  const shortfall = Math.ceil(Math.max(0, wagesDue - money) / loanPrincipal);
  return { vp: me.vp, money, income, production, cost: wagesDue + loans * interestPerLoan, needs, political, stock, debt: loans + shortfall };
}

export function indicatorDelta(before, after) {
  return Object.fromEntries(Object.keys(before).map(key => [key, after[key] - before[key]]));
}
