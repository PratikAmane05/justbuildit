from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
import secrets

from app.core.dependencies import get_db, get_current_user_id
from app.core.security import create_access_token, create_refresh_token, decode_token
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, RefreshRequest, ProfileUpdate
from app.services.auth_service import AuthService
from app.integrations.google_auth.oauth import get_google_auth_url, exchange_code_for_token, get_google_user_info
from app.core.config import settings

router = APIRouter()


@router.post("/register/", response_model=dict, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    svc = AuthService(db)
    user = await svc.register(payload.name, payload.email, payload.password)
    return {"id": user.id, "email": user.email, "message": "Account created successfully"}


@router.post("/login/", response_model=TokenResponse)
async def login(payload: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    svc = AuthService(db)
    user = await svc.authenticate(payload.email, payload.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
        
    try:
        from app.core.email import notify_login_alert
        client_ip = request.client.host if request.client else "Unknown IP"
        await notify_login_alert(user.email, user.name, ip_address=client_ip)
    except Exception:
        pass
        
    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/refresh/", response_model=TokenResponse)
async def refresh(payload: RefreshRequest):
    try:
        data = decode_token(payload.refresh_token)
        if data.get("type") != "refresh":
            raise ValueError("Not a refresh token")
        user_id = data["sub"]
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    return TokenResponse(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
    )


@router.get("/me/")
async def me(user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    svc = AuthService(db)
    user = await svc.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"id": user.id, "name": user.name, "email": user.email, "avatar_url": user.avatar_url}


@router.patch("/me/")
async def update_me(payload: ProfileUpdate, user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    svc = AuthService(db)
    user = await svc.update_profile(
        user_id=user_id,
        name=payload.name,
        email=payload.email,
        password=payload.password
    )
    return {"id": user.id, "name": user.name, "email": user.email, "message": "Profile updated successfully"}


@router.post("/logout")
async def logout():
    return {"message": "Logged out"}


# ─── Google OAuth ──────────────────────────────────────────────────────────────

@router.get("/google/login")
async def google_login():
    """Redirect the browser to Google's consent screen."""
    state = secrets.token_urlsafe(16)
    url = get_google_auth_url(state)
    return RedirectResponse(url)


@router.get("/google/callback")
async def google_callback(code: str, request: Request, db: AsyncSession = Depends(get_db)):
    """Handle the OAuth2 callback from Google, upsert the user, and issue JWT tokens."""
    try:
        token_data = await exchange_code_for_token(code)
        access_token = token_data.get("access_token")
        if not access_token:
            raise HTTPException(status_code=400, detail="Failed to obtain access token from Google")
        user_info = await get_google_user_info(access_token)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Google OAuth error: {str(e)}")

    google_id = user_info.get("sub")
    email = user_info.get("email")
    name = user_info.get("name", email)
    avatar_url = user_info.get("picture")

    if not email:
        raise HTTPException(status_code=400, detail="Could not retrieve email from Google")

    svc = AuthService(db)
    user = await svc.get_or_create_google_user(
        google_id=google_id,
        email=email,
        name=name,
        avatar_url=avatar_url,
    )

    try:
        from app.core.email import notify_login_alert
        client_ip = request.client.host if request.client else "Unknown IP"
        await notify_login_alert(user.email, user.name, ip_address=client_ip)
    except Exception:
        pass

    jwt_access = create_access_token(user.id)
    jwt_refresh = create_refresh_token(user.id)

    # Redirect to frontend with tokens — the /auth/callback page stores them
    frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
    return RedirectResponse(
        f"{frontend_url}/auth/callback?access_token={jwt_access}&refresh_token={jwt_refresh}"
    )
