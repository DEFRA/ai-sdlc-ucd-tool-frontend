# Architecture Decision Record: Azure Active Directory Authentication Integration

## 1. Context

This document describes the implementation of authentication, authorisation and user account capabilities for a CDP application consisting of a JavaScript frontend service and a JavaScript backend service, both utilising Node.js and HAPI. Microsoft Azure Active Directory serves as the identity provider using OAuth 2.0. This approach provides a simple, secure and minimalist architecture that maintains clear separation of concerns whilst allowing straightforward extension of capabilities as requirements evolve.

## 2. High Level Diagram

```mermaid
graph TB
    subgraph "Client"
        U[User Browser]
    end

    subgraph "Microsoft Azure"
        AD[Azure AD<br/>Identity Provider]
    end

    subgraph "CDP Platform"
        FE[Frontend Service<br/>Auth & Session Management]
        BE[Backend Service<br/>Token Validation & Resources]
    end

    U -->|Access| FE
    FE <-->|OAuth 2.0| AD
    FE -->|Authenticated Requests| BE
    BE <-->|Validate Tokens| AD

    style U fill:#e1f5fe
    style AD fill:#fff3e0
    style FE fill:#e8f5e9
    style BE fill:#f3e5f5
```

## ## 3. Implementation Details

### 3.1 Frontend Service (Node.js/HAPI)

The frontend service handles:

- OAuth 2.0 authorisation code flow with Azure AD
- Session management using Redis with configurable TTL
- Token storage and refresh logic
- Bearer token injection for backend API calls
- Server-side rendering with Nunjucks templates

**Session Data Structure (Redis):**

`{ "session_id": "unique identifier", "user_id": "extracted from Azure AD oid claim", "access_token": "JWT for API authorisation", "refresh_token": "for obtaining new access tokens", "token_expiry": "token expiration timestamp" }`

### 3.2 Backend Service (Node.js/HAPI)

The backend service implements:

- JWT validation using cached JWKS signing keys
- Automatic JWKS refresh on cache miss or expiry
- User record management in MongoDB
- Bearer token extraction from Authorization header
- Shared resource management (user profiles, etc.)

**Signing Key Cache (In-Memory):**

`{ "kid": "key identifier", "modulus": "RSA public key modulus", "exponent": "RSA public key exponent", "fetched_at": "timestamp of key retrieval", "expires_at": "cache expiry timestamp" }`

**User Data Structure (MongoDB):**

`{ "user_id": "unique identifier from Azure AD", "email": "user email address", "display_name": "user display name", "first_login": "timestamp of first login", "last_login": "timestamp of most recent login" }`

## 4. Security Considerations

- **Token validation**: All API requests validate JWT signatures using Azure AD public keys
- **Key caching**: JWKS signing keys cached to reduce Azure AD dependencies
- **Session security**: Redis sessions expire after configured duration
- **Session identifiers**: Generated using cryptographically secure methods
- **Token refresh**: Automatic token refresh before expiry

## 5. Error Handling

- Invalid tokens return 401 Unauthorized
- Expired sessions redirect to Azure AD login
- Backend service unavailability returns 503 Service Unavailable

## 6. Architecture

### 6.1 Authentication Flow

The authentication journey follows these steps:

- User navigates to the application
- Frontend checks for valid session in Redis
- If no valid session exists, frontend redirects to Azure AD
- User authenticates with Azure AD credentials
- Azure AD returns authorisation code to frontend
- Frontend exchanges code for access and refresh tokens
- Frontend creates session in Redis with token information
- User makes request for protected resource
- Frontend attaches bearer token to backend API request
- Backend validates token using cached signing keys
- Backend creates or updates user record in MongoDB
- Backend returns requested resource to frontend
- Frontend renders response for user

\*\*System Architecture:

```mermaid
graph TB

subgraph "Client Browser"

U[User]

end

subgraph "Microsoft Azure AD"

AD[Azure AD<br/>OAuth + JWKS]

end

subgraph "AWS Cloud"

subgraph "Frontend Layer"

FE[Node.js Frontend<br/>HAPI + Nunjucks]

REDIS[(Redis<br/>Session Store)]

end

subgraph "Backend Layer"

API[Node.js Backend<br/>HAPI]

KEYCACHE[Signing Keys Cache<br/>JWKS<br/>In-Memory]

DB[(MongoDB<br/>User Storage)]

end

end

U -->|1 - Access App| FE

FE -->|2 - Check Session| REDIS

FE -->|3 - Redirect to AD| AD

U -->|4 - Login| AD

AD -->|5 - Return Code| FE

FE -->|6 - Exchange for Tokens| AD

FE -->|7 - Store Session| REDIS

FE -->|8 - API Request + Token| API

API -->|9 - Validate Token| KEYCACHE

API -->|10 - Refresh Keys if needed| AD

API -->|11 - Store/Update User| DB

style U fill:#e1f5fe

style AD fill:#fff3e0

style FE fill:#e8f5e9

style API fill:#f3e5f5

style DB fill:#fce4ec

style REDIS fill:#fff3e0

style KEYCACHE fill:#f0f4c3
```

**Authentication Sequence:**

```mermaid
sequenceDiagram

participant U as User Browser

participant FE as Frontend (HAPI)

participant R as Redis

participant API as Backend (HAPI)

participant AD as Azure AD

participant KC as Key Cache

participant DB as MongoDB

Note over U,DB: Initial Authentication

U ->> FE: 1 - Navigate to application

FE ->> R: 2 - Check for session

R ->> FE: Session not found

FE ->> U: 3 - Redirect to Azure AD

U ->> AD: 4 - Enter credentials

AD ->> U: 5 - Return auth code

U ->> FE: Redirect with code

FE ->> AD: 6 - Exchange code for tokens

AD ->> FE: Return tokens

FE ->> R: 7 - Create session

Note over U,DB: Protected Resource Request

U ->> FE: 8 - Request resource

FE ->> R: Retrieve session

R ->> FE: Return session data

FE ->> API: 9 - API request with Bearer token

API ->> KC: 10 - Check key cache

alt Key not cached

API ->> AD: Fetch JWKS

AD ->> API: Return keys

API ->> KC: Cache keys

end

API ->> API: Validate token

API ->> DB: 11 - Upsert user

DB ->> API: Confirm

API ->> FE: 12 - Return resource

FE ->> U: 13 - Display resource
```

### 6.2 Data Architecture and Storage Flow

The following diagrams illustrate the technical implementation of data storage and flow throughout the authentication system. They demonstrate how session data is maintained in Redis alongside the frontend service, whilst persistent user data resides in MongoDB with the backend service. This separation ensures optimal performance for session management whilst maintaining data integrity for user records.

**Data Architecture:**

```mermaid
graph TB
    subgraph "Client Browser"
        BROWSER[Browser<br/>Session Cookie]
    end

    subgraph "Frontend Service - Node.js/HAPI"
        FE[Frontend App]
        subgraph "Session Store"
            REDIS[(Redis)]
            RS1[Session Data:<br/>- session_id<br/>- user_id<br/>- access_token<br/>- refresh_token<br/>- token_expiry]
        end
    end

    subgraph "Backend Service - Node.js/HAPI"
        API[API Service]
        subgraph "In-Memory Cache"
            KC[Signing Keys Cache<br/>- kid<br/>- modulus<br/>- exponent<br/>- fetched_at<br/>- expires_at]
        end
        subgraph "Persistent Storage"
            USERS[(MongoDB<br/>users collection)]
            MU[User Data:<br/>- user_id<br/>- email<br/>- display_name<br/>- first_login<br/>- last_login]
        end
    end

    BROWSER -->|session_id cookie| FE
    FE <-->|Read/Write Sessions| REDIS
    FE -->|Bearer Token| API
    API <-->|Key Lookup| KC
    API <-->|CRUD Operations| USERS

    REDIS --> RS1
    USERS --> MU

    style BROWSER fill:#e1f5fe
    style FE fill:#e8f5e9
    style API fill:#f3e5f5
    style REDIS fill:#fff3e0
    style KC fill:#f0f4c3
    style USERS fill:#fce4ec
```

**Data Storage Flow:**

```mermaid
sequenceDiagram
    participant B as Browser
    participant FE as Frontend (HAPI)
    participant R as Redis
    participant API as Backend (HAPI)
    participant K as Signing Keys Cache
    participant AD as Microsoft AD
    participant M as MongoDB

    Note over B,M: Login Flow - Data Storage

    B->>FE: 1. Login successful
    FE->>FE: 2. Generate session_id
    FE->>R: 3. Store session data<br/>SET session:{id} {...tokens...}<br/>EXPIRE 3600
    R->>FE: 4. OK
    FE->>B: 5. Set cookie: session_id

    Note over B,M: First Protected API Request

    B->>FE: 6. Request with session cookie
    FE->>R: 7. GET session:{id}
    R->>FE: 8. Return session data
    FE->>API: 9. API request with Bearer token
    API->>K: 10. Get key by kid
    alt Key miss
        API->>AD: 11a. Fetch JWKS
        AD->>API: 12a. JWKS keys
        API->>K: 13a. Store keys (TTL: 24h)
    end
    API->>API: 14. Validate signature
    API->>M: 15. Upsert user record
    M->>API: 16. User record
    API->>FE: 17. Success response
    FE->>B: 18. Display success

    Note over B,M: Subsequent Requests - Cache Hit

    B->>FE: 19. Another request
    FE->>R: 20. GET session:{id}
    R->>FE: 21. Return cached session
    FE->>API: 22. API request with token
    API->>K: 23. Key cache hit
    API->>API: 24. Validate signature
    API->>M: 25. Read/Update user data
    M->>API: 26. Return data
    API->>FE: 27. Response
    FE->>B: 28. Display result

    Note over B,M: Session Expiry

    R->>R: 29. TTL expires
    B->>FE: 30. Request with expired session
    FE->>R: 31. GET session:{id}
    R->>FE: 32. Session not found
    FE->>B: 33. Redirect to login
```

## 7. Next Steps

Following approval of this RFC, the next steps will be to provide the following documents:

- Technical implementation guide
- API authentication reference

## 8. Open Questions

- What is the preferred session timeout duration for Redis TTL?
- Should role-based access control be implemented in the initial release?
- Are there specific audit log requirements for authentication events?
- Are there compliance requirements (GDPR, SOC2) that affect data retention?

## 9. Request for Feedback

All feedback is welcome, particularly on the following aspects of this architecture:

- Overall architectural approach and technology alignment
- Security considerations and potential vulnerabilities
- Performance implications of the caching strategy
- Compatibility with existing CDP templates and patterns
- User experience considerations for the authentication flow
- Operational requirements for monitoring and maintenance

Please provide feedback by commenting on this document.
