# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project adheres to Semantic Versioning.

## [1.16.1] - 2025-11-08

### Fixed

- Background session guard respects job-configured timebox duration, eliminating premature timebox transitions and aligning debug reason with the actual timer.

## [1.15.0] - 2025-09-10

### Added

- **App Route Groups**: Introduced `(auth)` and `(features)` route groups for better organization
- **Shared Directory**: New `app/shared/` folder consolidating components, contexts, hooks, and services
- **Server Directory Structure**: Reorganized server-side code under `server/` folder
- **Blueprint Documentation**: Moved blueprint docs to appropriate locations (`app/` and `server/`)

### Changed

- **Major App Structure Refactoring**: Complete reorganization of app directory structure
  - Moved `lib/components/` → `app/shared/components/`
  - Moved `lib/contexts/` → `app/shared/contexts/`
  - Moved `lib/hooks/` → `app/shared/hooks/`
  - Moved `lib/services/` → `app/shared/services/`
  - Moved authentication pages to `app/(auth)/`
  - Moved feature pages to `app/(features)/`
- **Server Organization**: Reorganized backend structure
  - Moved `scripts/` → `server/db-scripts/`
  - Moved `prisma/` → `server/prisma/`
  - Moved `tests/` → `server/tests/`
  - Moved `Blueprint/` docs to `app/` and `server/`
- **Import Path Updates**: Updated all import statements to reflect new file structure
- **Data Organization**: Consolidated data files and improved organization

### Enhanced

- **Code Organization**: Improved separation of concerns with logical folder structure
- **Developer Experience**: More intuitive file organization and navigation
- **Maintainability**: Better code structure for future development

### Technical

- **File Restructuring**: 90+ files moved and reorganized across the codebase
- **Import Consistency**: Systematic updates to all import paths
- **Asset Management**: Better organization of static files and documentation

## [1.13.2] - 2025-09-09

### Changed
## [1.14.0] - 2025-09-09

### Added

- Automatic mode: hides Start Coding, auto-starts on AI phrase; editor overlay until start
- Scoped logging: namespaced loggers for InterviewIDE and RealTimeConversation
- Framer Motion animations for controls (slide-only transitions, no fades)

### Changed

- Start Interview button slides out and unmounts; Submit/Timer slide in; no layout gaps
- Overlay restyled with clean, minimal look; captions preserved

### Fixed

- Robust trigger detection (case-insensitive, punctuation-insensitive) and start after speech ends


- Interview flow: rely on single hidden completion message; removed `has_submitted` from KB updates.
- AI nudge: send added code only via hidden message; immediately revert to reactive mode (using_ai=false).
- One-time latches: ensure single close and single completion message across manual submit/timer.
- Spec docs: added `INTERVIEW_FLOW_SPEC.md` and aligned `AI_INTERVIEWER_PROMPT.md` guidance.

### Fixed

- Duplicate closing lines caused by dual end signals and HMR replays.
- Double-conclusion race by gating finalization and message sends.

## [1.12.0] - 2025-09-08

## [1.13.1] - 2025-09-09

### Changed

- Session creation is atomic: creates session + zeroed telemetry (+workstyle + gapAnalysis) in one transaction.
- Removed premature Prisma disconnect; added rich debug logs and error payloads.
- Applications API now deterministic: requires jobId and reuses strictly by candidateId+jobId.
- CPS insights components now render data from telemetry and show empty graphs when arrays are empty (no demo fallbacks).

### Fixed

- Typo `interviewSStessionId` → `interviewSessionId` in telemetry create.
- Client updated to send `{ companyId, jobId }` when creating applications.

## [1.13.0] - 2025-09-09

### Added

- Evidence categories for clips (Iteration Speed, Debug Loop, Refactor & Cleanups, AI Assist Usage)
- Zeroed telemetry auto-creation on new interview sessions (ensures CPS shows all sessions)

### Changed

- Job search: cards show jobs (flattened) with role details; API filters by role/location properly
- Applications API: reuse existing application per candidate+job to avoid duplicates
- Telemetry GET: builds evidence links using category (with title fallback)

### Fixed

- CPS telemetry GET returns 200 with empty sessions for candidates without telemetry
- Seeded Noam evidence clips categorized to drive evidence links correctly

### Added

- **Interview Loading State**: Loading button with spinner during interview start process
- **Permission-Gated Interview Start**: Interview only starts if screen sharing permission is granted
- **Visual Loading Feedback**: Spinner and "Starting Interview..." text during setup

### Changed

- **Interview Start Flow**: Screen recording permission checked FIRST before any backend operations
- **Button State Management**: Start Interview button shows loading state and prevents multiple clicks
- **Interview Initialization**: Complete backend setup (application, session, recording) only after permission approval

### Enhanced

- **User Experience**: Clear visual feedback during interview initialization process
- **Error Handling**: Graceful handling when users deny screen sharing permission
- **Loading States**: Consistent loading patterns matching app design standards

### Technical

- **Permission-First Architecture**: Screen sharing permission validation before backend operations
- **Loading State Management**: Proper loading state cleanup on success, failure, or permission denial
- **UI State Synchronization**: Loading states properly coordinated across interview components

## [1.11.0] - 2025-09-08

### Changed

- **Interview Flow Simplification**: Removed manual stop interview functionality - interviews now run to natural completion only
- **Timer Expiration Handling**: Timer expiration now performs the same cleanup as user submission (recording stop, state machine submission, "I'm done" message)
- **UI Cleanup**: Removed REC/MIC recording indicators from header - recording still works but without visual indicators
- **Start Button Behavior**: Start Interview button now disappears completely after clicking, preventing any manual stop controls

### Enhanced

- **Interview State Management**: Simplified interview lifecycle with guaranteed cleanup on both timer expiration and user submission
- **Backend Order Assurance**: Confirmed application and interview session creation happens before any recording/frontend operations

### Technical

- **Interview Button Logic**: Removed conditional stop/start logic, simplified to one-way start trigger
- **State Synchronization**: Ensured timer expiration and submission use identical cleanup procedures

## [1.10.0] - 2025-09-08

### Changed

-   AI usage flow simplified: EditorPanel sets `using_ai` on paste > 50; state machine now mirrors to ElevenLabs via KB_UPDATE and sends one hidden nudge message on rising edge.
-   Removed SYS tags, timers, turns, fairness/metrics; lean `useElevenLabsStateMachine` with clear docs.

### Added

-   Inline documentation for `lib/hooks/useElevenLabsStateMachine.ts` and a constant nudge message string.

### Fixed

-   Consistent inclusion of `using_ai` in KB_UPDATEs to prevent accidental clearing by subsequent updates.

## [1.9.2] - 2025-09-06

### Added

-   **Video Format Conversion**: MP4 conversion utility for screen recordings using ffmpeg
-   **Test Video Stack Page**: New test page for VidStack video player implementation
-   **Recording File Management**: Organized storage of WebM and MP4 recording files

### Enhanced

-   **API Improvements**: Updates to applications, candidates, and company API routes
-   **UI Components**: Enhanced EvidenceReel and CPS page components
-   **Layout Optimization**: Improved global CSS and app layout structure

### Technical

-   **Video Processing**: FFmpeg integration for WebM to MP4 conversion with optimized settings
-   **File Storage**: Enhanced recording file management in public/uploads/recordings/
-   **Component Architecture**: Improved component structure and performance

## [1.9.1] - 2025-09-06

### Enhanced

-   **Code Formatting**: Improved code formatting and readability in telemetry API route with consistent quote usage and line breaks

## [1.9.0] - 2025-09-06

### Added

-   **Complete Screen Recording System**: Full screen recording functionality for interview sessions with automatic upload and database integration
-   **Recording Permission Management**: Intelligent permission handling for tab/window/screen recording with fallback support
-   **Recording Indicator UI**: Visual recording indicator with "REC" badge and status colors (red when recording, green when ready)
-   **Auto-Upload System**: Automatic recording upload and database update when interviews complete
-   **Recording API Endpoints**: New `/api/interviews/session/screen-recording` and `/api/interviews/session/[sessionId]` endpoints
-   **Recording Storage**: Organized recording storage in `public/uploads/recordings/` directory
-   **Database Integration**: InterviewSession `videoUrl` field populated with recording URLs
-   **Codec Fallback Support**: Automatic fallback from VP9 → VP8 → WebM → default for browser compatibility
-   **Recording Timing**: Intelligent recording start/stop tied to interview lifecycle
-   **MediaRecorder Optimization**: Periodic data collection with proper blob creation and cleanup

### Enhanced

-   **Interview Flow**: Seamless recording integration with existing interview session management
-   **User Experience**: Non-intrusive recording indicator positioned next to timer/submit controls
-   **Performance**: Optimized MediaRecorder with timeslice parameters and proper stream cleanup
-   **Error Handling**: Robust error handling for recording permissions and upload failures
-   **Browser Compatibility**: Cross-browser support with codec detection and fallbacks

### Fixed

-   **Race Condition**: Fixed stale closure issue that prevented recording uploads by using refs instead of state dependencies
-   **Timing Issues**: Resolved upload failures by moving upload logic to MediaRecorder's `onstop` event
-   **File Storage**: Corrected file paths for recording storage (`public/uploads/recordings/` instead of `public/recordings/`)
-   **API Authentication**: Temporarily disabled auth checks for debugging (can be re-enabled once stable)

### Technical

-   **MediaRecorder Integration**: Complete browser MediaRecorder API integration with event-driven architecture
-   **File Upload System**: Secure file upload handling with proper FormData and fetch API usage
-   **Database Schema**: Leveraged existing InterviewSession `videoUrl` field for recording URLs
-   **State Management**: Enhanced state management with refs to prevent stale closure issues
-   **API Architecture**: RESTful endpoints for recording upload and session updates with proper error handling

### Security

-   **File Upload Security**: Proper file handling with size validation and secure storage paths
-   **Authentication Integration**: Framework ready for re-enabling authentication on recording endpoints

## [1.8.1] - 2025-09-06

### Fixed

-   **Interview Conclusion Telemetry**: Separated telemetry creation into single event handler to prevent duplicate API calls
-   **Application Creation API**: Removed `(prisma as any)` type casting that was causing 500 errors
-   **Candidate Telemetry API**: Fixed 404 errors by querying for telemetry data existence instead of session status

### Technical

-   **Type Safety**: Proper Prisma client usage without type casting bypasses
-   **API Reliability**: More robust telemetry data retrieval with flexible query conditions

## [1.8.0] - 2025-09-06

### Added

-   **Complete Telemetry Database System**: Full telemetry data storage with InterviewSession, TelemetryData, WorkstyleMetrics, GapAnalysis, EvidenceClip, and VideoChapter tables
-   **Candidate Telemetry API**: New `/api/candidates/[id]/telemetry` endpoint for retrieving candidate telemetry data from database
-   **Database Seed System**: Comprehensive seeding for Noam's complete telemetry profile (21 records)
-   **Dynamic Profile Images**: CPS page now displays actual candidate images from database instead of hardcoded paths

### Enhanced

-   **CPS Page Database Integration**: Candidate Profile Story page now fetches real telemetry data instead of mock data
-   **Company Dashboard Navigation**: Clickable candidate cards navigate to CPS page with dynamic data loading
-   **Prisma Client Optimization**: Proper singleton pattern across all API routes to prevent connection issues
-   **API Response Structure**: Enhanced telemetry API returns complete candidate profile with image, metrics, and evidence data

### Fixed

-   **Prisma Connection Errors**: Resolved "Engine is not yet connected" errors with proper client instantiation
-   **TypeScript Type Errors**: Fixed implicit 'any' type errors in telemetry data mapping
-   **Profile Image Sources**: CPS page now uses dynamic database images with proper fallbacks
-   **API Response Consistency**: Telemetry API now includes all required candidate profile fields

### Technical

-   **Database Schema Extensions**: Added 8 new telemetry-related tables with proper relationships
-   **API Route Optimization**: All API routes now use singleton Prisma client pattern
-   **Type Safety Improvements**: Enhanced TypeScript types for telemetry data structures
-   **Data Flow Architecture**: Complete pipeline from database → API → frontend for telemetry data

## [1.7.0] - 2025-09-06

### Added

-   **Application Database Integration**: Complete application tracking system with database persistence
-   **Interview Completion Flow**: Automatic application creation when interviews are completed
-   **Company Dashboard Integration**: Real-time display of applied candidates for company users
-   **Job-Specific Applications**: Link applications to specific jobs within companies
-   **Application Status Tracking**: PENDING status for newly created applications

### Enhanced

-   **Authentication Context**: Improved session handling to prevent unnecessary API calls on login pages
-   **Database Relationships**: Proper linking between applications, jobs, and companies
-   **API Error Handling**: Robust error handling for application creation and retrieval
-   **User Experience**: Seamless flow from interview completion to application tracking

### Fixed

-   **401 Errors on Login**: Removed unnecessary API calls when users are not authenticated
-   **Duplicate API Calls**: Prevented multiple application creation attempts
-   **Company Dashboard Data**: Fixed relationship issues between companies and applications
-   **Prisma Type Issues**: Resolved TypeScript errors with Prisma client usage

### Technical

-   **Application API**: New `/api/applications/create` endpoint for application management
-   **Enhanced Company Candidates API**: Updated to work with proper database relationships
-   **Session-Based Context Loading**: Only load user data when authenticated
-   **Database Schema Integration**: Full integration with existing Prisma models

## [1.6.1] - 2025-09-06

### Added

-   **Profile Image Upload**: Complete profile image upload system with API endpoint and file handling
-   **Company Dashboard Settings**: Dedicated settings page for company dashboard users
-   **User Settings Page**: New settings page for user profile management
-   **Header Component**: New reusable Header component for consistent navigation
-   **Profile Image Storage**: Organized profile image storage in public/uploads/profiles/

### Enhanced

-   **Company Dashboard**: Improved company dashboard with settings access
-   **CPS Evidence Reel**: Enhanced evidence reel component functionality
-   **Job Search Page**: Updated job search page with latest improvements
-   **Authentication System**: Enhanced authentication flow and user management
-   **Layout Structure**: Improved overall app layout and navigation

### Technical

-   **Database Check Script**: Enhanced database verification and health check functionality
-   **API Architecture**: New upload API endpoint with proper file handling
-   **Component Organization**: Better component structure and reusability
-   **File Upload System**: Secure file upload handling for profile images

## [1.6.0] - 2025-09-06

### Added

-   **Database Integration**: Complete PostgreSQL database setup with Prisma ORM
-   **Mock Data Population**: Automated database seeding script with 14 companies and 42 jobs
-   **Database-Driven Job Search**: Job search page now pulls data from database instead of mock files
-   **Role-Based Authentication**: Comprehensive authentication system with strict role separation
-   **Protected Pages**: Page-level access control for different user types (Candidate, Company, Admin)
-   **API Endpoints**: RESTful API routes for companies and jobs data retrieval
-   **Company Dashboard Protection**: Dedicated dashboard for company users with role-based access
-   **CPS Page Protection**: Candidate Performance System accessible only to company users

### Enhanced

-   **Job Search Experience**: Real-time database queries with filtering and search capabilities
-   **Authentication Flow**: Enhanced session management with automatic role-based redirects
-   **Data Architecture**: Structured database schema with proper relationships and constraints
-   **Error Handling**: Robust error handling for database operations and API failures

### Technical

-   **Prisma Schema**: Complete database schema with Company, Job, and User models
-   **Database Migrations**: Automated migration system for schema updates
-   **API Route Architecture**: Clean separation between frontend and backend data access
-   **Type Safety**: Full TypeScript integration with database models and API responses
-   **Authentication Guards**: Reusable AuthGuard component for route protection
-   **Role-Based Access Control**: Strict enforcement of user permissions across all pages

### Security

-   **Page-Level Protection**: All sensitive pages now require proper authentication and role verification
-   **Cross-Role Isolation**: Complete separation between candidate and company user experiences
-   **Admin Override**: Administrative users maintain access to all system features

## [1.5.0] - 2025-09-06

### Added

-   **Role-Based Redirection**: Automatic redirection from root page based on user type
-   **Company Dashboard**: New dashboard page for company users with basic structure
-   **User Authentication Flow**: Enhanced root page with session-based routing

### Enhanced

-   **Navigation Flow**: Seamless user experience with automatic role-based page routing
-   **Authentication Integration**: Improved integration with NextAuth session management

### Technical

-   **Client-Side Routing**: useSession hook integration for role-based navigation
-   **Loading States**: Professional loading indicator during redirection process

## [1.4.0] - 2025-09-06

### Added

-   **Applied Company Tracking**: Green checkmark indicator for companies where interviews have been completed
-   **Job Application State Management**: Global context for tracking applied companies across pages
-   **Interview Conclusion Integration**: Automatic marking of companies as applied when interviews complete
-   **Persistent Application Status**: Applied company status survives browser sessions via localStorage

### Enhanced

-   **Interview Page Access Control**: Now requires company name parameter for proper state management
-   **Navigation Improvements**: Updated company card links to pass company name alongside logo
-   **State Persistence**: Applied status automatically saved and restored across sessions

### Technical

-   **Global Context Architecture**: New JobApplicationContext for cross-page state management
-   **LocalStorage Integration**: Persistent storage of applied company status
-   **Clean State Management**: Minimal, surgical implementation following project conventions

## [1.3.1] - 2025-09-05

### Fixed

-   **Import Path Updates**: Complete migration to new lib/ folder structure
-   **Asset Organization**: Restructured public assets into logical folders (images/, logos/, video/)
-   **Blueprint Documentation**: Removed remaining counter task references
-   **Component Cleanup**: Removed Heygen API and avatar system remnants
-   **File Structure**: Consolidated interview-related files into contexts/ folder

### Technical

-   **Code Organization**: Improved folder structure and import consistency
-   **Asset Management**: Better organization of static files and media
-   **Documentation**: Updated demo scripts and UI design documents
-   **Dependencies**: Cleaned up unused component references and imports

## [1.3.0] - 2025-09-05

### Added

-   **Coding Timer System**: Complete 30-minute timer implementation with visual countdown
-   **Start/Stop/Submit Controls**: Interactive buttons for coding session management
-   **Editor Access Control**: Editor becomes read-only until coding session starts
-   **Timer Visual Feedback**: Timer display with red warning when < 5 minutes remain
-   **KB Submission System**: ElevenLabs KB variables for code submission tracking
-   **Session State Management**: Proper timer cleanup and state synchronization

### Enhanced

-   **Interview Flow**: Streamlined coding session with clear start/stop/submit progression
-   **User Experience**: Visual feedback and conditional UI based on session state
-   **Performance**: Efficient timer implementation without unnecessary re-renders

### Technical

-   **Timer Architecture**: Direct interval management without useEffect abuse
-   **State Synchronization**: Proper cleanup of timers across component lifecycle
-   **ElevenLabs Integration**: Enhanced KB variable management for coding sessions

## [1.2.0] - 2025-09-04

### Added

-   **Eleven Labs TTS Integration**: Complete text-to-speech system with API route and audio playback
-   **Voice Synthesis**: Professional female voice (Rachel) for AI responses
-   **Audio Playback**: Automatic speech synthesis for all AI messages
-   **TTS API Route**: `/api/tts` endpoint for text-to-speech conversion
-   **Voice Configuration**: Customizable voice settings and model parameters

### Removed

-   **Seed functionality**: Removed unused seed script and debug API route
-   **Database seeding**: Removed `/prisma/seed.ts` and `/api/debug/seed` endpoint
-   **Test signed URL API**: Removed `/api/test-signed-url` endpoint and consolidated to production route
-   **OpenAI integration**: Removed `/api/chat` route and `lib/interview/openai.ts` utility
-   **Prisma ORM**: Removed Prisma database integration, schema, and client dependencies
-   **Conversation API**: Removed `/api/conversation` endpoint (ElevenLabs conversational AI)

### Enhanced

-   **Audio Integration**: Seamless TTS playback in chat interface
-   **Error Handling**: Graceful fallback when TTS fails
-   **API Architecture**: Clean separation between chat and TTS endpoints

### Fixed

-   **TypeScript Errors**: Resolved material cloning and ArrayBuffer issues
-   **SDK Compatibility**: Replaced problematic Eleven Labs SDK with direct API calls
-   **Import Issues**: Fixed module import problems with @types/three
-   **Avatar Positioning**: Improved 3D avatar placement and scaling

### Technical

-   **Eleven Labs API**: Direct HTTP integration with voice synthesis
-   **Audio Processing**: ArrayBuffer handling and proper content headers
-   **Voice Settings**: Optimized stability, similarity, and speaker boost
-   **Fallback System**: Continues chat functionality without TTS if needed

## [1.1.0] - 2025-09-04

### Added

-   **3D Avatar Integration**: Complete Ready Player Me avatar system with interactive 3D display
-   **Lip Sync Animation**: Realistic mouth, eye, and head animations synchronized with AI speech
-   **Avatar Controls**: Full pan, zoom, and rotate controls for avatar positioning
-   **Interactive Positioning**: Drag avatar to position feet at "Ready" indicator level
-   **TypeScript Fixes**: Added @types/three for proper three.js type support

### Enhanced

-   **Avatar Rendering**: Optimized 3D scene with proper lighting and materials
-   **Component Architecture**: Separate AvatarManager and AvatarDisplay for better organization
-   **Positioning System**: Advanced 3D positioning with matrix updates and morph target support

### Fixed

-   **TypeScript Errors**: Resolved material cloning and component display name issues
-   **3D Scene Issues**: Fixed avatar positioning and scaling problems
-   **Material Handling**: Proper handling of single materials vs material arrays

### Technical

-   **Three.js Integration**: Full React Three Fiber implementation with OrbitControls
-   **Morph Target Animation**: Advanced facial animation system for lip sync
-   **Component Separation**: Clean separation between 3D rendering and UI management

## [1.0.0] - 2025-09-03

### Added

-   **AI Interviewer System**: Complete implementation of interactive coding interviews with GPT-4 integration
-   **OpenAI Integration**: Real-time chat completions with custom system prompts and progressive assistance
-   **Interview State Management**: Context-based interview flow with task progression and candidate tracking
-   **Progressive Help System**: Three-tier assistance (encouragement → hint → full solution) for realistic interviewer behavior
-   **Sfinx Persona**: Custom AI interviewer branding as "Sfinx" with professional, encouraging personality
-   **Real-time Code Editor**: Monaco editor integration with theme support and live code updates
-   **Task Management**: Structured coding challenges (UserList component, Counter debugging) with clear requirements
-   **Chat Interface**: Professional chat UI with typing indicators and quick action buttons
-   **Interview Analytics**: Session tracking and progress monitoring capabilities

### Changed

-   **Candidate Names**: Updated from generic "Candidate A/B/C" to real names (Noam, Alon, Gal) throughout codebase
-   **Interview Flow**: Streamlined from experience questions to direct task presentation
-   **System Prompts**: Enhanced with realistic interviewer behavior and progressive assistance guidelines

### Technical

-   **OpenAI API**: Integrated GPT-4 with custom temperature and token settings
-   **State Management**: React Context for interview state, task progression, and session management
-   **SSR Compatibility**: Fixed document access issues for server-side rendering
-   **Type Safety**: Full TypeScript implementation with proper interfaces and error handling

## [0.3.0] - 2025-08-31

### Added

-   Detailed UI Design Document (`Sfinx Demo UI Design Document.md`) outlining the "Apple-like" aesthetic and core principles.
-   New "AI Interviewer Session" screen concept, featuring a Cursor-like multi-pane layout for a live, interactive coding interview.
-   Implementation plan (`AI_INTERVIEWER_IMPLEMENTATION_PLAN.md`) with a detailed checklist for building the new interview screen.
-   Tailwind CSS for styling, configured with the project's custom color palette and fonts.
-   Foundational components for the "Candidate Session" view.

### Changed

-   Refined the Sfinx concept to include "Learning Capability" as a core telemetry signal, tracking how candidates seek and apply information.

## [0.2.0] - 2025-08-10

### Added

-   Database models for JD, Task, Session, Profile, Score, PanelLabel (Prisma integration removed)
-   Database seeding functionality (removed)
-   Debug database inspection endpoints (removed)

### Notes

-   Database integration removed - application now operates without persistent data storage.

## [0.1.1] - 2025-08-10

### Added

-   Minimal App Router with `/health` route returning `{ ok: true }`.
-   Base TypeScript config and ESLint setup.

### Changed

-   Switched Next.js config from `next.config.ts` to supported `next.config.js` for Next 14.
-   Pinned dependency versions for compatibility (`escomplex`, `multer`).

### Fixed

-   Dev server boot failure due to unsupported `next.config.ts`.

## [0.1.0] - 2025-08-10

### Added

-   Initial project scaffolding.

[0.1.1]: https://github.com/noam-hoze/sfinx/compare/v0.1.0...v0.1.1
[0.2.0]: https://github.com/noam-hoze/sfinx/compare/v0.1.1...v0.2.0
[0.3.0]: https://github.com/noam-hoze/sfinx/compare/v0.2.0...v0.3.0
[1.0.0]: https://github.com/noam-hoze/sfinx/compare/v0.3.0...v1.0.0
[1.1.0]: https://github.com/noam-hoze/sfinx/compare/v1.0.0...v1.1.0
[1.2.0]: https://github.com/noam-hoze/sfinx/compare/v1.1.0...v1.2.0
[1.4.0]: https://github.com/noam-hoze/sfinx/compare/v1.2.0...v1.4.0
[1.5.0]: https://github.com/noam-hoze/sfinx/compare/v1.4.0...v1.5.0
[1.9.2]: https://github.com/noam-hoze/sfinx/compare/v1.9.1...v1.9.2
[1.9.1]: https://github.com/noam-hoze/sfinx/compare/v1.9.0...v1.9.1
[1.9.0]: https://github.com/noam-hoze/sfinx/compare/v1.8.1...v1.9.0
[1.8.1]: https://github.com/noam-hoze/sfinx/compare/v1.8.0...v1.8.1
[1.8.0]: https://github.com/noam-hoze/sfinx/compare/v1.7.0...v1.8.0
[1.7.0]: https://github.com/noam-hoze/sfinx/compare/v1.6.1...v1.7.0
[1.6.1]: https://github.com/noam-hoze/sfinx/compare/v1.6.0...v1.6.1
[1.6.0]: https://github.com/noam-hoze/sfinx/compare/v1.5.0...v1.6.0
