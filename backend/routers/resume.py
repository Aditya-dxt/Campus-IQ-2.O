from fastapi import APIRouter

router = APIRouter(prefix="/resume", tags=["resume"])


@router.get("/")
def resume_root():
    return {"status": "not implemented"}
