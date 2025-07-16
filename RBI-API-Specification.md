# Remote Browser Isolation (RBI) Backend API Specification

## Overview

This document outlines the API endpoints and WebSocket connections required for implementing True Remote Browser Isolation in the NULL VOID extension.

## Base URLs

### Production Endpoints

- **Singapore**: `https://sg-rbi-api.nullvoid.com`
- **USA**: `https://us-rbi-api.nullvoid.com`
- **UK**: `https://uk-rbi-api.nullvoid.com`
- **Canada**: `https://ca-rbi-api.nullvoid.com`

### WebSocket Endpoints

- **Singapore**: `wss://sg-rbi-stream.nullvoid.com`
- **USA**: `wss://us-rbi-stream.nullvoid.com`
- **UK**: `wss://uk-rbi-stream.nullvoid.com`
- **Canada**: `wss://ca-rbi-stream.nullvoid.com`

## Authentication

All API requests require the following headers:

```
Content-Type: application/json
X-Client-Type: chrome-extension
X-Client-Version: 1.0
```

## API Endpoints

### 1. Create RBI Session

**POST** `/session/create`

**Request Body:**

```json
{
  "location": "singapore",
  "userAgent": "Mozilla/5.0...",
  "extensions": ["nullvoid"],
  "security": {
    "blockAds": true,
    "blockTrackers": true,
    "blockMalware": true,
    "enforceHTTPS": true
  }
}
```

**Response:**

```json
{
  "sessionId": "rbi-session-uuid",
  "status": "created",
  "location": "singapore",
  "endpoint": "https://sg-rbi-api.nullvoid.com",
  "websocketUrl": "wss://sg-rbi-stream.nullvoid.com/session/rbi-session-uuid",
  "expiresAt": "2025-07-15T14:30:00Z"
}
```

### 2. Navigate to URL

**POST** `/session/{sessionId}/navigate`

**Request Body:**

```json
{
  "url": "https://example.com",
  "timeout": 30000
}
```

**Response:**

```json
{
  "status": "navigating",
  "url": "https://example.com",
  "sessionId": "rbi-session-uuid"
}
```

### 3. Close Session

**POST** `/session/{sessionId}/close`

**Response:**

```json
{
  "status": "closed",
  "sessionId": "rbi-session-uuid"
}
```

### 4. Get Session Status

**GET** `/session/{sessionId}/status`

**Response:**

```json
{
  "sessionId": "rbi-session-uuid",
  "status": "active",
  "currentUrl": "https://example.com",
  "location": "singapore",
  "connectedAt": "2025-07-15T14:00:00Z",
  "lastActivity": "2025-07-15T14:15:00Z"
}
```

## WebSocket Connection

### Connection URL

`wss://[region]-rbi-stream.nullvoid.com/session/{sessionId}`

### Message Types

#### 1. Configuration (Client → Server)

```json
{
  "type": "configure",
  "config": {
    "viewport": {
      "width": 1920,
      "height": 1080
    },
    "userAgent": "Mozilla/5.0...",
    "timezone": "Asia/Singapore"
  }
}
```

#### 2. Navigation Commands (Client → Server)

```json
{
  "type": "navigate",
  "action": "back|forward|refresh"
}
```

#### 3. Mouse Interaction (Client → Server)

```json
{
  "type": "mouse",
  "action": "click|move|scroll",
  "x": 100,
  "y": 200,
  "button": "left|right|middle"
}
```

#### 4. Keyboard Input (Client → Server)

```json
{
  "type": "keyboard",
  "action": "type|keydown|keyup",
  "text": "Hello World",
  "key": "Enter"
}
```

#### 5. Screen Update (Server → Client)

```json
{
  "type": "screen_update",
  "data": {
    "screenshot": "base64-encoded-image-data",
    "timestamp": "2025-07-15T14:15:00Z",
    "elements": [
      {
        "type": "input",
        "x": 100,
        "y": 200,
        "width": 300,
        "height": 30,
        "id": "search-input"
      }
    ]
  }
}
```

#### 6. URL Changed (Server → Client)

```json
{
  "type": "url_changed",
  "data": {
    "url": "https://example.com/new-page",
    "title": "New Page Title"
  }
}
```

#### 7. Page Loaded (Server → Client)

```json
{
  "type": "page_loaded",
  "data": {
    "url": "https://example.com",
    "title": "Example Domain",
    "loadTime": 1500
  }
}
```

#### 8. Error (Server → Client)

```json
{
  "type": "error",
  "data": {
    "code": "NAVIGATION_FAILED",
    "message": "Failed to navigate to URL",
    "url": "https://example.com"
  }
}
```

#### 9. Session Expired (Server → Client)

```json
{
  "type": "session_expired",
  "data": {
    "sessionId": "rbi-session-uuid",
    "reason": "timeout"
  }
}
```

## Implementation Requirements

### Backend Infrastructure

1. **Containerized Browser Instances**: Each session runs in an isolated Docker container
2. **Screen Capture**: Real-time screenshot capture and streaming
3. **Input Handling**: Mouse and keyboard event processing
4. **Security**: Malware scanning, ad blocking, tracker blocking
5. **Scaling**: Auto-scaling based on demand
6. **Monitoring**: Session health and performance monitoring

### Security Features

- **Complete Isolation**: Each session runs in its own container
- **Network Isolation**: Separate network namespaces
- **Malware Protection**: Real-time scanning of downloaded content
- **Data Destruction**: Complete session cleanup on closure
- **Encryption**: All data encrypted in transit and at rest

### Performance Requirements

- **Latency**: < 50ms for user interactions
- **Frame Rate**: Minimum 30fps for smooth experience
- **Bandwidth**: Optimized compression for screen streaming
- **Scaling**: Support for 1000+ concurrent sessions per region

## Error Handling

### Connection Errors

- **503 Service Unavailable**: RBI service temporarily unavailable
- **429 Too Many Requests**: Rate limiting exceeded
- **401 Unauthorized**: Authentication failed

### Session Errors

- **404 Not Found**: Session not found
- **410 Gone**: Session expired
- **400 Bad Request**: Invalid request parameters

## Deployment Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │   API Gateway   │    │   RBI Service   │
│                 │────│                 │────│                 │
│  Regional LB    │    │  Authentication │    │  Session Mgmt   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                              ┌─────────────────┐
                                              │ Container Pool  │
                                              │                 │
                                              │ Browser Instance│
                                              │ Browser Instance│
                                              │ Browser Instance│
                                              └─────────────────┘
```

## Testing Endpoints

### Development

- **API**: `https://dev-rbi-api.nullvoid.com`
- **WebSocket**: `wss://dev-rbi-stream.nullvoid.com`

### Staging

- **API**: `https://staging-rbi-api.nullvoid.com`
- **WebSocket**: `wss://staging-rbi-stream.nullvoid.com`

This specification provides the foundation for implementing True Remote Browser Isolation in the NULL VOID extension.
