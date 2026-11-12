"""Generate the local prototype's standalone SVG cards and icons."""

from html import escape
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1] / 'assets' / 'prototype'
FONT = 'Segoe UI, Microsoft JhengHei, Noto Sans TC, sans-serif'
ICONS = {
    'food': ('食物', '#c3d876', '<path d="M7 21 17 3M13 10c-4 0-6-2-6-5 4 0 6 2 6 5Zm-3 5c-4 0-6-2-6-5 4 0 6 2 6 5Zm3-5c4 1 7-1 8-4-4-1-7 1-8 4Zm-3 5c4 1 7-1 8-4-4-1-7 1-8 4Z"/>'),
    'luxury': ('奢侈品', '#72d7ed', '<path d="m3 9 4-5h10l4 5-9 11Zm0 0h18M9 9l3 11 3-11-3-5Z"/>'),
    'health': ('醫療', '#ff8a89', '<path d="M12 20 4 12C-1 7 6 1 12 7c6-6 13 0 8 5Z"/><path d="M6 12h3l2-3 2 5 2-2h3"/>'),
    'education': ('教育', '#ffc17b', '<path d="m2 9 10-5 10 5-10 5Zm4 2v6c4 3 8 3 12 0v-6m4-2v7"/>'),
    'influence': ('影響力', '#d7a2f2', '<path d="M4 4h16v12h-8l-5 4v-4H4Z"/><path d="M8 9h8m-8 3h5"/>'),
    'money': ('金錢', '#f0c177', '<circle cx="12" cy="12" r="9"/><path d="m8 7 4 5 4-5m-4 5v5m-4-5h8m-8 3h8"/>'),
    'worker': ('工人', '#dbe3ee', '<circle cx="12" cy="6" r="3"/><path d="M5 21v-4a7 7 0 0 1 14 0v4ZM9 14v7m6-7v7"/>'),
    'vote': ('投票', '#a9c9f1', '<path d="m7 8 6-6 5 5-6 6ZM3 12l3-4m14 0 2 4v9H2v-9h5m9 0h6m-14 4h8"/>'),
    'legitimacy': ('合法性', '#b3ddd5', '<path d="M12 2 4 5v7c0 4 5 8 8 10 3-2 8-6 8-10V5Z"/><path d="m8 12 3 3 5-6"/>'),
    'machinery': ('機械', '#dbe3ee', '<path d="M12 4v3m0 10v3M4 12h3m10 0h3M6 6l2 2m8 8 2 2m0-12-2 2m-8 8-2 2"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'),
}

CARDS = [
    ('working-state-scholarship', '國家獎學金', 'State Scholarship', '行動卡 · 勞工', '#ff8a89', 'education',
     [('前提', '教育政策 5B 或 5C'), ('效果', '向國家購買最多等同人口的教育。', '整筆費用折半，向上取整。'), ('合法性', '勞工 +1')]),
    ('middle-import-subsidy', '進口補貼', 'Import Subsidy', '行動卡 · 中產', '#f0c177', 'luxury',
     [('前提', '外貿政策 6A 或 6B'), ('效果', '向外國市場購入食物或奢侈品。', '最多等同人口，免關稅。'), ('合法性', '每買 4 單位，中產 +1')]),
    ('capitalist-offshore-companies', '境外公司', 'Offshore Companies', '行動卡 · 資本家', '#72d7ed', 'money',
     [('前提', '無政策前提'), ('效果', '將營收的一半轉入資本。', '轉入金額向下取整。')]),
    ('state-pressing-matters', '緊急議案', 'Pressing Matters', '行動卡 · 國家', '#b3ddd5', 'vote',
     [('前提', '無政策前提'), ('效果', '提出一項法案。', '可免費發起即時投票。')]),
    ('company-supermarket', '超市', 'Supermarket', '企業卡 · 資本家', '#c3d876', 'food',
     [('建造成本', '16'), ('工位', '農業技術工 ×1、通用工位 ×1'), ('產出', '食物 4，機械加成 +1'), ('薪資 L1／L2／L3', '15／20／25')]),
    ('event-low-education-index', '教育指數偏低', 'Low Education Index', '事件卡 · 國家', '#d7a2f2', 'education',
     [('處理方式', '選擇勞工或中產，提供教育。', '數量為對方人口的一半，向上取整。'), ('獎勵', '所選階級合法性 +1'), ('未處理', '勞工與中產合法性各 −1')]),
]


def icon(name, color=None):
    _, default_color, shape = ICONS[name]
    return f'<g fill="none" stroke="{color or default_color}" stroke-width="1.55" stroke-linejoin="round" stroke-linecap="round">{shape}</g>'


def label(x, y, value, size, color, weight=400):
    return f'<text x="{x}" y="{y}" font-size="{size}" fill="{color}" font-weight="{weight}">{escape(value)}</text>'


def card_svg(index, title, english, category, color, symbol, sections):
    items = []
    y = 253
    for heading, *lines in sections:
        items.append(label(32, y, heading, 13, color, 700))
        for line in lines:
            y += 21
            items.append(label(32, y, line, 15, '#f0f3f8'))
        y += 26
    if y > 475:
        raise ValueError(f'Card text exceeds its content area: {title}')
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 500" role="img" aria-labelledby="title desc">
  <title id="title">{escape(title)} · {escape(category)}</title>
  <desc id="desc">{escape('。'.join('，'.join(section) for section in sections))}</desc>
  <defs>
    <linearGradient id="base" x2="0" y2="1" gradientUnits="objectBoundingBox">
      <stop stop-color="#1f2734"/><stop offset="1" stop-color="#111720"/>
    </linearGradient>
    <pattern id="grid" width="18" height="18" patternUnits="userSpaceOnUse">
      <path d="M18 0H0V18" fill="none" stroke="{color}" stroke-opacity=".17"/>
    </pattern>
  </defs>
  <rect x="1" y="1" width="338" height="498" rx="20" fill="url(#base)" stroke="{color}" stroke-width="2"/>
  <g font-family="{FONT}">
    {label(24, 34, category, 14, color, 700)}
    {label(281, 34, f'{index:02d}', 14, '#bac5d4', 700)}
    <rect x="22" y="51" width="296" height="104" rx="11" fill="#101720"/>
    <rect x="22" y="51" width="296" height="104" rx="11" fill="url(#grid)"/>
    <circle cx="170" cy="103" r="39" fill="{color}" fill-opacity=".12" stroke="{color}" stroke-opacity=".55"/>
    <path d="M47 103h70m106 0h70" stroke="{color}" stroke-opacity=".55" stroke-dasharray="3 5"/>
    <g transform="translate(145 78) scale(2.08)">{icon(symbol, color)}</g>
    {label(24, 190, title, 27, '#f7f8fa', 700)}
    {label(25, 213, english, 13, '#b9c3d0')}
    <path d="M24 228h292" stroke="{color}" stroke-opacity=".45"/>
    {''.join(items)}
    <path d="M24 460h292" stroke="#424c5c"/>
    {label(24, 481, 'HEGEMONY  /  SVG 視覺原型', 11, '#b9c3d0', 600)}
  </g>
</svg>
'''


def main():
    cards_dir = ROOT / 'cards'
    icons_dir = ROOT / 'icons'
    cards_dir.mkdir(parents=True, exist_ok=True)
    icons_dir.mkdir(parents=True, exist_ok=True)
    card_previews = []
    for index, (slug, title, *fields) in enumerate(CARDS, 1):
        (cards_dir / f'{slug}.svg').write_text(card_svg(index, title, *fields), encoding='utf-8')
        card_previews.append(f'<li><a href="cards/{slug}.svg"><img src="cards/{slug}.svg" alt="{escape(title)}"></a></li>')
    icon_previews = []
    for name, (title, _, _) in ICONS.items():
        svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img"><title>{title}</title>{icon(name)}</svg>\n'
        (icons_dir / f'{name}.svg').write_text(svg, encoding='utf-8')
        icon_previews.append(f'<li><img src="icons/{name}.svg" alt=""><span>{title}</span></li>')
    (ROOT / 'index.html').write_text(f'''<!doctype html>
<html lang="zh-Hant">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hegemony · SVG 素材預覽</title>
<style>
  body {{ margin: auto; max-width: 1100px; padding: 32px clamp(14px, 4vw, 48px); background: #10151d; color: #f0f3f8; font: 16px/1.6 {FONT}; }}
  h1 {{ margin: 0; font-size: clamp(1.6rem, 5vw, 2.5rem); }}
  h2 {{ margin: 1.5em 0 .45em; font-size: 1.25rem; }}
  p {{ color: #b9c3d0; }}
  ul {{ padding: 0; list-style: none; display: grid; gap: 16px; }}
  .cards {{ grid-template-columns: repeat(auto-fit, minmax(min(100%, 225px), 1fr)); }}
  .cards img {{ width: 100%; display: block; }}
  .icons {{ grid-template-columns: repeat(auto-fit, minmax(86px, 1fr)); }}
  .icons li {{ background: #1b2330; border-radius: 10px; padding: 12px 5px; text-align: center; }}
  .icons img {{ display: block; width: 30px; margin: 0 auto 6px; }}
  a:focus-visible {{ outline: 3px solid #fff; outline-offset: 4px; }}
  .cards a {{ display: block; border-radius: 15px; }}
</style>
<main>
  <h1>Hegemony · SVG 素材預覽</h1>
  <p>四角色行動卡、企業卡與事件卡的視覺原型。點選卡片可查看獨立 SVG。</p>
  <h2>資源與狀態圖示</h2>
  <ul class="icons">{''.join(icon_previews)}</ul>
  <h2>卡面</h2>
  <ul class="cards">{''.join(card_previews)}</ul>
</main>
</html>
''', encoding='utf-8')


if __name__ == '__main__':
    main()
