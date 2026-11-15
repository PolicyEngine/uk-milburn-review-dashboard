import { Database, Package } from "lucide-react";

/**
 * The build's model and data, as the About drawer's "Built with" list
 * (OverviewDrawer) and the site footer say them. This build loads
 * policyengine-uk and a Microcosm UK build directly, not through a
 * policyengine.py release, so the line names both and links neither to a
 * release that does not contain them.
 */
export const MICROCOSM_BUILD = "6f918b81";
export const POLICYENGINE_UK_VERSION = "2.177.7";

/** The one-line statement of what produced the figures. */
export const REPLICATION_LINE = `Microcosm UK build ${MICROCOSM_BUILD}, policyengine-uk ${POLICYENGINE_UK_VERSION}, not in a policyengine.py release`;

/** The chips: the data build, then the model package (on PyPI). */
export function replicationLinks() {
  return [
    {
      key: "data",
      label: `Microcosm UK build ${MICROCOSM_BUILD}`,
      title: "Microcosm UK 2024-25 build, loaded directly: not in a policyengine.py release",
      href: null,
      Icon: Database,
    },
    {
      key: "package",
      label: `policyengine-uk ${POLICYENGINE_UK_VERSION}`,
      title: `policyengine-uk ${POLICYENGINE_UK_VERSION} on PyPI`,
      href: `https://pypi.org/project/policyengine-uk/${POLICYENGINE_UK_VERSION}/`,
      Icon: Package,
    },
  ];
}
