from fastapi import APIRouter, HTTPException, status

from dependencies import CurrentUser
from models.auth import AuthResponse, LoginRequest, SignupRequest, UserResponse
from services.jwt_service import create_access_token
from services.supabase_client import get_supabase_client

router = APIRouter(prefix="/auth", tags=["auth"])


def _build_user_response(profile: dict) -> UserResponse:
    return UserResponse(
        id=profile["id"],
        name=profile["name"],
        email=profile["email"],
        role=profile["role"],
        branch=profile.get("branch"),
    )


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(body: SignupRequest) -> AuthResponse:
    supabase = get_supabase_client()

    try:
        auth_response = supabase.auth.sign_up(
            {
                "email": body.email,
                "password": body.password,
                "options": {
                    "data": {
                        "name": body.name,
                        "role": body.role,
                        "branch": body.branch,
                    }
                },
            }
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Signup failed: {exc}",
        ) from exc

    if not auth_response.user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Signup failed: no user returned from Supabase",
        )

    user_id = auth_response.user.id
    profile = {
        "id": user_id,
        "name": body.name,
        "email": body.email,
        "role": body.role,
        "branch": body.branch,
    }

    try:
        supabase.table("users").insert(profile).execute()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create user profile: {exc}",
        ) from exc

    if body.role == "student":
        try:
            supabase.table("student_profiles").insert({"user_id": user_id}).execute()
        except Exception:
            pass

    token = create_access_token(
        user_id=user_id,
        email=body.email,
        role=body.role,
    )
    return AuthResponse(
        access_token=token,
        user=_build_user_response(profile),
    )


@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest) -> AuthResponse:
    supabase = get_supabase_client()

    try:
        auth_response = supabase.auth.sign_in_with_password(
            {"email": body.email, "password": body.password}
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        ) from exc

    if not auth_response.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    user_id = auth_response.user.id

    try:
        profile_response = (
            supabase.table("users")
            .select("id, name, email, role, branch")
            .eq("id", user_id)
            .single()
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found",
        ) from exc

    profile = profile_response.data
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found",
        )

    token = create_access_token(
        user_id=user_id,
        email=profile["email"],
        role=profile["role"],
    )
    return AuthResponse(
        access_token=token,
        user=_build_user_response(profile),
    )


@router.get("/me")
def get_me(current_user: CurrentUser) -> dict:
    return {
        "id": current_user["sub"],
        "email": current_user["email"],
        "role": current_user["role"],
    }
