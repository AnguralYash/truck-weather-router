"""Django settings for the truck weather router API."""

import os
import secrets
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

DEBUG = os.environ.get("DJANGO_DEBUG", "") == "1"

# The API is stateless and signs nothing, but Django requires a key. Set
# DJANGO_SECRET_KEY to use your own; otherwise a random one is made at startup,
# so no fixed key ever ships in the code.
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY") or secrets.token_urlsafe(50)

ALLOWED_HOSTS = ["localhost", "127.0.0.1", ".vercel.app"]

INSTALLED_APPS = ["routing"]

MIDDLEWARE = ["django.middleware.common.CommonMiddleware"]

ROOT_URLCONF = "config.urls"

WSGI_APPLICATION = "config.wsgi.application"

# No database: the API is stateless and calls third-party services per request.
DATABASES: dict[str, dict[str, str]] = {}

USE_TZ = True
TIME_ZONE = "UTC"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
