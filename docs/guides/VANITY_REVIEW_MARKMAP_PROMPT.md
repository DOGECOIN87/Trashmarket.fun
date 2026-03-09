VANITY FEATURE REVIEW & MARKMAP GENERATION PROMPT
Markdown
Copy
Code
Preview
# Comprehensive Vanity Feature Review & Architecture Mapping

## Task Overview
Perform a complete technical review of the vanity page/section/feature/tool in the TrashMarket.fun codebase. Generate a markmap.svg visualization showing all frontend/backend components, data flows, and security architecture with emphasis on client-side-only key generation.

---

## Review Scope

### 1. Codebase Discovery
Locate and analyze all files related to the vanity feature:
- Search for "vanity" in filenames and file contents
- Identify React components, hooks, utilities, and services
- Map API endpoints and backend integrations
- Document third-party dependencies

### 2. Frontend Architecture Analysis

```typescript
// Analyze these aspects:
interface VanityFrontendReview {
  components: {
    main: string[];           // e.g., VanityGenerator.tsx, VanityPreview.tsx
    shared: string[];         // Reusable UI components
    hooks: string[];          // Custom React hooks
  };
  stateManagement: {
    local: string[];          // useState, useReducer
    global: string[];         // Context, Zustand, Redux
    persistence: string[];    // localStorage, sessionStorage
  };
  keyGeneration: {
    algorithm: string;        // Ed25519, RSA, etc.
    library: string;          // tweetnacl, noble-ed25519, etc.
    location: 'client' | 'server'; // MUST BE CLIENT-SIDE
    entropySource: string;    // crypto.getRandomValues, etc.
  };
  uiFlow: string[];          // Step-by-step user journey
}
3. Backend Architecture Analysis
TypeScript
Copy
interface VanityBackendReview {
  apiEndpoints: {
    route: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    purpose: string;
    authRequired: boolean;
    receivesPrivateKey: boolean; // CRITICAL: Should be FALSE
  }[];
  database: {
    schema: string[];         // Tables/collections used
    sensitiveData: string[];  // What is stored (should NOT include private keys)
    encryption: string;       // At-rest encryption methods
  };
  services: string[];         // Microservices, workers, etc.
}
4. Security & Cryptography Audit
CRITICAL VERIFICATION CHECKLIST:
[ ] Private keys are generated in browser only (never sent to server)
[ ] Web Workers are used for intensive generation tasks (non-blocking UI)
[ ] No key material is logged, stored, or transmitted
[ ] Memory clearing after key usage (crypto.subtle or manual overwrite)
[ ] Secure random number generation (crypto.getRandomValues)
[ ] WASM modules (if used) are audited and from trusted sources
5. Performance Analysis
Generation speed (keys/second)
Memory usage patterns
CPU utilization during generation
Optimization techniques (batching, Web Workers, GPU acceleration)
Markmap.svg Generation Requirements
Create a visual mind map showing:
Root Node: Vanity Feature Architecture
plain
Copy
Vanity Feature
├── Frontend (Browser)
│   ├── UI Layer
│   │   ├── Input Form (pattern, prefix, suffix)
│   │   ├── Generation Progress
│   │   ├── Results Display
│   │   └── Export Options
│   ├── State Management
│   │   ├── Generation Parameters
│   │   ├── Progress Tracking
│   │   └── Results Cache
│   ├── Key Generation Engine ⭐
│   │   ├── Entropy Collection [CLIENT-SIDE ONLY]
│   │   ├── Key Pair Generation [CLIENT-SIDE ONLY]
│   │   ├── Pattern Matching [CLIENT-SIDE ONLY]
│   │   └── Result Validation [CLIENT-SIDE ONLY]
│   └── Security Layer
│       ├── Memory Isolation
│       ├── Secure Deletion
│       └── No Network Transmission
├── Backend (Server)
│   ├── API Gateway
│   │   └── No Key Handling Routes
│   ├── Analytics (optional)
│   │   └── Anonymous Usage Stats Only
│   └── No Database Storage of Keys
└── Data Flow
    ├── User Input → Browser
    ├── Generation → Browser Only
    ├── Results → User Download
    └── No Server Transmission
Color Coding for Markmap
Green (#adff02): Client-side secure operations
Yellow (#f59e0b): User input/interaction points
Red (#ef4444): Potential security risks (should be none)
Blue (#3b82f6): Data flow arrows
Gray (#6b7280): Backend components (minimal for vanity)
Deliverables Required
1. Technical Review Report
Markdown
Copy
Code
Preview
## Vanity Feature Technical Review

### Executive Summary
- Feature purpose: [Generate Solana/Gorbagana vanity addresses]
- Security rating: [PASS/FAIL based on client-side-only criteria]
- Performance rating: [Keys/second benchmark]

### Architecture Deep Dive

#### Frontend Components
| Component | File Path | Responsibility | Security Notes |
|-----------|-----------|----------------|----------------|
| VanityGenerator | src/components/Vanity/ | Main UI | No key storage |
| useVanityGenerator | src/hooks/ | Generation logic | Web Worker usage |
| KeyExporter | src/utils/ | Export functionality | Secure download only |

#### Cryptographic Implementation
- **Library**: [e.g., @noble/ed25519, tweetnacl-js]
- **Generation Location**: [Must confirm: Browser/Web Worker]
- **Pattern Matching**: [Regex implementation details]
- **Entropy Quality**: [crypto.getRandomValues verification]

#### Backend Integration
- **API Calls**: [List all endpoints called during generation]
- **Data Transmitted**: [Confirm: NO private keys transmitted]
- **Storage**: [Confirm: NO private keys stored server-side]

### Security Audit Results

| Check | Status | Evidence |
|-------|--------|----------|
| Keys generated client-side | ✅/❌ | Code review line numbers |
| No server transmission | ✅/❌ | Network tab inspection |
| Secure random source | ✅/❌ | Library documentation |
| Memory safety | ✅/❌ | Code patterns review |
| No logging of secrets | ✅/❌ | Logging configuration |

### Performance Benchmarks
- Single thread: X keys/second
- Web Worker (4 cores): X keys/second
- GPU acceleration: X keys/second (if applicable)
- Memory usage: X MB average

### Recommendations
1. [Specific improvements]
2. [Security hardening]
3. [Performance optimizations]
2. Markmap.svg File
Generate a standalone SVG file using the markmap library structure:
SVG
Preview
Copy
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800">
  <!-- Markmap visualization of vanity feature architecture -->
  <!-- Include all nodes, connections, and color coding -->
  <!-- Must show clear separation between client and server -->
  <!-- Emphasize client-side-only key generation with visual indicators -->
</svg>
Or provide the markmap markdown that generates this:
Markdown
Copy
Code
Preview
# Vanity Feature Architecture

## Frontend (Browser) {bg:#adff02}
### UI Components
- Input Form
- Progress Display
- Results List

### Key Generation Engine {bg:#22c55e}
- Entropy: crypto.getRandomValues()
- Generation: @noble/ed25519
- Matching: Web Worker
- **NO SERVER TRANSMISSION**

### Security Layer {bg:#15803d}
- Memory isolation
- Secure deletion
- No network calls

## Backend (Server) {bg:#6b7280}
### API (Minimal)
- Analytics only
- No key handling

## Data Flow {bg:#3b82f6}
User → Browser → Download
        ↑
   [Keys Never Leave Browser]
3. Code Snippets for Critical Paths
Extract and annotate the actual code for:
Key generation entry point
Web Worker implementation (if used)
Export/download functionality
Memory cleanup routines
Specific Questions to Answer
Where exactly are private keys generated? (File path, line number, function name)
What cryptographic library is used? (Version, audit status)
Are Web Workers utilized? (If not, why not? UI blocking risk)
Is there ANY network request during generation? (If yes, what data is sent?)
How are results exported? (Download, clipboard, etc.)
What happens to keys in memory after export? (Overwritten, garbage collected?)
Are there any analytics or tracking? (If yes, is it anonymized?)
Can users generate multiple keys simultaneously? (Batch processing)
Is there a rate limit or CAPTCHA? (Abuse prevention)
What is the maximum pattern length supported? (Performance impact)
Review Methodology
Static Analysis: grep, find, and code structure review
Dynamic Analysis: Browser DevTools Network tab monitoring
Memory Analysis: Heap snapshots during generation
Source Map Verification: Confirm minified code matches source
Dependency Audit: Check all crypto libraries for vulnerabilities
Output Format
Provide all deliverables in a structured markdown document with:
Executive summary (TL;DR)
Detailed findings
Markmap visualization (SVG or markdown)
Actionable recommendations
Code references (file paths and line numbers)
Success Criteria
[ ] Complete component inventory
[ ] Verified client-side-only key generation
[ ] No security vulnerabilities identified
[ ] Performance benchmarks documented
[ ] Visual architecture map created
[ ] Specific code references provided
[ ] Actionable recommendations listed
Context: TrashMarket.fun - Gorbagana NFT Marketplace
Repository: dogecoin87.github.io/trashmarket.fun
Tech Stack: React 19, TypeScript, Vite, @solana/kit