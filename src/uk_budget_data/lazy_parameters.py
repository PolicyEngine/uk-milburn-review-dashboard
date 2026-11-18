"""Parameters at an instant built as they are read, not all at once: a
speed-up for the household route's simulations, the same answers.

policyengine-core's ``ParameterNodeAtInstant`` builds a node's whole
subtree at that instant when it is made: ``parameters(period)`` at the root
builds every parameter in the UK tree (about 1,900 nodes) for that date,
though a formula reads a handful. A new simulation's tax-benefit system
starts with empty caches, and the Universal Credit July 2025 reform it runs
as it is built reads 108 monthly dates (2021 to 2029), so building those
trees was more than half of one household simulation's time (measured 18
November 2026: 5.3 s of 9.4 s for a Milburn run, in-process).

``install`` makes each node build a child the first time it is read, and
cache it on the node, as before. A child's value comes from the same
parameter, for the same date, through the same cache
(``ParameterNode._get_at_instant``), so a read gives what the eager build
gave. One difference: the eager build read every child as the node was
made, a lazy node reads it when first asked. A parameter changed in place
in between (``Parameter.update`` clears its ancestors' caches, so only a
node already handed out sees it) would be read as changed. The household
route's checks (tests/test_lazy_parameters.py, and the stored Milburn
examples, which match exactly) cover the runs it serves.

Off unless ``HOUSEHOLD_FAST_RUNS=1``: the Milburn household app sets
it in its image (modal_household.py); the Autumn Budget routes and the
publication pipeline are as before. Safe to install late: a node built
before ``install`` keeps its eager children and reads as it did.
"""

import os

from policyengine_core.errors import ParameterNotFoundError
from policyengine_core.parameters import helpers
from policyengine_core.parameters.parameter_node_at_instant import (
    ParameterNodeAtInstant,
)

ENV = "HOUSEHOLD_FAST_RUNS"
_ORIGINAL = {
    name: ParameterNodeAtInstant.__dict__[name]
    for name in ("__init__", "__getattr__", "add_child")
}
# Instance attributes of a lazy node; any other name read and not set is a
# child.
_OWN = frozenset(
    (
        "_name",
        "_instant_str",
        "_node",
        "_read",
        "_all",
        "_vectorial_node",
    )
)


def enabled(environ=os.environ) -> bool:
    return environ.get(ENV) == "1"


def _init(self, name: str, node, instant_str: str):
    self._name = name
    self._instant_str = instant_str
    self._node = node
    # Children read so far, by name (None: the parameter has no value at
    # this date, which the eager build left out)
    self._read = {}
    self._all = None


def _child(self, key: str):
    state = self.__dict__
    read = state["_read"]
    if key not in read:
        child = state["_node"].children.get(key)
        read[key] = (
            None
            if child is None
            else child._get_at_instant(state["_instant_str"])
        )
    return read[key]


def _children(self) -> dict:
    """Every child with a value at this date, as the eager build's
    ``_children``: built in full the first time it is asked for."""
    state = self.__dict__
    if "_node" not in state:
        # Built eagerly, before install
        return state["_children"]
    if state["_all"] is None:
        state["_all"] = {
            key: value
            for key in state["_node"].children
            if (value := _child(self, key)) is not None
        }
    return state["_all"]


def _getattr(self, key: str):
    if key.startswith("__") or key in _OWN:
        raise AttributeError(key)
    if "_node" not in self.__dict__:
        # Built eagerly, before install
        return _ORIGINAL["__getattr__"](self, key)
    value = _child(self, key)
    if value is None:
        raise ParameterNotFoundError(
            helpers._compose_name(self._name, item_name=key), self._instant_str
        )
    return value


def _add_child(self, child_name: str, child_at_instant):
    if "_node" not in self.__dict__:
        return _ORIGINAL["add_child"](self, child_name, child_at_instant)
    _children(self)[child_name] = child_at_instant
    self._read[child_name] = child_at_instant


def install() -> None:
    """Make parameter nodes at an instant lazy (idempotent)."""
    if ParameterNodeAtInstant.__dict__["__init__"] is _init:
        return
    ParameterNodeAtInstant.__init__ = _init
    ParameterNodeAtInstant.__getattr__ = _getattr
    ParameterNodeAtInstant.add_child = _add_child
    ParameterNodeAtInstant._children = property(_children)


def uninstall() -> None:
    """Back to the engine's eager nodes (for tests)."""
    for name, value in _ORIGINAL.items():
        setattr(ParameterNodeAtInstant, name, value)
    if "_children" in ParameterNodeAtInstant.__dict__:
        del ParameterNodeAtInstant._children


def install_if_enabled(environ=os.environ) -> bool:
    if enabled(environ):
        install()
        return True
    return False
