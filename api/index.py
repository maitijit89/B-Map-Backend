try:
    from app.main import app
except Exception as e:
    import traceback
    print(f"Import Error: {e}")
    print(traceback.format_exc())
    # Return a dummy app that reports the error
    from fastapi import FastAPI
    app = FastAPI()
    @app.get("/{rest_of_path:path}")
    async def error_handler(rest_of_path: str):
        return {
            "error": "Initialization Failed",
            "detail": str(e),
            "traceback": traceback.format_exc()
        }
