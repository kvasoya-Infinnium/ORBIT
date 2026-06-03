"""
core/registry.py
----------------
Two phone books:

  TYPES     — the connector *templates* (one per class: fileshare, email, s3, ...).
              These are what the "Add a connector" menu offers.
  INSTANCES — the *live* connectors you've actually created. You can have several
              of the same type, e.g. "fileshare_1" (HR) and "fileshare_2" (Legal).
              Each instance has its own credentials and its own evidence ids.

The agent searches INSTANCES; the UI builds the add-menu from TYPES.
"""

from core.connector import Connector

TYPES: dict[str, type[Connector]] = {}        # type_id -> connector class
INSTANCES: dict[str, Connector] = {}          # instance_id -> connector object
_counters: dict[str, int] = {}                # type_id -> how many created so far


def register_type(cls: type[Connector]) -> None:
    """Make a connector class available to be instantiated."""
    TYPES[cls.id] = cls


def list_types() -> list[dict]:
    """The catalog for the 'Add a connector' menu."""
    return [{"type_id": c.id, "name": c.name, "icon": c.icon} for c in TYPES.values()]


def create_instance(type_id: str, label: str | None = None) -> Connector:
    """Create a new live connector of the given type and add it to INSTANCES."""
    cls = TYPES[type_id]
    _counters[type_id] = _counters.get(type_id, 0) + 1
    n = _counters[type_id]
    inst = cls()
    inst.instance_id = f"{type_id}_{n}"
    inst.label = label or (cls.name if n == 1 else f"{cls.name} {n}")
    INSTANCES[inst.instance_id] = inst
    return inst


def remove_instance(instance_id: str) -> None:
    INSTANCES.pop(instance_id, None)


def get(instance_id: str) -> Connector | None:
    return INSTANCES.get(instance_id)


def all_instances() -> list[Connector]:
    return list(INSTANCES.values())


def enabled_instances(instance_ids: list[str]) -> list[Connector]:
    """Only the instances whose ids were passed in (and that still exist)."""
    return [INSTANCES[i] for i in instance_ids if i in INSTANCES]
