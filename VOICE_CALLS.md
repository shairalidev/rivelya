# Voice Calls in Chat Sessions

This implementation adds voice calling functionality to chat sessions with the `chat_voice` channel type.

## Features

- **WebRTC Integration**: Peer-to-peer audio communication using WebRTC
- **Call Management**: Start, accept, reject, and end calls
- **Real-time Signaling**: Socket.io-based signaling for WebRTC negotiation
- **Audio Controls**: Mute/unmute functionality during calls
- **Visual Feedback**: Audio level visualization and call status indicators
- **Session Integration**: Calls are tied to chat sessions and respect time limits

## Architecture

### Backend Components

1. **ChatCall Model** (`backend/src/models/chat-call.model.js`)
   - Tracks call state and participants
   - Stores call duration and metadata

2. **Call Routes** (`backend/src/routes/chat.routes.js`)
   - `/chat/threads/:threadId/call/start` - Start a call
   - `/chat/threads/:threadId/call/:callId/accept` - Accept incoming call
   - `/chat/threads/:threadId/call/:callId/reject` - Reject incoming call
   - `/chat/threads/:threadId/call/:callId/end` - End active call
   - `/chat/threads/:threadId/call/:callId/signal` - WebRTC signaling

3. **Socket Events** (`backend/src/lib/socket.js`)
   - `chat:call:incoming` - Notify callee of incoming call
   - `chat:call:outgoing` - Notify caller of outgoing call
   - `chat:call:accepted` - Call accepted by callee
   - `chat:call:rejected` - Call rejected by callee
   - `chat:call:ended` - Call ended by either party
   - `chat:call:timeout` - Call timed out (30s)
   - `chat:call:signal` - WebRTC signaling data

### Frontend Components

1. **CallPopup Component** (`frontend/src/components/CallPopup.jsx`)
   - Manages call UI and controls
   - Handles WebRTC connection
   - Audio controls and status display

2. **useWebRTC Hook** (`frontend/src/hooks/useWebRTC.js`)
   - WebRTC peer connection management
   - Audio stream handling
   - Signaling coordination

3. **Audio Hooks**
   - `useAudioLevel.js` - Real-time audio level monitoring
   - `useSimulatedVoiceActivity.js` - Simulated remote audio activity

## Usage

### For Chat Sessions with `chat_voice` Channel

1. **Starting a Call**
   - Click the phone icon in the chat header
   - System requests microphone permission
   - Call invitation sent to other participant

2. **Receiving a Call**
   - Call popup appears in bottom-left corner
   - Accept or reject the incoming call
   - If accepted, WebRTC connection establishes

3. **During a Call**
   - Mute/unmute microphone
   - See audio activity visualization
   - Continue text chat simultaneously
   - End call at any time

4. **Call Limitations**
   - Calls respect session time limits
   - Only one call per chat thread at a time
   - Calls auto-timeout after 30 seconds if not answered

## Technical Details

### WebRTC Configuration

- Uses Google STUN servers for NAT traversal
- Peer-to-peer audio only (no video)
- Echo cancellation and noise suppression enabled
- Automatic gain control for better audio quality

### Security

- JWT authentication required for all call operations
- Users can only participate in calls for their own chat threads
- WebRTC signaling is authenticated and validated

### Browser Compatibility

- Requires modern browsers with WebRTC support
- Microphone permission required
- HTTPS required for microphone access in production

## Deployment Notes

- Nginx configuration updated for WebSocket support
- No additional server infrastructure required (P2P)
- STUN servers handle most NAT scenarios
- For complex network setups, consider adding TURN servers