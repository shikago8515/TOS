# tms-backend

FastAPI backend recovered from the packaged TOS application.

## Entry Point

```text
main.py
```

Default service URL:

```text
http://127.0.0.1:8000
```

## Modules

| Module | API router | Processing module |
| --- | --- | --- |
| Jessca | `api/jessca_api.py` | `modules/jessca_module.py` |
| Sophia/Tina | `api/sophia_tina_api.py` | `modules/sophia_tina_module.py` |
| Jane | `api/jane_api.py` | `modules/jane_module.py` |
| Eric | `api/eric_api.py` | `modules/eric_module.py` |

The first recovery phase should preserve API compatibility. Later phases can move code into an `app/` package and add typed response schemas.
