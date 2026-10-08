from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
import uvicorn
from apps.calculator.route import router as calculator_router
from apps.calculator.service import close_solver_service
from apps.calculator.body_limit import RequestBodyLimitMiddleware
from apps.frontend import mount_frontend
from constants import CORS_ORIGINS, SERVER_URL, PORT, ENV, MAX_REQUEST_BYTES

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    close_solver_service()

app = FastAPI(lifespan=lifespan)
app.add_middleware(RequestBodyLimitMiddleware, max_bytes=MAX_REQUEST_BYTES)


@app.exception_handler(RequestValidationError)
async def invalid_request(request, exc: RequestValidationError):
    # Do not echo drawings/tokens or non-finite input values in error responses.
    return JSONResponse(
        status_code=422,
        content={"detail": [{"type": error["type"], "loc": error["loc"], "msg": error["msg"]} for error in exc.errors()]},
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    return response


@app.get('/api/health')
async def root():
    return {"message": "Server is running"}

app.include_router(calculator_router, prefix="/calculate", tags=["calculate"])
app.include_router(calculator_router, prefix="/api/calculate", tags=["calculate"])

mount_frontend(app, Path(__file__).resolve().parents[1] / "web-build")


if __name__ == "__main__":
    uvicorn.run("main:app", host=SERVER_URL, port=int(PORT), reload=(ENV == "dev"))
