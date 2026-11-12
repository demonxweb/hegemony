import json
from pathlib import Path

out = Path(__file__).resolve().parents[1] / 'data'
out.mkdir(parents=True, exist_ok=True)
components = {
    'game_board': 1, 'player_boards': 4, 'player_aids': 5, 'rule_aids': 4,
    'cloth_bag': 1, 'transparent_markers': 42, 'free_trade_zone': 1, 'storage_tiles': 6,
    'regular_cards': {'working_actions': 40, 'middle_actions': 40, 'capitalist_actions': 40,
                      'state_actions': 40, 'capitalist_companies': 28, 'public_companies': 12,
                      'middle_companies': 17, 'cooperative_farms': 2, 'exports': 16,
                      'agendas': 10, 'events': 25},
    'small_cards': {'immigration': 25, 'business_deals': 20, 'loans': 10},
    'tokens': {'food': 24, 'luxury': 26, 'health': 26, 'education': 26, 'vote': 4,
               'welfare': 2, 'machinery': 6, 'demonstration': 1, 'strike': 7,
               'legitimacy': 18, 'money': 82},
    'wooden': {'working_workers': 48, 'middle_workers': 42, 'voting_cubes': 75,
               'influence': 35, 'scoring': 4, 'bills': 12, 'wealth': 1, 'prosperity': 2,
               'policy': 7, 'legitimacy_tracks': 3, 'round': 1, 'tax_multiplier': 1},
    'resource_denominations': {'food': {'1': 10, '3': 9, '5': 5},
                               **{r: {'1': 12, '3': 9, '5': 5} for r in ['luxury', 'health', 'education']}},
    'unknown_splits': ['workers_by_skill_and_class', 'voting_cubes_by_class',
                       'legitimacy_tokens_by_class', 'money_by_denomination']
}
roles = ['working', 'middle', 'capitalist', 'state']
data = {
    'rules_version': '1.2',
    'source': r'D:\download\Hegemony-English-Rulebook-v1.2.pdf',
    'scope': '4-player base game',
    'status': 'incomplete_content_database_not_playable',
    'components': components,
    'rounds': 5, 'turns_per_role_per_round': 5,
    'turn_order': roles, 'production_order': roles[::-1],
    'phases': ['preparation', 'action', 'production', 'elections', 'scoring'],
    'production_steps': ['produce_and_pay_wages', 'cover_needs', 'check_imf', 'pay_taxes'],
    'setup': {'policies': ['C', 'B', 'A', 'B', 'C', 'B', 'B'], 'tax_multiplier': 5,
              'treasury': 120, 'public_resources': {'health': 6, 'education': 6, 'influence': 4},
              'voting_bag': {'working': 8, 'middle': 8, 'capitalist': 8},
              'cash': {'working': 30, 'middle': 40, 'capitalist_revenue': 120, 'capitalist_capital': 0},
              'hand_size': 7, 'personal_influence_each_role': 1,
              'workers': {'working': 10, 'middle': 10},
              'starting_population': {'working': 3, 'middle': 3},
              'state_legitimacy_start_position': 2,
              'initial_business_deals': 1, 'initial_exports': 1, 'initial_events': 2,
              'initial_agendas': 1},
    'policies': {
        'fiscal': {'A': {'public_count': 9, 'imf_loan_threshold_inclusive': 2},
                   'B': {'public_count': 6, 'imf_loan_threshold_inclusive': 2},
                   'C': {'public_count': 3, 'imf_loan_threshold_inclusive': 1}},
        'minimum_wage_level': {'A': 3, 'B': 2, 'C': 1},
        'tax_multiplier_base': {'A': 3, 'B': 2, 'C': 1},
        'tax_multiplier_welfare_factor': {'A': 2, 'B': 1, 'C': 0},
        'welfare_modifier': {'A': 2, 'B': 1, 'C': 0},
        'public_health_and_education_price': {'A': 0, 'B': 5, 'C': 10},
        'foreign_trade': {'A': {'food_tariff': 10, 'luxury_tariff': 6, 'deals_on_preparation': 0},
                          'B': {'food_tariff': 5, 'luxury_tariff': 3, 'deals_on_preparation': 1},
                          'C': {'food_tariff': 0, 'luxury_tariff': 0, 'deals_on_preparation': 2}},
        'immigration_extra_each_class': {'A': 0, 'B': 1, 'C': 2}},
    'income_tax': {'source_page': 17, 'rows_labor_columns_taxation': {
        'A': {'A': 7, 'B': 6, 'C': 5}, 'B': {'A': 4, 'B': 4, 'C': 4},
        'C': {'A': 1, 'B': 2, 'C': 3}}},
    'corporate_tax': {'source_page': 20, 'brackets': [
        {'min': 0, 'max': 4, 'A': None, 'B': None, 'C': None, 'status': 'not_listed_in_source_table'},
        *[dict(zip(['min', 'max', 'A', 'B', 'C'], row)) for row in
          [(5, 9, 1, 2, 2), (10, 24, 5, 5, 4), (25, 49, 12, 10, 7),
           (50, 99, 24, 15, 10), (100, 199, 40, 30, 20),
           (200, 299, 100, 70, 40), (300, None, 160, 120, 60)]]]},
    'wealth': {'source_page': 21, 'thresholds': [0, 10, 25, 50, 75, 100, 125, 150,
               175, 200, 250, 300, 350, 400, 450, 500], 'vp': list(range(16)),
               'bonus_per_new_high_space': 3},
    'end_policy_vp_by_match_count': {'working': [0, 1, 4, 8, 12, 18],
                                    'capitalist': [0, 1, 4, 8, 12, 18],
                                    'middle': [0, 1, 3, 6, 10, 15]},
    'loans': {'principal': 50, 'preparation_interest': 5, 'free_action_repay': 50,
              'endgame_repay_non_capitalist': 55, 'endgame_unpaid_unit': 5,
              'endgame_penalty_per_unpaid_unit': 1, 'capitalist_endgame_penalty_per_loan': 5,
              'voluntary_borrowing_allowed': False},
    'imf': {'source_page': 33, 'forced_policies': {'1': 'C', '2': 'C', '3': 'A', '4': 'B', '5': 'C', '6': 'B', '7': 'B'},
            'forced_wage_level': 1,
            'income_tax_uses_labor_policy_at_wage_payment': True},
    'limits': {'capitalist_companies': 12, 'middle_companies': 8,
               'capitalist_market': 4, 'middle_market': 3,
               'capitalist_storage': {'food': 8, 'luxury': 12, 'health': 12, 'education': 12},
               'middle_storage': {'food': 8, 'luxury': 8, 'health': 8, 'education': 8},
               'free_trade_zone_capacity': {'food': 8, 'luxury': 12}, 'money_unlimited': True,
               'other_components_finite': True},
    'catalog_file': 'hegemony-base-catalog.json',
    'content_gate': {'allow_original_game_start': False,
                     'reason': 'Catalog indexed; full effect execution, component breakdowns and edition rulings are pending.'}
}
assert sum(components['regular_cards'].values()) == 270
assert sum(components['small_cards'].values()) == 55
assert sum(components['tokens'].values()) == 222
assert sum(components['wooden'].values()) == 231
assert len(data['wealth']['thresholds']) == len(data['wealth']['vp'])
(out / 'hegemony-v1.2-data.json').write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
print('Verified totals: 270 regular cards, 55 small cards, 222 tokens, 231 wooden components.')
print('Generated JSON with explicit unknown fields and blocked original-game start.')
