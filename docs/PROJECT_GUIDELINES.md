PROJECT GUIDELINES — DO NOT DEVIATE
Authoritative Architecture Contract for Firebase Studio Prototyper
Applies to ALL Code Generation, Refactors, and Feature Additions
1. Project Philosophy

This application is a local-first, file-based stormwater analytics system built on:

Next.js + React + TypeScript

Tailwind CSS + ShadCN UI

Local filesystem storage (JSON + CSV)

No network dependencies

No Firestore, Storage, or Cloud Functions

No backend database

No ongoing cloud costs

All logic runs in server actions or the browser

The prototyper must never introduce Firebase services unless explicitly instructed.

2. Absolute Rules (Non-Negotiable)
2.1 No Firestore / No Firebase Storage

DO NOT create Firestore collections

DO NOT write Firebase rules

DO NOT add Firebase storage uploads

DO NOT import Firestore or Storage SDKs

All data lives locally under the /data folder.

2.2 Do Not Change the File-Based Database Structure

The app relies on a stable local folder structure:

/data/
  assets.json
  deployments.json
  /sourcefiles/
  /processed/{deploymentId}/data.json
  /processed/{deploymentId}/events.json
  /processed/{deploymentId}/diagnostics.json
/staged/


The prototyper must NOT alter:

folder names

file names

JSON shapes

processing paths

unless the human developer explicitly instructs it to.

2.3 Diagnostics Logic Must Remain in Pure TypeScript

All stormwater analytics (hydrograph analysis, feature extraction, rules engine) are located in:

src/lib/diagnostics/


The prototyper MUST:

Keep all logic pure + synchronous

Avoid database calls

Avoid fetch/net operations

Keep code deterministic

Diagnostics runs solely off:

{
  wl: number[],
  rain: number[],
  timestamps: string[],
  eventIds: number[],
  permanentPool: number,
  designDrawdown: number
}

3. Required Directory Structure

The project MUST maintain the following layout:

src/
  app/
    actions.ts              <-- server actions (file operations, triggers)
    page.tsx                <-- dashboard
    asset-management/...
  components/dashboard/
    PerformanceChart.tsx
    DiagnosticsPanel.tsx    <-- UI for diagnostics results
    EventList.tsx
  lib/
    diagnostics/            <-- diagnostics engine (pure TS)
      index.ts
      types.ts
      feature-extractor.ts
      rules-engine.ts
      ruleset.json
    report-generator.ts     <-- PDF creation
    file-utils.ts           <-- local file read/write helpers
data/
  assets.json
  deployments.json
  sourcefiles/
  processed/
  staged/
staged/


The prototyper should never restructure this.

4. Data Flow Rules
4.1 Upload Workflow (Required)

User uploads a CSV

File is placed into /staged/

User assigns file to a deployment via UI

actions.ts processes it into:

/data/sourcefiles/{filename}.csv
/data/processed/{deploymentId}/data.json
/data/processed/{deploymentId}/events.json


Must remain unchanged.

4.2 Analysis Workflow

After processing, actions.ts must call:

const diagnostics = runDiagnostics({
  wl,
  rain,
  timestamps,
  eventIds,
  permanentPool,
  designDrawdown
});


This generates:

/data/processed/{deploymentId}/diagnostics.json

4.3 Report Generation Workflow

Reports are created client-side using:

jsPDF

html2canvas

The prototyper must NOT change report generation to server-side or Firestore-based storage.

5. UI & Styling Rules
5.1 UI Framework

Must use Next.js App Router

Must use TailwindCSS

Must use ShadCN UI components

Must adhere to the established visual style

Never introduce MUI, Chakra, Bootstrap, or custom CSS frameworks.

5.2 Diagnostics Panel

All diagnostic engine output MUST be shown in:

src/components/dashboard/DiagnosticsPanel.tsx


Rules:

Show top 1–3 diagnoses with confidence bars

Show per-event metrics in a compact list

DO NOT implement charts here (charts exist in PerformanceChart.tsx)

Must be easily printable in the PDF report

6. Code Safety & Stability Rules

To prevent accidental breakage:

6.1 Never Remove or Modify Existing Keys in JSON data

If something must change, the prototyper must:

Add new keys (non-breaking)

Maintain backward compatibility

Leave existing arrays/objects untouched

6.2 Never Perform Breaking Changes Without Explicit Human Approval

Breaking changes include:

Renaming fields

Changing data types

Moving files

Restructuring directories

Removing server actions

Modifying processing pipeline logic

Altering diagnostic thresholds or rule weights

6.3 Feature Addition Must Follow These Steps

When the prototyper is asked to add a feature, it MUST:

Identify where in the directory structure the feature belongs

Extend the file-based DB storage predictably

Integrate using server actions

Avoid creating duplicate or conflicting modules

Ensure existing pages/components do not break

7. Prototyper Coding Style Guidelines
7.1 TypeScript Standards

Must use explicit types

Prefer interfaces over types

Keep all diagnostics types in diagnostics/types.ts

Use functional utilities for data processing

7.2 React Standards

Must use server actions for file IO

Must use client components for interactive UI

Must use Suspense boundaries where appropriate

Must avoid mixing server/client logic in a single file unless necessary

7.3 Separation of Concerns

UI never performs diagnostics logic

diagnostics logic never performs file I/O

server actions never contain UI logic

report generator never fetches from network

8. Future-Proofing (Without Adding Firebase Costs)

The prototyper may reference these future directions, but CANNOT implement them unless explicitly told to:

Migration to SQLite for power users

Optional Docker container deployment

Layered architecture for commercial SaaS

Multi-tenant data structures

Offline-first PWAs

Improved worker-thread performance

These ideas may be used for guidance, but NOT executed automatically.

9. Golden Rule of Development

THIS IS A LOCAL-FIRST, FILE-BASED, COST-FREE APPLICATION.
The prototyper must ONLY write code that maintains this model.
No Firebase services. No cloud costs. No persistence outside /data.
All diagnostics logic must remain pure, synchronous TypeScript.
All data processing must remain predictable, deterministic, and offline.

End of Guidelines

This document MUST be referenced by the prototyper before making any code changes.