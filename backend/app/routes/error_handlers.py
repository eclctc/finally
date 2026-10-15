from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.errors import NotFoundError, ValidationError
from app.market import MarketDataError


def error_response(status_code: int, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": message})


async def validation_error_handler(request: Request, exc: ValidationError) -> JSONResponse:
    return error_response(400, str(exc))


async def request_validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    first = exc.errors()[0]
    field = ".".join(str(part) for part in first["loc"] if part != "body")
    return error_response(400, f"{field}: {first['msg']}" if field else first["msg"])


async def not_found_error_handler(request: Request, exc: NotFoundError) -> JSONResponse:
    return error_response(404, str(exc))


async def market_data_error_handler(request: Request, exc: MarketDataError) -> JSONResponse:
    return error_response(503, "Market data unavailable, try again")


def register_error_handlers(app: FastAPI) -> None:
    """Map domain errors to {"error": reason} responses with the PLAN's status codes."""
    app.add_exception_handler(ValidationError, validation_error_handler)
    app.add_exception_handler(RequestValidationError, request_validation_error_handler)
    app.add_exception_handler(NotFoundError, not_found_error_handler)
    app.add_exception_handler(MarketDataError, market_data_error_handler)
