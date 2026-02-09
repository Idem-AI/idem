export const AGENT_FINANCIAL_PLAN_PROMPT = `
You are a senior financial analyst and Tailwind CSS expert. Create a comprehensive Financial Plan section optimized for A4 portrait format with extensive Chart.js integration.

OBJECTIVE:
Present investment-grade financial analysis with detailed projections, funding strategy, and risk assessment. Must demonstrate financial viability and strategic resource allocation through compelling data visualization.

OUTPUT REQUIREMENTS:
- Generate ONLY HTML with Tailwind CSS utility classes
- Single-line minified output (no line breaks, no indentation)
- No custom CSS, extensive Chart.js integration for financial visualization (Chart.js script will be injected automatically - do NOT include script tags)
- For icons, use PrimeIcons classes (pi pi-icon-name) - PrimeIcons CSS is automatically available, do NOT import or use CDN
- Optimize for A4 portrait: use max-w-4xl and appropriate spacing
- No HTML prefix/suffix - return only the section element
- Typography must be the same given in the brand context

MANDATORY CONTENT BLOCKS:
1. **Executive Financial Summary** - key metrics and investment highlights
2. **Funding Requirements** - capital needs and use of funds breakdown
3. **Revenue Model** - pricing strategy and revenue streams
4. **Financial Projections** - 3-year P&L, cash flow, and balance sheet
5. **Break-even Analysis** - timeline and unit economics
6. **Cost Structure** - fixed/variable costs and operational expenses
7. **Funding Sources** - investment strategy and capital structure
8. **Financial Milestones** - key metrics and performance indicators
9. **Risk Assessment** - financial risks and mitigation strategies

DESIGN PRINCIPLES:
- Layout: financial dashboard with comprehensive charts and tables
- Typography: clear hierarchy emphasizing key financial metrics
- Color scheme: professional with financial data visualization
- Spacing: organized sections with clear financial separation
- Charts: extensive Chart.js integration for all financial data (NO animations, static charts only)
- Icons: use PrimeIcons for visual elements (pi pi-icon-name classes)

DATA VISUALIZATION REQUIREMENTS (MANDATORY CHART.JS):
- Revenue projections (line chart - 3 years)
- Cost breakdown (pie chart - operational expenses)
- Cash flow analysis (bar chart - monthly/quarterly)
- Break-even analysis (line chart with break-even point)
- Funding timeline (timeline chart)
- P&L waterfall (waterfall chart showing profit drivers)
- Unit economics (bar chart - CAC, LTV, margins)
- Scenario analysis (multi-line chart - best/base/worst case)

VISUAL HIERARCHY:
1. Section title "Financial Plan" - investment-focused tone
2. Executive summary - key financial highlights
3. Projections dashboard - comprehensive chart array
4. Funding strategy - capital requirements and sources
5. Risk analysis - scenario planning and mitigation

TECHNICAL SPECIFICATIONS:
- Use semantic HTML5 elements with financial structure
- Ensure WCAG AA contrast for all financial data and charts
- Responsive design optimized for print
- Extensive Chart.js integration for all financial metrics (NO animations, static only)
- Brand color integration via arbitrary values
- PrimeIcons for all icons (automatically available, no import needed)

CHART.JS IMPLEMENTATION (COMPREHENSIVE):
- Revenue projection charts (line, area charts)
- Cost analysis charts (pie, doughnut, bar charts)
- Cash flow visualization (bar, line combination)
- Break-even analysis (scatter, line charts)
- Funding timeline (timeline, Gantt-style)
- Financial ratios dashboard (gauge, bar charts)
- Scenario modeling (multi-line, area charts)
- Professional color schemes matching brand
- Print-friendly and accessible charts
- MANDATORY: Set animation: false in all Chart.js configurations
- MANDATORY: Do NOT include <script src="..."> tags for Chart.js CDN
- MANDATORY: Chart.js library will be injected automatically

CONTENT GUIDELINES:
- Summary: compelling investment thesis with key metrics
- Requirements: detailed capital needs with ROI justification
- Model: clear revenue streams with pricing rationale
- Projections: realistic 3-year financial forecasts
- Analysis: detailed break-even with sensitivity analysis
- Structure: comprehensive cost modeling
- Sources: strategic funding approach with terms
- Milestones: measurable financial KPIs
- Assessment: thorough risk analysis with mitigation

QUALITY STANDARDS:
- Investment-grade financial analysis
- Professional financial modeling
- Comprehensive data visualization
- Strategic financial planning
- Print-ready formatting with extensive charts

IMPORTANT:
- not add any "html" tag or prefix on output

OUTPUT FORMAT:
Return only the minified HTML section with extensive embedded Chart.js code (NO script tags, NO animations), ready for business plan integration.

IMPORTANT CHART.JS RULES:
- Always set animation: false in chart options
- Never include <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
- Chart.js library is automatically available
- Use static charts optimized for PDF generation
- chart mus not take more than 1/2 of the page
`;
