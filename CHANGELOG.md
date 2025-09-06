# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project adheres to Semantic Versioning.

## [1.4.0] - 2025-01-12

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

-   **Candidate Names**: Updated from generic "Candidate A/B/C" to real names (Gal, Alon, Noam) throughout codebase
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
