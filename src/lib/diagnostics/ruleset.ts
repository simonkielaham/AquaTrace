
export type FeatureName = 'drawdownIsSteep' | 'drawdownIsShallow' | 'baselineBelowPool' | 'baselineAbovePool' | 'baselineTrend' | 'peakOverBaseline';
export type FeatureOperator = 'eq' | 'gt' | 'lt';
export type FeatureValue = boolean | 'rising' | 'falling' | 'stable' | number;

export interface DiagnosticCondition {
    feature: FeatureName;
    operator: FeatureOperator;
    value: FeatureValue;
    weight: number; // Contribution to confidence score if true
}

export interface DiagnosticRule {
    id: string;
    category: string;
    issue: string;
    conditions: DiagnosticCondition[];
    investigation: string;
}

export const rules: DiagnosticRule[] = [
    // Asset Related Issues
    {
        id: 'leak_seep',
        category: 'Asset',
        issue: 'Hidden leak / disjointed pipe / berm seep',
        conditions: [
            { feature: 'drawdownIsSteep', operator: 'eq', value: true, weight: 0.4 },
            { feature: 'baselineBelowPool', operator: 'eq', value: true, weight: 0.4 },
            { feature: 'baselineTrend', operator: 'eq', value: 'falling', weight: 0.2 },
        ],
        investigation: 'Walk berms for wet spots and boils, check toe drains, inspect outlet pipe joints, CCTV if possible, look for clear seepage pathways, check old repair notes.',
    },
    {
        id: 'valve_open',
        category: 'Asset',
        issue: 'Valve left open / oversized underdrain',
        conditions: [
            { feature: 'drawdownIsSteep', operator: 'eq', value: true, weight: 0.8 },
            { feature: 'baselineBelowPool', operator: 'eq', value: true, weight: 0.2 },
        ],
        investigation: 'Check valves on underdrains/low outlets, compare installed vs design orifice sizes, confirm actual settings vs drawings.',
    },
    {
        id: 'outlet_blocked',
        category: 'Asset',
        issue: 'Outlet orifice partially blocked internally',
        conditions: [
            { feature: 'drawdownIsShallow', operator: 'eq', value: true, weight: 0.6 },
            { feature: 'peakOverBaseline', operator: 'gt', value: 0.5, weight: 0.2 }, // peak > 0.5m
            { feature: 'baselineAbovePool', operator: 'eq', value: true, weight: 0.2 },
        ],
        investigation: 'Inspect inside riser, check for sediment build-up, measure actual orifice opening, confirm trash rack condition.',
    },
    {
        id: 'valve_throttled',
        category: 'Asset',
        issue: 'Outlet valve incorrectly set (too closed)',
        conditions: [
            { feature: 'drawdownIsShallow', operator: 'eq', value: true, weight: 0.6 },
            { feature: 'baselineTrend', operator: 'eq', value: 'rising', weight: 0.4 },
        ],
        investigation: 'Confirm valve setting vs design, check ops logs, note any recent “temporary” adjustments that never got undone.',
    },

    // Environmental Related Issues
    {
        id: 'veg_clog',
        category: 'Environmental',
        issue: 'Vegetation or algae clogging outlet',
        conditions: [
            { feature: 'drawdownIsShallow', operator: 'eq', value: true, weight: 0.7 },
        ],
        investigation: 'Inspect around structure, look for algae mats pulled into orifice, cattails and root masses at outlet, seasonal patterns (worse in summer).',
    },
    {
        id: 'beaver_activity',
        category: 'Environmental',
        issue: 'Beaver dam at outlet / downstream channel',
        conditions: [
            { feature: 'baselineTrend', operator: 'eq', value: 'rising', weight: 0.5 },
            { feature: 'drawdownIsShallow', operator: 'eq', value: true, weight: 0.5 },
        ],
        investigation: 'Look for fresh sticks/mud at culverts, gnawed trees, beaver slides, dams downstream.',
    },
    {
        id: 'animal_burrows',
        category: 'Environmental',
        issue: 'Burrowing animals causing seep',
        conditions: [
            { feature: 'drawdownIsSteep', operator: 'eq', value: true, weight: 0.5 },
            { feature: 'baselineBelowPool', operator: 'eq', value: true, weight: 0.5 },
        ],
        investigation: 'Inspect banks for burrow holes, slumping, animal activity; look for localized wet spots at toe.',
    },
];
