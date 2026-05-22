
# -*- coding: utf-8 -*-
"""
TMS API Module
"""

from .jessca_api import router as jessca_router
from .sophia_tina_api import router as sophia_tina_router
from .jane_api import router as jane_router
from .eric_api import router as eric_router

__all__ = [
    'jessca_router',
    'sophia_tina_router',
    'jane_router',
    'eric_router'
]
