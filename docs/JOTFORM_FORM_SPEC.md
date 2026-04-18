# Jotform Form Specification — Multi-Pet Behaviour Questionnaire

**Audience:** Whoever edits the Jotform forms (Dog Behaviour Questionnaire, Cat Behaviour Questionnaire).
**Purpose:** Define the QID contract the PBS Admin parser expects, so that redesigning the form to support multiple pets per submission doesn't break ingestion.

The app's parser lives in [src/lib/services/jotformService.ts](../src/lib/services/jotformService.ts). Constants near the top (`MULTI_PET_COUNT_QID`, `MULTI_PET_BLOCK_BASE`, `MULTI_PET_BLOCK_STRIDE`, `MULTI_PET_MAX`) control which QIDs the parser reads. Change those constants if you have to deviate from the layout below.

---

## Backward compatibility

**The parser supports both form versions at the same time.** When a submission comes in, the parser checks for QID `100` (the pet-count selector). If it's present, multi-pet parsing runs; if it's absent, the parser falls back to the legacy single-pet layout.

This means you can redesign the form without a migration window: old submissions in the last 30 days still get parsed correctly via the legacy path, and new submissions use the multi-pet path.

---

## Shared client fields (unchanged from legacy)

These QIDs apply to both Dog and Cat forms and should **not** be renumbered. If they change, update the parser's hardcoded QIDs in `parseSubmission`.

| QID | Field | Jotform type | Notes |
|---:|---|---|---|
| 3 | Your Name | Full Name (`control_fullname`) | Parser reads `answer.first` and `answer.last` |
| 6 | Email | Email | Required for client matching |
| 32 | Phone | Text / phone | Required for client matching fallback |
| 68 | Address | Address | Parser reads `addr_line1`, `city`, `state`, `postal` |

---

## Multi-pet layout

### Step 1 — Pet count selector

Add a new question with **QID 100**:

- **Label:** "How many pets is this questionnaire for?"
- **Type:** Dropdown
- **Values:** `1`, `2`, `3`, `4`, `5`
- **Required:** Yes

The parser reads this answer as an integer (clamped to 1–5). If the QID is missing, the parser falls back to legacy single-pet.

### Step 2 — Per-pet question blocks

Each pet occupies a **10-QID block** starting at QID 101. Reserve QIDs 101–109 for Pet 1, 111–119 for Pet 2, 121–129 for Pet 3, 131–139 for Pet 4, 141–149 for Pet 5.

Every block has the same 9 fields at the same offsets:

| Offset | QID for Pet 1 | QID for Pet 2 | QID for Pet 3 | QID for Pet 4 | QID for Pet 5 | Field | Jotform type | Notes |
|---:|---:|---:|---:|---:|---:|---|---|---|
| +0 | **101** | 111 | 121 | 131 | 141 | Pet name | Text | Required; must be distinctive enough for name-matching against existing records |
| +1 | **102** | 112 | 122 | 132 | 142 | Species | Dropdown: `Dog`, `Cat`, `Other` | Optional; defaults to form type (Dog form → Dog) |
| +2 | **103** | 113 | 123 | 133 | 143 | Breed | Text | Optional |
| +3 | **104** | 114 | 124 | 134 | 144 | Date of Birth | Date picker | **Preferred over age** — exact DOB avoids approximate DOB calculations |
| +4 | **105** | 115 | 125 | 135 | 145 | Age (fallback) | Text | Only used if DOB is empty. Parser attempts `"2 years"`, `"18 months"` etc. |
| +5 | **106** | 116 | 126 | 136 | 146 | Sex | Dropdown: `Male`, `Female`, `Unknown` | Biological sex only — desexed status is separate |
| +6 | **107** | 117 | 127 | 137 | 147 | Desexed? | Dropdown: `Yes`, `No`, `Unknown` | Tracks neutered/castrated/spayed status |
| +7 | **108** | 118 | 128 | 138 | 148 | Desexed date | Date picker | Optional; only shown if Desexed=`Yes` via Jotform conditional logic |
| +8 | **109** | 119 | 129 | 139 | 149 | Weight (kg) | Number | Use a numeric input. Unit suffix optional — `35`, `35 kg`, `35kg` all parse to 35.0 |
| +9 | — | — | — | — | — | *(reserved for future use)* | | Parser ignores this slot |

### Step 3 — Conditional visibility

Use Jotform's conditional-logic rules to hide unused pet blocks based on QID 100:

- Pet 2 block (111–119) visible only if QID 100 ≥ 2
- Pet 3 block (121–129) visible only if QID 100 ≥ 3
- Pet 4 block (131–139) visible only if QID 100 ≥ 4
- Pet 5 block (141–149) visible only if QID 100 ≥ 5

Similarly, QID +7 (desexed date) should be conditional on QID +6 (desexed) being `Yes`.

---

## Field guidance (what to ask the owner)

### Sex — one concept per question

**Don't** reuse the legacy "Male / Male Castrated / Female / Female Spayed" mashed dropdown. Split into two:

1. **Sex** (QID +5): `Male`, `Female`, `Unknown` — biological sex only.
2. **Desexed** (QID +6): `Yes`, `No`, `Unknown` — has the animal been neutered/castrated/spayed?
3. **Desexed date** (QID +7): only if answer to #2 is `Yes`.

This fixes the issue where the app's `Pet.sex` column conflated the two concepts, and where answers like `"Males Neutered"` didn't match the dropdown values.

### Date of Birth vs Age

Prefer a **date picker for DOB** (QID +4) over a free-text age field. Exact DOB is always better.

If the owner doesn't know DOB, leave that field empty and fall back to the **Age text field** (QID +5). The parser handles:
- `2 years`, `18 months`, `12 weeks`, `10 days`
- `one year`, `eighteen months` (word numbers)
- `1.5 years`, `2 1/2 years` (fractions)
- Bare numbers like `2.5` (treated as years)

Unparseable age strings fall through — the app stores the raw text in `Pet.reportedAge` so the information isn't lost, but `dateOfBirth` stays empty.

### Weight

Use a numeric input with `kg` as the unit suffix (hard-coded in the form label, not a free-text field). The parser accepts:
- `35`, `35.5`, `12.4` (assumed kg)
- `35 kg`, `35kg`, `35 kilograms`
- `77 lb`, `77 lbs`, `77 pounds` (converted to kg)
- `500 g`, `500 grams` (converted to kg)

The parser **rejects multi-number strings** like `"Teddy 35kg Bear 45kg"` (too ambiguous to split). With the multi-pet layout, each pet has its own weight field, so this shouldn't arise.

### Pet name

Encourage distinct, simple names — `Teddy`, `Bear` — rather than combined strings like `Teddy & Bear` or `Teddy (Golden) Bear (Bernese)`. The app's auto-matcher uses case-insensitive name comparison and fuzzy substring fallback; clean single-token names match existing records most reliably.

---

## Verification checklist after editing the Jotform form

1. Submit a test questionnaire with **1 pet** — confirm the `QuestionnaireReceived` event in PBS Admin shows correct pet details and auto-matches the test client's existing pet.
2. Submit a test questionnaire with **2 pets**, using distinct names that match two existing pets under the same client — confirm both pets are auto-matched and updated.
3. Submit a test questionnaire with **2 pets** where one name doesn't match any existing record — confirm the event's "Match Status" section shows one ✓ and one ⚠ with a Review prompt.
4. In PBS Admin MCP, run: `SELECT sex, desexed, COUNT(*) FROM Pet GROUP BY sex, desexed` — confirm no values outside `{Male, Female, Unknown} × {Yes, No, Unknown}`.
5. In PBS Admin MCP: `SELECT weightKg FROM Pet WHERE weightKg IS NOT NULL LIMIT 5` — confirm weights are numeric kg values.

---

## Legacy single-pet layout (reference only)

This is what the parser falls back to when QID 100 is missing. Do not design new forms around these QIDs — use the multi-pet layout above. Documented here for completeness:

| QID | Field |
|---:|---|
| 8 | Pet name |
| 19 | Breed |
| 22 | Sex (legacy combined dropdown — parsed into `sex` + `desexed`) |
| 23 | Age (free text) |
| 69 | Weight (free text) |

Legacy forms that already had their submissions processed before the multi-pet version launched continue to work unchanged.

---

## Parser changes if the layout must differ

If you can't use the QID numbers above (e.g., Jotform won't let you renumber existing fields), adjust the constants at the top of [jotformService.ts](../src/lib/services/jotformService.ts):

```ts
const MULTI_PET_COUNT_QID = '100';       // → new QID for pet-count selector
const MULTI_PET_BLOCK_BASE = 101;        // → first QID of Pet 1's block
const MULTI_PET_BLOCK_STRIDE = 10;       // → distance between pet blocks
const MULTI_PET_MAX = 5;                 // → max pets the parser will read
```

The per-field offsets (+0 name, +1 species, etc.) are hardcoded in `parseMultiPet`. If you rearrange fields within a block, update that function.
