HOLISTIC INSTRUCTIONS FOR AN AI CODING AGENT: STORMWATER POND PERFORMANCE ANALYSIS RULESET
1. Purpose

Create an automated analytic engine that ingests water-level vs time data and rainfall data, identifies characteristic performance patterns, and outputs diagnostic classifications of likely issues affecting a stormwater pond.

The system should distinguish among:

Asset-related issues (structural/mechanical)

Environmental / biological issues

Hydraulic boundary conditions

Operational / human-caused issues

and should support multiple simultaneous causes.

2. Required Inputs

The agent must support the following input files:

2.1 Time Series Inputs

Water level dataset

Columns: DateTime, WaterLevel_m

5–15 min interval recommended

Rainfall dataset

Columns: DateTime, Rain_mm

Supports instantaneous or cumulative accumulation formats

Design parameters (structured metadata)

PermanentPoolElevation_m

NormalDrawdownTime_hr (e.g., 24–72h)

OutletInvert_m

SpillwayCrestElev_m

Optional input metadata

Sensor elevation offset

Event segmentation rules (e.g., rainfall gap > 6 hr = new event)

3. Pre-Processing Requirements

The agent must:

3.1 Time Alignment

Resample both datasets to a unified time interval (e.g., 5 min).

Forward-fill rainfall values if cumulative.

Ensure monotonic DateTime.

3.2 Derive Variables

dWL_dt = first derivative of water level (slope)

EventID = unique ID assigned to each rainfall-induced event

PeakWL_perEvent

DrawdownDuration_perEvent

WL_BaselineTrend (long-term trend between events using a smoothed series)

3.3 Event Segmentation

Define a rain event as:

Rain > 0.5 mm, OR

Rain accumulation increasing

New event starts after ≥ 6 hours with no rain

4. Hydrograph Pattern Extraction

For each event:

4.1 Rising Limb Metrics

Time from first rainfall to noticeable WL rise

Ratio of rainfall depth to WL peak height

Rising slope steepness vs typical expected

4.2 Peak Stage Metrics

Compare peak WL to expected (based on rainfall depth)

Compare peak WL to spillway crest

Flag abnormally high peaks

4.3 Drawdown Limb Metrics

Calculate drawdown slope using linear or segmented regression

Compare time to return to Permanent Pool to NormalDrawdownTime

Detect two-phase drawdown (slow → fast or fast → slow)

4.4 Baseline Behavior Between Events

Compute mean WL between events

Detect trends: rising, falling, oscillating, stable

Compare baseline to Permanent Pool

5. Ruleset: Diagnostic Pattern Matching

This is the core of the agent’s logic.
Each condition below is a rule the agent should implement and return a possible diagnosis with a confidence score (0–1).

5.1 Asset-Related Issue Rules
5.1.1 Hidden leak / disjointed pipe / berm seep

Conditions:

Baseline WL below PermanentPoolElevation by > X cm (threshold configurable)

Drawdown slope steeper than typical after most events

WL continues to fall below permanent pool after returning
Confidence scoring:

+0.4 if drawdown consistently steeper

+0.4 if baseline consistently low

+0.2 if baseline trending downward
Output: "Likely leak/seep/disjointed pipe".

5.1.2 Valve left open / oversized underdrain

Conditions:

Drawdown from peak is extremely steep (e.g., > 2× design)

Baseline WL sits near minimum recorded level

Storms produce only short-lived peaks
Output: "Possible open valve or oversized low outlet".

5.1.3 Outlet orifice partially blocked

Conditions:

Peak WL consistently higher than expected for given storm sizes

Drawdown slope shallower than expected

Pond requires long time to draw down

Rising limb normal
Output: "Likely blocked orifice / obstruction inside outlet".

5.1.4 Valve incorrectly throttled (too closed)

Conditions:

Same as above but chronic (multiple consecutive events)

Sustained WL > Permanent pool
Output: "Outlet valve likely set too low (too closed)".

5.2 Environmental / Biological Issue Rules
5.2.1 Vegetation or algae clogging outlet

Conditions:

Drawdown slope shallow

Peak WL moderately elevated

Two-phase recession (very slow → faster)

Seasonal correlation (stronger in warm months)
Output: "Vegetation or algae clogging outlet".

5.2.2 Beaver activity

Conditions:

Baseline WL steadily rising over days/weeks

Peak WL compressed near a single “ceiling” elevation

Abrupt drop (dam breach) produces vertical hydrograph drop
Output: "Possible beaver dam at or downstream of outlet".

5.2.3 Animal burrows causing seep

Conditions:

Drawdown slope steeper than design

Baseline WL below Permanent Pool

Step-like drops at specific elevations
Output: "Possible muskrat/groundhog burrow causing seep".

5.2.4 High evapotranspiration (seasonal vegetation uptake)

Conditions:

Baseline WL slowly decreases in summer

No correlation to event sizes

Drawdown slightly steeper in hot periods
Output: "Seasonal vegetation-driven drawdown (ET)".

5.3 Hydraulic Boundary Condition Rules
5.3.1 Downstream backwater

Conditions:

WL rises to a “cap” elevation close to outlet invert or downstream grade

Recession curve flat until downstream level falls

Strong correlation with large regional storms
Output: "Downstream backwater affecting outlet performance".

5.3.2 Upstream bypass reducing inflow

Conditions:

Rain events show muted WL response

Rising limb delayed or absent

Drawdown normal when it does happen
Output: "Possible inflow bypass or blocked inlet".

5.4 Operational / Human-Caused Issue Rules
5.4.1 Intentional seasonal drawdown

Conditions:

Sharp single-day drop (≥ 20–50 cm)

Baseline WL stays depressed for months
Output: "Operational drawdown event detected".

5.4.2 Upstream land-use changes

Conditions:

WL peak heights systematically increasing over months/years

No corresponding change in rainfall patterns
Output: "Upstream development likely increasing inflow".

6. Multi-Issue Interaction

The agent must:

Support multiple diagnostics simultaneously.

Calculate a confidence score per issue based on rule matches.

Sort results by descending confidence.

For example:

{
  "Likely leak/seep": 0.82,
  "Potential vegetation clogging": 0.41,
  "Downstream backwater": 0.18
}

7. Output Requirements

For each file processed, the agent must output:

7.1 Human-readable summary

Overview of event performance

Baseline WL behavior

Peak stage vs rainfall relationship

Drawdown duration

Flagged anomalies

Final diagnostics

7.2 Machine-readable JSON

Including:

{
  "EventSummaries": [
    {
      "EventID": 1,
      "PeakWL_m": 263.91,
      "DrawdownTime_hr": 41.3,
      "Anomalies": ["Slow drawdown", "Elevated peak"]
    }
  ],
  "BaselineTrend": "Decreasing",
  "Diagnostics": {
    "LeakSeep": 0.84,
    "VegetationClogging": 0.32,
    "Backwater": 0.06
  }
}

7.3 Diagnostic chart annotations

The agent should generate plotted hydrographs with markers for:

Rain events

Rising limb

Peak

Drawdown

Permanent pool line

Spill crest line

Annotated anomalies (“Slow drawdown”, “Fast drawdown”, “High peak”, etc.)

8. Agent Autonomy Requirements

The system must:

Attempt repairs if it encounters faulty time stamps / irregular intervals

Auto-standardize units

Auto-validate input elevations

Log uncertainty in case of insufficient data

Provide fallback rules if rainfall data is missing (“hydrograph-only mode”)