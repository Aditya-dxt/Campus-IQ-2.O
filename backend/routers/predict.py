from fastapi import APIRouter

router = APIRouter(prefix="/predict", tags=["predict"])


@router.get("/")
def predict_root():
    return {"status": "not implemented"}
