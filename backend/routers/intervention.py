from fastapi import APIRouter

router = APIRouter(prefix="/intervention", tags=["intervention"])


@router.get("/")
def intervention_root():
    return {"status": "not implemented"}
