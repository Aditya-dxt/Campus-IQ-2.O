from fastapi import FastAPI

app = FastAPI(title="CampusIQ API")


@app.get("/")
def health_check():
    return {"status": "ok"}
