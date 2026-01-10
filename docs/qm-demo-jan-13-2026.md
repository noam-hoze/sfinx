# QM Demo - Jan 13, 2026

## Job Spec
**QM Test Case - Senior Python Engineer**  
Source: https://qm.teamme.link/jobs/F7.16E

### Weight Distribution
- **Experience (40%)**
  - Must (70%): 7+ years SW dev (20%), Production code (18%), Code review/testing (14%), Design patterns (12%), CS degree (6%)
  - Strong advantage (20%): Open source (10%), SDK development (10%)
  - Advantage (10%): Quantum computing (10%)

- **Coding (60%)**
  - Must (100%): 5+ years Python (40%), 7+ years SW dev (10%), Explain decisions (30%), Responsible AI (20%)

## Pre-recorded Candidate Guidelines

### Overview
Create 3 pre-recorded interviews showcasing external tool detection, adaptability, and real-time scoring accuracy.

**Interview Content**:
- **Experience Question**: "Tell me about a large-scale production system you built or maintained using Python. What were the architectural challenges?"
- **Coding Task**: Build `QuantumCircuitSimulator` class with gates (Hadamard, Pauli-X, CNOT) and measurement using numpy

### Candidate A - "Senior Architect" (~85%)
**Demo Focus: External tool usage WITH HIGH ACCOUNTABILITY, strong adaptability**

**Character Profile**:
- 8+ years Python, built distributed systems at fintech/tech company
- CS degree, contributed to real OSS projects, led teams
- Deep knowledge of design patterns, production systems, architecture

**Experience Guidelines**:
- **Specificity**: Give concrete examples with numbers (traffic, scale, team size)
- **Technical depth**: Name actual tools/patterns (Kafka, circuit breakers, Factory pattern)
- **Adaptability**: When interviewer changes requirements, pivot smoothly with multiple solutions
- **Leadership**: Mention mentoring, code review standards, architectural decisions

**Coding Guidelines**:
- **Ask clarifying questions** before starting
- **Use external tools TRANSPARENTLY**: "Let me look up the exact numpy syntax for Kronecker products..."
- **High accountability**: Announce searches, explain what you're looking for and why
- **Explain after pasting**: "I found this example, but I need to modify it because..."
- **Clean code**: Good names, docstrings, structured
- **Handle questions confidently**: Explain trade-offs and decisions

**Target Scores**: Experience 85-90%, Coding 80-85%, Accountability 90%+

### Candidate B - "Mid-Senior Developer" (~70%)
**Demo Focus: Moderate tool usage (SHOWCASE DETECTION), adequate adaptability**

**Character Profile**:
- 5-6 years Python, built data pipelines/APIs at mid-sized company
- Some design pattern knowledge, participated in reviews
- Less architectural ownership, fewer OSS contributions

**Experience Guidelines**:
- **Adequate but less specific**: Mention systems but fewer concrete details
- **Surface-level patterns**: Know names but struggle with trade-off explanations
- **Adaptability**: Pause when requirements change, suggest solutions but less confident
- **Leadership**: Participated, not led - "worked with team" vs "led team"

**Coding Guidelines**:
- **Pause to search documentation** - VISIBLE external tool usage (numpy docs, examples)
- **Moderate accountability**: Sometimes mention what you're looking for, sometimes just paste
- **Paste snippets** then modify - SHOWCASE PASTE DETECTION
- **Explain adequately** but less fluent: "I think this works because..."
- **Decent code** but initial gaps (missing docstrings, then add them)
- **Handle questions**: Reasonable answers but less confident

**Target Scores**: Experience 65-75%, Coding 68-73%, Accountability 60-70%

### Candidate C - "Junior-Mid Developer" (~55%)
**Demo Focus: Heavy tool usage (CLEAR DETECTION), poor adaptability**

**Character Profile**:
- 3-4 years Python, wrote automation scripts/basic services
- Limited production system experience, minimal architecture knowledge
- No OSS contributions, individual contributor

**Experience Guidelines**:
- **Generic responses**: "Made it scalable", "handled errors" without specifics
- **Weak patterns**: Mention names but can't explain implementations
- **Poor adaptability**: Struggle when requirements change, vague answers
- **No leadership**: Solo work only, minimal collaboration details

**Coding Guidelines**:
- **Heavy search/paste**: Search "quantum circuit python", copy code blocks - MULTIPLE DETECTIONS
- **Zero accountability**: Silent searches, no explanation of what or why you're looking
- **Weak explanation**: Read code aloud without explaining logic
- **Messy code**: Poor names (x, y, z), no docs, structural issues
- **Struggle with questions**: "Um, I'm not sure..." or incorrect answers
- **Bugs in solution**: Wrong dimensions, missing initialization

**Target Scores**: Experience 50-60%, Coding 53-58%, Accountability 20-30%

### Demo Showcase Mapping

**External Tool Detection & Accountability**:
- **Candidate A**: Uses tools transparently - announces searches, explains why, high accountability score
- **Candidate B**: Moderate tool usage with partial accountability - sometimes explains, sometimes silent
- **Candidate C**: Heavy tool usage with zero accountability - silent searches, unexplained pastes

**Adaptability (Curveball Handling)**:
- **Candidate A**: Smooth pivot with multiple solutions when requirements change
- **Candidate B**: Hesitate, suggest one solution with less confidence
- **Candidate C**: Struggle, give vague or incorrect responses to changes

**Real-Time Scoring Accuracy**:
- Debug panel shows score evolution matching performance quality
- Clear differentiation in category scores AND accountability scores across all 3 candidates
- Final scores align with behavioral patterns (A: 85%, B: 70%, C: 55%)

## Demo Flow

### 1. Pre-recorded Candidates (3)
Show comparative evaluation across candidates.

### 2. Live Experience Interview
**Goal**: Demonstrate intelligent, adaptive questioning.

- **Relevance**: Questions directly address job criteria (e.g., design patterns, production code)
- **Curveball Challenge**: Interviewer changes project conditions mid-discussion to test adaptability
- **Specificity**: Deep dive into candidate's actual work, not generic scenarios
- **Debug Panel**: Show real-time evaluation scoring

### 3. Live Coding Interview
**Goal**: Demonstrate technical assessment capabilities.

- **External Tool Usage**: Show how system detects and evaluates tool/AI usage
- **Real-time Evaluation**: Debug panel displays code quality metrics as candidate writes

### 4. Job Creation
**Goal**: Show automated criteria extraction and configuration.

- Real-time criteria extraction from job description (Not ready)
- Job configuration interface (weights, categories, requirements)

### 5. Candidates Dashboard
**Goal**: Show comparative view of all candidates for the job.

- Display top candidates ranked by overall score
- Comparative evaluation across multiple candidates
- Quick overview of strengths and weaknesses

### 6. CPS (Candidate Profile Summary) Page
**Goal**: Provide actionable candidate insights.

- **Experience/Coding Links**: Highlight key moments with timestamps
- Minimal representative view (Not ready - needs aggregation of all moments)

## Outstanding Items
1. Aggregated minimal view for CPS (too many moments currently)
2. Controller for browsing through the highlight moments in the video (back, play/pause, forward)
3. Optimize loading time throughout the app (for instance when a candidate clicks on a job)
4. Remove the blocking of processing the interview on submit interview
5. Curveball challenge