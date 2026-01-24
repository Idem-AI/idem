export const USAGE_GUIDELINES_SECTION_PROMPT = `
You are a brand systems expert and design standards specialist. Generate comprehensive, professional usage guidelines in HTML using only Tailwind CSS classes. Create actionable rules based on project data and logo assets.

REQUIREMENTS:
1. Output valid HTML only, no explanations
2. Use Tailwind utility classes exclusively (no custom CSS or JS)
3. For icons, use PrimeIcons classes (pi pi-icon-name) - PrimeIcons CSS is automatically available, do NOT import or use CDN
4. Output as a single line
5. Format optimized for A4 portrait (210mm x 297mm)
6. Include interactive visual examples and clear do/don't comparisons

COMPREHENSIVE STRUCTURE:
<section class="w-full py-16 px-8 bg-gradient-to-b from-white to-gray-50">
  <div class="max-w-7xl mx-auto">
    <div class="text-center mb-16">
      <h2 class="text-4xl font-black text-gray-900 mb-4 tracking-tight">Usage Guidelines</h2>
      <div class="w-24 h-1 bg-gradient-to-r from-green-600 to-teal-600 mx-auto mb-6 rounded-full"></div>
      <p class="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">Essential rules and best practices to maintain brand consistency and visual integrity across all applications.</p>
    </div>
    
    <!-- Logo Usage Guidelines -->
    <div class="mb-20">
      <div class="flex items-center gap-4 mb-12">
        <div class="w-4 h-4 bg-green-600 rounded-full"></div>
        <h3 class="text-3xl font-bold text-gray-900">Logo Usage</h3>
      </div>
      
      <!-- Clear Space & Sizing -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
        <div class="bg-white rounded-3xl p-8 shadow-lg border border-gray-100">
          <h4 class="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <div class="w-3 h-3 bg-amber-500 rounded-full"></div>
            Clear Space Requirements
          </h4>
          <div class="bg-amber-50 rounded-2xl p-8 mb-6 border border-amber-200">
            <div class="flex items-center justify-center min-h-32">
              <img src=\"{{logo_url}}\" alt=\"Logo with clear space\" class=\"max-h-20 object-contain\" />
            </div>
          </div>
          <div class="space-y-3 text-sm text-gray-700">
            <p class="font-semibold text-gray-800">Minimum Clear Space:</p>
            <ul class="space-y-2 pl-4">
              <li class="flex items-start gap-2"><span class="text-amber-500 mt-1">•</span>Equal to the height of the logo symbol on all sides</li>
              <li class="flex items-start gap-2"><span class="text-amber-500 mt-1">•</span>Never place text or graphics within this zone</li>
              <li class="flex items-start gap-2"><span class="text-amber-500 mt-1">•</span>Maintain proportional spacing when scaling</li>
            </ul>
          </div>
        </div>
        
        <div class="bg-white rounded-3xl p-8 shadow-lg border border-gray-100">
          <h4 class="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <div class="w-3 h-3 bg-blue-500 rounded-full"></div>
            Minimum Size Standards
          </h4>
          <div class="bg-blue-50 rounded-2xl p-8 mb-6 border border-blue-200">
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium text-gray-700">Digital (Screen):</span>
                <span class="font-mono text-sm bg-white px-3 py-1 rounded border">24px height</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium text-gray-700">Print:</span>
                <span class="font-mono text-sm bg-white px-3 py-1 rounded border">0.5 inch height</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium text-gray-700">Large Format:</span>
                <span class="font-mono text-sm bg-white px-3 py-1 rounded border">2 inch height</span>
              </div>
            </div>
          </div>
          <p class="text-sm text-gray-600 leading-relaxed">These minimum sizes ensure legibility and brand recognition across all media formats.</p>
        </div>
      </div>
      
      <!-- Do's and Don'ts -->
      <div class="bg-white rounded-3xl p-10 shadow-lg border border-gray-100">
        <h4 class="text-2xl font-bold text-gray-900 mb-8 text-center">Logo Do's & Don'ts</h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-12">
          <!-- Do's -->
          <div>
            <div class="flex items-center gap-3 mb-6">
              <div class="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <svg class="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                </svg>
              </div>
              <h5 class="text-lg font-bold text-green-800">Do</h5>
            </div>
            <div class="space-y-4">
              <div class="bg-green-50 rounded-xl p-6 border border-green-200">
                <div class="flex items-center justify-center mb-4 min-h-20">
                  <img src=\"{{logo_url}}\" alt=\"Correct logo usage\" class=\"max-h-16 object-contain\" />
                </div>
                <p class="text-sm text-green-800 text-center font-medium">Use official logo files only</p>
              </div>
              <ul class="space-y-2 text-sm text-gray-700">
                <li class="flex items-start gap-2"><span class="text-green-500 mt-1">✓</span>Maintain original proportions</li>
                <li class="flex items-start gap-2"><span class="text-green-500 mt-1">✓</span>Use appropriate version for background</li>
                <li class="flex items-start gap-2"><span class="text-green-500 mt-1">✓</span>Ensure sufficient contrast</li>
                <li class="flex items-start gap-2"><span class="text-green-500 mt-1">✓</span>Scale proportionally</li>
              </ul>
            </div>
          </div>
          
          <!-- Don'ts -->
          <div>
            <div class="flex items-center gap-3 mb-6">
              <div class="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                <svg class="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                </svg>
              </div>
              <h5 class="text-lg font-bold text-red-800">Don't</h5>
            </div>
            <div class="space-y-4">
              <div class="bg-red-50 rounded-xl p-6 border border-red-200">
                <div class="flex items-center justify-center mb-4 min-h-20">
                  <div class="transform skew-x-12 bg-gray-300 w-16 h-12 flex items-center justify-center text-xs text-gray-600">DISTORTED</div>
                </div>
                <p class="text-sm text-red-800 text-center font-medium">Never distort or stretch the logo</p>
              </div>
              <ul class="space-y-2 text-sm text-gray-700">
                <li class="flex items-start gap-2"><span class="text-red-500 mt-1">✗</span>Change colors or effects</li>
                <li class="flex items-start gap-2"><span class="text-red-500 mt-1">✗</span>Rotate or skew the logo</li>
                <li class="flex items-start gap-2"><span class="text-red-500 mt-1">✗</span>Use on busy backgrounds</li>
                <li class="flex items-start gap-2"><span class="text-red-500 mt-1">✗</span>Recreate or modify elements</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Typography Guidelines -->
    <div class="mb-20">
      <div class="flex items-center gap-4 mb-12">
        <div class="w-4 h-4 bg-purple-600 rounded-full"></div>
        <h3 class="text-3xl font-bold text-gray-900">Typography Standards</h3>
      </div>
      
      <div class="bg-white rounded-3xl p-10 shadow-lg border border-gray-100">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div>
            <h4 class="text-xl font-bold text-gray-900 mb-6">Hierarchy & Spacing</h4>
            <div class="space-y-6">
              <div class="border-l-4 border-purple-500 pl-6">
                <h5 class="text-2xl font-bold text-gray-900 mb-2">Headlines</h5>
                <p class="text-sm text-gray-600 mb-3">Use primary typeface, bold weight</p>
                <div class="bg-gray-50 rounded-lg p-4">
                  <p class="text-xs text-gray-500 mb-1">Line Height: 1.2 | Letter Spacing: -0.02em</p>
                  <p class="text-xs text-gray-500">Sizes: 32px - 72px desktop, 24px - 48px mobile</p>
                </div>
              </div>
              <div class="border-l-4 border-blue-500 pl-6">
                <h5 class="text-lg font-semibold text-gray-900 mb-2">Body Text</h5>
                <p class="text-sm text-gray-600 mb-3">Use secondary typeface, regular weight</p>
                <div class="bg-gray-50 rounded-lg p-4">
                  <p class="text-xs text-gray-500 mb-1">Line Height: 1.6 | Letter Spacing: 0</p>
                  <p class="text-xs text-gray-500">Sizes: 16px - 18px desktop, 14px - 16px mobile</p>
                </div>
              </div>
            </div>
          </div>
          
          <div>
            <h4 class="text-xl font-bold text-gray-900 mb-6">Accessibility Standards</h4>
            <div class="space-y-4">
              <div class="bg-green-50 rounded-xl p-6 border border-green-200">
                <h5 class="text-lg font-semibold text-green-800 mb-3">WCAG AA Compliance</h5>
                <ul class="space-y-2 text-sm text-green-700">
                  <li class="flex items-start gap-2"><span class="text-green-500 mt-1">✓</span>Minimum 4.5:1 contrast ratio for normal text</li>
                  <li class="flex items-start gap-2"><span class="text-green-500 mt-1">✓</span>Minimum 3:1 contrast ratio for large text</li>
                  <li class="flex items-start gap-2"><span class="text-green-500 mt-1">✓</span>Minimum 14px font size for body text</li>
                  <li class="flex items-start gap-2"><span class="text-green-500 mt-1">✓</span>Scalable fonts up to 200% without loss of functionality</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Color Usage Guidelines -->
    <div>
      <div class="flex items-center gap-4 mb-12">
        <div class="w-4 h-4 bg-indigo-600 rounded-full"></div>
        <h3 class="text-3xl font-bold text-gray-900">Color Application</h3>
      </div>
      
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div class="bg-white rounded-3xl p-8 shadow-lg border border-gray-100">
          <h4 class="text-xl font-bold text-gray-900 mb-6">Primary Color Usage</h4>
          <div class="space-y-4">
            <div class="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
              <div class="w-12 h-12 bg-blue-600 rounded-lg flex-shrink-0"></div>
              <div>
                <p class="font-semibold text-gray-800">Dominant Brand Color</p>
                <p class="text-sm text-gray-600">Use for primary CTAs, headers, key elements</p>
              </div>
            </div>
            <ul class="space-y-2 text-sm text-gray-700 pl-4">
              <li class="flex items-start gap-2"><span class="text-indigo-500 mt-1">•</span>Maximum 30% of total design area</li>
              <li class="flex items-start gap-2"><span class="text-indigo-500 mt-1">•</span>Always ensure sufficient contrast</li>
              <li class="flex items-start gap-2"><span class="text-indigo-500 mt-1">•</span>Use sparingly for maximum impact</li>
            </ul>
          </div>
        </div>
        
        <div class="bg-white rounded-3xl p-8 shadow-lg border border-gray-100">
          <h4 class="text-xl font-bold text-gray-900 mb-6">Supporting Colors</h4>
          <div class="space-y-4">
            <div class="grid grid-cols-3 gap-3 mb-4">
              <div class="aspect-square bg-gray-200 rounded-lg"></div>
              <div class="aspect-square bg-gray-600 rounded-lg"></div>
              <div class="aspect-square bg-gray-100 rounded-lg"></div>
            </div>
            <ul class="space-y-2 text-sm text-gray-700">
              <li class="flex items-start gap-2"><span class="text-indigo-500 mt-1">•</span>Use for backgrounds and neutral elements</li>
              <li class="flex items-start gap-2"><span class="text-indigo-500 mt-1">•</span>Maintain visual hierarchy</li>
              <li class="flex items-start gap-2"><span class="text-indigo-500 mt-1">•</span>Test across different devices</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Quick Reference Card -->
    <div class="mt-16 bg-gradient-to-r from-slate-800 to-gray-900 rounded-3xl p-10 text-white">
      <h3 class="text-2xl font-bold mb-8 text-center">Quick Reference</h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
        <div>
          <div class="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"></path>
            </svg>
          </div>
          <h4 class="font-bold mb-2">Logo</h4>
          <p class="text-sm text-gray-300">Min 24px digital, 0.5\" print</p>
        </div>
        <div>
          <div class="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-6a1 1 0 00-1-1H9a1 1 0 00-1 1v6a1 1 0 01-1 1H4a1 1 0 110-2V4z" clip-rule="evenodd"></path>
            </svg>
          </div>
          <h4 class="font-bold mb-2">Typography</h4>
          <p class="text-sm text-gray-300">Min 14px, 4.5:1 contrast</p>
        </div>
        <div>
          <div class="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4zm3 2h2v4h4V6h2v8h-2v-4H9v4H7V4z" clip-rule="evenodd"></path>
            </svg>
          </div>
          <h4 class="font-bold mb-2">Colors</h4>
          <p class="text-sm text-gray-300">Primary max 30%, test contrast</p>
        </div>
      </div>
    </div>
  </div>
</section>

CONTENT REQUIREMENTS:
- Replace {{logo_url}} with actual logo URLs from project data in variations?: {
    lightBackground?: string; // Version optimized for light backgrounds
    darkBackground?: string; // Version optimized for dark backgrounds
    monochrome?: string; // Simplified version in black or white
  };
  logo.svg is url of principal logo
- Include specific measurements and technical specifications
- Provide actionable, measurable guidelines
- Ensure all recommendations support accessibility standards
- Maintain professional, instructional tone throughout
- Include visual examples for clarity

IMPORTANT:
- not add any "html" tag or prefix on output
LOGO URLS AND PROJECT DESCRIPTION:

`;
