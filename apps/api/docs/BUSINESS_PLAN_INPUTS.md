# Business plan inputs, by plan type

This document lists, for each of IDEM's ten business plan templates and for free composition, the data the user must provide for the plan to be complete and credible to its reader.

It is derived from the code as of 14 September 2026: templates ([structure/templates.ts](../api/services/BusinessPlan/structure/templates.ts)), section catalog ([structure/section-catalog.ts](../api/services/BusinessPlan/structure/section-catalog.ts)), section briefs ([prompts/sections/](../api/services/BusinessPlan/prompts/sections/)), reader lenses ([prompts/audience-lens.prompt.ts](../api/services/BusinessPlan/prompts/audience-lens.prompt.ts)), service ([businessPlan.service.ts](../api/services/BusinessPlan/businessPlan.service.ts)) and the Finance module ([Finance/finance-blocks.ts](../api/services/Finance/finance-blocks.ts)). If a section brief changes, this document must change with it.

Section names are given in English (the canonical catalog names). The generated plan is written in the interface language (`fr` → French, otherwise English).

**Levels**

- `O` **Required**: without this data the section is empty, stays generic, or rests on a guess by the model.
- `R` **Recommended**: the section holds without it, but the reader notices the gap.
- `W` **Web-researched**: the research team finds and cites the data. Only provide it if you have something better (field study, quote, local statistic). This only applies to generation with the research team. In simple generation these figures come from the model, and that is where your own data matters most.

---

## 1. Where the generator gets its data

### 1.1 Sources read

| Source | Fields actually read by the business plan | What they feed |
|---|---|---|
| Project creation | name, long description (otherwise description), type, scope (local → international), targets | Every section: it is the first block of each prompt. |
| Additional information (business plan form) | email, phone, address, city, **country**, postal code, team members (name, role, email, **bio**, photo, links) | Every section. The **country** also decides the accounting framework, fiscal-year labels and the market targeted by web research. |
| Brand charter (Branding module) | logo, colours, typefaces, art direction | Cover and layout. No content. |
| Finance module, **computed** | products, sales, costs, investments, financing plan, calendar, ratios | Tables placed by the server in the Financial Plan. A numeric summary is passed to Business Model, Operational Plan, Funding Request, Guarantees, Exit Strategy and Sustainability. |
| Web research | market, competitors, prices, sector margins, regulation, guarantee schemes, comparable transactions, development indicators | Sections marked `W`. The target market is the country from the additional information. |
| Interface language | `fr` → French, otherwise English | Writing language. |

### 1.2 What no field collects today

Section briefs require data for which **no field exists**: legal form, trade register number (RCCM), incorporation date, share capital and shareholding, promoter's personal contribution, guarantees, customers and traction, partners, licences and permits, competitors known on the ground, beneficiaries and baselines, indicators, risks, milestones, desired loan terms.

**Until those fields exist, this data must be written in the project's long description**, and everything about people in the team members' **bio**. Otherwise the model can only guess or stay vague. [Appendix A](#appendix-a--long-description-template) gives a ready-to-fill long description template.

Two pieces of data entered elsewhere in IDEM **do not reach** the business plan:

- team size, budget range and constraints, entered at project creation;
- the Legal Documents module context (legal form, capital, partners and shares, registered office, website).

They must therefore be copied into the long description.

### 1.3 The financing plan trap

The Finance module computes:

> **financing need = total project cost − all resources entered**
> (equity contribution + shareholder current account + medium-term loan (CMT) + leasing + supplier credit + self-financing + grant)

**Total project cost** = investments + start-up working capital requirement (including initial operating costs).

Every resource entered is therefore presented in the plan as **already secured**. Only the balance becomes the "requested funding". A resource entered but not obtained thus looks secured to the reader.

- **General rule**: only enter **secured** resources in the financing plan. What you are asking the reader for (the round, the grant) stays out of the plan: it then shows as the requested amount.
- **Exception, bank file**: a loan that is not entered has no interest or instalments in the income statement, which is exactly what the credit analyst checks. So enter the requested loan as a **CMT** (amount, rate, duration, amortisation method). The plan will then show "balanced financing plan". To correct the reading, write in the long description: *"The medium-term loan of X over N years at T % is the funding requested from [bank], not yet granted. Desired grace period: N months."* (the module does not model grace periods).
- **With no investment entered**, NPV, IRR and profitability index are reported as "not meaningful": year 0 carries no outflow.

---

## 2. The common base for every type

### 2.1 Identity and contact details

| Data | Where to enter it | Level | Why |
|---|---|---|---|
| Company name | Project creation | `O` | Cover and every section. |
| Long description: what is sold, to whom, where, stage (idea, prototype, pilot, operating since when), how it differs from alternatives | Project creation | `O` | Base of every section. See Appendix A for the rest. |
| Project type, geographic scope, targets | Project creation | `R` | Frame the market and the target. |
| **Country** | Additional information | `O` | Accounting framework (SYSCOHADA and calendar fiscal year mandatory in the 17 OHADA states; IFRS and free closing date in Nigeria, Kenya, South Africa…), fiscal-year labels, web research market. |
| City, address, postal code, email, phone | Additional information | `O` | File contact details; the city locates the catchment area. |

### 2.2 Team

For each member: name, role, email, photo, LinkedIn, and above all a **bio** `O` containing:

- years of experience **in this sector**, previous positions and companies;
- degrees and certifications relevant to the business;
- what the person has already done that is comparable (founding, running a similar business);
- share of capital held and time devoted to the project (full-time, part-time);
- for the promoter: personal contribution and current commitments (other activities, loans, guarantees given).

A bio listing titles unrelated to the business produces a Management & Team section that the briefs themselves call filler.

### 2.3 Brand charter

Logo, colours and typefaces come from the Branding module `R`. Without a logo the cover has no signature. Without colours the plan falls back to default colours. Art direction is generated automatically if missing. The cover carries **no figures**: no need to provide any.

### 2.4 Finance module

Financial tables only appear if the module is **filled in and computed**. Otherwise the Financial Plan is written without tables and the other sections only receive product prices.

When computed, the server places in the Financial Plan: headline figures, the revenue / net income curve, the income statement, project cost, the financing plan with the requested amount, break-even threshold, break-even date, lowest cash point, then NPV, IRR, payback period and profitability index.

| Module block | Data | Level |
|---|---|---|
| Settings | Currency; projection horizon (3 years by default, 7 at most) | `O` / `R` |
| Accounting calendar | First fiscal year; actual business start month (a mid-year start creates a short year 1, which the plan flags); closing month (outside OHADA only) | `O` |
| Products (20 max) | Name, unit selling price per year, unit cost per year, note justifying the price | `O` |
| Sales targets | **Monthly** quantities over 36 months per product (real seasonality, ramp-up); monthly growth from month 25 | `O` |
| Revenue | Trade receivables as % of revenue (customer payment terms) | `R` |
| Variable costs | Monthly lines: goods and materials, packaging, transport, subcontracting, advertising, intermediary commissions, bank fees…; supplier debt %; safety stock % | `O` |
| Fixed costs | Rent, insurance, maintenance, dues, business licences…; **gross monthly salary per position**; social charges and payroll tax rates | `O` |
| Taxes | Regime (actual or flat-rate), corporate tax rate, premises size. Defaults are in FCFA (business licence brackets, payroll tax 7.5 %, social charges 33.6 %, corporate tax 30 %): **check them for your country**. | `R` |
| Investments | One line per investment: category (intangible, building, equipment, furniture, financial), label, amount, commitment month | `O` |
| Financing plan | Equity contribution; shareholder current account; CMT; leasing (amount, rate, duration, amortisation method for each); supplier credit; self-financing; grant. **See trap 1.3.** | `O` |
| Ratios | Discount rate (10 % by default), dividend payout rate, WACC, number of shares | `R` |

### 2.5 Consistency checks the reader makes

The briefs tell the model not to contradict the Finance module. The data provided elsewhere must still agree with it:

- the **prices** stated in the description = the module's product prices;
- the **marketing budget** per channel = the advertising and commission cost lines;
- the **jobs created** stated = the payroll positions;
- each **piece of equipment** described (Operational Plan) = an investment line, same amount;
- the **amount requested**, currency and years = those of the module;
- planned **hires** = salaries starting in the corresponding months.

### 2.6 What each reader rejects, and the data that prevents it

**Bank and microfinance**: the analyst looks for the ability to repay, month after month.

| Reason for rejection | Data to provide |
|---|---|
| Projection with no downside scenario | Realistic monthly sales; the plan builds a −20 % scenario. |
| Contradictory figure in the document | The checks in 2.5. |
| Missing amount | Financing plan filled in per 1.3. |
| Personal contribution never quantified | Amount, nature, valuation and evidence of the contribution. |
| Required licence never mentioned | Status of each authorisation: obtained, applied for (date), to apply for. |

What builds this reader's trust: a promoter who has done something comparable before, signed contracts, a market that existed last year, named costs.

**Investor, incubator**: the partner looks for a company that can become big, fast, and stay defensible.

| Reason for rejection | Data to provide |
|---|---|
| Market too small | Assumptions for the SOM reachable in 3 years with the funds raised. |
| Advantage copyable in a year | The precise advantage and what protects it. |
| Dressed-up traction | Absolute numbers, period, calculation base, retention. |
| Team with no reason to win this problem | Each founder's experience related to the problem. |
| Finances with no path to the numbers | CAC, customer value, monthly burn, runway. |

What builds this reader's trust: evidence rather than arguments. For each point, state what is proven, what is being tested and what is a bet.

**Grant funder**: the evaluator looks for a measurable change among named beneficiaries.

| Reason for rejection | Data to provide |
|---|---|
| Beneficiaries described as a category | Who, how many, how they are identified and reached. |
| Impact asserted, never measured | Baseline, target and collection method per indicator. |
| Budget funding the organisation more than the programme | Budget per programme line, cost per beneficiary. |
| No answer to "and after the grant?" | Targeted revenue sources, amounts, dates. |
| Duplicate of a programme already funded locally | Existing programmes in the area and what sets you apart. |

What builds this reader's trust: a baseline, a partner who has signed, an honest account of what did not work before.

**Internal (management)**: the team looks for decisions to make, resources to commit and revision thresholds. It refuses to be sold the project. Data to provide: named owners, dated milestones, one indicator per objective, what is chosen and what is rejected.

**General**: the reader may be a lender, investor or partner, and judges the plan by its weakest claim. They reject contradictions between sections, paragraphs that would fit any company and figures with no origin. Data to provide: the local detail, the named competitor, the real price, the real constraint.

---

## 3. Data by plan type

| # | Template (`id`) | Reader | Origin | Sections | Pages |
|---|---|---|---|---|---|
| 3.1 | IDEM standard (`idem-standard`, default) | General | IDEM's historical structure | 9 | 25-35 |
| 3.2 | SBA traditional (`sba-traditional`) | Bank | U.S. Small Business Administration | 10 | 25-40 |
| 3.3 | 9-point bank file (`bank-financing-9`) | Bank | Bank guide for financing files | 9 | 20-30 |
| 3.4 | Credit file (`bank-credit-file`) | Bank | Bank credit committee | 14 | 35-50 |
| 3.5 | Seed / Series A (`vc-seed`) | Investor | Seed and Series A funds | 17 | 20-30 |
| 3.6 | Lean Canvas (`lean-canvas`) | Internal | Ash Maurya, hypothesis validation | 9 | 10-15 |
| 3.7 | Grant application (`grant-nonprofit`) | Funder | Donors and foundations | 15 | 25-40 |
| 3.8 | OHADA microfinance (`microfinance-ohada`) | Bank | Microfinance institutions, OHADA zone | 12 | 20-30 |
| 3.9 | Incubator application (`incubator-application`) | Investor | Incubators and accelerators | 12 | 15-25 |
| 3.10 | Internal strategic plan (`internal-strategic`) | Internal | Steering, management committee | 11 | 20-30 |
| 3.11 | Free composition (`custom`) | That of the starting template, otherwise general | — | 3 to 20 | — |

Each table below follows the document order. The "Card" column points to the detail in [part 4](#4-section-cards). **For this reader** notes are the requirements added by the reader lens.

### 3.1 IDEM standard (`idem-standard`)

**General** reader (see 2.6). No specific lens: each section follows its base brief.

| # | Section | Card | Key data to provide |
|---|---|---|---|
| 1 | Cover Page | F1 | Name, logo, charter. |
| 2 | Company Summary | F4 | One-sentence mission, dated vision, real founding story, legal form and shareholding, managers and what each brings, 4 to 6 values. |
| 3 | Opportunity | F10 | Problem and who suffers it, why now, TAM → SAM → SOM assumptions, entry segment, differentiation. `W` market size, trends, competitors. |
| 4 | Target Audience | F12 | 2 to 3 real personas, ranked pains, purchase trigger, customer journey, sector channels. `W` segment size, purchasing power. |
| 5 | Products & Services | F15 | Offers, differences from alternatives, prices (= Finance module), dated roadmap, delivery and after-sales. |
| 6 | Marketing & Sales | F20 | Message, named channels and cost per channel, sales process, retention, target indicators, budget per channel (= module costs), dated phases. |
| 7 | Financial Plan | F29 | Finance module computed; why the volumes are reachable; amount requested and repayment; financial risks and what absorbs them. |
| 8 | Goal Planning | F26 | Dated, measurable objectives, milestones and deliverables, resources per phase, blocking risks, what happens if a milestone is missed. |
| 9 | Appendix | F37 | Regulatory items; your own sources, if any. |

### 3.2 SBA traditional (`sba-traditional`)

**Bank** reader (see 2.6).

| # | Section | Card | Key data to provide |
|---|---|---|---|
| 1 | Cover Page | F1 | Name, logo, charter. |
| 2 | Executive Summary | F2 | What the company does, headline figures, amount and use. **For this reader:** amount requested and repayment horizon up front; personal contribution and guarantee in the same paragraph. |
| 3 | Company Summary | F4 | Mission, vision, story, managers, values. **For this reader:** legal form, exact share capital, share held by each partner. |
| 4 | Market Analysis | F11 | Target market, customers, barriers to entry. `W` volume, trend, players. **For this reader:** catchment area, demand within reach of the company, seasonality weighing on cash. |
| 5 | Management & Team | F7 | Org chart and vacancies, qualifying experience of each key person, costed hiring plan, gaps. **For this reader:** second signatory and delegation if the promoter is unavailable for three months. |
| 6 | Products & Services | F15 | Offers, prices (= Finance module), roadmap, after-sales. **For this reader:** the offer that carries revenue. |
| 7 | Marketing & Sales | F20 | Channels and cost per channel, sales process, budget. **For this reader:** the marketing budget appears in the Finance module costs, same amount. |
| 8 | Funding Request & Use of Funds | F30 | Amount, form, use per line tied to a milestone, repayment, what is already contributed. **For this reader:** duration, grace period, schedule; personal contribution as % of total need. |
| 9 | Financial Plan | F29 | Module computed with the loan as CMT (see 1.3), realistic monthly sales. **For this reader:** the plan shows monthly cash over 12 to 18 months, debt service, the lowest month, the coverage ratio and a −20 % scenario. |
| 10 | Appendix | F37 | **For this reader:** list of supporting documents (quotes, lease, bank statements, registration certificate) with date and issuer. |

### 3.3 9-point bank file (`bank-financing-9`)

**Bank** reader (see 2.6). This template has no Funding Request section: the requested amount only comes out of the Financial Plan, hence the importance of trap 1.3.

| # | Section | Card | Key data to provide |
|---|---|---|---|
| 1 | Cover Page | F1 | Name, logo, charter. |
| 2 | One-Page Summary | F3 | Company name, legal form, RCCM number, incorporation date, registered office, sector; history and products; ultimate goal; resources needed. **For this reader:** these identity facts must be present and accurate, otherwise the file is sent back unread. |
| 3 | Management & Team | F7 | Org chart, key people, costed hires, gaps. **For this reader:** second signatory and delegation. |
| 4 | Market Analysis | F11 | `W` market. **For this reader:** catchment area, reachable demand, seasonality. |
| 5 | Strategy & Key Milestones | F19 | Target market share, first target customers, positioning, SWOT with real weaknesses, dated steps. **For this reader:** each step carries the condition that triggers the next and the spending it unlocks. |
| 6 | Marketing & Sales | F20 | Channels and costs, process, budget. **For this reader:** budget present in costs, same amount. |
| 7 | Operational Plan | F24 | Commercial, production and human resources, processes, quality control, maximum capacity. **For this reader:** for each financed piece of equipment, price, supplier and quote. |
| 8 | Financial Plan | F29 | Module computed, loan as CMT. **For this reader:** monthly cash, debt service, coverage ratio, −20 % scenario. |
| 9 | Resources & Assets | F25 | Patents and trademarks (numbers), non-operating assets that can be pledged, know-how, own and family resources, each with valuation and evidence. **For this reader:** state whether each asset is already pledged elsewhere. |

### 3.4 Credit file (`bank-credit-file`)

**Bank** reader (see 2.6). The template that demands the most non-financial data.

| # | Section | Card | Key data to provide |
|---|---|---|---|
| 1 | Cover Page | F1 | Name, logo, charter. |
| 2 | Executive Summary | F2 | **For this reader:** amount and repayment horizon up front, personal contribution and guarantee. |
| 3 | Promoter Profile | F6 | Identity, background, degrees, experience related to this business, motivation, other activities and commitments. **For this reader:** quantified personal contribution, its nature and valuation; if none, what replaces it. |
| 4 | Company Summary | F4 | **For this reader:** legal form, capital, share of each partner. |
| 5 | Market Analysis | F11 | **For this reader:** catchment area, reachable demand, seasonality. |
| 6 | Competitive Analysis | F13 | Competitors known on the ground, purchase criteria, competitors' real strengths. `W` competitors, substitutes. **For this reader:** how to take a share without an unfundable price war. |
| 7 | Products & Services | F15 | **For this reader:** the offer carrying revenue; prices = Finance module. |
| 8 | Operational Plan | F24 | **For this reader:** price, supplier and quote for each financed piece of equipment; capacity. |
| 9 | Management & Team | F7 | **For this reader:** second signatory and delegation. |
| 10 | Financial Plan | F29 | **For this reader:** monthly cash over 12 to 18 months, debt service, coverage ratio, −20 % scenario. |
| 11 | Funding Request & Use of Funds | F30 | **For this reader:** duration, grace period, schedule, personal contribution as % of need. |
| 12 | Guarantees & Collateral | F31 | Nature, holder, value, valuation method and author for each guarantee; collateral already given elsewhere; evolution as the loan amortises. `W` the country's guarantee funds and their coverage rate. |
| 13 | Risk Analysis & Mitigation | F28 | Company- and country-specific risks, probability, impact, early signal, mitigation, insurance. **For this reader:** what you would cut first if revenue stayed 20 % below plan for a year. |
| 14 | Appendix | F37 | **For this reader:** list of supporting documents with date and issuer. |

### 3.5 Seed / Series A (`vc-seed`)

**Investor** reader (see 2.6). For the Finance module: keep the planned round **out** of the financing plan so it shows as the requested amount.

| # | Section | Card | Key data to provide |
|---|---|---|---|
| 1 | Cover Page | F1 | Name, logo, charter. |
| 2 | Executive Summary | F2 | **For this reader:** size of the opportunity and why now up front; traction in the first third, even if thin. |
| 3 | Problem Statement | F9 | Who suffers the problem, cost, current workarounds. `W` statistics. **For this reader:** the technological, regulatory or behavioural shift that opens the window. |
| 4 | Solution | F14 | User journey, non-copyable mechanism, before/after, what it does not do, evidence, what remains to build. **For this reader:** exact stage of each component (in production, prototype, specification). |
| 5 | Unique Value Proposition | F16 | "For whom, what outcome, unlike what" sentence; three verifiable claims and their evidence; the two closest alternatives. |
| 6 | Market Analysis | F11 | `W` market. **For this reader:** market structure (fragmented, concentrated) and its implications. |
| 7 | Target Audience | F12 | Personas, pains, triggers, journey. **For this reader:** beachhead segment, its size, why it is reachable first. |
| 8 | Business Model | F18 | Revenue streams, unit economics, CAC (measured or stated assumption), cost structure. `W` competitor prices, margins. **For this reader:** CAC payback, gross margin trajectory, what becomes cheaper at ten times the volume. |
| 9 | Traction & Proof Points | F22 | Absolute numbers (users, customers, revenue, pilots, letters of intent), curve with period and base, learnings. **For this reader:** retention and cohorts. |
| 10 | Competitive Analysis | F13 | `W` competitors. **For this reader:** reaction of the best-funded player, timing, what holds afterwards. |
| 11 | Unfair Advantage | F17 | The precise advantage, why a funded competitor cannot reproduce it in two years, what would erode it. **For this reader:** what holds after a funded competitor arrives. |
| 12 | Go-to-Market Strategy | F21 | Beachhead segment, how to reach the first ten customers, dated sequence, cost and expected proof per phase. |
| 13 | Management & Team | F7 | **For this reader:** for each founder, the experience that makes them the right person for this problem; the role missing today. |
| 14 | Financial Plan | F29 | Module computed. **For this reader:** current monthly burn, runway after the round, milestone to reach before the next round, gross margin trajectory. |
| 15 | Funding Request & Use of Funds | F30 | Amount, use per line and milestone, what is already contributed. **For this reader:** round size, instrument, what the round must prove; valuation only if the founders have a position. |
| 16 | Exit Strategy & Investor Returns | F32 | Realistic exit routes, horizon, active acquirers in the sector, entry valuation, number of shares (Finance module › Ratios). `W` comparable transactions and multiples. |
| 17 | Appendix | F37 | Your own sources, if any; regulatory items. |

### 3.6 Lean Canvas (`lean-canvas`)

**Internal** reader (see 2.6). This template validates hypotheses: for each claim, state whether it is **validated** (with the evidence), **being tested** or **untested**. Give each decision an owner and a date.

| # | Section | Card | Key data to provide |
|---|---|---|---|
| 1 | Cover Page | F1 | Name, logo, charter. |
| 2 | Problem Statement | F9 | Problem as a fact, who suffers it and at what cost, workarounds, what changed. `W` statistics. |
| 3 | Solution | F14 | Mechanism, evidence, what remains to build, what the solution does not do. |
| 4 | Unique Value Proposition | F16 | Proposition sentence, verifiable claims, alternatives. |
| 5 | Unfair Advantage | F17 | The precise advantage, or the admission of competing on execution. |
| 6 | Target Audience | F12 | Personas from interviews, sized segments. `W` segment size. |
| 7 | Business Model | F18 | Revenue, prices, unit economics, CAC, fixed and variable costs. `W` prices and margins. |
| 8 | Key Metrics & KPIs | F27 | 3 to 5 indicators: current value, target, deadline, measurement method, owner, revision threshold. |
| 9 | Financial Plan | F29 | Finance module computed, even in summary. |

### 3.7 Grant application (`grant-nonprofit`)

**Funder** reader (see 2.6). Two limits of the Finance module for this template:

- it works by accounting nature. The budget **per programme line** and the **cost per beneficiary** must therefore be provided in the long description;
- enter **secured** grants in the grant field, and keep the **requested** grant out of the financing plan (see 1.3).

| # | Section | Card | Key data to provide |
|---|---|---|---|
| 1 | Cover Page | F1 | Name, logo, charter. |
| 2 | Executive Summary | F2 | **For this reader:** beneficiaries and intended change, quantified, up front; then amount requested and secured co-funding. |
| 3 | Mission & Vision | F5 | Vision with a horizon and a measurable element, values, operating principles. **For this reader:** a mission naming the beneficiaries and the change in the same sentence. |
| 4 | Problem Statement | F9 | Causes, cost to beneficiaries, workarounds. **For this reader:** a baseline for the area concerned, not a national average. |
| 5 | Target Audience | F12 | **For this reader:** beneficiaries, not customers: how they are identified and reached, how many are in scope, vulnerability criteria. |
| 6 | Products & Services | F15 | **For this reader:** programmes, not products: activities, beneficiaries reached, cost per beneficiary. |
| 7 | Theory of Change | F33 | Root causes, inputs, activities, countable outputs, measurable outcomes, long-term impact, assumption behind each link. |
| 8 | Management & Team | F7 | **For this reader:** staff assigned to the programme, share of time of each, governance body overseeing it. |
| 9 | Partnerships & Ecosystem | F23 | Partners, contribution, status, dependencies. **For this reader:** for each support letter or agreement, the document name, its date and the commitment it carries. |
| 10 | Monitoring & Evaluation | F35 | Indicators, baseline, target, frequency, source, collector; evaluation set-up; reporting calendar; measurement budget. |
| 11 | Social & Economic Impact | F34 | Direct jobs per year and skill level (= payroll), indirect effects, beneficiaries, positive and negative environmental effects, measurement method. `W` local development priorities. |
| 12 | Financial Plan | F29 | Module computed. **For this reader:** budget per programme line, what each line produces, cost per beneficiary, share covered by the request versus secured co-funding. |
| 13 | Funding Request & Use of Funds | F30 | **For this reader:** total programme cost, share requested, each co-funder named with the status of their commitment. |
| 14 | Sustainability Plan | F36 | Current revenue mix and dependency, target mix, own revenue, reducible costs, reserves in months, lead-funder withdrawal scenario, targeted sources with amount and date. |
| 15 | Appendix | F37 | Referenced letters and agreements, your own sources. |

### 3.8 OHADA microfinance (`microfinance-ohada`)

**Bank** reader (see 2.6). OHADA countries: revised SYSCOHADA and a fiscal year from 1 January to 31 December. Enter the actual business start month so a short year 1 is flagged.

| # | Section | Card | Key data to provide |
|---|---|---|---|
| 1 | Cover Page | F1 | Name, logo, charter. |
| 2 | Promoter Profile | F6 | Background, experience related to the business, existing commitments. **For this reader:** quantified personal contribution, its nature, its valuation. |
| 3 | Company Summary | F4 | **For this reader:** legal form, capital, share of each partner. |
| 4 | Market Analysis | F11 | **For this reader:** catchment area, reachable demand, seasonality. |
| 5 | Products & Services | F15 | **For this reader:** the offer carrying revenue; prices = Finance module. |
| 6 | Operational Plan | F24 | **For this reader:** price, supplier and quote for each financed piece of equipment. |
| 7 | Management & Team | F7 | **For this reader:** second signatory and delegation. |
| 8 | Financial Plan | F29 | Module computed, loan as CMT. **For this reader:** monthly cash, debt service, coverage ratio, −20 % scenario. |
| 9 | Funding Request & Use of Funds | F30 | **For this reader:** duration, grace period, schedule, personal contribution as % of need. |
| 10 | Guarantees & Collateral | F31 | Nature, holder, value and valuer of each guarantee; collateral already given. `W` the country's guarantee funds and public schemes. |
| 11 | Social & Economic Impact | F34 | Beneficiaries, indirect effects, environmental effect. **For this reader:** jobs created and taxes generated per year, with skill level (criteria for subsidised credit lines and public guarantees). |
| 12 | Appendix | F37 | **For this reader:** list of supporting documents with date and issuer. |

### 3.9 Incubator application (`incubator-application`)

**Investor** reader (see 2.6). This template has no Funding Request section: any need comes out of the Financial Plan.

| # | Section | Card | Key data to provide |
|---|---|---|---|
| 1 | Cover Page | F1 | Name, logo, charter. |
| 2 | Executive Summary | F2 | **For this reader:** size of the opportunity, why now, traction even if thin. |
| 3 | Problem Statement | F9 | `W` statistics. **For this reader:** what changed recently. |
| 4 | Solution | F14 | **For this reader:** exact stage of each component; evidence. |
| 5 | Target Audience | F12 | **For this reader:** beachhead segment and its size. |
| 6 | Business Model | F18 | **For this reader:** CAC and its payback, gross margin trajectory. |
| 7 | Traction & Proof Points | F22 | Absolute numbers, period, base. **For this reader:** retention. If traction is thin, say so. |
| 8 | Competitive Analysis | F13 | **For this reader:** reaction of the best-funded player. |
| 9 | Management & Team | F7 | **For this reader:** each founder's fit with the problem; missing role. |
| 10 | Go-to-Market Strategy | F21 | Beachhead, first ten customers, dated sequence, cost and proof per phase. |
| 11 | Goal Planning | F26 | Dated objectives, milestones, resources per phase, risks, plan if a milestone is missed (consistent with the incubator's programme). |
| 12 | Financial Plan | F29 | **For this reader:** monthly burn, runway, milestone before the next funding. |

### 3.10 Internal strategic plan (`internal-strategic`)

**Internal** reader (see 2.6). This template has **no cover**. For each decision: named owner, date, cost, indicator.

| # | Section | Card | Key data to provide |
|---|---|---|---|
| 1 | Executive Summary | F2 | What the company does, market, team, headline figures, resources to commit. |
| 2 | Company Summary | F4 | Mission, dated vision, organisation, values that settle decisions. |
| 3 | Market Analysis | F11 | Market trend and structure, barriers. `W` market. |
| 4 | Competitive Analysis | F13 | Competitors, where they are strong, likely reactions. `W` competitors. |
| 5 | Strategy & Key Milestones | F19 | Target market share, positioning, actionable SWOT, what is pursued and what is rejected, dated steps. |
| 6 | Operational Plan | F24 | Resources, processes, maximum capacity and cost of the next step. |
| 7 | Management & Team | F7 | Org chart, vacancies, hires, gaps. |
| 8 | Goal Planning | F26 | Dated objectives, milestones, resources per phase, plan if a milestone is missed. |
| 9 | Key Metrics & KPIs | F27 | 3 to 5 indicators with current value, target, owner, review cadence, revision threshold. |
| 10 | Risk Analysis & Mitigation | F28 | Register of specific risks, early signal, mitigation, scenario of two simultaneous risks. |
| 11 | Financial Plan | F29 | Finance module computed. |

### 3.11 Free composition (`custom`)

- **Reader**: that of the template the user started from, if they removed or moved sections from it; otherwise a general reading, with no lens.
- **Size**: 3 to 20 sections, from the catalog only.
- **Section specific to this mode**: *Legal & Regulatory Framework* (F8), absent from every template.
- **Data to provide**: the union of the cards of the chosen sections, plus the common base (part 2).
- **Dependencies**: some sections build on others when present. Executive Summary draws on Opportunity, Market Analysis, Products & Services and Financial Plan. Goal Planning draws on Marketing & Sales and Financial Plan. Risk Analysis draws on Financial Plan and Operational Plan. Removing a section breaks nothing, but its data no longer feeds the others: provide it in the long description instead.

---

## 4. Section cards

Each card turns the section brief (`mustCover`) into data to provide, then adds the requirements specific to each reader (`lenses`). In brackets: the catalog key and the canonical name.

### Opening

#### F1 · Cover Page [`cover-page`]
Used by every template except the internal strategic plan.
- `O` Company name *(project creation)*.
- `O` Logo *(Branding module)*: it is the cover's signature.
- `R` Charter colours and typefaces.
- The cover carries **no figures** (no amount, percentage or indicator). Date and version are set automatically.

#### F2 · Executive Summary [`executive-summary`]
Used by: SBA, credit file, seed, grant, incubator, internal strategic.
- `O` One sentence: what the company does, for whom, what outcome.
- `O` The figure that makes the problem real (`W` if Opportunity or Market Analysis is in the plan).
- `O` The offer and the mechanism that makes it work where others fail.
- `O` Market size, growth, segment attacked first (`W` via the market sections).
- `O` What qualifies this team for this problem *(bios)*.
- `O` Headline figures: revenue at the horizon, break-even, margin *(Finance module)*.
- `O` Amount requested, use, what it enables *(Finance module + description)*.

Nothing is introduced here that the plan does not develop later.

**By reader.**
- **Bank**: amount requested and repayment horizon up front; personal contribution and guarantee in the same paragraph.
- **Investor**: size of the opportunity and why now; traction in the first third.
- **Funder**: beneficiaries and intended change, each quantified; then amount and secured co-funding.

#### F3 · One-Page Summary [`one-page-summary`]
Used by: 9-point bank file.
- `O` Company name, legal form, registration number (RCCM), incorporation date, registered office, sector *(long description)*.
- `O` Short presentation: history, products, creations and developments.
- `O` Ultimate goal.
- `O` What is needed to reach it: resources, partners, financing.

**By reader.**
- **Bank**: identity present and accurate, otherwise the file is sent back unread.

### The company

#### F4 · Company Summary [`company-summary`]
Used by: IDEM standard, SBA, credit file, microfinance, internal strategic.
- `O` One-sentence mission: what the company does, for whom, concretely.
- `O` Vision, with a horizon.
- `R` Founding story: the problem encountered and what made it worth solving. A real fact: if nothing specific happened, say what the founders observed.
- `O` Legal form and shareholding *(long description)*.
- `O` Managers and what each brings to this problem *(bios)*.
- `R` 4 to 6 values, each able to change a decision.
- `R` Incorporation date, headcount, markets covered.

**By reader.**
- **Bank**: legal form, capital and share held by each partner, precisely: they determine who is liable.
- **Investor**: the story only stays if it explains why this team saw the problem before others; otherwise more room for the managers.

#### F5 · Mission & Vision [`mission-vision`]
Used by: grant.
- `O` Mission: who is served, what changes for them, by what means.
- `O` Vision: a horizon and a measurable element.
- `R` 4 to 6 values, each with a decision it forbids.
- `R` Principles governing day-to-day operation.

**By reader.**
- **Funder**: beneficiaries and change named in the same sentence as the mission.

#### F6 · Promoter Profile [`promoter-profile`]
Used by: credit file, microfinance.
- `O` Identity, background, degrees *(bio)*.
- `O` Professional and entrepreneurial experience related to **this** business; where it is lacking, who fills the gap.
- `O` Personal contribution: funds, equipment, premises, network, with amount, valuation method and evidence.
- `R` Motivation, and what has already been committed at their own risk.
- `O` Existing commitments and other activities.

**By reader.**
- **Bank**: the personal contribution is the figure the section exists for. A promoter with no contribution says so and explains what replaces it.

#### F7 · Management & Team [`management-team`]
Used by: SBA, 9-point, credit file, seed, grant, microfinance, incubator, internal strategic.
- `O` Org chart: who reports to whom, which positions are vacant.
- `O` Key people: position and qualifying experience *(bios)*.
- `R` The decision this team is especially able to get right.
- `O` Hiring plan: positions, date, cost (= Finance module salaries).
- `R` Advisers, board, external expertise.
- `O` Acknowledged gaps: a plan announcing a complete team is not believed.

**By reader.**
- **Bank**: continuity, with the second signatory and delegation if the promoter is unavailable for three months.
- **Investor**: the precise experience that makes each founder the right person for this problem; the missing role.
- **Funder**: staff actually assigned to the programme, share of time, governance body.

#### F8 · Legal & Regulatory Framework [`legal-regulatory`]
Used by: free composition only.
- `O` Legal form chosen and why, consequences for liability and tax.
- `O` Shareholding and capital structure.
- `O` For each licence, permit or approval: status (obtained, applied for on…, to apply for). `W` authority, cost, lead time in the country.
- `W` Sector regulations (sector, data, consumers) and recent changes.
- `R` Intellectual property held or being filed.
- `R` Major contracts: lease, supply, distribution, employment.

**By reader.**
- **Bank**: operating without a required authorisation is a reason for rejection; state what the company does in the meantime.

### The market

#### F9 · Problem Statement [`problem`]
Used by: seed, Lean Canvas, grant, incubator.
- `O` The problem as a fact of the world, not as the absence of your product.
- `O` Who suffers it, how often, what it costs in money or time. `W` statistics.
- `R` How it is handled today and the cost of those workarounds. `W`.
- `R` Why it is not solved yet.
- `O` What changed recently and makes solving it possible.

**By reader.**
- **Investor**: the technological, regulatory or behavioural shift that opens the window.
- **Funder**: a baseline for the area concerned, not a national average.

#### F10 · Opportunity [`opportunity`]
Used by: IDEM standard.
- `O` The problem and who suffers it.
- `W` Documented sector trends.
- `R` Why now.
- `W` TAM, SAM, SOM with unit, year and derivation. `R` Your narrowing assumptions: area covered, segments kept, capture rate.
- `W` Competitive landscape.
- `O` Differentiation, expressed as a mechanism.
- `O` Entry segment and why that one.

**By reader.**
- **Bank**: stability, with demand that existed last year and how the market behaves in a recession.
- **Investor**: the SOM reachable in three years with the funds raised, not the theoretical ceiling.

#### F11 · Market Analysis [`market-analysis`]
Used by: SBA, 9-point, credit file, seed, microfinance, internal strategic.
- `O` Which market: local, regional, national, international *(project scope)*.
- `W` Trend: volume, revenue, direction, years of the figures.
- `R` Customers: who buys, how often, at what price. `W`.
- `W` Players present and relative strengths. `R` Those you know on the ground.
- `W` Structure: concentrated, fragmented, regulated.
- `R` Barriers to entry and the project's position against them.
- `W` Trends and regulatory changes over the plan horizon.

**By reader.**
- **Bank**: the catchment area is the subject; demand within reach of the company and seasonality affecting cash `O`.
- **Investor**: market structure stated honestly and its implications (slow consolidation, reaction of an incumbent).

#### F12 · Target Audience [`target-audience`]
Used by: IDEM standard, seed, Lean Canvas, grant, incubator.
- `O` 2 to 3 real personas (ideally from interviews): name, age, role, what they are trying to do, what blocks them, what the product changes.
- `R` Pains ranked by what they cost the customer.
- `R` What actually triggers the purchase.
- `W` Size per segment, buying behaviour, purchasing power.
- `R` Customer journey, from first contact to recurring use.
- `R` Acquisition channels that work in this sector.

**By reader.**
- **Funder**: beneficiaries, with how they are identified and reached, their number in scope and vulnerability criteria.
- **Investor**: beachhead segment, its size, why it is reachable first.

#### F13 · Competitive Analysis [`competition`]
Used by: credit file, seed, incubator, internal strategic.
- `W` Direct competitors: size, offer, price. `R` Those you actually face.
- `W` Indirect competitors and substitutes, including "doing nothing".
- `R` The criteria the buyer weighs.
- `O` Where each competitor is strong: at least one axis conceded.
- `O` The space the project occupies and why it is defensible.
- `R` Likely competitor reaction and planned response.

**By reader.**
- **Bank**: established competitors prove demand; how to take a share without an unfundable price war.
- **Investor**: what the best-funded player would do, how fast, and what holds afterwards.

### The offer

#### F14 · Solution [`solution`]
Used by: seed, Lean Canvas, incubator.
- `O` What the solution does, in the order the user experiences it.
- `O` The mechanism a competitor cannot copy by reading the page.
- `R` The before and after, measured.
- `R` What it deliberately does not do.
- `O` Evidence: pilot, prototype, first users, technical validation.
- `O` What remains to build.

**By reader.**
- **Investor**: stage without decoration, separating what is in production, in prototype or in specification.

#### F15 · Products & Services [`products-services`]
Used by: IDEM standard, SBA, credit file, grant, microfinance.
- `O` The real offers, described by what they do for the customer.
- `O` The features that truly differ from alternatives.
- `R` Outcome for the customer: a before and an after.
- `R` Comparison with alternatives on the buyer's criteria.
- `R` Dated roadmap.
- `O` Pricing: model, tiers, justification of each tier, **same prices as the Finance module**.
- `R` Delivery and support after the sale.

**By reader.**
- **Bank**: the offer carrying revenue. Eight products of equal weight paint a company that has not chosen.
- **Funder**: programmes, each with activities, beneficiaries reached and cost per beneficiary.

#### F16 · Unique Value Proposition [`value-proposition`]
Used by: seed, Lean Canvas.
- `O` One sentence: for whom, what outcome, unlike what.
- `R` Why this customer cares about this outcome more than anyone.
- `O` Three verifiable claims, and the evidence for each.
- `O` Positioning against the two closest alternatives.

#### F17 · Unfair Advantage [`unfair-advantage`]
Used by: seed, Lean Canvas.
- `O` The precise advantage: proprietary data, exclusive access, network effect, regulatory position, patent, distribution channel closed to others, inimitable cost structure. If there is none, say you compete on execution.
- `O` Why a funded competitor cannot reproduce it in two years.
- `R` How it strengthens with growth.
- `R` What would erode it, and what protects it.

**By reader.**
- **Investor**: what still holds after a funded competitor arrives.

#### F18 · Business Model [`business-model`]
Used by: seed, Lean Canvas, incubator. Receives the Finance module summary.
- `O` Revenue streams: what, to whom, how often *(Finance module › Products)*.
- `O` Pricing model and what justifies its level.
- `O` Unit economics: revenue per customer, cost to serve, gross margin.
- `O` Customer acquisition cost, measured or stated as an assumption, and payback period.
- `O` Cost structure: what is fixed, what follows volume *(Finance module)*.
- `R` How the model improves with scale, or why it does not.
- `W` Competitor prices, sector benchmark margins.

**By reader.**
- **Bank**: contribution margin per unit and fixed-cost base, which set the volume covering the loan instalment.
- **Investor**: CAC payback, gross margin trajectory, what becomes structurally cheaper at ten times the volume.
- **Funder**: if the model is not commercial, the funding mix with sources, share of each, duration and non-renewal risk.

### Strategy

#### F19 · Strategy & Key Milestones [`strategy-milestones`]
Used by: 9-point, internal strategic.
- `O` Target market share and first target customers.
- `O` Positioning, phrased as a decision.
- `O` SWOT: 3 to 5 entries per quadrant, real weaknesses, each with the action that answers it.
- `R` Strategic choices: what is pursued, what is rejected.
- `O` Dated key steps, each with the condition that triggers the next.

**By reader.**
- **Bank**: each step carries the gate condition and the spending it unlocks.

#### F20 · Marketing & Sales [`marketing-sales`]
Used by: IDEM standard, SBA, 9-point.
- `O` Positioning and the message that carries it.
- `O` **Named** acquisition channels, with the expected cost on each (cost-per-acquisition assumption).
- `O` Sales process suited to the ticket size: self-service, remote sales, field sales.
- `R` Retention: what keeps the customer and what it costs.
- `R` Indicators tracked and their targets.
- `O` Budget split by channel, **present in the Finance module costs**.
- `R` Roll-out in dated phases.

**By reader.**
- **Bank**: marketing budget at the same amount in the cost structure; a sales plan that costs nothing in the projection makes the projection wrong.
- **Funder**: outreach rather than sales, with how beneficiaries learn about the programme, local relays and the cost of reaching the most remote.

#### F21 · Go-to-Market Strategy [`go-to-market`]
Used by: seed, incubator.
- `O` Beachhead segment and why that one first.
- `O` How the first customers will actually be reached: named channels.
- `R` Sales mode suited to the ticket size.
- `R` Partnerships and distribution that shorten the path.
- `O` Launch sequence in dated phases.
- `O` Cost of each phase and what it must prove before the next.

#### F22 · Traction & Proof Points [`traction`]
Used by: seed, incubator.
- `O` What exists today in absolute numbers: users, customers, revenue, pilots, letters of intent.
- `O` Growth curve with period and calculation base.
- `O` Retention and usage.
- `R` Partnerships, awards, certifications actually obtained.
- `R` What was learned and what changed as a result.

**By reader.**
- **Investor**: retention decides the section. Growth without retention is a leaky bucket.

#### F23 · Partnerships & Ecosystem [`partnerships`]
Used by: grant.
- `O` Committed partners, what each concretely brings, status (signed, in discussion, identified).
- `R` Targeted partners and state of discussions.
- `R` What the partnership brings each party.
- `O` Suppliers and the dependency they create.
- `R` Institutional, academic or public actors involved.
- `O` Risk of the most critical dependency, and the alternative.

**By reader.**
- **Funder**: for each signed support letter or agreement, the document, its date and the commitment it carries.
- **Bank**: a single supplier with no alternative, presented as a quantified risk.

### Operations

#### F24 · Operational Plan [`operations-plan`]
Used by: 9-point, credit file, microfinance, internal strategic. Receives the Finance module summary.
- `O` Commercial resources: sales force, outlets, distribution, tools.
- `O` Production resources: premises, equipment, capacity, suppliers, lead times.
- `O` Human resources: headcount per function, qualifications, payroll (= Finance module).
- `O` Production or service process, step by step.
- `R` Quality control and after-sales service.
- `O` Capacity limit: volume the current set-up supports, and cost of the next step.

Each resource has a cost, present at the same amount in the Finance module.

**By reader.**
- **Bank**: for each financed piece of equipment, price, supplier and original quote `O`.

#### F25 · Resources & Assets [`resources-assets`]
Used by: 9-point.
- `R` Patents, trademarks, designs: filed or granted, with number.
- `R` Assets held outside operations that can be mobilised.
- `R` Specific know-how, and who holds it.
- `R` Franchises, licences, product partnerships.
- `O` Own and family resources committed to the project.
- `R` Innovative products or processes not yet exploited.

Each item comes with a valuation and its evidence.

**By reader.**
- **Bank**: for each asset, state whether it is already pledged elsewhere.

#### F26 · Goal Planning [`goal-planning`]
Used by: IDEM standard, incubator, internal strategic.
- `O` Measurable, dated strategic objectives.
- `O` Milestones marking them, with their deliverable.
- `O` Phased calendar.
- `R` Resources per phase: people, budget, tools.
- `O` The risks that would actually stop the plan.
- `R` Indicators that will show whether it works.
- `R` What happens if a milestone is missed.

#### F27 · Key Metrics & KPIs [`kpi-metrics`]
Used by: Lean Canvas, internal strategic.
- `O` The 3 to 5 indicators that actually steer the company.
- `O` For each: current value, target, deadline, measurement method.
- `R` Leading indicators, which move before results.
- `O` Review cadence and owner of each indicator.
- `R` Threshold from which the plan is revised.

#### F28 · Risk Analysis & Mitigation [`risk-analysis`]
Used by: credit file, internal strategic.
- `O` The risks that would stop the plan (market, operational, financial, regulatory, human), specific to this company in this country.
- `O` For each: probability, impact, first signal.
- `O` Mitigation in place, and the one that would be triggered.
- `R` Scenario where two risks occur together.
- `R` Insurance, reserves, clauses, contractual protections.

**By reader.**
- **Bank**: scenario of revenue 20 % below plan for a year. Is the debt still serviced, and what is cut first?

### Finance

#### F29 · Financial Plan [`financial-plan`]
Used by: every template. Receives the tables placed by the server and the Finance module summary.
- `O` Finance module filled in and computed (part 2.4).
- `O` What the model rests on: why these volumes are reachable in **this** market *(description, product notes)*.
- `O` Amount requested, what it finances, how it is repaid (see 1.3).
- `R` Financial risks, each with what absorbs it: clause, reserve, compressible cost, renegotiable contract.
- `R` Assumptions behind each lever: collection time, cost of the loan.
- `W` Sector benchmark margins and cost structures, competitor prices.

From the module the server produces: variable/fixed cost, break-even threshold and date, accounting framework and fiscal-year labels.

**By reader.**
- **Bank**: monthly cash over the first 12 to 18 months, debt service, lowest month, coverage ratio, −20 % scenario. Enter realistic monthly sales and costs (seasonality).
- **Investor**: current monthly burn, runway after the round, milestone to reach before the next, gross margin trajectory.
- **Funder**: budget per programme line, what each line produces, cost per beneficiary, share covered by the request versus secured co-funding *(long description: the module does not split by programme)*.

#### F30 · Funding Request & Use of Funds [`funding-request`]
Used by: SBA, credit file, seed, grant, microfinance. Receives the Finance module summary.
- `O` Amount, in the module currency (= financing need, see 1.3).
- `O` Form: equity, loan, grant, guarantee, or a combination.
- `O` Expected terms: rate, duration, grace period, dilution.
- `O` Use of funds per line, each line tied to a milestone.
- `R` Financial runway the amount provides, and what must be true at the end.
- `O` Repayment (schedule) or path to liquidity (equity).
- `O` What has already been contributed, and by whom.

**By reader.**
- **Bank**: duration, grace period and schedule, with projected cash covering each instalment; personal contribution as % of total need, or its absence explained.
- **Investor**: round size, instrument, what the round must prove; valuation only if the founders have a position.
- **Funder**: total programme cost, share requested, each co-funder named with the status of their commitment.

#### F31 · Guarantees & Collateral [`guarantees`]
Used by: credit file, microfinance. Receives the Finance module summary.
- `O` Guarantees offered: nature, holder, value, valuation method and author.
- `O` Personal contribution and the share of total need it covers.
- `O` Commitments and collateral already given elsewhere.
- `W` The country's guarantee funds, public schemes or mutual guarantee societies, with their coverage rate. `R` Those already approached.
- `O` Repayment capacity: ratio computed from the Finance module.
- `R` How the guarantee evolves as the loan amortises.

An overstated valuation is discovered at appraisal and ends the file.

#### F32 · Exit Strategy & Investor Returns [`exit-strategy`]
Used by: seed. Receives the Finance module summary.
- `O` Realistic exit routes for this type of company in this market: trade sale, secondary sale, buyout, dividends, IPO.
- `O` Horizon, and what the company must look like at that point.
- `W` Comparable sector transactions with multiples and dates. `R` Active acquirers you know.
- `O` Implied return for an investor entering now: entry valuation and amount *(description)*, number of shares and payout rate *(Finance module › Ratios)*. An unsourced multiple is presented as an assumption.
- `R` No-exit scenario, and what the investor then holds.

### Impact

#### F33 · Theory of Change [`theory-of-change`]
Used by: grant.
- `O` The problem and its root causes, not its symptoms.
- `O` Inputs: what is invested.
- `O` Activities: what is done with it.
- `O` Outputs: what is produced, countable.
- `O` Outcomes: what changes for beneficiaries, measurable.
- `O` Impact: the long-term change sought.
- `O` The assumption behind each link, especially between outputs and outcomes (training people is not finding them a job).

#### F34 · Social & Economic Impact [`impact`]
Used by: grant, microfinance.
- `O` Direct jobs per year and per skill level (= payroll positions).
- `R` Indirect effects on the local economy: suppliers, subcontractors, taxes.
- `O` Beneficiaries served and what measurably changes for them.
- `O` Environmental effect, positive and negative, and what limits the negative.
- `R` Contribution to named local or national development priorities. `W`.
- `O` Measurement method for each of these effects.

**By reader.**
- **Bank**: jobs created and taxes generated per year, with skill level, since public guarantees and subsidised credit lines are assessed on them.

#### F35 · Monitoring & Evaluation [`monitoring-evaluation`]
Used by: grant.
- `O` Indicators tracked, aligned with the stated outcomes.
- `O` For each: baseline, target, frequency, data source, person collecting. A baseline that does not exist yet becomes the programme's first activity, never an invention.
- `R` Evaluation set-up: internal review, external evaluation, control group.
- `O` Reporting calendar and recipients of each report.
- `R` How results feed back into the programme.
- `O` Budget allocated to measurement.

#### F36 · Sustainability Plan [`sustainability`]
Used by: grant. Receives the Finance module summary.
- `O` Current revenue mix and the dependency it creates on a funder.
- `O` Target mix at the horizon and how to get there.
- `O` Own revenue, cost recovery or commercial activity under development.
- `R` Cost structure and what can be cut without stopping the mission.
- `R` Reserve policy and number of months covered.
- `O` Lead-funder withdrawal scenario, and the response.
- `O` Targeted sources: name, amount, expected closing date. "We will diversify our funding" is not a plan.

### Closing

#### F37 · Appendix [`appendix`]
Used by: IDEM standard, SBA, credit file, seed, grant, microfinance.
- `R` Sources of figures, named and dated. The "Resources" bibliography is added automatically at the end of the document when sections cite web sources.
- Detailed tables and sector glossary: produced from the rest of the plan.
- `R` Regulatory or legal items concerning the business.

Nothing new is introduced in the appendix.

**By reader.**
- **Bank**: list of documents that will accompany the file (quotes, leases, statements, registration certificate) with date and issuer, even if not attached `O`.

---

## Appendix A · Long description template

Copy into the project's long description, keeping only the headings useful for the chosen plan type. Everything written here is read by **every** section. The labels can be written in the language of the plan.

```text
LEGAL IDENTITY
- Company name: …            Trading name: …
- Legal form: SARL / SAS / SA / Sole proprietorship / GIE / Association / Cooperative
- RCCM no.: …   Taxpayer no.: …   Incorporation date: …
- Registered office: …   Share capital: … (currency)
- Partners and shares: Name — % ; Name — %

BUSINESS AND STAGE
- What we sell, to whom, where: …
- Stage: idea / prototype / pilot / operating since (month, year)
- What changed recently and makes the project possible now: …

PROMOTER
- Personal contribution: amount … ; nature (cash, equipment, premises, goodwill) ;
  valuation method … ; evidence …
- Other activities, current loans, guarantees already given: …

CUSTOMERS AND EVIDENCE
- Current customers or users (absolute numbers): …   Revenue achieved: … over …
- Retention / repeat purchase: …
- Signed contracts, purchase orders, letters of intent: …
- Pilots, awards, certifications obtained: …

MARKET AND COMPETITION (what you know from the ground)
- Catchment area: …   Seasonality: …
- Competitors: name — price — strength — weakness
- Target market share and the assumption behind it: …

OPERATIONS
- Premises: area, rent, lease until …
- Equipment: item — price — supplier — quote (no., date)
- Current maximum capacity: … per month   Cost of the next step: …
- Key suppliers and an alternative for each: …

AUTHORISATIONS
- Licence / approval: obtained on … / applied for on … / to apply for — authority — cost

PARTNERS
- Name — concrete contribution — status (signed on … / in discussion / identified)

FUNDING SOUGHT
- Amount requested: …   Form: loan / equity / grant   From: …
- Terms: duration …, rate …, grace period … months — or instrument, acceptable dilution
- If the loan is entered as CMT in the Finance module: "this CMT is the funding requested, not yet granted"
- Use: line — amount — milestone
- Guarantees offered: nature — value — valued by — already pledged (yes / no)

STEERING
- Dated objectives: …
- Indicators (3 to 5): current value → target, deadline, owner
- Main risks: risk — first signal — mitigation

IMPACT (grant, microfinance)
- Beneficiaries: who, how many, how identified and reached
- Indicators: baseline → target, collection method
- Co-funding: funder — amount — status
- Budget per programme line: line — amount — beneficiaries
```

---

## Appendix B · Gaps found in the code

These gaps explain why part of the data must go through the long description today. Each one is a candidate field to add.

1. **Onboarding data not passed on.** `extractProjectDescription` ([common/generic.service.ts](../api/services/common/generic.service.ts)) only reads the name, description, type, scope and targets. Team size, budget range and constraints are lost to the plan.
2. **Legal context not passed on.** The Legal Documents module context (legal form, capital, partners and shares, registered office, website) is read nowhere in `services/BusinessPlan`.
3. **No field for key banking data.** Nothing collects the RCCM, incorporation date, personal contribution, guarantees, traction, partners, licences, beneficiaries or risks. Yet the briefs of the bank and grant templates make them their first criterion.
4. **Requested resource indistinguishable from a secured one.** `computeFinancing` ([Finance/finance-calculator.service.ts](../api/services/Finance/finance-calculator.service.ts)) adds up all resources entered. A loan entered as CMT to get its debt service cancels the financing need and looks obtained (see 1.3).
5. **Monthly cash and burn not passed on.** The bank and investor lenses require monthly cash, burn and runway. `buildFinanceNarrative` ([Finance/finance-blocks.ts](../api/services/Finance/finance-blocks.ts)) only passes year-end cash, although the module computes monthly series. The model must therefore rebuild or guess them.
6. **No budget per programme.** The funder lens asks for a budget per programme line and a cost per beneficiary, which the Finance module, organised by accounting nature, does not produce.
7. **Grace period not modelled.** `LoanParams` has no grace period, although the Funding Request must state it for a bank.
