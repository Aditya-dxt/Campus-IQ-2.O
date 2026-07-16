from fastapi import APIRouter

router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/")
def chat_root():
    return {"status": "not implemented"}
