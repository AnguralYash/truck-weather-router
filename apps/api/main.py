"""Vercel WSGI entrypoint for the Django service."""

from config.wsgi import application

app = application

__all__ = ["app"]
