from fastapi import APIRouter, Depends

from app.api.deps.auth import get_current_user
from app.schemas.auth import UserResponse

router = APIRouter()


@router.get("/me", response_model=UserResponse)
async def read_me(current_user: dict = Depends(get_current_user)):
    """Return the currently authenticated user."""
    return current_user
