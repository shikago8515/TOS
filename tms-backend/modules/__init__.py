
# -*- coding: utf-8 -*-
"""
TMS 工具 - 业务模块.

Keep package import side-effect free so one module's optional dependency does
not prevent another module from being imported.
"""

__all__ = [
    'EricModule',
    'JesscaModule',
    'SophiaTinaModule',
    'JaneModule',
    'JaneBomSummaryModule',
]


def __getattr__(name):
    if name == 'EricModule':
        from .eric_module import EricModule
        return EricModule
    if name == 'JesscaModule':
        from .jessca_module import JesscaModule
        return JesscaModule
    if name == 'SophiaTinaModule':
        from .sophia_tina_module import SophiaTinaModule
        return SophiaTinaModule
    if name == 'JaneModule':
        from .jane_module import JaneModule
        return JaneModule
    if name == 'JaneBomSummaryModule':
        from .jane_bom_summary_module import JaneBomSummaryModule
        return JaneBomSummaryModule
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
