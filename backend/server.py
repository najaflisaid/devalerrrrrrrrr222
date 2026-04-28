"""Minimal FastAPI backend.

Epoint payment integration is now handled entirely in the browser
(see /app/src/services/epointPaymentService.ts), so this server only
exposes a health probe for supervisor / load balancer checks.
"""
from fastapi import FastAPI

app = FastAPI(title="DE VALEUR API")


@app.get("/api/health")
async def health():
    return {"status": "ok"}
