from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from pymongo.errors import DuplicateKeyError

from app.db.mongodb import get_users_collection
from app.schemas.auth import LoginRequest, SignupRequest, TokenResponse
from app.services.auth import (
    create_access_token,
    hash_password,
    serialize_user,
    verify_password,
)

router = APIRouter()


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(payload: SignupRequest):
    """Create a new user account and immediately return an access token."""
    users_collection = get_users_collection()
    if users_collection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not available.",
        )

    normalized_email = payload.email.strip().lower()
    now = datetime.now(timezone.utc)
    user_document = {
        "name": payload.name.strip(),
        "email": normalized_email,
        "hashed_password": hash_password(payload.password),
        "created_at": now,
        "updated_at": now,
    }

    try:
        result = await users_collection.insert_one(user_document)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    created_user = {
        "_id": result.inserted_id,
        "name": user_document["name"],
        "email": user_document["email"],
    }
    user_response = serialize_user(created_user)
    token = create_access_token(user_response["id"], user_response["email"])

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_response,
    }


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest):
    """Authenticate an existing user and return an access token."""
    users_collection = get_users_collection()
    if users_collection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not available.",
        )

    normalized_email = payload.email.strip().lower()
    user = await users_collection.find_one({"email": normalized_email})
    if user is None or not verify_password(payload.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    user_response = serialize_user(user)
    token = create_access_token(user_response["id"], user_response["email"])

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_response,
    }
