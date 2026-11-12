"""Build normalized base-game data from the cited catalog and local effect notes."""

import argparse
from html.parser import HTMLParser
import json
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
SOURCE = 'https://www.ludex.dev/hegemony/cards/'
OFFICIAL = 'https://hegemonicproject.com/wp-content/uploads/2023/04/Hegemony-English-Rulebook-v1.2.pdf'
SECTIONS = {'working': 'Working Class', 'middle': 'Middle Class', 'capitalist': 'Capitalist Class', 'state': 'State'}
INDUSTRIES = {'agriculture': 'food', 'luxury': 'luxury', 'healthcare': 'health', 'health': 'health',
              'education': 'education', 'media': 'influence', 'unskilled': 'any'}
RESOURCE_NAMES = {'food': '食物', 'luxury': '奢侈品', 'health': '醫療', 'education': '教育', 'influence': '影響力'}
COMPANY_NAMES = '''Supermarket|超市
Shopping Mall|購物中心
College|學院
Clinic|診所
Fish Farm|養魚場
Vegetable Farm|蔬菜農場
Fast Food Chain|連鎖速食店
Automated Grain Farm|自動化穀物農場
Automated Dairy Farm|自動化乳牛場
Stadium|體育場
Hotel|旅館
Fashion Company|時尚公司
Electronics Manufacturer|電子製造商
Car Manufacturer|汽車製造商
Pharmaceutical Company|製藥公司
Medical Village|醫療園區
Hospital|醫院
Institute of Technology|理工學院
University|大學
Academy|專科學院
TV Station|電視台
Publishing House|出版社
Lobbying Firm|遊說公司
Radio Station|電台
Convenience Store|便利商店
Doctor's Office|醫師診所
Organic Farm|有機農場
Fast Food Restaurant|速食餐廳
Game Store|遊戲商店
Electronics Store|電子產品店
Jewelry Store|珠寶店
Medical Laboratory|醫學實驗室
Pharmacy|藥局
Tutoring Company|補習公司
Private School|私立學校
Training Center|訓練中心
Local Newspaper|地方報社
Regional Radio Station|區域電台
PR Agency|公關公司
Public Hospital|公立醫院
Public University|公立大學
Regional TV Station|地方電視台
University Hospital|大學醫院
Technical University|技術大學
National Public Broadcasting|全國公共廣播
Cooperative Farm|合作農場'''
COMPANY_NAMES = dict(line.split('|') for line in COMPANY_NAMES.splitlines())


class SourceTables(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.section = None
        self.heading = None
        self.row = None
        self.cell = None
        self.picture = None
        self.sections = {}
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'h3':
            self.heading = []
        elif tag == 'tr':
            self.row = []
        elif tag == 'td' and self.row is not None:
            self.cell = []
            self.picture = None
        elif tag == 'img' and self.cell is not None:
            alt = attrs.get('alt', '')
            src = attrs.get('src', '')
            if not self.row and src.startswith('https://img.ludex.dev/'):
                self.picture = {'name': alt, 'url': src}
            elif self.row and alt:
                self.cell.append(f'[{alt}]')

    def handle_data(self, value):
        if self.heading is not None:
            self.heading.append(value)
        if self.cell is not None:
            self.cell.append(value)

    def handle_endtag(self, tag):
        if tag == 'h3' and self.heading is not None:
            self.section = ''.join(self.heading).strip()
            self.heading = None
        elif tag == 'td' and self.cell is not None:
            self.row.append(self.picture or ' '.join(' '.join(self.cell).split()))
            self.cell = None
        elif tag == 'tr' and self.row is not None:
            if len(self.row) == 2 and isinstance(self.row[0], dict):
                self.sections.setdefault(self.section, []).append(self.row)
            self.row = None


def effect_notes():
    result = {}
    for line in (DATA / 'base-card-effects.zh-TW.txt').read_text(encoding='utf-8').splitlines():
        if not line or line.startswith('#'):
            continue
        if line.startswith('['):
            key = line.strip('[]')
            result[key] = {}
            continue
        name, *values = line.split('|')
        if name in result[key]:
            raise ValueError(f'Duplicate note: {key} / {name}')
        result[key][name] = values
    return result


def slug(name):
    return re.sub(r'[^a-z0-9]+', '-', name.lower().replace('’', '').replace("'", '')).strip('-')


def capture(pattern, text):
    return re.search(pattern, text, flags=re.I).group(1)


def copies(text):
    match = re.search(r'×(\d+)|\b(Two) copies\b', text)
    if not match:
        return 1
    return int(match[1]) if match[1] else 2


def entry(key, title, title_zh, count, ref, status='indexed_from_secondary_source'):
    return {'id': key, 'name': title, 'nameZh': title_zh, 'copies': count,
            'cardFaceUrl': ref['url'], 'verification': status}


def actions(rows, role, notes):
    result = []
    for ref, text in rows:
        title = ref['name'].split(': ', 1)[1]
        title_zh, effect, legitimacy = notes[title]
        req = re.search(r'Requirement\s+((?:[1-7][ABC]\s*(?:/\s*)?)+)', text)
        policies = re.findall(r'[1-7][ABC]', req[1]) if req else []
        count = copies(text.split('.', 1)[0])
        result.append({**entry(f'action-{role}-{slug(title)}', title, title_zh, count, ref, 'requirement_effect_legitimacy_face_checked'), 'role': role,
                       'policyAnyOf': policies, 'effectZh': effect, 'legitimacyZh': legitimacy or None})
    assert set(notes) == {row['name'] for row in result}, f'{role}: action notes mismatch'
    return result


def company_cards(rows, role):
    result = []
    for ref, text in rows:
        title = ref['name'].split(': ', 1)[1]
        name = title.split(' (')[0].replace('’', "'")
        suffix = ''
        starting = []
        if '2-player start' in title:
            suffix, starting = '-start-2p', [2]
        elif '3–4-player start' in title:
            suffix, starting = '-start-34p', [3, 4]
        elif '(starting)' in title:
            suffix, starting = '-start', [2, 3, 4] if role == 'capitalist' else [3, 4]
        cost = int(capture(r'cost\s+(\d+)', text))
        production = re.search(r'produces\s+(\d+)\s*\[([A-Za-z]+)\]', text, re.I)
        amount, resource = int(production[1]), production[2].lower()
        industry = capture(r'—\s*(\w+),\s*cost', text).lower()
        automated = bool(re.search(r'Automated\s*:', text))
        bonus = re.search(r'\+(\d+) with a Machinery', text)
        wages = re.search(r'\bWages?\s+(\d+)\s*/\s*(\d+)\s*/\s*(\d+)', text)
        l1_l3 = dict(zip(['L1', 'L2', 'L3'], map(int, reversed(wages.groups())))) if wages else None
        slots = []
        employee = None
        if role == 'middle':
            slots = [{'skill': INDUSTRIES[industry], 'role': 'middle'}]
            if 'Run by 2' in text:
                slots.append({'skill': 'any', 'role': 'middle'})
            match = re.search(r'employee \((?:skilled )?(\w+)\): \+(\d+) \[(\w+)\]', text)
            if match:
                employee = {'role': 'working', 'skill': INDUSTRIES[match[1].lower()],
                            'bonus': {match[3].lower(): int(match[2])}, 'wages': l1_l3}
        elif not automated:
            skill_line = capture(r'Workers:\s+([^\.]+)\.', text)
            if 'skilled' in skill_line:
                slots.append({'skill': INDUSTRIES[industry]})
            slots.extend({'skill': 'any'} for _ in range(int(capture(r'(\d+) any', skill_line))))
        result.append({**entry(f'company-{role}-{slug(name)}{suffix}', name, COMPANY_NAMES[name], copies(text), ref, 'cost_slots_production_wages_face_checked'),
                       'owner': role, 'industry': industry, 'cost': cost, 'requiredSlots': slots,
                       'optionalEmployee': employee, 'output': {resource: amount},
                       'wages': l1_l3 if role != 'middle' else None, 'automated': automated,
                       'machineryBonus': int(bonus[1]) if bonus else None, 'startingPlayerCounts': starting,
                       'eligiblePlayerCounts': starting if role == 'state' and starting else [2, 3, 4] if role != 'middle' else [3, 4]})
    return result


def export_cards(rows):
    result = []
    for number, (ref, text) in enumerate(rows, 1):
        entries = re.findall(r'\[(\w+)\]\s*(\d+)→(\d+),\s*(\d+)→(\d+)', text)
        assert {row[0].lower() for row in entries} == {'food', 'luxury', 'health', 'education'}
        offers = [{'resource': resource.lower(), 'quantity': int(amount), 'money': int(price)}
                  for resource, q1, p1, q2, p2 in entries for amount, price in [(q1, p1), (q2, p2)]]
        result.append({**entry(f'export-{number:02}', f'Export {number}', f'出口 {number}', 1, ref, 'offer_values_face_checked'), 'offers': offers})
    return result


def deals(rows):
    result = []
    for number, (ref, text) in enumerate(rows, 1):
        goods = {resource.lower(): int(quantity) for quantity, resource in re.findall(r'(\d+) \[(Food|Luxury)\]', text)}
        assert goods
        amount = int(capture(r'\bfor (\d+)', text))
        tariff = {section: int(capture(rf'\+(\d+) under 6{section}', text)) for section in 'AB'}
        result.append({**entry(f'deal-{number:02}', f'Business Deal {number}', f'商業交易 {number}', copies(text), ref, 'goods_cost_tariffs_face_checked'),
                       'goods': goods, 'cost': amount, 'tariffByForeignTrade': {**tariff, 'C': 0}})
    return result


def immigration(rows):
    result = []
    for ref, text in rows:
        working, middle = text.split(';')
        def get_skill(part):
            return 'any' if 'unskilled' in part else INDUSTRIES[capture(r'skilled (\w+)', part).lower()]
        skills = {'working': get_skill(working), 'middle': get_skill(middle)}
        key = f"immigration-{skills['working']}-{skills['middle']}"
        title = '移民 · ' + '／'.join(RESOURCE_NAMES.get(skill, '非技術') for skill in skills.values())
        result.append({**entry(key, 'Immigration', title, copies(text), ref, 'skills_face_checked'), 'skillsByRole': skills})
    return result


def board_data(base):
    common_prices = {'food': [9, 12, 15], 'luxury': [5, 8, 10], 'health': [5, 8, 10], 'education': [5, 8, 10]}
    slots = [
        ('company-capitalist-supermarket-start', 'working', ['food', 'any']),
        ('company-capitalist-shopping-mall-start', 'middle', ['luxury', 'any']),
        ('company-capitalist-college-start', 'working', ['education', 'any']),
        ('company-state-university-hospital-start-34p', 'working', ['health', 'any', 'any']),
        ('company-state-technical-university-start-34p', 'middle', ['education', 'any', 'any']),
        ('company-middle-convenience-store-start', 'middle', ['food']),
        ('company-middle-doctors-office-start', 'middle', ['health']),
    ]
    policies = base['policies']
    return {
        'components': base['components'],
        'setup4p': {**base['setup'], 'staffedCompanies': [dict(company=id, role=role, skills=skills) for id, role, skills in slots],
                    'initialWageLevel': 2, 'workingUnemployed': {'unskilled': 1, 'immigrationDraws': 2},
                    'middleUnemployed': {'chooseSkilled': 1, 'immigrationDraws': 2}},
        'boards': {
            'referenceUrls': {
                'working': 'https://img.ludex.dev/_astro/board-working.CrlbMW2W_Z1glNp5.webp',
                'middle': 'https://img.ludex.dev/_astro/board-middle.DAQtFHEc_Zx6NRG.webp',
                'capitalist': 'https://img.ludex.dev/_astro/board-capitalist.D78ahb3W_Z2mKt9.webp',
                'state': 'https://img.ludex.dev/_astro/board-state.CCDFAVUD_Z1Ult1r.webp',
            },
            'population': [{'minWorkers': 0 if value == 3 else value * 3, 'population': value} for value in range(3, 11)],
            'prosperity': {'working': list(range(11)), 'middle': [0, 1, 2, 3, 4, 5, 5, 6, 6, 7, 7]},
            'domesticPrices': {'capitalist': common_prices, 'middle': common_prices, 'state': {'food': [12], 'luxury': [8], 'influence': [10]}},
            'baseImportPrice': {'food': 10, 'luxury': 6},
            'storages': {'capitalist': base['limits']['capitalist_storage'], 'middle': base['limits']['middle_storage'],
                         'freeTradeZone': {'food': 8, 'luxury': 12}, 'publicServiceExtraCapacity': 6,
                         'storageTileMultiplier': 2},
            'legitimacy': {'range': [1, 10], 'electionInfluenceByLowest': [0, 1, 1, 2, 2, 3, 3, 4, 4, 5]},
            'wealth': base['wealth'],
        },
        'workers': {
            'working': {'total': 48, 'bySkill': {'any': 23, 'food': 5, 'luxury': 5, 'health': 5, 'education': 5, 'influence': 5},
                        'verification': 'inferred_from_BGA_2p_opening_and_official_total'},
            'middle': {'total': 42, 'bySkill': None, 'verification': 'official_total_only'},
            'skillColor': {'any': 'gray', 'food': 'green', 'luxury': 'blue', 'health': 'white', 'education': 'orange', 'influence': 'purple'},
            'preparationBase': {'working': {'unskilled': 2}, 'middle': {'unskilled': 1, 'chooseSkilled': 1}},
            'immigrantsByPolicy7': policies['immigration_extra_each_class'],
            'assignment': {'maxWorkersPerOrdinaryAction': 3, 'generalSlotsAcceptAnySkill': True,
                           'skilledSlotsRequireMatchingSkill': True, 'publicAndCapitalistSlotsRequireSameClass': True,
                           'commitNewWorkersUntilProduction': True},
        },
        'tokenBreakdowns': {
            'votingCubesByClass': {'working': 25, 'middle': 25, 'capitalist': 25},
            'votingCubesVerification': 'BGA_tutorial_opening_and_official_total',
            'moneyDenominations': [1, 5, 10, 20, 50, 100], 'moneyCountByDenomination': None,
            'legitimacyMarkersByClass': None,
        },
        'marketSizes': {'capitalist': 4, 'middle': 3, 'capitalistBoardLimit': 12, 'middleBoardLimit': 8, 'events': 2,
                        'exportCardsOnBoard': 1, 'businessDealsByPolicy6': {section: values['deals_on_preparation'] for section, values in policies['foreign_trade'].items()}},
        'marketRules': {
            'companyMarketRoles': ['capitalist', 'middle'],
            'companyMarketRefresh': 'discard_any_and_draw_to_market_size_during_preparation',
            'ordinaryPurchase': {'resourcesPerAction': 1, 'maxSources': 2, 'maxUnitsPerSource': 'population', 'middleOwnStorageCountsAsSource': True},
            'coverNeeds': {'rolesInOrder': ['middle', 'working'], 'units': 'population', 'useOwnFoodFirst': True, 'maxSources': None},
            'ordinaryImport': {'basePricePayee': 'supply', 'tariffPayee': 'state'},
            'businessDeal': {'role': 'capitalist', 'tariffExemptIfEntirePurchaseGoesToFreeTradeZone': True, 'freeTradeZoneExportOnly': True},
            'export': {'maxUsesOfEachOfferPerAction': 1, 'middleVpPerTransaction': 1, 'stateEligibleResources': ['food', 'luxury']},
        },
        'phaseOrder': {
            'preparation': ['advance_round', 'pay_loan_interest', 'drop_prosperity', 'reveal_events_and_agenda',
                            'draw_action_cards', 'refresh_company_markets', 'reveal_business_deals_and_export', 'add_workers_and_update_population'],
            'production': base['production_steps'], 'elections': ['refill_bag_and_state_influence', 'resolve_bills_by_policy_number'],
            'scoring': ['trade_unions', 'middle_prosperity', 'capitalist_wealth', 'event_penalties', 'state_legitimacy', 'state_agenda'],
        },
        'policies': [
            dict(id=1, nameZh='財政', sections=policies['fiscal']),
            dict(id=2, nameZh='勞動市場', sections={section: {'minimumWageLevel': level} for section, level in policies['minimum_wage_level'].items()}),
            dict(id=3, nameZh='稅制', sections={section: {'baseMultiplier': rate, 'welfareFactor': policies['tax_multiplier_welfare_factor'][section]} for section, rate in policies['tax_multiplier_base'].items()}),
            *[dict(id=id, nameZh=title, sections={section: {'price': price, 'taxModifier': policies['welfare_modifier'][section]} for section, price in policies['public_health_and_education_price'].items()})
              for id, title in [(4, '醫療與福利'), (5, '教育')]],
            dict(id=6, nameZh='外貿', sections=policies['foreign_trade']),
            dict(id=7, nameZh='移民', sections={section: {'additionalImmigrantsPerClass': count} for section, count in policies['immigration_extra_each_class'].items()}),
        ],
        'taxes': {'income': base['income_tax'], 'corporate': base['corporate_tax']},
        'imf': base['imf'], 'endPolicyVp': base['end_policy_vp_by_match_count'],
    }


def build(html):
    sections = SourceTables(html).sections
    notes = effect_notes()
    base = json.loads((DATA / 'hegemony-v1.2-data.json').read_text(encoding='utf-8'))
    decks = {f'{role}Actions': actions(sections[f'{label} Action cards'], role, notes[role]) for role, label in SECTIONS.items()}
    decks.update({f'{role}Companies': company_cards(sections[section], role) for role, section in
                  [('capitalist', 'Capitalist Class Companies'), ('middle', 'Middle Class Companies'), ('state', 'Public Companies')]})
    farm = sections['Cooperative Farm'][0][0]
    decks['cooperativeFarms'] = [{**entry('company-working-cooperative-farm', 'Cooperative Farm', '合作農場', 2, farm, 'slots_output_face_checked'),
                                 'owner': 'working', 'industry': 'agriculture', 'cost': None, 'requiresActionCard': True,
                                 'requiredSlots': [{'role': 'working', 'skill': 'any'} for _ in range(3)], 'output': {'food': 2},
                                 'wages': None, 'optionalEmployee': None, 'automated': False, 'machineryBonus': None,
                                 'startingPlayerCounts': [], 'eligiblePlayerCounts': [2, 3, 4]}]
    decks['exports'] = export_cards(sections['Export cards'])
    decks['businessDeals'] = deals(sections['Business Deal cards'])
    decks['immigration'] = immigration(sections['Immigration cards'])
    decks['agendas'] = [{**entry(f'agenda-{number:02}', ref['name'], f'政治綱領 {number}', 1, ref, 'targets_face_checked'),
                         'targets': {policy: target for policy, target in re.findall(r'([1-5])([ABC])', text)}}
                        for number, (ref, text) in enumerate(sections['Political Agenda cards'], 1)]
    decks['events'] = []
    for ref, _ in sections['Event cards']:
        title = ref['name'].split(': ', 1)[1]
        zh, task, reward, penalty = notes['events'][title]
        classes = [role for role, name in [('working', '勞工'), ('middle', '中產'), ('capitalist', '資本家')] if name in penalty]
        penalty_spec = {'legitimacyDelta': -1, 'roles': classes, 'chooseFromAll': 2 if not classes else None}
        decks['events'].append({**entry(f'event-{slug(title)}', title, zh, 1, ref, 'task_reward_penalty_face_checked'),
                                'taskZh': task, 'rewardZh': reward, 'unresolvedPenaltyZh': penalty,
                                'unresolvedPenalty': penalty_spec, 'minimumRound': None})
    assert set(notes['events']) == {event['name'] for event in decks['events']}
    decks['loans'] = [{**entry('loan', 'Loan', '貸款', 10, sections['Loans'][0][0], 'principal_face_checked_terms_from_rulebook'), 'terms': base['loans']}]

    expected = {'workingActions': 40, 'middleActions': 40, 'capitalistActions': 40, 'stateActions': 40,
                'capitalistCompanies': 28, 'middleCompanies': 17, 'stateCompanies': 12, 'cooperativeFarms': 2,
                'exports': 16, 'businessDeals': 20, 'immigration': 25, 'agendas': 10, 'events': 25, 'loans': 10}
    counts = {deck: sum(card['copies'] for card in cards) for deck, cards in decks.items()}
    assert counts == expected, (counts, expected)
    ids = [card['id'] for cards in decks.values() for card in cards]
    assert len(ids) == len(set(ids)), 'Duplicate card identifiers'
    assert all(len(card['targets']) == 5 for card in decks['agendas'])
    assert sum(card['copies'] for card in decks['stateCompanies'] if 4 in card['eligiblePlayerCounts']) == 9
    board = board_data(base)
    assert all(item['company'] in ids for item in board['setup4p']['staffedCompanies'])
    return {'schemaVersion': 1, 'scope': 'base game v1.2, with four-player setup', 'source': SOURCE, 'officialRules': OFFICIAL,
            'reviewedOn': '2026-11-09',
            'editionReview': 'Complete inventory; card effects are reference summaries pending implementation and edition-specific rulings.',
            'unresolvedFields': ['eventMinimumRoundForSpecificPrinting', 'middleWorkersBySkill', 'legitimacyTokensByClass',
                                 'moneyTokensByDenomination', 'corporateTaxRevenue0To4', 'endgameVoteCubeScope'],
            'counts': counts, 'distinctRecords': len(ids), 'physicalCards': sum(counts.values()), 'decks': decks,
            'playerAids': [{'name': ref['name'], 'referenceUrl': ref['url']} for ref, _ in sections['Player aids']],
            **board}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--html', required=True, type=Path, help='Local saved HTML from the cited Ludex card catalog')
    args = parser.parse_args()
    catalog = build(args.html.read_text(encoding='utf-8-sig'))
    (DATA / 'hegemony-base-catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"Validated {catalog['distinctRecords']} unique records and {catalog['physicalCards']} physical cards.")
