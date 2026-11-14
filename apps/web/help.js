import { actionHelpByClass, actionHelpDetails, roundPhaseHelp } from './help-content.js';

const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const paragraphs = text => text.split('\n').filter(Boolean).map(line => `<p>${escape(line)}</p>`).join('');

const phaseNames = [
  ['preparation', '1. 準備階段'], ['action', '2. 行動階段'], ['production', '3. 生產階段'],
  ['elections', '4. 選舉階段'], ['scoring', '5. 計分階段'],
];
document.getElementById('help-phases').innerHTML = phaseNames.map(([id, title]) =>
  `<article class="help-phase"><h3>${title}</h3>${roundPhaseHelp[id].map(text => `<p>${escape(text)}</p>`).join('')}</article>`).join('');

const roleClass = { 勞工: 'working', 中產: 'middle', 資本家: 'capitalist', 國家: 'state' };
const detail = action => {
  const [heading, ...rest] = actionHelpDetails[action].split('\n');
  return `<article class="help-action"><h5>${escape(heading)}</h5>${paragraphs(rest.join('\n'))}</article>`;
};
document.getElementById('help-actions').innerHTML = Object.entries(actionHelpByClass).map(([kind, classes]) =>
  `<h3>${kind}</h3>${Object.entries(classes).map(([role, actions]) =>
    `<details class="help-role ${roleClass[role]}"><summary><b>${role}</b><span>${actions.length} 項</span></summary>${[...new Set(actions)].map(detail).join('')}</details>`).join('')}`).join('');

// 從網址帶有 #cards 之類的錨點進來時，等動態內容出來後再捲動。
if (location.hash) requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView());

// 階級與資源用各自的顏色標示；資源前面加上小圖示（複合詞如「醫療福利」「教育企業」只上色、不放圖示）。
const terms = [
  ['媒體影響力', 'res-influence', 'influence'], ['個人影響力', 'res-influence', 'influence'], ['影響力', 'res-influence', 'influence'],
  ['奢侈品', 'res-luxury', 'luxury'], ['食物', 'res-food', 'food'], ['醫療', 'res-health', 'health'], ['教育', 'res-education', 'education'],
  ['現金', 'res-money', 'money'],
  ['資本家', 'role-capitalist'], ['勞工', 'role-working'], ['中產', 'role-middle'], ['國家', 'role-state'],
];
const termPattern = new RegExp(terms.map(([word]) => word).join('|'), 'g');
const compound = /^(?:福利|企業|工人|工|院|大學|牌|區|政策|倉庫)/;
function decorate(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: node => node.parentElement.closest('script, style, summary, .help-toc') || !new RegExp(termPattern.source).test(node.data)
      ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const fragment = document.createDocumentFragment();
    let last = 0;
    for (const match of node.data.matchAll(termPattern)) {
      const [, cls, icon] = terms.find(([word]) => word === match[0]);
      fragment.append(node.data.slice(last, match.index));
      const span = document.createElement('span');
      span.className = `term ${cls}`;
      const plain = compound.test(node.data.slice(match.index + match[0].length));
      if (icon && !plain) {
        const image = document.createElement('img');
        image.className = 'term-icon';
        image.src = `/assets/icons/${icon}.svg`;
        image.alt = '';
        span.append(image);
      }
      span.append(match[0]);
      fragment.append(span);
      last = match.index + match[0].length;
    }
    fragment.append(node.data.slice(last));
    node.replaceWith(fragment);
  }
}
for (const section of document.querySelectorAll('.help-section:not(#cards)')) decorate(section);
