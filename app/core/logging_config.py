import logging
import json
import sys
import traceback
from datetime import datetime, timezone
from contextvars import ContextVar
from typing import Optional, Any
from app.core.config import settings

# Global context variable to hold the active request ID for distributed tracing
request_id_var: ContextVar[Optional[str]] = ContextVar("request_id", default=None)

class JSONLogFormatter(logging.Formatter):
    """
    Production-grade JSON log formatter for structured log aggregation.
    """
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)

    def format(self, record: logging.LogRecord) -> str:
        # Standard structured fields
        log_data = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "file": f"{record.filename}:{record.lineno}",
            "func": record.funcName,
            "pid": record.process,
            "thread": record.threadName
        }

        # Inject Request ID for request correlation tracing
        req_id = request_id_var.get()
        if req_id:
            log_data["request_id"] = req_id

        # Include traceback details if an exception occurred
        if record.exc_info:
            log_data["exception"] = {
                "type": record.exc_info[0].__name__ if record.exc_info[0] else None,
                "message": str(record.exc_info[1]) if record.exc_info[1] else None,
                "stack_trace": "".join(traceback.format_exception(*record.exc_info))
            }

        # Dynamically append custom attributes added via extra={"key": "val"}
        # Excluding standard LogRecord attributes
        standard_attrs = {
            'args', 'asctime', 'created', 'exc_info', 'exc_text', 'filename',
            'funcName', 'levelname', 'levelno', 'lineno', 'module', 'msecs',
            'message', 'msg', 'name', 'pathname', 'process', 'processName',
            'relativeCreated', 'stack_info', 'thread', 'threadName'
        }
        extra_data = {k: v for k, v in record.__dict__.items() if k not in standard_attrs}
        if extra_data:
            log_data["extra"] = extra_data

        return json.dumps(log_data)

def setup_logging() -> None:
    """
    Initializes and sets up the application logging architecture.
    Emits structured JSON logs in production, and human-friendly colored console logs in development.
    """
    log_level = logging.INFO
    if settings.ENV == "development":
        log_level = logging.DEBUG

    # Clear any existing handlers
    root_logger = logging.getLogger()
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    # Set base level
    root_logger.setLevel(log_level)

    # Stream Handler
    stream_handler = logging.StreamHandler(sys.stdout)
    
    if settings.ENV == "development":
        # Human-readable formatted string for local development
        formatter = logging.Formatter(
            fmt="%(asctime)s [%(levelname)s] (%(name)s) %(filename)s:%(lineno)d - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )
    else:
        # Structured JSON formatter for production log aggregation
        formatter = JSONLogFormatter()

    stream_handler.setFormatter(formatter)
    root_logger.addHandler(stream_handler)

    # Suppress verbose third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.error").setLevel(logging.INFO)
    logging.getLogger("pymongo").setLevel(logging.WARNING)
